// Finance Bento — vanilla JS port of the 21st.dev React component
// (Roman Vasnev). No React, no build step: a plain <script> that mounts a
// full personal-finance dashboard into any container.
// The charts are plain DOM + SVG, as in the original — no dependencies.
// Momo uses it as the third theme: a complete visual dashboard instead of
// the minimal wallpaper panel. Live data (net worth, crypto) comes from the
// CMC snapshot; history, cash flow and stocks are demo
// shapes until a real source exists for them.
(function () {
  "use strict";

  var CSS = `.fpb{font-family:Geist,ui-sans-serif,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;color:#fff;width:100%;max-width:none;margin:0;height:100%}.fpb .grid{height:100%}
.fpb *{box-sizing:border-box}
.fpb .fpb-c{border-radius:24px}
.fpb .vbrow{display:flex;justify-content:flex-end;margin-top:16px}
.fpb{--acc:#E8FF1F;--t1:#fff;--t2:rgba(255,255,255,.56);--t3:rgba(255,255,255,.38);--hair:rgba(255,255,255,.14);--ease:cubic-bezier(.32,.72,0,1);
    --fiat:#FFFFFF;--stocks:#A9B2FF;--crypto:#FFB37A}
.fpb *{box-sizing:border-box}
.fpb .fpb-c{position:relative;padding:0;background:transparent;border:none;color:#fff;display:contents}
.fpb .fpb-c{display:block}.fpb .grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:20px;width:100%}
.fpb .h1{height:376px}
.fpb .h3{height:360px}
.fpb #nw{grid-column:span 4}
.fpb #alloc{grid-column:span 4}
.fpb #flow{grid-column:1 / span 4;height:600px}
.fpb #crypto{grid-column:span 4}
.fpb #stocks{grid-column:span 4}
@media (max-width:1199px){.fpb #nw{grid-column:span 12}
.fpb #alloc{grid-column:span 6;height:auto}
.fpb #flow{grid-column:1 / span 4;height:600px}
.fpb #crypto,.fpb #stocks{grid-column:span 6}}
@media (max-width:767px){.fpb .fpb-c{padding:16px 14px}
.fpb #nw{height:420px}
.fpb #nw .legend{flex:1 0 100%;order:3;margin-top:8px}
.fpb #nw .hrow{flex-wrap:wrap}
.fpb #nw .nrow{flex-wrap:wrap;gap:6px 16px}
.fpb #alloc{grid-column:span 12;grid-row:auto;height:376px}
.fpb #crypto,.fpb #stocks{grid-column:span 12}
.fpb .grid{gap:12px}}
.fpb .card{position:relative;border-radius:24px;overflow:hidden;opacity:0;transform:translateY(14px) scale(.985);transition:opacity .7s ease,transform .9s var(--ease);border:1px solid rgba(255,255,255,.08);box-shadow:0 8px 32px rgba(0,0,0,.4)}
.fpb .in .card{opacity:1;transform:none}
.fpb .card .rim{position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 0 0 1px rgba(255,255,255,.06);pointer-events:none;z-index:9}
.fpb .g{position:absolute;inset:0}
.fpb .core{position:absolute;left:10%;right:10%;top:16%;bottom:-6%;border-radius:90px;filter:blur(60px)}
.fpb .glass{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(20px)}
.fpb .glass .rim{display:none}
.fpb .solid{background:var(--acc);color:#0b0b0c}
.fpb .solid .rim{box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
.fpb .in-c{position:absolute;inset:0;padding:22px 24px;z-index:2}
.fpb .ttl{font-size:18px;font-weight:600;letter-spacing:-.02em;display:flex;align-items:center;gap:8px}
.fpb .cap{font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t2)}
.fpb .solid .cap{color:rgba(0,0,0,.55)}
.fpb .big{font-size:40px;font-weight:200;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
.fpb .delta{font:600 12.5px "Geist Mono",monospace;color:var(--acc);letter-spacing:-.02em}
.fpb .muted{font-size:12.5px;color:var(--t3);font-weight:500;letter-spacing:-.01em}
.fpb .chip{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:11px;background:rgba(0,0,0,.85);color:#fff;font:600 11px "Geist Mono",monospace;letter-spacing:-.02em}
.fpb .legend{display:flex;gap:16px;font-size:12px;font-weight:500;color:var(--t2)}
.fpb .legend span{display:inline-flex;align-items:center;gap:6px}
.fpb .legend i{width:8px;height:8px;border-radius:50%}
.fpb .row{display:flex;align-items:center;gap:12px;padding:0;border:0;grid-template-columns:none}
.fpb .mono{font-family:"Geist Mono",monospace;font-variant-numeric:tabular-nums}
.fpb .dots circle{transition:opacity .26s,transform .26s;transform-box:fill-box;transform-origin:center}
.fpb .tip{position:fixed;z-index:50;pointer-events:none;background:rgba(14,14,16,.92);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:9px 11px;font-size:12px;
    backdrop-filter:blur(16px);box-shadow:0 12px 30px -10px rgba(0,0,0,.6);opacity:0;transform:translateY(4px);transition:opacity .15s,transform .15s;white-space:nowrap;min-width:150px}
.fpb .tip.on{opacity:1;transform:none}
.fpb .tip .t{color:var(--t2);margin-bottom:5px;font-weight:500}
.fpb .tip .r{display:flex;justify-content:space-between;gap:14px;align-items:center;line-height:19px}
.fpb .tip .r span{display:inline-flex;align-items:center;gap:6px;color:var(--t2)}
.fpb .tip i{width:7px;height:7px;border-radius:50%}
.fpb .tip b{font:500 12px "Geist Mono",monospace}
.fpb .vb-badge{--vb-on:#6a5cff;display:inline-flex;align-items:center;gap:9px;height:34px;padding:0 12px 0 11px;border-radius:17px;background:#111113;border:1px solid rgba(255,255,255,.1);color:#fff;text-decoration:none;font:500 13px/1 Geist,sans-serif;letter-spacing:-.02em;box-shadow:0 8px 24px -14px rgba(0,0,0,.25);transition:border-color .25s}
.fpb .vb-badge:hover{border-color:color-mix(in oklab,var(--vb-on) 45%,transparent)}
.fpb .vb-mark{display:grid;grid-template-columns:repeat(5,3px);grid-template-rows:repeat(3,3px);gap:2px}
.fpb .vb-mark i{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.16);transition:background .3s}
.fpb .vb-mark i.on{background:var(--vb-on)}
.fpb .vb-badge:hover .vb-mark i.on{animation:vbw .9s cubic-bezier(.3,1.4,.4,1) calc(var(--x)*60ms) 1}
.fpb .vb-badge:hover .vb-mark i:not(.on){background:color-mix(in oklab,var(--vb-on) 22%,transparent)}
@keyframes vbw{0%,100%{transform:none}40%{transform:translateY(-2px) scale(1.35)}}
.fpb .vb-by{color:rgba(255,255,255,.5)}
.fpb .vb-arr{height:12px;width:0;margin-left:-9px;opacity:0;transform:translate(-4px,4px);transition:all .3s cubic-bezier(.2,.9,.25,1)}
.fpb .vb-badge:hover .vb-arr{width:12px;margin-left:0;opacity:1;transform:none}
@media (prefers-reduced-motion: reduce){.fpb .card{transition:none}}`;

  var cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;
    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    cssInjected = true;
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function markup(o) {
    return '<div class="fpb-c canvas">' +
      '<div class="grid" id="grid">' +
        '<section class="card h1" id="nw" aria-label="Net worth"></section>' +
        '' +
        '' +
        '' +
        '<section class="card h3" id="flow" aria-label="Cash flow"></section>' +
      '</div>' +
    '</div>' +
    (o.credit ? '<div class="vbrow"><a class="vb-badge" href="https://vasnev.art" target="_blank" rel="noopener" aria-label="Made by vasnev.art"><span class="vb-mark" id="vbm" aria-hidden="true"></span><span><span class="vb-by">by</span> vasnev.art</span><svg class="vb-arr" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 8.5l5-5M4.5 3.5h4v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a></div>' : '') +
    '<div class="tip" id="tip"></div>';
  }

  var GR = {
    blue: { top: "#b9a6ff", base: "#2e43ff", bottom: "#6d7dff", core: "#05082a" },
    graph: { top: "#9a9aa8", base: "#3a3a44", bottom: "#55555f", core: "#060608" },
    pink: { top: "#ffb3d6", base: "#ff2a85", bottom: "#ff6aa8", core: "#3a031c" },
    copper: { top: "#f6bf96", base: "#c2683a", bottom: "#dc8a5c", core: "#1d0b05" },
    green: { top: "#a6e8c8", base: "#36956f", bottom: "#58b58c", core: "#061d15" },
    lime: { top: "#f4ffb8", base: "#a3c400", bottom: "#c9e03a", core: "#121700" }
  };

  function bg(g) {
    return '<div class="g" style="background:linear-gradient(180deg,' + g.top + ' 0%,' + g.base + ' 36%,' + g.base + ' 74%,' + g.bottom + ' 100%)"></div><div class="core" style="background:' + g.core + '"></div>';
  }

  function smoothPath(P, move) {
    var d = (move === false ? "L" : "M") + P[0][0] + "," + P[0][1];
    for (var i = 0; i < P.length - 1; i++) {
      var p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2, k = 0.17;
      d += "C" + (p1[0] + (p2[0] - p0[0]) * k) + "," + (p1[1] + (p2[1] - p0[1]) * k) + " " + (p2[0] - (p3[0] - p1[0]) * k) + "," + (p2[1] - (p3[1] - p1[1]) * k) + " " + p2[0] + "," + p2[1];
    }
    return d;
  }

  // Dot-matrix digits for the net-worth total.
  var F = {
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
    "€": ["00111", "01000", "11110", "01000", "11110", "01000", "00111"],
    "£": ["00110", "01001", "01000", "11100", "01000", "01000", "11111"],
    "₹": ["11111", "01010", "11111", "00100", "00100", "00100", "00100"],
    ",": ["0", "0", "0", "0", "0", "1", "1"],
    " ": ["00", "00", "00", "00", "00", "00", "00"]
  };

  var NS = "http://www.w3.org/2000/svg";
  function el(t, a, p) {
    var e = document.createElementNS(NS, t);
    for (var k in a) e.setAttribute(k, a[k]);
    if (p) p.appendChild(e);
    return e;
  }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  /**
   * Mount the dashboard into a container.
   * mount(container, data, options) — options: { title, subtitle, avatar,
   * avatarAlt, credit }. Returns { update(newData, newOptions), destroy() }.
   * update() refreshes every card in place (no rebuild, no replayed
   * entrance animation). The container must have a width; the grid is
   * responsive (12 cols ≥1200px, stacked below 768px).
   */
  function mount(container, data, options) {
    options = options || {};
    injectCSS();

    var root = document.createElement("div");
    root.className = "fpb";
    root.innerHTML = markup({
      credit: !!options.credit
    });
    container.appendChild(root);

    var alive = true;
    var frames = new Set();
    function RAF(cb) {
      if (!alive) return 0;
      var id = requestAnimationFrame(function (t) { frames.delete(id); if (alive) cb(t); });
      frames.add(id);
      return id;
    }
    function $id(id) { return root.querySelector("#" + id); }

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ACC = "#E8FF1F", T2 = "rgba(255,255,255,.56)", T3 = "rgba(255,255,255,.38)";
    var COL = { fiat: "#FFFFFF", stocks: "#A9B2FF", crypto: "#FFB37A" };

    /* ---------- state ---------- */
    var S = { period: "1Y", ccy: "USD" };
    var RATE = { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.5 }, SYM = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };
    function money(v, o) {
      o = o || {};
      var dec = o.dec || 0;
      v *= RATE[S.ccy];
      var s = SYM[S.ccy];
      if (o.compact && Math.abs(v) >= 1000) return s + (v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1) + "K";
      return (v < 0 ? "−" : "") + s + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    }

    /* ---------- data ---------- */
    var H = [];
    function setData(d) {
      H = (d.history || []).map(function (h) {
        return { d: new Date(h.date), fiat: h.fiat, stocks: h.stocks, crypto: h.crypto };
      });
    }
    setData(data);
    function series() {
      if (S.period === "All") return H.map(function (h) {
        return { d: h.d, fiat: h.fiat, stocks: h.stocks, crypto: h.crypto, l: h.d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) };
      });
      if (S.period === "1Y") return H.slice(-12).map(function (h) {
        return { d: h.d, fiat: h.fiat, stocks: h.stocks, crypto: h.crypto, l: h.d.toLocaleDateString("en-US", { month: "short" }) };
      });
      var n = S.period === "3M" ? 13 : 5, src = H.slice(S.period === "3M" ? -4 : -2), out = [];
      for (var k = 0; k < n; k++) {
        var f = k / (n - 1) * (src.length - 1), i = Math.min(src.length - 2, Math.floor(f)), t = f - i, a = src[i], b = src[i + 1], w = Math.sin(k * 1.7) * 0.012;
        var dd = new Date(H[H.length - 1].d.getTime() - (n - 1 - k) * 7 * 864e5);
        out.push({ d: dd, l: dd.toLocaleDateString("en-US", { month: "short", day: "numeric" }), fiat: (a.fiat + (b.fiat - a.fiat) * t) * (1 + w * 0.3), stocks: (a.stocks + (b.stocks - a.stocks) * t) * (1 + w), crypto: (a.crypto + (b.crypto - a.crypto) * t) * (1 + w * 2.4) });
      }
      return out;
    }
    function total(p) { return p.fiat + p.stocks + p.crypto; }

    /* ---------- helpers ---------- */
    function DotNumber(host, pitch) {
      var cols = 48, svg = el("svg", { class: "dots", "aria-hidden": "true" }, host), cells = [];
      for (var c = 0; c < cols; c++) for (var r = 0; r < 7; r++) {
        var ci = el("circle", { cx: c * pitch + pitch / 2, cy: r * pitch + pitch / 2, r: pitch * 0.36, fill: "#fff", opacity: 0 }, svg);
        ci.style.transitionDelay = (c * 7) + "ms";
        cells.push([c, r, ci]);
      }
      function set(t) {
        var on = new Set(), x = 0;
        for (var chIdx = 0; chIdx < t.length; chIdx++) {
          var ch = t[chIdx], g = F[ch] || F[" "], w = g[0].length;
          for (var r = 0; r < 7; r++) for (var k = 0; k < w; k++) if (g[r][k] === "1") on.add((x + k) * 8 + r);
          x += w + 1;
        }
        var used = Math.max(1, x - 1);
        for (var i = 0; i < cells.length; i++) {
          var cc = cells[i][0], rr = cells[i][1], ci = cells[i][2];
          var v = on.has(cc * 8 + rr);
          ci.setAttribute("opacity", v ? 1 : (cc < used ? 0.08 : 0));
          ci.style.transform = v ? "none" : "scale(.55)";
        }
        svg.setAttribute("width", used * pitch);
        svg.setAttribute("height", 7 * pitch);
        svg.setAttribute("viewBox", "0 0 " + (used * pitch) + " " + (7 * pitch));
      }
      var raf = 0, cur = 0;
      return {
        count: function (to, dur) {
          dur = dur || 900;
          cancelAnimationFrame(raf);
          var from = cur, t0 = performance.now(), last = "";
          var f = function (now) {
            var t = reduce ? 1 : Math.min(1, (now - t0) / dur);
            cur = from + (to - from) * ease(t);
            var s = SYM[S.ccy] + Math.round(cur * RATE[S.ccy]).toLocaleString("en-US");
            if (s !== last) { set(s); last = s; }
            if (t < 1) raf = RAF(f);
          };
          raf = RAF(f);
        }
      };
    }
    function tween(node, to, fmt, dur) {
      dur = dur || 900;
      var from = +node.dataset.v || 0, t0 = performance.now();
      node.dataset.v = to;
      (function f(now) {
        var t = reduce ? 1 : Math.min(1, (now - t0) / dur);
        node.textContent = fmt(from + (to - from) * ease(t));
        if (t < 1) RAF(f);
      })(t0);
    }
    var tip = $id("tip");
    function showTip(x, y, title, rows) {
      tip.innerHTML = '<div class="t">' + esc(title) + "</div>" + rows.map(function (row) {
        return '<div class="r"><span>' + (row[2] ? '<i style="background:' + row[2] + '"></i>' : "") + esc(row[0]) + "</span><b>" + esc(row[1]) + "</b></div>";
      }).join("");
      tip.classList.add("on");
      var r = tip.getBoundingClientRect(), L = x + 16, T = y - r.height - 14;
      if (L + r.width > innerWidth - 8) L = x - r.width - 16;
      if (T < 8) T = y + 16;
      tip.style.left = L + "px";
      tip.style.top = T + "px";
    }
    function hideTip() { tip.classList.remove("on"); }

    /* ================= cards ================= */

    /* ---- Net worth: a stream of the three asset classes ---- */
    var nw = $id("nw");
    nw.innerHTML = bg(GR.blue) + '<div class="in-c" style="display:flex;flex-direction:column;align-items:center;justify-content:space-between;height:100%;text-align:center;padding:24px 16px">' +
      '<div class="ttl" style="margin-top:4px">Total Asset</div>' +
      '<div class="nwn"></div>' +
      '<div class="delta nwd" style="margin-bottom:8px"></div>' +
      '</div><div class="rim"></div>';
    var nwNum = DotNumber(nw.querySelector(".nwn"), innerWidth < 520 ? 8 : 12);
    var nwGrow = 0, nwData = null;
    function drawNW() {
      var svg = nw.querySelector(".nws");
      if (!svg) return;
      svg.setAttribute("width", W);
      svg.setAttribute("height", Hh);
      svg.setAttribute("viewBox", "0 0 " + W + " " + Hh);
      var D = nwData, n = D.length, tots = D.map(total), mx = Math.max.apply(null, tots), mn = Math.min.apply(null, tots), floor = mn - (mx - mn) * 0.9, half = (Hh - top - bot) / 2;
      function k(p) { return ((total(p) - floor) / (mx - floor)) * half * 2 / total(p); }
      function X(i) { return -20 + i / (n - 1) * (W + 40); }
      // grow from the centre line
      var g = ease(nwGrow);
      var lay = D.map(function (p) {
        var q = k(p) * g / 2, f = p.fiat * q, s = p.stocks * q, c = p.crypto * q;
        return { f: f, fs: f + s, fsc: f + s + c };
      });
      function band(key) {
        var T = D.map(function (p, i) { return [X(i), mid - lay[i][key]]; });
        var B = D.map(function (p, i) { return [X(i), mid + lay[i][key]]; }).reverse();
        return smoothPath(T) + smoothPath(B, false) + "Z";
      }
      var marks = [Math.round((n - 1) * 0.18), Math.round((n - 1) * 0.55), n - 1];
      svg.innerHTML =
        '<defs><linearGradient id="nwf" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".25" stop-color="#fff" stop-opacity="1"/></linearGradient>' +
          '<mask id="nwm"><rect width="' + W + '" height="' + Hh + '" fill="url(#nwf)"/></mask></defs>' +
        '<g mask="url(#nwm)"><path d="' + band("fsc") + '" fill="' + COL.crypto + '" opacity=".95"/><path d="' + band("fs") + '" fill="' + COL.stocks + '"/><path d="' + band("f") + '" fill="' + COL.fiat + '" opacity=".95"/></g>' +
        marks.map(function (i, kk) {
          var x = Math.min(W - 36, Math.max(36, X(i))), t = total(D[i]);
          return '<g style="opacity:' + (g > 0.6 ? 1 : 0) + ';transition:opacity .4s ' + (kk * 0.08) + 's">' +
            '<line x1="' + x + '" x2="' + x + '" y1="' + (top - 4) + '" y2="' + (Hh - bot + 4) + '" stroke="rgba(0,0,0,.55)" stroke-width="1.5"/>' +
            '<rect x="' + (x - 34) + '" y="' + (top - 14) + '" width="68" height="22" rx="11" fill="#000"/><text x="' + x + '" y="' + (top + 1) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#fff" font-family="Geist Mono">' + money(t, { compact: true }) + '</text>' +
            '<rect x="' + (x - 30) + '" y="' + (Hh - bot - 8) + '" width="60" height="22" rx="11" fill="#000"/><text x="' + x + '" y="' + (Hh - bot + 7) + '" text-anchor="middle" font-size="10.5" font-weight="500" fill="rgba(255,255,255,.7)" font-family="Geist Mono">' + D[i].l + '</text></g>';
        }).join("") +
        '<line class="hl" y1="' + top + '" y2="' + (Hh - bot) + '" stroke="#fff" stroke-width="1.5" opacity="0"/>' +
        '<rect width="' + W + '" height="' + Hh + '" fill="transparent" class="hit"/>';
      var hit = svg.querySelector(".hit"), hl = svg.querySelector(".hl");
      hit.addEventListener("mousemove", function (e) {
        var r = svg.getBoundingClientRect(), mxp = e.clientX - r.left;
        var i = Math.max(0, Math.min(n - 1, Math.round((mxp + 20) / (W + 40) * (n - 1))));
        var p = D[i];
        hl.setAttribute("x1", X(i)); hl.setAttribute("x2", X(i)); hl.setAttribute("opacity", "1");
        showTip(e.clientX, e.clientY, p.l, [
          ["Fiat", money(p.fiat), COL.fiat],
          ["Stocks", money(p.stocks), COL.stocks],
          ["Crypto", money(p.crypto), COL.crypto],
          ["Total", money(total(p)), null]
        ]);
      });
      hit.addEventListener("mouseleave", function () {
        hl.setAttribute("opacity", "0");
        hideTip();
      });
    }
    function renderNW() {
      nwData = series();
      var last = nwData[nwData.length - 1];
      var t = (cur && cur.netWorth) ? cur.netWorth : total(last);
      // Live 24h change from the CMC snapshot. The old code compared the
      // live total to the previous point of the demo history, so it showed
      // a wrong number (e.g. -28.7%) while the real change was +5.2%.
      var chg = (cur && typeof cur.change24h === "number") ? cur.change24h : 0;
      nwNum.count(t);
      var dEl = nw.querySelector(".nwd");
      dEl.textContent = (chg >= 0 ? "+" : "−") + Math.abs(chg * 100).toFixed(1) + "% today";
      dEl.style.color = chg >= 0 ? ACC : "#ff7a7a";
      /* nwc removed */
      if (nwGrow < 1 && !reduce) {
        var t0 = performance.now();
        (function grow(now) {
          nwGrow = Math.min(1, (now - t0) / 900);
          drawNW();
          if (nwGrow < 1) RAF(grow);
        })(t0);
      } else {
        nwGrow = 1;
        drawNW();
      }
    }

    /* ---- Allocation: donut gauge of fiat / stocks / crypto ---- */
    var alloc = $id("alloc");
    if (alloc) alloc.innerHTML = bg(GR.graph) + '<div class="in-c">' +
      '<div class="ttl">Allocation</div>' +
      '<div style="display:flex;justify-content:center;margin-top:14px"><svg class="donut" width="176" height="176" viewBox="0 0 176 176" aria-hidden="true"></svg></div>' +
      '<div class="alloc-rows" style="margin-top:16px;display:flex;flex-direction:column;gap:10px"></div>' +
      '</div><div class="rim"></div>';
    function renderAlloc() {
      if (!alloc) return;
      var last = H[H.length - 1];
      if (!last) return;
      var t = total(last);
      var parts = [
        { name: "Fiat", v: last.fiat, c: COL.fiat },
        { name: "Stocks", v: last.stocks, c: COL.stocks },
        { name: "Crypto", v: last.crypto, c: COL.crypto }
      ];
      var svg = alloc.querySelector(".donut");
      var R = 70, C = 2 * Math.PI * R, off = 0;
      var arcs = parts.map(function (p) {
        var len = p.v / t * C, s = '<circle cx="88" cy="88" r="' + R + '" fill="none" stroke="' + p.c + '" stroke-width="20" stroke-dasharray="' + Math.max(0, len - 2) + " " + C + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 88 88)"/>';
        off += len;
        return s;
      }).join("");
      svg.innerHTML = '<circle cx="88" cy="88" r="' + R + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="20"/>' + arcs +
        '<text x="88" y="84" text-anchor="middle" font-size="20" font-weight="600" fill="#fff" font-family="Geist">' + money(t, { compact: true }) + '</text>' +
        '<text x="88" y="104" text-anchor="middle" font-size="10.5" font-weight="500" fill="rgba(255,255,255,.55)" font-family="Geist Mono">TOTAL</text>';
      alloc.querySelector(".alloc-rows").innerHTML = parts.map(function (p) {
        return '<div class="row" style="justify-content:space-between"><span style="display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500"><i style="width:8px;height:8px;border-radius:50%;background:' + p.c + ';display:inline-block"></i>' + p.name + '</span>' +
          '<span class="mono" style="font-size:12.5px;color:' + T2 + '">' + Math.round(p.v / t * 100) + '% · ' + money(p.v, { compact: true }) + '</span></div>';
      }).join("");
    }

    /* ---- Cash flow: mirrored income / spending bars ---- */
    var flow = $id("flow");
    flow.innerHTML = bg(GR.green) + '<div class="in-c">' +
      '<div class="ttl" style="margin-bottom:14px">My Coins</div>' +
      '<div class="coins-list" style="display:flex;flex-direction:column;gap:10px;padding:0 24px 24px"></div>' +
      '</div><div class="rim"></div>';
    function renderFlow(d) {
      var holdings = (d && d.holdings) || [];
      var list = flow.querySelector(".coins-list");
      if (!list) return;
      list.innerHTML = "";
      holdings.forEach(function (c) {
        var amt = (c.amount != null) ? c.amount : 0;
        var val = (c.price || 0) * amt;
        var chgColor = c.change24h >= 0 ? ACC : "#ff7a7a";
        var logoSrc = c.logo ? c.logo : "";
        var item = document.createElement("div");
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.gap = "10px";
        item.style.padding = "10px 12px";
        item.style.borderRadius = "12px";
        item.style.background = "rgba(255,255,255,.06)";
        item.innerHTML =
          '<img src="' + esc(logoSrc) + '" class="coin-logo" style="width:34px;height:34px;border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';">' +
          '<span class="coin-sym" style="display:none;font-weight:700;letter-spacing:.02em">' + esc(c.symbol.slice(0, 3)) + '</span>' +
          '<div style="flex:1">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
          '<span style="font-weight:700;letter-spacing:.02em">' + esc(c.symbol) + '</span>' +
          '<span style="color:' + chgColor + ';font-weight:600;font-size:12px">' + (c.change24h != null ? pct(c.change24h) : "") + '</span>' +
          '</div>' +
          '<div class="mono" style="font-size:12px;color:rgba(255,255,255,.55);margin-top:3px">' +
          (amt >= 1 ? amt.toLocaleString('en-US', { maximumFractionDigits: 4 }) : amt.toPrecision(4)) + ' · ' + money(val, { compact: true }) +
          '</div>' +
          '</div>';
        list.appendChild(item);
      });
      if (holdings.length === 0) {
        list.insertAdjacentHTML("beforeend", '<div class="muted" style="margin-top:16px">No holdings</div>');
      }
    }

    /* ---- Crypto: 7-candle strips per asset ---- */
    var crypto = $id("crypto");
    if (crypto) crypto.innerHTML = bg(GR.copper) + '<div class="in-c">' +
      '<div class="ttl">Crypto</div>' +
      '<div class="crypto-rows" style="margin-top:16px;display:flex;flex-direction:column;gap:24px"></div></div><div class="rim"></div>';
    function renderCrypto(d) {
      if (!crypto) return;
      var rows = (d.crypto || []).slice(0, 3);
      crypto.querySelector(".crypto-rows").innerHTML = rows.map(function (c) {
        var ohlc = c.ohlc || [];
        var mn = Infinity, mx = -Infinity;
        ohlc.forEach(function (k) { mn = Math.min(mn, k[2]); mx = Math.max(mx, k[1]); });
        if (!isFinite(mn)) { mn = 0; mx = 1; }
        var W = 150, Hh = 54, pad = 2, span = Math.max(1e-9, mx - mn);
        function Y(v) { return pad + (1 - (v - mn) / span) * (Hh - pad * 2); }
        var cw = W / 7, candles = "";
        ohlc.forEach(function (k, i) {
          var x = i * cw + cw / 2, up = k[3] >= k[0], col = up ? "#4ade80" : "#ff7a7a";
          var yO = Y(k[0]), yC = Y(k[3]);
          candles += '<line x1="' + x + '" x2="' + x + '" y1="' + Y(k[1]) + '" y2="' + Y(k[2]) + '" stroke="' + col + '" stroke-width="1.4"/>' +
            '<rect x="' + (x - 3.4) + '" y="' + Math.min(yO, yC) + '" width="6.8" height="' + Math.max(2, Math.abs(yC - yO)) + '" rx="1.5" fill="' + col + '"/>';
        });
        var down = String(c.change || "").indexOf("−") === 0 || String(c.change || "").indexOf("-") === 0;
        return '<div><div class="row" style="justify-content:space-between"><span style="font-size:14px;font-weight:600">' + esc(c.symbol) + ' <span style="color:' + T2 + ';font-weight:500">· ' + esc(c.name) + '</span></span>' +
          '<span class="chip" style="background:' + (down ? "#ff7a7a" : "#4ade80") + ';color:#000">' + esc(c.change) + '</span></div>' +
          '<div class="row" style="justify-content:space-between;margin-top:8px"><svg width="' + W + '" height="' + Hh + '" viewBox="0 0 ' + W + " " + Hh + '" aria-hidden="true">' + candles + '</svg>' +
          '<span class="mono" style="font-size:12.5px;color:' + T2 + '">' + Math.round(c.share * 100) + '%</span></div></div>';
      }).join("") || '<div class="muted">No crypto yet</div>';
    }

    /* ---- Stocks: weekly volume bars ---- */
    var stocks = $id("stocks");
    if (stocks) stocks.innerHTML = bg(GR.pink) + '<div class="in-c">' +
      '<div class="ttl">Stocks</div><div class="muted" style="margin-top:4px">Weekly volume · thousands</div>' +
      '<svg class="stocks-svg" style="display:block;margin-top:20px" aria-hidden="true"></svg></div><div class="rim"></div>';
    function renderStocks(d) {
      var st = d.stocks || { days: [], values: [] };
      var days = st.days || [], vals = st.values || [];
      var svg = stocks.querySelector(".stocks-svg");
      var W = Math.max(1, stocks.clientWidth - 48), Hh = 225, max = Math.max.apply(null, vals.concat([1]));
      var gap = W / Math.max(1, days.length), bw = Math.min(34, gap * 0.5);
      svg.setAttribute("width", W);
      svg.setAttribute("height", Hh);
      svg.setAttribute("viewBox", "0 0 " + W + " " + Hh);
      var html = "";
      for (var i = 0; i < days.length; i++) {
        var h = (vals[i] || 0) / max * 130, cx = gap * i + gap / 2;
        html += '<rect x="' + (cx - bw / 2) + '" y="' + (Hh - 28 - h) + '" width="' + bw + '" height="' + h + '" rx="6" fill="#A9B2FF"/>' +
          '<text x="' + cx + '" y="' + (Hh - 32 - h) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#fff" font-family="Geist Mono">' + (vals[i] || 0).toFixed(1) + '</text>' +
          '<text x="' + cx + '" y="' + (Hh - 8) + '" text-anchor="middle" font-size="11" font-weight="500" fill="rgba(255,255,255,.6)" font-family="Geist">' + esc(days[i]) + '</text>';
      }
      svg.innerHTML = html;
    }

    /* ---------- render all / update / destroy ---------- */
    var cur = data;
    function renderAll() {
      renderNW();
      renderFlow(cur);
    }
    var resizeRaf = 0;
    function onResize() {
      if (resizeRaf) return;
      resizeRaf = RAF(function () {
        resizeRaf = 0;
        renderAll();
      });
    }
    window.addEventListener("resize", onResize);
    // The charts size from their boxes; re-render when the box itself
    // changes size (e.g. a hidden pane becoming visible).
    var rootObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      rootObserver = new ResizeObserver(onResize);
      rootObserver.observe(root);
    }

    renderAll();
    // The entrance animation targets the .fpb-c wrapper, not the .fpb root
    // (the CSS selector is `.fpb .in .card` — .in must be a child of .fpb).
    // Apply immediately AND via RAF so cards never stay invisible if the
    // animation frame is dropped (e.g. hidden webview / reduced motion).
    (function show() {
      var c = root.querySelector(".fpb-c");
      if (c) c.classList.add("in");
    })();
    RAF(function () {
      var c = root.querySelector(".fpb-c");
      if (c) c.classList.add("in");
    });

    return {
      update: function (newData, newOptions) {
        if (newData) {
          cur = newData;
          setData(newData);
        }
        if (newOptions) {
          if (newOptions.subtitle !== undefined) {
            var asof = $id("asof");
            if (asof) asof.textContent = newOptions.subtitle;
          }
        }
        renderAll();
      },
      destroy: function () {
        alive = false;
        frames.forEach(function (id) { cancelAnimationFrame(id); });
        frames.clear();
        window.removeEventListener("resize", onResize);
        if (rootObserver) rootObserver.disconnect();
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.FinanceBento = { mount: mount };
})();
