const ExcelJS = require("exceljs");
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai");

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const urls = body.urls || [];

    if (!urls.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No URLs provided" })
      };
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const rows = [];

    for (const url of urls) {
      const { title, bullets } = await scrapeAmazon(url);

      const prompt = `
Create structured UK-tone eBay listing data based ONLY on:

URL: ${url}
Title: ${title}
Bullets: ${bullets.join("; ")}

Return ONLY this JSON:
{
 "seo_title": "",
 "category": "",
 "category_code": "",
 "price": "",
 "specs": "",
 "html": ""
}
`;

      const response = await client.responses.create({
        model: "gpt-4.1-mini",
        input: prompt
      });

      // Extract text from the new responses API
      const rawText = response.output[0].content[0].text;

      // Clean weird quotes / backticks
      const cleaned = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let json;

      try {
        json = JSON.parse(cleaned);
      } catch (err) {
        throw new Error("AI returned invalid JSON:\n" + cleaned);
      }

      rows.push([
        url,
        json.seo_title || "",
        json.category || "",
        json.category_code || "",
        json.price || "",
        json.specs || "",
        json.html || ""
      ]);
    }

    // build the Excel sheet
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Listings");

    sheet.addRow([
      "Product URL (Input)",
      "SEO Title (UK, 80 chars max)",
      "eBay Category",
      "eBay Category Code",
      "Suggested Buy It Now Price (£)",
      "Item Specs",
      "Full HTML Description (BITZ’n’BOBZ Template)"
    ]);

    rows.forEach((r) => sheet.addRow(r));

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({ file: base64 })
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


// --------------------------
// AMAZON SCRAPER
// --------------------------
async function scrapeAmazon(url) {
  try {
    const html = await axios.get(url).then(r => r.data);
    const $ = cheerio.load(html);

    const title = $("#productTitle").text().trim() || "";
    const bullets = [];

    $("#feature-bullets li").each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 2) bullets.push(t);
    });

    return { title, bullets };
  } catch (err) {
    return { title: "", bullets: [] };
  }
}
