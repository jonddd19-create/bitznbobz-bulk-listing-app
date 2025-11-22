/* netlify/functions/generateAll.js */
const axios = require("axios");
const cheerio = require("cheerio");
const ExcelJS = require("exceljs");
const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const HEADERS = [
  "Product URL (Input)",
  "SEO Title (UK, 80 chars max)",
  "eBay Category",
  "eBay Category Code",
  "Suggested Buy It Now Price (£)",
  "Item Specs",
  "Full HTML Description (BITZ’n’BOBZ Template)"
];

// --- Your BITZ’n’BOBZ HTML WRAPPER (outer shell stays consistent) ---
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
  // Keep this aligned with your store look.
  return `
<div style="font-family:Aptos,Arial,sans-serif;background:#000;color:#fff;padding:14px;border:3px solid #FFD400;border-radius:12px;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
    <div style="font-size:22px;font-weight:900;color:#FFD400;letter-spacing:0.5px;">
      BITZ’n’BOBZ
    </div>
    <div style="font-size:14px;color:#fff;opacity:0.9;">
      Quality Finds • Fast Post • UK Seller
    </div>
  </div>

  <div style="background:#111;border:2px solid #FFD400;border-radius:10px;padding:12px;margin-bottom:12px;">
    <div style="font-size:20px;font-weight:900;color:#FFD400;margin-bottom:6px;">
      ${escapeHtml(seoTitle || "Item")}
    </div>
    ${condition ? `<div style="font-size:14px;margin-bottom:6px;"><b>Condition:</b> ${escapeHtml(condition)}</div>` : ""}
    ${shortDesc ? `<div style="font-size:14px;line-height:1.45;">${shortDesc}</div>` : ""}
  </div>

  ${featuresHtml ? section("Key Features", featuresHtml) : ""}
  ${specsHtml ? section("Specifications", specsHtml) : ""}
  ${whatsInBoxHtml ? section("What’s in the Box", whatsInBoxHtml) : ""}

  ${postageHtml ? section("Postage", postageHtml) : defaultPostage()}
  ${returnsHtml ? section("Returns", returnsHtml) : defaultReturns()}

  <<div style="margin-top:12px;background:#FFD400;color:#000;padding:10px;border-radius:8px;font-weight:800;font-size:13px;">
  Thanks for choosing BITZ’n’BOBZ — great kit, fair prices, fast UK delivery.
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
      <li>Buyer pays return postage unless item is faulty/not as described.</li>
      <li>Please keep packaging until you’re happy.</li>
    </ul>`
  );
}

function escapeHtml(s = "") {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- Scrape helpers ---
async function fetchHtml(url) {
  const res = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    },
    timeout: 20000
  });
  return res.data;
}

