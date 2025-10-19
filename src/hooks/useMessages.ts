import { useState, useEffect, useCallback } from 'react';
import { messageService, Message, SendMessageData } from '../services/messageService';

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Fetch messages from API
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedMessages = await messageService.getMessages();
      setMessages(fetchedMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  }, []);

  // Send a new message
  const sendMessage = useCallback(async (messageData: SendMessageData) => {
    try {
      setError(null);
      const newMessage = await messageService.sendMessage(messageData);
      setMessages(prev => [newMessage, ...prev]);
      return newMessage;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      throw err;
    }
  }, []);

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

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMessages();
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
