# BITZ’n’BOBZ eBay UK Draft Pack Builder (Netlify)

This app takes product URLs (Amazon/other), scrapes title/bullets/price, enriches with OpenAI,
and outputs an eBay UK **12-column Draft Pack** + optional ZIP of product images.

## 🚀 Deploy to Netlify

1. Push this repo to GitHub (or drag/drop into Netlify).
2. In Netlify → *Site settings* → *Environment variables*, add:
Environment variables to add in Netlify:

- OPENAI_API_KEY
- SCRAPINGBEE_API_KEY
- OPENAI_MODEL_NAME = gpt-4o-mini

3. Deploy.  
Netlify will build the React app and your serverless function automatically.

## 🛠 Local Development

```bash
npm install
npm start
