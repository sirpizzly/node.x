/* node.x sidebar layer: nav icons, vertical pill, background picker (images + animated), first-visit setup pages.
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
     its own in the wallpapers/ folder (wallpapers/1.jpg ... 9.jpg) and only then uses the kommodo link. */
  var KP = "https://plain-wnam-prod-public.komododecks.com/202611/08/";
  ["siscdUR5ei5MdtAdeLap", "I2wxxkWxKEKHTSsALurX", "5M0cTbJWqdephm8LhgjQ", "fNihGSqCDuHroL1IyDh7",
   "Un4vS4NhbMXxkEDzrcOW", "1GYC8iHH8lNmBuY4mREn", "rZzOLK1GMi33MAjkxLFk", "CUsONYwu5ajgZeqbqNK5", "n6px68aOY8ymZVNG5OTs"].forEach(function (id, i) {
    var u = KP + id + "/image.jpg", l = "wallpapers/" + (i + 1) + ".jpg";
    PRE.push({ id: "k" + (i + 1), lo: u, th: [l, u], c: [l, u] });
  });
  /* Animated wallpapers (muted looping video). They pause in Performance mode and show their first frame. */
  var VID = [
    { id: "v1", u: "https://www.image2url.com/r2/default/videos/1794165774935-5083d5e6-4e6f-43fe-923d-a3ef77162782.mp4" },
    { id: "v2", u: "https://www.image2url.com/r2/default/videos/1794165612663-bb0f9d7e-3a41-4c7e-810a-79a43b80db28.mp4" },
    { id: "v3", u: "https://www.image2url.com/r2/default/videos/1794165442322-b83f6ca0-af29-4704-b611-f043d8515007.mp4" },
    { id: "v4", u: "https://www.image2url.com/r2/default/videos/1794181670329-08b9cd83-91e8-4e23-a66b-936e80d555d5.mp4" },
    { id: "v5", u: "https://www.image2url.com/r2/default/videos/1794181733890-6f322846-5f0e-4575-b148-741bb042bac9.mp4" },
    { id: "v6", u: "https://www.image2url.com/r2/default/videos/1794182323370-5f75ac2a-c3a4-4371-bde0-3c4e1d247b6f.mp4" },
    { id: "v7", u: "https://www.image2url.com/r2/default/videos/1794181856176-23396220-cac1-44e7-a453-e8671dc56f54.mp4" },
    { id: "v8", u: "https://www.image2url.com/r2/default/videos/1794181890696-b9f25dd3-896a-4c0d-92ca-006efb7dcd67.mp4" }
  ];
  function vidOf(id) { return VID.filter(function (x) { return x.id === id; })[0]; }
  var RM = "(prefers-reduced-motion: reduce)";
  /* Why a wallpaper would be frozen: Performance mode, or the device's Reduce motion setting. "force" overrides both. */
  function why() { return document.body.classList.contains("perf") ? "Performance mode is on" : matchMedia(RM).matches ? "your device has Reduce motion turned on" : ""; }
  function isPerf() { return !st.force && !!why(); }
  var st = { bg: "none", dim: 0.45, done: false, force: false };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function say(m) { if (typeof toast === "function") toast(m); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }

  /* ----- sidebar: icons + vertical pill ----- */
  var IC = { home: "i-home", games: "i-games", credits: "i-heart", settings: "i-settings" };
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
  var vid = document.createElement("video");
  vid.muted = true; vid.defaultMuted = true; vid.loop = true; vid.playsInline = true; vid.disablePictureInPicture = true;
  vid.setAttribute("muted", ""); vid.setAttribute("playsinline", ""); vid.setAttribute("aria-hidden", "true"); vid.tabIndex = -1;
  layer.append(img, vid); document.body.prepend(layer);
  var ci = 0, curId = null;
  function cands(id) {
    if (id === "up") { var u = null; try { u = localStorage.getItem(UP); } catch (e) {} return u ? [u] : []; }
    var p = PRE.filter(function (x) { return x.id === id; })[0]; return p ? p.c : [];
  }
  function stopVid() {
    vid.onloadeddata = vid.onerror = null;
    if (vid.getAttribute("src")) { vid.pause(); vid.removeAttribute("src"); vid.load(); }
  }
  function unlock() {
    document.removeEventListener("pointerdown", unlock, true); document.removeEventListener("keydown", unlock, true);
    if (vidOf(st.bg) && vid.getAttribute("src") && !isPerf() && !inGame()) { var q = vid.play(); if (q && q.catch) q.catch(function () {}); }
  }
  /* a game is open (library player or mini game): the wallpaper stays paused so the game gets the full CPU/GPU */
  function inGame() { var a = document.getElementById("player"), b = document.getElementById("stage"); return !!((a && !a.hidden) || (b && !b.hidden)); }
  function playVid() {
    if (inGame()) { vid.pause(); updStat(); return; }
    if (isPerf()) { vid.pause(); try { if (vid.currentTime > 0) vid.currentTime = 0; } catch (e) {} updStat(); return; }
    var p = vid.play();
    if (p && p.catch) p.catch(function () { /* browser blocked autoplay: start on the next click or key press */
      document.addEventListener("pointerdown", unlock, true); document.addEventListener("keydown", unlock, true); updStat(); });
  }
  function statText() {
    var v = vidOf(st.bg);
    if (!v) return "Pick an animated wallpaper above to see it move.";
    if (vid.error) return "Could not load this video (" + (vid.error.code === 4 ? "format not supported or blocked by its host" : "playback error") + ").";
    if (vid.readyState < 2) return "Loading video...";
    if (!vid.paused) return "Playing.";
    var w = why();
    return w && !st.force ? "Paused because " + w + ". Turn on \u201cPlay in Performance mode\u201d below to play it anyway." : "Paused. Click anywhere on the page to start it.";
  }
  function updStat() { document.querySelectorAll(".nx-vstat").forEach(function (e) { e.textContent = statText(); }); }
  ["play", "pause", "playing", "waiting", "loadeddata", "canplay", "seeked", "error", "emptied"].forEach(function (ev) { vid.addEventListener(ev, updStat); });
  function applyBg() {
    layer.style.setProperty("--nx-dim", st.dim);
    var v = vidOf(st.bg);
    if (v) {
      layer.classList.add("is-vid"); curId = st.bg; img.dataset.s = ""; img.removeAttribute("src");
      vid.preload = "auto";
      if (vid.getAttribute("src") !== v.u) {
        layer.classList.remove("on");
        vid.onloadeddata = function () { layer.classList.add("on"); root.classList.add("has-bg"); playVid(); };
        vid.onerror = function () {
          if (!vid.getAttribute("src")) return;
          var code = vid.error && vid.error.code;
          say("That animated wallpaper could not load" + (code === 4 ? " (format not supported or blocked by its host)." : ".")); stopVid(); st.bg = "none"; curId = null; save(); applyBg(); sync();
        };
        vid.src = v.u;
      } else { layer.classList.add("on"); root.classList.add("has-bg"); playVid(); }
      return;
    }
    layer.classList.remove("is-vid"); stopVid();
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
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { var t = e.target; if (t.dataset.src) { t.src = t.dataset.src; delete t.dataset.src; } io.unobserve(t); } });
  }) : null;
  function picker() {
    var box = mk("div"), grid = mk("div", "nx-pick"), vgrid = mk("div", "nx-pick"), acts = mk("div", "nx-acts");
    PRE.forEach(function (p, i) {
      var b = mk("button", "nx-th"), im = new Image();
      b.type = "button"; b.dataset.id = p.id; b.setAttribute("aria-label", "Background " + (i + 1));
      im.alt = ""; im.referrerPolicy = "no-referrer"; im.loading = "lazy"; var tl = p.th || [p.lo], ti = 0; im.onerror = function () { if (++ti < tl.length) im.src = tl[ti]; }; im.src = tl[0];
      b.appendChild(im); b.onclick = function () { setBg(p.id); }; grid.appendChild(b);
    });
    VID.forEach(function (p, i) {
      var b = mk("button", "nx-th vid"), tv = document.createElement("video");
      b.type = "button"; b.dataset.id = p.id; b.setAttribute("aria-label", "Animated background " + (i + 1));
      tv.muted = true; tv.loop = true; tv.playsInline = true; tv.preload = "metadata"; tv.tabIndex = -1; tv.setAttribute("aria-hidden", "true");
      tv.dataset.src = p.u + "#t=0.1"; if (io) io.observe(tv); else { tv.src = tv.dataset.src; delete tv.dataset.src; }
      b.appendChild(tv);
      b.onmouseenter = function () { if (!isPerf()) { var q = tv.play(); if (q && q.catch) q.catch(function () {}); } };
      b.onmouseleave = function () { tv.pause(); };
      b.onclick = function () { setBg(p.id); }; vgrid.appendChild(b);
    });
    var up = mk("button", "btn nx-up", "Upload your own"), no = mk("button", "btn nx-none", "None");
    up.type = no.type = "button"; up.onclick = function () { file.click(); }; no.onclick = function () { setBg("none"); };
    acts.append(up, no);
    box.append(mk("div", "nx-lab", "Images"), grid, mk("div", "nx-lab", "Animated"), vgrid, mk("p", "nx-vstat", statText()), acts);
    pickers.push(box); return box;
  }
  function sync() {
    pickers = pickers.filter(function (p) { return p.isConnected; });
    pickers.forEach(function (p) {
      p.querySelectorAll(".nx-th").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.id === st.bg); });
      var u = p.querySelector(".nx-up"), n = p.querySelector(".nx-none");
      if (u) u.setAttribute("aria-pressed", st.bg === "up"); if (n) n.setAttribute("aria-pressed", st.bg === "none");
    });
    document.querySelectorAll("input.nx-dim").forEach(function (i) { i.value = st.dim; });
    document.querySelectorAll("input.nx-force").forEach(function (i) { i.checked = !!st.force; });
    updStat();
  }

  /* ----- first-visit setup: full pages. Page 1 is Performance mode on its own. ----- */
  function setup() {
    if (document.getElementById("nx-setup")) return;
    var pg = mk("div", "nx-page"), box = mk("div", "nx-pg"), dots = mk("div", "nx-dots"), body = mk("div"), foot = mk("div", "nx-foot");
    pg.id = "nx-setup"; pg.setAttribute("role", "dialog"); pg.setAttribute("aria-modal", "true"); pg.setAttribute("aria-label", "node.x setup");
    var back = mk("button", "btn", "Back"), skip = mk("button", "link", "Skip setup"), next = mk("button", "btn primary", "Next");
    back.type = skip.type = next.type = "button"; skip.style.cssText = "background:none;border:0;cursor:pointer";
    foot.append(back, mk("span", "sp"), skip, next);
    box.append(dots, body, foot); pg.appendChild(box);
    var cur = 0;

    function chipRow(map, key, extra) {
      var row = mk("div", "acts");
      Object.keys(map).forEach(function (k) {
        var v = map[k], b = mk("button", "chip", Array.isArray(v) ? v[0] : v); b.type = "button"; b.dataset.v = k;
        b.onclick = function () { S.look[key] = k; apply(); paint(); }; row.appendChild(b);
      });
      function paint() { row.querySelectorAll(".chip").forEach(function (b) { b.classList.toggle("on", b.dataset.v === S.look[key]); }); }
      paint(); return row;
    }

    var steps = [
      function perfPage() {
        var w = mk("div", "nx-step", "<h2>How should node.x run?</h2><p class=\"nx-sub\">Pick what fits your device. You can change this any time in Settings.</p>");
        var grid = mk("div", "nx-opts");
        function opt(t, d, val, tag) {
          var c = mk("button", "nx-opt", "<b>" + t + "</b><span>" + d + "</span>" + (tag ? "<em>" + tag + "</em>" : ""));
          c.type = "button"; c.onclick = function () { S.perf = val; apply(); paint(); }; return c;
        }
        var full = opt("Full effects", "Smooth animations, blur and animated wallpapers. Best on a normal computer.", false, "");
        var perf = opt("Performance mode", "Turns off animations, blur and moving wallpapers. Pick this if the site feels slow or your device is old.", true, "Best for slow devices");
        function paint() { full.setAttribute("aria-pressed", !S.perf); perf.setAttribute("aria-pressed", !!S.perf); }
        paint(); grid.append(full, perf); w.appendChild(grid); return w;
      },
      function bgPage() {
        var w = mk("div", "nx-step", "<h2>Pick a background</h2><p class=\"nx-sub\">The page behind this one shows your choice. Animated ones move, and pause if you chose Performance mode.</p>");
        var sc = mk("div", "nx-scroll"); sc.appendChild(picker()); w.appendChild(sc);
        var r = mk("label", "srow", "<div><b>Dim</b><small>Darken the wallpaper so text is easier to read.</small></div>");
        var rg = mk("input", "nx-dim"); rg.type = "range"; rg.min = 0; rg.max = 0.8; rg.step = 0.05; rg.value = st.dim;
        rg.oninput = function () { st.dim = +rg.value; layer.style.setProperty("--nx-dim", st.dim); save(); };
        r.appendChild(rg); w.appendChild(r); sync(); return w;
      },
      function lookPage() {
        var w = mk("div", "nx-step", "<h2>Make it easy to read</h2><p class=\"nx-sub\">Choose a font and text size. More options are in Settings.</p>");
        var g1 = mk("div", "nx-grp", "<b>Font</b>"); g1.appendChild(chipRow(FONTS, "font"));
        var g2 = mk("div", "nx-grp", "<b>Text size</b>"); g2.appendChild(chipRow(TXT, "txt"));
        var g3 = mk("label", "srow", "<div><b>High contrast text</b><small>Brighter text with a dark outline.</small></div>");
        var sw = mk("input"); sw.type = "checkbox"; sw.setAttribute("role", "switch"); sw.checked = !!S.look.hc;
        sw.onchange = function () { S.look.hc = sw.checked; apply(); }; g3.appendChild(sw);
        w.append(g1, g2, g3); return w;
      }
    ];

    function render() {
      dots.innerHTML = ""; steps.forEach(function (_, i) { dots.appendChild(mk("i", i <= cur ? "on" : "")); });
      body.innerHTML = ""; body.appendChild(steps[cur]());
      pg.classList.toggle("peek", cur === 1);
      back.style.visibility = cur ? "visible" : "hidden";
      next.textContent = cur === steps.length - 1 ? "Finish" : "Next";
      var f = body.querySelector("button"); if (f) f.focus({ preventScroll: true });
    }
    function shut() {
      st.done = true; save(); document.body.style.overflow = ""; document.removeEventListener("keydown", key, true);
      pg.remove(); sync();
    }
    function key(e) { if (e.key === "Escape") { e.preventDefault(); shut(); } }
    back.onclick = function () { if (cur) { cur--; render(); } };
    next.onclick = function () { if (cur < steps.length - 1) { cur++; render(); } else shut(); };
    skip.onclick = shut;
    document.addEventListener("keydown", key, true);
    document.body.style.overflow = "hidden"; document.body.appendChild(pg); render();
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
    var rf = mk("label", "srow", "<div><b>Play in Performance mode</b><small>Keep animated wallpapers moving even when Performance mode is on or your device asks to reduce motion.</small></div>");
    var fc = mk("input", "nx-force"); fc.type = "checkbox"; fc.setAttribute("role", "switch"); fc.checked = !!st.force;
    fc.onchange = function () {
      st.force = fc.checked; save();
      if (vidOf(st.bg) && vid.getAttribute("src")) { vid.preload = "auto"; playVid(); }
      sync();
    };
    rf.appendChild(fc);
    var r3 = mk("div", "srow", "<div><b>Setup</b><small>Open the welcome menu again.</small></div>");
    var again = mk("button", "btn", "Run setup"); again.type = "button"; again.onclick = setup; r3.appendChild(again);
    panel.append(r1, r2, rf, r3); sec.appendChild(panel); sets.insertBefore(sec, sets.children[1] || null);
  }

  /* ----- load-in intro: the overlay is in index.html and hides itself with CSS; this just cleans up ----- */
  var intro = document.getElementById("nx-intro");
  function introDone() { root.classList.add("intro-done"); if (intro && intro.parentNode) intro.remove(); }
  var skip = !intro || root.classList.contains("no-intro") || document.body.classList.contains("perf") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (skip) introDone();
  else {
    setTimeout(function () { if (intro.parentNode) intro.remove(); }, 2200);
    setTimeout(function () { root.classList.add("intro-done"); }, 3400);
    intro.addEventListener("click", introDone);
  }

  /* when Performance mode flips, pause or resume the animated wallpaper */
  if (typeof window.apply === "function") {
    var _apply = window.apply;
    window.apply = function () { var r = _apply.apply(this, arguments); try { if (vidOf(st.bg) && vid.getAttribute("src")) { vid.preload = "auto"; playVid(); } } catch (e) {} return r; };
  }
  /* pause when a game opens, resume when it closes */
  ["player", "stage"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) new MutationObserver(function () { if (vidOf(st.bg) && vid.getAttribute("src")) { if (inGame()) { vid.pause(); updStat(); } else playVid(); } }).observe(el, { attributes: true, attributeFilter: ["hidden"] });
  });
  document.addEventListener("visibilitychange", function () { if (!vidOf(st.bg) || !vid.getAttribute("src")) return; if (document.hidden) vid.pause(); else playVid(); });

  applyBg(); sync(); window.pill();
  if (!st.done) setTimeout(setup, skip ? 500 : 2400);
})();
