import json
import boto3
from botocore.config import Config
import os
import ssl
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import pg8000
import socket
import builtins
import traceback
import uuid

_original_import = builtins.__import__

def debug_import(name, globals=None, locals=None, fromlist=(), level=0):
    if name == "psycopg2":
        print("⚠️ psycopg2 is being imported!")
        print("Stack trace for psycopg2 import attempt:")
        traceback.print_stack()
    return _original_import(name, globals, locals, fromlist, level)

builtins.__import__ = debug_import

print("Lambda import started")

# AWS SDK Config
config = Config(
    connect_timeout=10,
    read_timeout=30,
    retries={'max_attempts': 3}
)

# Secrets Manager loader
def load_secrets_into_env():
    try:
        secret_arn = os.environ.get('SECRET_ARN')
        if not secret_arn:
            print('SECRET_ARN not set; skipping secrets load')
            return
        
        region = os.environ.get('AWS_REGION', 'us-east-1')
        sm = boto3.client('secretsmanager', region_name=region)
        resp = sm.get_secret_value(SecretId=secret_arn)
        secret_str = resp.get('SecretString')
        
        if not secret_str:
            print('No SecretString in secret; skipping')
            return
            
        data = json.loads(secret_str)
        for key in ['OPENAI_API_KEY']:
            if key in data and not os.environ.get(key):
                os.environ[key] = data[key]
                print(f'✅ Loaded {key} from Secrets Manager')
    except Exception as e:
        print(f'⚠️ Failed to load secrets: {e}')

# Call once at init time
load_secrets_into_env()

# SES SMTP Configuration
SMTP_HOST = "email-smtp.us-east-1.amazonaws.com"
SMTP_PORT = 587
SMTP_USERNAME = os.environ.get('SMTP_USERNAME')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
FROM_EMAIL = os.environ.get('FROM_EMAIL')

# Database Configuration
DB_HOST = os.environ.get('DB_HOST')
DB_PORT = int(os.environ.get('DB_PORT', 5432))
DB_USER = os.environ.get('DB_USER')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
DB_NAME = os.environ.get('DB_NAME')

# S3 configuration
S3_BUCKET = os.environ.get('S3_BUCKET')

# AWS Region
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

print("Config created")

# ✅ FIX 5: Validate environment variables at cold start
def validate_env_vars():
    """Validate required environment variables at cold start"""
    required = {
        'SMTP_USERNAME': SMTP_USERNAME,
        'SMTP_PASSWORD': SMTP_PASSWORD,
        'FROM_EMAIL': FROM_EMAIL,
        'DB_HOST': DB_HOST,
        'DB_USER': DB_USER,
        'DB_PASSWORD': DB_PASSWORD,
        'DB_NAME': DB_NAME
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        error_msg = f"Missing required environment variables: {', '.join(missing)}"
        print(f"❌ CRITICAL: {error_msg}")
        raise ValueError(error_msg)
    print("✅ All required environment variables validated")

# Validate on module load
try:
    validate_env_vars()
except ValueError as e:
    print(f"Environment validation failed: {e}")
    # Lambda will fail to initialize if env vars missing

def debug_smtp():
    """Check network connectivity and login to SMTP server - ONLY CALL WHEN DEBUGGING"""
    try:
        print(f"Debug: Testing socket connection to {SMTP_HOST}:{SMTP_PORT}")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        result = sock.connect_ex((SMTP_HOST, SMTP_PORT))
        sock.close()
        if result == 0:
            print("✅ SMTP socket connection successful")
        else:
            print(f"❌ SMTP socket connection failed with code: {result}")
    except Exception as e:
        print(f"❌ SMTP socket test exception: {e}")

    try:
        print(f"Debug: Testing SMTP login to {SMTP_HOST}:{SMTP_PORT}")
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
        server.starttls()
        print("Debug: STARTTLS succeeded")
        
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        print("✅ SMTP login successful!")
        
        server.quit()
    except smtplib.SMTPAuthenticationError:
        print("❌ SMTP login failed: Authentication error. Check username/password")
    except Exception as e:
        print(f"❌ SMTP test exception: {e}")

def get_db_connection():
    """Create PostgreSQL database connection using pg8000"""
    try:
        if not all([DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT]):
            print("Missing database environment variables")
            return None

        connection = pg8000.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            ssl_context=ssl.create_default_context()
        )
        return connection
    except Exception as e:
        print(f"Database connection error: {str(e)}")
        traceback.print_exc()
        return None

