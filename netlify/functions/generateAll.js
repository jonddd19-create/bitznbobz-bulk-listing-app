/ netlify/functions/generateAll.js /
const axios = require("axios");
const cheerio = require("cheerio");
const ExcelJS = require("exceljs");
const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAIAPIKEY });

// Allow overriding from Netlify env
const OPENAIMODEL = process.env.OPENAIMODEL || "gpt-4o-mini";

const HEADERS = [
  "Product URL (Input)",
  "SEO Title (UK, 80 chars max)",
  "eBay Category",
  "eBay Category Code",
  "Suggested Buy It Now Price (£)",
  "Item Specs",
  "Full HTML Description (BITZ’n’BOBZ Template)"
];

// --- CORS ---
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// --- BITZ’n’BOBZ HTML WRAPPER ---
function buildBitznBobzHtml({
  seoTitle,
  condition,
  shortDesc,
  featuresHtml,
  specsHtml,
  whatsInBoxHtml,
  postageHtml,
  returnsHtml
}) {
  return `
<div style="font-family:Aptos,Arial,sans-serif;background:#000;color:#fff;padding:14px;border:3px solid #FFD400;border-radius:12px;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
    <div style="font-size:22px;font-weight:900;color:#FFD400;">BITZ’n’BOBZ</div>
    <div style="font-size:14px;color:#fff;opacity:0.9;">Quality Finds • Fast Post • UK Seller</div>
  </div>

  <div style="background:#111;border:2px solid #FFD400;border-radius:10px;padding:12px;margin-bottom:12px;">
    <div style="font-size:20px;font-weight:900;color:#FFD400;margin-bottom:6px;">
      ${escapeHtml(seoTitle || "Item")}
    </div>
    ${
      // FIXED: Used template literal instead of undeclared JSX
      condition ? `<div><b>Condition:</b> ${escapeHtml(condition)}</div>` : ""
    }
    ${shortDesc || ""}
  </div>

  ${featuresHtml ? section("Key Features", featuresHtml) : ""}
  ${specsHtml ? section("Specifications", specsHtml) : ""}
  ${whatsInBoxHtml ? section("What’s in the Box", whatsInBoxHtml) : ""}

  ${postageHtml ? section("Postage", postageHtml) : defaultPostage()}
  ${returnsHtml ? section("Returns", returnsHtml) : defaultReturns()}

  <div style="margin-top:12px;background:#FFD400;color:#000;padding:10px;border-radius:8px;font-weight:800;font-size:13px;">
    Thanks for choosing BITZ’n’BOBZ — great kit, fair prices, fast UK delivery.
  </div>
</div>
`.trim();
}

function section(title, innerHtml) {
  return `
<div style="background:#0b0b0b;border:1px solid #333;border-radius:10px;padding:12px;margin-bottom:10px;">
  <div style="font-size:16px;font-weight:900;color:#FFD400;margin-bottom:6px;">${title}</div>
  <div style="font-size:14px;line-height:1.5;">${innerHtml}</div>
</div>
`.trim();
}

function defaultPostage() {
  return section(
    "Postage",
    `<ul>
      <li>Same/next working day dispatch where possible.</li>
      <li>Tracked delivery on most items.</li>
      <li>Combined postage available — just ask.</li>
    </ul>`
  );
}

