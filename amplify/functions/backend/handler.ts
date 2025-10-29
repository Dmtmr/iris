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
      case 'orchestrateQuery': {
        const url = (process.env.APP_RUNNER_URL || '').trim().replace(/\/$/, '');
        if (!url) {
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'APP_RUNNER_URL not configured' }),
          };
        }

        const { client_id, message_id, query, top_k } = payload;
        if (!client_id || !message_id || !query) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'client_id, message_id and query are required' }),
          };
        }

        // Use fetch with a 20s timeout
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 20000);
        try {
          const resp = await fetch(`${url}/orchestrateQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id, message_id, query, top_k: top_k ?? 5 }),
            signal: controller.signal as any,
          } as any);
          clearTimeout(t);
          if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            return {
              statusCode: resp.status,
              headers: corsHeaders,
              body: JSON.stringify({ error: 'AppRunner request failed', status: resp.status, body: text }),
            };
          }
          const data = await resp.json();
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ client_id, message_id, query, top_k: top_k ?? 5, ...data }),
          };
        } catch (e) {
          clearTimeout(t);
          return {
            statusCode: 504,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'AppRunner request timeout or network error', details: (e as Error).message }),
          };
        }
      }
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

        // The Lambda returns { statusCode: 200, body: '{"messages": [...]}' }
        // So we need to parse the body string to get the actual messages
        const responseBody = typeof getResult.body === 'string' 
          ? JSON.parse(getResult.body) 
          : getResult.body;

        console.log('Parsed response body:', responseBody);

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

      case 'getAttachmentUrl':
        // Proxy presigned URL generation to lambda-comms
        console.log('getAttachmentUrl requested');

        if (!payload.s3_key || typeof payload.s3_key !== 'string') {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Missing or invalid s3_key' }),
          };
        }

        const getUrlPayload = {
          action: 'getAttachmentUrl',
          s3_key: payload.s3_key,
        };

        const getUrlResponse = await lambdaClient.send(
          new InvokeCommand({
            FunctionName: lambdaName,
            Payload: JSON.stringify(getUrlPayload),
          })
        );

        const getUrlResult = JSON.parse(
          new TextDecoder().decode(getUrlResponse.Payload)
        );

        // lambda-comms returns { statusCode, body } - parse body
        const getUrlBody = typeof getUrlResult.body === 'string'
          ? JSON.parse(getUrlResult.body)
          : getUrlResult.body;

        if (getUrlResult.statusCode !== 200) {
          return {
            statusCode: getUrlResult.statusCode || 500,
            headers: corsHeaders,
            body: JSON.stringify(getUrlBody || { error: 'Unknown error' }),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            download_url: getUrlBody.download_url,
            expires_in: getUrlBody.expires_in,
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
