import { useAuthenticator } from '@aws-amplify/ui-react';
import { useState, useRef, useEffect } from "react";
import type React from "react";
// Removed Amplify Data client usage to avoid requiring GraphQL config locally/prod
import { useMessages } from "./hooks/useMessages";
import { messageService as __messageService } from "./services/messageService";
import { Message } from "./services/messageService";
import { downloadAttachment } from "./services/attachmentService";
import { Send } from "lucide-react";
// import logo2 from "./assets/logo2.png";
import botIcon from "./assets/bot.png";
import dataIcon from "./assets/Data.png";
import workflowsIcon from "./assets/Workflows.png";
import logoDefault from "./assets/logo-default.png";
import logoShort from "./assets/logo-short.png";
// import emailIcon from "./assets/email.png";
import slackIcon from "./assets/slack.png";
import phoneIcon from "./assets/phone.png";

 
const TASKS_KEY = 'iris_ai_tasks_v1';

function loadTasksFromStorage(): any[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveTasksToStorage(tasks: any[]) {
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch {}
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'assistant' | 'tasks'>('assistant');
  const [activeChatTab, setActiveChatTab] = useState<'conversation' | 'clients'>('conversation');
  const { signOut, user } = useAuthenticator();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBotMenu, setShowBotMenu] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoOrchestrationEnabled, setAutoOrchestrationEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('iris_auto_orchestration_enabled');
      return stored === 'true';
    } catch {
      return true; // default to enabled
    }
  });
  const { messages, loading, error, sendMessage, isConnected } = useMessages();
  const [aiTasks, setAiTasks] = useState<any[]>(() => (globalThis as any).__aiTasks || loadTasksFromStorage());
  const seenTaskKeysRef = useRef<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTagValue, setEditTagValue] = useState<string>('');
  const [editingAnswerTaskId, setEditingAnswerTaskId] = useState<string | null>(null);
  const [editAnswerValue, setEditAnswerValue] = useState<string>('');
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  // Expose messageService for DevTools-driven testing (fail-soft)
  if (typeof window !== 'undefined') {
    try { (window as any).messageService = __messageService; } catch {}
  }
  // attach task listener on mount and hydrate from storage/global (dedupe by task.id/id/message_id)
  useEffect(() => {
    try {
      if (aiTasks.length === 0) {
        const stored = loadTasksFromStorage();
        const existing = (globalThis as any).__aiTasks || [];
        
        // Merge and deduplicate
        const allTasks = [...stored, ...existing];
        const seen = new Set();
        const unique = allTasks.filter(t => {
          const k = t?.task?.id || t?.id || t?.message_id;
          if (!k || seen.has(k)) return false;
          seen.add(k);
          seenTaskKeysRef.current.add(k);
          return true;
        });
        
        if (unique.length > 0) {
          setAiTasks(unique);
          (globalThis as any).__aiTasks = unique;
        }
      }
    } catch {}

    const handler = (e: any) => {
      const incoming = e?.detail;
      const k = (incoming?.task?.id) || incoming?.id || incoming?.message_id;
      if (!k) return; // skip if no key
      
      // Check if auto-orchestration is enabled (block auto-created tasks if toggle is off)
      // Manual tasks (created via + button) have message_id starting with 'new_'
      // Auto-orchestrated tasks have real email message_ids
      try {
        const autoOrchEnabled = localStorage.getItem('iris_auto_orchestration_enabled');
        if (autoOrchEnabled === 'false') {
          // Check if this is a manual task (created via + button)
          const isManualTask = k.toString().startsWith('task_new_') || 
                               (incoming?.message_id && incoming.message_id.toString().startsWith('new_'));
          
          if (!isManualTask) {
            console.log('[TASK EVENT] Blocking auto-created task', k, '- auto-orchestration is disabled');
            return; // Block auto-created tasks when toggle is off, but allow manual tasks
          }
        }
      } catch {
        // If can't read localStorage, allow through (fail-open)
      }
      
      // Check both ref and current state to prevent duplicates
      if (seenTaskKeysRef.current.has(k)) {
        return; // skip duplicate
      }
      
      setAiTasks((prev) => {
        // Double-check if task already exists in state (prevents race conditions)
        const alreadyExists = prev.some(t => {
          const taskKey = t?.task?.id || t?.id || t?.message_id;
          return taskKey === k;
        });
        
        if (alreadyExists) {
          return prev; // task already in state, skip
        }
        
        // Mark task with auto-send status at creation time
        // NOTE: No automated replies are sent - user must manually click "Reply confirmation" button
        const taskWithStatus = {
          ...incoming,
          autoSent: autoReplyEnabled // This just marks the UI status, doesn't actually send
        };
        
        seenTaskKeysRef.current.add(k);
        const next = [...prev, taskWithStatus];
        try { (globalThis as any).__aiTasks = next; } catch {}
        try { saveTasksToStorage(next); } catch {}
        return next;
      });
    };
    try { window.addEventListener('ai-task', handler as EventListener); } catch {}
    return () => { try { window.removeEventListener('ai-task', handler as EventListener); } catch {} };
  }, [autoReplyEnabled]);

  // Persist auto-orchestration toggle state
  useEffect(() => {
    try {
      localStorage.setItem('iris_auto_orchestration_enabled', String(autoOrchestrationEnabled));
    } catch {}
  }, [autoOrchestrationEnabled]);

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
  
  // Amplify Data Todos removed for local compatibility

  // function createTodo() {}
  // function deleteTodo(id: string) {}

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
        source_email: 'demo@irispro.xyz',
        destination_emails: 'iris24ai@gmail.com',
        content: newMessage,
        email_type: 'chat',
        subject: `Message from demo@irispro.xyz`
      });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }
  
  async function handleReplyConfirmation(answerText: string) {
    // Populate message box and auto-send
    setNewMessage(answerText);
    // Small delay to allow UI to update, then send
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!answerText.trim() || !user) return;
    
    try {
      await sendMessage({
        source_email: 'demo@irispro.xyz',
        destination_emails: 'iris24ai@gmail.com',
        content: answerText,
        email_type: 'chat',
        subject: `Message from demo@irispro.xyz`
      });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send reply:', error);
    }
  }

  const handleFileUpload = async (taskId: string, file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const attachment = {
          filename: file.name,
          dataUrl: base64,
          size: file.size,
          type: file.type
        };
        setAiTasks((prev) => {
          const updated = prev.map(task => {
            const taskKey = task?.task?.id || task?.id || task?.message_id;
            if (taskKey === taskId) {
              const existingAttachments = task.attachments || [];
              return { ...task, attachments: [...existingAttachments, attachment] };
            }
            return task;
          });
          try { (globalThis as any).__aiTasks = updated; } catch {}
          try { saveTasksToStorage(updated); } catch {}
          return updated;
        });
        resolve();
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleAttachmentClick = (taskId: string) => {
    // Try ref first
    const input = fileInputRefs.current.get(taskId);
    if (input) {
      input.click();
      return;
    }
    // Fallback to ID selector
    const inputById = document.getElementById(`file-input-${taskId}`) as HTMLInputElement;
    if (inputById) {
      inputById.click();
    }
  };

  const handleAttachmentFileChange = (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        handleFileUpload(taskId, file).catch(err => {
          console.error('Error uploading file:', err);
          alert(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        });
      });
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleRemoveAttachment = (taskId: string, index: number) => {
    setAiTasks((prev) => {
      const updated = prev.map(task => {
        const taskKey = task?.task?.id || task?.id || task?.message_id;
        if (taskKey === taskId) {
          const attachments = task.attachments || [];
          return { ...task, attachments: attachments.filter((_: any, i: number) => i !== index) };
        }
        return task;
      });
      try { (globalThis as any).__aiTasks = updated; } catch {}
      try { saveTasksToStorage(updated); } catch {}
      return updated;
    });
  };

  const handleDownloadTaskAttachment = (attachment: any) => {
    if (attachment.dataUrl) {
      const link = document.createElement('a');
      link.href = attachment.dataUrl;
      link.download = attachment.filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (attachment.s3_key) {
      downloadAttachment(attachment.s3_key, attachment.filename);
    }
  };
  
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
                <div className="user-menu-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'default' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Auto-create tasks</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoOrchestrationEnabled}
                      onChange={(e) => setAutoOrchestrationEnabled(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: autoOrchestrationEnabled ? '#4285f4' : '#ccc',
                      borderRadius: '24px',
                      transition: 'background-color 0.3s'
                    }}>
                      <span style={{
                        position: 'absolute',
                        height: '18px',
                        width: '18px',
                        left: autoOrchestrationEnabled ? '22px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: 'left 0.3s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                </div>
                <button className="user-menu-item" onClick={signOut}>Sign Out</button>
              </div>
            )}
          </div>
        </div>

        <div className="content-wrapper" ref={contentWrapperRef} onMouseDown={handleContentMouseDown}>
          {/* Query Section - Now Full Width */}
          <div className="query-section-full" style={{ width: assistantPanelWidth }} key={activeTab}>
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
                {console.log('🔵 RENDERING ASSISTANT TAB')}
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
                {console.log('🟢 RENDERING TASKS TAB, aiTasks length:', aiTasks.length)}
                <div className="query-content">
                  <div className="query-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Active Tasks</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newTask = {
                          id: `task_new_${Date.now()}`,
                          client_id: 'demo@irispro.xyz',
                          message_id: `new_${Date.now()}`,
                          created_at: new Date().toISOString(),
                          requires_data: false,
                          answer: '',
                          attachments: [],
                          classification: {
                            service: 'Bookkeeping',
                            workflow: 'Query',
                            work_item: '',
                            human_need: true,
                            human_task: 'Reply confirmation',
                            resolution: ''
                          },
                          task: {
                            id: `task_new_${Date.now()}`,
                            name: 'User Query',
                            category: 'Query',
                            created_at: new Date().toISOString(),
                            status: 'active',
                            answer: ''
                          },
                          autoSent: false
                        };
                        setAiTasks((prev) => {
                          const updated = [...prev, newTask];
                          try { (globalThis as any).__aiTasks = updated; } catch {}
                          try { saveTasksToStorage(updated); } catch {}
                          return updated;
                        });
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '18px',
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6b7280',
                        borderRadius: '4px'
                      }}
                      title="Add new task"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f3f4f6';
                        e.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      +
                    </button>
                      </div>
                  <div className="tasks-list" style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
                    {aiTasks.length === 0 ? (
                      <div style={{ color: '#6b7280', fontSize: '0.95em' }}>No tasks yet.</div>
                    ) : (
                      [...aiTasks].reverse().map((t, index) => {
                        const createdAt = t.created_at ? new Date(t.created_at).toLocaleString() : new Date().toLocaleString();
                        const service = t.classification?.service || 'Bookkeeping';
                        const titleLeft = `James - Restaurant`;
                        const taskId = t.task?.id || t.id || t.message_id || `task-${index}-${Date.now()}`;
                        const expanded = (globalThis as any).__expandedTaskIds?.has?.(taskId) || false;
                        return (
                          <div key={taskId} className="task-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <div className="task-content" style={{ flex: 1 }}>
                                <div className="task-title" style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                  <span style={{ fontWeight: 600, fontSize: '18px' }}>{titleLeft}</span>
                                  <span style={{ fontSize: '12px', fontWeight: 400, color: '#404040' }}>{createdAt}</span>
                    </div>
                                <div className="task-time" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                                  {/* Show friendly tags (exclude service since it is in the title) */}
                                  {service && (
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newValue = prompt('Edit service tag:', service);
                                        if (newValue !== null && newValue.trim()) {
                                          setAiTasks((prev) => {
                                            const updated = prev.map(task => {
                                              const taskKey = task?.task?.id || task?.id || task?.message_id;
                                              if (taskKey === taskId) {
                                                return { ...task, classification: { ...task.classification, service: newValue.trim() } };
                                              }
                                              return task;
                                            });
                                            try { (globalThis as any).__aiTasks = updated; } catch {}
                                            try { saveTasksToStorage(updated); } catch {}
                                            return updated;
                                          });
                                        }
                                      }}
                                      style={{ background: '#EAF3FF', border: '1px solid #D6E4FF', borderRadius: '12px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}
                                      title="Click to edit"
                                    >
                                      {service}
                                    </span>
                                  )}
                                  {t.classification?.workflow && (
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newValue = prompt('Edit workflow tag:', t.classification.workflow);
                                        if (newValue !== null && newValue.trim()) {
                                          setAiTasks((prev) => {
                                            const updated = prev.map(task => {
                                              const taskKey = task?.task?.id || task?.id || task?.message_id;
                                              if (taskKey === taskId) {
                                                return { ...task, classification: { ...task.classification, workflow: newValue.trim() } };
                                              }
                                              return task;
                                            });
                                            try { (globalThis as any).__aiTasks = updated; } catch {}
                                            try { saveTasksToStorage(updated); } catch {}
                                            return updated;
                                          });
                                        }
                                      }}
                                      style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}
                                      title="Click to edit"
                                    >
                                      {t.classification.workflow}
                                    </span>
                                  )}
                                  {t.classification?.work_item && String(t.classification.work_item).trim().toLowerCase() !== 'data retrieval'.toLowerCase() && (
                                    <span style={{ background: '#EEF2FF', border: '1px solid #E0E7FF', borderRadius: '12px', padding: '2px 8px', fontSize: '12px' }}>
                                      {t.classification.work_item}
                                    </span>
                                  )}
                                  {typeof t.classification?.human_need === 'boolean' && (
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const currentText = t.classification.human_need ? 'Human needed' : 'No human needed';
                                        const newValue = prompt('Edit human needed tag:', currentText);
                                        if (newValue !== null) {
                                          const isTrue = ['true', 'yes', 'human needed'].includes(newValue.toLowerCase().trim());
                                          setAiTasks((prev) => {
                                            const updated = prev.map(task => {
                                              const taskKey = task?.task?.id || task?.id || task?.message_id;
                                              if (taskKey === taskId) {
                                                return { ...task, classification: { ...task.classification, human_need: isTrue } };
                                              }
                                              return task;
                                            });
                                            try { (globalThis as any).__aiTasks = updated; } catch {}
                                            try { saveTasksToStorage(updated); } catch {}
                                            return updated;
                                          });
                                        }
                                      }}
                                      style={{ background: '#ECFDF5', border: '1px solid #D1FAE5', borderRadius: '12px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}
                                      title="Click to edit"
                                    >
                                      {t.classification.human_need ? 'Human needed' : 'No human needed'}
                                    </span>
                                  )}
                                  {t.classification?.task_type && 
                                    String(t.classification.task_type).trim().toLowerCase() !== 'summarize_message' &&
                                    String(t.classification.task_type).trim().toLowerCase() !== 'retrieve_data' && (
                                    <span style={{ background: '#FDF2F8', border: '1px solid #FCE7F3', borderRadius: '12px', padding: '2px 8px', fontSize: '12px' }}>
                                      {t.classification.task_type}
                                    </span>
                                  )}
                      </div>
                    </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                {editingTaskId === taskId && t.autoSent === false ? (
                                  <input
                                    type="text"
                                    value={editTagValue}
                                    onChange={(e) => setEditTagValue(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const newValue = editTagValue.trim().toUpperCase();
                                        if (newValue === 'DONE') {
                                          // Update task to DONE (mark as sent, but don't actually send - user must click Reply confirmation)
                                          setAiTasks((prev) => {
                                            const updated = prev.map(task => {
                                              const taskKey = task?.task?.id || task?.id || task?.message_id;
                                              if (taskKey === taskId) {
                                                return { ...task, autoSent: true };
                                              }
                                              return task;
                                            });
                                            try { (globalThis as any).__aiTasks = updated; } catch {}
                                            try { saveTasksToStorage(updated); } catch {}
                                            return updated;
                                          });
                                        }
                                        setEditingTaskId(null);
                                        setEditTagValue('');
                                      } else if (e.key === 'Escape') {
                                        setEditingTaskId(null);
                                        setEditTagValue('');
                                      }
                                    }}
                                    onBlur={() => {
                                      setEditingTaskId(null);
                                      setEditTagValue('');
                                    }}
                                    autoFocus
                                    style={{
                                      background: '#FEE2E2',
                                      color: '#991B1B',
                                      padding: '4px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: 500,
                                      textTransform: 'uppercase',
                                      border: '2px solid #991B1B',
                                      width: '60px',
                                      textAlign: 'center'
                                    }}
                                  />
                                ) : (
                                  <div 
                                    className="task-status" 
                                    onClick={(e) => {
                                      if (t.autoSent === false) {
                                        e.stopPropagation();
                                        setEditingTaskId(taskId);
                                        setEditTagValue('PENDING');
                                      }
                                    }}
                                    style={{
                                      background: t.autoSent === false ? '#FEE2E2' : '#D1FAE5',
                                      color: t.autoSent === false ? '#991B1B' : '#065F46',
                                      padding: '4px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: 500,
                                      textTransform: 'uppercase',
                                      cursor: t.autoSent === false ? 'pointer' : 'default'
                                    }}
                                    title={t.autoSent === false ? 'Click to edit (type DONE to mark complete)' : 'Reply sent automatically'}
                                  >
                                    {t.autoSent === false ? 'PENDING' : 'DONE'}
                      </div>
                                )}
                                {t.classification?.human_task && t.autoSent === false && (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const answerText = t.answer || '';
                                      if (answerText) {
                                        // Update task to DONE when reply is sent
                                        setAiTasks((prev) => {
                                          const updated = prev.map(task => {
                                            const taskKey = task?.task?.id || task?.id || task?.message_id;
                                            if (taskKey === taskId) {
                                              return { ...task, autoSent: true };
                                            }
                                            return task;
                                          });
                                          try { (globalThis as any).__aiTasks = updated; } catch {}
                                          try { saveTasksToStorage(updated); } catch {}
                                          return updated;
                                        });
                                        handleReplyConfirmation(answerText);
                                      }
                                    }}
                                    style={{
                                      background: '#EEECE1',
                                      border: '1px solid #DDD9C3',
                                      borderRadius: '12px',
                                      padding: '2px 8px',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#DDD9C3';
                                      e.currentTarget.style.borderColor = '#C9C5A9';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#EEECE1';
                                      e.currentTarget.style.borderColor = '#DDD9C3';
                                    }}
                                    title="Click to send this answer as a reply"
                                  >
                                    {t.classification.human_task}
                    </div>
                                )}
                    </div>
                      </div>
                            {/* Answer box with expand/collapse and edit - spans full width below */}
                            <div style={{ marginTop: '8px' }}>
                              {/* Hidden file input - unique per task */}
                              <input
                                key={`file-input-${taskId}`}
                                type="file"
                                id={`file-input-${taskId}`}
                                ref={(el) => {
                                  if (el) fileInputRefs.current.set(taskId, el);
                                  else fileInputRefs.current.delete(taskId);
                                }}
                                onChange={(e) => handleAttachmentFileChange(taskId, e)}
                                style={{ display: 'none' }}
                                multiple
                              />
                              {/* Attachments display */}
                              {t.attachments && t.attachments.length > 0 && (
                                <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  {t.attachments.map((att: any, idx: number) => (
                                    <div
                                      key={idx}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        color: '#6b7280',
                                        fontWeight: 400,
                                        fontSize: '12px',
                                        background: '#EEECE1',
                                        border: '1px solid #DDD9C3',
                                        borderRadius: '10px',
                                        padding: '4px 10px'
                                      }}
                                    >
                                      <a
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleDownloadTaskAttachment(att);
                                        }}
                                        href="#"
                                        title={`Download ${att.filename}`}
                                        style={{
                                          color: '#6b7280',
                                          textDecoration: 'none',
                                          cursor: 'pointer',
                                          maxWidth: '220px',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          fontWeight: 'normal'
                                        }}
                                      >
                                        {att.filename}
                                      </a>
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleRemoveAttachment(taskId, idx);
                                        }}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#6b7280',
                                          cursor: 'pointer',
                                          padding: '0',
                                          marginLeft: '4px',
                                          fontSize: '14px',
                                          lineHeight: '1'
                                        }}
                                        title="Remove attachment"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Answer text area */}
                              {editingAnswerTaskId === taskId ? (
                                <div>
                                  <textarea
                                    value={editAnswerValue}
                                    onChange={(e) => setEditAnswerValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        // Save
                                        setAiTasks((prev) => {
                                          const updated = prev.map(task => {
                                            const taskKey = task?.task?.id || task?.id || task?.message_id;
                                            if (taskKey === taskId) {
                                              return { ...task, answer: editAnswerValue.trim() };
                                            }
                                            return task;
                                          });
                                          try { (globalThis as any).__aiTasks = updated; } catch {}
                                          try { saveTasksToStorage(updated); } catch {}
                                          return updated;
                                        });
                                        setEditingAnswerTaskId(null);
                                        setEditAnswerValue('');
                                      } else if (e.key === 'Escape') {
                                        setEditingAnswerTaskId(null);
                                        setEditAnswerValue('');
                                      }
                                    }}
                                    onBlur={() => {
                                      // Save on blur
                                      setAiTasks((prev) => {
                                        const updated = prev.map(task => {
                                          const taskKey = task?.task?.id || task?.id || task?.message_id;
                                          if (taskKey === taskId) {
                                            return { ...task, answer: editAnswerValue.trim() };
                                          }
                                          return task;
                                        });
                                        try { (globalThis as any).__aiTasks = updated; } catch {}
                                        try { saveTasksToStorage(updated); } catch {}
                                        return updated;
                                      });
                                      setEditingAnswerTaskId(null);
                                      setEditAnswerValue('');
                                    }}
                                    autoFocus
                                    style={{
                                      fontSize: '0.90em',
                                      background: '#FFFFFF',
                                      border: '2px solid #4285f4',
                                      borderRadius: '10px',
                                      padding: '10px 12px',
                                      width: '100%',
                                      minHeight: '100px',
                                      fontFamily: 'inherit',
                                      resize: 'vertical'
                                    }}
                                    placeholder="Enter answer text here..."
                                  />
                                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAttachmentClick(taskId);
                                      }}
                                      type="button"
                                      style={{
                                        background: 'transparent',
                                        border: '1px solid #DDD9C3',
                                        borderRadius: '8px',
                                        padding: '6px 10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '12px',
                                        color: '#6b7280'
                                      }}
                                      title="Attach file"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                                      </svg>
                                      Attach
                                    </button>
                                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>Ctrl+Enter to save, Esc to cancel</span>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ position: 'relative' }}>
                                  <div
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setEditingAnswerTaskId(taskId);
                                      setEditAnswerValue(t.answer || '');
                                    }}
                                    onClick={() => {
                                      const store = ((globalThis as any).__expandedTaskIds ||= new Set<string>());
                                      if (store.has(taskId)) store.delete(taskId); else store.add(taskId);
                                      // Force re-render
                                      // eslint-disable-next-line @typescript-eslint/no-floating-promises
                                      Promise.resolve().then(() => (window as any).dispatchEvent(new Event('resize')));
                                    }}
                                    style={{
                                      fontSize: '0.90em',
                                      background: '#F2F2F2',
                                      border: '1px solid #EEECE1',
                                      borderRadius: '10px',
                                      padding: '10px 12px',
                                      paddingRight: '40px',
                                      cursor: 'pointer',
                                      width: '100%'
                                    }}
                                    title="Double-click to edit, click to expand/collapse"
                                  >
                                    {(() => {
                                      const text = t.answer || '[No answer]';
                                      if (!text) return '[No answer]';
                                      if (expanded) return text;
                                      return text.length > 220 ? (text.slice(0, 220) + '…') : text;
                                    })()}
                                    <div style={{ marginTop: '6px', color: '#6b7280', fontSize: '12px' }}>
                                      {expanded ? 'Collapse' : 'Expand'} • Double-click to edit
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAttachmentClick(taskId);
                                    }}
                                    type="button"
                                    style={{
                                      position: 'absolute',
                                      top: '10px',
                                      right: '10px',
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#6b7280',
                                      borderRadius: '4px'
                                    }}
                                    title="Attach file"
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#f3f4f6';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent';
                                    }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                    </div>
                        );
                      })
                    )}
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
                      <span 
                        className="bot-mask bot-icon-line" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBotMenu(!showBotMenu);
                        }}
                        style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                      />
                      {showBotMenu && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'fixed',
                            bottom: 'calc(100% + 10px)',
                            left: '50px',
                            background: 'white',
                            border: '1px solid #DDD',
                            borderRadius: '8px',
                            padding: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            zIndex: 10000,
                            minWidth: '200px',
                            pointerEvents: 'auto'
                          }}
                        >
                          <label 
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', pointerEvents: 'auto' }}
                          >
                            <input
                              type="checkbox"
                              checked={autoReplyEnabled}
                              onChange={(e) => {
                                e.stopPropagation();
                                setAutoReplyEnabled(e.target.checked);
                              }}
                              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                            />
                            <span style={{ pointerEvents: 'auto' }}>Auto-send replies</span>
                          </label>
                        </div>
                      )}
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
