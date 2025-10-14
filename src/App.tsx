import { useAuthenticator } from '@aws-amplify/ui-react';
import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { signOut } = useAuthenticator();
  
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
          <a href="#" className="nav-item">
            <span>🏠</span>
            {!sidebarCollapsed && <span>Home</span>}
          </a>
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
              <button className="query-tab active">Assistant</button>
              <button className="query-tab">Active tasks <span style={{background:'#333',color:'white',borderRadius:'50%',padding:'2px 6px',fontSize:'11px',marginLeft:'4px'}}>4</span></button>
            </div>

            <div className="query-header">Query anything</div>

            <div className="query-input-wrapper">
              <div className="query-icon">🔍</div>
              <input type="text" className="query-input" placeholder="Ask away..." />
              <div className="query-avatar">DM</div>
            </div>

            <div className="message-input-container">
              <input type="text" className="message-input" placeholder="Send a message" />
              <button className="send-btn">➤</button>
            </div>
          </div>

          {/* Chat Panel */}
          <div className="chat-panel">
            <div className="chat-header">
              <div className="chat-header-left">
                <div className="chat-avatar">🍽️</div>
                <div className="chat-title">James - Restaurant Ltd</div>
              </div>
              <div className="chat-actions">
                <button className="chat-action-btn">📞</button>
                <button className="chat-action-btn">🎥</button>
                <button className="chat-action-btn">⋮</button>
              </div>
            </div>

            <div className="messages-container">
              <div className="message received">
                <div className="message-bubble">
                  <span className="message-icon">📱</span>
                  <span>Hey There!</span>
                </div>
                <div className="message-time">Yesterday, 8:30pm</div>
              </div>

              <div className="message sent">
                <div className="message-bubble">
                  Hello! what do you need James?
                </div>
                <div className="message-time">Yesterday, 8:34pm</div>
              </div>

              <div className="message received">
                <div className="message-bubble">
                  <span className="message-icon">📧</span>
                  <span>You got the report?</span>
                </div>
                <div className="message-time">Today, 8:30pm</div>
              </div>

              <div className="message sent">
                <div className="message-bubble">
                  Here is your report !
                  <span className="attachment-icon">📎</span>
                  <span className="message-icon">📧</span>
                </div>
                <div className="message-time">Today, 8:34pm</div>
              </div>

              <div className="message received">
                <div className="message-bubble">
                  <span className="message-icon">📧</span>
                  <span>Cheers!</span>
                </div>
                <div className="message-time">Today, 10:30pm</div>
              </div>
            </div>

            <div className="message-input-container">
              <button className="send-btn" style={{color: '#666'}}>📎</button>
              <input type="text" className="message-input" placeholder="Send a message" />
              <button className="send-btn">😊</button>
              <button className="send-btn">➤</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
