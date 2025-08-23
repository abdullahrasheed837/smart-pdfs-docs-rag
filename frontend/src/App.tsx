import { useState } from "react";
import { api } from "./lib/api";

function App() {
  const [status, setStatus] = useState<string>("unknown");

  const checkHealth = async () => {
    try {
      const res = await api.get("/health");
      setStatus(JSON.stringify(res.data));
    } catch (e: any) {
      setStatus(e.message);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1>Smart PDF/DOC QA</h1>
      <p>Frontend ↔ Backend connectivity test</p>
      <button onClick={checkHealth}>Check API Health</button>
      <pre>{status}</pre>
    </div>
  );
}

export default App;
