import { useState, useEffect, useCallback } from 'react';
import { messageService, Message, SendMessageData } from '../services/messageService';

import { useAuthenticator } from '@aws-amplify/ui-react';

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { user } = useAuthenticator();

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

  return {
    messages,
    loading,
    error,
    sendMessage,
    fetchMessages,
    isConnected: ws?.readyState === WebSocket.OPEN,
  };
}
