/* ai-helper.js — adds "Solve this page" to the sidebar (#nav) and a small Q&A tab.
   Both open ai.html in a small popup window parked in the bottom-right corner of your screen.
   Options on the <script> tag:  data-endpoint="https://your-worker.workers.dev"   data-popup="ai.html" */
(() => {
  if (window.__aiHelperLoaded) return;
  window.__aiHelperLoaded = true;

  const script = document.currentScript;
  const ENDPOINT = (script && script.dataset.endpoint) || window.AI_HELPER_ENDPOINT || "";
  const PAGE = (script && script.dataset.popup) || "ai.html";
  const W = 380, H = 520;
  let win = null;

  function openPopup(e) {
    if (e) e.preventDefault();
    if (win && !win.closed) { win.focus(); return; }
    const left = (screen.availLeft || 0) + screen.availWidth - W - 8;
    const top = (screen.availTop || 0) + screen.availHeight - H - 8;
    const url = new URL(PAGE, script ? script.src : location.href);
    if (ENDPOINT) url.searchParams.set("e", ENDPOINT);
    win = window.open(url.href, "nx-ai-helper", `popup=yes,width=${W},height=${H},left=${left},top=${top}`);
    if (!win) alert("Your browser blocked the popup. Allow popups for this site and click again.");
  }

  function mount() {
    // small Q&A tab, bottom-right (isolated in a shadow DOM so it can't clash with your CSS)
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:2147483647;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      button{border:0;border-radius:8px;padding:4px 10px;font:600 12px/1.4 system-ui,sans-serif;background:#4f46e5;color:#fff;
        cursor:pointer;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.4)}
      button:hover{opacity:1;background:#6366f1}</style>
      <button title="Get the questions and answers">Q&amp;A</button>`;
    root.querySelector("button").onclick = openPopup;
    document.body.appendChild(host);

    // sidebar item, just above Settings
    const nav = document.getElementById("nav");
    if (nav) {
      const item = document.createElement("a");
      item.className = "nl";
      item.setAttribute("role", "button");
      item.tabIndex = 0;
      item.style.cursor = "pointer";
      item.innerHTML =
        '<svg class="i nx-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>Solve this page';
      item.addEventListener("click", openPopup);
      item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") openPopup(e); });
      nav.insertBefore(item, nav.querySelector('.nl[data-v="settings"]') || null);
      if (typeof window.pill === "function") window.pill();
    }
  }
  if (document.body) mount(); else addEventListener("DOMContentLoaded", mount);
})();
