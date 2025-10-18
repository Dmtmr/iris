import { generateClient } from 'aws-amplify/api';

const client = generateClient();

export interface Message {
  id: number;
  message_id: string;
  timestamp: string;
  source_email: string;
  destination_emails: string;
  s3_location?: string;
  email_type: string;
  created_at: string;
}

export interface SendMessageData {
  source_email: string;
  destination_emails: string;
  content: string;
  email_type: string;
}

class MessageService {
  private baseUrl = '';

  constructor() {
    // Get the API endpoint from Amplify outputs
    if (typeof window !== 'undefined' && (window as any).amplify_outputs) {
      this.baseUrl = (window as any).amplify_outputs.custom.messageHandlerApiUrl || '';
    }
  }

  async getMessages(): Promise<Message[]> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  async sendMessage(messageData: SendMessageData): Promise<Message> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // WebSocket connection for real-time messages
  connectWebSocket(onMessage: (message: Message) => void): WebSocket | null {
    try {
      const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
      };

      return ws;
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      return null;
    }
  }
}

export const messageService = new MessageService();
