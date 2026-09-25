import { beforeEach, describe, expect, it, vi } from "vitest";

const { created, FakeClient } = vi.hoisted(() => {
  const created: InstanceType<typeof FakeClient>[] = [];
  class FakeClient {
    connectHeaders: Record<string, string> = {};
    activate = vi.fn();
    deactivate = vi.fn().mockResolvedValue(undefined);
    subscribe = vi.fn();
    constructor(public config: Record<string, (...args: unknown[]) => unknown>) {
      created.push(this);
    }
  }
  return { created, FakeClient };
});

vi.mock("@stomp/stompjs", () => ({ Client: FakeClient }));
vi.mock("sockjs-client", () => ({ default: vi.fn() }));

import { setTokens, clearTokens } from "./pitwall-auth";
import { subscribeToTopic } from "./stomp";

let visibility: DocumentVisibilityState = "visible";
Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });

/** Simulates the user switching away from (or back to) the tab. */
function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  created.length = 0;
  visibility = "visible";
  clearTokens();
});

/** Starts a subscription and waits for the lazily imported STOMP client to be constructed. */
async function start(...args: Parameters<typeof subscribeToTopic>) {
  const stop = subscribeToTopic(...args);
  await vi.waitFor(() => expect(created).toHaveLength(1));
  return { stop, client: created[0] };
}

describe("subscribeToTopic", () => {
  it("sends the access token in the CONNECT header, not the URL", async () => {
    setTokens("access-1", "refresh-1");
    const { client } = await start("/topic/telemetry", () => {});

    client.config.beforeConnect();

    expect(client.connectHeaders).toEqual({ Authorization: "Bearer access-1" });
    await vi.waitFor(() => expect(client.activate).toHaveBeenCalledOnce());
    expect(client.deactivate).not.toHaveBeenCalled();
  });

  it("re-reads the token on each reconnect so a refreshed token is used", async () => {
    setTokens("old", "r");
    const { client } = await start("/topic/telemetry", () => {});
    client.config.beforeConnect();

    setTokens("new", "r");
    client.config.beforeConnect();

    expect(client.connectHeaders.Authorization).toBe("Bearer new");
  });

  it("gives up instead of reconnecting when the user has no token", async () => {
    const { client } = await start("/topic/telemetry", () => {});

    client.config.beforeConnect();

    expect(client.deactivate).toHaveBeenCalledOnce();
  });

  it("subscribes on connect, forwards frame bodies, and reports status", async () => {
    setTokens("a", "r");
    const onMessage = vi.fn();
    const onStatus = vi.fn();
    const { client } = await start("/topic/notifications", onMessage, onStatus);

    client.config.onConnect();
    expect(onStatus).toHaveBeenLastCalledWith(true);
    expect(client.subscribe).toHaveBeenCalledWith("/topic/notifications", expect.any(Function));

    const handler = client.subscribe.mock.calls[0][1] as (f: { body: string }) => void;
    handler({ body: '{"id":1}' });
    expect(onMessage).toHaveBeenCalledWith('{"id":1}');

    client.config.onWebSocketClose();
    expect(onStatus).toHaveBeenLastCalledWith(false);
  });

  it("returns a cleanup function that deactivates the client", async () => {
    setTokens("a", "r");
    const { stop, client } = await start("/topic/telemetry", () => {});

    stop();

    await vi.waitFor(() => expect(client.deactivate).toHaveBeenCalledOnce());
  });

  it("never connects when unsubscribed before the STOMP chunks finish loading", async () => {
    setTokens("a", "r");
    const stop = subscribeToTopic("/topic/telemetry", () => {});

    stop();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(created).toHaveLength(0);
  });

  it("disconnects while the tab is hidden and reconnects when it is visible again", async () => {
    setTokens("a", "r");
    const { client } = await start("/topic/telemetry", () => {});
    await vi.waitFor(() => expect(client.activate).toHaveBeenCalledOnce());

    setVisibility("hidden");
    await vi.waitFor(() => expect(client.deactivate).toHaveBeenCalledOnce());
    expect(client.activate).toHaveBeenCalledOnce();

    setVisibility("visible");
    await vi.waitFor(() => expect(client.activate).toHaveBeenCalledTimes(2));
  });

  it("does not connect a tab that starts hidden until it becomes visible", async () => {
    setTokens("a", "r");
    visibility = "hidden";
    const { client } = await start("/topic/telemetry", () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.activate).not.toHaveBeenCalled();

    setVisibility("visible");
    await vi.waitFor(() => expect(client.activate).toHaveBeenCalledOnce());
  });

  it("stops following visibility once unsubscribed", async () => {
    setTokens("a", "r");
    const { stop, client } = await start("/topic/telemetry", () => {});
    await vi.waitFor(() => expect(client.activate).toHaveBeenCalledOnce());
    stop();
    await vi.waitFor(() => expect(client.deactivate).toHaveBeenCalledOnce());

    setVisibility("hidden");
    setVisibility("visible");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(client.activate).toHaveBeenCalledOnce();
    expect(client.deactivate).toHaveBeenCalledOnce();
  });
});
