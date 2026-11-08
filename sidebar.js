/* node.x sidebar layer: nav icons, vertical pill, background picker, first-visit setup menu.
   Load AFTER your main <script>. Uses your existing S, apply(), toast() and Performance mode. */
(function () {
  "use strict";
  var KEY = "nx_look", UP = "nx_bgup", root = document.documentElement;
  /* Pinterest keeps the full-size file under /originals/. The extension of the original can differ,
     so each background tries .jpg, .png, .webp, then falls back to the smaller copies. */
  function pin(path, big, small) {
    var o = "https://i.pinimg.com/originals/" + path;
    return { lo: "https://i.pinimg.com/" + small + "/" + path + ".jpg",
      c: [o + ".jpg", o + ".png", o + ".webp", "https://i.pinimg.com/" + big + "/" + path + ".jpg", "https://i.pinimg.com/" + small + "/" + path + ".jpg"] };
  }
  var PRE = [
    Object.assign({ id: "p1" }, pin("6c/12/69/6c1269afc479c6324f1942d7e9300897", "1200x", "1200x")),
    Object.assign({ id: "p2" }, pin("74/38/fd/7438fd83bc70e8e77b9be9fddc20c5ce", "736x", "736x")),
    Object.assign({ id: "p3" }, pin("f5/ff/25/f5ff255ec5ffed5135d997583f19ca5f", "736x", "736x"))
  ];
  /* Wallpapers shared from kommodo.ai. Those links expire on 8 Dec 2026, so each one first looks for a copy of
     its own in the wallpapers/ folder (wallpapers/1.jpg ... 8.jpg) and only then uses the kommodo link. */
  var KP = "https://plain-wnam-prod-public.komododecks.com/202611/08/";
  ["siscdUR5ei5MdtAdeLap", "I2wxxkWxKEKHTSsALurX", "5M0cTbJWqdephm8LhgjQ", "fNihGSqCDuHroL1IyDh7",
   "Un4vS4NhbMXxkEDzrcOW", "1GYC8iHH8lNmBuY4mREn", "rZzOLK1GMi33MAjkxLFk", "CUsONYwu5ajgZeqbqNK5"].forEach(function (id, i) {
    var u = KP + id + "/image.jpg", l = "wallpapers/" + (i + 1) + ".jpg";
    PRE.push({ id: "k" + (i + 1), lo: u, th: [l, u], c: [l, u] });
  });
  var st = { bg: "none", dim: 0.35, done: false };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function say(m) { if (typeof toast === "function") toast(m); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }

  /* ----- sidebar: icons + vertical pill ----- */
  var IC = { home: "i-home", games: "i-games", settings: "i-settings" };
  document.querySelectorAll("#nav .nl").forEach(function (a) {
    var id = IC[a.dataset.v];
    if (id) a.insertAdjacentHTML("afterbegin", '<svg class="i nx-ic" aria-hidden="true"><use href="#' + id + '"/></svg>');
  });
  var wide = matchMedia("(min-width:900px)");
  window.pill = function () {
    var c = document.querySelector(".nl.act") || document.querySelector(".nl"), p = document.getElementById("pill");
    if (!c || !p) return;
    if (wide.matches) { p.style.width = ""; p.style.transform = "translateY(" + c.offsetTop + "px)"; p.style.height = c.offsetHeight + "px"; }
    else { p.style.height = ""; p.style.transform = "translateX(" + c.offsetLeft + "px)"; p.style.width = c.offsetWidth + "px"; }
  };
  addEventListener("resize", function () { window.pill(); });

  /* ----- background layer ----- */
  var layer = mk("div"); layer.id = "nx-bg";
  var img = new Image(); img.alt = ""; img.referrerPolicy = "no-referrer"; img.decoding = "async";
  layer.appendChild(img); document.body.prepend(layer);
  var ci = 0, curId = null;
  function cands(id) {
    if (id === "up") { var u = null; try { u = localStorage.getItem(UP); } catch (e) {} return u ? [u] : []; }
    var p = PRE.filter(function (x) { return x.id === id; })[0]; return p ? p.c : [];
  }
  function applyBg() {
    layer.style.setProperty("--nx-dim", st.dim);
    var list = cands(st.bg);
    if (!list.length) { curId = null; layer.classList.remove("on"); root.classList.remove("has-bg"); return; }
    if (curId !== st.bg) { curId = st.bg; ci = 0; img.dataset.s = ""; }
    var src = list[Math.min(ci, list.length - 1)];
    img.onload = function () { layer.classList.add("on"); root.classList.add("has-bg"); };
    img.onerror = function () {
      if (ci < list.length - 1) { ci++; img.dataset.s = ""; applyBg(); return; }
      say("That background could not load. Try Upload instead."); st.bg = "none"; curId = null; save(); applyBg(); sync();
    };
    if (img.dataset.s === src && img.complete && img.naturalWidth) { img.onload(); return; }
    img.dataset.s = src; img.src = src;
  }
  function setBg(id) { st.bg = id; save(); applyBg(); sync(); }

  var file = mk("input"); file.type = "file"; file.accept = "image/*"; file.hidden = true; document.body.appendChild(file);
  file.onchange = function () {
    var f = file.files[0]; file.value = ""; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var im = new Image();
      im.onload = function () {
        var tries = [[2560, 0.92], [1920, 0.88], [1600, 0.82], [1280, 0.8]], saved = false;
        for (var t = 0; t < tries.length && !saved; t++) {
          var k = Math.min(1, tries[t][0] / Math.max(im.width, im.height)), c = mk("canvas");
          c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          var cx = c.getContext("2d"); cx.imageSmoothingQuality = "high"; cx.drawImage(im, 0, 0, c.width, c.height);
          try { localStorage.setItem(UP, c.toDataURL("image/jpeg", tries[t][1])); saved = true; } catch (x) {}
        }
        if (saved) { img.dataset.s = ""; setBg("up"); } else say("That image is too big to save. Try a smaller one.");
      };
      im.onerror = function () { say("That file is not an image."); };
      im.src = r.result;
    };
    r.readAsDataURL(f);
  };

  var pickers = [];
  function picker() {
    var box = mk("div"), grid = mk("div", "nx-pick"), acts = mk("div", "nx-acts");
    PRE.forEach(function (p, i) {
      var b = mk("button", "nx-th"), im = new Image();
      b.type = "button"; b.dataset.id = p.id; b.setAttribute("aria-label", "Background " + (i + 1));
      im.alt = ""; im.referrerPolicy = "no-referrer"; im.loading = "lazy"; var tl = p.th || [p.lo], ti = 0; im.onerror = function () { if (++ti < tl.length) im.src = tl[ti]; }; im.src = tl[0];
      b.appendChild(im); b.onclick = function () { setBg(p.id); }; grid.appendChild(b);
    });
    var up = mk("button", "btn nx-up", "Upload your own"), no = mk("button", "btn nx-none", "None");
    up.type = no.type = "button"; up.onclick = function () { file.click(); }; no.onclick = function () { setBg("none"); };
    acts.append(up, no); box.append(grid, acts); pickers.push(box); return box;
  }
  function sync() {
    pickers = pickers.filter(function (p) { return p.isConnected; });
    pickers.forEach(function (p) {
      p.querySelectorAll(".nx-th").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.id === st.bg); });
      var u = p.querySelector(".nx-up"), n = p.querySelector(".nx-none");
      if (u) u.setAttribute("aria-pressed", st.bg === "up"); if (n) n.setAttribute("aria-pressed", st.bg === "none");
    });
    document.querySelectorAll("input.nx-dim").forEach(function (i) { i.value = st.dim; });
  }

  /* ----- setup menu (first visit). Performance mode = your existing S.perf ----- */
  function setup() {
    if (document.getElementById("nx-setup")) return;
    var d = mk("dialog", "modal"), b = mk("div", "m-body", "<h2>Welcome to node.x</h2><p>Pick a background and a mode. You can change both later in Settings.</p>");
    d.id = "nx-setup";
    var pk = picker(); pk.style.marginTop = "16px";
    var row = mk("label", "srow", "<div><b>Performance mode</b><small>Turns off animation. Try it if the site feels slow.</small></div>");
    var sw = mk("input"); sw.type = "checkbox"; sw.setAttribute("role", "switch"); sw.checked = !!S.perf;
    sw.onchange = function () { S.perf = sw.checked; apply(); };
    row.appendChild(sw);
    var acts = mk("div", "acts"), done = mk("button", "btn primary", "Done"); done.type = "button"; acts.appendChild(done);
    b.append(pk, row, acts); d.appendChild(b); document.body.appendChild(d);
    function shut() {
      if (d.classList.contains("closing")) return;
      var end = function () { d.classList.remove("closing"); d.close(); };
      d.classList.add("closing");
      if (getComputedStyle(d).animationName === "none") return end();
      d.addEventListener("animationend", end, { once: true });
    }
    d.addEventListener("cancel", function (e) { e.preventDefault(); shut(); });
    d.addEventListener("click", function (e) { if (e.target === d) shut(); });
    d.addEventListener("close", function () { st.done = true; save(); d.remove(); sync(); });
    done.onclick = shut; d.showModal(); sync();
  }

  /* ----- Settings: Background section ----- */
  var sets = document.querySelector("#v-settings .sets");
  if (sets) {
    var sec = mk("section", "", "<h3>Background</h3>"), panel = mk("div", "s-panel");
    var r1 = mk("div", "srow col", "<div><b>Image</b><small>Shows behind the whole site.</small></div>"); r1.appendChild(picker());
    var r2 = mk("label", "srow", "<div><b>Dim</b><small>Darken the image so text is easier to read.</small></div>");
    var rg = mk("input", "nx-dim"); rg.type = "range"; rg.min = 0; rg.max = 0.8; rg.step = 0.05;
    rg.oninput = function () { st.dim = +rg.value; layer.style.setProperty("--nx-dim", st.dim); save(); };
    r2.appendChild(rg);
    var r3 = mk("div", "srow", "<div><b>Setup</b><small>Open the welcome menu again.</small></div>");
    var again = mk("button", "btn", "Run setup"); again.type = "button"; again.onclick = setup; r3.appendChild(again);
    panel.append(r1, r2, r3); sec.appendChild(panel); sets.insertBefore(sec, sets.children[1] || null);
  }

  /* ----- load-in intro: the overlay is in index.html and hides itself with CSS; this just cleans up ----- */
  var intro = document.getElementById("nx-intro");
  function introDone() { root.classList.add("intro-done"); if (intro && intro.parentNode) intro.remove(); }
  var skip = !intro || document.body.classList.contains("perf") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (skip) introDone();
  else {
    setTimeout(function () { if (intro.parentNode) intro.remove(); }, 2200);
    setTimeout(function () { root.classList.add("intro-done"); }, 3400);
    intro.addEventListener("click", introDone);
  }

  applyBg(); sync(); window.pill();
  if (!st.done) setTimeout(setup, skip ? 500 : 2400);
})();
