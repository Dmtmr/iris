// Attachment service for downloading files from S3
function getLambdaUrl(): string {
  // Try to get from Vite env first
  try {
    const viteEnv = (import.meta as any)?.env;
    if (viteEnv?.VITE_FUNCTION_URL_OVERRIDE) {
      return viteEnv.VITE_FUNCTION_URL_OVERRIDE as string;
    }
  } catch {}

  // Try from window.amplify_outputs
  if (typeof window !== 'undefined') {
    const outputs = (window as any).amplify_outputs;
    if (outputs?.custom?.backendFunctionUrl) {
      return outputs.custom.backendFunctionUrl;
    }
  }

  // Fallback to production
  return 'https://v5kaz72sua5rzzei4rfcla2qwq0kyrsb.lambda-url.us-east-1.on.aws/';
}

export async function getAttachmentDownloadUrl(s3_key: string): Promise<string> {
  try {
    const LAMBDA_URL = getLambdaUrl();
    console.log('Using Lambda URL for attachment:', LAMBDA_URL);
    
    const response = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'getAttachmentUrl',
        s3_key: s3_key
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response not OK:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Full response from Lambda:', result);
    
    // Handle both direct and wrapped responses
    if (result.download_url) {
      console.log('Found download_url directly in result');
      return result.download_url;
    } else if (result.body) {
      console.log('Found download_url in body:', result.body);
      const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      console.log('Parsed body:', body);
      return body.download_url;
    }

    console.error('No download_url found in response:', result);
    throw new Error('No download URL in response');
  } catch (error) {
    console.error('Error getting download URL:', error);
    throw error;
  }
}

export async function downloadAttachment(s3_key: string, filename: string): Promise<void> {
  try {
    console.log('Downloading attachment:', { s3_key, filename });
    const url = await getAttachmentDownloadUrl(s3_key);
    console.log('Got download URL:', url);
    
    // Create a temporary link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    alert(`Failed to download attachment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