function extractAmazon($) {
  const title =
    $("#productTitle").text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim();

  // Try multiple price sources
  let price =
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[name="twitter:data1"]').attr("content") ||
    $(".a-price .a-offscreen").first().text().trim();

  if (!price) {
    const whole = $(".a-price-whole").first().text().replace(/[^\d]/g, "");
    const frac = $(".a-price-fraction").first().text().replace(/[^\d]/g, "");
    if (whole) price = `£${whole}${frac ? "." + frac : ""}`;
  }

  const bullets = $("#feature-bullets li")
    .map((i, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  return { title, price, bullets };
}

function extractGeneric($) {
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim();

  const bodyText = $("body").text();
  const priceMatch = bodyText.match(/£\s?\d+(?:[.,]\d{2})?/);
  const price = priceMatch ? priceMatch[0].replace(/\s+/g, "") : "";

  const bullets = $("li")
    .map((i, el) => $(el).text().trim())
    .get()
    .filter(t => t.length > 6)
    .slice(0, 12);

  return { title, price, bullets };
}

function normalisePriceToNumber(priceStr) {
  if (!priceStr) return null;
  const m = priceStr.replace(",", ".").match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

// --- OpenAI call ---
async function enrichWithAI({ url, title, priceNum, bullets }) {
  const system = `
You are an expert UK eBay listing assistant for the BITZ’n’BOBZ store.
Return ONLY valid JSON (no markdown, no commentary).
Use UK spelling, friendly factual tone, no hype.
If uncertain, say "Unknown" or leave blank, do not invent model numbers.
SEO Title must be <= 80 characters.
Buy It Now price must be a NUMBER in GBP (no £ symbol).
HTML blocks must be CLEAN inner HTML only (ul/li, p, table allowed) with no outer wrapper.
`.trim();

  const user = `
INPUT URL: ${url}

SCRAPED TITLE: ${title || "Unknown"}
SCRAPED PRICE GBP (if any): ${priceNum ?? "Unknown"}
SCRAPED BULLETS:
${bullets && bullets.length ? bullets.map(b => "- " + b).join("\n") : "None"}

TASK:
1) Produce a better SEO title for UK eBay (<=80 chars).
2) Pick the best eBay category name + category code (guess if needed).
3) Suggest a realistic Buy It Now price in GBP as a number.
   - If scraped price exists, keep close unless clearly wrong.
4) Produce short, accurate item specs (1 paragraph or tight bullet list).
5) Produce inner HTML blocks for:
   - shortDesc (1–2 paragraphs)
   - featuresHtml (bullet list)
   - specsHtml (table or bullets)
   - whatsInBoxHtml (bullets)
   - condition (plain text)
   - postageHtml (bullets, UK couriers)
   - returnsHtml (bullets)

OUTPUT JSON SHAPE:
{
  "seoTitle": "",
  "categoryName": "",
  "categoryCode": "",
  "buyItNowPriceGBP": 0,
  "itemSpecsText": "",
  "condition": "",
  "shortDescHtml": "",
  "featuresHtml": "",
  "specsHtml": "",
  "whatsInBoxHtml": "",
  "postageHtml": "",
  "returnsHtml": ""
}
`.trim();

  const resp = await client.responses.create({
    model: "gpt-5.1",
    input: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  const text = resp.output_text || "";
  const jsonStr = extractFirstJsonObject(text);
  if (!jsonStr) throw new Error("AI did not return JSON.");

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error("AI JSON parse failed: " + e.message);
  }

  return data;
}

function extractFirstJsonObject(s) {
  // grabs first {...} block defensively
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return s.slice(start, end + 1);
}

// --- Excel builder ---
async function buildWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("BitznBobz Pack");

  ws.addRow(HEADERS);
  ws.getRow(1).font = { bold: true };

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
    col.width = Math.min(80, Math.max(18, (col.header || "").length + 6));
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}

// --- Main handler ---
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Use POST" });
    }

    const body = safeJson(event.body);
    const urls = Array.isArray(body?.urls) ? body.urls.filter(Boolean) : [];

    if (!urls.length) {
      return json(400, { error: "No URLs provided." });
    }

    const rows = [];
    for (const url of urls) {
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
            : (priceNum || "");

        const fullHtml = buildBitznBobzHtml({
          seoTitle: ai.seoTitle || scraped.title || "Item",
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
          seoTitle: ai.seoTitle || scraped.title || "",
          categoryName: ai.categoryName || "",
          categoryCode: ai.categoryCode || "",
          buyItNowPriceGBP: finalPrice,
          itemSpecsText: ai.itemSpecsText || "",
          fullHtml
        });
      } catch (itemErr) {
        rows.push({
          url,
          seoTitle: "",
          categoryName: "",
          categoryCode: "",
          buyItNowPriceGBP: "",
          itemSpecsText: "FAILED: " + itemErr.message,
          fullHtml: ""
        });
      }
    }

    const file = await buildWorkbook(rows);
    return json(200, { file });
  } catch (err) {
    return json(500, { error: err.message || String(err) });
  }
};

// --- util responses ---
function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(obj)
  };
}

function safeJson(s) {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}
