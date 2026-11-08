// Cloudflare Worker: keeps your API key private and forwards screenshots to DeepSeek (deepseek-flash).
// Secrets/vars: DEEPSEEK_API_KEY (secret), ALLOWED_ORIGIN (e.g. https://yoursite.com)
const SYSTEM = `You are a tutor looking at a screenshot of a web page.
Find every question or problem visible and reply in this exact format, in the order they appear:
Q1: <the question, copied briefly>
A1: <the answer>
Why: <one short sentence of explanation>
Then Q2/A2/Why, and so on. If no question is visible, say what you see and ask what to help with.`;

export default {
  async fetch(req, env) {
    try { return await handle(req, env); }
    catch (e) {
      return new Response(JSON.stringify({ error: "Worker error: " + e.message }), { status: 500, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
    }
  },
};

async function handle(req, env) {
  {
    // ALLOWED_ORIGIN can be a comma-separated list, e.g. https://yoursite.com,chrome-extension://YOUR_ID
    const list = (env.ALLOWED_ORIGIN || "*").split(",").map((x) => x.trim()).filter(Boolean);
    const anyOrigin = list.includes("*");
    const origin = req.headers.get("Origin") || "";
    const originOk = anyOrigin || list.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": anyOrigin ? "*" : originOk ? origin : list[0],
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    if (!originOk) return json({ error: "Origin not allowed" }, 403);

    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
    const { image, prompt } = body;
    if (!image || image.length > 8_000_000) return json({ error: "Missing or oversized image" }, 400);

    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + env.DEEPSEEK_API_KEY,
      },
      body: JSON.stringify({
        model: "deepseek-flash",      // DeepSeek's current official model that accepts images
        thinking: { type: "enabled" }, // reasoning on = better answers (on by default)
        reasoning_effort: "high",
        max_tokens: 8000,              // thinking tokens count toward this, so keep it generous
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: String(prompt || "Solve every question on this page.").slice(0, 2000) },
              { type: "image_url", image_url: { url: "data:image/jpeg;base64," + image } },
            ],
          },
        ],
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data.error?.message || "API error " + r.status }, 502);
    const choice = data.choices?.[0];
    const text = choice?.message?.content;
    if (!text) return json({ error: choice?.finish_reason === "length" ? "The model ran out of room before answering. Try again." : "No answer returned." }, 502);
    return json({ text });
  }
}
