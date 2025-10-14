import { useAuthenticator } from '@aws-amplify/ui-react';
import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
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
  

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1 className="brand">Iris</h1>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item">
            <span className="nav-icon">🏠</span>
            <span>Home</span>
          </div>
          <div className="nav-item active">
            <span className="nav-icon">🤖</span>
            <span>AI Assistant</span>
          </div>
          <div className="nav-item">
            <span className="nav-icon">📄</span>
            <span>Data hub</span>
          </div>
          <div className="nav-item">
            <span className="nav-icon">⚙️</span>
            <span>AI Workflows</span>
          </div>
        </nav>
      </div>

      {/* Center Panel */}
      <div className="center-panel">
        <div className="client-conversations">
          <div className="section-header">
            <div className="tabs">
              <div className="tab active">Client</div>
              <div className="tab">Team</div>
            </div>
            <h2>Client conversations</h2>
          </div>
          <div className="conversation-list">
            <div className="conversation-item active">
              <div className="avatar">👥</div>
              <div className="conversation-info">
                <div className="name">James - Restaurant Ltd</div>
                <div className="last-message">I sent the receipt.</div>
                <div className="timestamp">Today, 9:52pm</div>
              </div>
              <div className="message-icons">
                <span className="icon">💬</span>
                <span className="icon badge">📧4</span>
              </div>
            </div>
          </div>
        </div>

        <div className="assistant-section">
          <div className="section-header">
            <div className="tabs">
              <div className="tab active">Assistant</div>
              <div className="tab badge">Active tasks 1</div>
            </div>
            <h2>Query anything</h2>
          </div>
          <div className="assistant-input">
            <input type="text" placeholder="Ask away..." />
            <div className="user-avatar">DM</div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="right-panel">
        <div className="chat-header">
          <div className="contact-info">
            <div className="avatar">👥</div>
            <span>James - Restaurant Ltd</span>
          </div>
          <div className="chat-actions">
            <span className="icon">📞</span>
            <span className="icon">📹</span>
            <span className="icon">⋯</span>
          </div>
          <div className="user-avatar">DM</div>
        </div>
        
        <div className="chat-messages">
          <div className="message incoming">
            <div className="message-content">Hey There!</div>
            <div className="message-meta">
              <span className="icon">💬</span>
              <span className="time">Yesterday, 8:30pm</span>
            </div>
          </div>
          <div className="message outgoing">
            <div className="message-content">Hello! what do you need James?</div>
            <div className="message-meta">
              <span className="icon">💬</span>
              <span className="time">Yesterday, 8:34pm</span>
            </div>
          </div>
        </div>

        <div className="chat-input">
          <input type="text" placeholder="Sent a message" />
          <div className="input-actions">
            <span className="icon">📎</span>
            <span className="icon">😊</span>
            <span className="icon">✈️</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
