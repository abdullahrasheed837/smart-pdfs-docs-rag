import { useState, useRef, useEffect } from "react";
import { api, streamQuery } from "./lib/api";
import "./App.css";

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

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [selectedDataset, setSelectedDataset] = useState<string>("demo");
  const [datasets] = useState<Dataset[]>([{ name: "demo", count: 0 }]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("Uploading...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("dataset", selectedDataset);

    try {
      const response = await api.post("/ingest/file", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setUploadStatus(`File uploaded successfully! File ID: ${response.data.file_id}`);
      
             // Add welcome message if this is the first upload
       if (messages.length === 0) {
         setMessages([
           {
             id: "welcome",
             role: "assistant",
             content: `✅ Successfully uploaded "${file.name}" to the "${selectedDataset}" dataset. I'm ready to answer questions about this document!`,
             timestamp: new Date(),
           },
         ]);
       }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setUploadStatus(`Upload failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentQuery = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    // Add assistant message placeholder
    const assistantMessageId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }]);

    try {
      await streamQuery(
        currentQuery,
        selectedDataset,
        (chunk: string) => {
          // Update the assistant message with streaming content
          setMessages(prev => {
            const newMessages = [...prev];
            const assistantMessage = newMessages.find(msg => msg.id === assistantMessageId);
            if (assistantMessage) {
              assistantMessage.content += chunk;
            }
            return newMessages;
          });
        },
        () => {
          // Streaming completed
          setIsLoading(false);
        },
        (error: string) => {
          // Handle error
          setMessages(prev => {
            const newMessages = [...prev];
            const assistantMessage = newMessages.find(msg => msg.id === assistantMessageId);
            if (assistantMessage) {
              assistantMessage.content = `Error: ${error}`;
            }
            return newMessages;
          });
          setIsLoading(false);
        }
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setMessages(prev => {
        const newMessages = [...prev];
        const assistantMessage = newMessages.find(msg => msg.id === assistantMessageId);
        if (assistantMessage) {
          assistantMessage.content = `Error: ${errorMessage}`;
        }
        return newMessages;
      });
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
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  return (
    <div className="app">
      <div className="sidebar">
                 <div className="sidebar-header">
           <h2>DocuVerse AI</h2>
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
              style={{ display: "none" }}
            />
                         <button
               className="upload-btn"
               onClick={() => fileInputRef.current?.click()}
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

                 <div className="sidebar-footer">
           <p>🚀 Powered by OpenAI & Pinecone</p>
         </div>
      </div>

      <div className="main-content">
        <div className="chat-container">
          <div className="messages">
                         {messages.length === 0 ? (
               <div className="empty-state">
                 <h3>Welcome to DocuVerse AI</h3>
                 <p>Upload a document to start asking questions about it!</p>
               </div>
             ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.role === "user" ? "user" : "assistant"}`}
                >
                  <div className="message-content">
                    {message.content}
                  </div>
                  <div className="message-time">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="message assistant">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
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
