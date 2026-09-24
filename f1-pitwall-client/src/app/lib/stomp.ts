import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { getAccessToken } from "./pitwall-auth";
import { BASE_URL } from "./api-client";

/**
 * Subscribes to one STOMP topic on the backend and returns a function that tears the
 * connection down. The access token goes in the STOMP CONNECT header (never the URL) and is
 * re-read before every reconnect, so a token refreshed by authFetch is picked up.
 */
export function subscribeToTopic(
  topic: string,
  onMessage: (body: string) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
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
  client.activate();
  return () => {
    void client.deactivate();
  };
}
