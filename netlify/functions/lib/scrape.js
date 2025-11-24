// netlify/functions/lib/scrape.js
const axios = require("axios");
const cheerio = require("cheerio");

const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;

// --- A: Maximum reliability — ALWAYS premium proxy ---
async function fetchHtml(url) {
  const apiUrl = `https://app.scrapingbee.com/api/v1/`;

  const params = {
    api_key: SCRAPINGBEE_API_KEY,
    url,
    premium_proxy: "true",
    country_code: "uk",
    render_js: "false",
    block_resources: "false",
    js_scenario: "false",
    timeout: 30000,
    wait: 2000,
    headers: JSON.stringify({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    }),
  };

  try {
    const response = await axios.get(apiUrl, { params });
    return response.data;
  } catch (err) {
    throw new Error(
      `ScrapingBee request failed: ${err.response?.status || ""} ${err.response?.statusText || ""}`
    );
  }
}

function cleanText(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

async function scrapeProduct(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  // --- Title ---
  const title =
    cleanText($("#productTitle").text()) ||
    cleanText($("h1").first().text()) ||
    "";

  // --- Bullets ---
  const bullets = [];
  $("#feature-bullets li, ul.a-unordered-list li").each((i, el) => {
    const t = cleanText($(el).text());
    if (t && t.length > 2) bullets.push(t);
  });

  // --- Price ---
  const price =
    cleanText($("#priceblock_ourprice").text()) ||
    cleanText($("#priceblock_dealprice").text()) ||
    cleanText($(".a-price .a-offscreen").first().text()) ||
    "";

  // --- Images ---
  const images = [];
  $("img").each((i, el) => {
    const src =
      $(el).attr("data-src") ||
      $(el).attr("data-old-hires") ||
      $(el).attr("src");
    if (src && src.startsWith("http") && !images.includes(src)) {
      images.push(src);
    }
  });

  return {
    url,
    title,
    bullets,
    price,
    images,
  };
}

module.exports = { scrapeProduct };
