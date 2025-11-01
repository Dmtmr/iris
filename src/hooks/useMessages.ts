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
  // NOTE: This is completely independent of auto-orchestration toggle
  // Messages are ALWAYS fetched and displayed, regardless of toggle state
  const fetchMessages = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      // Use demo@irispro.xyz which has messages in the database
      const userEmail = 'demo@irispro.xyz';
      console.log('[MESSAGE FETCH] Fetching messages (independent of auto-orchestration toggle)');
      const fetchedMessages = await messageService.getMessages(userEmail);
      console.log('[MESSAGE FETCH] Received', fetchedMessages?.length || 0, 'messages');
      
      // Merge fetched messages with existing ones, preserving fake attachments
      setMessages(prev => {
        // Find messages with fake attachments in current state
        const optimisticMessagesById = new Map<string, Message>();
        const optimisticMessagesByContent = new Map<string, Message>();
        
        prev.forEach(msg => {
          if (msg.attachments && msg.attachments.some(att => att.s3_key?.startsWith('fake/'))) {
            optimisticMessagesById.set(msg.message_id, msg);
            // Create content-based key for matching - normalize the content
            const bodyText = (msg.body_text || '').trim().substring(0, 100);
            const contentKey = `${msg.created_at}_${bodyText}`;
            optimisticMessagesByContent.set(contentKey, msg);
            console.log('[MESSAGE FETCH] Found optimistic message with attachments:', {
              id: msg.message_id,
              contentKey,
              bodyText: bodyText.substring(0, 30),
              attachments: msg.attachments.length
            });
          }
        });
        
        // If no optimistic messages with attachments, just return fetched messages
        if (optimisticMessagesById.size === 0) {
          console.log('[MESSAGE FETCH] No optimistic messages with attachments, returning fetched as-is');
          return fetchedMessages;
        }
        
        // Track which messages to include in final result
        const merged: Message[] = [];
        const includedMessageIds = new Set<string>();
        const skippedFetchedIds = new Set<string>();
        
        // First: Identify all fetched messages that match optimistic ones (by id or content)
        console.log('[MESSAGE FETCH] Checking', fetchedMessages.length, 'fetched messages against', optimisticMessagesById.size, 'optimistic messages');
        fetchedMessages.forEach(fetched => {
          // Try matching by message_id first
          let matchingOptimistic = optimisticMessagesById.get(fetched.message_id);
          
          // If not found, try matching by content (normalize both)
          if (!matchingOptimistic) {
            const fetchedBodyText = (fetched.body_text || '').trim().substring(0, 100);
            const fetchedContentKey = `${fetched.created_at}_${fetchedBodyText}`;
            matchingOptimistic = optimisticMessagesByContent.get(fetchedContentKey);
            
            // Also try matching without exact timestamp match (in case timestamps differ slightly)
            if (!matchingOptimistic) {
              optimisticMessagesByContent.forEach((optMsg, contentKey) => {
                if (contentKey.includes(fetchedBodyText) && fetchedBodyText.length > 20) {
                  // Content matches, use this optimistic message
                  matchingOptimistic = optMsg;
                  console.log('[MESSAGE FETCH] Matched by content text only:', fetched.message_id, '->', optMsg.message_id);
                }
              });
            } else {
              console.log('[MESSAGE FETCH] Matched fetched', fetched.message_id, 'to optimistic', matchingOptimistic.message_id, 'by exact content key');
            }
          } else {
            console.log('[MESSAGE FETCH] Matched fetched', fetched.message_id, 'to optimistic', matchingOptimistic.message_id, 'by message_id');
          }
          
          if (matchingOptimistic) {
            // This fetched message matches an optimistic one - skip it
            skippedFetchedIds.add(fetched.message_id);
            console.log('[MESSAGE FETCH] ✓ Will skip fetched message', fetched.message_id, '(matches optimistic', matchingOptimistic.message_id, ')');
          } else {
            console.log('[MESSAGE FETCH] ✗ No match for fetched message', fetched.message_id, 'body:', (fetched.body_text || '').substring(0, 30));
          }
        });
        
        // Second: Add all optimistic messages (they have attachments, so we prefer them)
        optimisticMessagesById.forEach((optimisticMsg, optimisticId) => {
          if (!includedMessageIds.has(optimisticId)) {
            console.log('[MESSAGE FETCH] ✓ Adding optimistic message with attachments:', optimisticId);
            merged.push(optimisticMsg);
            includedMessageIds.add(optimisticId);
          }
        });
        
        // Third: Add fetched messages that DON'T match any optimistic message
        fetchedMessages.forEach(fetched => {
          if (skippedFetchedIds.has(fetched.message_id)) {
            console.log('[MESSAGE FETCH] ✗ Skipping fetched message (matches optimistic):', fetched.message_id);
            return;
          }
          
          if (!includedMessageIds.has(fetched.message_id)) {
            console.log('[MESSAGE FETCH] ✓ Adding fetched message (no match):', fetched.message_id);
            merged.push(fetched);
            includedMessageIds.add(fetched.message_id);
          }
        });
        
        // Final deduplication: Remove any messages without attachments if there's a matching one with attachments
        const finalMerged: Message[] = [];
        const contentSeen = new Map<string, Message>();
        
        merged.forEach(msg => {
          const bodyText = (msg.body_text || '').trim().substring(0, 100);
          const hasAttachments = msg.attachments && msg.attachments.some(att => att.s3_key?.startsWith('fake/'));
          const contentKey = bodyText;
          
          const existing = contentSeen.get(contentKey);
          if (existing) {
            const existingHasAttachments = existing.attachments && existing.attachments.some(att => att.s3_key?.startsWith('fake/'));
            // If existing has attachments and new one doesn't, keep existing
            if (existingHasAttachments && !hasAttachments) {
              console.log('[MESSAGE FETCH] Dedupe: Keeping message with attachments, skipping duplicate without:', msg.message_id);
              return; // Skip this one
            }
            // If new one has attachments and existing doesn't, replace
            if (!existingHasAttachments && hasAttachments) {
              console.log('[MESSAGE FETCH] Dedupe: Replacing message without attachments with one that has:', existing.message_id, '->', msg.message_id);
              const index = finalMerged.indexOf(existing);
              if (index >= 0) {
                finalMerged[index] = msg;
              }
              contentSeen.set(contentKey, msg);
              return;
            }
            // Both have or both don't have - skip duplicate
            console.log('[MESSAGE FETCH] Dedupe: Skipping duplicate message:', msg.message_id);
            return;
          }
          
          // First time seeing this content
          finalMerged.push(msg);
          contentSeen.set(contentKey, msg);
        });
        
        // Sort by created_at descending (newest first)
        finalMerged.sort((a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          return timeB - timeA;
        });
        
        console.log('[MESSAGE FETCH] Final result after dedupe:', {
          before: merged.length,
          after: finalMerged.length,
          skippedFetched: skippedFetchedIds.size,
          optimisticAdded: optimisticMessagesById.size,
          withAttachments: finalMerged.filter(m => m.attachments?.some(a => a.s3_key?.startsWith('fake/'))).length,
          withoutAttachments: finalMerged.filter(m => !m.attachments || !m.attachments.some(a => a.s3_key?.startsWith('fake/'))).length
        });
        
        return finalMerged;
      });
    } catch (err) {
      console.error('[MESSAGE FETCH] Error:', err);
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
  // NOTE: This only affects TASK CREATION, not message fetching/display.
  // Messages are fetched and displayed independently via other useEffects above.
  useEffect(() => {
    // Check if auto-orchestration is enabled
    try {
      const enabled = localStorage.getItem('iris_auto_orchestration_enabled');
      if (enabled === 'false') {
        console.log('[AUTO-ORCHESTRATE] Disabled by user toggle - tasks will not be created, but messages will still be fetched/displayed');
        return; // Exit early - this only prevents task creation, not message fetching
      }
    } catch {
      // Default to enabled if can't read localStorage
    }
    
    console.log('[AUTO-ORCHESTRATE] useEffect triggered, messages.length:', messages?.length);
    if (!messages || messages.length === 0) return;

    // Double-check toggle is enabled before processing any messages
    let isEnabled = true;
    try {
      const enabled = localStorage.getItem('iris_auto_orchestration_enabled');
      isEnabled = enabled !== 'false';
    } catch {
      isEnabled = true; // default to enabled
    }
    
    if (!isEnabled) {
      console.log('[AUTO-ORCHESTRATE] Toggle is OFF - not processing any messages for task creation');
      return; // Exit before processing any messages
    }

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

      const query = `${subject}\n\n${body.slice(0, 1500)}`.trim();
      const top_k = 15;

      // Stagger requests slightly
      setTimeout(() => {
        // Check toggle again right before calling orchestrateQuery (in case it changed)
        try {
          const enabled = localStorage.getItem('iris_auto_orchestration_enabled');
          if (enabled === 'false') {
            console.log('[AUTO-ORCHESTRATE] Skipping', id, '- disabled by user toggle');
            return; // Don't mark as processed, allow it to be processed later when toggle is on
          }
        } catch {
          // Default to enabled if can't read localStorage
        }
        
        // Mark as processed only when we actually call orchestrateQuery
        processedRef.current.add(id);
        saveProcessedIds(processedRef.current);
        
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
