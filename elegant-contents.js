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
    // Focus: one huge total, best/worst movers, quiet list.
    ".elc-focus{display:flex;flex-direction:column;justify-content:center;height:100%;padding:48px 64px}",
    ".elc-focus .total{font-size:clamp(56px,9vw,110px);font-weight:200;letter-spacing:-.03em;line-height:1;margin:18px 0 12px}",
    ".elc-focus .delta{font-size:15px;font-weight:500;letter-spacing:.01em;color:var(--fg-mute,rgba(255,255,255,.42))}",
    ".elc-focus .delta b{font-weight:600}",
    ".elc-focus .hair{margin:34px 0 0}",
    ".elc-focus .movers{display:flex;gap:64px;margin:26px 0 8px}",
    ".elc-focus .mover .lbl{font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--fg-dim,rgba(255,255,255,.42));margin-bottom:8px}",
    ".elc-focus .mover .sym{font-size:20px;font-weight:600;letter-spacing:.04em}",
    ".elc-focus .mover .val{font-size:13px;color:var(--fg-dim,rgba(255,255,255,.42));margin-top:5px}",
    ".elc-focus .mover .chg{font-size:20px;font-weight:500;margin-top:5px}",
    ".elc-focus .rest{margin-top:26px;display:grid;grid-template-columns:1fr 1fr;gap:0 48px}",
    ".elc-focus .row{display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;border-top:1px solid var(--hair-soft,rgba(255,255,255,.045));font-size:13px}",
    ".elc-focus .row .s{font-weight:600;letter-spacing:.06em}",
    ".elc-focus .row .p{color:var(--fg-dim,rgba(255,255,255,.42))}",
    ".elc-focus .foot{margin-top:30px}",
    // Ledger: statement table with thin change bars.
    ".elc-ledger{display:flex;flex-direction:column;justify-content:center;height:100%;padding:48px 64px}",
    ".elc-ledger .head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px}",
    ".elc-ledger .head .t{font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}",
    ".elc-ledger .total{font-size:clamp(40px,5vw,64px);font-weight:200;letter-spacing:-.02em;line-height:1}",
    ".elc-ledger .delta{font-size:14px;font-weight:500;margin-top:10px}",
    ".elc-ledger table{width:100%;border-collapse:collapse;margin-top:28px}",
    ".elc-ledger th{font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--fg-dim,rgba(255,255,255,.42));text-align:left;padding:0 0 10px;border-bottom:1px solid var(--hair,rgba(255,255,255,.08))}",
    ".elc-ledger th:nth-child(2),.elc-ledger th:nth-child(3){text-align:right}",
    ".elc-ledger td{padding:11px 0;border-bottom:1px solid var(--hair-soft,rgba(255,255,255,.045));font-size:13px}",
    ".elc-ledger td.s{font-weight:600;letter-spacing:.06em}",
    ".elc-ledger td.p,.elc-ledger td.c{text-align:right}",
    ".elc-ledger td.p{color:var(--fg-dim,rgba(255,255,255,.42))}",
    ".elc-ledger .bar{height:2px;background:var(--hair,rgba(255,255,255,.08));margin-top:7px;border-radius:1px;overflow:hidden}",
    ".elc-ledger .bar i{display:block;height:100%;border-radius:1px}",
    ".elc-ledger .bar i.up{background:var(--up,#6fd39a)}",
    ".elc-ledger .bar i.down{background:var(--down,#e8735f)}",
    ".elc-ledger .summary{margin-top:22px;font-size:12px;color:var(--fg-mute,rgba(255,255,255,.42));letter-spacing:.02em}",
    ".elc-ledger .summary b{color:var(--fg-strong,rgba(255,255,255,.92));font-weight:600}",
    // Scale: coins plotted on a 24h-change axis, ranked below.
    ".elc-scale{display:flex;flex-direction:column;justify-content:center;height:100%;padding:48px 64px}",
    ".elc-scale .total{font-size:clamp(40px,5vw,64px);font-weight:200;letter-spacing:-.02em;line-height:1;margin:14px 0 8px}",
    ".elc-scale .delta{font-size:14px;font-weight:500;color:var(--fg-mute,rgba(255,255,255,.42))}",
    ".elc-scale .axis{position:relative;height:120px;margin:44px 0 10px}",
    ".elc-scale .track{position:absolute;left:0;right:0;top:60px;height:1px;background:var(--hair,rgba(255,255,255,.08))}",
    ".elc-scale .zero{position:absolute;top:52px;bottom:52px;width:1px;background:var(--fg-dim,rgba(255,255,255,.42))}",
    ".elc-scale .tick{position:absolute;top:60px;font-size:10px;color:var(--fg-dim,rgba(255,255,255,.42));transform:translateX(-50%);padding-top:10px;white-space:nowrap}",
    ".elc-scale .dot{position:absolute;top:60px;transform:translate(-50%,-50%)}",
    ".elc-scale .dot i{display:block;width:9px;height:9px;border-radius:50%;margin:0 auto}",
    ".elc-scale .dot.up i{background:var(--up,#6fd39a)}",
    ".elc-scale .dot.down i{background:var(--down,#e8735f)}",
    ".elc-scale .dot span{display:block;margin-top:8px;font-size:11px;font-weight:600;letter-spacing:.05em;white-space:nowrap}",
    ".elc-scale .dot em{display:block;font-style:normal;font-size:10px;color:var(--fg-dim,rgba(255,255,255,.42));margin-top:2px;white-space:nowrap}",
    ".elc-scale .dot.above span{margin-top:0;margin-bottom:8px}",
    ".elc-scale .dot.above em{margin-top:0;margin-bottom:2px}",
    ".elc-scale .dot.above{transform:translate(-50%,-100%)}",
    ".elc-scale .dot.above i{margin-top:8px}",
    ".elc-scale .rank{margin-top:18px}",
    ".elc-scale .row{display:flex;align-items:baseline;gap:16px;padding:8px 0;border-top:1px solid var(--hair-soft,rgba(255,255,255,.045));font-size:13px}",
    ".elc-scale .row .n{font-size:11px;color:var(--fg-dim,rgba(255,255,255,.42));width:18px}",
    ".elc-scale .row .s{font-weight:600;letter-spacing:.06em;width:56px}",
    ".elc-scale .row .p{color:var(--fg-dim,rgba(255,255,255,.42));flex:1}",
    ".elc-scale .row .c{font-weight:500}",
    ".elc-scale .foot{margin-top:24px}"
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
    function draw() { root.innerHTML = render(snap, opts); }
    return {
      update: function (newSnap, newOpts) {
        if (newSnap) snap = newSnap;
        if (newOpts) opts = newOpts;
        draw();
      },
      destroy: function () {
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  function sortedCoins(snap) {
    return (snap && snap.coins ? snap.coins.slice() : []).sort(function (a, b) { return b.change24h - a.change24h; });
  }

  // ---- Focus ----
  function renderFocus(snap) {
    if (!snap) return '<div class="eyebrow">Portfolio</div><div class="total">—</div>';
    var cur = snap.portfolio.currency || "USD";
    var p = snap.portfolio;
    var d = dollarChange(p);
    var ranked = sortedCoins(snap);
    var best = ranked[0], worst = ranked[ranked.length - 1];
    var rest = ranked.slice(1, -1).slice(0, 8);
    function mover(label, c) {
      if (!c) return "";
      return '<div class="mover"><div class="lbl">' + label + '</div>' +
        '<div class="sym">' + esc(c.symbol) + '</div>' +
        '<div class="val">' + price(c.price, cur) + '</div>' +
        '<div class="chg ' + cls(c.change24h) + '">' + pct(c.change24h) + '</div></div>';
    }
    return '<div class="eyebrow">Portfolio · Today</div>' +
      '<div class="total">' + money(p.value, cur) + '</div>' +
      '<div class="delta"><b class="' + cls(p.change24h) + '">' + pct(p.change24h) + '</b> today · ' +
        (d >= 0 ? "+" : "−") + money(Math.abs(d), cur) + '</div>' +
      '<div class="hair"></div>' +
      '<div class="movers">' + mover("Best today", best) + mover("Worst today", worst) + '</div>' +
      '<div class="rest">' + rest.map(function (c) {
        return '<div class="row"><span class="s">' + esc(c.symbol) + '</span>' +
          '<span class="p">' + price(c.price, cur) + '</span>' +
          '<span class="' + cls(c.change24h) + '">' + pct(c.change24h) + '</span></div>';
      }).join("") + '</div>' +
      '<div class="foot">' + esc(foot(snap)) + '</div>';
  }

  // ---- Ledger ----
  function renderLedger(snap) {
    if (!snap) return '<div class="head"><span class="t">Ledger</span></div><div class="total">—</div>';
    var cur = snap.portfolio.currency || "USD";
    var p = snap.portfolio;
    var coins = (snap.coins || []).slice(0, 10);
    var maxAbs = Math.max.apply(null, coins.map(function (c) { return Math.abs(c.change24h); }).concat([0.01]));
    var ups = coins.filter(function (c) { return c.change24h > 0.0005; }).length;
    var downs = coins.filter(function (c) { return c.change24h < -0.0005; }).length;
    var ranked = sortedCoins(snap);
    var t = snap.at ? new Date(snap.at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "";
    return '<div class="head"><span class="t">Ledger</span><span class="eyebrow">' + esc(t) + '</span></div>' +
      '<div class="total">' + money(p.value, cur) + '</div>' +
      '<div class="delta ' + cls(p.change24h) + '">' + pct(p.change24h) + ' today</div>' +
      '<table><thead><tr><th>Asset</th><th>Price</th><th>24h</th></tr></thead><tbody>' +
      coins.map(function (c) {
        var w = Math.max(2, Math.abs(c.change24h) / maxAbs * 100);
        return '<tr><td class="s">' + esc(c.symbol) + '</td>' +
          '<td class="p">' + price(c.price, cur) + '</td>' +
          '<td class="c"><span class="' + cls(c.change24h) + '">' + pct(c.change24h) + '</span>' +
          '<div class="bar"><i class="' + cls(c.change24h) + '" style="width:' + w.toFixed(1) + '%"></i></div></td></tr>';
      }).join("") + '</tbody></table>' +
      '<div class="summary">' + ups + ' up · ' + downs + ' down' +
      (ranked[0] ? ' · Best <b>' + esc(ranked[0].symbol) + ' ' + pct(ranked[0].change24h) + '</b>' : "") +
      (ranked.length ? ' · Worst <b>' + esc(ranked[ranked.length - 1].symbol) + ' ' + pct(ranked[ranked.length - 1].change24h) + '</b>' : "") +
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

  window.ElegantContents = {
    Focus: { mount: function (c, s, o) { var h = baseMount(c, "elc-focus", renderFocus); h.update(s, o); return h; } },
    Ledger: { mount: function (c, s, o) { var h = baseMount(c, "elc-ledger", renderLedger); h.update(s, o); return h; } },
    Scale: { mount: function (c, s, o) { var h = baseMount(c, "elc-scale", renderScale); h.update(s, o); return h; } }
  };
})();
