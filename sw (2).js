/* node.x relay. Keep this file next to index.html.
   Many games (ports especially) load their scripts, wasm, models and sounds from cdn.jsdelivr.net/gh/<user>/...
   jsDelivr answers 403 for some of those GitHub users (gn-math, genizy / web-ports, or files over its size limit),
   so the game stays on its loading screen. This worker catches those requests and gets the same file from GitHub
   instead, then answers with the correct Content-Type (raw.githubusercontent.com sends text/plain with nosniff,
   which browsers refuse to run as script).
   v2: per-source timeouts, Range support (audio/video seeking), and a cache so a game's files are only
   downloaded once (reloads are instant and do not hit GitHub's rate limit). */
const CACHE = "nx-relay-v3";
const OWN = "sirpizzly"; // your forks (sirpizzly/assets ...) are tried before the original gn-math repos
const TIMEOUT = 20000; // ms to wait for a source to start answering before trying the next one
const JSD = /^https?:\/\/(?:cdn|gcore|fastly|testingcf|quantil)\.jsdelivr\.net\/gh\/([^\/@]+)\/([^\/@]+)(?:@([^\/]+))?\/([^?#]+)/i;
const RAWH = /^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^?#]+)/i;
const MIME = {
  js: "text/javascript", mjs: "text/javascript", css: "text/css", html: "text/html", htm: "text/html",
  json: "application/json", map: "application/json", wasm: "application/wasm", xml: "application/xml", txt: "text/plain",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif",
  bmp: "image/bmp", svg: "image/svg+xml", ico: "image/x-icon",
  mp3: "audio/mpeg", ogg: "audio/ogg", opus: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac",
  mp4: "video/mp4", webm: "video/webm", ogv: "video/ogg",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  data: "application/octet-stream", unityweb: "application/octet-stream", bin: "application/octet-stream", pck: "application/octet-stream",
  glb: "model/gltf-binary", gltf: "model/gltf+json"
};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf("nx-relay-") === 0 && k !== CACHE).map(k => caches.delete(k))))
    .catch(() => {}).then(() => self.clients.claim())
));

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
    const tail = "/gh/" + user + "/" + repo + (ref ? "@" + ref : "") + "/" + path;
    const mirrors = ["https://fastly.jsdelivr.net", "https://gcore.jsdelivr.net", "https://cdn.jsdelivr.net"]
      .map(h => h + tail).filter(x => x !== req.url);
    const mine = user.toLowerCase() === "gn-math"
      ? ["https://cdn.jsdelivr.net/gh/" + OWN + "/" + repo + (ref ? "@" + ref : "") + "/" + path,
         "https://raw.githubusercontent.com/" + OWN + "/" + repo + "/" + (ref || "HEAD") + "/" + path]
      : [];
    const order = [mine[0]].filter(Boolean).concat([req.url], mirrors, mine.slice(1), gh); // your fork on the CDN, original on the CDN, other CDN hosts, then GitHub
    e.respondWith(relay(order, path, req));
    return;
  }
  m = RAWH.exec(req.url);
  if (m) e.respondWith(relay([req.url, "https://raw.githack.com/" + m[1] + "/" + m[2] + "/" + m[3] + "/" + m[4]], m[4], req));
});

function extOf(path) {
  const f = path.split("/").pop() || "";
  return f.indexOf(".") < 0 ? "" : f.split(".").pop().toLowerCase();
}

function headersFor(ext, upstreamType) {
  const h = new Headers();
  const t = MIME[ext] || (upstreamType && !/^text\/plain/i.test(upstreamType) ? upstreamType : "application/octet-stream");
  h.set("Content-Type", t);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Cross-Origin-Resource-Policy", "cross-origin");
  h.set("Cache-Control", "public, max-age=3600");
  return h;
}

// fetch that gives up if a source does not start answering in time (the timer stops once headers arrive)
async function get(u) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), TIMEOUT);
  try { return await fetch(u, { mode: "cors", signal: c.signal }); }
  finally { clearTimeout(t); }
}

// answer a Range request (audio/video seeking) from a full copy
function slice(blob, range, headers) {
  const m = /bytes=(\d*)-(\d*)/i.exec(range || "");
  const size = blob.size;
  if (!m || (m[1] === "" && m[2] === "")) return new Response(blob, { status: 200, headers });
  let s, e;
  if (m[1] === "") { s = Math.max(0, size - parseInt(m[2], 10)); e = size - 1; }
  else { s = parseInt(m[1], 10); e = m[2] === "" ? size - 1 : Math.min(parseInt(m[2], 10), size - 1); }
  if (s >= size || s > e) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + size } });
  headers.set("Content-Range", "bytes " + s + "-" + e + "/" + size);
  headers.set("Accept-Ranges", "bytes");
  return new Response(blob.slice(s, e + 1), { status: 206, headers });
}

async function relay(urls, path, req) {
  const ext = extOf(path), range = req.headers.get("range"), key = req.url;
  let cache = null;
  try { cache = await caches.open(CACHE); } catch (err) {}

  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const h = headersFor(ext, hit.headers.get("content-type"));
        return range ? slice(await hit.blob(), range, h) : new Response(hit.body, { status: 200, headers: h });
      }
    } catch (err) {}
  }

  for (const u of urls) {
    try {
      const r = await get(u);
      if (!r.ok) continue;
      const h = headersFor(ext, r.headers.get("content-type"));
      if (range) {
        const blob = await r.blob();
        if (cache) cache.put(key, new Response(blob, { headers: h })).catch(() => {});
        return slice(blob, range, new Headers(h));
      }
      if (cache) cache.put(key, new Response(r.clone().body, { headers: h })).catch(() => {});
      return new Response(r.body, { status: 200, headers: h });
    } catch (err) { /* timed out or blocked, try the next source */ }
  }
  return new Response("relay failed", { status: 502 });
}
