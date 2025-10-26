import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({ region: 'us-east-1' });

export async function handler(event: any) {
  console.log("Received event:", event);

  // CORS headers for Function URL
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // Handle OPTIONS preflight request
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Function URL sends the request in event.body as a string
    let payload = event;
    
    if (event.body && typeof event.body === 'string') {
      try {
        payload = JSON.parse(event.body);
        console.log('Parsed body from Function URL:', payload);
      } catch (e) {
        console.error('Failed to parse body:', e);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid JSON in request body' }),
        };
      }
    }
    
    const { action, data } = payload;
    const lambdaName = process.env.LAMBDA_INBOUND_NAME || 'lambda-comms';

    console.log('Action:', action);
    console.log('Data:', data);
    console.log('Full payload:', payload);

    if (!action) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Missing action field',
          received: payload 
        }),
      };
    }

    switch (action) {
      case 'getMessages':
        // Invoke Lambda-comms to get messages from RDS
        console.log('getMessages requested');
        
        const getMessagesPayload = {
          action: 'getMessages',
          email: payload.email || 'demo@irispro.xyz',
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
          headers: corsHeaders,
          body: JSON.stringify({
            messages: responseBody.messages || []
          }),
        };

      case 'sendMessage':
        // Invoke Lambda-comms to send message
        console.log('Sending message via Lambda-comms:', data);
        
        // Transform to lambda-comms's expected format
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
          headers: corsHeaders,
          body: JSON.stringify({
            message: sendResult.message
          }),
        };

      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
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
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
}
