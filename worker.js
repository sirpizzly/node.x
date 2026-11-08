// Cloudflare Worker: keeps your API key private and forwards screenshots to DeepSeek (deepseek-flash).
// Secrets/vars: DEEPSEEK_API_KEY (secret), ALLOWED_ORIGIN (e.g. https://yoursite.com)
const SYSTEM = `You are a tutor looking at a screenshot of a web page.
Find every question or problem visible. For each one, give the answer first, then a short explanation.
Number them in the order they appear. If no question is visible, say what you see and ask what to help with.`;

export default {
  async fetch(req, env) {
    const allowed = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    if (allowed !== "*" && req.headers.get("Origin") !== allowed) return json({ error: "Origin not allowed" }, 403);

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
        model: "deepseek-flash",
        max_tokens: 1500,
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
    return json({ text: data.choices?.[0]?.message?.content || "No answer returned." });
  },
};
