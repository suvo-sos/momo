// Elegant Contents — three modern, elegant Content styles for Momo.
// Plain JS, no React, no build step, same mount/update/destroy shape as
// Finance Bento: mount(container, snapshot, options) returns
// { update(snapshot, options), destroy() }.
//
// All three read only the CMC snapshot the Swift host already sends:
//   { portfolio: { value, change24h, currency }, coins: [{ symbol, price,
//     change24h }], at }
// Nothing is invented: no fake allocation, no fake price history. The
// Scale style plots each coin by its real 24h change; Ledger bars are
// sized by the real changes; Focus picks the real best/worst mover.
// Backgrounds stay transparent, so the wallpaper background shows through,
// like the dashboard's clear mode. Colours come from skin.html's theme
// variables, with fallbacks so the settings preview (black) also reads.
(function () {
  "use strict";

  var CSS = [
    ".elc{font-family:-apple-system,'SF Pro Text',system-ui,sans-serif;-webkit-font-smoothing:antialiased;",
    "color:var(--fg,#fff);font-variant-numeric:tabular-nums;width:100%;height:100%}",
    ".elc *{box-sizing:border-box}",
    ".elc .eyebrow{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--fg-dim,rgba(255,255,255,.42))}",
    ".elc .up{color:var(--up,#6fd39a)}",
    ".elc .down{color:var(--down,#e8735f)}",
    ".elc .hair{height:1px;background:var(--hair,rgba(255,255,255,.08))}",
    ".elc .foot{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--foot,rgba(255,255,255,.2))}",
    // Focus: one huge total dead centre, a moving strip of coin logos below.
    ".elc-focus{position:relative;display:flex;align-items:center;justify-content:center;height:100%;padding:48px 64px;overflow:hidden}",
    ".elc-focus .fcenter{text-align:center}",
    ".elc-focus .total{font-size:clamp(64px,10vw,140px);font-weight:900;letter-spacing:-.04em;line-height:1;margin:0 0 14px}",
    ".elc-focus .delta{font-size:16px;font-weight:500;letter-spacing:.01em;color:var(--fg-mute,rgba(255,255,255,.42))}",
    ".elc-focus .delta b{font-weight:600}",
    ".elc-focus .fmarquee{position:absolute;left:0;right:0;bottom:64px;overflow:hidden;padding:12px 0;mask-image:linear-gradient(to right,transparent,#000 6%,#000 94%,transparent)}",
    ".elc-focus .ftrack{display:flex;align-items:center;width:max-content;will-change:transform}",
    ".elc-focus .fhalf{display:flex;align-items:center}",
    ".elc-focus .fchip{display:flex;align-items:center;gap:10px;margin-right:2rem;padding:8px 16px;border:1px solid var(--hair,rgba(255,255,255,.08));border-radius:999px;font-variant-numeric:tabular-nums;background:rgba(18,20,24,.45);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}",
    ".elc-focus .fchip img{width:32px;height:32px;border-radius:50%;object-fit:cover}",
    ".elc-focus .fchip .ficon{width:32px;height:32px;border-radius:50%;border:1.5px solid var(--fg-strong,rgba(255,255,255,.92));display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--fg-strong,rgba(255,255,255,.92))}",
    ".elc-focus .fchip .fsym{font-weight:700;color:var(--fg-strong,rgba(255,255,255,.92));letter-spacing:.02em}",
    ".elc-focus .fchip .amt{font-size:16px;font-weight:500;color:var(--fg-dim,rgba(255,255,255,.5))}",
    ".elc-focus .fchip .chg{font-size:13px;font-weight:600;margin-left:2px}",
    // Ledger: Vercel-style single card with one holdings list.
    ".elc-ledger{display:flex;flex-direction:column;justify-content:center;height:100%;padding:48px 64px}",
    ".elc-ledger .card{background:rgba(255,255,255,0.025);border:1px solid var(--hair,rgba(255,255,255,.08));border-radius:12px;padding:28px 32px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}",
    ".elc-ledger .card-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--hair,rgba(255,255,255,.08))}",
    ".elc-ledger .card-head .t{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--fg-dim,rgba(255,255,255,.42))}",
    ".elc-ledger .card-head .total{font-size:clamp(36px,4.5vw,56px);font-weight:700;letter-spacing:-.03em;line-height:1}",
    ".elc-ledger .card-head .delta{font-size:13px;font-weight:600;margin-top:6px}",
    ".elc-ledger .list{display:flex;flex-direction:column}",
    ".elc-ledger .row{display:grid;grid-template-columns:1fr auto auto auto auto;gap:16px;align-items:center;padding:12px 0;border-bottom:1px solid var(--hair-soft,rgba(255,255,255,.045));font-size:13px}",
    ".elc-ledger .row:last-child{border-bottom:none}",
    ".elc-ledger .row .s{font-weight:600;letter-spacing:.06em;display:flex;align-items:center;gap:10px}",
    ".elc-ledger .row .s .logo{width:22px;height:22px;border-radius:50%;object-fit:cover;background:var(--hair,rgba(255,255,255,.08))}",
    ".elc-ledger .row .amt{color:var(--fg-dim,rgba(255,255,255,.42));font-size:12px;text-align:right}",
    ".elc-ledger .row .p{color:var(--fg-dim,rgba(255,255,255,.42));text-align:right;font-size:12px}",
    ".elc-ledger .row .v{font-weight:600;text-align:right}",
    ".elc-ledger .row .c{text-align:right;font-weight:600;min-width:68px}",
    ".elc-ledger .card-foot{margin-top:16px;padding-top:14px;border-top:1px solid var(--hair,rgba(255,255,255,.08));font-size:11px;color:var(--fg-mute,rgba(255,255,255,.42));letter-spacing:.02em;display:flex;justify-content:space-between}",
    ".elc-ledger .card-foot b{color:var(--fg-strong,rgba(255,255,255,.92));font-weight:600}",
    // Scale: sharp corners, bulky fonts, coins on a 24h-change axis.
    ".elc-scale{display:flex;flex-direction:column;justify-content:center;height:100%;padding:48px 64px}",
    ".elc-scale .eyebrow{font-size:12px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-dim,rgba(255,255,255,.42))}",
    ".elc-scale .total{font-size:clamp(48px,6vw,80px);font-weight:900;letter-spacing:-.04em;line-height:.95;margin:14px 0 8px;font-family:'Space Grotesk','Work Sans',-apple-system,sans-serif}",
    ".elc-scale .delta{font-size:15px;font-weight:800;color:var(--fg-mute,rgba(255,255,255,.42));letter-spacing:.02em}",
    ".elc-scale .axis{position:relative;height:140px;margin:48px 0 12px}",
    ".elc-scale .track{position:absolute;left:0;right:0;top:70px;height:2px;background:var(--hair,rgba(255,255,255,.08))}",
    ".elc-scale .zero{position:absolute;top:56px;bottom:56px;width:2px;background:var(--fg-dim,rgba(255,255,255,.42))}",
    ".elc-scale .tick{position:absolute;top:70px;font-size:11px;font-weight:700;color:var(--fg-dim,rgba(255,255,255,.42));transform:translateX(-50%);padding-top:12px;white-space:nowrap;letter-spacing:.04em}",
    ".elc-scale .dot{position:absolute;top:70px;transform:translate(-50%,-50%)}",
    ".elc-scale .dot i{display:block;width:12px;height:12px;border-radius:0;margin:0 auto}",
    ".elc-scale .dot.up i{background:var(--up,#6fd39a)}",
    ".elc-scale .dot.down i{background:var(--down,#e8735f)}",
    ".elc-scale .dot span{display:block;margin-top:10px;font-size:12px;font-weight:800;letter-spacing:.08em;white-space:nowrap;text-transform:uppercase}",
    ".elc-scale .dot em{display:block;font-style:normal;font-size:11px;font-weight:700;color:var(--fg-dim,rgba(255,255,255,.42));margin-top:3px;white-space:nowrap}",
    ".elc-scale .dot.above span{margin-top:0;margin-bottom:10px}",
    ".elc-scale .dot.above em{margin-top:0;margin-bottom:3px}",
    ".elc-scale .dot.above{transform:translate(-50%,-100%)}",
    ".elc-scale .dot.above i{margin-top:10px}",
    ".elc-scale .rank{margin-top:22px}",
    ".elc-scale .row{display:flex;align-items:baseline;gap:16px;padding:10px 0;border-top:1px solid var(--hair-soft,rgba(255,255,255,.045));font-size:14px;font-weight:700}",
    ".elc-scale .row .n{font-size:12px;font-weight:800;color:var(--fg-dim,rgba(255,255,255,.42));width:20px}",
    ".elc-scale .row .s{font-weight:900;letter-spacing:.08em;width:64px;text-transform:uppercase}",
    ".elc-scale .row .p{color:var(--fg-dim,rgba(255,255,255,.42));flex:1;font-weight:600}",
    ".elc-scale .row .c{font-weight:900;min-width:72px}",
    ".elc-scale .foot{margin-top:24px;font-weight:600}"
  ].join("\n");

  var cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;
    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    cssInjected = true;
  }

  var CUR_SYM = { USD: "$", EUR: "€", INR: "₹", GBP: "£", JPY: "¥" };
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(v, cur) {
    var sym = CUR_SYM[cur] || "";
    if (v >= 1e6) return sym + (v / 1e6).toFixed(2) + "M";
    if (v >= 1e4) return sym + Math.round(v).toLocaleString("en-US");
    if (v >= 1) return sym + v.toFixed(2);
    return sym + v.toPrecision(3);
  }
  function price(v, cur) {
    var sym = CUR_SYM[cur] || "";
    if (v >= 1000) return sym + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (v >= 1) return sym + v.toFixed(2);
    if (v >= 0.01) return sym + v.toFixed(4);
    return sym + v.toPrecision(4);
  }
  function pct(v) {
    var n = v * 100;
    return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
  }
  function cls(v) {
    if (Math.abs(v) < 0.0005) return "";
    return v > 0 ? "up" : "down";
  }
  function foot(snap) {
    if (!snap || !snap.at) return "momo · demo";
    var t = new Date(snap.at);
    return "momo · " + t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function dollarChange(p) {
    // Real $ move today: value now minus value 24h ago, implied by change24h.
    if (!p || !p.change24h) return 0;
    return p.value - p.value / (1 + p.change24h);
  }

   function baseMount(container, className, render) {
     injectCSS();
     var root = document.createElement("div");
     root.className = "elc " + className;
     container.appendChild(root);
     var snap = null, opts = {};
     var curTotal = null;
     var totalRaf = 0;
     function animateTotal() {
       if (!snap || !snap.portfolio) return;
       var target = snap.portfolio.value;
       var cur = snap.portfolio.currency || "USD";
       var el = root.querySelector(".total");
       if (!el) return;
       var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
       var from = (curTotal != null) ? curTotal : target;
       if (reduce || Math.abs(from - target) < 0.005) {
         curTotal = target;
         el.textContent = money(target, cur);
         return;
       }
       if (totalRaf) cancelAnimationFrame(totalRaf);
       var start0 = performance.now();
       function frame(ts) {
         var elapsed = ts - start0;
         var progress = Math.min(elapsed / 700, 1);
         var eased = 1 - Math.pow(1 - progress, 3);
         var val = from + (target - from) * eased;
         curTotal = val;
         el.textContent = money(val, cur);
         if (progress < 1) totalRaf = requestAnimationFrame(frame);
         else { curTotal = target; el.textContent = money(target, cur); totalRaf = 0; }
       }
       totalRaf = requestAnimationFrame(frame);
     }
     function draw() { root.innerHTML = render(snap, opts); animateTotal(); }
     return {
       update: function (newSnap, newOpts) {
         if (newSnap) snap = newSnap;
         if (newOpts) opts = newOpts;
         draw();
       },
       destroy: function () {
         if (totalRaf) cancelAnimationFrame(totalRaf);
         if (root.parentNode) root.parentNode.removeChild(root);
       }
     };
   }

  function sortedCoins(snap) {
    return (snap && snap.coins ? snap.coins.slice() : []).sort(function (a, b) { return b.change24h - a.change24h; });
  }

  // ---- Focus ----
  function focusChips(snap) {
    if (!snap || !snap.coins) return "";
    var cur = snap.portfolio.currency || "USD";
    return snap.coins.map(function (c) {
      var logo = c.logo
        ? '<img src="' + esc(c.logo) + '" alt="' + esc(c.symbol) + '" onerror="this.style.display=\'none\';">'
        : '<span class="ficon">' + esc((c.symbol || '').slice(0, 3)) + '</span>';
      return '<div class="fchip">' + logo + '<span class="fsym">' + esc(c.symbol) + '</span><span class="amt">' + price(c.price, cur) + '</span><span class="chg ' + cls(c.change24h) + '">' + pct(c.change24h) + '</span></div>';
    }).join("");
  }

  function renderFocus(snap) {
    if (!snap) return '<div class="eyebrow">Portfolio</div><div class="total">—</div>';
    var cur = snap.portfolio.currency || "USD";
    var p = snap.portfolio;
    var chips = focusChips(snap);
    return '<div class="fcenter">' +
        '<div class="total">' + money(p.value, cur) + '</div>' +
        '<div class="delta"><b class="' + cls(p.change24h) + '">' + pct(p.change24h) + '</b> today</div>' +
      '</div>' +
      '<div class="fmarquee"><div class="ftrack"><div class="fhalf">' + chips.repeat(2) + '</div><div class="fhalf">' + chips.repeat(2) + '</div></div></div>';
  }

   // ---- Ledger ----
   function renderLedger(snap) {
     if (!snap) return '<div class="card"><div class="card-head"><span class="t">Ledger</span><div class="total">—</div></div></div>';
     var cur = snap.portfolio.currency || "USD";
     var p = snap.portfolio;
     var coins = (snap.coins || []).slice(0, 10);
     var ups = coins.filter(function (c) { return c.change24h > 0.0005; }).length;
     var downs = coins.filter(function (c) { return c.change24h < -0.0005; }).length;
     var ranked = sortedCoins(snap);
     var t = snap.at ? new Date(snap.at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "";
     return '<div class="card">' +
       '<div class="card-head">' +
         '<div><span class="t">Portfolio</span><div style="font-size:11px;color:var(--fg-dim,rgba(255,255,255,.42));margin-top:4px;">' + esc(t) + '</div></div>' +
         '<div style="text-align:right;"><div class="total">' + money(p.value, cur) + '</div>' +
         '<div class="delta ' + cls(p.change24h) + '">' + pct(p.change24h) + ' today</div></div>' +
       '</div>' +
       '<div class="list">' + coins.map(function (c) {
         var amt = (c.amount != null) ? c.amount : 0;
         var val = c.price * amt;
         var logo = c.logo
           ? '<img class="logo" src="' + esc(c.logo) + '" alt="' + esc(c.symbol) + '" onerror="this.style.display=\'none\';">'
           : '';
         return '<div class="row">' +
           '<span class="s">' + logo + esc(c.symbol) + '</span>' +
           '<span class="amt">' + (amt >= 1 ? amt.toLocaleString('en-US', { maximumFractionDigits: 4 }) : amt.toPrecision(4)) + ' ' + esc(c.symbol) + '</span>' +
           '<span class="p">' + price(c.price, cur) + '</span>' +
           '<span class="v">' + money(val, cur) + '</span>' +
           '<span class="c ' + cls(c.change24h) + '">' + pct(c.change24h) + '</span>' +
         '</div>';
       }).join("") + '</div>' +
       '<div class="card-foot">' +
         '<span>' + ups + ' up · ' + downs + ' down</span>' +
         '<span>' + (ranked[0] ? 'Best ' + esc(ranked[0].symbol) + ' ' + pct(ranked[0].change24h) : '') +
         (ranked.length ? ' · Worst ' + esc(ranked[ranked.length - 1].symbol) + ' ' + pct(ranked[ranked.length - 1].change24h) : '') + '</span>' +
       '</div>' +
     '</div>' +
     '<div class="foot" style="margin-top:18px">' + esc(foot(snap)) + '</div>';
   }

  // ---- Scale ----
  function renderScale(snap) {
    if (!snap) return '<div class="eyebrow">Portfolio</div><div class="total">—</div>';
    var cur = snap.portfolio.currency || "USD";
    var p = snap.portfolio;
    var coins = (snap.coins || []).slice(0, 10);
    var maxAbs = Math.max.apply(null, coins.map(function (c) { return Math.abs(c.change24h); }).concat([0.01]));
    // Round the axis out to a clean step so the ends are labelled, not clipped.
    var axis = Math.ceil(maxAbs * 100) + 1;
    function x(chg) { return ((chg * 100 + axis) / (2 * axis) * 100); }
    var ranked = sortedCoins(snap);
    var dots = coins.map(function (c, i) {
      var above = i % 2 === 0;
      return '<div class="dot ' + cls(c.change24h) + (above ? " above" : "") + '" style="left:' + x(c.change24h).toFixed(2) + '%">' +
        (above ? '<span>' + esc(c.symbol) + '</span><em>' + pct(c.change24h) + '</em><i></i>'
               : '<i></i><span>' + esc(c.symbol) + '</span><em>' + pct(c.change24h) + '</em>') +
        '</div>';
    }).join("");
    return '<div class="eyebrow">Portfolio · 24h scale</div>' +
      '<div class="total">' + money(p.value, cur) + '</div>' +
      '<div class="delta"><span class="' + cls(p.change24h) + '">' + pct(p.change24h) + '</span> today</div>' +
      '<div class="axis"><div class="track"></div>' +
        '<div class="zero" style="left:50%"></div>' +
        '<div class="tick" style="left:0%">−' + axis + '%</div>' +
        '<div class="tick" style="left:50%">0%</div>' +
        '<div class="tick" style="left:100%">+' + axis + '%</div>' +
        dots + '</div>' +
      '<div class="rank">' + ranked.slice(0, 5).map(function (c, i) {
        return '<div class="row"><span class="n">' + (i + 1) + '</span>' +
          '<span class="s">' + esc(c.symbol) + '</span>' +
          '<span class="p">' + price(c.price, cur) + '</span>' +
          '<span class="c ' + cls(c.change24h) + '">' + pct(c.change24h) + '</span></div>';
      }).join("") + '</div>' +
      '<div class="foot">' + esc(foot(snap)) + '</div>';
  }

  // Focus needs a moving strip, so it drives its own rAF (the same approach
  // as the wallpaper's bottom marquee, which survives WKWebView throttling
  // better than a CSS animation).
  function mountFocus(container, snap, opts) {
    injectCSS();
    var root = document.createElement("div");
    root.className = "elc elc-focus";
    container.appendChild(root);
    var s = null, o = {}, x = 0, prev = 0, raf = 0, alive = true;
    var curTotal = null;
    var totalRaf = 0;
    function animateTotal() {
      if (!s || !s.portfolio) return;
      var target = s.portfolio.value;
      var cur = s.portfolio.currency || "USD";
      var el = root.querySelector(".total");
      if (!el) return;
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var from = (curTotal != null) ? curTotal : target;
      if (reduce || Math.abs(from - target) < 0.005) {
        curTotal = target;
        el.textContent = money(target, cur);
        return;
      }
      if (totalRaf) cancelAnimationFrame(totalRaf);
      var start0 = performance.now();
      function frame(ts) {
        if (!alive) return;
        var elapsed = ts - start0;
        var progress = Math.min(elapsed / 700, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var val = from + (target - from) * eased;
        curTotal = val;
        el.textContent = money(val, cur);
        if (progress < 1) totalRaf = requestAnimationFrame(frame);
        else { curTotal = target; el.textContent = money(target, cur); totalRaf = 0; }
      }
      totalRaf = requestAnimationFrame(frame);
    }
    function draw() { root.innerHTML = renderFocus(s, o); animateTotal(); }
    function tick(t) {
      if (!alive) return;
      var track = root.querySelector(".ftrack");
      if (track) {
        if (!prev) prev = t;
        var dt = Math.min(t - prev, 100);
        prev = t;
        var half = track.scrollWidth / 2;
        if (half > 0) {
          x += (dt / 1000) * 80;
          if (x >= half) x -= half;
          track.style.transform = "translate3d(" + (-x).toFixed(2) + "px,0,0)";
        }
      }
      raf = requestAnimationFrame(tick);
    }
    return {
      update: function (newSnap, newOpts) {
        if (newSnap) s = newSnap;
        if (newOpts) o = newOpts;
        draw();
        prev = 0;
      },
       destroy: function () {
         alive = false;
         if (raf) cancelAnimationFrame(raf);
         if (totalRaf) cancelAnimationFrame(totalRaf);
         if (root.parentNode) root.parentNode.removeChild(root);
       },
      start: function () { if (!raf) raf = requestAnimationFrame(tick); }
    };
  }

  window.ElegantContents = {
    Focus: { mount: function (c, s, o) { var h = mountFocus(c, s, o); h.update(s, o); h.start(); return h; } },
    Ledger: { mount: function (c, s, o) { var h = baseMount(c, "elc-ledger", renderLedger); h.update(s, o); return h; } },
    Scale: { mount: function (c, s, o) { var h = baseMount(c, "elc-scale", renderScale); h.update(s, o); return h; } }
  };
})();
