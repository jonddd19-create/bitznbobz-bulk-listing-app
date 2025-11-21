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

export default function App() {
  const [urls, setUrls] = useState([]);
  const [input, setInput] = useState("");

  const addUrl = () => {
    const u = input.trim();
    if (!u) return;
    setUrls((prev) => [...prev, u]);
    setInput("");
  };

  const removeUrl = (idx) => {
    setUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => setUrls([]);

  const rows = useMemo(() => {
    return urls.map((u) => [u, "", "", "", "", "", ""]);
  }, [urls]);

  const generateExcel = () => {
    const data = [HEADERS, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [
      { wch: 45 },
      { wch: 45 },
      { wch: 28 },
      { wch: 18 },
      { wch: 16 },
      { wch: 40 },
      { wch: 70 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Listing Pack");

    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    saveAs(blob, "BITZ_n_BOBZ_bulk_listing_template.xlsx");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", padding: 12 }}>
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 12,
          overflow: "hidden",
          border: "3px solid #000"
        }}
      >
        <header style={{ background: "#000", color: "#FFD400", padding: "14px 16px" }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.3 }}>
            BITZ’n’BOBZ Bulk Listing Generator
          </div>
          <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>
            Paste product URLs → download Excel template
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
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
              Add
            </button>
          </div>

          {urls.length === 0 ? (
            <div style={{ marginTop: 14, fontSize: 14, color: "#333" }}>
              Add a few URLs and hit <b>Download Excel</b>.
            </div>
          ) : (
            <>
              <ul style={{ listStyle: "none", padding: 0, marginTop: 14 }}>
                {urls.map((u, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      marginBottom: 8
                    }}
                  >
                    <div style={{ fontSize: 13, wordBreak: "break-all", flex: 1 }}>
                      {u}
                    </div>
                    <button
                      onClick={() => removeUrl(i)}
                      style={{
                        background: "#000",
                        color: "#FFD400",
                        border: "none",
                        padding: "6px 8px",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700
                      }}
                      aria-label="Remove URL"
                      title="Remove"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={generateExcel}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: "#000",
                    color: "#FFD400",
                    border: "2px solid #000",
                    borderRadius: 10,
                    fontWeight: 900,
                    cursor: "pointer",
                    fontSize: 15
                  }}
                >
                  Download Excel Template
                </button>
                <button
                  onClick={clearAll}
                  style={{
                    padding: "12px 14px",
                    background: "#fff",
                    color: "#000",
                    border: "2px dashed #000",
                    borderRadius: 10,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontSize: 14
                  }}
                >
                  Clear
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
                The spreadsheet downloads with your URLs in column A and the rest ready for me to fill in.
              </div>
            </>
          )}
        </main>

        <footer style={{ background: "#FFD400", padding: "10px 14px", borderTop: "3px solid #000" }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>
            Next upgrade: auto‑fill titles, categories, pricing & full HTML from inside the app.
          </div>
        </footer>
      </div>
    </div>
  );
}
