// Attachment service for downloading files from S3
const LAMBDA_URL = 'https://v5kaz72sua5rzzei4rfcla2qwq0kyrsb.lambda-url.us-east-1.on.aws/';

export async function getAttachmentDownloadUrl(s3_key: string): Promise<string> {
  try {
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Handle both direct and wrapped responses
    if (result.download_url) {
      return result.download_url;
    } else if (result.body) {
      const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      return body.download_url;
    }

    throw new Error('No download URL in response');
  } catch (error) {
    console.error('Error getting download URL:', error);
    throw error;
  }
}

export async function downloadAttachment(s3_key: string, filename: string): Promise<void> {
  try {
    const url = await getAttachmentDownloadUrl(s3_key);
    
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
    alert('Failed to download attachment');
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

