// Chrome Arcs — vanilla JS port of the Louis Studios React component.
// No React, no build step: a plain <script> that mounts a WebGL canvas
// into any container. Used by skin.html (wallpaper background) and
// settings.html (first theme preview box).
// Original: https://studios.lou15.com — Chrome Arcs by Louis Studios.
(function () {
  "use strict";

  // One loop in seconds at speed 1: every ring moves out by exactly one place and the light
  // sways once, so the motion repeats seamlessly.
  var LOOP = 10;
  var TAU = Math.PI * 2;
  // The reference is 1179 x 1967 px. Everything below is measured in its pixels.
  var REF_W = 1179;
  var REF_H = 1967;
  // View centre in reference px. A square shows the middle 1179 px of the reference.
  var VIEW_X = 590;
  var VIEW_Y = 984;
  // How far the light sways each loop, and how far the pointer can pull it (reference px).
  var SWAY = 26;
  var PULL = 0.42;
  // Device pixels per frame at most; larger screens render at a lower pixel ratio.
  var MAX_PIXELS = 2560 * 1600;

  var VERT = "\nattribute vec2 aPos;\nvoid main() { gl_Position = vec4(aPos, 0.0, 1.0); }\n";

  // Every constant below was fitted to the reference, then checked by eye side by side.
  var FRAG = "\nprecision highp float;\nuniform vec2 uRes;\nuniform vec4 uView;   // view centre (reference px), reference px per device px, ring density\nuniform vec3 uMotion; // outward flow (rings, 0..1), light shift (reference px), streak intensity\nuniform mat3 uTint;   // maps the dispersed red, green, blue sheen to the tint colours\nuniform float uSeed;\n\n// Rings: circles about a centre far off to the lower right. Ring k sits at radius\n// R0 - D1 * Q^(k - 1), so the bands widen by 7% per ring towards the centre, as in the reference.\nconst vec2 C = vec2(3777.39, 2674.21);\nconst float R0 = 6657.9;\nconst float D1 = 2264.66;\nconst float LNQ = 0.0670042;\n\nfloat sq(float x) { return x * x; }\n\n// Streak shape: white core width and each channel's outer and inner tail (band widths).\nconst float CORE = 0.24;\nconst vec2 TAIL_R = vec2(0.40033, 0.33513);\nconst vec2 TAIL_G = vec2(0.38067, 0.32096);\nconst vec2 TAIL_B = vec2(0.35736, 0.32278);\nconst float BLOOM = 2.2;\nfloat hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n\n// The reference rings are not quite concentric: a small cubic nudge, frozen at the frame edge.\nfloat nudge(vec2 p) {\n  vec2 q = clamp(p, vec2(0.0), vec2(" + REF_W + ".0, " + REF_H + ".0)) / 1000.0 - vec2(0.6, 1.0);\n  float X = q.x, Y = q.y;\n  return -0.01066 + Y * (-0.0588 + Y * (0.02479 + Y * 0.12054))\n    + X * (0.00943 + Y * (0.08212 + Y * 0.05649)) + X * X * (0.06149 - 0.00377 * Y) - 0.01411 * X * X * X;\n}\n\n// Smooth lighting envelopes over the frame: log brightness as a quadratic in X, Y.\nfloat envelope(vec2 q, float a, float bx, float by, float bxx, float byy, float bxy, float cap) {\n  return exp(min(a + bx * q.x + by * q.y + bxx * q.x * q.x + byy * q.y * q.y + bxy * q.x * q.y, cap));\n}\n\n// Where the ring of radius ra crosses the line x = x0 + sx (y - 1000): its angle, and y.\nvec2 meet(float ra, float x0, float sx) {\n  float A = x0 - 1000.0 * sx - C.x;\n  float a = sx * sx + 1.0, b = 2.0 * (A * sx - C.y), c = A * A + C.y * C.y - ra * ra;\n  float y = (-b - sqrt(max(b * b - 4.0 * a * c, 0.0))) / (2.0 * a);\n  return vec2(atan(y - C.y, x0 + sx * (y - 1000.0) - C.x), y);\n}\n\nfloat radius(float k) { return R0 - D1 * exp(LNQ * (k - 1.0)); }\n\n// Thin-film dispersion: one lobe per channel, red a little further out than green, green than\n// blue. Where they overlap the streak burns white; past it red lingers longest outside, blue\n// inside, so the fringes deepen to amber and blue as they fade.\nfloat lobe(float d, float outer, float inner) {\n  return 1.0 * exp(-sq(d / CORE)) + 0.31106 * exp(-abs(d) / (d > 0.0 ? outer : inner));\n}\nvec3 sheen(float phi) {\n  return vec3(\n    16.614 * lobe(phi - 0.11247, TAIL_R.x, TAIL_R.y),\n    16.018 * lobe(phi + 0.040111, TAIL_G.x, TAIL_G.y),\n    16.169 * lobe(phi + 0.17831, TAIL_B.x, TAIL_B.y));\n}\n\n// Linear light of render band kp at fraction t across it (0 = outer edge). env: body, back\n// edge, rim and streak brightness here.\nvec3 band(float kp, float t, float th, float r, float w, float aa, vec4 env) {\n  float m = uView.w, flow = uMotion.x;\n  // Where this band sits now, in reference rings.\n  float kc = 4.5 + (kp + 0.5 - flow - 4.5) / m;\n\n  // Body: a tube reflecting a broad soft light. It brightens slowly from the outer edge and\n  // drops into shadow past the crest.\n  float crest = 0.46263 + 0.070742 * (kc - 4.0) - 0.0040818 * (degrees(th) + 150.0);\n  float spread = t < crest ? max(0.38553 - 0.071703 * (kc - 4.0), 0.03) : 0.12301;\n  vec3 col = vec3(env.x * exp(-sq((t - crest) / spread)));\n  // A faint cool lift where the band turns under, before the next rim.\n  col += env.y * exp(-sq((1.0 - t) / 0.16965)) * vec3(0.55, 0.7, 1.0);\n\n  // The streak: an arch across the band whose apex sits where the band meets the light line.\n  // phi is the distance from the arch in band widths, positive outside.\n  float t0 = 0.26151 + 0.032207 * (kc - 4.5);\n  float ta = meet(radius(4.5 + (kp + t0 - flow - 4.5) / m), 536.54 + uMotion.y, 0.014062).x;\n  float u = (th - ta) * r / w;\n  float dt = t - t0;\n  float bend = dt < 0.0 ? 8.3036 : 3.5178 - 0.021064 * (kc - 4.5);\n  float phi = (-u + bend * dt * dt - 0.37954) * (1.0471 - 0.14429 * (kc - 4.5));\n  col += uTint * sheen(phi) * env.w;\n  // The apex blooms: a soft warm white glow where the arch turns, as the lens catches it.\n  col += BLOOM * env.w * exp(-sq((phi - 0.12) / 0.42) - sq(dt / 0.2)) * vec3(1.0, 0.9, 0.78);\n\n  // Rim: a hairline along the outer edge, widened to the pixel so it never shimmers. It catches\n  // its own long glint where it passes the light: white along the glint, then red off the\n  // outer end and blue off the inner.\n  float rw = sqrt(0.000144 + aa * aa * 0.35);\n  float prof = 0.012 / rw * exp(-sq(t / rw));\n  if (prof > 1e-4) {\n    float rk = radius(4.5 + (kp - flow - 4.5) / m);\n    vec2 g = meet(rk, 613.43 + uMotion.y, 0.0);\n    float s = (th - g.x) * rk;\n    float hl = max(137.51 + 0.37297 * (g.y - 1000.0), 10.0);\n    float o = -s - hl, i = s - hl;\n    vec3 glint = exp(-max(max(vec3(o - 20.938, o, o + 31.302), vec3(i + 20.938, i, i - 31.302)), 0.0) / 76.225);\n    col += prof * (vec3(env.z) + uTint * (25.0 * env.w * glint));\n  }\n  return col;\n}\n\nvec3 encode(vec3 c) {\n  c = clamp(c, 0.0, 1.0);\n  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));\n}\n\nvoid main() {\n  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);\n  vec2 p = uView.xy + (fc - 0.5 * uRes) * uView.z;\n  vec2 d = p - C;\n  float r = length(d);\n  float th = atan(d.y, d.x);\n  float gap = max(R0 - r, 1.0);\n  float m = uView.w;\n  float K = 4.5 + (1.0 + log(gap / D1) / LNQ + nudge(p) - 4.5) * m + uMotion.x;\n  float w = gap * LNQ / m;\n  float aa = uView.z / w;\n\n  vec2 q = clamp(p, vec2(0.0), vec2(" + REF_W + ".0, " + REF_H + ".0)) / 1000.0 - vec2(0.6, 1.0);\n  float body = envelope(q, -3.7092, 2.4996, -4.3156, -4.975, -1.6414, 0.77581, 0.5);\n  vec4 env = vec4(\n    body,\n    min(sqrt(body) * exp(-2.9914), 1.65),\n    envelope(q, -9.7404, 26.18, -13.223, -19.901, -6.2186, 16.602, 1.0),\n    envelope(q, -1.8032, -1.5862, -0.34234, -12.467, -1.9718, 7.467, 1.0) * uMotion.z\n  );\n\n  float kp = floor(K);\n  float t = K - kp;\n  vec3 col = band(kp, t, th, r, w, aa, env);\n  // Analytic coverage across the band boundary: blend in the neighbour within half a pixel.\n  if (t < aa * 0.5) col = mix(band(kp - 1.0, t + 1.0, th, r, w, aa, env), col, 0.5 + t / aa);\n  else if (t > 1.0 - aa * 0.5) col = mix(band(kp + 1.0, t - 1.0, th, r, w, aa, env), col, 0.5 + (1.0 - t) / aa);\n\n  // Filmic shoulder, then sRGB, then fine grain against banding in the deep blacks.\n  col = encode(1.0 - exp(-col * 0.69504));\n  col += (hash(fc + uSeed) - 0.5) * (3.0 / 255.0);\n  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);\n}\n";

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  // Resolve any CSS colour (hex, rgb, oklch, color-mix…) to RGB in 0..1.
  function readColor(css, ctx) {
    var hex = css.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (hex) {
      var h = hex[1].length === 3 ? hex[1].replace(/./g, "$&$&") : hex[1];
      return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
    }
    if (!ctx) return [0.5, 0.5, 0.5];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    var p = ctx.getImageData(0, 0, 1, 1).data;
    return [p[0] / 255, p[1] / 255, p[2] / 255];
  }

  function linear(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }

  // The sheen is three dispersed lobes, red outside, blue inside. A tint sends the red lobe to the
  // warm colour and the blue lobe to the cool one, and gives green whatever is left so the
  // overlap still burns white. Column-major, as WebGL wants it.
  function tintMatrix(tint, ctx) {
    if (!tint) return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    var warm = readColor(tint[0], ctx).map(linear);
    var cool = readColor(tint[1], ctx).map(linear);
    var peak = Math.max.apply(null, warm.map(function (v, i) { return v + cool[i]; }).concat([1e-3]));
    var s = Math.min(1, 1 / peak);
    var mid = warm.map(function (v, i) { return Math.max(0, 1 - s * (v + cool[i])); });
    return new Float32Array(
      warm.map(function (v) { return v * s; })
        .concat(mid)
        .concat(cool.map(function (v) { return v * s; }))
    );
  }

  // Critically damped spring, integrated implicitly so any frame time is stable.
  function step(s, target, dt, omega) {
    var f = 1 + 2 * dt * omega;
    var oo = omega * omega;
    var det = 1 / (f + dt * dt * oo);
    var x = (f * s.x + dt * s.v + dt * dt * oo * target) * det;
    s.v = (s.v + dt * oo * (target - s.x)) * det;
    s.x = x;
  }

  // Reference px per CSS px for a box of this size: a square shows the middle 1179 px of the
  // reference, wider boxes show more of the stack sideways, taller ones more above and below.
  function viewScale(w, h) {
    var aspect = w / Math.max(h, 1);
    return aspect >= 1 ? (REF_W * Math.sqrt(aspect)) / w : REF_W / w;
  }

  // No WebGL: the ring stack as a repeating radial gradient around the same off-frame centre,
  // darkened towards the lower left, with the two central streaks laid over it as soft amber,
  // white and blue glows. The glows drift a little, like the light swaying.
  function streak(x, y) {
    return [
      "radial-gradient(5% 6% at " + x + "% " + y + "%, rgba(255,248,236,0.85), rgba(255,240,220,0) 100%)",
      "radial-gradient(10% 5% at " + (x + 6) + "% " + (y - 4) + "%, rgba(140,190,255,0.5), rgba(120,170,255,0) 100%)",
      "radial-gradient(6% 14% at " + (x - 2) + "% " + (y + 9) + "%, rgba(255,150,70,0.4), rgba(255,140,60,0) 100%)"
    ].join(",");
  }
  var FALLBACK_CSS =
    "@keyframes chrome-arcs-drift{to{background-position:2% -1%,2% -1%,2% -1%,2% -1%,2% -1%,2% -1%,0 0,0 0}}" +
    "@media (prefers-reduced-motion:reduce){.chrome-arcs-fallback{animation:none!important}}";
  var fallbackCssInjected = false;

  function showFallback(root) {
    if (!fallbackCssInjected) {
      var st = document.createElement("style");
      st.textContent = FALLBACK_CSS;
      document.head.appendChild(st);
      fallbackCssInjected = true;
    }
    var div = document.createElement("div");
    div.setAttribute("aria-hidden", "true");
    div.className = "chrome-arcs-fallback";
    div.style.position = "absolute";
    div.style.inset = "0";
    div.style.backgroundColor = "#000";
    div.style.backgroundImage = [
      streak(38, 21),
      streak(41, 56),
      "linear-gradient(55deg, #000 22%, rgba(0,0,0,0.6) 45%, rgba(0,0,0,0) 68%)",
      "repeating-radial-gradient(circle at 330% 150%, #000 0, #9a9a9a 0.12%, #0b0b0b 0.9%, #1d1d1d 3.2%, #4e4e4e 5%, #141414 6.2%, #020202 7.2%, #000 8.8%)"
    ].join(",");
    div.style.animation = "chrome-arcs-drift 5s ease-in-out infinite alternate";
    root.appendChild(div);
  }

  /**
   * Mount Chrome Arcs into a container element.
   * options: { speed=1, rings=1, tint=[warm, cool], intensity=1, interactive=true, label="Chrome arcs" }
   * Returns a destroy() function. The container must have a size; the canvas fills it.
   */
  function mount(container, options) {
    options = options || {};
    var speed = options.speed !== undefined ? options.speed : 1;
    var rings = options.rings !== undefined ? options.rings : 1;
    var tint = options.tint;
    var intensity = options.intensity !== undefined ? options.intensity : 1;
    var interactive = options.interactive !== undefined ? options.interactive : true;
    var label = options.label || "Chrome arcs";

    var root = document.createElement("div");
    root.setAttribute("role", "img");
    root.setAttribute("aria-label", label);
    root.style.position = "relative";
    root.style.overflow = "hidden";
    root.style.background = "#000";
    root.style.width = "100%";
    root.style.height = "100%";
    container.appendChild(root);

    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.pointerEvents = "none";
    root.appendChild(canvas);

    var gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) { showFallback(root); return function () {}; }

    var prog = gl.createProgram();
    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      showFallback(root);
      return function () {};
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    function u(n) { return gl.getUniformLocation(prog, n); }
    var uRes = u("uRes"), uView = u("uView"), uMotion = u("uMotion"), uTint = u("uTint"), uSeed = u("uSeed");

    var probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    gl.uniformMatrix3fv(uTint, false, tintMatrix(tint, probe.getContext("2d", { willReadFrequently: true })));

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var moving = !reduce && speed > 0;
    var cw = 0, ch = 0, ref = 1, scale = 1;
    // Pointer x in reference px plus hover flag, read by the render loop.
    var pointer = { x: 0, on: 0 };
    var kick = function () {};
    var destroyed = false;

    function resize() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / Math.max(r.width * r.height, 1)));
      cw = Math.max(1, Math.round(r.width * dpr));
      ch = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      scale = viewScale(r.width, r.height);
      ref = (scale * r.width) / cw;
      gl.viewport(0, 0, cw, ch);
      kick();
    }
    var ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    var shift = { x: 0, v: 0 };
    var hover = { x: 0, v: 0 };
    var raf = 0;
    var visible = true;
    var last = -1;
    var clock = 0;
    var start = performance.now();
    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    function frame(now) {
      raf = 0;
      var dt = last < 0 ? 0 : Math.min(Math.max(now - last, 0) / 1000, 1 / 20);
      last = now;
      // The flow follows wall time, so a dropped frame never slows it down.
      if (moving) clock = ((now - start) / 1000) * speed;
      var lap = (((clock / LOOP) % 1) + 1) % 1;

      // The pointer pulls the light line towards itself; the streaks slide along the arcs.
      var p = pointer;
      var on = interactive ? p.on : 0;
      step(shift, on ? (p.x - 537) * PULL : 0, dt, 4);
      step(hover, on, dt, 5);
      // The light sways once per loop, starting from rest so the still frame is the reference.
      var sway = moving ? SWAY * Math.sin(TAU * lap) : 0;

      gl.uniform2f(uRes, cw, ch);
      gl.uniform4f(uView, VIEW_X, VIEW_Y, ref, Math.max(rings, 0.1));
      gl.uniform3f(uMotion, lap, sway + shift.x, intensity * (1 + 0.08 * Math.max(hover.x, 0)));
      gl.uniform1f(uSeed, moving ? Math.floor(clock * 30) % 97 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      var settled = Math.abs(shift.v) + Math.abs(hover.v) + Math.abs(hover.x - on) < 1e-3;
      if (visible && (moving || !settled)) raf = requestAnimationFrame(frame);
    }
    kick = function () {
      if (visible && !raf) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    function onLost(e) {
      e.preventDefault();
      showFallback(root);
    }
    canvas.addEventListener("webglcontextlost", onLost);

    function track(e) {
      var r = root.getBoundingClientRect();
      if (!r) return;
      pointer.x = VIEW_X + (e.clientX - r.left - r.width / 2) * scale;
      pointer.on = 1;
      kick();
    }
    function onMove(e) { if (interactive) track(e); }
    function onLeave() { pointer.on = 0; kick(); }
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      kick = function () {};
      canvas.removeEventListener("webglcontextlost", onLost);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      if (root.parentNode) root.parentNode.removeChild(root);
    };
  }

  window.ChromeArcs = { mount: mount };
})();
