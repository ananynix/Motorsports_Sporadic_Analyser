import { useEffect, useRef } from 'react'

export type ConnectionStatus = 'connecting' | 'live' | 'disconnected'

const MAX_RECONNECT_DELAY_MS = 10000

/**
 * Opens a WebSocket to `url`, parses each message as JSON and hands it to
 * `onMessage`, and reports connection state via `onStatusChange`. Reconnects
 * automatically with exponential backoff (1s, 2s, 4s, ... capped at 10s) on
 * close/error, since the native WebSocket API does neither on its own.
 */
export function useWebSocketConnection(
  url: string,
  onMessage: (data: any) => void,
  onStatusChange: (status: ConnectionStatus) => void,
) {
  // Refs so a caller passing fresh inline closures each render doesn't tear
  // down and reopen the socket every render -- only `url` should do that.
  const onMessageRef = useRef(onMessage)
  const onStatusChangeRef = useRef(onStatusChange)
  onMessageRef.current = onMessage
  onStatusChangeRef.current = onStatusChange

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let cleanedUp = false

    const connect = () => {
      onStatusChangeRef.current('connecting')
      ws = new WebSocket(url)

      ws.onopen = () => {
        attempt = 0
        onStatusChangeRef.current('live')
      }

      ws.onmessage = (event) => {
        try {
          onMessageRef.current(JSON.parse(event.data))
        } catch (e) {
          console.error(`Error parsing WS message from ${url}`, e)
        }
      }

      ws.onclose = () => {
        onStatusChangeRef.current('disconnected')
        if (!cleanedUp) {
          const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS)
          attempt += 1
          reconnectTimer = setTimeout(connect, delay)
        }
      }

      ws.onerror = () => {
        ws?.close()
      }
    }

    connect()

    return () => {
      cleanedUp = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [url])
}
