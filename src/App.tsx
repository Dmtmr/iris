import { useAuthenticator } from '@aws-amplify/ui-react';
import { useEffect, useState, useRef } from "react";
import type React from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { useMessages } from "./hooks/useMessages";
import { Message } from "./services/messageService";
import { downloadAttachment } from "./services/attachmentService";
import { Send } from "lucide-react";
import logo2 from "./assets/logo2.png";
import botIcon from "./assets/bot.png";
import dataIcon from "./assets/Data.png";
import workflowsIcon from "./assets/Workflows.png";
import logoDefault from "./assets/logo-default.png";
import logoShort from "./assets/logo-short.png";
import emailIcon from "./assets/email.png";
import slackIcon from "./assets/slack.png";
import phoneIcon from "./assets/phone.png";

const client = generateClient<Schema>();

function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'assistant' | 'tasks'>('assistant');
  const [activeChatTab, setActiveChatTab] = useState<'conversation' | 'clients'>('conversation');
  const { signOut, user } = useAuthenticator();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { messages, loading, error, sendMessage, isConnected } = useMessages();
  const [newMessage, setNewMessage] = useState('');
  const [assistantPanelWidth, setAssistantPanelWidth] = useState<number>(410);
  const contentWrapperRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const [showResizerHint, setShowResizerHint] = useState(false);
  const [resizerHintLeft, setResizerHintLeft] = useState<number>(assistantPanelWidth);
  const RESIZE_PAD_LEFT = 14; // px on assistant side
  const RESIZE_PAD_RIGHT = 33; // px on main chat side (~14px + 5mm)

  const handleResizerMouseDown = () => {
    isDraggingRef.current = true;
    setShowResizerHint(true);
    setResizerHintLeft(assistantPanelWidth);
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleResizerMouseMove as any);
    document.addEventListener('mouseup', handleResizerMouseUp as any);
  };

  const handleContentMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!contentWrapperRef.current) return;
    const rect = contentWrapperRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const sep = assistantPanelWidth;
    const withinLeft = x >= sep - RESIZE_PAD_LEFT && x <= sep;
    const withinRight = x > sep && x <= sep + RESIZE_PAD_RIGHT;
    if (withinLeft || withinRight) {
      handleResizerMouseDown();
      e.preventDefault();
    }
  };

  const handleResizerMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current || !contentWrapperRef.current) return;
    const rect = contentWrapperRef.current.getBoundingClientRect();
    let nextWidth = e.clientX - rect.left;
    const min = 260;
    const max = Math.max(320, rect.width - 320);
    if (nextWidth < min) nextWidth = min;
    if (nextWidth > max) nextWidth = max;
    setAssistantPanelWidth(nextWidth);
    setResizerHintLeft(nextWidth);
  };

  const handleResizerMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setShowResizerHint(false);
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleResizerMouseMove as any);
    document.removeEventListener('mouseup', handleResizerMouseUp as any);
  };
  
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

  function handleTabChange(tab: 'assistant' | 'tasks') {
    setActiveTab(tab);
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !user) return;

    try {
      await sendMessage({
        source_email: user.signInDetails?.loginId || 'user@irispro.co',
        destination_emails: 'iris24ai@gmail.com',
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
          <img src={sidebarCollapsed ? logoShort : logoDefault} alt="Lift" className="brand-logo" />
          <button className="collapse-btn" onClick={toggleSidebar}>
            {sidebarCollapsed ? '»' : '«'}
          </button>
        </div>
            <nav className="sidebar-nav">
              <a href="#" className="nav-item active">
                <img src={botIcon} alt="AI Assistant" className="nav-icon nav-icon-bot" />
                {!sidebarCollapsed && <span>AI Assistant</span>}
              </a>
              <a href="#" className="nav-item nav-item-data">
                <img src={dataIcon} alt="Data hub" className="nav-icon nav-icon-data" />
                {!sidebarCollapsed && <span>Data hub</span>}
              </a>
              <a href="#" className="nav-item">
                <img src={workflowsIcon} alt="AI Workflows" className="nav-icon nav-icon-workflows" />
                {!sidebarCollapsed && <span>AI Workflows</span>}
              </a>
            </nav>
            {/* Sign out moved to user avatar menu */}
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="main-header">
          <h2>AI Assistant</h2>
          <div className="user-menu-container">
            <div className="user-avatar" onClick={() => setShowUserMenu((v) => !v)} title="Account">DM</div>
            {showUserMenu && (
              <div className="user-menu">
                <button className="user-menu-item" onClick={signOut}>Sign Out</button>
              </div>
            )}
          </div>
        </div>

        <div className="content-wrapper" ref={contentWrapperRef} onMouseDown={handleContentMouseDown}>
          {/* Query Section - Now Full Width */}
          <div className="query-section-full" style={{ width: assistantPanelWidth }}>
            <div className="query-tabs">
              <button 
                className={`query-tab ${activeTab === 'assistant' ? 'active' : ''}`}
                onClick={() => handleTabChange('assistant')}
              >
                AI assistant
              </button>
              <button 
                className={`query-tab ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => handleTabChange('tasks')}
              >
                Active tasks
              </button>
              
            </div>

            {activeTab === 'assistant' ? (
              <>
                <div className="query-content">
                  <div className="query-header">Query anything</div>
                  <div className="query-input-wrapper">
                    <div className="query-icon">
                      <span
                        className="bot-mask"
                        style={{ WebkitMaskImage: `url(${botIcon})`, maskImage: `url(${botIcon})` }}
                      />
                    </div>
                    <input type="text" className="query-input" placeholder="Ask away..." />
                  </div>
                </div>
                <div className="message-input-container">
                  <div className="input-with-attachment">
                  <input type="text" className="message-input" placeholder="Send a message" />
                  </div>
                  <button className="send-btn-icon" type="button">
                    <Send className="w-3 h-3" />
                  </button>
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
                <div className="message-input-container">
                  <input type="text" className="message-input" placeholder="Send a message" />
                  <button className="send-btn">➤</button>
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
                        <div className="chat-name">James - Restaurant</div>
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
                <div className="message-input-container">
                  <input type="text" className="message-input" placeholder="Send a message" />
                  <button className="send-btn">➤</button>
                </div>
              </>
            )}
          </div>

          {/* Hint icon shown only while resizing; overlays the separator without changing layout */}
          {showResizerHint && (
            <div
              className="resizer-hint"
              style={{ left: resizerHintLeft }}
              aria-hidden="true"
            />
          )}

          {/* Chat Panel */}
          <div className="chat-panel">
            {/* Chat Tabs (match assistant tabs styling/height/position) */}
            <div className="chat-tabs query-tabs">
              <button 
                className={`query-tab ${activeChatTab === 'conversation' ? 'active' : ''}`}
                onClick={() => setActiveChatTab('conversation')}
              >
                James - Restaurant
              </button>
              <button 
                className={`query-tab ${activeChatTab === 'clients' ? 'active' : ''}`}
                onClick={() => setActiveChatTab('clients')}
              >
                Client chats
              </button>
            </div>

            {activeChatTab === 'conversation' ? (
              <>
            <div className="chat-header">
              <div className="chat-header-left">
                <div className="chat-avatar">🍽️</div>
                <div className="chat-title">James - Restaurant</div>
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
                    [...messages].reverse().map((msg: Message) => {
                      const isOutgoing = msg.email_type === 'outgoing';
                      let destinationEmail = msg.destination_emails;
                      try {
                        const parsed = JSON.parse(msg.destination_emails);
                        destinationEmail = Array.isArray(parsed) ? parsed[0] : parsed;
                      } catch (e) {}

                      return (
                        <div key={msg.id} className={`message ${isOutgoing ? 'sent' : 'received'}`}>
                <div className="message-bubble">
                            {!isOutgoing && (
                              <div className="avatar-stack">
                                <div className="message-avatar">🍽️</div>
                                <div className="avatar-bar" />
                                <span className="email-mini" />
                              </div>
                            )}
                            <div>
                              {msg.subject && (
                                <div style={{ fontWeight: '500', fontSize: '0.9em', marginBottom: '2px' }}>
                                  Subject: {msg.subject}
                </div>
                              )}
                              <div style={{ fontSize: '0.95em', marginBottom: '8px' }}>
                                {msg.body_text || '[Message content in S3]'}
              </div>
                </div>
                            {isOutgoing && (
                              <div className="avatar-stack right">
                              <div className="message-avatar-right">DM</div>
                                <div className="avatar-bar" />
                                <span className="email-mini" />
                              </div>
                            )}
              </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                            <span className="message-time">
                              {new Date(msg.created_at).toLocaleString()}
                            </span>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <span style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap' }}>
                                {msg.attachments.map((att, idx) => (
                                  <a
                                    key={idx}
                                    onClick={(e) => { e.preventDefault(); downloadAttachment(att.s3_key, att.filename); }}
                                    href="#"
                                    title={`Download ${att.filename}`}
                                    style={{
                                      color: '#6b7280',
                                      fontWeight: 400,
                                      fontSize: '12px',
                                      textDecoration: 'none',
                                      cursor: 'pointer',
                                      maxWidth: '220px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      background: '#EEECE1',
                                      border: '1px solid #DDD9C3',
                                      borderRadius: '10px',
                                      padding: '4px 10px'
                                    }}
                                  >
                                    {att.filename}
                                  </a>
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div className="messages-bottom-spacer"></div>
            </div>

            <div className="message-input-container">
              <div className="input-with-attachment">
                    {/* Subject field to the right of the bot icon */}
                    <div className="subject-container">
                      <input type="text" className="subject-input" placeholder="Subject" />
                    </div>
                    <div className="icon-strip-cover" aria-hidden="true"></div>
                    <div className="line-left-icon">
                      <span className="bot-mask bot-icon-line" />
                    </div>
                    <div className="line-right-icon">
                      <img src={phoneIcon} alt="phone" className="line-icon-img phone-icon" />
                      <img src={slackIcon} alt="slack" className="line-icon-img" />
                      <span className="email-chip"><span className="email-mask" /></span>
                    </div>
                    <button className="attachment-btn" type="button">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="attachment-icon">
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                    </button>
                    <input 
                      type="text" 
                      className="message-input" 
                      placeholder="Send a message"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                  </div>
                  <button className="emoji-btn" type="button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                      <line x1="9" x2="9.01" y1="9" y2="9"/>
                      <line x1="15" x2="15.01" y1="9" y2="9"/>
                    </svg>
                  </button>
                  <button 
                    className="send-btn-icon" 
                    type="button"
                    onClick={handleSendMessage}
                  >
                    <Send className="w-3 h-3" />
                  </button>
                  {isConnected && <span className="connection-status">🟢</span>}
                </div>
              </>
            ) : (
              <>
                <div className="chat-header" style={{ background: '#F3FAFB' }}>
                  <div className="chat-header-left">
                    <div className="chat-title">Client chats</div>
                  </div>
                </div>
                <div className="chats-list" style={{ padding: '12px' }}>
                  <div className="chat-item james-highlight">
                    <div className="chat-avatar">🍽️</div>
                    <div className="chat-details">
                      <div className="chat-name">James - Restaurant</div>
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
              </>
            )}
          </div>
        </div>
      </div>
      </div>
  );
}

export default App;
