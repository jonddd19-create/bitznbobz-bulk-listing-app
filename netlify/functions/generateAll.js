import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function handler(event) {
  try {
    const { prompt } = JSON.parse(event.body);

    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: "You generate SEO eBay listings and HTML layouts for BITZ’n’BOBZ." },
        { role: "user", content: prompt }
      ],
      max_tokens: 4000,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ text: response.choices[0].message.content })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
