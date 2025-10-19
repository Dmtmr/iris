export async function handler(event: any) {
  console.log("Received event:", event);

  try {
    const { action, data } = event;

    switch (action) {
      case 'getMessages':
        // TODO: Fetch messages from database
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                id: 1,
                message_id: 'msg_001',
                timestamp: new Date().toISOString(),
                source_email: 'test@example.com',
                destination_emails: 'user@example.com',
                email_type: 'chat',
                created_at: new Date().toISOString(),
                content: 'Hello! This is a test message from the backend.'
              }
            ]
          }),
        };

      case 'sendMessage':
        // TODO: Save message to database
        console.log('Sending message:', data);
        
        const newMessage = {
          id: Date.now(),
          message_id: `msg_${Date.now()}`,
          timestamp: new Date().toISOString(),
          source_email: data.source_email,
          destination_emails: data.destination_emails,
          email_type: data.email_type,
          created_at: new Date().toISOString(),
          content: data.content
        };

        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: newMessage
          }),
        };

      default:
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: 'Invalid action',
            received: action
          }),
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
}
