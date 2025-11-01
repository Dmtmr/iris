# How to Delete All Historical Tasks and Messages

## Option 1: Using Browser Console (Quick Method)

Open your browser's Developer Console (F12) and run these commands:

### Clear All Tasks (localStorage)
```javascript
localStorage.removeItem('iris_ai_tasks_v1');
localStorage.removeItem('iris_auto_orchestration_enabled');
// Also clear the global variable
if (window.__aiTasks) window.__aiTasks = [];
// Refresh the page to see changes
location.reload();
```

### Clear Message Tracking (localStorage - this won't delete DB messages)
```javascript
localStorage.removeItem('iris_processed_msgids');
localStorage.removeItem('iris_last_processed_ts');
localStorage.removeItem('messages_email_override');
// Refresh the page
location.reload();
```

### Clear Everything (All localStorage data)
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

## Option 2: Delete Messages from Database (Backend)

**Important:** Messages are stored in the database (RDS PostgreSQL), not just localStorage. To permanently delete them, you'll need to:

1. **Direct Database Access:**
   - Connect to your PostgreSQL database
   - Run: `DELETE FROM email_metadata WHERE email_type = 'chat';`
   - Or: `DELETE FROM email_metadata WHERE destination_emails LIKE '%iris24ai@gmail.com%';`

2. **Via Backend API:**
   - You could add a delete endpoint in `lambda_comms.py` or `handler.ts`
   - Then call it from the frontend or directly

## Option 3: Add a Clear Button in UI (Recommended)

I can add a "Clear All Data" button in the settings or somewhere accessible. Would you like me to create this?

## Storage Keys Reference

- **Tasks:** `iris_ai_tasks_v1`
- **Message tracking:** `iris_processed_msgids`, `iris_last_processed_ts`
- **Settings:** `iris_auto_orchestration_enabled`
- **Message override:** `messages_email_override`

