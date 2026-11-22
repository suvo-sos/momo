// Holo Mosaic — vanilla JS port of the 21st.dev React component.
// A WebGL2 holographic mosaic: spectral tiles that flip, shimmer and ripple.
// No React, no build step: a plain <script> exposing window.HoloMosaic.mount.
// The shaders are the originals, verbatim. The part of the paste after the
// render() uniforms was cut off, so the frame loop, resize and pointer
// handling below are rebuilt to match the component's own state machine.
(function () {
  "use strict";

  var MAX_WAVES = 6;
  var MAX_RENDER_DIM = 2400;
  var TILE_PX = 52;
  var EYE = 1.15;
  var INTRO_SECONDS = 2.4;
  var WAVE_SECONDS = 4;
  var FILTERS = { none: 0, dither: 1, ascii: 2 };

  var SPECTRUMS = {
    full: [400, 700, 0],
    warm: [565, 700, 0],
    cool: [405, 565, 0],
    pearl: [420, 690, 0.55]
  };

  var VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  var FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uPixel;
uniform float uTime;
uniform float uClock;
uniform float uTile;
uniform vec2 uRot;
uniform float uGap;
uniform float uRound;
uniform float uBevel;
uniform float uScatter;
uniform float uTilt;
uniform float uSwirl;
uniform float uRipple;
uniform float uBands;
uniform float uSoft;
uniform float uIntensity;
uniform float uSaturation;
uniform vec3 uSpectrum;
uniform float uGlitter;
uniform float uSheen;
uniform float uGrain;
uniform vec3 uColor;
uniform vec3 uMetal;
uniform vec2 uLight;
uniform vec4 uHover;
uniform vec4 uWaves[${MAX_WAVES}];
uniform vec4 uIntro;
uniform float uFade;
uniform float uOpacity;
uniform float uLightMode;
uniform float uSeed;
uniform float uFrame;
uniform float uFilter;
uniform float uFilterSize;
out vec4 outColor;

float h21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float h31(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vn3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}

vec3 bump3y(vec3 x, vec3 yo) {
  return clamp(1.0 - x * x - yo, 0.0, 1.0);
}

vec3 spectral(float w) {
  float x = clamp((w - 400.0) / 300.0, 0.0, 1.0);
  vec3 c1 = vec3(3.54585104, 2.93225262, 2.41593945);
  vec3 x1 = vec3(0.69549072, 0.49228336, 0.27699880);
  vec3 y1 = vec3(0.02312639, 0.15225084, 0.52607955);
  vec3 c2 = vec3(3.90307140, 3.21182957, 3.96587128);
  vec3 x2 = vec3(0.11748627, 0.86755042, 0.66077860);
  vec3 y2 = vec3(0.84897130, 0.88445281, 0.73949448);
  return bump3y(c1 * (x - x1), y1) + bump3y(c2 * (x - x2), y2);
}

vec3 band(float lam) {
  float window = smoothstep(380.0, 425.0, lam) * (1.0 - smoothstep(680.0, 780.0, lam));
  if (window <= 0.0) return vec3(0.0);
  return spectral(mix(uSpectrum.x, uSpectrum.y, clamp((lam - 380.0) / 400.0, 0.0, 1.0))) * window;
}

float boxDist(vec2 p, float b, float r, out vec2 grad) {
  vec2 q = abs(p) - b + r;
  vec2 m = max(q, 0.0);
  float outside = length(m);
  vec2 sg = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
  grad = outside > 0.0 ? sg * m / outside : sg * (q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  return outside + min(max(q.x, q.y), 0.0) - r;
}

vec4 shade(vec2 frag, float solid) {
  vec2 c = frag - 0.5 * uRes;
  vec2 s = c / uRes.y;
  vec2 g = vec2(uRot.x * c.x + uRot.y * c.y, uRot.x * c.y - uRot.y * c.x) / uTile;
  vec2 id = floor(g);
  vec2 f = g - id - 0.5;
  vec2 gc = (id + 0.5) * uTile;
  vec2 cell = vec2(uRot.x * gc.x - uRot.y * gc.y, uRot.y * gc.x + uRot.x * gc.y) / uRes.y;
  vec2 seed = vec2(uSeed * 17.13, uSeed * 31.71);
  float h1 = h21(id + seed);
  float h2 = h21(id + seed + 19.7);
  float h3 = h21(id + seed + 41.3);

  float flip = 0.0;
  float presence = 1.0;
  if (uIntro.w > 0.0) {
    float k = clamp((uIntro.z - length(cell - uIntro.xy) * 0.85 - h1 * 0.22) / 0.75, 0.0, 1.0);
    float e = k * k * k * (k * (k * 6.0 - 15.0) + 10.0);
    flip = (1.0 - e) * 1.5707963;
    presence = e;
  }
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    vec4 w = uWaves[i];
    if (w.w <= 0.0) continue;
    float k = clamp(((uClock - w.z) * 0.95 - length(cell - w.xy)) / 0.2, 0.0, 1.0);
    flip += k * k * (3.0 - 2.0 * k) * 3.1415927;
  }

  float ca = cos(flip);
  float sa = sin(flip);
  float squash = max(abs(ca), 0.02);
  float half_ = 0.5 - 0.5 * uGap;
  vec2 grad;
  float d = boxDist(vec2(f.x / squash, f.y), half_, uRound * half_, grad);
  float aa = 1.2 / uTile;
  float aaD = mix(aa, aa / squash, abs(grad.x));
  float cover = mix((1.0 - smoothstep(-aaD, aaD, d)) * smoothstep(0.02, 0.08, abs(ca)), 1.0, solid);
  float alpha = cover * uOpacity;
  if (uFade > 0.0) {
    vec2 uv = frag / uRes;
    vec2 m = clamp(min(uv, 1.0 - uv) / max(uFade * 0.5, 1e-4), 0.0, 1.0);
    m = m * m * m * (m * (m * 6.0 - 15.0) + 10.0);
    alpha *= m.x * m.y;
  }
  if (alpha <= 0.002) return vec4(0.0);

  float edge = smoothstep(-0.02 - 0.07 * uBevel, 0.0, d) * uBevel;
  float inner = smoothstep(0.0, -0.09, d);
  vec3 n = normalize(vec3((vec2(h2, h3) - 0.5) * (0.5 * uTilt) + grad * edge * 0.55, 1.0));
  n = vec3(n.x * ca + n.z * sa, n.y, abs(n.z * ca - n.x * sa));
  vec3 N = vec3(uRot.x * n.x - uRot.y * n.y, uRot.y * n.x + uRot.x * n.y, n.z);
  vec2 hv = cell - uHover.xy;
  float hw = exp(-dot(hv, hv) / (uHover.z * uHover.z)) * uHover.w;
  N = normalize(N + vec3(-hv / uHover.z * hw * 1.3, 0.0));
  float turn = abs(sin(flip));

  float t = uTime;
  float flow = vn3(vec3(s * (1.4 * uSwirl) + seed * 0.013, t * 0.05));
  vec2 rc = vec2(0.15 + 0.22 * sin(t * 0.07), -0.05 + 0.16 * cos(t * 0.053));
  float rip = sin(length(s - rc) * 26.0 - t * 1.2) * 0.5 + 0.5;
  float phi = 6.2831853 * mix(flow, h1, uScatter) + uRipple * 0.9 * rip;
  vec3 T = vec3(cos(phi), sin(phi), 0.0);
  T = normalize(T - dot(T, N) * N);
  vec3 V = normalize(vec3(-s, ${EYE.toFixed(1)}));
  vec3 L = normalize(vec3(uLight, 1.0));
  float D = 1450.0 * uBands;
  vec3 sh = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float a = float(k) * 2.39996 + 0.7;
    vec3 Lk = normalize(vec3(uLight + vec2(cos(a), sin(a)) * sqrt((float(k) + 0.5) / 3.0) * uSoft, 1.0));
    float x = abs(dot(Lk + V, T)) * D;
    sh += band(x) + 0.6 * band(x * 0.5);
  }
  sh *= presence * (0.62 + 0.38 * inner) / 3.0;
  float lum = dot(sh, vec3(0.2126, 0.7152, 0.0722));
  sh = mix(vec3(lum), sh, uSaturation);
  sh = mix(sh, vec3(lum * 1.15 + 0.08 * presence), uSpectrum.z * 0.6);

  vec3 H = normalize(L + V);
  float ndh = max(dot(N, H), 0.0);
  float wide = pow(ndh, 34.0);
  float tight = pow(ndh, 700.0);
  vec2 spot = uLight * ${EYE.toFixed(1)};
  float pool = pow(max(1.0 - length(s - spot) * 2.1, 0.0), 2.5) * uSheen;

  float spark = 0.0;
  vec3 sparkColor = vec3(1.0);
  if (uGlitter > 0.0) {
    vec2 gq = frag / (uPixel * 6.0);
    vec2 gid = floor(gq) + seed;
    float gh = h21(gid + 3.7);
    if (gh < 0.05 + 0.25 * uGlitter) {
      vec2 off = vec2(h21(gid + 1.3), h21(gid + 5.9)) - 0.5;
      float r = length(fract(gq) - 0.5 - off * 0.45);
      vec3 gn = normalize(vec3((vec2(h21(gid + 9.1), h21(gid + 2.2)) - 0.5) * 0.7 + N.xy, 1.0));
      float twinkle = 0.55 + 0.45 * sin(t * (2.0 + 5.0 * gh) + gh * 70.0);
      spark = smoothstep(0.991, 0.9995, dot(gn, H)) * (1.0 - smoothstep(0.07, 0.24, r)) * twinkle * presence * uGlitter;
      sparkColor = spectral(420.0 + 260.0 * h21(gid + 7.7));
    }
  }

  float grainNoise = h31(vec3(floor(frag / uPixel), uFrame)) - 0.5;
  vec3 col;
  if (uLightMode > 0.5) {
    float ink = max(max(sh.r, sh.g), sh.b) * uIntensity;
    float top = max(max(sh.r, sh.g), sh.b);
    vec3 hue = sh / max(top, 1e-3);
    float chroma = (top - min(min(sh.r, sh.g), sh.b)) / max(top, 1e-3);
    hue = clamp(mix(vec3(dot(hue, vec3(0.2126, 0.7152, 0.0722))), hue, 1.35) * 0.92, 0.0, 1.0);
    hue = mix(uMetal * 0.85, hue, smoothstep(0.08, 0.45, chroma));
    float density = 0.86 * smoothstep(0.0, 0.85, ink);
    vec3 paper = uColor * (1.0 - 0.035 * (1.0 - wide) - 0.05 * edge) + uMetal * (0.08 * tight);
    col = mix(paper, hue * mix(vec3(1.0), uColor, 0.15), density);
    col = mix(col, sparkColor * 0.9, min(spark * 1.4, 0.9));
    col -= abs(grainNoise) * uGrain * 0.35 * clamp(density * 1.6 + spark, 0.0, 1.0);
    col = mix(col, uColor, 0.12 * (1.0 - wide) * (1.0 - density) * pool);
  } else {
    vec3 base = uColor + vec3(0.018, 0.018, 0.024);
    col = base + uMetal * (0.025 + 0.07 * wide + 1.1 * tight + 0.2 * pool + 0.55 * turn * turn) * (0.75 + 0.25 * inner);
    col += sh * (1.65 * uIntensity);
    col += mix(sparkColor, vec3(1.0), 0.45) * spark * 2.4;
    col = col * (1.0 + col / 5.0) / (1.0 + col * 0.55);
    col += grainNoise * uGrain * 0.24;
  }
  col = clamp(col, 0.0, 1.0);
  return vec4(col * alpha, alpha);
}

float bayer(vec2 p) {
  int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}

float glyph(float level, vec2 uv) {
  int codes[8] = int[8](0, 4194304, 131200, 14336, 459200, 145536, 703136, 11512810);
  vec2 g = floor(uv * 7.0) - 1.0;
  if (g.x < 0.0 || g.y < 0.0 || g.x > 4.0 || g.y > 4.0) return 0.0;
  int code = codes[int(clamp(level * 8.0, 0.0, 7.0))];
  return float((code >> (int(g.x) + 5 * int(4.0 - g.y))) & 1);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  if (uFilter > 1.5) {
    float size = max(4.0, floor(uPixel * 10.0 * uFilterSize + 0.5));
    vec2 cellId = floor(frag / size);
    vec4 sampled = shade((cellId + 0.5) * size, 1.0);
    if (sampled.a <= 0.002) {
      outColor = vec4(0.0);
      return;
    }
    vec3 col = sampled.rgb / sampled.a;
    float ink = pow(clamp(length(col - uColor) * 1.25, 0.0, 1.0), 0.85);
    float on = glyph(ink, (frag - cellId * size) / size);
    float top = max(max(col.r, col.g), col.b);
    vec3 tone = uLightMode > 0.5 ? col * 0.82 : mix(col, col / max(top, 0.25), 0.4);
    float alpha = on * sampled.a;
    outColor = vec4(clamp(tone, 0.0, 1.0) * alpha, alpha);
  } else if (uFilter > 0.5) {
    float size = max(1.0, floor(uPixel * 2.0 * uFilterSize + 0.5));
    vec2 cellId = floor(frag / size);
    vec4 sampled = shade((cellId + 0.5) * size, 0.0);
    float threshold = bayer(cellId);
    float alpha = sampled.a >= 0.999 ? 1.0 : step(threshold, sampled.a);
    if (alpha <= 0.0) {
      outColor = vec4(0.0);
      return;
    }
    vec3 col = sampled.rgb / max(sampled.a, 1e-3);
    vec3 levels = clamp(uColor + floor((col - uColor) * 4.0 + threshold) / 4.0, 0.0, 1.0);
    outColor = vec4(levels * alpha, alpha);
  } else {
    outColor = shade(frag, 0.0);
  }
}`;

  var UNIFORMS = [
    "uRes", "uPixel", "uTime", "uClock", "uTile", "uRot", "uGap", "uRound",
    "uBevel", "uScatter", "uTilt", "uSwirl", "uRipple", "uBands", "uSoft",
    "uIntensity", "uSaturation", "uSpectrum", "uGlitter", "uSheen", "uGrain",
    "uColor", "uMetal", "uLight", "uHover", "uWaves", "uIntro", "uFade",
    "uOpacity", "uLightMode", "uSeed", "uFrame", "uFilter", "uFilterSize"
  ];

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function num(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function compileShader(gl, type, source) {
    var shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }
  function startProgram(gl) {
    var vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX);
    var fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    var program = vertex && fragment ? gl.createProgram() : null;
    if (!vertex || !fragment || !program) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      return null;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    return { program: program, vertex: vertex, fragment: fragment };
  }
  function finishProgram(gl, job) {
    var program = job.program, vertex = job.vertex, fragment = job.fragment;
    var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked && !gl.isContextLost()) {
      var broken = [vertex, fragment].filter(function (sh) { return !gl.getShaderParameter(sh, gl.COMPILE_STATUS); });
      if (broken.length) broken.forEach(function (sh) { console.error(gl.getShaderInfoLog(sh)); });
      else console.error(gl.getProgramInfoLog(program));
    }
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!linked) {
      gl.deleteProgram(program);
      return null;
    }
    var uniforms = {};
    for (var i = 0; i < UNIFORMS.length; i++) uniforms[UNIFORMS[i]] = gl.getUniformLocation(program, UNIFORMS[i]);
    return { program: program, uniforms: uniforms };
  }

  // Normalize options the way the component normalizes its props.
  function normalizeOptions(o) {
    o = o || {};
    return {
      color: String(o.color !== undefined ? o.color : "#120f17"),
      metalColor: String(o.metalColor !== undefined ? o.metalColor : "#e8ebf1"),
      spectrum: SPECTRUMS[o.spectrum] || SPECTRUMS.full,
      tileSize: clamp(num(o.tileSize, 1), 0.2, 6),
      gap: clamp(num(o.gap, 0.08), 0, 0.6),
      roundness: clamp(num(o.roundness, 0.15), 0, 1),
      bevel: clamp(num(o.bevel, 0.35), 0, 1),
      rotation: (num(o.rotation, 0) * Math.PI) / 180,
      scatter: clamp(num(o.scatter, 0.3), 0, 1),
      tilt: clamp(num(o.tilt, 0.35), 0, 2),
      swirl: clamp(num(o.swirl, 1), 0, 5),
      ripple: clamp(num(o.ripple, 0.6), 0, 3),
      bands: clamp(num(o.bands, 1.3), 0.3, 3),
      softness: clamp(num(o.softness, 0.5), 0, 1),
      intensity: Math.max(0, num(o.intensity, 1.25)),
      saturation: clamp(num(o.saturation, 0.1), 0, 1.5),
      glitter: clamp(num(o.glitter, 0.85), 0, 1),
      sheen: clamp(num(o.sheen, 0.8), 0, 2),
      grain: clamp(num(o.grain, 0.08), 0, 1),
      speed: Math.max(0, num(o.speed, 0.5)),
      variation: num(o.variation, 0),
      filter: FILTERS[o.filter] !== undefined ? FILTERS[o.filter] : 0,
      filterSize: clamp(num(o.filterSize, 1), 0.5, 4),
      fade: clamp(num(o.fade, 0), 0, 1),
      opacity: clamp(num(o.opacity, 1), 0, 1),
      intro: o.intro !== false,
      mouseInteraction: o.mouseInteraction !== false,
      mouseStrength: clamp(num(o.mouseStrength, 1), 0, 3),
      mouseRadius: clamp(num(o.mouseRadius, 0.25), 0.05, 1),
      flipOnClick: o.flipOnClick !== false,
      lightMode: !!o.lightMode,
      paused: !!o.paused,
      dpr: o.dpr
    };
  }

  /**
   * mount(container, options) — options are the component's props.
   * Returns { update(newOptions), destroy() }. The canvas fills the
   * container; the container only needs a size (its position is left alone
   * unless it is static). No WebGL2 → a dark gradient fallback.
   */
  function mount(container, options) {
    var s = normalizeOptions(options);
    var canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    if (window.getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }
    container.appendChild(canvas);

    function fallback() {
      container.style.background = "radial-gradient(120% 90% at 30% 20%, #241d2e 0%, #120f17 55%, #0a0810 100%)";
      return {
        update: function () {},
        destroy: function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); }
      };
    }

    var gl = canvas.getContext("webgl2", {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, powerPreference: "default"
    });
    if (!gl) return fallback();
    var parallel = gl.getExtension("KHR_parallel_shader_compile");
    var job = startProgram(gl);
    if (!job) return fallback();
    var surface = null;
    if (!parallel) {
      surface = finishProgram(gl, job);
      job = null;
      if (!surface) return fallback();
    }
    var vao = gl.createVertexArray();
    var probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    var probeContext = probe.getContext("2d", { willReadFrequently: true });
    var reduce = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || false;
    var waveData = new Float32Array(MAX_WAVES * 4);
    var state = {
      time: 17 + (s.variation % 97) * 3.1,
      clock: 0,
      frame: 0,
      intro: (s.intro && !reduce && !s.paused) ? 0 : INTRO_SECONDS,
      started: false,
      width: 1,
      height: 1,
      ratio: 1,
      colorKey: "",
      color: [0.07, 0.06, 0.09],
      metal: [0.78, 0.8, 0.85],
      pointer: { x: 0, y: 0, inside: false },
      light: { x: 0, y: 0, vx: 0, vy: 0, placed: false },
      hover: { x: 0, y: 0, vx: 0, vy: 0, presence: 0, placed: false },
      follow: 0,
      waves: []
    };
    var raf = 0, last = 0, visible = true, alive = true, lost = false;

    function toRgb(value, fallback) {
      if (!probeContext || !value) return fallback;
      var css = /^[0-9a-f]{3,8}$/i.test(value) ? "#" + value : value;
      probeContext.clearRect(0, 0, 1, 1);
      probeContext.fillStyle = "#000000";
      probeContext.fillStyle = css;
      probeContext.fillRect(0, 0, 1, 1);
      var d = probeContext.getImageData(0, 0, 1, 1).data;
      return [d[0] / 255, d[1] / 255, d[2] / 255];
    }
    function resolveColors() {
      var key = s.color + "|" + s.metalColor;
      if (key === state.colorKey) return;
      state.colorKey = key;
      state.color = toRgb(s.color, [0.07, 0.06, 0.09]);
      state.metal = toRgb(s.metalColor, [0.78, 0.8, 0.85]);
    }
    function aspect() { return state.width / Math.max(state.height, 1); }
    function wander() {
      var t = state.time;
      return {
        x: 0.46 * aspect() * Math.cos(t * 0.29 + 0.4),
        y: 0.36 * Math.sin(t * 0.41 + 1.1)
      };
    }
    function toSurface(px, py) {
      return {
        x: (px - state.width / 2) / state.height,
        y: (state.height / 2 - py) / state.height
      };
    }

    function render() {
      if (!surface || lost) return;
      resolveColors();
      var u = surface.uniforms;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.BLEND);
      gl.useProgram(surface.program);
      gl.bindVertexArray(vao);
      waveData.fill(0);
      state.waves.forEach(function (wave, index) {
        waveData[index * 4] = wave.x;
        waveData[index * 4 + 1] = wave.y;
        waveData[index * 4 + 2] = wave.start;
        waveData[index * 4 + 3] = 1;
      });
      var introLive = state.intro < INTRO_SECONDS;
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform1f(u.uPixel, state.ratio);
      gl.uniform1f(u.uTime, state.time);
      gl.uniform1f(u.uClock, state.clock);
      gl.uniform1f(u.uTile, TILE_PX * s.tileSize * state.ratio);
      gl.uniform2f(u.uRot, Math.cos(s.rotation), Math.sin(s.rotation));
      gl.uniform1f(u.uGap, s.gap);
      gl.uniform1f(u.uRound, s.roundness);
      gl.uniform1f(u.uBevel, s.bevel);
      gl.uniform1f(u.uScatter, s.scatter);
      gl.uniform1f(u.uTilt, s.tilt);
      gl.uniform1f(u.uSwirl, s.swirl);
      gl.uniform1f(u.uRipple, s.ripple);
      gl.uniform1f(u.uBands, s.bands);
      gl.uniform1f(u.uSoft, 0.02 + 0.2 * s.softness);
      gl.uniform1f(u.uIntensity, s.intensity);
      gl.uniform1f(u.uSaturation, s.saturation);
      gl.uniform3f(u.uSpectrum, s.spectrum[0], s.spectrum[1], s.spectrum[2]);
      gl.uniform1f(u.uGlitter, s.glitter);
      gl.uniform1f(u.uSheen, s.sheen);
      gl.uniform1f(u.uGrain, s.grain);
      gl.uniform3f(u.uColor, state.color[0], state.color[1], state.color[2]);
      gl.uniform3f(u.uMetal, state.metal[0], state.metal[1], state.metal[2]);
      gl.uniform2f(u.uLight, state.light.x / EYE, state.light.y / EYE);
      gl.uniform4f(u.uHover, state.hover.x, state.hover.y, s.mouseRadius, 0.8 * state.hover.presence * s.mouseStrength);
      gl.uniform4fv(u.uWaves, waveData);
      gl.uniform4f(u.uIntro, 0, 0, state.intro, introLive ? 1 : 0);
      gl.uniform1f(u.uFade, s.fade);
      gl.uniform1f(u.uOpacity, s.opacity);
      gl.uniform1f(u.uLightMode, s.lightMode ? 1 : 0);
      gl.uniform1f(u.uSeed, s.variation % 97);
      gl.uniform1f(u.uFrame, state.frame);
      gl.uniform1f(u.uFilter, s.filter);
      gl.uniform1f(u.uFilterSize, s.filterSize);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function resize() {
      var rect = container.getBoundingClientRect();
      var w = Math.max(1, rect.width), h = Math.max(1, rect.height);
      var ratio = s.dpr ? clamp(num(s.dpr, 1), 1, 3) : Math.min(window.devicePixelRatio || 1, 2);
      var maxDim = Math.max(w, h) * ratio;
      if (maxDim > MAX_RENDER_DIM) ratio *= MAX_RENDER_DIM / maxDim;
      state.width = w;
      state.height = h;
      state.ratio = ratio;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
    }

    function tick(now) {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      // With parallel compile, finish the program once it is ready.
      if (!surface && job) {
        if (gl.getProgramParameter(job.program, gl.COMPLETION_STATUS_KHR)) {
          surface = finishProgram(gl, job);
          job = null;
          if (!surface) { alive = false; return; }
        } else {
          return;
        }
      }
      var dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      if (s.paused || !visible || lost || !surface) return;
      state.time += dt * s.speed;
      state.clock += dt;
      state.frame++;
      if (state.intro < INTRO_SECONDS) state.intro = Math.min(INTRO_SECONDS, state.intro + dt);
      // The light drifts on its own, and follows the pointer when it is over
      // the surface. The hover glow eases toward the pointer the same way.
      var target = (state.pointer.inside && s.mouseInteraction)
        ? toSurface(state.pointer.x, state.pointer.y)
        : wander();
      state.light.vx += (target.x - state.light.x) * 0.06;
      state.light.vy += (target.y - state.light.y) * 0.06;
      state.light.vx *= 0.86;
      state.light.vy *= 0.86;
      state.light.x += state.light.vx;
      state.light.y += state.light.vy;
      if (state.pointer.inside && s.mouseInteraction) {
        var hp = toSurface(state.pointer.x, state.pointer.y);
        state.hover.x += (hp.x - state.hover.x) * 0.2;
        state.hover.y += (hp.y - state.hover.y) * 0.2;
        state.hover.presence = Math.min(1, state.hover.presence + dt * 4);
      } else {
        state.hover.presence = Math.max(0, state.hover.presence - dt * 4);
      }
      state.waves = state.waves.filter(function (w) { return state.clock - w.start < WAVE_SECONDS; });
      render();
    }

    function onMove(e) {
      var rect = container.getBoundingClientRect();
      state.pointer.x = e.clientX - rect.left;
      state.pointer.y = e.clientY - rect.top;
      state.pointer.inside = true;
    }
    function onLeave() { state.pointer.inside = false; }
    function onDown(e) {
      if (!s.flipOnClick) return;
      var rect = container.getBoundingClientRect();
      var p = toSurface(e.clientX - rect.left, e.clientY - rect.top);
      state.waves.push({ x: p.x, y: p.y, start: state.clock });
      if (state.waves.length > MAX_WAVES) state.waves.shift();
    }
    function onLost(e) { e.preventDefault(); lost = true; }
    function onRestored() { lost = false; }

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    if (s.flipOnClick) container.addEventListener("pointerdown", onDown);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    var observer = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resize);
      observer.observe(container);
    } else {
      window.addEventListener("resize", resize);
    }
    var io = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(function (entries) {
        visible = entries[0] ? entries[0].isIntersecting : true;
      });
      io.observe(container);
    }

    resize();
    raf = requestAnimationFrame(tick);

    return {
      update: function (newOptions) {
        s = normalizeOptions(Object.assign({}, s, newOptions || {}));
      },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        container.removeEventListener("pointermove", onMove);
        container.removeEventListener("pointerleave", onLeave);
        if (s.flipOnClick) container.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
        if (observer) observer.disconnect();
        else window.removeEventListener("resize", resize);
        if (io) io.disconnect();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  window.HoloMosaic = { mount: mount };
})();
