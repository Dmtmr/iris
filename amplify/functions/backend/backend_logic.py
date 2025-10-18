import json

def process_request(event):
    """
    Example backend logic.
    You can expand this later to handle SES, RAG, QuickBooks, etc.
    """
    return json.dumps({
        "message": "Hello from backend_logic!",
        "input": event
    })
