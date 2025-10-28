# Attachment Download Flow Test

## Current Flow:
1. **RDS** stores attachment metadata in `email_metadata.attachments` JSONB:
   ```json
   {
     "filename": "Investor Deck.pdf",
     "s3_key": "incoming-attachments/msg_id/Investor Deck.pdf",
     "s3_url": "s3://iris-bucket101425/incoming-attachments/...",
     "size": 12345,
     "content_type": "application/pdf"
   }
   ```

2. **Lambda `handle_get_messages`** returns attachments array (line 773)

3. **Frontend receives** messages with attachments

4. **User clicks Download** → `downloadAttachment(att.s3_key, att.filename)` called

5. **`downloadAttachment`** calls `getAttachmentDownloadUrl(s3_key)`

6. **`getAttachmentDownloadUrl`** sends to Lambda:
   ```json
   {
     "action": "getAttachmentUrl",
     "s3_key": "incoming-attachments/msg_id/Investor Deck.pdf"
   }
   ```

7. **Lambda `handle_get_attachment_url`** generates presigned URL

8. **Frontend** should receive presigned HTTP URL and trigger download

## Debugging Steps:
1. Check browser console for exact error
2. Verify Lambda URL is correct (should match messageService)
3. Check if response.body is a string that needs parsing
4. Verify presigned URL is being generated correctly

## Expected Console Output:
```
Using Lambda URL for attachment: https://...
Downloading attachment: { s3_key: "incoming-attachments/...", filename: "..." }
Full response from Lambda: { statusCode: 200, body: "{...}" }
Found download_url in body: ...
Got download URL: https://iris-bucket101425.s3.amazonaws.com/...
```

