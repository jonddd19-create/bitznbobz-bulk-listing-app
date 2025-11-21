import React, { useState } from 'react';

export default function App() {
  const [urls, setUrls] = useState([]);
  const [input, setInput] = useState("");

  const addUrl = () => {
    if (!input.trim()) return;
    setUrls([...urls, input.trim()]);
    setInput("");
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial' }}>
      <h2>BITZ’n’BOBZ Bulk Listing Generator</h2>

      <input 
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste product URL"
        style={{ width:'80%', padding:10 }}
      />
      <button onClick={addUrl} style={{ padding:10, marginLeft:10 }}>Add</button>

      <ul>
        {urls.map((u,i)=>(
          <li key={i}>{u}</li>
        ))}
      </ul>

      <button style={{ padding:15, background:'black', color:'yellow', marginTop:20 }}>
        Generate Excel Template
      </button>
    </div>
  );
}
