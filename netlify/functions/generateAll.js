import OpenAI from "openai";
import axios from "axios";
import * as cheerio from "cheerio";
import ExcelJS from "exceljs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const handler = async (event) => {
  try {
    const { urls } = JSON.parse(event.body);
    if (!urls || urls.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No URLs provided" })
      };
    }

    const results = [];
    for (const url of urls) {
      const scraped = await scrapeProduct(url);
      const ai = await askAI(scraped);

      results.push({
        url,
        ...scraped,
        ...ai
      });
    }

    const excelBase64 = await buildExcel(results);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file: excelBase64
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
        stack: err.stack
      })
    };
  }
};

// ---------------------------------------------------------------------
// SCRAPER: pulls title, key images, bullet points, description
// ---------------------------------------------------------------------
async function scrapeProduct(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const $ = cheerio.load(data);

  let title = $("h1").first().text().trim();
  if (!title) title = $("title").text().trim();

  // Images: Amazon or eBay
  const images = [];
  $("img").each((i, el) => {
    const src = $(el).attr("src") || "";
    if (
      src.includes("amazon") ||
      src.includes("ebayimg") ||
      src.includes("m.media-amazon")
    ) {
      if (!images.includes(src)) images.push(src);
    }
  });

  // Bullet points (Amazon)
  const bullets = [];
  $("#feature-bullets li").each((i, el) => {
    const t = $(el).text().trim();
    if (t) bullets.push(t);
  });

  // Generic description fallback
  let description = $("#productDescription").text().trim();
  if (!description) {
    description = $("meta[name='description']").attr("content") || "";
  }

  return {
    title,
    bullets,
    description,
    images
  };
}

// ---------------------------------------------------------------------
// AI PROCESSOR: creates SEO title, category, price, HTML etc.
// ---------------------------------------------------------------------
async function askAI(scraped) {
  const prompt = `
Rewrite and generate structured eBay listing data in UK English.
Input:
Title: ${scraped.title}
Bullets: ${scraped.bullets.join(" | ")}
Description: ${scraped.description}

Output ONLY valid JSON with fields:
{
  "seo_title": "",
  "ebay_category": "",
  "ebay_category_code": "",
  "suggested_price": "",
  "item_specs": "",
  "html_description": ""
}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1200
  });

  let text = response.choices[0].message.content;

  // Ensure valid JSON
  text = text.replace(/```json/g, "").replace(/```/g, "");

  return JSON.parse(text);
}

// ---------------------------------------------------------------------
// EXCEL GENERATOR
// ---------------------------------------------------------------------
async function buildExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Listings");

  sheet.columns = [
    { header: "SEO Title", key: "seo_title", width: 50 },
    { header: "eBay Category", key: "ebay_category", width: 30 },
    { header: "Category Code", key: "ebay_category_code", width: 20 },
    { header: "Suggested BIN Price", key: "suggested_price", width: 20 },
    { header: "Item Specs", key: "item_specs", width: 40 },
    { header: "HTML Description", key: "html_description", width: 80 }
  ];

  data.forEach((row) => {
    sheet.addRow({
      seo_title: row.seo_title,
      ebay_category: row.ebay_category,
      ebay_category_code: row.ebay_category_code,
      suggested_price: row.suggested_price,
      item_specs: row.item_specs,
      html_description: row.html_description
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer.toString("base64");
}
