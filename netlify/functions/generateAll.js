const ExcelJS = require("exceljs");
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai").default;

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

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const rows = [];

    for (const url of urls) {
      const { title, bullets } = await scrapeAmazon(url);

      const ai = await client.responses.create({
        model: "gpt-4.1-mini",
        input: `
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
`
      });

      const json = JSON.parse(ai.output_text);

      rows.push([
        url,
        json.seo_title,
        json.category,
        json.category_code,
        json.price,
        json.specs,
        json.html
      ]);
    }

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

async function scrapeAmazon(url) {
  const html = await axios.get(url).then(r => r.data);
  const $ = cheerio.load(html);

  const title = $("#productTitle").text().trim() || "";
  const bullets = [];

  $("#feature-bullets li").each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 2) bullets.push(t);
  });

  return { title, bullets };
}
