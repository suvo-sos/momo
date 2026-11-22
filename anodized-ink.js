// Anodized Ink — vanilla JS port of the 21st.dev React component.
// No React, no build step: a plain <script> that mounts a WebGL2 canvas
// into any container. Used by skin.html (second theme background) and
// settings.html (second theme preview box).
// The ink colour is live: mount() returns { update, destroy }, and update()
// takes new colors, so the wallpaper can re-tint the ink as the market moves.
// Original: Anodized Ink (SIGILLIAM-inspired), rebuilt without three.js.
(function () {
  "use strict";

  var MAX_RIPPLES = 6;
  var RIPPLE_LIFE = 4;

  var PRESETS = {
    crimson: { deep: "#030000", ink: "#d1001c", sheen: "#c9c9c9" },
    cobalt: { deep: "#00020a", ink: "#1f4dff", sheen: "#d4ddff" },
    venom: { deep: "#000401", ink: "#1fd65f", sheen: "#dcffe8" },
    aurum: { deep: "#040200", ink: "#d49a12", sheen: "#fff0c4" },
    orchid: { deep: "#030007", ink: "#a51cff", sheen: "#ecd9ff" }
  };

  function hexToRgb(hex) {
    var h = String(hex).trim().replace(/^#/, "");
    if (h.length === 3 || h.length === 4) {
      h = h.slice(0, 3).split("").map(function (c) { return c + c; }).join("");
    } else if (h.length === 8) {
      h = h.slice(0, 6);
    }
    if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
    var n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // One triangle that covers the viewport, built from gl_VertexID — no buffers.
  var VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

  var FRAG = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;        // centred, y up, in units of the canvas height
uniform float uHover;       // 0 idle drift, 1 pointer inside
uniform float uEnergy;      // smoothed pointer speed
uniform vec3 uDeep;
uniform vec3 uInk;
uniform vec3 uSheen;
uniform float uTurbulence;
uniform float uScale;
uniform float uSheenAmt;
uniform float uGrain;
uniform float uGlow;
uniform float uSwirl;
uniform float uVignette;
uniform vec4 uRipples[6];   // xy centre, z start time, w strength

out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p;
    a *= 0.5;
  }
  return v;
}

// The ink. A slow fbm drift first, so the sine folds never line up into an
// obvious tile, then the iterated warp that gives the suspended-ink banding.
float inkField(vec2 p, float t) {
  vec2 q = p + 0.45 * uTurbulence * vec2(
    fbm(p * 0.9 + vec2(t * 0.07, 0.0)),
    fbm(p * 0.9 + vec2(3.1, -t * 0.05))
  );
  float s = 0.5 * uTurbulence;
  for (float i = 1.0; i < 5.0; i++) {
    q.x += s * sin(q.y * i + t * 0.5);
    q.y += s * cos(q.x * i + t * 0.5);
    s *= 0.6;
  }
  return sin(q.x * 2.0 + q.y * 2.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;
  vec2 m = uMouse;

  // The field leans a little away from the light — a cheap parallax.
  vec2 p = uv - m * 0.05;

  // Stir: twist the field around the pointer, harder when it moves fast.
  vec2 d = p - m;
  float twist = uSwirl * (0.45 * uHover + uEnergy) * 1.5 * exp(-dot(d, d) * 9.0);
  float cs = cos(twist);
  float sn = sin(twist);
  p = m + mat2(cs, -sn, sn, cs) * d;

  // Ink drops: a damped ring that pushes the field radially as it passes.
  float ring = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 rp = uRipples[i];
    float age = t - rp.z;
    if (rp.w <= 0.0 || age < 0.0 || age > 4.0) continue;
    vec2 dd = uv - rp.xy;
    float rr = length(dd);
    float x = rr - age * 0.42;
    float env = exp(-x * x * 55.0) * exp(-age * 1.15) * rp.w;
    p += (dd / max(rr, 1e-3)) * sin(x * 40.0) * env * 0.04;
    ring += env * (0.5 + 0.5 * sin(x * 40.0));
  }

  vec2 q = p * 2.4 * uScale + vec2(0.9, 0.5);

  // Height and its gradient, by finite differences on the same field.
  float e = 0.01;
  float h = inkField(q, t);
  float hx = inkField(q + vec2(e, 0.0), t);
  float hy = inkField(q + vec2(0.0, e), t);
  vec3 n = normalize(vec3((h - hx) / e * 0.11, (h - hy) / e * 0.11, 1.0));

  float pattern = smoothstep(0.3, 0.7, h);
  vec3 col = mix(uDeep, uInk, pattern);
  // Pools darker, crests hotter — the ink has body instead of a flat fill.
  col *= 0.6 + 0.6 * smoothstep(0.5, 1.0, h);

  // Key light up-left, swung toward the pointer.
  vec3 L = normalize(vec3((m - uv) * 1.4, 0.0) + vec3(-0.35, 0.5, 0.8));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 56.0);
  float fres = pow(1.0 - n.z, 1.5);

  // Anodizing: a thin oxide film shifts hue with the angle of the surface.
  vec3 film = 0.5 + 0.5 * cos(6.28318 * (fres * 1.3 + h * 0.18 + vec3(0.0, 0.33, 0.67)));
  vec3 sheenCol = mix(uSheen, uSheen * film * 1.5, 0.3 * pattern);
  col += sheenCol * spec * uSheenAmt * (0.12 + 0.88 * pattern);
  col += mix(uInk, film * uInk.r + uInk * 0.5, 0.4) * fres * 0.5 * pattern * uSheenAmt;

  // The liquid light that follows the pointer.
  float dist = length(uv - m);
  col += uInk * (0.1 / (dist + 0.1)) * 0.22 * uGlow * (0.45 + 0.55 * uHover);

  // Drop rings catch the light on their crests.
  col += (uInk * 0.35 + uSheen * 0.08) * ring;

  float vig = smoothstep(1.25, 0.15, length(uv * vec2(0.85, 1.0)));
  col *= mix(1.0, vig, uVignette);

  // Film grain, re-rolled each frame, plus a dither so the blacks never band.
  float g = hash21(gl_FragCoord.xy + fract(t * 7.13) * vec2(97.3, 41.7));
  col += (g - 0.5) * 0.07 * uGrain;
  col += (hash21(gl_FragCoord.yx + 13.7) - 0.5) / 255.0;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

  function compile(gl, vert, frag) {
    var program = gl.createProgram();
    if (!program) return null;
    var list = [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]];
    for (var i = 0; i < list.length; i++) {
      var shader = gl.createShader(list[i][0]);
      if (!shader) return null;
      gl.shaderSource(shader, list[i][1]);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("anodized-ink:", gl.getShaderInfoLog(shader));
        return null;
      }
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("anodized-ink:", gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  function merge(target, src) {
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
    return target;
  }

  /**
   * Mount Anodized Ink into a container element.
   * options: { preset='crimson', colors={deep,ink,sheen}, speed=1, turbulence=1,
   *   scale=1, sheen=1, grain=1, glow=1, swirl=1, vignette=0.6,
   *   interactive=true, ripples=true, maxDpr=1.5, height }
   * Returns { update(newOptions), destroy() }. update() re-tints the ink live
   * (colors) and tweaks the numeric params without rebuilding the GL context.
   * The container must have a size; the canvas fills it.
   */
  function mount(container, options) {
    options = options || {};
    var interactive = options.interactive !== undefined ? options.interactive : true;
    var maxDpr = options.maxDpr !== undefined ? options.maxDpr : 1.5;
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var palette = merge(merge({}, PRESETS[options.preset] || PRESETS.crimson), options.colors || {});
    var params = {
      deep: hexToRgb(palette.deep),
      ink: hexToRgb(palette.ink),
      sheen: hexToRgb(palette.sheen),
      speed: options.speed !== undefined ? options.speed : 1,
      turbulence: options.turbulence !== undefined ? options.turbulence : 1,
      scale: options.scale !== undefined ? options.scale : 1,
      sheenAmt: options.sheen !== undefined ? options.sheen : 1,
      grain: options.grain !== undefined ? options.grain : 1,
      glow: options.glow !== undefined ? options.glow : 1,
      swirl: options.swirl !== undefined ? options.swirl : 1,
      vignette: options.vignette !== undefined ? options.vignette : 0.6,
      ripples: options.ripples !== undefined ? options.ripples : true
    };

    var root = document.createElement("div");
    root.style.position = "relative";
    root.style.overflow = "hidden";
    root.style.width = "100%";
    root.style.height = options.height || "100%";
    root.style.background = palette.deep;
    container.appendChild(root);

    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    root.appendChild(canvas);

    var kick = function () {};
    var cleanup = null;
    var destroyed = false;

    function showFallback() {
      var div = document.createElement("div");
      div.setAttribute("aria-hidden", "true");
      div.style.position = "absolute";
      div.style.inset = "0";
      div.style.background =
        "radial-gradient(ellipse 60% 45% at 30% 35%, " + palette.ink + "cc, transparent 70%), " +
        "radial-gradient(ellipse 50% 40% at 75% 70%, " + palette.ink + "88, transparent 70%), " +
        "radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.8) 100%), " +
        palette.deep;
      root.appendChild(div);
    }

    function setup() {
      var gl = canvas.getContext("webgl2", {
        antialias: false,
        alpha: false,
        depth: false,
        powerPreference: "high-performance"
      });
      if (!gl) { showFallback(); return function () {}; }

      var program = compile(gl, VERT, FRAG);
      if (!program) { showFallback(); return function () {}; }
      // The vertex shader needs no attributes, but a bound VAO keeps every
      // driver happy about the draw.
      var vao = gl.createVertexArray();

      function u(name) { return gl.getUniformLocation(program, name); }
      var loc = {
        res: u("uRes"), time: u("uTime"), mouse: u("uMouse"), hover: u("uHover"),
        energy: u("uEnergy"), deep: u("uDeep"), ink: u("uInk"), sheen: u("uSheen"),
        turbulence: u("uTurbulence"), scale: u("uScale"), sheenAmt: u("uSheenAmt"),
        grain: u("uGrain"), glow: u("uGlow"), swirl: u("uSwirl"),
        vignette: u("uVignette"), ripples: u("uRipples")
      };

      var drops = new Float32Array(MAX_RIPPLES * 4);
      var nextDrop = 0;

      // Pointer state, all in shader space: centred, y up, units of height.
      var target = { x: 0.18, y: 0.08 };
      var mouse = { x: 0.18, y: 0.08 };
      var hoverTarget = 0;
      var hover = 0;
      var energy = 0;
      // A still frame lands on an interesting moment of the flow, not t = 0.
      var simTime = reduced ? 14 : 0;
      var clock = 0;
      var last = 0;
      var raf = 0;
      var visible = true;

      function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, Math.max(0.5, maxDpr));
        var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
      }

      function draw(now) {
        raf = 0;
        var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
        last = now;
        resize();
        var P = params;

        if (reduced) {
          mouse.x = target.x;
          mouse.y = target.y;
          hover = hoverTarget;
          energy = 0;
        } else {
          clock += dt;
          simTime += dt * P.speed;
          // Nobody is steering: the light wanders on a slow Lissajous path.
          if (hoverTarget === 0) {
            var aspect = canvas.width / canvas.height;
            target.x = Math.sin(clock * 0.21) * 0.32 * aspect;
            target.y = Math.sin(clock * 0.17 + 1.3) * 0.22;
          }
          var px = mouse.x;
          var py = mouse.y;
          var k = 1 - Math.exp(-dt * (hoverTarget ? 7 : 1.5));
          mouse.x += (target.x - mouse.x) * k;
          mouse.y += (target.y - mouse.y) * k;
          hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 3));
          var v = hoverTarget ? Math.hypot(mouse.x - px, mouse.y - py) / Math.max(dt, 1e-3) : 0;
          energy += (Math.min(v * 0.6, 1.4) - energy) * (1 - Math.exp(-dt * 4));
        }

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.uniform2f(loc.res, canvas.width, canvas.height);
        gl.uniform1f(loc.time, simTime);
        gl.uniform2f(loc.mouse, mouse.x, mouse.y);
        gl.uniform1f(loc.hover, hover);
        gl.uniform1f(loc.energy, energy);
        gl.uniform3fv(loc.deep, P.deep);
        gl.uniform3fv(loc.ink, P.ink);
        gl.uniform3fv(loc.sheen, P.sheen);
        gl.uniform1f(loc.turbulence, P.turbulence);
        gl.uniform1f(loc.scale, P.scale);
        gl.uniform1f(loc.sheenAmt, P.sheenAmt);
        gl.uniform1f(loc.grain, P.grain);
        gl.uniform1f(loc.glow, P.glow);
        gl.uniform1f(loc.swirl, P.swirl);
        gl.uniform1f(loc.vignette, P.vignette);
        gl.uniform4fv(loc.ripples, drops);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);

        if (!reduced && visible) raf = requestAnimationFrame(draw);
      }

      kick = function () {
        if (!raf) raf = requestAnimationFrame(draw);
      };
      kick();

      var resizeObserver = new ResizeObserver(kick);
      resizeObserver.observe(canvas);

      // Off-screen, a full-screen shader is pure waste: stop until it is back.
      var visibility = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) {
          last = 0;
          kick();
        }
      });
      visibility.observe(root);

      function toShader(e) {
        var rect = root.getBoundingClientRect();
        var h = rect.height || 1;
        return {
          x: (e.clientX - rect.left - rect.width / 2) / h,
          y: -(e.clientY - rect.top - rect.height / 2) / h
        };
      }
      function onMove(e) {
        if (!interactive) return;
        var p = toShader(e);
        target.x = p.x;
        target.y = p.y;
        hoverTarget = 1;
        if (reduced) kick();
      }
      function onLeave() {
        hoverTarget = 0;
        if (reduced) kick();
      }
      function onDown(e) {
        if (!interactive) return;
        onMove(e);
        // A drop is motion; reduced motion keeps the light but skips the rings.
        if (reduced || !params.ripples) return;
        var p = toShader(e);
        var i = (nextDrop++ % MAX_RIPPLES) * 4;
        drops[i] = p.x;
        drops[i + 1] = p.y;
        drops[i + 2] = simTime;
        drops[i + 3] = 1;
      }
      // Drops store sim time; if speed is 0 they would hang forever, so they are
      // also retired on the wall clock.
      var retire = window.setInterval(function () {
        for (var i = 0; i < MAX_RIPPLES; i++) {
          if (drops[i * 4 + 3] > 0 && Math.abs(simTime - drops[i * 4 + 2]) > RIPPLE_LIFE) drops[i * 4 + 3] = 0;
        }
      }, 1000);

      // A lost context leaves a permanently black canvas unless the whole setup
      // runs again, so ask for the restore and rebuild.
      function onLost(e) {
        e.preventDefault();
        cancelAnimationFrame(raf);
        raf = 0;
      }
      function onRestored() {
        if (destroyed) return;
        cleanup = setup();
      }

      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerdown", onDown);
      root.addEventListener("pointerleave", onLeave);
      root.addEventListener("pointercancel", onLeave);
      canvas.addEventListener("webglcontextlost", onLost);
      canvas.addEventListener("webglcontextrestored", onRestored);

      return function () {
        cancelAnimationFrame(raf);
        kick = function () {};
        window.clearInterval(retire);
        resizeObserver.disconnect();
        visibility.disconnect();
        root.removeEventListener("pointermove", onMove);
        root.removeEventListener("pointerdown", onDown);
        root.removeEventListener("pointerleave", onLeave);
        root.removeEventListener("pointercancel", onLeave);
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      };
    }

    cleanup = setup();

    function update(newOptions) {
      if (!newOptions) return;
      if (newOptions.colors) {
        palette = merge(palette, newOptions.colors);
        if (newOptions.colors.deep) params.deep = hexToRgb(palette.deep);
        if (newOptions.colors.ink) params.ink = hexToRgb(palette.ink);
        if (newOptions.colors.sheen) params.sheen = hexToRgb(palette.sheen);
        root.style.background = palette.deep;
      }
      if (newOptions.preset && PRESETS[newOptions.preset]) {
        palette = merge(merge({}, PRESETS[newOptions.preset]), newOptions.colors || {});
        params.deep = hexToRgb(palette.deep);
        params.ink = hexToRgb(palette.ink);
        params.sheen = hexToRgb(palette.sheen);
        root.style.background = palette.deep;
      }
      var map = { speed: "speed", turbulence: "turbulence", scale: "scale", sheen: "sheenAmt", grain: "grain", glow: "glow", swirl: "swirl", vignette: "vignette", ripples: "ripples" };
      for (var k in map) {
        if (newOptions[k] !== undefined) params[map[k]] = newOptions[k];
      }
      kick();
    }

    return {
      update: update,
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        if (cleanup) cleanup();
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.AnodizedInk = { mount: mount, PRESETS: PRESETS };
})();
