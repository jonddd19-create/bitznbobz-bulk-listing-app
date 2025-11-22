import React, { useMemo, useState } from "react";

const HEADERS = [
  "Product URL (Input)",
  "SEO Title (UK, 80 chars max)",
  "eBay Category",
  "eBay Category Code",
  "Suggested Buy It Now Price (£)",
  "Item Specs",
  "Full HTML Description (BITZ’n’BOBZ Template)"
];

function clamp80(s="") {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length <= 80 ? clean : clean.slice(0, 77).trimEnd() + "...";
}

async function callGenerateAll(urls) {
  const res = await fetch("/.netlify/functions/generateAll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls })
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { file: base64 }
}

export default function App() {
  const [urls, setUrls] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  const addUrl = () => {
    const u = input.trim();
    if (!u) return;
    setUrls(prev => prev.includes(u) ? prev : [...prev, u]);
    setInput("");
  };

  const removeUrl = (idx) => {
    setUrls(prev => prev.filter((_,i)=>i!==idx));
  };

  const clearAll = () => {
    setUrls([]);
    setLog("");
  };

  const generateAll = async () => {
    if (urls.length === 0) return;
    setBusy(true);
    setLog("Generating…");

    try {
      const { file } = await callGenerateAll(urls);
      downloadBase64Excel(file);
      setLog("Done. Excel ready.");
    } catch (err) {
      setLog("Error: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadBase64Excel = (base64) => {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "BITZ_n_BOBZ_bulk_listing_pack.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", padding: 12 }}>
      <div style={{
        maxWidth: 760,
        margin: "0 auto",
        background: "#fff",
        borderRadius: 12,
        overflow: "hidden",
        border: "3px solid #000"
      }}>
        <header style={{ background: "#000", color: "#FFD400", padding: "14px 16px" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            BITZ’n’BOBZ Bulk Listing Generator
          </div>
          <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>
            Paste URLs → Generate All → Download Excel
          </div>
        </header>

        <main style={{ padding: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste product URL (Amazon/eBay/etc.)"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: "2px solid #000",
                fontSize: 14
              }}
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
            />
            <button
              onClick={addUrl}
              style={{
                padding: "10px 14px",
                background: "#FFD400",
                border: "2px solid #000",
                borderRadius: 8,
                fontWeight: 800
              }}
            >
              Add
            </button>
          </div>

          {urls.length === 0 ? (
            <div style={{ marginTop: 14, fontSize: 14, color: "#333" }}>
              Add URLs. Then tap <b>Generate All</b>.
            </div>
          ) : (
            <>
              <ul style={{ listStyle: "none", padding: 0, marginTop: 14 }}>
                {urls.map((u, i) => (
                  <li key={i} style={{
                    padding: "8px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    marginBottom: 8
                  }}>
                    <div style={{ fontSize: 13, wordBreak: "break-all" }}>{u}</div>

                    <div style={{ marginTop: 6 }}>
                      <button
                        onClick={() => removeUrl(i)}
                        style={{
                          background: "#000",
                          color: "#FFD400",
                          border: "none",
                          padding: "6px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
                flexWrap: "wrap"
              }}>
                <button
                  onClick={generateAll}
                  disabled={busy}
                  style={{
                    flex: "1 1 180px",
                    padding: "12px 14px",
                    background: busy ? "#333" : "#000",
                    color: "#FFD400",
                    border: "2px solid #000",
                    borderRadius: 10,
                    fontWeight: 900,
                    fontSize: 15
                  }}
                >
                  {busy ? "Generating…" : "Generate All"}
                </button>

                <button
                  onClick={clearAll}
                  disabled={busy}
                  style={{
                    flex: "0 0 auto",
                    padding: "12px 14px",
                    background: "#fff",
                    color: "#000",
                    border: "2px dashed #000",
                    borderRadius: 10,
                    fontWeight: 800
                  }}
                >
                  Clear
                </button>
              </div>

              {log && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
                  {log}
                </div>
              )}
            </>
          )}
        </main>

        <footer style={{
          background: "#FFD400",
          padding: "10px 14px",
          borderTop: "3px solid #000"
        }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>
            Fully automated pack (AI-generated). Always sanity-check before listing.
          </div>
        </footer>
      </div>
    </div>
  );
                  }
