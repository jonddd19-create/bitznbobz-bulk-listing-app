const OpenAI = require("openai");

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.OPENAIAPIKEY || "";
const OPENAI_MODEL =
  process.env.OPENAI_MODEL || process.env.OPENAIMODEL || "gpt-4o-mini";

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

async function enrichWithAI({ url, title, priceNum, bullets, images }) {
  const system = `
You are an expert UK eBay listing assistant for BITZ’n’BOBZ.
Output ONLY valid JSON. No markdown. UK spelling.

Return keys:
seoTitle (<=80 chars),
shortDescHtml,
featuresHtml,
specsHtml,
whatsInBoxHtml,
postageHtml,
returnsHtml,
itemSpecsText,
imageUrls (array),
asin (string optional),
sku (string optional)
`.trim();

  const user = `
URL: ${url}
TITLE: ${title}
PRICE_GBP: ${priceNum ?? ""}
BULLETS: ${(bullets || []).join(" | ")}
IMAGES: ${(images || []).slice(0, 6).join(" | ")}
`.trim();

  const resp = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  const txt = resp.choices?.[0]?.message?.content || "{}";

  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

module.exports = { enrichWithAI };
