<!-- fefd239e-c9a6-4649-a1b9-51f42dea3982 a6c1b2c6-b782-4add-a430-38824196b0b7 -->
# Add Email Embeddings to Lambda-Comms

## Overview

Integrate OpenAI embeddings into email processing flow. Embeddings will be generated asynchronously after emails are saved, using separate functions to avoid breaking existing functionality.

## Existing Schema (Already Set Up)

```sql
embeddings table:
- id (integer, PK)
- client_id (varchar 255) - identifies which client/user
- content_text (text) - the text that was embedded
- embedding_vector (vector) - pgvector type for semantic search
- source_type (varchar 50) - e.g., 'email_incoming', 'email_outgoing'
- source_id (varchar 500) - the message_id
- created_at (timestamp)
```

## Implementation Steps

### 1. Add Embedding Generation Functions

**File: `ai-backend/lambda-comms/lambda_comms_src/lambda_comms.py`**

Add new functions (after existing test_embedding function, around line 657):

```python
def generate_email_embedding(text: str) -> list:
    """Generate OpenAI embedding for email content"""
    try:
        if not OPENAI_API_KEY:
            print("⚠️ OPENAI_API_KEY not set, skipping embedding")
            return None
            
        import openai
        openai.api_key = OPENAI_API_KEY
        
        # Generate embedding
        response = openai.embeddings.create(
            model="text-embedding-3-small",
            input=text[:8000]  # Limit to ~8K chars
        )
        embedding = response.data[0].embedding
        print(f"✅ Generated embedding: {len(embedding)} dimensions")
        return embedding
        
    except Exception as e:
        print(f"❌ Embedding generation failed: {e}")
        return None

def store_embedding_async(client_id: str, content_text: str, embedding_vector: list, 
                         source_type: str, source_id: str):
    """Store embedding in pgvector table asynchronously"""
    try:
        connection = get_db_connection()
        if not connection:
            print("❌ No DB connection for embedding storage")
            return False
            
        cursor = connection.cursor()
        
        # Convert list to pgvector format
        vector_str = '[' + ','.join(map(str, embedding_vector)) + ']'
        
        sql = """
        INSERT INTO embeddings (client_id, content_text, embedding_vector, source_type, source_id, created_at)
        VALUES (%s, %s, %s::vector, %s, %s, NOW())
        """
        
        cursor.execute(sql, (
            client_id,
            content_text[:5000],  # Truncate if too long
            vector_str,
            source_type,
            source_id
        ))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        print(f"✅ Stored embedding for {source_type}: {source_id}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to store embedding: {e}")
        traceback.print_exc()
        return False

def process_email_embedding(message_id: str, client_id: str, subject: str, 
                           body_text: str, source_type: str):
    """Async wrapper: Generate and store embedding for an email"""
    try:
        # Combine subject + body for embedding
        content = f"{subject}\n\n{body_text}" if subject and body_text else (subject or body_text or "")
        
        if not content or len(content.strip()) < 10:
            print(f"⚠️ Content too short for embedding, skipping")
            return False
        
        # Generate embedding
        embedding = generate_email_embedding(content)
        
        if embedding:
            # Store in pgvector
            return store_embedding_async(
                client_id=client_id,
                content_text=content,
                embedding_vector=embedding,
                source_type=source_type,
                source_id=message_id
            )
        return False
        
    except Exception as e:
        print(f"❌ process_email_embedding failed: {e}")
        return False
```

### 2. Integrate into Incoming Email Handler

**File: `ai-backend/lambda-comms/lambda_comms_src/lambda_comms.py`**

After STEP 5 (around line 392, after `store_email_metadata`), add:

```python
            # STEP 5.5: Generate and store embedding asynchronously
            try:
                process_email_embedding(
                    message_id=message_id,
                    client_id=recipient,  # Use recipient email as client_id
                    subject=subject,
                    body_text=body_text,
                    source_type='email_incoming'
                )
            except Exception as e:
                print(f"⚠️ Embedding generation failed (non-critical): {e}")
```

### 3. Integrate into Outgoing Email Handler

**File: `ai-backend/lambda-comms/lambda_comms_src/lambda_comms.py`**

After the existing metadata storage (around line 550, after `store_email_metadata`), add:

```python
        # Generate and store embedding asynchronously
        try:
            process_email_embedding(
                message_id=message_id,
                client_id=from_email,  # Use sender as client_id
                subject=subject,
                body_text=body_text,
                source_type='email_outgoing'
            )
        except Exception as e:
            print(f"⚠️ Embedding generation failed (non-critical): {e}")
```

### 4. Deploy and Test

- Deploy CDK stack: `cd ai-backend/lambda-comms && npx cdk deploy --yes`
- Test incoming email by sending an email to your SES address
- Test outgoing email via Lambda console with existing test payload
- Verify embeddings are stored: `SELECT COUNT(*), source_type FROM embeddings GROUP BY source_type;`

## Key Design Decisions

1. **Separate functions** - All embedding logic is isolated in 3 new functions, won't affect existing email flow
2. **Graceful degradation** - If embedding fails, email still processes normally (wrapped in try/except)
3. **Async processing** - Embeddings generated after email is saved, no added latency to email delivery
4. **Client ID mapping** - Uses `recipient` for incoming, `sender` for outgoing as client_id
5. **Content combination** - Embeds subject + body together for better semantic search

### To-dos

- [ ] Add generate_email_embedding, store_embedding_async, and process_email_embedding functions to lambda_comms.py
- [ ] Integrate embedding call into handle_incoming_email after metadata storage
- [ ] Integrate embedding call into handle_outgoing_email after metadata storage
- [ ] Deploy CDK stack and test with real emails