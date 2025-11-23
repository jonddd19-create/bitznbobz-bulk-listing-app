const axios = require("axios");

const SCRAPINGBEE_API_KEY =
  process.env.SCRAPINGBEE_API_KEY || process.env.SCRAPINGBEEAPIKEY || "";

function safeCleanUrl(raw) {
  if (!raw) return "";
  let u = String(raw).trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { if (/%[0-9A-Fa-f]{2}/.test(u)) u = decodeURIComponent(u); } catch {}
  u = u.replace(/[\x00-\x1F\x7F\s]+/g, "");
  if (/amazon\./i.test(u)) u = canonicalAmazonUrl(u);
  return u;
}

function canonicalAmazonUrl(url) {
  try {
    const parsed = new URL(url);
    const asinMatch =
      parsed.pathname.match(/\/dp\/([A-Z0-9]{10})/i) ||
      parsed.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    const asin = asinMatch ? asinMatch[1].toUpperCase() : null;
    if (!asin) return url;
    return `https://www.amazon.co.uk/dp/${asin}`;
  } catch {
    return url;
  }
}

function shouldSkipUrl(url) {
  const u = String(url).toLowerCase();
  if (u.includes("ebay.us/m/")) return true;
  if (u.includes("bit.ly") || u.includes("tinyurl")) return true;
  return false;
}

async function fetchHtml(url) {
  if (!SCRAPINGBEE_API_KEY) throw new Error("Missing SCRAPINGBEE_API_KEY");
  const apiUrl =
    `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(SCRAPINGBEE_API_KEY)}&renderjs=false&countrycode=gb&url=${encodeURIComponent(url)}`;
  const res = await axios.get(apiUrl, {
    timeout: 25000,
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-GB,en;q=0.9"
    }
  });
  return res.data;
}

function extractAmazon($) {
  const title =
    $("#productTitle").text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim();

  let price =
    $('meta[property="product:price:amount"]').attr("content") ||
    $(".a-price .a-offscreen").first().text().trim();

  if (!price) {
    const whole = $(".a-price-whole").first().text().replace(/[^\d]/g, "");
    const frac = $(".a-price-fraction").first().text().replace(/[^\d]/g, "");
    if (whole) price = `£${whole}${frac ? "." + frac : ""}`;
  }

  const bullets = $("#feature-bullets li")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const images = [];
  $("#altImages img").each((_, el) => {
    const src = $(el).attr("src");
    if (src) images.push(src.replace(/_SS\d+_/, "_SL1200_"));
  });

  return { title, price, bullets, images };
}

function extractGeneric($) {
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim();

  const bodyText = $("body").text();
  const priceMatch = bodyText.match(/£\s?\d+(?:[.,]\d{2})?/);
  const price = priceMatch ? priceMatch[0].replace(/\s+/g, "") : "";

  const bullets = $("li")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(t => t.length > 6)
    .slice(0, 12);

  const images = [];
  $('meta[property="og:image"]').each((_, el) => {
    const src = $(el).attr("content");
    if (src) images.push(src);
  });

  return { title, price, bullets, images };
}

function normalisePriceToNumber(priceStr) {
  if (!priceStr) return null;
  const m = String(priceStr).replace(",", ".").match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

module.exports = {
  safeCleanUrl,
  canonicalAmazonUrl,
  shouldSkipUrl,
  fetchHtml,
  extractAmazon,
  extractGeneric,
  normalisePriceToNumber
};
