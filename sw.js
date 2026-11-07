/* node.x relay. Keep this file next to index.html.
   Many games (ports especially) load their scripts, wasm, models and sounds from cdn.jsdelivr.net/gh/<user>/...
   jsDelivr answers 403 for some of those GitHub users (gn-math, and likely genizy / web-ports), so the game
   stays on its loading screen. This worker catches those requests and gets the same file from GitHub instead,
   then answers with the correct Content-Type (raw.githubusercontent.com sends text/plain with nosniff, which
   browsers refuse to run as script). It also fixes the type of raw.githubusercontent.com requests directly. */
const JSD = /^https?:\/\/(?:cdn|gcore|fastly|testingcf|quantil)\.jsdelivr\.net\/gh\/([^\/@]+)\/([^\/@]+)(?:@([^\/]+))?\/([^?#]+)/i;
const RAWH = /^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^?#]+)/i;
const BLOCKED = ["gn-math", "genizy", "web-ports"]; // go to GitHub first; everyone else tries jsDelivr first
const MIME = {
  js: "text/javascript", mjs: "text/javascript", css: "text/css", html: "text/html", htm: "text/html",
  json: "application/json", wasm: "application/wasm", xml: "application/xml", txt: "text/plain",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  ico: "image/x-icon", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4", mp4: "video/mp4",
  webm: "video/webm", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  data: "application/octet-stream", unityweb: "application/octet-stream", bin: "application/octet-stream",
  glb: "model/gltf-binary", gltf: "model/gltf+json"
};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.mode === "navigate") return;
  let m = JSD.exec(req.url);
  if (m) {
    if (/\/$/.test(m[4])) return;
    const [, user, repo, ref, path] = m;
    const gh = [
      "https://raw.githubusercontent.com/" + user + "/" + repo + "/" + (ref || "HEAD") + "/" + path,
      "https://raw.githack.com/" + user + "/" + repo + "/" + (ref || "HEAD") + "/" + path
    ];
    const order = BLOCKED.includes(user.toLowerCase()) ? gh.concat([req.url]) : [req.url].concat(gh);
    e.respondWith(relay(order, path));
    return;
  }
  m = RAWH.exec(req.url);
  if (m) e.respondWith(relay([req.url, "https://raw.githack.com/" + m[1] + "/" + m[2] + "/" + m[3] + "/" + m[4]], m[4]));
});

async function relay(urls, path) {
  const ext = (path.split(".").pop() || "").toLowerCase();
  for (const u of urls) {
    try {
      const r = await fetch(u, { mode: "cors" });
      if (!r.ok) continue;
      const h = new Headers();
      h.set("Content-Type", MIME[ext] || r.headers.get("content-type") || "application/octet-stream");
      h.set("Access-Control-Allow-Origin", "*");
      h.set("Cache-Control", "public, max-age=3600");
      return new Response(r.body, { status: 200, headers: h });
    } catch (err) { /* try the next source */ }
  }
  return new Response("relay failed", { status: 502 });
}
