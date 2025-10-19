import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({ region: 'us-east-1' });

export async function handler(event: any) {
  console.log("Received event:", event);

  try {
    const { action, data } = event;
    const lambdaName = process.env.LAMBDA_INBOUND_NAME || 'lambda-inbound';

    switch (action) {
      case 'getMessages':
        // Invoke Lambda-Inbound to get messages from RDS
        console.log('getMessages requested');
        
        const getMessagesPayload = {
          action: 'getMessages',
          email: data?.email || 'demo@irispro.xyz',
        };

        const getResponse = await lambdaClient.send(
          new InvokeCommand({
            FunctionName: lambdaName,
            Payload: JSON.stringify(getMessagesPayload),
          })
        );

        const getResult = JSON.parse(
          new TextDecoder().decode(getResponse.Payload)
        );
        
        console.log('getMessages response:', getResult);

        // Parse the body if it's a string
        const responseBody = typeof getResult.body === 'string' 
          ? JSON.parse(getResult.body) 
          : getResult.body;

        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: responseBody.messages || []
          }),
        };

      case 'sendMessage':
        // Invoke Lambda-Inbound to send message
        console.log('Sending message via Lambda-Inbound:', data);
        
        // Transform to lambda-inbound's expected format
        const sendMessagePayload = {
          to_email: data.destination_emails,
          subject: data.subject || `Message from ${data.source_email}`,
          body_text: data.content,
          body_html: data.body_html || `<p>${data.content}</p>`,
        };

        const sendResponse = await lambdaClient.send(
          new InvokeCommand({
            FunctionName: lambdaName,
            Payload: JSON.stringify(sendMessagePayload),
          })
        );

        const sendResult = JSON.parse(
          new TextDecoder().decode(sendResponse.Payload)
        );

        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: sendResult.message
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
