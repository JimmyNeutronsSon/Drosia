import * as THREE from 'three';

/**
 * HERO — "From dust to done."
 * Construction dust (GPU points) drifts in a light beam. The cursor blows it around.
 * Scrolling sweeps every particle into the crisp point-cloud of a high-rise,
 * then an inspection scan line runs up the finished tower.
 */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPR;
  uniform float uSize;
  uniform float uRot;
  uniform float uScan;
  uniform float uStir;
  uniform vec3  uOffset;
  uniform float uScale;
  uniform vec3  uMouse;
  uniform float uMouseF;
  attribute vec3 aTarget;
  attribute vec4 aRand;
  varying float vAlpha;
  varying float vScan;
  varying float vMorph;

  mat2 rot2(float a){ float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }

  void main() {
    // --- dust state: slow turbulent drift + gentle rise, wrapped vertically
    vec3 d = position;
    float tt = uTime * (0.08 + uStir * 0.25);
    d.x += sin(tt * 1.3 + position.y * 0.45 + aRand.z * 6.2831) * (0.6 + uStir);
    d.y += cos(tt * 1.1 + position.x * 0.35 + aRand.z * 3.1415) * 0.5;
    d.z += sin(tt * 0.9 + position.x * 0.25 + aRand.y * 4.0) * 0.5;
    d.y = mod(d.y + uTime * 0.06 * aRand.x + 7.0, 14.0) - 7.0;
    float edge = smoothstep(7.0, 5.6, abs(d.y));

    // --- tower state
    vec3 tg = aTarget * uScale;
    tg.xz = rot2(uRot) * tg.xz;
    tg += uOffset;
    tg += vec3(sin(uTime * 1.7 + aRand.z * 40.0), cos(uTime * 1.3 + aRand.z * 31.0), 0.0) * 0.012;

    // --- staggered morph along a swirling arc
    float t = clamp(uProgress * 1.65 - aRand.y * 0.65, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    float arc = sin(t * 3.14159);
    vec3 swirl = vec3(cos(aRand.z * 6.2831 + uTime * 0.2), (aRand.y - 0.5) * 1.6, sin(aRand.z * 6.2831 + uTime * 0.2)) * 2.4 * arc;
    vec3 p = mix(d, tg, t) + swirl;

    // --- cursor "air blower"
    vec2 dm = p.xy - uMouse.xy;
    float md = length(dm);
    float push = exp(-(md * md) / 2.6) * uMouseF * (1.0 - t * 0.75);
    p.xy += normalize(dm + 0.0001) * push * 1.4;
    p.z  += push * 0.8;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = uSize * aRand.x * mix(1.0, 0.62, t);
    gl_PointSize = size * uPR * (1.0 / -mv.z);

    float twinkle = 0.62 + 0.38 * sin(uTime * (0.6 + aRand.z * 1.6) + aRand.z * 30.0);
    float bokeh = aRand.x > 2.2 ? 0.34 : 1.0;
    float dustA = (0.18 + 0.7 * aRand.w) * twinkle * bokeh * edge;
    float towerA = 0.55 + 0.45 * aRand.w;

    float scanY = mix(-5.0, 4.6, uScan) * uScale + uOffset.y;
    vScan = (1.0 - smoothstep(0.0, 0.42 * uScale, abs(tg.y - scanY))) * t;
    vAlpha = mix(dustA, towerA, t);
    vMorph = t;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uDust;
  uniform vec3 uTower;
  uniform vec3 uAccent;
  varying float vAlpha;
  varying float vScan;
  varying float vMorph;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    vec3 col = mix(uDust, uTower, vMorph);
    col = mix(col, uAccent, vScan);
    gl_FragColor = vec4(col, a * vAlpha * (1.0 + vScan * 1.5));
  }
`;

function rand(a, b) { return a + Math.random() * (b - a); }
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// Tower dimensions (local units)
const Y0 = -4.6, H = 8.6, FLOORS = 36, W = 1.1, D = 0.78, TWIST = 0.85;

function towerPoint(out) {
  const r = Math.random();
  let x, y, z;
  const perim = (t, w, d) => {
    const side = Math.floor(t * 4) % 4, u = (t * 4) % 1;
    if (side === 0) return [-w + 2 * w * u, -d];
    if (side === 1) return [w, -d + 2 * d * u];
    if (side === 2) return [w - 2 * w * u, d];
    return [-w, d - 2 * d * u];
  };
  if (r < 0.6) {
    // floor slab edges
    const f = Math.floor(Math.random() * (FLOORS + 1));
    y = Y0 + (f / FLOORS) * H;
    [x, z] = perim(Math.random(), W, D);
  } else if (r < 0.84) {
    // vertical mullions
    const m = Math.floor(Math.random() * 20) / 20;
    y = Y0 + Math.random() * H;
    [x, z] = perim(m, W, D);
  } else if (r < 0.95) {
    // site grid at the base
    const g = 0.55, n = 9;
    const line = (Math.floor(Math.random() * (2 * n + 1)) - n) * g;
    const along = rand(-n * g, n * g);
    if (Math.random() < 0.5) { x = line; z = along; } else { x = along; z = line; }
    y = Y0 - 0.02;
    out.fade = 1 - Math.min(1, Math.hypot(x, z) / (n * g));
    out.x = x; out.y = y; out.z = z; out.grid = true;
    return out;
  } else {
    // crown + mast
    if (Math.random() < 0.55) { x = 0; z = 0; y = Y0 + H + Math.random() * 1.1; }
    else { const a = Math.random() * Math.PI * 2; x = Math.cos(a) * W * 0.6; z = Math.sin(a) * D * 0.6; y = Y0 + H + 0.15; }
  }
  // twist + taper
  const k = (y - Y0) / H;
  const tw = k * TWIST, taper = 1 - 0.14 * k;
  const c = Math.cos(tw), s = Math.sin(tw);
  out.x = (x * c - z * s) * taper;
  out.z = (x * s + z * c) * taper;
  out.y = y;
  out.fade = 1; out.grid = false;
  return out;
}

export function createHero(canvas, opts = {}) {
  const { isMobile = false } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const pr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
  renderer.setPixelRatio(pr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  const COUNT = isMobile ? 9000 : 22000;
  const pos = new Float32Array(COUNT * 3);
  const tgt = new Float32Array(COUNT * 3);
  const rnd = new Float32Array(COUNT * 4);
  const tp = {};
  for (let i = 0; i < COUNT; i++) {
    // dust: mostly uniform volume + a denser cloud inside the light beam
    if (Math.random() < 0.7) {
      pos[i * 3] = rand(-12, 12); pos[i * 3 + 1] = rand(-7, 7); pos[i * 3 + 2] = rand(-9, 5);
    } else {
      pos[i * 3] = 2.5 + gauss() * 2.6; pos[i * 3 + 1] = gauss() * 2.4; pos[i * 3 + 2] = -1 + gauss() * 2.2;
    }
    towerPoint(tp);
    tgt[i * 3] = tp.x; tgt[i * 3 + 1] = tp.y; tgt[i * 3 + 2] = tp.z;
    const big = Math.random() < 0.04;
    rnd[i * 4] = big ? rand(2.4, 4.2) : rand(0.45, 1.5);
    rnd[i * 4 + 1] = Math.random();
    rnd[i * 4 + 2] = Math.random();
    rnd[i * 4 + 3] = tp.grid ? tp.fade * 0.55 : Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aTarget', new THREE.BufferAttribute(tgt, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uPR: { value: pr },
    uSize: { value: isMobile ? 52 : 62 },
    uRot: { value: 0 },
    uScan: { value: 0 },
    uStir: { value: 0 },
    uOffset: { value: new THREE.Vector3(2.9, -0.1, 0) },
    uScale: { value: 1 },
    uMouse: { value: new THREE.Vector3(99, 99, 0) },
    uMouseF: { value: 0 },
    uDust: { value: new THREE.Color('#ffe9c7') },
    uTower: { value: new THREE.Color('#f1efe8') },
    uAccent: { value: new THREE.Color('#d4f53c') },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  // Public, tweenable state (GSAP drives these)
  const state = { progress: 0, rot: 0, anchors: 0, stir: 0 };

  // Annotation anchors (tower-local coords), projected to screen each frame
  const anchorEls = [...document.querySelectorAll('.hero [data-anchor]')];
  const anchorLocal = [
    new THREE.Vector3(W, Y0 + H * 0.16, 0),
    new THREE.Vector3(W, Y0 + H * 0.5, 0),
    new THREE.Vector3(W, Y0 + H * 0.84, 0),
  ];
  const v = new THREE.Vector3();

  // Mouse → world on z=0 plane
  const mouseNdc = new THREE.Vector2(9, 9);
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  let lastMove = 0, mouseSpeed = 0, lx = 0, ly = 0;
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
    mouseSpeed = Math.min(1, mouseSpeed + Math.hypot(e.clientX - lx, e.clientY - ly) / 120);
    lx = e.clientX; ly = e.clientY;
    mouseNdc.set(nx, ny);
    lastMove = performance.now();
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  let w = 0, h = 0;
  function resize() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const portrait = w / h < 0.9;
    camera.position.z = portrait ? 19 : 16;
    camera.updateProjectionMatrix();
    if (portrait) { uniforms.uOffset.value.set(0, -1.15, 0); uniforms.uScale.value = 0.82; }
    else if (w / h < 1.3) { uniforms.uOffset.value.set(2.2, -0.2, 0); uniforms.uScale.value = 0.8; }
    else { uniforms.uOffset.value.set(2.9, -0.15, 0); uniforms.uScale.value = 0.84; }
    uniforms.uSize.value = (portrait ? 48 : 62) * Math.min(1.25, Math.max(0.8, h / 900));
  }
  resize();

  let lastT = performance.now();
  let running = false;
  let scanT = 0;

  function render() {
    const now = performance.now(); const dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
    uniforms.uTime.value += dt;
    uniforms.uProgress.value = state.progress;

    // tower spin: scroll-driven plus a slow idle rotation once formed
    uniforms.uRot.value = state.rot + uniforms.uTime.value * 0.06 * state.progress;
    uniforms.uStir.value += (state.stir - uniforms.uStir.value) * 0.08;

    // inspection scan loops once the tower is formed
    if (state.progress > 0.92) { scanT = (scanT + dt * 0.22) % 1.25; uniforms.uScan.value = scanT; }
    else { scanT = 0; uniforms.uScan.value = -1; }

    // mouse force decays when idle
    const idle = performance.now() - lastMove > 120;
    mouseSpeed *= idle ? 0.9 : 0.97;
    uniforms.uMouseF.value += (Math.min(1, 0.35 + mouseSpeed) * (idle ? 0.55 : 1) - uniforms.uMouseF.value) * 0.1;
    ray.setFromCamera(mouseNdc, camera);
    if (ray.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.lerp(hit, 0.18);

    // camera breath + parallax
    const t = uniforms.uTime.value;
    camera.position.x += (mouseNdc.x * 0.35 - camera.position.x) * 0.03;
    camera.position.y += (mouseNdc.y * 0.25 + Math.sin(t * 0.3) * 0.08 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);

    // annotations follow the rotating tower
    if (anchorEls.length) {
      const o = uniforms.uOffset.value, s = uniforms.uScale.value, a = uniforms.uRot.value;
      const c = Math.cos(a), sn = Math.sin(a);
      for (let i = 0; i < anchorEls.length; i++) {
        const L = anchorLocal[i];
        const k = (L.y - Y0) / H, tw = k * TWIST, tap = 1 - 0.14 * k;
        const ct = Math.cos(tw), st = Math.sin(tw);
        // attach to the right-hand silhouette corner of this floor plate
        let best = -1e9, bx = 0, bz = 0;
        for (let q = 0; q < 4; q++) {
          const cx = (q & 1 ? W : -W), cz = (q & 2 ? D : -D);
          const tx = (cx * ct - cz * st) * tap, tz = (cx * st + cz * ct) * tap;
          // must match GLSL rot2(): x' = c·x + s·z, z' = −s·x + c·z
          const wx = tx * c + tz * sn, wz = -tx * sn + tz * c;
          if (wx > best) { best = wx; bx = wx; bz = wz; }
        }
        v.set(bx * s + o.x, L.y * s + o.y, bz * s + o.z);
        v.project(camera);
        const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
        const el = anchorEls[i];
        const local = Math.min(1, Math.max(0, state.anchors * 3 - i * 0.9));
        el.style.opacity = local.toFixed(3);
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
    }
  }

  function start() { if (running) return; running = true; lastT = performance.now(); renderer.setAnimationLoop(render); }
  function stop() { if (!running) return; running = false; renderer.setAnimationLoop(null); }

  return { state, uniforms, resize, start, stop, render, renderer };
}
