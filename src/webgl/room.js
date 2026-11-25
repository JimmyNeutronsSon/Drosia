import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * PROCESS — a cut-away commercial interior that gets cleaned as you scroll.
 *   state.debris  0→1  rough clean: debris, packaging and floor protection removed
 *   state.dust    1→0  airborne construction dust
 *   state.scan    0→1  final clean: an inspection plane sweeps the room, surfaces go from dusty to polished
 *   state.lights  0→1  touch-up: lights on
 *   state.furnish 0→1  loose furniture drops in, ready for the owner walkthrough
 *   state.tags    0→1  sign-off tags
 */

const C = (hex) => new THREE.Color(hex);

// ---------- dirty → clean material (scan-driven, per-pixel) ----------
const scanUniform = { value: -8 };
function cleanable(params, dirty) {
  const m = new THREE.MeshStandardMaterial(params);
  const u = {
    uScanX: scanUniform,
    uDirty: { value: C(dirty.color) },
    uClean: { value: m.color.clone() },
    uRoughD: { value: dirty.roughness ?? 1 },
    uRoughC: { value: m.roughness },
    uAlphaD: { value: dirty.opacity ?? m.opacity },
    uAlphaC: { value: m.opacity },
  };
  m.userData.u = u;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP;
        uniform float uScanX; uniform vec3 uDirty; uniform vec3 uClean;
        uniform float uRoughD; uniform float uRoughC; uniform float uAlphaD; uniform float uAlphaC;
        float vcHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vcNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(vcHash(i), vcHash(i+vec2(1,0)), f.x), mix(vcHash(i+vec2(0,1)), vcHash(i+vec2(1,1)), f.x), f.y); }
        float vcMask(){ return smoothstep(uScanX + 0.35, uScanX - 0.35, vWP.x); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cm = vcMask();
        vec2 nq = vWP.xz * 2.3 + vWP.y * 1.7;
        float grime = vcNoise(nq) * 0.6 + vcNoise(nq * 3.1) * 0.4;
        float speck = step(0.93, vcHash(floor(vWP.xz * 38.0 + vWP.y * 21.0)));
        vec3 dirtyCol = uDirty * (0.84 + 0.22 * grime) * (1.0 - speck * 0.28);
        diffuseColor.rgb = mix(dirtyCol, uClean, cm);
        diffuseColor.a = mix(uAlphaD, uAlphaC, cm);`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(uRoughD, uRoughC, vcMask());`);
  };
  return m;
}

