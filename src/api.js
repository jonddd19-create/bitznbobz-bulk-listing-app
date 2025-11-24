export async function enrichUrls({ urls, includeZip }) {
  const res = await fetch("/.netlify/functions/generateAll", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ urls, includeZip })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Server error");
  }

  return res.json();
}
