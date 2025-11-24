const cheerio = require("cheerio");
const {
  safeCleanUrl,
  shouldSkipUrl,
  fetchHtml,
  extractAmazon,
  extractGeneric,
  normalisePriceToNumber
} = require("./lib/scrape");
const { enrichWithAI } = require("./lib/enrich");
const { buildBitznBobzHtml } = require("./lib/html");
const { buildWorkbookBase64 } = require("./lib/excel");
const { buildImagesZipBase64 } = require("./lib/zip");

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const DEFAULTS = {
  action: "Draft",
  categoryId: 156463,
  quantity: 1,
  condition: "New",
  format: "FixedPrice",
  upc: "",
  photoUrl: ""
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: CORS_HEADERS, body: "{}" };
    }
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Use POST" })
      };
    }

    const body = JSON.parse(event.body || "{}");

    let urls = [];
    if (Array.isArray(body.urls)) urls = body.urls;
    else if (typeof body.urls === "string") urls = body.urls.split(/[\n,]+/);
    else if (body.url) urls = [body.url];

    urls = urls.map(u => safeCleanUrl(u)).filter(Boolean);

    if (!urls.length) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "No URLs provided" })
      };
    }

    const rows = [];
    const logs = [];
    const imagesToZip = [];
    let keptIndex = 0;

    for (const rawUrl of urls) {
      const url = safeCleanUrl(rawUrl);

      if (shouldSkipUrl(url)) {
        logs.push({ url, status: "skipped", reason: "shortlink/junk URL" });
        continue;
      }

      logs.push({ url, status: "scraping" });

      try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);

        const isAmazon = /amazon\./i.test(url);
        const scraped = isAmazon ? extractAmazon($) : extractGeneric($);

        const priceNum = normalisePriceToNumber(scraped.price);

        logs.push({ url, status: "ai_enriching" });

        const ai = await enrichWithAI({
          url,
          title: scraped.title,
          priceNum,
          bullets: scraped.bullets,
          images: scraped.images
        });

        const seoTitle = (ai.seoTitle || scraped.title || "")
          .trim()
          .slice(0, 80);

        let priceMinus20 = "";
        if (priceNum && priceNum > 0)
          priceMinus20 = Number((priceNum * 0.8).toFixed(2));
        else if (typeof ai.buyItNowPriceGBP === "number")
          priceMinus20 = ai.buyItNowPriceGBP;

        const fullHtml = buildBitznBobzHtml({
          seoTitle,
          condition: DEFAULTS.condition,
          shortDesc: ai.shortDescHtml || "",
          featuresHtml: ai.featuresHtml || "",
          specsHtml: ai.specsHtml || "",
          whatsInBoxHtml: ai.whatsInBoxHtml || "",
          postageHtml: ai.postageHtml || "",
          returnsHtml: ai.returnsHtml || ""
        });

        const imageUrls =
          Array.isArray(ai.imageUrls) && ai.imageUrls.length
            ? ai.imageUrls
            : scraped.images || [];

        imageUrls.forEach((img, i) => {
          imagesToZip.push({
            url: img,
            filename: `${seoTitle
              .replace(/[^a-z0-9]+/gi, "-")
              .toLowerCase()}-${i + 1}.jpg`
          });
        });

        rows.push({
          ProductURL: url,
          Action: DEFAULTS.action,
          SKU:
            ai.sku ||
            (ai.asin
              ? `BITZ-${ai.asin}`
              : `BITZ-ITEM${String(keptIndex + 1).padStart(3, "0")}`),
          CategoryID: DEFAULTS.categoryId,
          SEOTitle: seoTitle,
          UPC: DEFAULTS.upc,
          PriceMinus20: priceMinus20,
          Quantity: DEFAULTS.quantity,
          PhotoURL: DEFAULTS.photoUrl,
          Condition: DEFAULTS.condition,
          DescriptionHTML: fullHtml,
          Format: DEFAULTS.format,
          ItemSpecsText: ai.itemSpecsText || ""
        });

        logs.push({ url, status: "done" });
        keptIndex++;
      } catch (err) {
        logs.push({ url, status: "failed", error: err.message });

        rows.push({
          ProductURL: url,
          Action: DEFAULTS.action,
          SKU: `BITZ-ITEM${String(keptIndex + 1).padStart(3, "0")}`,
          CategoryID: DEFAULTS.categoryId,
          SEOTitle: "",
          UPC: DEFAULTS.upc,
          PriceMinus20: "",
          Quantity: DEFAULTS.quantity,
          PhotoURL: DEFAULTS.photoUrl,
          Condition: DEFAULTS.condition,
          DescriptionHTML: "",
          Format: DEFAULTS.format,
          ItemSpecsText: "FAILED: " + err.message
        });

        keptIndex++;
      }
    }

    const excelBase64 = await buildWorkbookBase64(rows);

    let zipBase64 = null;
    if (body.includeZip && imagesToZip.length) {
      logs.push({ status: "zipping_images", count: imagesToZip.length });
      zipBase64 = await buildImagesZipBase64(imagesToZip);
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        excelBase64,
        zipBase64,
        logs,
        rowCount: rows.length
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
