import { useState, useEffect, useCallback, useRef } from 'react';
import { messageService, Message, SendMessageData } from '../services/messageService';

import { useAuthenticator } from '@aws-amplify/ui-react';

const PROCESSED_KEY = 'iris_processed_msgids';
const WATERMARK_KEY = 'iris_last_processed_ts';

function loadProcessedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PROCESSED_KEY);
    if (!raw) return new Set<string>();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set<string>(arr) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function saveProcessedIds(ids: Set<string>) {
  try { localStorage.setItem(PROCESSED_KEY, JSON.stringify(Array.from(ids))); } catch {}
}

function loadWatermark(): number {
  try {
    const raw = localStorage.getItem(WATERMARK_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function saveWatermark(tsMs: number) {
  try { localStorage.setItem(WATERMARK_KEY, String(tsMs)); } catch {}
}

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { user } = useAuthenticator();
  const processedRef = useRef<Set<string>>(loadProcessedIds());
  const watermarkRef = useRef<number>(loadWatermark());

  // Fetch messages from API
  const fetchMessages = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      // Use demo@irispro.xyz which has messages in the database
      const userEmail = 'demo@irispro.xyz';
      const fetchedMessages = await messageService.getMessages(userEmail);
      setMessages(fetchedMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  // Send a new message
  const sendMessage = useCallback(async (messageData: SendMessageData) => {
    try {
      setError(null);
      const newMessage = await messageService.sendMessage(messageData);

      // Optimistic add only if the returned shape looks like a Message
      if (newMessage && typeof newMessage === 'object' && 'created_at' in newMessage) {
        setMessages(prev => [newMessage as Message, ...prev]);
      }

      // Reconcile with server shortly after send to ensure persistence is reflected
      setTimeout(() => {
        fetchMessages(false);
      }, 1200);

      return newMessage;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      throw err;
    }
  }, [fetchMessages]);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const websocket = messageService.connectWebSocket((newMessage) => {
      setMessages(prev => [newMessage, ...prev]);
    });

    if (websocket) {
      setWs(websocket);
    }

    // Cleanup on unmount
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, []);

  // Initial fetch (show loading)
  useEffect(() => {
    fetchMessages(true);
  }, [fetchMessages]);

  // Poll for new messages every 5 seconds (don't show loading)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMessages(false); // Silent background refresh
    }, 5000); // 5 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, [fetchMessages]);

  // Auto-orchestrate for new messages (fail-soft, no blocking UI)
  useEffect(() => {
    console.log('[AUTO-ORCHESTRATE] useEffect triggered, messages.length:', messages?.length);
    if (!messages || messages.length === 0) return;

    const clientId = 'demo@irispro.xyz'; // matches current embeddings usage
    const isNoise = (subject?: string) => {
      if (!subject) return false;
      const s = subject.toLowerCase();
      return (
        s.includes('delivery status notification') ||
        s.includes('undeliverable') ||
        s.includes('mailer-daemon') ||
        s.includes('bounce')
      );
    };

    let delay = 0;
    messages.forEach((m) => {
      const id = m.message_id;
      if (!id) return;
      if (m.email_type === 'outgoing') return; // skip outgoing messages (user replies)
      if (processedRef.current.has(id)) return; // already processed across sessions
      const body = m.body_text || '';
      const subject = m.subject || '';
      // Skip only if BOTH subject and body are too short
      if (subject.trim().length < 10 && body.trim().length < 20) return;
      if (isNoise(subject)) return; // skip DSN/bounce

      // Only process messages newer than the watermark (if set)
      const createdAtMs = m.created_at ? Date.parse(m.created_at) : 0;
      if (watermarkRef.current && createdAtMs && createdAtMs <= watermarkRef.current) {
        return;
      }

      // Mark as processed optimistically and persist to avoid duplicate scheduling across refreshes
      processedRef.current.add(id);
      saveProcessedIds(processedRef.current);

      const query = `${subject}\n\n${body.slice(0, 1500)}`.trim();
      const top_k = 15;

      // Stagger requests slightly
      setTimeout(() => {
        messageService
          .orchestrateQuery({ client_id: clientId, message_id: id, query, top_k })
          .then((res) => {
            if (res && res.task) {
              console.log('Auto-orchestrate result for', id, res);
              // Update watermark to the max seen timestamp and persist
              const ts = createdAtMs || Date.now();
              if (!watermarkRef.current || ts > watermarkRef.current) {
                watermarkRef.current = ts;
                saveWatermark(watermarkRef.current);
              }
            }
          })
          .catch((e) => {
            console.warn('Auto-orchestrate failed for', id, e);
          });
      }, delay);
      delay += 400; // 0.4s between calls
    });
  }, [messages]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    fetchMessages,
    isConnected: ws?.readyState === WebSocket.OPEN,
  };
}