def store_email_metadata(message_id, sender, recipient, subject, timestamp, s3_key, email_type='incoming', body_text=None):
    """Store email metadata in PostgreSQL RDS"""
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        if not connection:
            print("No database connection available")
            return False

        cursor = connection.cursor()

        # Normalize recipient
        if isinstance(recipient, str):
            try:
                parsed = json.loads(recipient)
                recipient_json = recipient if isinstance(parsed, list) else json.dumps([recipient])
            except json.JSONDecodeError:
                recipient_json = json.dumps([recipient])
        else:
            recipient_json = json.dumps(recipient)

        # Ensure timestamp is timezone-aware
        from datetime import timezone
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        # Truncate long body_text
        if body_text and len(body_text) > 5000:
            body_text = body_text[:5000]

        sql = """
        INSERT INTO email_metadata (
            message_id, timestamp, source_email, destination_emails,
            s3_location, email_type, created_at, subject, body_text
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql, (
            message_id,
            timestamp,
            sender,
            recipient_json,
            s3_key,
            email_type,
            datetime.now(timezone.utc),
            subject,
            body_text
        ))
        connection.commit()

        print(f"✅ Email metadata stored: {message_id}")
        return True

    except Exception as e:
        print(f"CRITICAL: Error storing email metadata: {str(e)}")
        traceback.print_exc()
        return False

    finally:
        try:
            if cursor: cursor.close()
            if connection: connection.close()
        except Exception:
            pass

def store_email_in_s3(s3_client, content, key):
    """Store email content in S3 as JSON for compatibility"""
    try:
        if not S3_BUCKET:
            print("S3_BUCKET environment variable not set")
            return False

        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=json.dumps(content),
            ContentType='application/json'
        )
        print(f"Email stored in S3: {key}")
        return True
    except Exception as e:
        print(f"Error storing email in S3: {str(e)}")
        traceback.print_exc()
        return False

def normalize_timestamp(ts):
    """Convert timestamp string to datetime object if needed"""
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception as e:
            print(f"Warning: Could not parse timestamp '{ts}': {e}. Using current time.")
            return datetime.utcnow()  # ← Return datetime, not string
    elif isinstance(ts, datetime):
        return ts
    else:
        print(f"Warning: Unexpected timestamp type {type(ts)}. Using current time.")
        return datetime.utcnow()

def send_email_smtp(to_email, subject, body_text, body_html=None, from_email=None, s3_client=None):
    """Send email via SMTP"""
    if s3_client is None:
        s3_client = boto3.client('s3', config=config)

    try:
        if not from_email:
            from_email = FROM_EMAIL
            
        if not all([SMTP_USERNAME, SMTP_PASSWORD, from_email]):
            print("Missing SMTP environment variables")
            return False
        
        print(f"Sending email to {to_email} from {from_email}")
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = to_email
        
        # Add text part
        text_part = MIMEText(body_text, 'plain')
        msg.attach(text_part)
        
        # Add HTML part if provided
        if body_html:
            html_part = MIMEText(body_html, 'html')
            msg.attach(html_part)
        
        # Send via SMTP
        print(f"Connecting to SMTP server: {SMTP_HOST}:{SMTP_PORT}")
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            text = msg.as_string()
            server.sendmail(from_email, [to_email], text)
        
        print(f"Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        traceback.print_exc()
        return False

def handle_incoming_email(event, s3_client):
    """Process incoming SES email: fetch from S3, parse body, store in RDS"""
    try:
        print(">>> handle_incoming_email started")

        for record in event.get('Records', []):
            ses_mail = record['ses']['mail']
            ses_receipt = record['ses']['receipt']

            message_id = ses_mail['messageId']
            timestamp = normalize_timestamp(ses_mail.get('timestamp'))
            sender = ses_mail['source']
            recipients = ses_mail['destination']
            subject = ses_mail['commonHeaders'].get('subject', 'No Subject')

            print(f"Processing incoming email: {message_id}")
            print(f"From: {sender}, To: {recipients}, Subject: {subject}")

            # STEP 1: Get S3 location from SES receipt action
            # SES stores: s3://iris-bucket101425/emails/<messageId>
            s3_bucket = "iris-bucket101425"  # Your S3 bucket
            s3_key = f"emails/{message_id}"   # Path where SES stores it

            print(f"SES stored email in S3: s3://{s3_bucket}/{s3_key}")

            # STEP 2: Fetch email content from S3
            body_text = None
            
            try:
                print(f"Fetching full email from S3: {s3_bucket}/{s3_key}")
                s3_response = s3_client.get_object(
                    Bucket=s3_bucket,
                    Key=s3_key
                )
                email_content = s3_response['Body'].read().decode('utf-8')
                print(f"Successfully fetched email content ({len(email_content)} bytes)")
                
                # STEP 3: Parse MIME to extract body
                import email
                from email import policy
                
                msg = email.message_from_string(email_content, policy=policy.default)
                
                # Try to get plain text body
                if msg.is_multipart():
                    for part in msg.walk():
                        content_type = part.get_content_type()
                        if content_type == 'text/plain':
                            try:
                                body_text = part.get_content()
                                break
                            except:
                                # If get_content() fails, try get_payload()
                                body_text = part.get_payload(decode=True)
                                if body_text:
                                    body_text = body_text.decode('utf-8', errors='ignore')
                                break
                else:
                    try:
                        body_text = msg.get_content()
                    except:
                        body_text = msg.get_payload(decode=True)
                        if body_text:
                            body_text = body_text.decode('utf-8', errors='ignore')
                
                if body_text:
                    # Truncate if too long
                    if len(body_text) > 5000:
                        body_text = body_text[:5000]
                    print(f"Extracted body text ({len(body_text)} chars)")
                else:
                    print("Warning: Could not extract plain text body")
                    body_text = "[Email content could not be parsed]"
                    
            except Exception as e:
                print(f"Error fetching/parsing email from S3: {e}")
                traceback.print_exc()
                body_text = "[Error fetching email content]"

            # STEP 4: Store our own copy in our S3 bucket (for backup)
            our_s3_key = f"incoming-emails/{message_id}.json"
            if S3_BUCKET and s3_client:
                try:
                    backup_content = {
                        'message_id': message_id,
                        'timestamp': timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp),
                        'sender': sender,
                        'recipients': recipients,
                        'subject': subject,
                        'body_text': body_text,
                        'original_s3_location': f"s3://{s3_bucket}/{s3_key}"
                    }
                    store_email_in_s3(s3_client, backup_content, our_s3_key)
                    print(f"Stored backup in our S3: {our_s3_key}")
                except Exception as e:
                    print(f"Warning: Could not store backup in S3: {e}")

            # STEP 5: Store metadata in RDS with body_text
            for recipient in recipients:
                store_email_metadata(
                    message_id=message_id,
                    sender=sender,
                    recipient=recipient,
                    subject=subject,
                    timestamp=timestamp,
                    s3_key=our_s3_key if S3_BUCKET else s3_key,
                    email_type='incoming',
                    body_text=body_text  # ← Now has actual body!
                )

            # STEP 6: Auto-reply logic (prevent loops)
            if (not subject.lower().startswith("re:") and 
                "auto-reply" not in subject.lower() and 
                "test" in subject.lower()):
                reply_subject = f"Re: {subject}"
                reply_body = f"Thank you for your email. We received your message about: {subject}"
                print(f"Sending auto-reply to {sender}")
                send_email_smtp(sender, reply_subject, reply_body, s3_client=s3_client)

        print(">>> handle_incoming_email completed")
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Incoming email processed successfully'})
        }

    except Exception as e:
        print(f"Error in handle_incoming_email: {str(e)}")
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def handle_outgoing_email(event, context, s3_client=None):
    """Handle outgoing email requests and save to RDS + S3"""
    try:
        print(">>> handle_outgoing_email started")
        print(f"Event received: {json.dumps(event)}")

        # Handle base64-encoded body from API Gateway
        if 'body' in event:
            body_str = event['body']
            
            # Check if base64 encoded
            if event.get('isBase64Encoded', False):
                import base64
                try:
                    body_str = base64.b64decode(body_str).decode('utf-8')
                    print("Decoded base64 body from API Gateway")
                except Exception as e:
                    print(f"Failed to decode base64 body: {e}")
                    return {
                        'statusCode': 400,
                        'body': json.dumps({'error': 'Failed to decode base64 body'})
                    }
            
            # Try to parse as JSON
            if isinstance(body_str, str):
                try:
                    body = json.loads(body_str)
                    print("Parsed JSON body")
                except json.JSONDecodeError:
                    print("Body is not valid JSON, using raw event")
                    body = event
            else:
                body = event
        else:
            # Direct Lambda invoke (your case)
            body = event
            print("Using direct event format")

        to_email = body.get('to_email', 'test@example.com')
        subject = body.get('subject', 'Test Email')
        body_text = body.get('body_text', 'This is a test email.')
        body_html = body.get('body_html')
        from_email = body.get('from_email', FROM_EMAIL)

        print(f"Sending email to: {to_email}, subject: {subject}")

        # Send email via SMTP
        success = send_email_smtp(to_email, subject, body_text, body_html, from_email, s3_client=s3_client)

        if not success:
            return {
                'statusCode': 500,
                'body': json.dumps({'message': 'Failed to send email'})
            }

        # Generate unique message_id and timestamp
        message_id = f"msg_{uuid.uuid4().hex}"
        timestamp = datetime.utcnow()

        print(f"Generated message_id: {message_id}")

        # Optional: Store email content in S3
        s3_key = None
        try:
            if S3_BUCKET and s3_client:
                s3_key = f"outgoing-emails/{message_id}.json"
                email_content = {
                    'to_email': to_email,
                    'from_email': from_email,
                    'subject': subject,
                    'body_text': body_text,
                    'body_html': body_html,
                    'timestamp': timestamp.isoformat()
                }
                store_email_in_s3(s3_client, email_content, s3_key)
                print(f"Stored in S3: {s3_key}")
        except Exception as s3_err:
            print(f"S3 upload failed (non-critical): {s3_err}")

        # Store metadata in RDS (CRITICAL)
        metadata_saved = store_email_metadata(
            message_id=message_id,
            sender=from_email,
            recipient=to_email,
            subject=subject,
            timestamp=timestamp,
            s3_key=s3_key or '',
            email_type='outgoing',
            body_text=body_text  # ← Add this
        )

        if not metadata_saved:
            print("⚠️ Warning: Metadata not saved to RDS")

        print(">>> handle_outgoing_email completed - email sent and saved")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Email sent successfully',
                'message_id': message_id
            })
        }

    except Exception as e:
        print(f"Error in handle_outgoing_email: {str(e)}")
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def handle_get_messages(event):
    """Fetch messages from RDS"""
    connection = None
    cursor = None
    
    try:
        print(">>> handle_get_messages started")
        print(f"Event received: {json.dumps(event)}")

        connection = get_db_connection()
        if not connection:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Database connection failed'})
            }

        filter_email = event.get('email', 'demo@irispro.xyz')
        print(f"Filtering messages for: {filter_email}")

        cursor = connection.cursor()

        # ✅ FIX 7: Proper JSON query with ::jsonb operator
        sql = """
        SELECT message_id, timestamp, source_email, destination_emails, 
            s3_location, email_type, created_at, subject, body_text
        FROM email_metadata
        WHERE source_email = %s 
        OR destination_emails::text LIKE %s
        ORDER BY created_at DESC
        LIMIT 100
        """
        cursor.execute(sql, (filter_email, f'%{filter_email}%'))
        rows = cursor.fetchall()
        
        print(f"Found {len(rows)} rows from database")

        messages = [
            {
                'id': row[0],
                'message_id': row[0],
                'timestamp': row[1].isoformat() if hasattr(row[1], 'isoformat') else str(row[1]),
                'source_email': row[2],
                'destination_emails': row[3],
                's3_location': row[4],
                'email_type': row[5],
                'created_at': row[6].isoformat() if hasattr(row[6], 'isoformat') else str(row[6]),
                'subject': row[7],      # ← Add
                'body_text': row[8],    # ← Add
            }
            for row in rows
        ]

        print(f">>> handle_get_messages completed - returning {len(messages)} messages")

        return {
            'statusCode': 200,
            'body': json.dumps({'messages': messages})
        }

    except Exception as e:
        print(f"Error in handle_get_messages: {str(e)}")
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

    finally:
        if cursor:
            cursor.close()
            print("Cursor closed")
        if connection:
            connection.close()
            print("Connection closed")

# Embeddings

def test_embedding():
    """Minimal test to verify embedding functionality works"""
    try:
        # Test OpenAI import
        import openai
        print("✅ OpenAI import successful")
        
        # Test embedding generation
        test_text = "Test message for embedding"
        response = openai.embeddings.create(
            model="text-embedding-3-small",
            input=test_text
        )
        embedding = response.data[0].embedding
        print(f"✅ Embedding created: {len(embedding)} dimensions")
        return True
    except Exception as e:
        print(f"❌ Embedding test failed: {e}")
        return False

def handle_test_embedding():
    """Test endpoint for embedding functionality"""
    return {
        'statusCode': 200,
        'body': {
            'message': 'Embedding test completed',
            'success': test_embedding()
        }
    }

def lambda_handler(event, context):
    """Main Lambda handler"""
    print("Lambda handler started")
    print(f"Received event: {json.dumps(event)}")

    # ✅ FIX 2: Only run debug_smtp if explicitly requested
    if event.get('debug_smtp'):
        print("Debug mode enabled - running SMTP diagnostics")
        debug_smtp()

    try:
        # ✅ FIX 1: Use AWS_REGION from environment
        s3_client = boto3.client('s3', region_name=AWS_REGION, config=config)
        print(f"S3 client created for region: {AWS_REGION}")

        # Check for getMessages action FIRST (support both action and operation)
        if event.get('action') == 'getMessages' or event.get('operation') == 'get_messages':
            print("Processing getMessages request")
            return handle_get_messages(event)
        elif event.get('action') == 'testEmbedding':
            print("Processing testEmbedding request")
            return handle_test_embedding()
        
        # Determine incoming vs outgoing email
        if 'Records' in event and len(event['Records']) > 0 and event['Records'][0].get('eventSource') == 'aws:ses':
            print("Processing incoming email from SES")
            return handle_incoming_email(event, s3_client)
        else:
            print("Processing outgoing email")
            return handle_outgoing_email(event, context, s3_client=s3_client)

    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        traceback.print_exc()
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

