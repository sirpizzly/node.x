/* node.x reviews: star rating + one review per user, with a language filter.
   Shared reviews need the free database described in reviews-setup.sql + reviews-config.js.
   Until then it runs in "this device only" mode. */
(function () {
  "use strict";
  var cfg = window.NX_REVIEWS || {}, root = document.getElementById("v-reviews");
  if (!root) return;
  var remote = !!(cfg.supabaseUrl && cfg.supabaseKey);
  var API = remote ? String(cfg.supabaseUrl).replace(/\/+$/, "") : "";
  var MAXB = 500, MAXN = 24, MINB = 3;

  /* ---------- storage ---------- */
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function jget(k) { try { return JSON.parse(ls(k) || "null"); } catch (e) { return null; } }

  /* ---------- language filter ----------
     The word list is stored scrambled (ROT13) so the file doesn't read as a list of slurs. */
  var ENC = "shpx:f,spx:f,shx:f,zbgureshpx:f,fuvg:f,ohyyfuvg:f,qvcfuvg:s,ovgpu:f,nff:a,nffubyr:s,wnpxnff:s,qhzonff:s,onfgneq:s,qvpx:s,qvpxurnq:s,pbpx:s,chffl:s,chffvrf:n,phag:s,qnza:f,qnzzvg:s,tbqqnza:f,uryy:s,penc:f,cvff:f,fyhg:f,juber:s,gjng:s,jnax:f,avttre:s,avttn:s,avttnu:s,snttbg:s,snt:s,ergneq:f,genaal:s,genaavrf:n,puvax:s,fcvp:s,xvxr:s,tbbx:s,jrgonpx:s,ornare:s,qlxr:s,cnxv:s,gbjryurnq:s,enturnq:s,pbba:s", STR = "shpx,fuvg,phag,avttre,avttn,snttbg,ovgpu";
  function r13(s) { return s.replace(/[a-z]/gi, function (c) { var b = c <= "Z" ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + 13) % 26 + b); }); }
  var SUF = { f: "(?:s|es|ed|er|ers|ing|in|y|ies|ty|py|head|heads|face|wad)?", s: "(?:s|es)?", a: "(?:es)?", n: "" };
  function pat(w, k) {
    var p = "", i = 0, j, c, n;
    while (i < w.length) { c = w.charAt(i); j = i; while (j < w.length && w.charAt(j) === c) j++; n = j - i; p += c + (n > 1 ? "{" + n + ",}" : "+"); i = j; }
    return new RegExp("(?:^|[^a-z])" + p + SUF[k] + "(?![a-z])");
  }
  var BAD = ENC.split(",").map(function (x) { var a = x.split(":"); return pat(r13(a[0]), a[1]); });
  var STRONG = STR.split(",").map(r13);
  var LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "$": "s", "@": "a", "!": "i", "+": "t" };
  function norm(t) {
    return t.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200f\u2060\ufeff]/g, "")
      .replace(/[013457$@!+]/g, function (c) { return LEET[c] || c; });
  }
  function dirty(t) {
    t = String(t || "");
    var forms = [t.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200f\u2060\ufeff]/g, ""), norm(t)], out = [], i, k;
    forms.forEach(function (s) {
      out.push(" " + s + " ");
      /* spaced-out letters: "f u c k", "f.u.c.k", "f*u*c*k" */
      (s.match(/(?:^|[^a-z])(?:[a-z][ ._*\-]+){2,}[a-z](?![a-z])/g) || []).forEach(function (r) {
        var m = r.replace(/[^a-z]/g, "");
        out.push(" " + m + " ");
        STRONG.forEach(function (w) { if (m.indexOf(w) >= 0) out.push(" " + w + " "); });
      });
      s.split(/[^a-z]+/).forEach(function (w) { if (w.indexOf("fuck") >= 0 || w.indexOf("faggot") >= 0) out.push(" fuck "); });
    });
    for (i = 0; i < out.length; i++) for (k = 0; k < BAD.length; k++) if (BAD[k].test(out[i])) return true;
    return false;
  }
  function hasLink(t) { return /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|gg|xyz|ru|co)\b)/i.test(t); }
  window.nxReviewFilter = dirty; // handy for testing in the console

  /* ---------- backends ---------- */
  var Local = {
    mode: "local",
    uid: function () { var u = ls("nx_rv_uid"); if (!u) { u = "l" + Math.random().toString(36).slice(2) + Date.now().toString(36); ls("nx_rv_uid", u); } return Promise.resolve(u); },
    list: function () { return Promise.resolve(jget("nx_rv_local") || []); },
    save: function (r) {
      return this.uid().then(function (u) {
        var all = jget("nx_rv_local") || [], now = new Date().toISOString(), old = all.filter(function (x) { return x.user_id === u; })[0];
        all = all.filter(function (x) { return x.user_id !== u; });
        all.unshift({ id: old ? old.id : "l" + Date.now(), user_id: u, name: r.name, rating: r.rating, body: r.body, created_at: old ? old.created_at : now, updated_at: now });
        ls("nx_rv_local", JSON.stringify(all));
      });
    },
    remove: function () { return this.uid().then(function (u) { ls("nx_rv_local", JSON.stringify((jget("nx_rv_local") || []).filter(function (x) { return x.user_id !== u; }))); }); },
    like: function () { return Promise.reject(new Error("local")); }
  };

  var Remote = {
    mode: "remote",
    sess: null,
    hdr: function (tok, extra) {
      var h = { apikey: cfg.supabaseKey, Authorization: "Bearer " + (tok || cfg.supabaseKey), "Content-Type": "application/json" };
      for (var k in extra) h[k] = extra[k];
      return h;
    },
    /* every visitor gets an anonymous account in the background; that account is what limits them to one review */
    session: function () {
      var self = this, s = self.sess || jget("nx_rv_sess"), now = Date.now() / 1000;
      if (s && s.exp > now + 60) { self.sess = s; return Promise.resolve(s); }
      function done(j) {
        if (!j || !j.access_token || !j.user) throw new Error("auth");
        self.sess = { token: j.access_token, refresh: j.refresh_token, exp: j.expires_at || (now + (j.expires_in || 3600)), uid: j.user.id };
        ls("nx_rv_sess", JSON.stringify(self.sess)); return self.sess;
      }
      function fresh() { return fetch(API + "/auth/v1/signup", { method: "POST", headers: self.hdr(), body: "{}" }).then(function (r) { return r.json(); }).then(done); }
      if (s && s.refresh) {
        return fetch(API + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: self.hdr(), body: JSON.stringify({ refresh_token: s.refresh }) })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(done).catch(fresh);
      }
      return fresh();
    },
    uid: function () { return this.session().then(function (s) { return s.uid; }); },
    list: function () {
      return fetch(API + "/rest/v1/reviews?select=id,user_id,name,rating,body,created_at,updated_at,review_likes(user_id)&order=created_at.desc&limit=500", { headers: this.hdr() })
        .then(function (r) { if (!r.ok) throw new Error("list"); return r.json(); });
    },
    save: function (r) {
      var self = this;
      return self.session().then(function (s) {
        return fetch(API + "/rest/v1/reviews?on_conflict=user_id", {
          method: "POST", headers: self.hdr(s.token, { Prefer: "resolution=merge-duplicates,return=minimal" }),
          body: JSON.stringify({ user_id: s.uid, name: r.name, rating: r.rating, body: r.body })
        });
      }).then(function (res) {
        if (res.ok) return;
        return res.text().then(function (t) { var e = new Error(/profanity/i.test(t) ? "profanity" : "save"); throw e; });
      });
    },
    like: function (id, on) {
      var self = this;
      return self.session().then(function (s) {
        if (on) return fetch(API + "/rest/v1/review_likes", { method: "POST", headers: self.hdr(s.token, { Prefer: "return=minimal" }), body: JSON.stringify({ review_id: id, user_id: s.uid }) })
          .then(function (res) { if (!res.ok && res.status !== 409) throw new Error("like"); });
        return fetch(API + "/rest/v1/review_likes?review_id=eq." + encodeURIComponent(id) + "&user_id=eq." + encodeURIComponent(s.uid), { method: "DELETE", headers: self.hdr(s.token) })
          .then(function (res) { if (!res.ok) throw new Error("like"); });
      });
    },
    remove: function () {
      var self = this;
      return self.session().then(function (s) {
        return fetch(API + "/rest/v1/reviews?user_id=eq." + encodeURIComponent(s.uid), { method: "DELETE", headers: self.hdr(s.token) });
      }).then(function (res) { if (!res.ok) throw new Error("delete"); });
    }
  };
  var B = remote ? Remote : Local;

  /* ---------- UI ---------- */
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
  var FIVE = STAR + STAR + STAR + STAR + STAR;
  var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  root.innerHTML =
    '<h2>Reviews</h2>' +
    '<p class="gm rv-note" id="rvNote" hidden></p>' +
    '<div class="rv-top">' +
      '<section class="card rv-sum"><div class="rv-avg" id="rvAvg">–</div><div><div class="rv-stars big" id="rvAvgStars"><div class="rv-bg">' + FIVE + '</div><div class="rv-fg" id="rvFg">' + FIVE + '</div></div><div class="gm" id="rvCount"></div></div><div class="rv-bars" id="rvBars"></div></section>' +
      '<section class="card rv-form"><h3 id="rvFormT">Leave a review</h3>' +
        '<div class="rv-pick" id="rvPick" role="radiogroup" aria-label="Star rating"></div>' +
        '<input class="rv-in" id="rvName" maxlength="' + MAXN + '" placeholder="Name (optional)" autocomplete="nickname">' +
        '<textarea class="rv-in" id="rvBody" maxlength="' + MAXB + '" rows="4" placeholder="What do you think of node.x? Keep it friendly: no slurs or cuss words."></textarea>' +
        '<div class="rv-row"><span class="gm" id="rvCnt">0/' + MAXB + '</span><span class="rv-sp"></span><button class="btn" id="rvDel" type="button" hidden>Delete</button><button class="btn primary" id="rvSend" type="button">Post review</button></div>' +
        '<p class="rv-msg" id="rvMsg" role="status"></p>' +
      '</section>' +
    '</div>' +
    '<div class="rv-sort" id="rvSort"><button class="chip on" data-s="new">Newest</button><button class="chip" data-s="likes">Most liked</button><button class="chip" data-s="hi">Highest</button><button class="chip" data-s="lo">Lowest</button></div>' +
    '<div class="rv-list" id="rvList"></div>' +
    '<div class="rv-more"><button class="btn" id="rvMore" hidden>Show more</button></div>';
  function $(s) { return root.querySelector(s); }

  var state = { all: [], me: null, uid: null, sort: "new", shown: 20, rating: 0, busy: false, last: 0, loaded: false };

  if (!remote) {
    var n = $("#rvNote");
    n.hidden = false;
    n.textContent = "Reviews are only saved on this device right now. Connect the free database (see reviews-setup.sql) so everyone can see each other's reviews.";
  }

  function pick() {
    var h = "";
    for (var i = 1; i <= 5; i++) h += '<button type="button" class="rv-s" role="radio" aria-checked="false" aria-label="' + i + ' star' + (i > 1 ? "s" : "") + '" data-v="' + i + '">' + STAR + '</button>';
    $("#rvPick").innerHTML = h;
  }
  function paintPick(hover) {
    var v = hover || state.rating;
    [].forEach.call($("#rvPick").children, function (b) {
      var on = +b.dataset.v <= v; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(+b.dataset.v === state.rating));
    });
  }
  pick(); paintPick();
  $("#rvPick").addEventListener("click", function (e) { var b = e.target.closest(".rv-s"); if (b) { state.rating = +b.dataset.v; paintPick(); } });
  $("#rvPick").addEventListener("mouseover", function (e) { var b = e.target.closest(".rv-s"); if (b) paintPick(+b.dataset.v); });
  $("#rvPick").addEventListener("mouseleave", function () { paintPick(); });
  $("#rvBody").addEventListener("input", function () { $("#rvCnt").textContent = this.value.length + "/" + MAXB; });

  function msg(t, bad) { var m = $("#rvMsg"); m.textContent = t || ""; m.className = "rv-msg" + (t ? (bad ? " bad" : " ok") : ""); }

  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000, u = [[31536000, "year"], [2592000, "month"], [86400, "day"], [3600, "hour"], [60, "minute"]], i, v;
    if (isNaN(s) || s < 60) return isNaN(s) ? "" : "just now";
    for (i = 0; i < u.length; i++) if (s >= u[i][0]) { v = Math.floor(s / u[i][0]); return v + " " + u[i][1] + (v > 1 ? "s" : "") + " ago"; }
    return "just now";
  }
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; }

  function renderSummary() {
    var a = state.all, n = a.length, sum = 0, c = [0, 0, 0, 0, 0, 0], i;
    a.forEach(function (r) { sum += r.rating; c[r.rating]++; });
    var avg = n ? sum / n : 0;
    $("#rvAvg").textContent = n ? avg.toFixed(1) : "–";
    $("#rvFg").style.width = (avg / 5 * 100) + "%";
    $("#rvCount").textContent = n ? n + (n === 1 ? " review" : " reviews") : "No reviews yet";
    var h = "";
    for (i = 5; i >= 1; i--) h += '<div class="rv-b"><span>' + i + '</span><i><b style="width:' + (n ? c[i] / n * 100 : 0) + '%"></b></i><span>' + c[i] + '</span></div>';
    $("#rvBars").innerHTML = h;
  }
  function stars(r) { return '<span class="rv-stars"><span class="rv-bg">' + FIVE + '</span><span class="rv-fg" style="width:' + (r / 5 * 100) + '%">' + FIVE + '</span></span>'; }

  function renderList() {
    var a = state.all.slice();
    if (state.sort === "likes") a.sort(function (x, y) { return (y.likes || 0) - (x.likes || 0) || (y.created_at > x.created_at ? 1 : -1); });
    else if (state.sort === "hi") a.sort(function (x, y) { return y.rating - x.rating || (y.created_at > x.created_at ? 1 : -1); });
    else if (state.sort === "lo") a.sort(function (x, y) { return x.rating - y.rating || (y.created_at > x.created_at ? 1 : -1); });
    else a.sort(function (x, y) { return y.created_at > x.created_at ? 1 : -1; });
    var box = $("#rvList"); box.textContent = "";
    if (!a.length) { var e = document.createElement("p"); e.className = "gm rv-empty"; e.textContent = "Be the first to leave a review."; box.appendChild(e); }
    a.slice(0, state.shown).forEach(function (r) {
      var mine = r.user_id === state.uid, el = document.createElement("article"), nm = r.name || "Anonymous";
      el.className = "card rv-item" + (mine ? " mine" : "");
      var av = document.createElement("div"); av.className = "rv-av"; av.style.background = "hsl(" + hue(nm) + ",45%,32%)"; av.textContent = nm.charAt(0).toUpperCase();
      var mid = document.createElement("div"); mid.className = "rv-mid";
      var head = document.createElement("div"); head.className = "rv-head";
      var b = document.createElement("b"); b.textContent = nm; head.appendChild(b);
      if (mine) { var you = document.createElement("span"); you.className = "rv-you"; you.textContent = "You"; head.appendChild(you); }
      var when = document.createElement("span"); when.className = "gm rv-when"; when.textContent = ago(r.created_at); head.appendChild(when);
      var st = document.createElement("div"); st.innerHTML = stars(r.rating);
      var p = document.createElement("p"); p.className = "rv-body"; p.textContent = r.body;
      var lk = document.createElement("button"); lk.type = "button"; lk.className = "rv-like" + (r.liked ? " on" : ""); lk.dataset.id = r.id;
      lk.disabled = mine; lk.setAttribute("aria-pressed", String(!!r.liked)); lk.title = mine ? "You can't like your own review" : (r.liked ? "Remove your like" : "Like this review");
      lk.innerHTML = HEART + '<span>' + (r.likes || 0) + '</span>';
      mid.append(head, st, p, lk); el.append(av, mid); box.appendChild(el);
    });
    $("#rvMore").hidden = a.length <= state.shown;
  }

  function renderForm() {
    var me = state.me;
    $("#rvFormT").textContent = me ? "Your review" : "Leave a review";
    $("#rvSend").textContent = me ? "Update review" : "Post review";
    $("#rvDel").hidden = !me;
    if (me && !state.touched) {
      state.rating = me.rating; paintPick();
      $("#rvName").value = me.name === "Anonymous" ? "" : me.name; $("#rvBody").value = me.body; $("#rvCnt").textContent = me.body.length + "/" + MAXB;
    }
    if (!me && !state.touched) { var nm = ls("nx_rv_name"); if (nm && !$("#rvName").value) $("#rvName").value = nm; }
  }

  function render() {
    state.me = state.all.filter(function (r) { return r.user_id === state.uid; })[0] || null;
    renderSummary(); renderList(); renderForm();
  }

  function load() {
    return B.uid().then(function (u) { state.uid = u; return B.list(); }).then(function (rows) {
      state.all = (rows || []).filter(function (r) { return r && r.rating >= 1 && r.rating <= 5; });
      state.all.forEach(function (r) { var l = r.review_likes || []; r.likes = l.length; r.liked = l.some(function (x) { return x.user_id === state.uid; }); });
      state.loaded = true; render();
    }).catch(function () {
      msg(remote ? "Couldn't reach the reviews database. Try again in a moment." : "Couldn't load reviews.", true);
    });
  }

  ["#rvName", "#rvBody"].forEach(function (s) { $(s).addEventListener("input", function () { state.touched = true; }); });
  $("#rvPick").addEventListener("click", function () { state.touched = true; });

  $("#rvSend").addEventListener("click", function () {
    if (state.busy) return;
    var name = $("#rvName").value.trim().replace(/\s+/g, " "), body = $("#rvBody").value.trim();
    if (state.rating < 1) return msg("Pick a star rating first.", true);
    if (body.length < MINB) return msg("Write a short review (at least " + MINB + " characters).", true);
    if (body.length > MAXB) return msg("That review is too long (max " + MAXB + " characters).", true);
    if (dirty(name) || dirty(body)) return msg("Please keep it clean: slurs and cuss words aren't allowed here.", true);
    if (hasLink(name) || hasLink(body)) return msg("Links aren't allowed in reviews.", true);
    if (Date.now() - state.last < 8000) return msg("Slow down a little, then try again.", true);
    state.busy = true; state.last = Date.now(); $("#rvSend").disabled = true; msg("Saving…");
    var edit = !!state.me;
    B.save({ name: name || "Anonymous", rating: state.rating, body: body }).then(function () {
      if (name) ls("nx_rv_name", name);
      state.touched = false; return load();
    }).then(function () { msg(edit ? "Review updated. Thanks!" : "Thanks for your review!"); })
      .catch(function (e) { msg(e && e.message === "profanity" ? "Please keep it clean: slurs and cuss words aren't allowed here." : "Couldn't save your review. Try again.", true); })
      .then(function () { state.busy = false; $("#rvSend").disabled = false; });
  });

  $("#rvDel").addEventListener("click", function () {
    if (state.busy || !state.me || !confirm("Delete your review?")) return;
    state.busy = true;
    B.remove().then(function () {
      state.rating = 0; paintPick(); $("#rvBody").value = ""; $("#rvCnt").textContent = "0/" + MAXB; state.touched = false;
      return load();
    }).then(function () { msg("Review deleted."); })
      .catch(function () { msg("Couldn't delete it. Try again.", true); })
      .then(function () { state.busy = false; });
  });

  $("#rvSort").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b) return;
    state.sort = b.dataset.s; state.shown = 20;
    [].forEach.call($("#rvSort").children, function (x) { x.classList.toggle("on", x === b); });
    renderList();
  });
  $("#rvList").addEventListener("click", function (e) {
    var b = e.target.closest(".rv-like"); if (!b || b.disabled) return;
    var r = state.all.filter(function (x) { return x.id === b.dataset.id; })[0]; if (!r || r.pending) return;
    var on = !r.liked; r.pending = true; r.liked = on; r.likes = (r.likes || 0) + (on ? 1 : -1); renderList();
    B.like(r.id, on).catch(function () { r.liked = !on; r.likes += on ? -1 : 1; msg("Couldn't save your like. Try again.", true); })
      .then(function () { r.pending = false; renderList(); });
  });
  $("#rvMore").addEventListener("click", function () { state.shown += 20; renderList(); });

  function onRoute() { if (location.hash === "#reviews") load(); }
  addEventListener("hashchange", onRoute);
  onRoute();
})();
