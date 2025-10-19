import { generateClient } from 'aws-amplify/data';

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
  async getMessages(): Promise<Message[]> {
    try {
      // Call Lambda function to get messages
      const response = await (client as any).functions.backend.invoke({
        payload: {
          action: 'getMessages'
        }
      });

      console.log('Get messages response:', response);
      
      // Parse the response
      if (response.body) {
        const body = JSON.parse(response.body);
        return body.messages || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  async sendMessage(messageData: SendMessageData): Promise<Message> {
    try {
      // Call Lambda function to send message
      const response = await (client as any).functions.backend.invoke({
        payload: {
          action: 'sendMessage',
          data: messageData
        }
      });

      console.log('Send message response:', response);

      // Parse the response
      if (response.body) {
        const body = JSON.parse(response.body);
        return body.message;
      }

      throw new Error('Invalid response from backend');
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
