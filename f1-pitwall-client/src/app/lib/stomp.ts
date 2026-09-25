import { getAccessToken } from "./pitwall-auth";
import { BASE_URL } from "./api-client";

/**
 * Subscribes to one STOMP topic on the backend and returns a function that tears the
 * connection down. The access token goes in the STOMP CONNECT header (never the URL) and is
 * re-read before every reconnect, so a token refreshed by authFetch is picked up.
 *
 * sockjs-client and @stomp/stompjs are imported on first use so routes that never subscribe
 * (and the global navbar before a user is signed in) do not ship them in their bundle.
 *
 * The socket is closed while the tab is hidden and reopened when it becomes visible again: an
 * open socket (or its 5 s reconnect loop) from a forgotten tab would otherwise keep the backend
 * awake around the clock and burn through its hosting plan's instance hours.
 */
export function subscribeToTopic(
  topic: string,
  onMessage: (body: string) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  let cancelled = false;
  let stop: (() => void) | undefined;

  void Promise.all([import("sockjs-client"), import("@stomp/stompjs")])
    .then(([{ default: SockJS }, { Client }]) => {
      // The caller may have unsubscribed while the chunks were loading.
      if (cancelled) return;
      const client = new Client({
        webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
        reconnectDelay: 5000,
        beforeConnect: () => {
          const token = getAccessToken();
          if (!token) {
            void client.deactivate();
            return;
          }
          client.connectHeaders = { Authorization: `Bearer ${token}` };
        },
        onConnect: () => {
          onStatus?.(true);
          client.subscribe(topic, (frame) => onMessage(frame.body));
        },
        onWebSocketClose: () => onStatus?.(false),
        onStompError: () => onStatus?.(false),
      });
      // Chained so a quick hide/show waits for the previous deactivation to finish before
      // activating again, and so the latest visibility state always wins.
      let transition: Promise<void> = Promise.resolve();
      const syncWithVisibility = () => {
        transition = transition.then(() => {
          if (cancelled) return;
          if (document.visibilityState === "hidden") return client.deactivate();
          client.activate();
        });
      };
      document.addEventListener("visibilitychange", syncWithVisibility);
      syncWithVisibility();
      stop = () => {
        document.removeEventListener("visibilitychange", syncWithVisibility);
        void transition.then(() => client.deactivate());
      };
    })
    .catch(() => {
      if (!cancelled) onStatus?.(false);
    });

  return () => {
    cancelled = true;
    stop?.();
  };
}
