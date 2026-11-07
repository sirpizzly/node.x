/* node.x mono layer: animated dropdowns. Load AFTER the main script.
   The original <select> stays in the DOM (hidden), so apply(), .value and onchange keep working. */
(function () {
  "use strict";
  var valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");

  function upgrade(sel) {
    if (sel.dataset.dd) return;
    sel.dataset.dd = "1";

    var wrap = document.createElement("div"), btn = document.createElement("button"),
        lab = document.createElement("span"), chev = document.createElement("i"),
        list = document.createElement("div"), host = sel.closest(".sp"), hi = -1;
    wrap.className = "dd"; btn.type = "button"; btn.className = "dd-btn";
    btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    chev.className = "dd-chev"; chev.setAttribute("aria-hidden", "true");
    list.className = "dd-list"; list.setAttribute("role", "listbox");
    btn.append(lab, chev);

    var opts = Array.prototype.map.call(sel.options, function (o, i) {
      var d = document.createElement("div");
      d.className = "dd-opt"; d.setAttribute("role", "option");
      d.dataset.v = o.value; d.textContent = o.text; d.style.setProperty("--i", i);
      list.appendChild(d); return d;
    });

    sel.parentNode.insertBefore(wrap, sel);
    wrap.append(btn, list, sel);
    sel.classList.add("dd-native"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");

    function sync() {
      var cur = sel.value, o = sel.options[sel.selectedIndex];
      lab.textContent = o ? o.text : "";
      opts.forEach(function (d) {
        var on = d.dataset.v === cur;
        d.classList.toggle("sel", on); d.setAttribute("aria-selected", on);
      });
    }
    // apply() sets sel.value directly (no event), so mirror programmatic changes too
    Object.defineProperty(sel, "value", {
      configurable: true,
      get: function () { return valueDesc.get.call(this); },
      set: function (v) { valueDesc.set.call(this, v); sync(); }
    });

    function mark(i) {
      hi = Math.max(0, Math.min(opts.length - 1, i));
      opts.forEach(function (d, n) { d.classList.toggle("hi", n === hi); });
      if (opts[hi]) opts[hi].scrollIntoView({ block: "nearest" });
    }
    function open() {
      wrap.classList.add("open"); btn.setAttribute("aria-expanded", "true");
      if (host) host.classList.add("dd-up");
      mark(Math.max(0, opts.findIndex(function (d) { return d.classList.contains("sel"); })));
    }
    function close() {
      wrap.classList.remove("open"); btn.setAttribute("aria-expanded", "false");
      if (host) host.classList.remove("dd-up");
    }
    function choose(i) {
      var d = opts[i]; if (!d) return;
      if (sel.value !== d.dataset.v) {
        sel.value = d.dataset.v;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      close(); btn.focus();
    }

    btn.addEventListener("click", function () { wrap.classList.contains("open") ? close() : open(); });
    list.addEventListener("click", function (e) {
      var d = e.target.closest(".dd-opt"); if (d) choose(opts.indexOf(d));
    });
    wrap.addEventListener("keydown", function (e) {
      var isOpen = wrap.classList.contains("open"), k = e.key;
      if (!isOpen && (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ")) { e.preventDefault(); open(); return; }
      if (!isOpen) return;
      if (k === "ArrowDown") { e.preventDefault(); mark(hi + 1); }
      else if (k === "ArrowUp") { e.preventDefault(); mark(hi - 1); }
      else if (k === "Home") { e.preventDefault(); mark(0); }
      else if (k === "End") { e.preventDefault(); mark(opts.length - 1); }
      else if (k === "Enter" || k === " ") { e.preventDefault(); choose(hi); }
      else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (k === "Tab") close();
    });
    document.addEventListener("pointerdown", function (e) { if (!wrap.contains(e.target)) close(); });
    sync();
  }

  document.querySelectorAll("select").forEach(upgrade);

  // The accent picker has no effect in a mono UI (white is the accent), so hide its panel.
  var acc = document.getElementById("accent"), panel = acc && acc.closest(".sp");
  if (panel) panel.hidden = true;
})();
