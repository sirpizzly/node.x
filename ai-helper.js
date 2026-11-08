/* ai-helper.js — adds a "Solve this page" item to the sidebar nav (#nav) + a screen-share AI panel.
   The panel lives in a shadow DOM, so it never touches your existing HTML/CSS. */
(() => {
  if (window.__aiHelperLoaded) return;
  window.__aiHelperLoaded = true;

  const script = document.currentScript;
  const ENDPOINT = (script && script.dataset.endpoint) || window.AI_HELPER_ENDPOINT || "";

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:2147483647;display:flex;flex-direction:column;align-items:flex-end;gap:6px;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      *{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
      .mini{border:0;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:600;line-height:1.4;
        background:#4f46e5;color:#fff;cursor:pointer;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.4)}
      .mini:hover{opacity:1;background:#6366f1}
      .panel{display:none;width:min(420px,calc(100vw - 32px));max-height:70vh;flex-direction:column;
        background:#16161d;color:#eee;border:1px solid #333;border-radius:12px;
        box-shadow:0 4px 24px rgba(0,0,0,.5);overflow:hidden}
      .panel.open{display:flex}
      .bar{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid #2a2a35;font-size:12px}
      .bar .status{flex:1;color:#9aa}
      .bar button,.row button{border:0;border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;
        background:#2a2a35;color:#eee}
      .bar button:hover,.row button:hover{background:#3a3a48}
      .out{flex:1;overflow:auto;padding:12px;font-size:14px;line-height:1.5;white-space:pre-wrap;min-height:90px}
      .row{display:flex;gap:6px;padding:8px;border-top:1px solid #2a2a35}
      .row input{flex:1;border:1px solid #333;background:#0f0f14;color:#eee;border-radius:6px;padding:7px 9px;font-size:13px}
      .row .go{background:#4f46e5}
      .row .go:hover{background:#6366f1}
    </style>
    <div class="panel" id="panel">
      <div class="bar">
        <span class="status" id="status">Screen not shared</span>
        <button id="share">Choose tab</button>
        <button id="stop" style="display:none">Stop</button>
        <button id="close">✕</button>
      </div>
      <div class="out" id="out">Click “Choose tab” to pick any tab or window, or just hit Q&amp;A / “Solve this page” and I’ll look at what you share and answer the questions on it.</div>
      <div class="row">
        <input id="q" placeholder="Ask about what's on screen…" />
        <button class="go" id="ask">Ask</button>
      </div>
    </div>
    <button class="mini" id="mini" title="Get the questions and answers on this page">Q&amp;A</button>`;
  const $ = (id) => root.getElementById(id);
  const panel = $("panel"), out = $("out"), statusEl = $("status"), shareBtn = $("share");

  let stream = null, busy = false;
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true;

  function setStatus() {
    const on = !!(stream && stream.active);
    statusEl.textContent = on ? "Screen shared ●" : "Screen not shared";
    shareBtn.textContent = on ? "Switch tab" : "Choose tab";
    $("stop").style.display = on ? "" : "none";
  }

  async function startShare() {
    if (stream && stream.active) return;
    // No preferCurrentTab: the browser's picker lets you choose ANY tab, window or screen.
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "browser" },
      audio: false,
      selfBrowserSurface: "include",
    });
    video.srcObject = stream;
    await video.play();
    stream.getVideoTracks()[0].addEventListener("ended", () => { stream = null; setStatus(); });
    setStatus();
  }

  function stopShare() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null; setStatus();
  }

  async function grabFrame() {
    host.style.visibility = "hidden"; // keep our own panel out of the screenshot
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 120));
    const scale = Math.min(1, 1600 / video.videoWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(video.videoWidth * scale);
    c.height = Math.round(video.videoHeight * scale);
    c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
    host.style.visibility = "visible";
    return c.toDataURL("image/jpeg", 0.8).split(",")[1];
  }

  async function run(prompt) {
    if (busy) return;
    if (!ENDPOINT) { out.textContent = "No endpoint set. Add data-endpoint=\"https://your-worker.workers.dev\" to the script tag."; return; }
    busy = true; panel.classList.add("open");
    try {
      out.textContent = "Starting screen share…";
      await startShare();
      out.textContent = "Reading your screen…";
      const image = await grabFrame();
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, prompt }),
      });
      const data = await res.json().catch(() => ({}));
      out.textContent = res.ok ? data.text : "Error: " + (data.error || res.status);
    } catch (e) {
      host.style.visibility = "visible";
      out.textContent = e.name === "NotAllowedError" ? "Screen share was cancelled. Click “Solve this page” to try again." : "Error: " + e.message;
    } finally { busy = false; }
  }

  const onNav = (e) => {
    e.preventDefault();
    if (panel.classList.contains("open") && !busy) { panel.classList.remove("open"); return; }
    run("Solve every question visible on this page.");
  };
  $("mini").onclick = () => {
    if (panel.classList.contains("open") && !busy) { panel.classList.remove("open"); return; }
    run("List every question on this page, each followed by its answer.");
  };
  $("close").onclick = () => panel.classList.remove("open");
  // "Choose tab" / "Switch tab": pick any browser tab, window or screen to look at.
  shareBtn.onclick = () => { stopShare(); startShare().catch((e) => { if (e.name !== "NotAllowedError") out.textContent = "Error: " + e.message; }); };
  $("stop").onclick = stopShare;
  const ask = () => { const v = $("q").value.trim(); if (v) { $("q").value = ""; run(v); } };
  $("ask").onclick = ask;
  $("q").addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });

  function mount() {
    document.body.appendChild(host);
    const nav = document.getElementById("nav");
    const item = document.createElement("a");
    item.className = "nl";
    item.setAttribute("role", "button");
    item.tabIndex = 0;
    item.style.cursor = "pointer";
    item.innerHTML =
      '<svg class="i nx-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>Solve this page';
    item.addEventListener("click", onNav);
    item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") onNav(e); });
    if (nav) {
      const settings = nav.querySelector('.nl[data-v="settings"]');
      nav.insertBefore(item, settings || null);
      if (typeof window.pill === "function") window.pill();
    } else {
      // no sidebar found: fall back to a small fixed button so it still works
      item.style.cssText += ";position:fixed;left:12px;bottom:12px;z-index:2147483646;padding:8px 12px;border-radius:8px;background:#222;color:#fff;display:flex;gap:8px;align-items:center";
      document.body.appendChild(item);
    }
  }
  if (document.body) mount(); else addEventListener("DOMContentLoaded", mount);
})();