function defaultReturns() {
  return section(
    "Returns",
    `<ul>
      <li>30-day returns accepted.</li>
      <li>Buyer pays return postage unless item is faulty.</li>
      <li>Please keep packaging until you’re happy.</li>
    </ul>`
  );
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- URL cleaning ---
function safeCleanUrl(raw) {
  if (!raw) return "";
  let u = String(raw).trim();

  if (!/^https?:\/\//i.test(u)) {
    u = "https://" + u;
  }

  try {
    if (/%[0-9A-Fa-f]{2}/.test(u)) {
      u = decodeURIComponent(u);
    }
  } catch {}

  // CRITICAL FIX: Added 'u' (Unicode) flag to resolve "SyntaxError: Invalid regular expression flags"
  return u.replace(/[\u0000-\u001F\u007F\s]+/gu, "");
}

// --- ScrapingBee fetch ---
async function fetchHtml(url) {
  const apiKey = process.env.SCRAPINGBEEAPIKEY;
  if (!apiKey) {
    throw new Error("Missing SCRAPINGBEEAPIKEY in Netlify environment.");
  }

  const apiUrl = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(
    apiKey
  )}&renderjs=false&countrycode=gb&url=${encodeURIComponent(url)}`;

  try {
    const res = await axios.get(apiUrl, {
      timeout: 25000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-GB,en;q=0.9"
      }
    });
    return res.data;
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    throw new Error(
      `ScrapingBee error${status ? " " + status : ""}: ${
        typeof data === "string" ? data.slice(0, 200) : JSON.stringify(data || {})
      }`
    );
  }
}

// --- Scrapers ---
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

  return { title, price, bullets };
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

  return { title, price, bullets };
}

function normalisePriceToNumber(priceStr) {
  if (!priceStr) return null;
  const m = String(priceStr).replace(",", ".").match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

// --- OpenAI AI Enrichment (bullet-proof) ---
async function enrichWithAI({ url, title, priceNum, bullets }) {
  if (!process.env.OPENAIAPIKEY) {
    throw new Error("Missing OPENAIAPIKEY in Netlify env.");
  }

  // SAFETY FIX: always ensure bullets is an array
  bullets = Array.isArray(bullets) ? bullets : [];

  const system = `
You are an expert UK eBay listing assistant for the BITZ’n’BOBZ store.
Output ONLY valid JSON (no markdown).
Use UK spelling, factual tone, no hype.
`.trim();

  const user = `
URL: ${url}
TITLE: ${title}
PRICE: ${priceNum}
BULLETS: ${bullets.join(", ")}

Produce the required listing JSON.
`.trim();

  const resp = await client.chat.completions.create({
    // FIXED: Corrected typo from OPENAI_MODEL to OPENAIMODEL
    model: OPENAIMODEL,
    temperature: 0.4,
    // FIXED: Corrected typo from 'responseformat' to 'response_format'
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  const text = resp.choices?.[0]?.message?.content || "";

  return JSON.parse(text);
}

// --- Excel builder ---
async function buildWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("BitznBobz Pack");

  ws.addRow(HEADERS).font = { bold: true };

  rows.forEach(r => {
    ws.addRow([
      r.url,
      r.seoTitle,
      r.categoryName,
      r.categoryCode,
      r.buyItNowPriceGBP,
      r.itemSpecsText,
      r.fullHtml
    ]);
  });

  ws.columns.forEach(col => {
    col.width = Math.min(80, Math.max(18, col.header.length + 6));
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}

// --- Utilities ---
function json(statusCode, obj) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(obj)
  };
}

function safeJson(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

// --- Main handler ---
exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return json(200, {});
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Use POST" });
    }

    const body = safeJson(event.body);

    let urls = [];
    if (Array.isArray(body.urls)) urls = body.urls;
    else if (typeof body.urls === "string") urls = body.urls.split(/[\n,]+/);
    else if (body.url) urls = [body.url];

    urls = urls.map(u => u.trim()).filter(Boolean);

    if (!urls.length) {
      return json(400, { error: "No URLs provided" });
    }

    if (!process.env.OPENAIAPIKEY || !process.env.SCRAPINGBEEAPIKEY) {
      return json(500, { error: "Missing required API keys" });
    }

    const rows = [];

    for (const rawUrl of urls) {
      const url = safeCleanUrl(rawUrl);

      try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);

        const isAmazon = /amazon\./i.test(url);
        const scraped = isAmazon ? extractAmazon($) : extractGeneric($);

        const priceNum = normalisePriceToNumber(scraped.price);

        const ai = await enrichWithAI({
          url,
          title: scraped.title,
          priceNum,
          bullets: scraped.bullets
        });

        const finalPrice =
          typeof ai.buyItNowPriceGBP === "number" && ai.buyItNowPriceGBP > 0
            ? ai.buyItNowPriceGBP
            : (priceNum ?? "");

        const fullHtml = buildBitznBobzHtml({
          seoTitle: ai.seoTitle || scraped.title,
          condition: ai.condition || "",
          shortDesc: ai.shortDescHtml || "",
          featuresHtml: ai.featuresHtml || "",
          specsHtml: ai.specsHtml || "",
          whatsInBoxHtml: ai.whatsInBoxHtml || "",
          postageHtml: ai.postageHtml || "",
          returnsHtml: ai.returnsHtml || ""
        });

        rows.push({
          url,
          seoTitle: ai.seoTitle || scraped.title,
          categoryName: ai.categoryName || "",
          categoryCode: ai.categoryCode || "",
          buyItNowPriceGBP: finalPrice,
          itemSpecsText: ai.itemSpecsText || "",
          fullHtml
        });
      } catch (e) {
        rows.push({
          url,
          seoTitle: "",
          categoryName: "",
          categoryCode: "",
          buyItNowPriceGBP: "",
          itemSpecsText: "FAILED: " + e.message,
          fullHtml: ""
        });
      }
    }

    const file = await buildWorkbook(rows);
    return json(200, { file });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
