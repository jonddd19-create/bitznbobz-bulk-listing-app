const OpenAI = require("openai").default;

exports.handler = async (event) => {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = JSON.parse(event.body || "{}");
    const urls = body.urls || [];

    if (!urls.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No URLs provided" })
      };
    }

    const prompt = `Generate eBay listing data for these product URLs:\n${urls.join("\n")}`;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are a listing generator." },
        { role: "user", content: prompt }
      ]
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ result: response.choices[0].message.content })
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
