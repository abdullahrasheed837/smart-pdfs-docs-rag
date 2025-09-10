import { useState, useRef, useEffect } from "react";
import { api, streamQuery } from "./lib/api";
import "./App.css";
import { APP_NAME } from "./constants";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Dataset {
  name: string;
  count: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

const LS_KEY = "docqa_chats_v1";

function App() {
  const [chats, setChats] = useState<ChatSession[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ChatSession[];
      // Revive message timestamps as Date instances on render time
      return parsed.map(c => ({
        ...c,
        messages: c.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
      }));
    } catch {
      return [];
    }
  });
  const [selectedChatId, setSelectedChatId] = useState<string>(() => chats[0]?.id || "");
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [selectedDataset, setSelectedDataset] = useState<string>("demo");
  const [datasets] = useState<Dataset[]>([{ name: "demo", count: 0 }]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ensure there is at least one chat
  useEffect(() => {
    if (chats.length === 0) {
      const first: ChatSession = {
        id: crypto.randomUUID(),
        title: "New chat",
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setChats([first]);
      setSelectedChatId(first.id);
    } else if (!selectedChatId) {
      setSelectedChatId(chats[0].id);
    }
  }, []);

  // Persist chats to localStorage whenever they change
  useEffect(() => {
    const serializable = chats.map(c => ({
      ...c,
      messages: c.messages.map(m => ({ ...m })),
    }));
    localStorage.setItem(LS_KEY, JSON.stringify(serializable));
  }, [chats]);

  const currentChat = chats.find(c => c.id === selectedChatId) || chats[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentChat?.messages]);

  // Set document title from constant
  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  const createNewChat = () => {
    if (chats.length >= 5) return;
    const newChat: ChatSession = {
      id: crypto.randomUUID(),
      title: "New chat",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setChats(prev => [newChat, ...prev]);
    setSelectedChatId(newChat.id);
    setUploadStatus("");
  };

  const deleteChat = (chatId: string) => {
    setChats(prev => {
      const filtered = prev.filter(c => c.id !== chatId);
      // Update selected chat if needed
      if (chatId === selectedChatId) {
        setSelectedChatId(filtered[0]?.id || "");
      }
      return filtered;
    });
  };

  const renameChatIfNeeded = (fallbackTitle?: string) => {
    if (!currentChat) return;
    if (currentChat.title && currentChat.title !== "New chat") return;
    const firstUser = currentChat.messages.find(m => m.role === "user");
    const newTitle = fallbackTitle || firstUser?.content?.slice(0, 30) || "New chat";
    setChats(prev => prev.map(c => c.id === currentChat.id ? { ...c, title: newTitle } : c));
  };

  const updateCurrentChatMessages = (updater: (prev: Message[]) => Message[]) => {
    if (!currentChat) return;
    setChats(prev => prev.map(c => c.id === currentChat.id ? {
      ...c,
      messages: updater(c.messages),
      updatedAt: new Date().toISOString(),
    } : c));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setUploadStatus("No file selected");
      return;
    }

    setUploadStatus(`Selected: ${file.name}`);
    setIsUploading(true);
    setUploadStatus("Uploading...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("dataset", selectedDataset);

    try {
      const response = await api.post("/ingest/file", formData);


      setUploadStatus(`File uploaded successfully! File ID: ${response.data.file_id}`);

      if (currentChat && currentChat.messages.length === 0) {
        updateCurrentChatMessages(() => ([
          {
            id: "welcome",
            role: "assistant",
            content: `✅ Successfully uploaded "${file.name}" to the "${selectedDataset}" dataset. I'm ready to answer questions about this document!`,
            timestamp: new Date(),
          },
        ]));
        renameChatIfNeeded(file.name);
      }
    } catch (error: unknown) {
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const axiosError = error as { response?: { data?: { detail?: string }, status?: number }, message?: string };
        if (axiosError.response?.data?.detail) {
          errorMessage = axiosError.response.data.detail;
        } else if (axiosError.response?.status) {
          errorMessage = `HTTP ${axiosError.response.status}: ${axiosError.message}`;
        } else {
          errorMessage = axiosError.message || "Network error";
        }
      }
      setUploadStatus(`Upload failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !currentChat) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    const assistantMessageId = `${Date.now()}-assistant`;

    // Optimistically add user message and assistant placeholder
    updateCurrentChatMessages(prev => ([
      ...prev,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      }
    ]));

    const currentQuery = inputMessage;
    const chatId = currentChat.id; // Capture chat ID to prevent closure issues
    setInputMessage("");
    setIsLoading(true);
    renameChatIfNeeded();

    try {
      await streamQuery(
        currentQuery,
        selectedDataset,
        (chunk: string) => {
          setChats(prev => prev.map(c => {
            if (c.id !== chatId) return c;
            const newMessages = [...c.messages];
            const assistantMessage = newMessages.find(m => m.id === assistantMessageId);
            if (assistantMessage) {
              assistantMessage.content += chunk;
            }
            return { ...c, messages: newMessages, updatedAt: new Date().toISOString() };
          }));
        },
        () => {
          setIsLoading(false);
        },
        (error: string) => {
          setChats(prev => prev.map(c => {
            if (c.id !== chatId) return c;
            const newMessages = [...c.messages];
            const assistantMessage = newMessages.find(m => m.id === assistantMessageId);
            if (assistantMessage) {
              assistantMessage.content = `Error: ${error}`;
            }
            return { ...c, messages: newMessages, updatedAt: new Date().toISOString() };
          }));
        },
        chatId  // Use captured chatId
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        const newMessages = [...c.messages];
        const assistantMessage = newMessages.find(m => m.id === assistantMessageId);
        if (assistantMessage) {
          assistantMessage.content = `Error: ${errorMessage}`;
        }
        return { ...c, messages: newMessages, updatedAt: new Date().toISOString() };
      }));
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>{APP_NAME}</h2>
          <p>Upload documents and ask questions about them</p>
        </div>

        <div className="upload-section">
          <h3>📄 Upload Document</h3>
          <div className="dataset-selector">
            <label htmlFor="dataset">Dataset:</label>
            <select
              id="dataset"
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
            >
              {datasets.map(dataset => (
                <option key={dataset.name} value={dataset.name}>
                  {dataset.name} ({dataset.count} docs)
                </option>
              ))}
            </select>
          </div>

          <div className="file-upload">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileUpload}
              style={{ 
                position: "absolute",
                opacity: 0,
                width: "1px",
                height: "1px",
                overflow: "hidden"
              }}
            />
            <button
              className="upload-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              disabled={isUploading}
            >
              {isUploading ? "⏳ Uploading..." : "📁 Choose File"}
            </button>
            <p className="file-types">📋 Supported: PDF, DOCX, TXT, MD</p>
          </div>

          {uploadStatus && (
            <div className={`upload-status ${uploadStatus.includes("failed") ? "error" : "success"}`}>
              {uploadStatus}
            </div>
          )}
        </div>

        <div className="chat-controls">
          <button
            className="new-chat-btn"
            onClick={createNewChat}
            disabled={chats.length >= 5}
            title={chats.length >= 5 ? "You can keep up to 5 chats" : "New chat"}
          >
            + New chat
          </button>
          <div className="chat-cap">{chats.length}/5</div>
        </div>

        <div className="chat-list">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${chat.id === currentChat?.id ? 'active' : ''}`}
              onClick={() => setSelectedChatId(chat.id)}
            >
              <div className="chat-item-title" title={chat.title}>{chat.title || 'New chat'}</div>
              <button
                className="chat-delete-btn"
                onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                aria-label="Delete chat"
                title="Delete chat"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <p>🚀 Powered by OpenAI & Pinecone</p>
        </div>
      </div>

      <div className="main-content">
        <div className="chat-container">
          <div className="messages">
            {(currentChat?.messages?.length || 0) === 0 ? (
              <div className="empty-state">
                <h3>Welcome to {APP_NAME}</h3>
                <p>Upload a document to start asking questions about it!</p>
              </div>
            ) : (
              <>
                {currentChat!.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.role === "user" ? "user" : "assistant"}`}
                  >
                    <div className="message-content">
                      {message.content || (message.role === "assistant" && isLoading ? (
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      ) : "")}
                    </div>
                    <div className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-container">
            <textarea
              value={inputMessage}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your uploaded document..."
              disabled={isLoading}
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="send-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22,2 15,22 11,13 2,9"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
