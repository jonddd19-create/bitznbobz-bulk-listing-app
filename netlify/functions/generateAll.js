// Netlify Function: generateAll
// Requires OPENAI_API_KEY in Netlify env vars.
// Infers product info mainly from URL text. Enhance later with scraping/taxonomy.

const OPENAI_URL = "https://api.openai.com/v1/responses";

exports.handler = async (event) => {
  try {
    const { urls } = JSON.parse(event.body || "{}");
    if (!Array.isArray(urls) || urls.length === 0) {
      return { statusCode: 400, body: "Missing urls" };
    }

    const system = `
You are an eBay UK listing assistant for the BITZ’n’BOBZ store.
For each product URL, infer the product type from the URL string (and any obvious clues).
Return ONLY valid JSON: {"rows":[...]} where each row is:
{
  "url": string,
  "title": string,
  "category": string,
  "categoryId": string,
  "price": number,
  "specs": string,
  "html": string
}

Rules:
- UK spelling/tone. Avoid American words.
- Title max 80 chars, SEO-optimised.
- Category name should be best eBay UK fit.
- If categoryId is not certain, leave it empty.
- Price is suggested BIN in GBP (number only), round to 2dp.
- Specs is a short item specifics paragraph.
- html is FULL BITZ’n’BOBZ black/yellow HTML description, mobile-friendly, unique.
- Do not invent specific technical specs unless obvious from URL.
`.trim();

    const input = [
      { role: "system", content: system },
      { role: "user", content: "URLs:\n" + urls.map((u,i)=>`${i+1}. ${u}`).join("\n") }
    ];

    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input,
        max_output_tokens: 1800,
        temperature: 0.4
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return { statusCode: 500, body: t };
    }

    const data = await r.json();
    const text = (data.output_text || "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      parsed = JSON.parse(text.slice(start, end+1));
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed)
    };
  } catch (err) {
    return { statusCode: 500, body: err.message || "Unknown error" };
  }
};
