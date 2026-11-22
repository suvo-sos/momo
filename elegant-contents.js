// Elegant Contents — three modern, elegant Content styles for Momo.
// Plain JS, no React, no build step, same mount/update/destroy shape as
// Finance Bento: mount(container, snapshot, options) returns
// { update(snapshot, options), destroy() }.
//
// All three read only the CMC snapshot the Swift host already sends:
//   { portfolio: { value, change24h, currency }, coins: [{ symbol, price,
//     change24h }], at }
// Nothing is invented: no fake allocation, no fake price history. The
// Scale is an expanding accordion of holding cards (icon tile when closed,
// icon on the left + amount and value on the right when open, tile colour
// sampled from the logo's edge); Ledger is a curved gallery of holding
// cards that scales with the viewport and steers to the cursor.
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
    // Ledger: curved gallery of holding cards. Photo on top, amount held
    // and holding value at the bottom. The wallpaper window ignores mouse
    // events, so drag and wheel never reach it there — the strip steers
    // to the cursor instead, and drifts when the cursor is still. In the
    // settings preview (a real pointer) it can be dragged or scrolled.
    // --ls scales the whole Ledger with the viewport (min(vw/1280, vh/720)),
    // so the theme preview (a 1280x720 layer scaled to fit) and the
    // full-size wallpaper show the same composition: same card size,
    // same visible count, same header proportions.
    ".elc-ledger{display:flex;flex-direction:column;justify-content:center;height:100%;padding:calc(70px*var(--ls,1)) 0 calc(55px*var(--ls,1));overflow:hidden}",
    ".elc-ledger .eyebrow{font-size:calc(14px*var(--ls,1))}",
    ".elc-ledger .lhead{padding:0 calc(80px*var(--ls,1));display:flex;align-items:flex-end;justify-content:space-between}",
    ".elc-ledger .lhead .total{font-size:calc(120px*var(--ls,1));font-weight:700;letter-spacing:-.03em;line-height:1;margin-top:calc(12px*var(--ls,1));font-family:'Space Grotesk','Work Sans',-apple-system,sans-serif}",
    ".elc-ledger .lhead .delta{font-size:calc(18px*var(--ls,1));font-weight:600;margin-top:calc(10px*var(--ls,1))}",
    ".elc-ledger .lhead .counts{font-size:calc(15px*var(--ls,1));font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-dim,rgba(255,255,255,.42));text-align:right;padding-bottom:calc(8px*var(--ls,1))}",
    ".elc-ledger .gallery{position:relative;flex:1;margin-top:calc(50px*var(--ls,1));perspective:1200px;overflow:hidden;pointer-events:auto;cursor:grab;touch-action:pan-y;mask-image:linear-gradient(to right,transparent,#000 8%,#000 92%,transparent);-webkit-mask-image:linear-gradient(to right,transparent,#000 8%,#000 92%,transparent)}",
    ".elc-ledger .gallery.dragging{cursor:grabbing}",
    // Liquid glass: an SVG displacement filter (#lg-filter, injected
    // by injectCSS) refracts the backdrop in Chromium; WKWebView drops
    // url() in backdrop-filter and falls back to the -webkit- frost.
    // The rim, the top highlight and the cursor sheen (::before) are
    // the same on both. No drop shadow on the coin photo — just a ring.
    ".elc-ledger .gcard{position:absolute;top:50%;left:0;width:calc(110px*var(--ls,1));height:calc(150px*var(--ls,1));margin-top:calc(-75px*var(--ls,1));border-radius:calc(10px*var(--ls,1));background:rgba(255,255,255,0);backdrop-filter:blur(0px) url(#lg-filter) blur(0px) saturate(1.5) brightness(1.1);-webkit-backdrop-filter:blur(calc(2px*var(--ls,1))) saturate(1.8) brightness(1.15) contrast(1.05);display:flex;flex-direction:column;align-items:center;padding:calc(12px*var(--ls,1)) calc(8px*var(--ls,1)) calc(10px*var(--ls,1));will-change:transform;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15),inset calc(1.5px*var(--ls,1)) calc(1.5px*var(--ls,1)) 0 rgba(255,255,255,.5),inset 0 0 calc(3px*var(--ls,1)) rgba(255,255,255,.2),0 calc(2px*var(--ls,1)) calc(8px*var(--ls,1)) rgba(0,0,0,.2);user-select:none;-webkit-user-select:none}",
    ".elc-ledger .gcard::before{content:\"\";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(calc(110px*var(--ls,1)) calc(65px*var(--ls,1)) at var(--mx,50%) var(--my,-30%),rgba(255,255,255,.45),rgba(255,255,255,0) 70%),linear-gradient(115deg,rgba(255,255,255,.20),rgba(255,255,255,0) 34%);mix-blend-mode:screen}",
    ".elc-ledger .gcard::after{content:\"\";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 -5.5px 8.5px -5px rgba(0,0,0,.55),inset 0 5.5px 8.5px -5.5px rgba(255,255,255,.25)}",
    ".elc-ledger .gcard .photo{width:calc(44px*var(--ls,1));height:calc(44px*var(--ls,1));border-radius:50%;object-fit:cover;background:var(--hair,rgba(255,255,255,.08));box-shadow:0 0 0 1px rgba(255,255,255,.12)}",
    ".elc-ledger .gcard .ph-fallback{width:calc(44px*var(--ls,1));height:calc(44px*var(--ls,1));border-radius:50%;display:grid;place-items:center;font-size:calc(14px*var(--ls,1));font-weight:800;color:var(--fg-strong,rgba(255,255,255,.92));background:rgba(255,255,255,.08);box-shadow:0 0 0 1px rgba(255,255,255,.12)}",
    ".elc-ledger .gcard .sym{margin-top:calc(14px*var(--ls,1));font-size:calc(14px*var(--ls,1));font-weight:800;letter-spacing:.06em}",
    ".elc-ledger .gcard .chg{margin-top:calc(8px*var(--ls,1));font-size:calc(9px*var(--ls,1));font-weight:700;padding:calc(3px*var(--ls,1)) calc(8px*var(--ls,1));border-radius:999px;background:rgba(255,255,255,.08)}",
    ".elc-ledger .gcard .hold{margin-top:auto;text-align:center}",
    ".elc-ledger .gcard .amt{font-size:calc(10px*var(--ls,1));font-weight:600;color:var(--fg-dim,rgba(255,255,255,.6))}",
    ".elc-ledger .gcard .val{font-size:calc(24px*var(--ls,1));font-weight:800;letter-spacing:-.03em;margin-top:calc(5px*var(--ls,1))}",
    ".elc-ledger .foot{padding:0 calc(80px*var(--ls,1));margin-top:calc(32px*var(--ls,1));font-size:calc(16px*var(--ls,1))}",
    // Scale: expanding accordion. Closed panels are just the coin icon on
    // its edge colour (sampled from the logo, brand colour when the logo
    // has no vivid edge); the open panel (420x280) is liquid glass with
    // the icon on the left and the holding data on the right. No drop
    // shadow on any icon — just a ring.
    ".elc-scale{display:flex;flex-direction:column;justify-content:center;height:100%;padding:48px 64px;overflow:hidden}",
    ".elc-scale .eyebrow{font-size:12px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--fg-dim,rgba(255,255,255,.42))}",
    ".elc-scale .total{font-size:clamp(48px,6vw,80px);font-weight:900;letter-spacing:-.04em;line-height:.95;margin:14px 0 8px;font-family:'Space Grotesk','Work Sans',-apple-system,sans-serif}",
    ".elc-scale .delta{font-size:15px;font-weight:800;color:var(--fg-mute,rgba(255,255,255,.42));letter-spacing:.02em}",
    ".elc-scale .sgallery{display:flex;gap:10px;height:280px;margin-top:36px;align-items:stretch}",
    ".elc-scale .spanel{position:relative;flex:0 0 70px;height:280px;border-radius:22px;overflow:hidden;filter:brightness(.82);transition:flex-basis .55s cubic-bezier(.32,.72,0,1),filter .4s,border-radius .55s cubic-bezier(.32,.72,0,1)}",
    ".elc-scale .spanel.expanded{flex-basis:420px;border-radius:35px;filter:brightness(1)}",
    ".elc-scale .closed{position:absolute;inset:0;background:var(--cc,#555);display:grid;place-items:center;transition:opacity .3s}",
    ".elc-scale .spanel.expanded .closed{opacity:0}",
    ".elc-scale .closed .clogo{width:56px;height:56px;border-radius:50%;object-fit:cover}",
    ".elc-scale .closed .cfb{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-size:24px;font-weight:800;color:#fff;background:rgba(0,0,0,.25)}",
    ".elc-scale .open{position:absolute;inset:0;display:flex;flex-direction:row;align-items:center;gap:20px;padding:22px;opacity:0;transition:opacity .35s .12s;width:420px;height:280px;border-radius:35px;background:rgba(255,255,255,0);backdrop-filter:blur(0px) url(#lg-filter) blur(0px) saturate(1.5) brightness(1.1);-webkit-backdrop-filter:blur(8px) saturate(1.8) brightness(1.15) contrast(1.05);box-shadow:inset 0 0 0 1px rgba(255,255,255,.15),inset 1.5px 1.5px 0 rgba(255,255,255,.5),inset 0 0 12px rgba(255,255,255,.2),0 8px 32px rgba(0,0,0,.2)}",
    ".elc-scale .spanel.expanded .open{opacity:1}",
    ".elc-scale .open::before{content:\"\";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(240px 150px at var(--mx,50%) var(--my,-30%),rgba(255,255,255,.35),rgba(255,255,255,0) 70%),linear-gradient(115deg,rgba(255,255,255,.18),rgba(255,255,255,0) 34%);mix-blend-mode:screen}",
    ".elc-scale .open .oleft{display:flex;flex-direction:column;align-items:center;gap:10px;flex-shrink:0}",
    ".elc-scale .open .ologo{width:88px;height:88px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 1px rgba(255,255,255,.14)}",
    ".elc-scale .open .afb{width:88px;height:88px;border-radius:50%;display:grid;place-items:center;font-size:36px;font-weight:800;color:var(--fg-strong,rgba(255,255,255,.92));background:var(--cc,#555);box-shadow:0 0 0 1px rgba(255,255,255,.14)}",
    ".elc-scale .open .osym{font-size:15px;font-weight:800;letter-spacing:.06em}",
    ".elc-scale .open .ochg{font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,.08)}",
    ".elc-scale .open .oright{flex:1;min-width:0}",
    ".elc-scale .open .oamt{font-size:13px;font-weight:600;color:var(--fg-dim,rgba(255,255,255,.6))}",
    ".elc-scale .open .oval{font-size:28px;font-weight:800;letter-spacing:-.03em;margin-top:6px;white-space:nowrap}",
    ".elc-scale .open .oprice{font-size:12px;font-weight:600;color:var(--fg-dim,rgba(255,255,255,.42));margin-top:6px}",
    ".elc-scale .foot{margin-top:24px;font-weight:600}"
  ].join("\n");

  var cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;
    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    // The liquid-glass refraction filter (#lg-filter) the glass
    // backdrop-filter points at: turbulence + blur + displacement.
    // Chromium applies it to the backdrop; WKWebView drops url() in
    // backdrop-filter and uses the -webkit-backdrop-filter frost
    // instead, so this SVG is harmless there. Without it,
    // url(#lg-filter) would resolve to nothing.
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    svg.innerHTML = '<defs><filter id="lg-filter" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="92" result="noise"/><feGaussianBlur in="noise" stdDeviation="2" result="blurred"/><feDisplacementMap in="SourceGraphic" in2="blurred" scale="77" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
    (document.body || document.documentElement).appendChild(svg);
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

   // ---- Ledger: curved gallery ----
   // Port of the 21st.dev circular gallery idea (drag/scroll + bend +
   // snap), rewritten in plain JS: no React, no OGL, no build step. The
   // cards are DOM, so coin photos are real <img> logos and the amount and
   // value stay crisp text. The desktop wallpaper ignores mouse events,
   // so the strip drifts slowly on its own there and only takes drag or
   // wheel input where a pointer reaches it (the settings preview).
   var LEDGER_CARD_W = 110, LEDGER_CARD_H = 150, LEDGER_STEP = 300;
  // Scale factor for the Ledger: min(vw/1280, vh/720), clamped. The theme
  // preview lays the content out at 1280x720, so at that size the factor
  // is 1 and nothing changes there; on the full-size wallpaper it grows
  // the cards so the composition matches the preview.
  var ledgerScale = 1;

   function mountLedger(container, snap, opts) {
     injectCSS();
     var root = document.createElement("div");
     root.className = "elc elc-ledger";
     container.appendChild(root);
     var s = snap || null, o = opts || {};
     var alive = true, raf = 0, totalRaf = 0, curTotal = null;
     var current = 0, target = 0, dragging = false, dragStartX = 0, dragStartTarget = 0;
     var lastInteract = 0, wheelTimer = 0, prev = 0;
     var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
     var cards = [], centerOff = 0, centered = false;
     // Cursor state. Swift polls the global cursor at 30fps and forwards
     // it through window.Momo.setMouse, which dispatches a bubbling
     // pointermove on #bg-layer — so this window listener sees the real
     // cursor even though the wallpaper window ignores mouse events.
     // In the settings preview the same listener gets real mouse events.
     var mouse = { x: -9999, y: -9999, inside: false };
     var lastMouseMove = 0;
     var steerIndex = -1, lastPickX = -9999, steerSettled = false;

     function ledScale() {
       var vw = root.clientWidth || window.innerWidth || 1280;
       var vh = root.clientHeight || window.innerHeight || 720;
        var s = Math.min(vw / 1280, vh / 720);
        s = Math.max(0.5, Math.min(2, s));
       if (Math.abs(s - ledgerScale) > 0.01) {
         ledgerScale = s;
         root.style.setProperty("--ls", s.toFixed(3));
       }
       return ledgerScale;
     }

     function amtStr(amt, sym) {
       var a = (amt != null) ? amt : 0;
       return (a >= 1 ? a.toLocaleString("en-US", { maximumFractionDigits: 4 }) : a.toPrecision(4)) + " " + sym;
     }

     function cardHTML(c, cur) {
       var val = c.price * ((c.amount != null) ? c.amount : 0);
       var big = c.logo ? c.logo.replace("64x64", "128x128") : "";
       var photo = big
         ? '<img class="photo" draggable="false" src="' + esc(big) + '" alt="' + esc(c.symbol) + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';">' +
           '<span class="ph-fallback" style="display:none">' + esc((c.symbol || "?").slice(0, 1)) + '</span>'
         : '<span class="ph-fallback">' + esc((c.symbol || "?").slice(0, 1)) + '</span>';
       return photo +
         '<div class="sym">' + esc(c.symbol) + '</div>' +
         '<div class="chg ' + cls(c.change24h) + '">' + pct(c.change24h) + '</div>' +
         '<div class="hold"><div class="amt">' + esc(amtStr(c.amount, c.symbol)) + '</div>' +
         '<div class="val">' + money(val, cur) + '</div></div>';
     }

     function animateTotal() {
       if (!s || !s.portfolio) return;
       var targetV = s.portfolio.value;
       var cur = s.portfolio.currency || "USD";
       var el = root.querySelector(".total");
       if (!el) return;
       var from = (curTotal != null) ? curTotal : targetV;
       if (reduce || Math.abs(from - targetV) < 0.005) {
         curTotal = targetV;
         el.textContent = money(targetV, cur);
         return;
       }
       if (totalRaf) cancelAnimationFrame(totalRaf);
       var start0 = performance.now();
       function frame(ts) {
         if (!alive) return;
         var elapsed = ts - start0;
         var progress = Math.min(elapsed / 700, 1);
         var eased = 1 - Math.pow(1 - progress, 3);
         var val = from + (targetV - from) * eased;
         curTotal = val;
         el.textContent = money(val, cur);
         if (progress < 1) totalRaf = requestAnimationFrame(frame);
         else { curTotal = targetV; el.textContent = money(targetV, cur); totalRaf = 0; }
       }
       totalRaf = requestAnimationFrame(frame);
     }

     function draw() {
       var cur = (s && s.portfolio && s.portfolio.currency) || "USD";
       var head;
       if (s && s.portfolio) {
         var p = s.portfolio;
         var coins = s.coins || [];
         var ups = coins.filter(function (c) { return c.change24h > 0.0005; }).length;
         var downs = coins.filter(function (c) { return c.change24h < -0.0005; }).length;
         head = '<div class="lhead"><div><div class="eyebrow">Ledger · Holdings</div>' +
           '<div class="total">' + money(p.value, cur) + '</div>' +
           '<div class="delta ' + cls(p.change24h) + '">' + pct(p.change24h) + ' today</div></div>' +
           '<div class="counts">' + coins.length + ' holdings<br>' + ups + ' up · ' + downs + ' down</div></div>';
       } else {
         head = '<div class="lhead"><div><div class="eyebrow">Ledger · Holdings</div><div class="total">—</div></div></div>';
       }
       var body = '<div class="gallery"></div>';
       if (!s || !(s.coins || []).length) {
         body = '<div class="gallery"><div style="position:absolute;inset:0;display:grid;place-items:center;color:var(--fg-dim,rgba(255,255,255,.42));font-size:14px">Waiting for live data…</div></div>';
       }
       root.innerHTML = head + body + '<div class="foot">' + esc(foot(s)) + '</div>';
       buildCards();
       bind();
       animateTotal();
     }

     function buildCards() {
       var g = root.querySelector(".gallery");
       cards = [];
       steerIndex = -1;
       steerSettled = false;
       if (!g || !s || !(s.coins || []).length) return;
       var cur = (s.portfolio && s.portfolio.currency) || "USD";
       var coins = s.coins.slice().sort(function (a, b) {
         return (b.price * (b.amount || 0)) - (a.price * (a.amount || 0));
       });
       var vw = g.clientWidth || window.innerWidth || 1920;
       var ls = ledScale();
       var STEP = LEDGER_STEP * ls;
       var copies = Math.max(1, Math.ceil((vw + STEP * 2) / (coins.length * STEP)));
       var list = [];
       for (var k = 0; k < copies; k++) list = list.concat(coins);
       cards = list.map(function (c) {
         var el = document.createElement("div");
         el.className = "gcard";
         el.innerHTML = cardHTML(c, cur);
         g.appendChild(el);
         return { el: el };
       });
       if (!centered) {
         var W = cards.length * STEP;
         centerOff = (((W - ((vw / 2 - (LEDGER_CARD_W * ls) / 2) + STEP)) % W) + W) % W;
         current = target = centerOff;
         centered = true;
       }
       layout(current);
     }

     function layout(offset) {
       var g = root.querySelector(".gallery");
       if (!g || !cards.length) return;
       var vw = g.clientWidth || window.innerWidth || 1920;
       var ls = ledScale();
       var CW = LEDGER_CARD_W * ls, CH = LEDGER_CARD_H * ls, STEP = LEDGER_STEP * ls;
       var W = cards.length * STEP;
       if (W <= 0) return;
       var grect = g.getBoundingClientRect();
       var gy = grect.top + grect.height / 2;
       var gcy = (g.clientHeight || 0) / 2;
       // Mouse in layout coords: on the desktop the gallery fills the
       // window so this is the identity, but in the theme preview the
       // 1280x720 layer is scaled down, so convert via the rect.
       var msc = (grect.width / (vw || 1)) || 1;
       var mlx = (mouse.x - grect.left) / msc;
       var mly = (mouse.y - grect.top) / msc;
       var off = ((offset % W) + W) % W;
       for (var i = 0; i < cards.length; i++) {
         var el = cards[i].el;
         var x = (((i * STEP - off) % W) + W) % W - STEP;
         if (x < -STEP - 60 || x > vw + 60) { el.style.display = "none"; continue; }
         el.style.display = "flex";
         var cx = x + CW / 2;
         var d = (cx - vw / 2) / (vw / 2);
         var ad = Math.abs(d);
         var rot = d * 36;
         var drop = Math.pow(Math.min(ad, 1.4), 2.2) * 14 * ls;
         var scale = 1 - Math.min(ad, 1.2) * 0.10;
         var op = 1 - Math.min(ad, 1.4) * 0.30;
         // Cursor: lean the card toward it and park the specular pool under it.
         var tiltX = 0, tiltY = 0, mx = 50, my = -30;
         if (mouse.inside) {
           var dx = (mlx - cx) / (CW / 2);
           var dy = (mly - (gcy + drop)) / (CH / 2);
           var dist = Math.sqrt(dx * dx + dy * dy);
           if (dist < 2.5) {
             var cl = Math.max(-1, Math.min(1, dx)), ct = Math.max(-1, Math.min(1, dy));
             tiltX = ct * 8;
             tiltY = -cl * 10;
             mx = Math.max(0, Math.min(100, ((mlx - x) / CW) * 100));
             my = Math.max(0, Math.min(100, ((mly - (gcy - CH / 2 + drop)) / CH) * 100));
           }
         }
         el.style.setProperty("--mx", mx.toFixed(1) + "%");
         el.style.setProperty("--my", my.toFixed(1) + "%");
         el.style.zIndex = String(100 - Math.round(Math.min(ad, 1.4) * 50));
         el.style.opacity = op.toFixed(3);
         el.style.transform = "translate3d(" + x.toFixed(1) + "px," + drop.toFixed(1) + "px,0) rotateY(" + (rot + tiltY).toFixed(2) + "deg) rotateX(" + tiltX.toFixed(2) + "deg) scale(" + scale.toFixed(3) + ")";
       }
     }

     function snap() {
       target = centerOff + Math.round((target - centerOff) / (LEDGER_STEP * ledgerScale)) * (LEDGER_STEP * ledgerScale);
     }

     function tick(t) {
       if (!alive) return;
       var now = (typeof t === "number") ? t : performance.now();
       if (!prev) prev = now;
       var dt = Math.min(now - prev, 100);
       prev = now;
       if (!dragging && !reduce) {
         if (mouse.inside && now - lastMouseMove < 2500) {
           // Steer: glide the card under the cursor to the centre. This is
           // the only way to move the strip on the desktop — the wallpaper
           // window ignores mouse events, so drag and wheel never arrive
           // there; they still work in the settings preview. The pick locks
           // to one card: re-picking every frame would chase the neighbour
           // as the strip moves under a still cursor.
           var gg = root.querySelector(".gallery");
           if (gg && cards.length) {
             var vw2 = gg.clientWidth || window.innerWidth || 1920;
             var ls2 = ledgerScale;
             var STEP2 = LEDGER_STEP * ls2, CW2 = LEDGER_CARD_W * ls2;
             var W2 = cards.length * STEP2;
             var gr2 = gg.getBoundingClientRect();
             var msc2 = (gr2.width / (vw2 || 1)) || 1;
             var mlx2 = (mouse.x - gr2.left) / msc2;
             if (Math.abs(mouse.x - lastPickX) > 30) steerSettled = false;
            if (steerIndex < 0 && !steerSettled) {
               var off2 = ((current % W2) + W2) % W2;
               var best = -1, bd = Infinity;
               for (var ci = 0; ci < cards.length; ci++) {
                 var xx2 = (((ci * STEP2 - off2) % W2) + W2) % W2 - STEP2;
                 if (xx2 < -STEP2 - 60 || xx2 > vw2 + 60) continue;
                 var ccx2 = xx2 + CW2 / 2;
                 var dd2 = Math.abs(mlx2 - ccx2);
                 if (dd2 < bd) { bd = dd2; best = ci; }
               }
               steerIndex = best;
               lastPickX = mouse.x;
             }
             if (steerIndex >= 0) {
               var off3 = ((current % W2) + W2) % W2;
               var xx3 = (((steerIndex * STEP2 - off3) % W2) + W2) % W2 - STEP2;
               var cx3 = xx3 + CW2 / 2;
               target = current + (cx3 - vw2 / 2);
               if (Math.abs(cx3 - vw2 / 2) < 2) { steerIndex = -1; steerSettled = true; }
             }
           }
         } else if (now - lastInteract > 2500) {
           target += (16 * ledgerScale * dt) / 1000;
         }
       }
       var ease = reduce ? 1 : 0.06;
       current += (target - current) * ease;
       if (Math.abs(target - current) < 0.05) current = target;
       layout(current);
       raf = requestAnimationFrame(tick);
     }

     function onDown(e) {
       dragging = true;
       dragStartX = e.clientX;
       dragStartTarget = target;
       lastInteract = performance.now();
       var g = root.querySelector(".gallery");
       if (g) {
         g.classList.add("dragging");
         try { g.setPointerCapture(e.pointerId); } catch (err) {}
       }
     }
     function onMove(e) {
       if (!dragging) return;
       target = dragStartTarget - (e.clientX - dragStartX) * 1.2;
     }
     function onUp() {
       if (!dragging) return;
       dragging = false;
       lastInteract = performance.now();
       var g = root.querySelector(".gallery");
       if (g) g.classList.remove("dragging");
       snap();
     }
     function onWheel(e) {
       target += (e.deltaY || 0) * 0.6;
       lastInteract = performance.now();
       if (wheelTimer) clearTimeout(wheelTimer);
       wheelTimer = setTimeout(snap, 180);
     }

     function bind() {
       var g = root.querySelector(".gallery");
       if (!g) return;
       g.addEventListener("pointerdown", onDown);
       g.addEventListener("pointermove", onMove);
       g.addEventListener("pointerup", onUp);
       g.addEventListener("pointercancel", onUp);
       g.addEventListener("wheel", onWheel, { passive: true });
     }

     function onMouseMove(e) {
       mouse.x = e.clientX;
       mouse.y = e.clientY;
       mouse.inside = true;
       lastMouseMove = performance.now();
     }
     function onMouseLeave() { mouse.inside = false; }
     window.addEventListener("pointermove", onMouseMove);
     window.addEventListener("pointerleave", onMouseLeave);

     return {
       update: function (newSnap, newOpts) {
         if (newSnap) s = newSnap;
         if (newOpts) o = newOpts;
         draw();
       },
       destroy: function () {
         alive = false;
         if (raf) cancelAnimationFrame(raf);
         if (totalRaf) cancelAnimationFrame(totalRaf);
         if (wheelTimer) clearTimeout(wheelTimer);
         window.removeEventListener("pointermove", onMouseMove);
         window.removeEventListener("pointerleave", onMouseLeave);
         if (root.parentNode) root.parentNode.removeChild(root);
       },
       start: function () { if (!raf) raf = requestAnimationFrame(tick); }
     };
   }

  // ---- Scale: expanding accordion ----
  // Port of the 21st.dev image gallery idea (narrow panels that grow on
  // hover), rewritten in plain JS. Closed panels show just the coin icon
  // on a colour sampled from the logo's edge; the open panel is short
  // (250px) liquid glass with the icon on the left and the amount and
  // value on the right. The desktop wallpaper has no hover, so the panel
  // under the cursor opens (cursor position arrives through
  // window.Momo.setMouse) and the strip auto-cycles while the cursor
  // is away.
  var COIN_COLORS = { BTC: "#F7931A", ETH: "#627EEA", SOL: "#9945FF", BNB: "#F0B90B", XRP: "#25A4E8", DOGE: "#C2A633", ADA: "#0033AD", AVAX: "#E84142", LINK: "#2A5ADA", TON: "#0098EA" };

  function coinColor(sym) {
    if (COIN_COLORS[sym]) return COIN_COLORS[sym];
    var h = 0;
    for (var i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) % 360;
    return "hsl(" + h + ",70%,55%)";
  }

  // Panel colour from the logo itself. Averaging the raw edge pixels is
  // wrong for real CMC logos: some are full-bleed squares on a black
  // background (SOL came out black), some are light (ETH came out
  // near-white) or dark (XRP came out near-black), and some are small
  // marks the rim never touches (ADA, TON gave no sample at all). So:
  // work out the background from the corners, ignore it, take the
  // outermost pixels of the actual icon, and keep only the most vivid
  // hue there. If the icon has no vivid edge colour, return null and
  // the caller keeps the brand colour — the tile still looks like
  // its icon. Verified against the real top-10 logos: BTC orange,
  // SOL teal, BNB gold, DOGE tan, ADA blue, AVAX red, LINK blue,
  // TON light blue sampled; ETH and XRP fall back to brand blue.
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6; if (h < 0) h += 1;
    }
    return [h, mx ? d / mx : 0, mx];
  }
  var edgeColorCache = {};
  function edgeColorFor(sym, logo, cb) {
    if (edgeColorCache[sym]) { cb(edgeColorCache[sym]); return; }
    if (!logo) { cb(null); return; }
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      try {
        var cv = document.createElement("canvas");
        cv.width = 64; cv.height = 64;
        var cx = cv.getContext("2d");
        if (!cx) { cb(null); return; }
        cx.drawImage(img, 0, 0, 64, 64);
        var d = cx.getImageData(0, 0, 64, 64).data;
        function at(x, y) { var o = (y * 64 + x) * 4; return [d[o], d[o + 1], d[o + 2], d[o + 3]]; }
        var corners = [at(0, 0), at(63, 0), at(0, 63), at(63, 63)];
        var op = corners.filter(function (c) { return c[3] > 100; });
        var bg = null;
        if (op.length >= 3) {
          var rs = op.map(function (c) { return c[0]; }), gs = op.map(function (c) { return c[1]; }), bs = op.map(function (c) { return c[2]; });
          if (Math.max.apply(null, rs) - Math.min.apply(null, rs) < 30 && Math.max.apply(null, gs) - Math.min.apply(null, gs) < 30 && Math.max.apply(null, bs) - Math.min.apply(null, bs) < 30)
            bg = [rs.reduce(function (a, b) { return a + b; }) / rs.length, gs.reduce(function (a, b) { return a + b; }) / gs.length, bs.reduce(function (a, b) { return a + b; }) / bs.length];
        }
        function isBg(p) {
          if (p[3] <= 100) return true;
          if (!bg) return false;
          return Math.abs(p[0] - bg[0]) < 24 && Math.abs(p[1] - bg[1]) < 24 && Math.abs(p[2] - bg[2]) < 24;
        }
        var fg = [];
        for (var y = 0; y < 64; y++) for (var x = 0; x < 64; x++) {
          var p = at(x, y);
          if (!isBg(p)) fg.push([Math.min(x, y, 63 - x, 63 - y), p[0], p[1], p[2]]);
        }
        if (fg.length < 20) { cb(null); return; }
        var dmin = Math.min.apply(null, fg.map(function (f) { return f[0]; }));
        var ring = fg.filter(function (f) { return f[0] <= dmin + 2; });
        var hsv = ring.map(function (f) { return [rgbToHsv(f[1], f[2], f[3]), f]; });
        var smax = Math.max.apply(null, hsv.map(function (h) { return h[0][1]; }));
        if (smax < 0.6) { cb(null); return; }
        var h0 = hsv.filter(function (h) { return h[0][1] === smax; })[0][0][0];
        var sel = hsv.filter(function (h) { var dh = Math.abs(h[0][0] - h0); dh = Math.min(dh, 1 - dh); return h[0][1] >= 0.5 && dh <= 25 / 360; }).map(function (h) { return h[1]; });
        if (!sel.length) { cb(null); return; }
        var r = Math.round(sel.reduce(function (a, f) { return a + f[1]; }, 0) / sel.length);
        var g = Math.round(sel.reduce(function (a, f) { return a + f[2]; }, 0) / sel.length);
        var b = Math.round(sel.reduce(function (a, f) { return a + f[3]; }, 0) / sel.length);
        if (rgbToHsv(r, g, b)[2] < 0.2) { cb(null); return; }
        var col = "rgb(" + r + "," + g + "," + b + ")";
        edgeColorCache[sym] = col;
        cb(col);
      } catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = logo;
  }

  function mountScale(container, snap, opts) {
    injectCSS();
    var root = document.createElement("div");
    root.className = "elc elc-scale";
    container.appendChild(root);
    var s = snap || null, o = opts || {};
    var alive = true, raf = 0, totalRaf = 0, curTotal = null;
    var expanded = 0, lastSwitch = performance.now();
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var mouse = { x: -9999, y: -9999, inside: false };
    var panels = [];

    function amtStr(amt, sym) {
      var a = (amt != null) ? amt : 0;
      return (a >= 1 ? a.toLocaleString("en-US", { maximumFractionDigits: 4 }) : a.toPrecision(4)) + " " + sym;
    }

    function panelHTML(c, cur) {
      var val = c.price * ((c.amount != null) ? c.amount : 0);
      var big = c.logo ? c.logo.replace("64x64", "128x128") : "";
      var fb = esc((c.symbol || "?").slice(0, 1));
      var closedImg = c.logo
        ? '<img class="clogo" draggable="false" src="' + esc(c.logo) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';">' +
          '<span class="cfb" style="display:none">' + fb + '</span>'
        : '<span class="cfb">' + fb + '</span>';
      var openImg = big
        ? '<img class="ologo" draggable="false" src="' + esc(big) + '" alt="' + esc(c.symbol) + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';">' +
          '<span class="afb" style="display:none">' + fb + '</span>'
        : '<span class="afb">' + fb + '</span>';
      return '<div class="closed">' + closedImg + '</div>' +
        '<div class="open"><div class="oleft">' + openImg +
        '<div class="osym">' + esc(c.symbol) + '</div>' +
        '<div class="ochg ' + cls(c.change24h) + '">' + pct(c.change24h) + '</div></div>' +
        '<div class="oright"><div class="oamt">' + esc(amtStr(c.amount, c.symbol)) + '</div>' +
        '<div class="oval">' + money(val, cur) + '</div>' +
        '<div class="oprice">@ ' + price(c.price, cur) + '</div></div></div>';
    }

    function animateTotal() {
      if (!s || !s.portfolio) return;
      var targetV = s.portfolio.value;
      var cur = s.portfolio.currency || "USD";
      var el = root.querySelector(".total");
      if (!el) return;
      var from = (curTotal != null) ? curTotal : targetV;
      if (reduce || Math.abs(from - targetV) < 0.005) {
        curTotal = targetV;
        el.textContent = money(targetV, cur);
        return;
      }
      if (totalRaf) cancelAnimationFrame(totalRaf);
      var start0 = performance.now();
      function frame(ts) {
        if (!alive) return;
        var elapsed = ts - start0;
        var progress = Math.min(elapsed / 700, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var val = from + (targetV - from) * eased;
        curTotal = val;
        el.textContent = money(val, cur);
        if (progress < 1) totalRaf = requestAnimationFrame(frame);
        else { curTotal = targetV; el.textContent = money(targetV, cur); totalRaf = 0; }
      }
      totalRaf = requestAnimationFrame(frame);
    }

    function draw() {
      var cur = (s && s.portfolio && s.portfolio.currency) || "USD";
      var head;
      if (s && s.portfolio) {
        var p = s.portfolio;
        head = '<div class="eyebrow">Scale · Holdings</div>' +
          '<div class="total">' + money(p.value, cur) + '</div>' +
          '<div class="delta"><span class="' + cls(p.change24h) + '">' + pct(p.change24h) + '</span> today</div>';
      } else {
        head = '<div class="eyebrow">Scale · Holdings</div><div class="total">—</div>';
      }
      var coins = (s && s.coins ? s.coins.slice() : []).sort(function (a, b) {
        return (b.price * (b.amount || 0)) - (a.price * (a.amount || 0));
      }).slice(0, 10);
      var gallery = '<div class="sgallery">' + coins.map(function (c, i) {
        return '<div class="spanel' + (i === expanded ? ' expanded' : '') + '" data-sym="' + esc(c.symbol) + '" style="--cc:' + (edgeColorCache[c.symbol] || coinColor(c.symbol)) + '">' + panelHTML(c, cur) + '</div>';
      }).join("") + '</div>';
      if (!s || !coins.length) {
        gallery = '<div class="sgallery"><div style="display:grid;place-items:center;color:var(--fg-dim,rgba(255,255,255,.42));font-size:14px">Waiting for live data…</div></div>';
      }
      root.innerHTML = head + gallery + '<div class="foot">' + esc(foot(s)) + '</div>';
      panels = Array.prototype.slice.call(root.querySelectorAll(".spanel"));
      if (expanded >= panels.length) expanded = 0;
      animateTotal();
      // Paint each closed tile with the colour sampled from its logo's edge.
      coins.forEach(function (c) {
        if (!c.logo) return;
        edgeColorFor(c.symbol, c.logo, function (col) {
          if (!col) return;
          var el = root.querySelector('.spanel[data-sym="' + c.symbol + '"]');
          if (el) el.style.setProperty("--cc", col);
        });
      });
    }

    function setExpanded(i) {
      if (i === expanded || i < 0 || i >= panels.length) return;
      expanded = i;
      panels.forEach(function (el, j) { el.classList.toggle("expanded", j === i); });
    }

    function tick(t) {
      if (!alive) return;
      var now = (typeof t === "number") ? t : performance.now();
      var g = root.querySelector(".sgallery");
      if (g && panels.length) {
        var r = g.getBoundingClientRect();
        var near = mouse.inside && mouse.y >= r.top - 60 && mouse.y <= r.bottom + 60 &&
          mouse.x >= r.left - 40 && mouse.x <= r.right + 40;
        if (near) {
          // The panel under the cursor wins. Expanding shifts the panel
          // centres, so nearest-centre alone would open the neighbour
          // instead; fall back to it only when the cursor is between panels.
          var best = -1;
          panels.forEach(function (el, i) {
            var pr = el.getBoundingClientRect();
            if (best < 0 && mouse.x >= pr.left && mouse.x <= pr.right) best = i;
          });
          if (best < 0) {
            var bd = Infinity;
            panels.forEach(function (el, i) {
              var pr = el.getBoundingClientRect();
              var dc = Math.abs(mouse.x - (pr.left + pr.width / 2));
              if (dc < bd) { bd = dc; best = i; }
            });
          }
          setExpanded(best);
          lastSwitch = now;
          var open = panels[expanded];
          if (open) {
            var or = open.getBoundingClientRect();
            open.style.setProperty("--mx", (Math.max(0, Math.min(100, ((mouse.x - or.left) / or.width) * 100))).toFixed(1) + "%");
            open.style.setProperty("--my", (Math.max(0, Math.min(100, ((mouse.y - or.top) / or.height) * 100))).toFixed(1) + "%");
          }
        } else if (!reduce && now - lastSwitch > 4500) {
          setExpanded((expanded + 1) % panels.length);
          lastSwitch = now;
        }
      }
      raf = requestAnimationFrame(tick);
    }

    function onMouseMove(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.inside = true;
    }
    function onMouseLeave() { mouse.inside = false; }
    window.addEventListener("pointermove", onMouseMove);
    window.addEventListener("pointerleave", onMouseLeave);

    return {
      update: function (newSnap, newOpts) {
        if (newSnap) s = newSnap;
        if (newOpts) o = newOpts;
        draw();
      },
      destroy: function () {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        if (totalRaf) cancelAnimationFrame(totalRaf);
        window.removeEventListener("pointermove", onMouseMove);
        window.removeEventListener("pointerleave", onMouseLeave);
        if (root.parentNode) root.parentNode.removeChild(root);
      },
      start: function () { if (!raf) raf = requestAnimationFrame(tick); }
    };
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
    Ledger: { mount: function (c, s, o) { var h = mountLedger(c, s, o); h.update(s, o); h.start(); return h; } },
    Scale: { mount: function (c, s, o) { var h = mountScale(c, s, o); h.update(s, o); h.start(); return h; } }
  };
})();
