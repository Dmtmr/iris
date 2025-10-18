from backend_logic import process_request

def handler(event, context):
    """
    AWS Lambda handler
    """
    print("Received event:", event)
    result = process_request(event)
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": result
    }
