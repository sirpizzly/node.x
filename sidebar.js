/* node.x sidebar layer: nav icons, vertical pill, background picker, first-visit setup menu.
   Load AFTER your main <script>. Uses your existing S, apply(), toast() and Performance mode. */
(function () {
  "use strict";
  var KEY = "nx_look", UP = "nx_bgup", root = document.documentElement;
  var PRE = [
    { id: "p1", url: "https://i.pinimg.com/1200x/6c/12/69/6c1269afc479c6324f1942d7e9300897.jpg" },
    { id: "p2", url: "https://i.pinimg.com/736x/74/38/fd/7438fd83bc70e8e77b9be9fddc20c5ce.jpg" },
    { id: "p3", url: "https://i.pinimg.com/736x/f5/ff/25/f5ff255ec5ffed5135d997583f19ca5f.jpg" }
  ];
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
  function bgSrc() {
    if (st.bg === "up") { try { return localStorage.getItem(UP); } catch (e) { return null; } }
    var p = PRE.filter(function (x) { return x.id === st.bg; })[0]; return p ? p.url : null;
  }
  function applyBg() {
    layer.style.setProperty("--nx-dim", st.dim);
    var src = bgSrc();
    if (!src) { layer.classList.remove("on"); root.classList.remove("has-bg"); return; }
    img.onload = function () { layer.classList.add("on"); root.classList.add("has-bg"); };
    img.onerror = function () { say("That background could not load. Try Upload instead."); st.bg = "none"; save(); applyBg(); sync(); };
    if (img.dataset.s === src && img.complete) { img.onload(); return; }
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
        var k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = mk("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        try { localStorage.setItem(UP, c.toDataURL("image/jpeg", 0.82)); img.dataset.s = ""; setBg("up"); }
        catch (x) { say("That image is too big to save. Try a smaller one."); }
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
      im.src = p.url; im.alt = ""; im.referrerPolicy = "no-referrer"; im.loading = "lazy";
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

  applyBg(); sync(); window.pill();
  if (!st.done) setTimeout(setup, 500);
})();
