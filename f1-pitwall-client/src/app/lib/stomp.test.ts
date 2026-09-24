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

beforeEach(() => {
  created.length = 0;
  clearTokens();
});

describe("subscribeToTopic", () => {
  it("sends the access token in the CONNECT header, not the URL", () => {
    setTokens("access-1", "refresh-1");
    subscribeToTopic("/topic/telemetry", () => {});
    const client = created[0];

    client.config.beforeConnect();

    expect(client.connectHeaders).toEqual({ Authorization: "Bearer access-1" });
    expect(client.deactivate).not.toHaveBeenCalled();
    expect(client.activate).toHaveBeenCalledOnce();
  });

  it("re-reads the token on each reconnect so a refreshed token is used", () => {
    setTokens("old", "r");
    subscribeToTopic("/topic/telemetry", () => {});
    const client = created[0];
    client.config.beforeConnect();

    setTokens("new", "r");
    client.config.beforeConnect();

    expect(client.connectHeaders.Authorization).toBe("Bearer new");
  });

  it("gives up instead of reconnecting when the user has no token", () => {
    subscribeToTopic("/topic/telemetry", () => {});
    const client = created[0];

    client.config.beforeConnect();

    expect(client.deactivate).toHaveBeenCalledOnce();
  });

  it("subscribes on connect, forwards frame bodies, and reports status", () => {
    setTokens("a", "r");
    const onMessage = vi.fn();
    const onStatus = vi.fn();
    subscribeToTopic("/topic/notifications", onMessage, onStatus);
    const client = created[0];

    client.config.onConnect();
    expect(onStatus).toHaveBeenLastCalledWith(true);
    expect(client.subscribe).toHaveBeenCalledWith("/topic/notifications", expect.any(Function));

    const handler = client.subscribe.mock.calls[0][1] as (f: { body: string }) => void;
    handler({ body: '{"id":1}' });
    expect(onMessage).toHaveBeenCalledWith('{"id":1}');

    client.config.onWebSocketClose();
    expect(onStatus).toHaveBeenLastCalledWith(false);
  });

  it("returns a cleanup function that deactivates the client", () => {
    setTokens("a", "r");
    const stop = subscribeToTopic("/topic/telemetry", () => {});

    stop();

    expect(created[0].deactivate).toHaveBeenCalledOnce();
  });
});
