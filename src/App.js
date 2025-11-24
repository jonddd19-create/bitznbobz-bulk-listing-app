import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { enrichUrls } from "./api";

function downloadBase64(name, base64) {
  const blob = new Blob(
    [Uint8Array.from(atob(base64), c => c.charCodeAt(0))],
    { type: "application/octet-stream" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [rawUrls, setRawUrls] = useState("");
  const [parsedUrls, setParsedUrls] = useState([]);
  const [includeZip, setIncludeZip] = useState(true);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const urlCount = useMemo(() => parsedUrls.length, [parsedUrls]);

  function parseTextarea() {
    const urls = rawUrls
      .split(/[\n,]+/)
      .map(u => u.trim())
      .filter(Boolean);
    setParsedUrls(urls);
  }

  async function handleEnrich() {
    try {
      setError("");
      setLogs([]);
      setLoading(true);

      const data = await enrichUrls({
        urls: parsedUrls,
        includeZip
      });

      setLogs(data.logs || []);

      if (data.excelBase64) {
        downloadBase64("bitznbobz-ebay-uk-pack.xlsx", data.excelBase64);
      }
      if (includeZip && data.zipBase64) {
        downloadBase64("bitznbobz-images.zip", data.zipBase64);
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function onXlsxUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const found = [];
        json.forEach(row => {
          row.forEach(cell => {
            const v = String(cell || "").trim();
            if (/^https?:\/\//i.test(v)) found.push(v);
          });
        });

        setParsedUrls(found);
        setRawUrls(found.join("\n"));
      } catch (err) {
        setError("Could not read XLSX. " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>
        BITZ’n’BOBZ eBay UK Draft Pack Builder
      </h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Paste URLs or upload an XLSX. Outputs your 12-column eBay UK draft pack.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12 }}>
        <div>
          <textarea
            rows={10}
            placeholder="Paste product URLs here (one per line)"
            value={rawUrls}
            onChange={(e) => setRawUrls(e.target.value)}
            style={{ width: "100%", padding: 10, fontSize: 14, borderRadius: 8 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={parseTextarea} style={btn}>
              Parse URLs
            </button>
            <button
              onClick={handleEnrich}
              disabled={loading || !urlCount}
              style={{ ...btn, background: loading ? "#555" : "#000", color: "#FFD400" }}
            >
              {loading ? "Running..." : `Generate Pack (${urlCount})`}
            </button>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Upload XLSX</div>
          <input type="file" accept=".xlsx,.xls" onChange={onXlsxUpload} />
          <hr style={{ margin: "12px 0" }} />
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={includeZip}
              onChange={(e) => setIncludeZip(e.target.checked)}
            />
            Download image ZIP
          </label>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
            Found URLs: {urlCount}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ ...card, marginTop: 12, borderLeft: "4px solid #b00020" }}>
          <b>Error:</b> {error}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Live Logs</h2>
        <div style={{ ...card, maxHeight: 280, overflow: "auto" }}>
          {!logs.length && <div style={{ opacity: 0.6 }}>No logs yet.</div>}
          {logs.map((l, i) => (
            <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>
              <div><b>{l.status}</b> {l.url ? `— ${l.url}` : ""}</div>
              {l.reason && <div style={{ opacity: 0.7 }}>Reason: {l.reason}</div>}
              {l.error && <div style={{ color: "#b00020" }}>Error: {l.error}</div>}
              {l.count && <div style={{ opacity: 0.7 }}>Count: {l.count}</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 18, fontSize: 12, opacity: 0.7 }}>
        Outputs: XLSX pack + optional ZIP of images
      </div>
    </div>
  );
}

const btn = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #000",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700
};

const card = {
  padding: 12,
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fafafa"
};
