// Plasma Wave — vanilla JS port of the 21st.dev React component.
// Two raymarched plasma ribbons (violet + cyan) with a bloom pyramid and a
// pointer-driven heat swell. No React, no build step: a plain <script>
// exposing window.PlasmaWave.mount. The shaders are the originals, verbatim.
// The paste cut off at the very end of resize(), so only the last few lines
// (coarse size, pointer handlers, observers) are rebuilt to match.
(function () {
  "use strict";

  var QUAD_VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  var COMMON = `#version 300 es
precision highp float;
const float PI = 3.14159265;
const float TAU = 6.28318531;
const float HALF_PI = 1.5707963;
`;

  var TRACE = `
uniform vec2 uView;
uniform vec2 uOffset;
uniform float uRotation;
uniform float uFocalLength;
uniform float uTime;
uniform float uSpeed1;
uniform float uSpeed2;
uniform float uDir2;
uniform float uBend1;
uniform float uBend2;
uniform float uThickness;
uniform vec3 uHeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uCore;
uniform float uRange;

vec4 traceLight(vec2 pixel) {
  vec2 coord = pixel + uOffset - 0.5 * uView;
  float c = cos(uRotation);
  float sn = sin(uRotation);
  coord = mat2(c, -sn, sn, c) * coord;
  vec3 u = normalize(vec3(coord / uView.y, uFocalLength));
  vec3 o = vec3(0.0, 0.0, -7.0);
  float t = uTime * PI;
  float t1 = t * 0.7;
  float t2 = t * 0.9;
  float tSpeed1 = t * uSpeed1;
  float tSpeed2 = t * uSpeed2 * uDir2;
  float s = 1.0;
  float d = 0.0;
  vec2 k = vec2(0.0);
  for (int i = 0; i < 14; ++i) {
    vec3 p = o + u * d;
    p.x -= 15.0;
    float px = p.x;
    float swell = uHeat.y * exp(-pow((px - uHeat.x) / uHeat.z, 2.0));
    float wob1 = uBend1 + swell * (0.16 + 0.2 * uBend1) + sin(t1 + px * 0.8) * 0.1;
    float wob2 = uBend2 + swell * (0.16 + 0.2 * uBend2) + cos(t2 + px * 1.1) * 0.1;
    vec2 a = sin(vec2(px, px + HALF_PI) + tSpeed1) * wob1;
    vec2 b = cos(vec2(px, px + HALF_PI) + tSpeed2) * wob2;
    float cut = px + uThickness;
    k.x = max(cut, length(p.yz - a) - uThickness);
    k.y = max(cut, length(p.yz - b) - uThickness);
    s = min(s, min(k.x, k.y));
    if (s < 0.001 || d > 300.0) break;
    d += s * 0.7;
  }
  vec3 raw = max(cos(d * TAU) - s * sqrt(d) - vec3(k, 0.0), 0.0);
  float field = max(raw.r, max(raw.g, raw.b));
  raw.gb += 0.1;
  raw = raw * 0.4 + raw.brg * 0.6 + raw * raw;
  float lum = dot(raw, vec3(0.299, 0.587, 0.114));
  float w1 = max(0.0, 1.0 - k.x * 2.0) + 0.0001;
  float w2 = max(0.0, 1.0 - k.y * 2.0) + 0.0001;
  vec3 base = (uColor1 * w1 + uColor2 * w2) / (w1 + w2);
  float soft = smoothstep(0.03, 0.36, field);
  float hot = smoothstep(0.32, 0.8, field);
  vec3 light = base * lum * 2.6 * soft + mix(base, vec3(1.0), 0.55) * hot * uCore * 2.0;
  return vec4(light * uRange, field);
}
`;

  var COARSE = `${COMMON}
${TRACE}
uniform vec2 uScale;
out vec4 outColor;
void main() {
  outColor = traceLight(gl_FragCoord.xy * uScale);
}`;

  var FINE = `${COMMON}
${TRACE}
uniform vec2 uScale;
uniform sampler2D uCoarse;
uniform vec2 uCoarseSize;
uniform vec2 uFineSize;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uFineSize;
  vec2 pos = uv * uCoarseSize - 0.5;
  ivec2 cell = ivec2(floor(pos));
  ivec2 last = ivec2(uCoarseSize) - 1;
  float a = texelFetch(uCoarse, clamp(cell, ivec2(0), last), 0).a;
  float b = texelFetch(uCoarse, clamp(cell + ivec2(1, 0), ivec2(0), last), 0).a;
  float c = texelFetch(uCoarse, clamp(cell + ivec2(0, 1), ivec2(0), last), 0).a;
  float d = texelFetch(uCoarse, clamp(cell + ivec2(1, 1), ivec2(0), last), 0).a;
  float high = max(max(a, b), max(c, d));
  float low = min(min(a, b), min(c, d));
  if (high > 0.02 && low < 0.4) outColor = traceLight(gl_FragCoord.xy * uScale);
  else outColor = texture(uCoarse, uv);
}`;

  var DOWN = `${COMMON}
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform vec2 uTarget;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uTarget;
  vec4 sum = texture(uSource, uv) * 4.0;
  sum += texture(uSource, uv - uTexel);
  sum += texture(uSource, uv + uTexel);
  sum += texture(uSource, uv + vec2(uTexel.x, -uTexel.y));
  sum += texture(uSource, uv - vec2(uTexel.x, -uTexel.y));
  outColor = sum / 8.0;
}`;

  var UP = `${COMMON}
uniform sampler2D uSource;
uniform sampler2D uBase;
uniform vec2 uTexel;
uniform vec2 uTarget;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uTarget;
  vec2 h = uTexel * 0.5;
  vec4 sum = texture(uSource, uv + vec2(-h.x * 2.0, 0.0));
  sum += texture(uSource, uv + vec2(h.x * 2.0, 0.0));
  sum += texture(uSource, uv + vec2(0.0, -h.y * 2.0));
  sum += texture(uSource, uv + vec2(0.0, h.y * 2.0));
  sum += texture(uSource, uv + vec2(-h.x, h.y)) * 2.0;
  sum += texture(uSource, uv + h) * 2.0;
  sum += texture(uSource, uv + vec2(h.x, -h.y)) * 2.0;
  sum += texture(uSource, uv - h) * 2.0;
  outColor = sum / 12.0 + texture(uBase, uv);
}`;

  var COMPOSITE = `${COMMON}
uniform sampler2D uLight;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uExposure;
uniform float uGlow;
uniform float uCore;
uniform float uPresence;
uniform float uGrain;
uniform float uFade;
uniform float uOpacity;
uniform float uTime;
uniform float uLightMode;
uniform vec3 uLens;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float smootherstep(float edge, float x) {
  float t = clamp(x / max(edge, 0.0001), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 offset = gl_FragCoord.xy - uLens.xy;
  float lens = uLens.z * exp(-dot(offset, offset) / (uResolution.y * uResolution.y * 0.045));
  vec4 source = texture(uLight, uv);
  vec3 hdr = source.rgb * uExposure * uPresence * (1.0 + lens * 0.35);
  hdr += texture(uBloom, uv).rgb * uExposure * uPresence * uGlow * (0.18 + lens * 0.08);
  float edge = uFade * 0.5;
  float mask = smootherstep(edge, uv.x) * smootherstep(edge, 1.0 - uv.x) * smootherstep(edge, uv.y) * smootherstep(edge, 1.0 - uv.y);
  float grain = (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain;
  float peak = max(hdr.r, max(hdr.g, hdr.b));
  if (uLightMode > 0.5) {
    vec3 hue = hdr / max(peak, 0.0001);
    float tone = dot(hue, vec3(0.2126, 0.7152, 0.0722));
    vec3 ink = pow(clamp(hue * min(1.0, 0.6 / max(tone, 0.001)), 0.0, 1.0), vec3(1.0 / 2.2));
    float feather = max(fwidth(source.a) * 1.25, 0.02);
    float body = smoothstep(0.15 - feather, 0.15 + feather, source.a) * uPresence;
    vec3 color = mix(ink, vec3(1.0), smoothstep(12.0, 26.0, peak) * uCore);
    float halo = (1.0 - exp(-peak * 0.5)) * 0.3 * min(uGlow, 1.5);
    float alpha = clamp(body * 0.92 + (1.0 - body) * halo, 0.0, 1.0) * mask * uOpacity;
    color = mix(ink, color, body);
    outColor = vec4(clamp(color + grain, 0.0, 1.0) * alpha, alpha);
  } else {
    vec3 mapped = 1.0 - exp(-hdr);
    float level = max(mapped.r, max(mapped.g, mapped.b));
    mapped = clamp(mapped + grain * level, 0.0, 1.0) * mask * uOpacity;
    outColor = vec4(mapped, max(mapped.r, max(mapped.g, mapped.b)));
  }
}`;

  var BLOOM_LEVELS = 4;
  var COARSE_RATIO = 3;
  var INTRO_SECONDS = 1.8;
  var MAX_LIGHT_PIXELS = 2400000;

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function num(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  }
  function link(gl, fragmentSource) {
    var vertex = compile(gl, gl.VERTEX_SHADER, QUAD_VERTEX);
    var fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    var program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    var uniforms = {};
    var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var info = gl.getActiveUniform(program, i);
      if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
    return { program: program, uniforms: uniforms };
  }

  // Normalize options the way the component normalizes its props.
  function normalizeOptions(o) {
    o = o || {};
    var colors = o.colors || ["#A855F7", "#06B6D4"];
    return {
      color1: String(colors[0] !== undefined ? colors[0] : "#A855F7"),
      color2: String(colors[1] !== undefined ? colors[1] : (colors[0] !== undefined ? colors[0] : "#06B6D4")),
      speed: num(o.speed, 1),
      speed1: num(o.speed1, 0.05),
      speed2: num(o.speed2, 0.05),
      dir2: num(o.dir2, 1),
      bend1: num(o.bend1, 1),
      bend2: num(o.bend2, 0.5),
      thickness: Math.max(0.02, num(o.thickness, 0.3)),
      focalLength: Math.max(0.05, num(o.focalLength, 1.25)),
      rotation: (num(o.rotationDeg, 0) * Math.PI) / 180,
      xOffset: num(o.xOffset, 0),
      yOffset: num(o.yOffset, 0),
      brightness: Math.max(0, num(o.brightness, 1)),
      glow: Math.max(0, num(o.glow, 1)),
      core: clamp(num(o.core, 0.6), 0, 1),
      grain: Math.max(0, num(o.grain, 0.03)),
      quality: clamp(num(o.quality, 1), 0.25, 1),
      mouseInteraction: o.mouseInteraction !== false,
      intro: o.intro !== false,
      fade: clamp(num(o.fade, 0), 0, 1),
      opacity: clamp(num(o.opacity, 1), 0, 1),
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
   * The frame loop sleeps when the scene is settled and nothing moves,
   * exactly like the original — wake() restarts it on pointer, resize
   * and settings changes.
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
      container.style.background = "radial-gradient(120% 90% at 50% 50%, #1e0a2e 0%, #0a0616 55%, #000 100%)";
      return {
        update: function () {},
        destroy: function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); }
      };
    }

    var gl = canvas.getContext("webgl2", {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, powerPreference: "high-performance"
    });
    if (!gl) return fallback();

    var floatTargets = !!gl.getExtension("EXT_color_buffer_float");
    var range = floatTargets ? 1 : 0.25;
    var programs = {
      coarse: link(gl, COARSE),
      fine: link(gl, FINE),
      down: link(gl, DOWN),
      up: link(gl, UP),
      composite: link(gl, COMPOSITE)
    };
    if (!programs.coarse || !programs.fine || !programs.down || !programs.up || !programs.composite) return fallback();

    var buffer = gl.createBuffer();
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    function createTarget() {
      return { texture: gl.createTexture(), framebuffer: gl.createFramebuffer(), width: 0, height: 0 };
    }
    function sizeTarget(target, width, height) {
      if (target.width === width && target.height === height) return;
      target.width = width;
      target.height = height;
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      if (floatTargets) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
    }
    var coarse = createTarget();
    var fine = createTarget();
    var down = [];
    for (var i = 0; i <= BLOOM_LEVELS; i++) down.push(createTarget());
    var up = [];
    for (var j = 0; j < BLOOM_LEVELS; j++) up.push(createTarget());

    var probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    var probeContext = probe.getContext("2d", { willReadFrequently: true });
    var reduce = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || false;
    var colorCache = {};
    function toLinear(value) {
      if (colorCache[value]) return colorCache[value];
      var rgb = [1, 1, 1];
      if (probeContext) {
        probeContext.clearRect(0, 0, 1, 1);
        probeContext.fillStyle = "#000000";
        probeContext.fillStyle = value;
        probeContext.fillRect(0, 0, 1, 1);
        var d = probeContext.getImageData(0, 0, 1, 1).data;
        rgb = [d[0], d[1], d[2]].map(function (v) { return Math.pow(v / 255, 2.2); });
      }
      colorCache[value] = rgb;
      return rgb;
    }

    var view = { width: 1, height: 1, fineWidth: 1, fineHeight: 1, coarseWidth: 1, coarseHeight: 1 };
    var pointer = { x: 0, y: 0, inside: false };
    var state = {
      time: 0,
      intro: (s.intro && !reduce) ? 0 : 1,
      heat: 0,
      heatVelocity: 0,
      heatX: 0,
      lensX: 0,
      lensY: 0
    };
    var raf = 0, last = 0, visible = true, alive = true, lost = false;

    function run(entry, target, width, height) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
      gl.viewport(0, 0, width, height);
      gl.useProgram(entry.program);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function bindTexture(entry, name, unit, texture) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(entry.uniforms[name], unit);
    }
    function setScene(entry, presence) {
      var u = entry.uniforms;
      gl.useProgram(entry.program);
      gl.uniform2f(u.uView, view.width, view.height);
      gl.uniform2f(u.uOffset, s.xOffset, s.yOffset);
      gl.uniform1f(u.uRotation, s.rotation);
      gl.uniform1f(u.uFocalLength, s.focalLength);
      gl.uniform1f(u.uTime, state.time);
      gl.uniform1f(u.uSpeed1, s.speed1);
      gl.uniform1f(u.uSpeed2, s.speed2);
      gl.uniform1f(u.uDir2, s.dir2);
      gl.uniform1f(u.uBend1, s.bend1 * (0.3 + 0.7 * presence));
      gl.uniform1f(u.uBend2, s.bend2 * (0.3 + 0.7 * presence));
      gl.uniform1f(u.uThickness, s.thickness);
      gl.uniform3f(u.uHeat, state.heatX, state.heat, 1.4);
      gl.uniform3fv(u.uColor1, toLinear(s.color1));
      gl.uniform3fv(u.uColor2, toLinear(s.color2));
      gl.uniform1f(u.uCore, s.core);
      gl.uniform1f(u.uRange, range);
    }

    function render() {
      var presence = state.intro * state.intro * (3 - 2 * state.intro);
      gl.bindVertexArray(vao);
      sizeTarget(coarse, view.coarseWidth, view.coarseHeight);
      sizeTarget(fine, view.fineWidth, view.fineHeight);

      setScene(programs.coarse, presence);
      gl.uniform2f(programs.coarse.uniforms.uScale, view.width / view.coarseWidth, view.height / view.coarseHeight);
      run(programs.coarse, coarse, view.coarseWidth, view.coarseHeight);

      var refine = programs.fine;
      setScene(refine, presence);
      gl.uniform2f(refine.uniforms.uScale, view.width / view.fineWidth, view.height / view.fineHeight);
      gl.uniform2f(refine.uniforms.uCoarseSize, view.coarseWidth, view.coarseHeight);
      gl.uniform2f(refine.uniforms.uFineSize, view.fineWidth, view.fineHeight);
      bindTexture(refine, "uCoarse", 0, coarse.texture);
      run(refine, fine, view.fineWidth, view.fineHeight);

      var source = fine;
      for (var level = 0; level <= BLOOM_LEVELS; level++) {
        var target = down[level];
        var width = level === 0 ? Math.round(view.width / 2) : source.width >> 1;
        var height = level === 0 ? Math.round(view.height / 2) : source.height >> 1;
        sizeTarget(target, Math.max(1, width), Math.max(1, height));
        gl.useProgram(programs.down.program);
        gl.uniform2f(programs.down.uniforms.uTexel, 1 / source.width, 1 / source.height);
        gl.uniform2f(programs.down.uniforms.uTarget, target.width, target.height);
        bindTexture(programs.down, "uSource", 0, source.texture);
        run(programs.down, target, target.width, target.height);
        source = target;
      }
      for (var lvl = BLOOM_LEVELS - 1; lvl >= 1; lvl--) {
        var from = lvl === BLOOM_LEVELS - 1 ? down[BLOOM_LEVELS] : up[lvl + 1];
        var upTarget = up[lvl];
        sizeTarget(upTarget, down[lvl].width, down[lvl].height);
        gl.useProgram(programs.up.program);
        gl.uniform2f(programs.up.uniforms.uTexel, 1 / from.width, 1 / from.height);
        gl.uniform2f(programs.up.uniforms.uTarget, upTarget.width, upTarget.height);
        bindTexture(programs.up, "uSource", 0, from.texture);
        bindTexture(programs.up, "uBase", 1, down[lvl].texture);
        run(programs.up, upTarget, upTarget.width, upTarget.height);
      }

      var composite = programs.composite;
      var c = composite.uniforms;
      gl.useProgram(composite.program);
      gl.uniform2f(c.uResolution, canvas.width, canvas.height);
      gl.uniform1f(c.uExposure, (2.4 * s.brightness) / range);
      gl.uniform1f(c.uGlow, s.glow);
      gl.uniform1f(c.uCore, s.core);
      gl.uniform1f(c.uPresence, presence * presence);
      gl.uniform1f(c.uGrain, s.grain);
      gl.uniform1f(c.uFade, s.fade);
      gl.uniform1f(c.uOpacity, s.opacity);
      gl.uniform1f(c.uTime, state.time);
      gl.uniform1f(c.uLightMode, s.lightMode ? 1 : 0);
      gl.uniform3f(
        c.uLens,
        (state.lensX * canvas.width) / view.width,
        ((view.height - state.lensY) * canvas.height) / view.height,
        state.heat
      );
      bindTexture(composite, "uLight", 0, fine.texture);
      bindTexture(composite, "uBloom", 1, up[1].texture);
      run(composite, null, canvas.width, canvas.height);
    }

    function heatTarget() {
      if (!(s.mouseInteraction && pointer.inside) || reduce) return null;
      var x = pointer.x + s.xOffset - view.width / 2;
      var y = view.height - pointer.y + s.yOffset - view.height / 2;
      var c = Math.cos(s.rotation);
      var sn = Math.sin(s.rotation);
      return (7 * (c * x + sn * y)) / view.height / s.focalLength - 15;
    }

    function frame(now) {
      raf = 0;
      if (!alive || !visible || document.hidden || lost) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      var moving = !s.paused && !reduce;
      if (moving) state.time += dt * s.speed;
      if (!s.intro || reduce) state.intro = 1;
      else if (state.intro < 1) state.intro = Math.min(1, state.intro + dt / INTRO_SECONDS);
      var target = heatTarget();
      if (target !== null) state.heatX += (target - state.heatX) * (1 - Math.exp(-dt * 6));
      state.heatVelocity += (120 * ((target === null ? 0 : 1) - state.heat) - 19 * state.heatVelocity) * dt;
      state.heat = clamp(state.heat + state.heatVelocity * dt, 0, 1.15);
      state.lensX += (pointer.x - state.lensX) * (1 - Math.exp(-dt * 8));
      state.lensY += (pointer.y - state.lensY) * (1 - Math.exp(-dt * 8));
      render();
      var settling = state.intro < 1 || state.heat > 0.001 || Math.abs(state.heatVelocity) > 0.001;
      if (moving || settling) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function wake() {
      if (!raf && alive && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    function resize() {
      var width = Math.max(1, container.clientWidth);
      var height = Math.max(1, container.clientHeight);
      var ratio = Math.min(s.dpr || window.devicePixelRatio || 1, 2);
      view.width = width;
      view.height = height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      var scale = s.quality;
      if (width * height * scale * scale > MAX_LIGHT_PIXELS) scale = Math.sqrt(MAX_LIGHT_PIXELS / (width * height));
      view.fineWidth = Math.max(1, Math.round(width * scale));
      view.fineHeight = Math.max(1, Math.round(height * scale));
      view.coarseWidth = Math.max(1, Math.round(view.fineWidth / COARSE_RATIO));
      view.coarseHeight = Math.max(1, Math.round(view.fineHeight / COARSE_RATIO));
      wake();
    }

    function onMove(e) {
      var rect = container.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.inside = true;
      wake();
    }
    function onLeave() { pointer.inside = false; wake(); }
    function onLost(e) { e.preventDefault(); lost = true; }
    function onRestored() { lost = false; wake(); }
    function onVisibility() { if (!document.hidden) wake(); }

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    document.addEventListener("visibilitychange", onVisibility);

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
        if (visible) wake();
      });
      io.observe(container);
    }

    resize();

    return {
      update: function (newOptions) {
        s = normalizeOptions(Object.assign({}, s, newOptions || {}));
        if (s.intro && !reduce && state.intro >= 1) state.intro = 0;
        wake();
      },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        container.removeEventListener("pointermove", onMove);
        container.removeEventListener("pointerleave", onLeave);
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
        document.removeEventListener("visibilitychange", onVisibility);
        if (observer) observer.disconnect();
        else window.removeEventListener("resize", resize);
        if (io) io.disconnect();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  window.PlasmaWave = { mount: mount };
})();
