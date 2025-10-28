import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

Amplify.configure(outputs);

const client = generateClient();

export interface Attachment {
  filename: string;
  s3_key: string;
  s3_url: string;
  size: number;
  content_type: string;
}

export interface Message {
  id: number;
  message_id: string;
  timestamp: string;
  source_email: string;
  destination_emails: string;
  s3_location?: string;
  email_type: string;
  created_at: string;
  subject?: string;
  body_text?: string;
  attachments?: Attachment[];
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
  private functionUrl: string = '';

  constructor() {
    // 1) Allow local override via Vite env
    try {
      const viteEnv = (import.meta as any)?.env;
      if (viteEnv?.VITE_FUNCTION_URL_OVERRIDE) {
        this.functionUrl = viteEnv.VITE_FUNCTION_URL_OVERRIDE as string;
        console.log('Using Function URL from VITE_FUNCTION_URL_OVERRIDE:', this.functionUrl);
        return;
      }
    } catch {}

    // 2) Try to get Function URL from amplify_outputs.json (window.amplify_outputs)
    if (typeof window !== 'undefined') {
      // Check if amplify_outputs is in window (loaded by Amplify)
      const outputs = (window as any).amplify_outputs;
      if (outputs?.custom?.backendFunctionUrl) {
        this.functionUrl = outputs.custom.backendFunctionUrl;
        console.log('Using Function URL from amplify_outputs:', this.functionUrl);
      } else {
        // Fallback to production URL
        this.functionUrl = 'https://v5kaz72sua5rzzei4rfcla2qwq0kyrsb.lambda-url.us-east-1.on.aws/';
        console.log('Using production Function URL:', this.functionUrl);
      }
    }
  }

  async getMessages(userEmail?: string): Promise<Message[]> {
    try {
      console.log('getMessages called with Function URL:', this.functionUrl);
      let emailToQuery = userEmail || 'demo@irispro.xyz';

      // 1) URL param (?email=foo@bar) takes highest precedence for local dev
      try {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const paramEmail = params.get('email');
          if (paramEmail) {
            emailToQuery = paramEmail;
          }
        }
      } catch {}

      // 2) Local storage override (set via DevTools): localStorage.setItem('messages_email_override', 'user@domain')
      try {
        if (typeof window !== 'undefined') {
          const lsEmail = window.localStorage?.getItem('messages_email_override');
          if (lsEmail) {
            emailToQuery = lsEmail;
          }
        }
      } catch {}

      // 3) Vite env override from .env.local
      try {
        const viteEnv = (import.meta as any)?.env;
        if (viteEnv?.VITE_MESSAGES_EMAIL_OVERRIDE) {
          emailToQuery = viteEnv.VITE_MESSAGES_EMAIL_OVERRIDE as string;
        }
      } catch {}
      console.log('Using email filter:', emailToQuery);

      const response = await fetch(this.functionUrl, {
        method: 'POST',
        headers: {
          // Use text/plain to avoid CORS preflight in browsers
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
          action: 'getMessages',
          email: emailToQuery
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Get messages response:', result);
      console.log('Response type:', typeof result);
      console.log('Has body?:', 'body' in result);
      console.log('Has messages?:', 'messages' in result);
      
      // Function URL returns the response directly, not wrapped in statusCode/body
      if (result.messages) {
        // Direct response
        return result.messages;
      } else if (result.body) {
        // Wrapped response
        const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
        return body?.messages || [];
      }
      
      return [];
      
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
          // Use text/plain to avoid CORS preflight in browsers
          'Content-Type': 'text/plain',
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
      
      // Function URL returns the response directly, not wrapped in statusCode/body
      if (result.message) {
        // Direct response
        return result.message;
      } else if (result.body) {
        // Wrapped response
        const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
        return body?.message;
      }
      
      // Fallback mock message
      return {
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
