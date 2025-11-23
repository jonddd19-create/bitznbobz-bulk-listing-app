# BITZ’n’BOBZ eBay UK Draft Pack Builder (Netlify)

This app takes product URLs (Amazon/other), scrapes title/bullets/price, enriches with OpenAI,
and outputs an eBay UK **12‑column Draft Pack** + optional ZIP of images.

## Deploy to Netlify

1. Push this repo to GitHub (or drag/drop into Netlify).
2. In Netlify **Site settings → Environment variables**, add:
   - `OPENAI_API_KEY`
   - `SCRAPINGBEE_API_KEY`
   - optional `OPENAI_MODEL` (defaults to gpt-4o-mini)
3. Deploy.

## Local dev

```bash
npm install
npm start
```

Functions run on Netlify; locally you can use Netlify CLI if you want.

## Output columns (fixed)

- Product URL
- Action = Draft
- SKU auto‑generated
- Ebay UK Category ID = 156463
- SEO Title (≤80 chars)
- UPC blank
- Price = scraped price − 20%
- Quantity = 1
- Photo URL blank
- Condition = New
- Full BITZ’n’BOBZ HTML description
- Format = FixedPrice
