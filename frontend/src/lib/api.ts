// frontend/src/lib/api.ts
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds timeout
});

// Request interceptor to add common headers
api.interceptors.request.use(
  (config) => {
    // Add any common headers here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      console.error("Authentication error - check your API keys");
    } else if (error.response?.status === 429) {
      console.error("Rate limit exceeded - check your OpenAI quota");
    } else if (error.code === "ECONNABORTED") {
      console.error("Request timeout - the server took too long to respond");
    }
    return Promise.reject(error);
  }
);

// Helper function for streaming responses
export const streamQuery = async (
  query: string,
  dataset: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void
) => {
  try {
    const response = await fetch(`${API_URL}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, dataset }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.content) {
              onChunk(data.content);
            }
          } catch {
            // If not JSON, treat as plain text
            if (line.trim()) {
              onChunk(line.trim());
            }
          }
        }
      }
    }

    onComplete();
  } catch (error) {
    onError(error instanceof Error ? error.message : "Unknown error");
  }
};
