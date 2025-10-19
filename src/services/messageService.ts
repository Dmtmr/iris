import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

Amplify.configure(outputs);

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
  subject?: string;
  body_html?: string;
}

class MessageService {
  private functionUrl: string = 'https://v5kaz72sua5rzzei4rfcla2qwq0kyrsb.lambda-url.us-east-1.on.aws/';

  constructor() {
    // Check if Function URL is available in amplify_outputs (future enhancement)
    if (typeof window !== 'undefined' && (window as any).amplify_outputs?.custom?.backendFunctionUrl) {
      this.functionUrl = (window as any).amplify_outputs.custom.backendFunctionUrl;
      console.log('Using Function URL from amplify_outputs:', this.functionUrl);
    } else {
      console.log('Using hardcoded Function URL:', this.functionUrl);
    }
  }

  async getMessages(): Promise<Message[]> {
    try {
      console.log('getMessages called with Function URL:', this.functionUrl);

      const response = await fetch(this.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getMessages',
          email: 'demo@irispro.xyz'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Get messages response:', result);
      
      // Parse the response body if it's a string
      const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      return body?.messages || [];
      
    } catch (error) {
      console.error('Error fetching messages:', error);
      return []; // Return empty array instead of throwing
    }
  }

  async sendMessage(messageData: SendMessageData): Promise<Message> {
    try {
      console.log('sendMessage called with:', messageData);
      console.log('Using Function URL:', this.functionUrl);

      const response = await fetch(this.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendMessage',
          data: messageData
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Send message response:', result);
      
      // Parse the response body if it's a string
      const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      return body?.message || {
        id: Date.now(),
        message_id: `msg_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source_email: messageData.source_email,
        destination_emails: messageData.destination_emails,
        s3_location: '',
        email_type: messageData.email_type,
        created_at: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // WebSocket connection for real-time messages (to be implemented later)
  connectWebSocket(_onMessage: (message: Message) => void): WebSocket | null {
    console.log('WebSocket not implemented yet');
    // TODO: Implement WebSocket connection
    return null;
  }
}

export const messageService = new MessageService();
