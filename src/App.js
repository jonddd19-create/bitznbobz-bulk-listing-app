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
