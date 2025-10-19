import { useAuthenticator } from '@aws-amplify/ui-react';
import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { useMessages } from "./hooks/useMessages";
import { Message } from "./services/messageService";

const client = generateClient<Schema>();

function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'assistant' | 'tasks' | 'chats'>('assistant');
  const { signOut, user } = useAuthenticator();
  const { messages, loading, error, sendMessage, isConnected } = useMessages();
  const [newMessage, setNewMessage] = useState('');
  
  useEffect(() => {
    client.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos([...data.items]),
    });
  }, []);

  function createTodo() {
    client.models.Todo.create({ content: window.prompt("Todo content") });
  }
    
  function deleteTodo(id: string) {
    client.models.Todo.delete({ id });
  }

  function toggleSidebar() {
    setSidebarCollapsed(!sidebarCollapsed);
  }

  function handleTabChange(tab: 'assistant' | 'tasks' | 'chats') {
    setActiveTab(tab);
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !user) return;

    try {
      await sendMessage({
        source_email: user.signInDetails?.loginId || 'user@irispro.co',
        destination_emails: 'client@example.com',
        content: newMessage,
        email_type: 'chat',
        subject: `Message from ${user.signInDetails?.loginId || 'user@irispro.co'}`
      });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }
  
  
  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h1>Iris</h1>
          <button className="collapse-btn" onClick={toggleSidebar}>
            {sidebarCollapsed ? '»' : '«'}
          </button>
        </div>
            <nav className="sidebar-nav">
              <a href="#" className="nav-item active">
                <span>💬</span>
                {!sidebarCollapsed && <span>AI Assistant</span>}
              </a>
              <a href="#" className="nav-item">
                <span>📊</span>
                {!sidebarCollapsed && <span>Data hub</span>}
              </a>
              <a href="#" className="nav-item">
                <span>⚙️</span>
                {!sidebarCollapsed && <span>AI Workflows</span>}
              </a>
            </nav>
            <div style={{ marginTop: 'auto', padding: '1rem' }}>
              <button 
                onClick={signOut}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                {!sidebarCollapsed ? '🚪 Sign Out' : '🚪'}
              </button>
            </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="main-header">
          <h2>AI Assistant</h2>
          <div className="user-avatar">DM</div>
        </div>

        <div className="content-wrapper">
          {/* Query Section - Now Full Width */}
          <div className="query-section-full">
            <div className="query-tabs">
              <button 
                className={`query-tab ${activeTab === 'assistant' ? 'active' : ''}`}
                onClick={() => handleTabChange('assistant')}
              >
                Assistant
              </button>
              <button 
                className={`query-tab ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => handleTabChange('tasks')}
              >
                Active tasks <span style={{background:'#333',color:'white',borderRadius:'50%',padding:'2px 6px',fontSize:'11px',marginLeft:'4px'}}>4</span>
              </button>
              <button 
                className={`query-tab ${activeTab === 'chats' ? 'active' : ''}`}
                onClick={() => handleTabChange('chats')}
              >
                Client conversations
              </button>
            </div>

            {activeTab === 'assistant' ? (
              <>
                <div className="query-content">
                  <div className="query-header">Query anything</div>
                  <div className="query-input-wrapper">
                    <div className="query-icon">🔍</div>
                    <input type="text" className="query-input" placeholder="Ask away..." />
                    <div className="query-avatar">DM</div>
                  </div>
                </div>
                <div className="message-input-container">
                  <input type="text" className="message-input" placeholder="Send a message" />
                  <button className="send-btn">➤</button>
                </div>
              </>
            ) : activeTab === 'tasks' ? (
              <>
                <div className="query-content">
                  <div className="query-header">Active Tasks</div>
                  <div className="tasks-list">
                    <div className="task-item">
                      <div className="task-icon">📋</div>
                      <div className="task-content">
                        <div className="task-title">Review Q4 Reports</div>
                        <div className="task-time">Due: Tomorrow</div>
                      </div>
                      <div className="task-status">In Progress</div>
                    </div>
                    <div className="task-item">
                      <div className="task-icon">📊</div>
                      <div className="task-content">
                        <div className="task-title">Update Client Database</div>
                        <div className="task-time">Due: Friday</div>
                      </div>
                      <div className="task-status">Pending</div>
                    </div>
                    <div className="task-item">
                      <div className="task-icon">💼</div>
                      <div className="task-content">
                        <div className="task-title">Prepare Meeting Notes</div>
                        <div className="task-time">Due: Today</div>
                      </div>
                      <div className="task-status">Urgent</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="query-content">
                  <div className="query-header">Client conversations</div>
                  <div className="chats-list">
                    <div className="chat-item">
                      <div className="chat-avatar">🍽️</div>
                      <div className="chat-details">
                        <div className="chat-name">James - Restaurant Ltd</div>
                        <div className="chat-preview">I sent the receipt</div>
                      </div>
                      <div className="chat-time">9:52pm</div>
                    </div>
                    <div className="chat-item">
                      <div className="chat-avatar" style={{background: '#4285f4'}}>👤</div>
                      <div className="chat-details">
                        <div className="chat-name">Marian</div>
                        <div className="chat-preview">Can I get QBS for the NewCo?</div>
                      </div>
                      <div className="chat-time">12:31pm</div>
                    </div>
                    <div className="chat-item">
                      <div className="chat-avatar" style={{background: '#34a853'}}>🚗</div>
                      <div className="chat-details">
                        <div className="chat-name">Jesse</div>
                        <div className="chat-preview">K1 sent!</div>
                      </div>
                      <div className="chat-time">9:12am</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Chat Panel */}
          <div className="chat-panel">
            <div className="chat-header">
              <div className="chat-header-left">
                <div className="chat-avatar">🍽️</div>
                <div className="chat-title">James - Restaurant Ltd</div>
              </div>
              <div className="chat-actions">
                <button className="chat-action-btn">⋮</button>
              </div>
            </div>

            <div className="messages-container">
              {loading ? (
                <div className="message">Loading messages...</div>
              ) : error ? (
                <div className="message error">Error: {error}</div>
              ) : messages.length === 0 ? (
                <div className="message">No messages yet. Start a conversation!</div>
              ) : (
                messages.map((msg: Message) => (
                  <div key={msg.id} className={`message ${msg.email_type === 'sent' ? 'sent' : 'received'}`}>
                    <div className="message-bubble">
                      {msg.email_type !== 'sent' && <span className="message-icon">📧</span>}
                      <span>{msg.source_email}: {msg.destination_emails}</span>
                    </div>
                    <div className="message-time">
                      {new Date(msg.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="message-input-container">
              <div className="input-with-attachment">
                <span className="attachment-icon-inline">📎</span>
                <input 
                  type="text" 
                  className="message-input" 
                  placeholder="Send a message"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
              </div>
              <button className="send-btn">😊</button>
              <button 
                className="send-btn" 
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
              >
                ➤
              </button>
              {isConnected && <span className="connection-status">🟢</span>}
            </div>
          </div>
        </div>
      </div>
      </div>
  );
}

export default App;
