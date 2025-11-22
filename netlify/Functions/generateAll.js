const axios = require("axios");
const cheerio = require("cheerio");
const ExcelJS = require("exceljs");
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAIAPIKEY
});

const OPENAIMODEL = process.env.OPENAIMODEL || "gpt-4o-mini";

// Excel columns
const HEADERS = [
  "Product URL (Input)",
  "SEO Title (UK, 80 chars max)",
  "eBay Category",
  "eBay Category Code",
  "Suggested Buy It Now Price (£)",
  "Item Specs",
  "Full HTML Description (BITZ’n’BOBZ Template)"
];

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// -------------------------------
// SIMPLE HTML ESCAPING
// -------------------------------
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// -------------------------------
// AMAZON URL NORMALISATION (Important!)
// -------------------------------
function cleanAmazonUrl(url) {
  try {
    let u = new URL(url);

    if (!u.pathname.includes("/dp/")) return url;

    const parts = u.pathname.split("/");
    const dpIndex = parts.indexOf("dp");
    if (dpIndex === -1 || dpIndex + 1 >= parts.length) return url;

    const asin = parts[dpIndex + 1].trim();

    return `https://www.amazon.co.uk/dp/${asin}`;
  } catch {
    return url;
  }
}

// -------------------------------
// UNIVERSAL URL CLEANING
// -------------------------------
function safeCleanUrl(raw) {
  if (!raw) return "";

  let u = raw.trim();

  if (!/^https?:\/\//i.test(u)) u = "https://" + u;

  // Clean low ascii and whitespace
  return u.replace(/[\x00-\x1F\x7F\s]+/g, "");
}

// -------------------------------
// FETCH HTML USING SCRAPINGBEE
// -------------------------------
async function fetchHtml(url) {
  const apiKey = process.env.SCRAPINGBEEAPIKEY;
  if (!apiKey) throw new Error("Missing SCRAPINGBEEAPIKEY");

  const apiUrl =
    `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(apiKey)}` +
    `&render_js=false&country_code=gb&url=${encodeURIComponent(url)}`;

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
    const s = err?.response?.status;
    const d = err?.response?.data;
    throw new Error(`ScrapingBee error ${s || ""}: ${JSON.stringify(d || {})}`);
  }
}

// -------------------------------
// SCRAPERS
// -------------------------------
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

  const body = $("body").text();
  const priceMatch = body.match(/£\s?\d+(?:[.,]\d{2})?/);
  const price = priceMatch ? priceMatch[0].replace(/\s+/g, "") : "";

  const bullets = $("li")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(t => t.length > 6)
    .slice(0, 12);

  return { title, price, bullets };
}

// -------------------------------
// PRICE NORMALISATION
// -------------------------------
function normalisePriceToNumber(p) {
  if (!p) return null;
  const m = p.replace(",", ".").match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

// -------------------------------
// AI ENRICHMENT (safe JSON guarantee)
// -------------------------------
async function enrichWithAI({ url, title, priceNum, bullets }) {
  bullets = Array.isArray(bullets) ? bullets : [];

  const system = `
You write UK-optimised eBay listing JSON.
Output ONLY valid JSON.
`.trim();

  const user = `
URL: ${url}
TITLE: ${title}
PRICE: ${priceNum}
BULLETS: ${bullets.join(" | ")}
`.trim();

  const resp = await client.chat.completions.create({
    model: OPENAIMODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  const text = resp.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text);
}

// -------------------------------
// BITZ'N'BOBZ HTML DESCRIPTION BUILDER
// -------------------------------
function buildHtml({
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
<div style="font-family:Aptos,Arial;background:#000;color:#fff;padding:14px;border:3px solid #FFD400;border-radius:12px;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
    <div style="font-size:22px;font-weight:900;color:#FFD400;">BITZ’n’BOBZ</div>
    <div style="font-size:14px;color:#fff;opacity:0.9;">Quality Finds • Fast Post • UK Seller</div>
  </div>

  <div style="background:#111;border:2px solid #FFD400;border-radius:10px;padding:12px;margin-bottom:12px;">
    <div style="font-size:20px;font-weight:900;color:#FFD400;margin-bottom:6px;">${escapeHtml(seoTitle)}</div>
    ${condition ? `<div><b>Condition:</b> ${escapeHtml(condition)}</div>` : ""}
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

function section(title, html) {
  return `
<div style="background:#0b0b0b;border:1px solid #333;border-radius:10px;padding:12px;margin-bottom:10px;">
  <div style="font-size:16px;font-weight:900;color:#FFD400;margin-bottom:6px;">
    ${title}
  </div>
  <div style="font-size:14px;line-height:1.5;">${html}</div>
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
      <li>Please keep packaging until you're happy.</li>
    </ul>`
  );
}

// -------------------------------
// EXCEL BUILDER
// -------------------------------
async function buildWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("BitznBobz Pack");

  ws.addRow(HEADERS).font = { bold: true };

  for (const r of rows) {
    ws.addRow([
      r.url,
      r.seoTitle,
      r.categoryName,
      r.categoryCode,
      r.buyItNowPriceGBP,
      r.itemSpecsText,
      r.fullHtml
    ]);
  }

  ws.columns.forEach(col => {
    col.width = 60;
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf).toString("base64");
}

// -------------------------------
// JSON HELPER
// -------------------------------
function json(status, obj) {
  return { statusCode: status, headers: CORS_HEADERS, body: JSON.stringify(obj) };
}

function safeJson(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

// -------------------------------
// MAIN HANDLER
// -------------------------------
exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, {});
    if (event.httpMethod !== "POST") return json(405, { error: "Use POST" });

    const body = safeJson(event.body);

    let urls = [];
    if (Array.isArray(body.urls)) urls = body.urls;
    else if (typeof body.urls === "string") urls = body.urls.split(/[\n,]+/);
    else if (body.url) urls = [body.url];

    urls = urls.map(u => u.trim()).filter(Boolean);

    if (!urls.length) return json(400, { error: "No URLs provided" });

    if (!process.env.OPENAIAPIKEY || !process.env.SCRAPINGBEEAPIKEY) {
      return json(500, { error: "Missing API keys" });
    }

    const rows = [];

    for (const rawUrl of urls) {
      // CLEAN & NORMALISE AMAZON URL
      let url = safeCleanUrl(rawUrl);
      url = cleanAmazonUrl(url);

      try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);

        const scraped = /amazon\./i.test(url)
          ? extractAmazon($)
          : extractGeneric($);

        const priceNum = normalisePriceToNumber(scraped.price);

        const ai = await enrichWithAI({
          url,
          title: scraped.title,
          priceNum,
          bullets: scraped.bullets
        });

        const finalPrice =
          typeof ai.buyItNowPriceGBP === "number"
            ? ai.buyItNowPriceGBP
            : (priceNum ?? "");

        const fullHtml = buildHtml({
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
      } catch (err) {
        rows.push({
          url,
          seoTitle: "",
          categoryName: "",
          categoryCode: "",
          buyItNowPriceGBP: "",
          itemSpecsText: "FAILED: " + err.message,
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
