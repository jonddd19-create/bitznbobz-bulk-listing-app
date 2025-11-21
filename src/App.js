import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

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
  return res.json();
}

export default function App() {
  const [urls, setUrls] = useState([]);
  const [input, setInput] = useState("");
  const [rowsByUrl, setRowsByUrl] = useState({});
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  const addUrl = () => {
    const u = input.trim();
    if (!u) return;
    setUrls(prev => prev.includes(u) ? prev : [...prev, u]);
    setInput("");
  };

  const removeUrl = (idx) => {
    const u = urls[idx];
    setUrls(prev => prev.filter((_,i)=>i!==idx));
    setRowsByUrl(prev => {
      const n = {...prev}; delete n[u]; return n;
    });
  };

  const clearAll = () => { setUrls([]); setRowsByUrl({}); setLog(""); };

  const generateAll = async () => {
    if (urls.length === 0) return;
    setBusy(true);
    setLog("Generating titles / categories / prices / HTML…");
    try {
      const { rows } = await callGenerateAll(urls);
      const next = {};
      rows.forEach(r => {
        next[r.url] = { ...r, title: clamp80(r.title || "") };
      });
      setRowsByUrl(next);
      setLog("Done.");
    } catch (e) {
      setLog("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const rowsForSheet = useMemo(() => {
    return urls.map(u => {
      const r = rowsByUrl[u] || {};
      return [u, r.title||"", r.category||"", r.categoryId||"", r.price||"", r.specs||"", r.html||""];
    });
  }, [urls, rowsByUrl]);

  const downloadExcel = () => {
    const data = [HEADERS, ...rowsForSheet];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [
      { wch: 45 }, { wch: 45 }, { wch: 30 },
      { wch: 18 }, { wch: 18 }, { wch: 40 }, { wch: 80 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Listing Pack");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "BITZ_n_BOBZ_bulk_listing_pack.xlsx");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", padding: 12 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", background: "#fff", borderRadius: 12, overflow: "hidden", border: "3px solid #000" }}>
        <header style={{ background: "#000", color: "#FFD400", padding: "14px 16px" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>BITZ’n’BOBZ Bulk Listing Generator</div>
          <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>Paste URLs → Generate All → Download Excel</div>
        </header>

        <main style={{ padding: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste product URL (Amazon/eBay/etc.)"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "2px solid #000", fontSize: 14 }}
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
            />
            <button onClick={addUrl} style={{ padding: "10px 14px", background: "#FFD400", border: "2px solid #000", borderRadius: 8, fontWeight: 800 }}>
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
                {urls.map((u, i) => {
                  const r = rowsByUrl[u];
                  return (
                    <li key={i} style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 13, wordBreak: "break-all" }}>{u}</div>
                      {r && (
                        <div style={{ marginTop: 6, fontSize: 13 }}>
                          <b>Title:</b> {r.title}<br/>
                          <b>Category:</b> {r.category} {r.categoryId ? `(${r.categoryId})` : ""}<br/>
                          <b>Price:</b> {r.price ? `£${r.price}` : "" }
                        </div>
                      )}
                      <div style={{ marginTop: 6 }}>
                        <button onClick={() => removeUrl(i)} style={{ background: "#000", color: "#FFD400", border: "none", padding: "6px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  onClick={generateAll}
                  disabled={busy}
                  style={{ flex: "1 1 180px", padding: "12px 14px", background: busy ? "#333" : "#000", color: "#FFD400",
                    border: "2px solid #000", borderRadius: 10, fontWeight: 900, fontSize: 15 }}
                >
                  {busy ? "Generating…" : "Generate All"}
                </button>
                <button
                  onClick={downloadExcel}
                  disabled={busy}
                  style={{ flex: "1 1 180px", padding: "12px 14px", background: "#FFD400", color: "#000",
                    border: "2px solid #000", borderRadius: 10, fontWeight: 900, fontSize: 15 }}
                >
                  Download Excel
                </button>
                <button onClick={clearAll} disabled={busy} style={{ flex: "0 0 auto", padding: "12px 14px", background: "#fff",
                  color: "#000", border: "2px dashed #000", borderRadius: 10, fontWeight: 800 }}>
                  Clear
                </button>
              </div>

              {log && <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>{log}</div>}
            </>
          )}
        </main>

        <footer style={{ background: "#FFD400", padding: "10px 14px", borderTop: "3px solid #000" }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>
            Fully automated pack (AI‑generated). Always sanity‑check before listing.
          </div>
        </footer>
      </div>
    </div>
  );
}