function softDot(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function skyTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#9fc0d4'); sky.addColorStop(0.55, '#dfe8e6'); sky.addColorStop(1, '#f3efe6');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  // a mountain on the horizon
  g.fillStyle = 'rgba(232,238,242,0.95)';
  g.beginPath(); g.moveTo(330, 330); g.lineTo(470, 210); g.lineTo(505, 196); g.lineTo(540, 214); g.lineTo(700, 330); g.closePath(); g.fill();
  g.fillStyle = 'rgba(160,180,195,0.35)';
  g.beginPath(); g.moveTo(330, 330); g.lineTo(470, 210); g.lineTo(505, 196); g.lineTo(492, 260); g.lineTo(450, 330); g.closePath(); g.fill();
  // generic skyline
  const towers = [[40, 70, 190], [120, 50, 150], [175, 60, 230], [240, 44, 170], [290, 70, 260], [370, 40, 140], [420, 55, 200], [610, 60, 180], [680, 48, 250], [735, 70, 210], [815, 46, 160], [870, 66, 240], [945, 54, 175]];
  towers.forEach(([x, w, hgt], i) => {
    g.fillStyle = i % 2 ? '#b9c7cf' : '#c6d2d7';
    g.fillRect(x, 512 - hgt, w, hgt);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let yy = 512 - hgt + 10; yy < 500; yy += 14) g.fillRect(x + 6, yy, w - 12, 3);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createRoom(canvas, opts = {}) {
  const { isMobile = false } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const fogColor = C('#e6e3db');
  scene.fog = new THREE.Fog(fogColor, 14, 46);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  const target = new THREE.Vector3(0.2, 1.1, 0);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc8b8, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
  sun.position.set(-3.5, 9, -13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // ---------- materials ----------
  const M = {
    floor: cleanable({ color: '#ebe8e1', roughness: 0.1, metalness: 0 }, { color: '#aaa292', roughness: 1 }),
    wall: cleanable({ color: '#f5f3ee', roughness: 0.8 }, { color: '#cdc6b7', roughness: 1 }),
    counter: cleanable({ color: '#fbfbf8', roughness: 0.12 }, { color: '#bdb6a6', roughness: 1 }),
    glass: cleanable({ color: '#e8f2f2', roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.14, depthWrite: false }, { color: '#9c9c90', roughness: 1, opacity: 0.9 }),
    metal: cleanable({ color: '#2b2c29', roughness: 0.22, metalness: 0.9 }, { color: '#55524a', roughness: 0.9 }),
    ink: new THREE.MeshStandardMaterial({ color: '#1b1d1a', roughness: 0.6 }),
    base: cleanable({ color: '#2d302c', roughness: 0.45 }, { color: '#6d695f', roughness: 1 }),
    bulb: new THREE.MeshStandardMaterial({ color: '#fff6e2', emissive: C('#ffd59a'), emissiveIntensity: 0 }),
    led: new THREE.MeshStandardMaterial({ color: '#d4f53c', emissive: C('#d4f53c'), emissiveIntensity: 0 }),
    wood: new THREE.MeshStandardMaterial({ color: '#c9a46a', roughness: 0.85 }),
    card: new THREE.MeshStandardMaterial({ color: '#b48a58', roughness: 0.95 }),
    drywall: new THREE.MeshStandardMaterial({ color: '#d8d5cc', roughness: 1 }),
    bucketW: new THREE.MeshStandardMaterial({ color: '#efede6', roughness: 0.6 }),
    bucketO: new THREE.MeshStandardMaterial({ color: '#ee7b2b', roughness: 0.55 }),
    alu: new THREE.MeshStandardMaterial({ color: '#b5b9b8', roughness: 0.4, metalness: 0.7 }),
    paper: new THREE.MeshStandardMaterial({ color: '#a79a83', roughness: 1 }),
    tape: new THREE.MeshStandardMaterial({ color: '#6f8fa8', roughness: 0.8 }),
    chip: new THREE.MeshStandardMaterial({ color: '#77715f', roughness: 1 }),
    fabric: new THREE.MeshStandardMaterial({ color: '#39423d', roughness: 0.92 }),
    cushion: new THREE.MeshStandardMaterial({ color: '#c9d2cc', roughness: 0.95 }),
    rug: new THREE.MeshStandardMaterial({ color: '#cfc5b0', roughness: 1 }),
    plant: new THREE.MeshStandardMaterial({ color: '#4f7a3c', roughness: 0.8, flatShading: true }),
    lime: new THREE.MeshStandardMaterial({ color: '#d4f53c', roughness: 0.55 }),
    sky: new THREE.MeshBasicMaterial({ map: skyTexture(), fog: false, toneMapped: false }),
  };

  const box = (w, h, d, mat, x, y, z, parent = scene, opts2 = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = opts2.cast ?? true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  const cyl = (rt, rb, h, mat, x, y, z, parent = scene, seg = 28) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };

  // ---------- shell ----------
  const shell = new THREE.Group(); scene.add(shell);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.3, 8.4), [M.ink, M.ink, M.floor, M.ink, M.ink, M.ink]);
  slab.position.set(-0.1, -0.15, -0.1); slab.receiveShadow = true; shell.add(slab);
  const WH = 4.2, WT = 0.22;
  box(2.2, WH, WT, M.wall, -4.2, 0, -4.1, shell);          // back wall, left of window
  box(3.0, WH, WT, M.wall, 3.5, 0, -4.1, shell);           // right of window
  box(5.0, 0.8, WT, M.wall, -0.5, 0, -4.1, shell);         // sill
  box(5.0, 0.8, WT, M.wall, -0.5, 3.4, -4.1, shell);       // header
  box(WT, WH, 8.2, M.wall, -5.2, 0, -0.1, shell);          // left wall
  // section-cut caps (architectural poche)
  box(10.42, 0.04, WT + 0.02, M.ink, -0.1, WH, -4.1, shell, { cast: false });
  box(WT + 0.02, 0.04, 8.22, M.ink, -5.2, WH, -0.1, shell, { cast: false });
  // window frame + mullions + glass + view
  box(5.0, 0.06, 0.12, M.metal, -0.5, 0.8, -4.0, shell);
  box(5.0, 0.06, 0.12, M.metal, -0.5, 3.34, -4.0, shell);
  [-3, -1.33, 0.33, 2].forEach((x) => box(0.06, 2.6, 0.12, M.metal, x, 0.8, -4.0, shell));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.6), M.glass);
  glass.position.set(-0.5, 2.1, -4.06); glass.renderOrder = 2; shell.add(glass);
  // the view sits just behind the window so it's only ever seen through the glass
  const view = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.0), M.sky);
  view.position.set(-0.5, 2.1, -4.32); scene.add(view);
  // invisible ceiling so the sun only enters through the window
  const ceilMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 10), ceilMat);
  ceil.position.set(0, WH + 0.06, 0); ceil.castShadow = true; scene.add(ceil);
  // structure: beam + column
  box(10.4, 0.3, 0.34, M.base, -0.1, 3.9, 0.9, shell);
  box(0.32, 3.9, 0.32, M.base, 4.86, 0, 0.9, shell);

  // ---------- millwork + fixtures (installed during construction) ----------
  box(3.0, 0.96, 1.0, M.base, 1.4, 0, 0.9, shell);
  box(3.2, 0.07, 1.2, M.counter, 1.4, 0.96, 0.9, shell);
  const led = box(2.9, 0.025, 0.025, M.led, 1.4, 0.92, 1.42, shell, { cast: false });
  led.receiveShadow = false;
  const pendants = [];
  [0.5, 1.4, 2.3].forEach((x) => {
    const g = new THREE.Group(); g.position.set(x, 0, 0.9); shell.add(g);
    cyl(0.008, 0.008, 1.35, M.ink, 0, 2.55, 0, g, 6);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.3, 32, 1, true), M.metal);
    shade.material.side = THREE.DoubleSide; shade.position.y = 2.4; shade.castShadow = true; g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), M.bulb); bulb.position.y = 2.28; g.add(bulb);
    const pl = new THREE.PointLight(0xffd7a0, 0, 7, 2); pl.position.y = 2.15; g.add(pl);
    pendants.push(pl);
  });

  // ---------- construction mess ----------
  const debris = [];
  const addDebris = (obj, delay) => { obj.userData.base = { y: obj.position.y, ry: obj.rotation.y, s: obj.scale.clone() }; obj.userData.delay = delay; debris.push(obj); };

  // floor protection (3 peelable strips with tape seams)
  const paper = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group(); pivot.position.set(-4.85 + i * 3.25, 0.006, -3.8); scene.add(pivot);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.012, 7.5), M.paper);
    strip.position.set(1.6, 0, 3.75); strip.receiveShadow = true; pivot.add(strip);
    const tp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.014, 7.5), M.tape);
    tp.position.set(3.2, 0.001, 3.75); pivot.add(tp);
    pivot.userData.delay = i * 0.18;
    paper.push(pivot);
  }

  const mess = new THREE.Group(); scene.add(mess);
  // plywood stack
  const ply = new THREE.Group(); ply.position.set(3.3, 0.012, 2.8); ply.rotation.y = 0.35; mess.add(ply);
  for (let i = 0; i < 5; i++) { const s = box(2.1, 0.04, 1.05, M.wood, Math.sin(i) * 0.06, i * 0.045, Math.cos(i * 2) * 0.05, ply); s.rotation.y = (i % 2 ? 0.04 : -0.03); }
  addDebris(ply, 0.85);
  // drywall sheets leaning on the left wall
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group(); g.position.set(-4.95 + i * 0.07, 0.01, -1.2 + i * 0.25); mess.add(g);
    const s = box(0.035, 2.3, 1.2, M.drywall, 0.2, 0, 0, g); s.rotation.z = 0.12;
    addDebris(g, 0.05 + i * 0.05);
  }
  // cardboard boxes
  [[-3.9, 0, 2.9, 0.62, 0.3], [-3.1, 0, 3.15, 0.5, -0.2], [-3.7, 0.62, 2.95, 0.44, 0.5], [3.9, 0, -2.8, 0.7, 0.15], [3.2, 0, -3.2, 0.48, 0.6]].forEach(([x, y, z, s, r], i) => {
    const b = box(s, s * 0.8, s, M.card, x, y + 0.012, z, mess); b.rotation.y = r;
    const tapeStrip = new THREE.Mesh(new THREE.BoxGeometry(s * 1.002, 0.004, 0.08), M.paper); tapeStrip.position.y = s * 0.4 + 0.002; b.add(tapeStrip);
    addDebris(b, (x + 5) / 10);
  });
  // buckets
  [[-1.5, 2.6, M.bucketW], [-0.95, 3.05, M.bucketO], [2.4, -3.2, M.bucketW]].forEach(([x, z, m]) => {
    const b = cyl(0.2, 0.17, 0.38, m, x, 0.012, z, mess); addDebris(b, (x + 5) / 10);
  });
  // step ladder
  const lad = new THREE.Group(); lad.position.set(-2.1, 0.012, -2.7); lad.rotation.y = 0.5; mess.add(lad);
  [-0.28, 0.28].forEach((x) => {
    const f = box(0.05, 2.1, 0.07, M.alu, x, 0, 0.18, lad); f.rotation.x = -0.18;
    const b = box(0.05, 2.0, 0.06, M.alu, x, 0, -0.2, lad); b.rotation.x = 0.2;
  });
  for (let i = 0; i < 4; i++) box(0.56, 0.035, 0.12, M.alu, 0, 0.4 + i * 0.42, 0.13 - i * 0.075, lad);
  addDebris(lad, 0.3);
  // offcuts
  for (let i = 0; i < 9; i++) {
    const x = THREE.MathUtils.randFloat(-4.3, 4.3), z = THREE.MathUtils.randFloat(-3.4, 3.5);
    if (x > -0.4 && x < 3.2 && z > 0.2 && z < 1.7) continue;
    const o = box(THREE.MathUtils.randFloat(0.3, 0.9), 0.03, THREE.MathUtils.randFloat(0.1, 0.35), i % 3 ? M.drywall : M.wood, x, 0.012, z, mess);
    o.rotation.y = Math.random() * Math.PI; addDebris(o, (x + 5) / 10);
  }
  // debris chips (instanced)
  const CHIPS = isMobile ? 110 : 180;
  const chips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.chip, CHIPS);
  chips.castShadow = true;
  const chipData = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  for (let i = 0; i < CHIPS; i++) {
    let x, z;
    do { x = THREE.MathUtils.randFloat(-4.8, 4.8); z = THREE.MathUtils.randFloat(-3.8, 3.9); } while (x > -0.1 && x < 2.9 && z > 0.4 && z < 1.4);
    const s = THREE.MathUtils.randFloat(0.03, 0.11);
    chipData.push({ x, z, s, r: Math.random() * Math.PI, d: (x + 5) / 10 });
  }
  scene.add(chips);

  // airborne dust
  const DUST = isMobile ? 500 : 900;
  const dPos = new Float32Array(DUST * 3), dSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) { dPos[i * 3] = THREE.MathUtils.randFloat(-5, 5); dPos[i * 3 + 1] = THREE.MathUtils.randFloat(0, 4); dPos[i * 3 + 2] = THREE.MathUtils.randFloat(-4, 4); dSeed[i] = Math.random() * 100; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos.slice(), 3));
  const dustMat = new THREE.PointsMaterial({ size: 0.075, map: softDot(), color: '#8f8676', transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat); scene.add(dust);

  // inspection scan plane
  const scanGroup = new THREE.Group(); scene.add(scanGroup);
  const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(8.3, 4.3), new THREE.MeshBasicMaterial({ color: '#d4f53c', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  scanPlane.rotation.y = Math.PI / 2; scanPlane.position.set(0, 2.15, -0.1); scanGroup.add(scanPlane);
  const scanEdge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 8.3), new THREE.MeshBasicMaterial({ color: '#c2e81e', fog: false }));
  scanEdge.position.set(0, 0.02, -0.1); scanGroup.add(scanEdge);
  const scanTop = scanEdge.clone(); scanTop.position.y = 4.28; scanGroup.add(scanTop);
  scanGroup.visible = false;

  // ---------- loose furniture (arrives for the walkthrough) ----------
  const furniture = [];
  const addFurn = (obj, delay) => { obj.userData.baseY = obj.position.y; obj.userData.delay = delay; furniture.push(obj); obj.visible = false; };
  const rug = box(3.4, 0.02, 2.5, M.rug, -2.5, 0, 0.9); addFurn(rug, 0);
  const sofa = new THREE.Group(); sofa.position.set(-2.5, 0, 1.55); scene.add(sofa);
  box(2.6, 0.42, 0.95, M.fabric, 0, 0, 0, sofa);
  box(2.6, 0.5, 0.22, M.fabric, 0, 0.42, 0.36, sofa);
  box(0.2, 0.28, 0.95, M.fabric, -1.3, 0.42, 0, sofa); box(0.2, 0.28, 0.95, M.fabric, 1.3, 0.42, 0, sofa);
  box(1.16, 0.13, 0.7, M.cushion, -0.6, 0.42, -0.08, sofa); box(1.16, 0.13, 0.7, M.cushion, 0.6, 0.42, -0.08, sofa);
  addFurn(sofa, 0.15);
  const table = new THREE.Group(); table.position.set(-2.5, 0, 0.2); scene.add(table);
  cyl(0.5, 0.5, 0.05, M.counter, 0, 0.36, 0, table, 40); cyl(0.05, 0.05, 0.36, M.ink, 0, 0, 0, table, 10);
  addFurn(table, 0.3);
  [0.6, 1.4, 2.2].forEach((x, i) => {
    const s = new THREE.Group(); s.position.set(x, 0, 1.95); scene.add(s);
    cyl(0.22, 0.2, 0.06, M.ink, 0, 0.72, 0, s); cyl(0.025, 0.025, 0.72, M.metal, 0, 0, 0, s, 10); cyl(0.2, 0.2, 0.02, M.metal, 0, 0, 0, s);
    addFurn(s, 0.35 + i * 0.08);
  });
  const planter = new THREE.Group(); planter.position.set(-4.3, 0, -3.2); scene.add(planter);
  cyl(0.32, 0.26, 0.62, M.ink, 0, 0, 0, planter);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), M.plant); leaves.position.y = 1.25; leaves.scale.set(1, 1.25, 1); leaves.castShadow = true; planter.add(leaves);
  addFurn(planter, 0.5);
  const art = new THREE.Group(); art.position.set(-5.07, 1.4, 1.0); scene.add(art);
  box(0.04, 1.4, 2.0, M.ink, 0, 0, 0, art); box(0.03, 1.28, 1.88, M.lime, 0.02, 0.06, 0, art);
  addFurn(art, 0.6);

  // ---------- tag anchors ----------
  const tagEls = [...document.querySelectorAll('.room-tags [data-tag]')];
  const tagPts = [new THREE.Vector3(-1.2, 2.7, -4.0), new THREE.Vector3(0.4, 0.02, 3.1), new THREE.Vector3(2.85, 1.04, 1.45), new THREE.Vector3(1.4, 2.45, 0.9)];
  const stampEl = document.querySelector('.room-stamp');

  // ---------- state ----------
  const state = { debris: 0, dust: 1, scan: 0, lights: 0, furnish: 0, tags: 0, stamp: 0, orbit: 0 };
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

  let w = 0, h = 0, radius = 24;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (ev) => { mouse.tx = ev.clientX / window.innerWidth - 0.5; mouse.ty = ev.clientY / window.innerHeight - 0.5; }, { passive: true });

  function resize() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // fit the room's bounding sphere into the narrower field of view
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * camera.aspect);
    radius = 6.6 / Math.sin(Math.min(vf, hf)) * 0.97;
  }
  resize();

  const tmp = new THREE.Vector3();
  const t0 = performance.now();
  let running = false;

  function apply(time) {
    // rough clean: debris lifts, spins and vanishes, sweeping left → right
    for (const o of debris) {
      const k = clamp01(state.debris * 1.6 - o.userData.delay * 0.6);
      const b = o.userData.base;
      const s = 1 - easeOut(k);
      o.visible = s > 0.002;
      o.position.y = b.y + Math.sin(k * Math.PI) * 0.9 + k * 0.4;
      o.rotation.y = b.ry + k * 2.2;
      o.scale.set(b.s.x * s, b.s.y * s, b.s.z * s);
    }
    paper.forEach((p) => {
      const k = clamp01(state.debris * 1.5 - p.userData.delay);
      p.scale.z = Math.max(0.0001, 1 - easeOut(k));
      p.visible = k < 0.999;
    });
    for (let i = 0; i < chipData.length; i++) {
      const c = chipData[i];
      const k = clamp01(state.debris * 1.6 - c.d * 0.6);
      const s = c.s * (1 - easeOut(k));
      pv.set(c.x, 0.012 + c.s * 0.25 + k * 0.6, c.z);
      q.setFromEuler(e.set(0, c.r + k * 3, 0));
      sv.set(s, s * 0.5, s * 1.4);
      m4.compose(pv, q, sv);
      chips.setMatrixAt(i, m4);
    }
    chips.instanceMatrix.needsUpdate = true;

    // airborne dust
    const pa = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST; i++) {
      const s = dSeed[i];
      pa[i * 3] = dPos[i * 3] + Math.sin(time * 0.25 + s) * 0.25;
      pa[i * 3 + 1] = (dPos[i * 3 + 1] + time * 0.05 * (0.4 + (s % 1))) % 4.1;
      pa[i * 3 + 2] = dPos[i * 3 + 2] + Math.cos(time * 0.2 + s * 1.3) * 0.25;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustMat.opacity = 0.85 * state.dust;
    dust.visible = state.dust > 0.01;
    scene.fog.near = 14 + (1 - state.dust) * 40;
    scene.fog.far = 46 + (1 - state.dust) * 120;

    // final clean: scan sweeps x from -6.5 → 6.5
    const sx = -6.5 + state.scan * 13;
    scanUniform.value = sx;
    scanGroup.visible = state.scan > 0.001 && state.scan < 0.999;
    scanGroup.position.x = THREE.MathUtils.clamp(sx, -5.1, 5.1);

    // touch-up: lights
    pendants.forEach((pl, i) => { pl.intensity = 7 * clamp01(state.lights * 1.6 - i * 0.3); });
    M.bulb.emissiveIntensity = 4 * state.lights;
    M.led.emissiveIntensity = 2.4 * state.lights;
    sun.intensity = 3.2 + state.lights * 0.6;

    // furniture drops in with a little bounce
    for (const f of furniture) {
      const k = clamp01(state.furnish * 1.6 - f.userData.delay);
      f.visible = k > 0.001;
      const eb = easeBack(k);
      f.position.y = f.userData.baseY + (1 - k) * 2.2;
      f.scale.setScalar(0.6 + 0.4 * Math.min(eb, 1.08));
    }

    // camera orbit
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    const az = 0.6 + state.orbit * 0.32 + mouse.x * 0.12;
    const pol = 1.0 + state.orbit * 0.06 + mouse.y * 0.05;
    camera.position.set(
      target.x + radius * Math.sin(pol) * Math.sin(az),
      target.y + radius * Math.cos(pol),
      target.z + radius * Math.sin(pol) * Math.cos(az),
    );
    camera.lookAt(target);
  }

  function placeTags() {
    tagEls.forEach((el, i) => {
      tmp.copy(tagPts[i]).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
      const k = clamp01(state.tags * 2.2 - i * 0.35);
      const s = 0.4 + 0.6 * easeBack(k);
      el.style.opacity = k.toFixed(3);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -130%) scale(${s.toFixed(3)})`;
    });
    if (stampEl) {
      const k = clamp01(state.stamp);
      stampEl.style.opacity = k.toFixed(3);
      stampEl.style.transform = `rotate(${(-6 - (1 - k) * 8).toFixed(2)}deg) scale(${(1.5 - 0.5 * easeOut(k)).toFixed(3)})`;
    }
  }

  function render() {
    const t = (performance.now() - t0) / 1000;
    apply(t);
    renderer.render(scene, camera);
    placeTags();
  }

  function start() { if (running) return; running = true; renderer.setAnimationLoop(render); }
  function stop() { if (!running) return; running = false; renderer.setAnimationLoop(null); }

  return { state, resize, start, stop, render, renderer };
}
