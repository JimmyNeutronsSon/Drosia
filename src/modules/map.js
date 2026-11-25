import gsap from 'gsap';

/**
 * Schematic service-area map (horizontally stretched for legibility, like a transit diagram).
 * City coordinates are real lat/lon; the I-5 / BC-99 line is an approximate decorative route.
 */
const CITIES = [
  { n: 'Vancouver', r: 'BC', lat: 49.2827, lon: -123.1207, label: true },
  { n: 'New Westminster', r: 'BC', lat: 49.2057, lon: -122.911 },
  { n: 'Port Moody', r: 'BC', lat: 49.2838, lon: -122.8317 },
  { n: 'Bothell', r: 'WA', lat: 47.7623, lon: -122.2054 },
  { n: 'Kirkland', r: 'WA', lat: 47.6769, lon: -122.206 },
  { n: 'Redmond', r: 'WA', lat: 47.674, lon: -122.1215, hq: true, label: true },
  { n: 'Seattle', r: 'WA', lat: 47.6062, lon: -122.3321, label: true },
  { n: 'Bellevue', r: 'WA', lat: 47.6101, lon: -122.2015 },
  { n: 'Issaquah', r: 'WA', lat: 47.5301, lon: -122.0326 },
  { n: 'Portland', r: 'OR', lat: 45.5152, lon: -122.6784, label: true },
  { n: 'Gresham', r: 'OR', lat: 45.4983, lon: -122.431 },
];
// approximate corridor: BC-99 → I-5
const ROUTE = [
  [49.2827, -123.1207], [49.13, -123.05], [49.0, -122.76], [48.75, -122.48], [48.42, -122.33], [47.98, -122.2],
  [47.6062, -122.3321], [47.25, -122.44], [47.04, -122.9], [46.72, -122.96], [46.14, -122.91], [45.64, -122.66], [45.5152, -122.6784],
];

const W = 600, H = 760;
const LON0 = -123.55, LON1 = -121.75, LAT0 = 45.25, LAT1 = 49.55;
const px = (lon) => 40 + ((lon - LON0) / (LON1 - LON0)) * (W - 80);
const py = (lat) => 30 + ((LAT1 - lat) / (LAT1 - LAT0)) * (H - 60);

function smoothPath(pts) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function initMap({ reduced }) {
  const svg = document.getElementById('map-svg');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };

  const grid = make('g', {});
  for (let x = 20; x < W; x += 22) for (let y = 20; y < H; y += 22) make('circle', { cx: x, cy: y, r: 1.3, class: 'grid-dot' }, grid);

  // region labels
  [['British Columbia', 49.62, -123.5], ['Washington', 47.95, -123.5], ['Oregon', 45.86, -123.5]].forEach(([t, lat, lon]) => {
    const tx = make('text', { x: px(lon), y: py(lat), class: 'label-sub' }); tx.textContent = t.toUpperCase();
  });

  const routePts = ROUTE.map(([lat, lon]) => [px(lon), py(lat)]);
  const d = smoothPath(routePts);
  make('path', { d, class: 'corridor-solid' });
  const corridor = make('path', { d, class: 'corridor' });

  // I-5 shield
  const sx = px(-122.82), sy = py(46.6);
  const shield = make('g', { transform: `translate(${sx - 46} ${sy})` });
  make('rect', { x: -16, y: -11, width: 32, height: 22, rx: 6, class: 'hwy-shield' }, shield);
  const st = make('text', { x: 0, y: 4, 'text-anchor': 'middle', class: 'label-hwy' }, shield); st.textContent = 'I-5';

  const tip = document.querySelector('.map-tip');
  const cities = make('g', {});
  CITIES.forEach((c, i) => {
    const x = px(c.lon), y = py(c.lat);
    const g = make('g', { class: 'city-g' }, cities);
    if (!reduced) make('circle', { cx: x, cy: y, r: 6, class: 'pulse', style: `animation-delay:${(i * 0.37) % 2.6}s` }, g);
    make('circle', { cx: x, cy: y, r: c.hq ? 6.5 : 4.5, class: c.hq ? 'city city--hq' : 'city' }, g);
    if (c.label) {
      const left = c.n === 'Seattle' || c.n === 'Vancouver' || c.n === 'Portland';
      const t = make('text', { x: left ? x - 14 : x + 14, y: y + 4.5, class: 'label', 'text-anchor': left ? 'end' : 'start' }, g);
      t.textContent = c.hq ? `${c.n} · HQ` : c.n;
    }
    const hit = make('circle', { cx: x, cy: y, r: 13, class: 'hit' }, g);
    hit.addEventListener('pointerenter', () => {
      if (!tip) return;
      const r = svg.getBoundingClientRect();
      const host = tip.parentElement.getBoundingClientRect();
      const pt = hit.getBoundingClientRect();
      tip.textContent = `${c.n}, ${c.r}${c.hq ? ' — HQ' : ''}`;
      tip.style.left = `${pt.left + pt.width / 2 - host.left}px`;
      tip.style.top = `${pt.top - host.top}px`;
      tip.style.opacity = '1';
      void r;
    });
    hit.addEventListener('pointerleave', () => { if (tip) tip.style.opacity = '0'; });
  });

  if (reduced) return;

  // draw the corridor & pop the cities when the section enters
  const len = corridor.getTotalLength();
  gsap.set(corridor, { strokeDasharray: `2 7`, strokeDashoffset: 0 });
  const solid = svg.querySelector('.corridor-solid');
  gsap.set(solid, { strokeDasharray: len, strokeDashoffset: len });
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.areas', start: 'top 70%', once: true } });
  tl.from(grid.children, { opacity: 0, duration: 0.6, stagger: { amount: 0.8, from: 'center', grid: 'auto' } })
    .to(solid, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' }, 0.2)
    .from(corridor, { opacity: 0, duration: 0.8 }, 0.6)
    .from(cities.querySelectorAll('.city'), { scale: 0, transformOrigin: 'center', transformBox: 'fill-box', duration: 0.6, ease: 'back.out(3)', stagger: 0.06 }, 0.8)
    .from(cities.querySelectorAll('.label'), { opacity: 0, x: -8, duration: 0.5, stagger: 0.08 }, 1.1)
    .from(shield, { opacity: 0, scale: 0.6, transformOrigin: 'center', duration: 0.5 }, 1.2);

  // mouse tilt
  const map3d = document.querySelector('.map3d');
  const area = document.querySelector('.areas');
  if (matchMedia('(hover: hover)').matches && map3d && area) {
    const rX = gsap.quickTo(map3d, 'rotationX', { duration: 1.2, ease: 'power3' });
    const rZ = gsap.quickTo(map3d, 'rotationZ', { duration: 1.2, ease: 'power3' });
    const rY = gsap.quickTo(map3d, 'rotationY', { duration: 1.2, ease: 'power3' });
    gsap.set(map3d, { rotationX: 32, rotationZ: -10, rotationY: 0 });
    area.addEventListener('pointermove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
      rX(32 - ny * 14); rZ(-10 + nx * 8); rY(nx * 10);
    });
  }
}
