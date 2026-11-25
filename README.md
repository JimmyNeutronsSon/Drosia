# Verily Clean: immersive marketing site

A scroll-driven, WebGL-powered redesign concept for **Verily Clean LLC**, a supervisor-led post-construction & commercial cleaning company headquartered in Redmond, WA, serving Seattle, the Eastside, Oregon and Vancouver BC.

The site tells one story, **"From dust to done."**, in five acts:

| # | Section | What happens |
|---|---------|--------------|
| 1 | **Hero** (WebGL) | ~22k particles of construction dust drift in a light beam. The cursor blows them around. Scrolling sweeps every particle into the point cloud of a twisting high-rise, then a lime inspection scan runs up the tower. Annotations for the three cleaning phases track the rotating tower in 3D. |
| 2 | **Manifesto** | Words ink in as you scroll: *"A space isn't clean because someone says so…"* |
| 3 | **Process** (WebGL) | A cut-away commercial interior is cleaned live as you scroll. **01 Rough clean:** debris, packaging and floor protection fly out. **02 Final clean:** an inspection plane sweeps the room and every surface goes from dusty to polished, per pixel, with the glass clearing to reveal a skyline and a mountain. **03 Touch-up:** lights turn on, furniture drops in, sign-off tags pop and a "Ready for walkthrough" stamp lands. |
| 4 | **Services / Standard / Industries** | Pinned horizontal service gallery with velocity skew, 3D hover tilt and self-drawing icons. Stacking "Verily standard" cards. Industry list with a cursor-following preview. |
| 5 | **Areas / FAQ / Bid** | Tilted 3D schematic map of the I-5 corridor with real city coordinates. Animated accordion FAQ. Bid request form. Footer wordmark. |

## Stack

- **Vite 8**: dev server and bundler (vanilla JS, no framework)
- **GSAP 3.15**: ScrollTrigger, SplitText, DrawSVG, CustomEase. All GSAP plugins have been free since Webflow's 2025 announcement.
- **Three.js r186**: custom GLSL point shader (hero); PBR scene with per-pixel dirty→clean shader injection, shadows and PMREM environment (process)
- **Lenis**: smooth scrolling, synced to GSAP's ticker
- Self-hosted variable fonts via Fontsource: **Archivo** (width axis), **Instrument Serif**, **Inter**, **JetBrains Mono**. Latin subsets only, no third-party requests.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # → dist/          (deploy this folder: Netlify, Vercel, Cloudflare Pages, S3…)
npm run build:single   # → dist-single/   (one self-contained index.html you can email or open by double-click)
npm run preview        # serve dist/ locally
```

## Project structure

```
index.html              semantic markup, SEO meta, LocalBusiness JSON-LD
src/main.js             boot, loader, Lenis, all scroll choreography
src/webgl/hero.js       dust → tower particle system (GLSL)
src/webgl/room.js       3D post-construction interior + dirty→clean shader
src/modules/cursor.js   custom cursor with contextual labels
src/modules/magnetic.js magnetic buttons
src/modules/map.js      service-area map (SVG, real lat/lon)
src/modules/form.js     bid form (endpoint or mailto fallback)
src/styles/             design tokens, layout, responsive, fonts
```

## Built-in quality

- **Performance:** each WebGL canvas renders only while on screen (IntersectionObserver). Device-pixel ratio is capped, and phones get fewer particles. Three.js is code-split (~135 KB gzipped) and loads behind the preloader.
- **Accessibility:** all content is real HTML, never canvas text. SplitText keeps aria-labels. Contrast meets WCAG AA. There is a skip link, keyboard-focus styles, native `<details>` FAQ and labelled form fields.
- **Reduced motion:** with `prefers-reduced-motion`, there is no smooth scroll, pinning or loader. Both 3D scenes render as a single still, and every phase is shown as plain content.
- **No WebGL:** the page falls back gracefully and stays fully readable.
- **Mobile:** stacked layouts, a vertical services list, and a sticky "Call / Request a bid" bar. Touch keeps native scrolling.
- **SEO:** descriptive title and meta, canonical URL, Open Graph tags, and `LocalBusiness` structured data with real phone, email, HQ city and service areas.

## Content: what is real and what you must supply

All copy is drawn from Verily Clean's own published content: services, the three-phase post-construction process, supervisor-led crews, post-job inspections, supplies included, WA licensing and insurance, service areas, phone and email. **No testimonials, ratings, client logos or statistics were invented.** Fake reviews and testimonials are illegal under the FTC rule in force since Oct 21, 2024.

Before launch:

1. **Wire the form.** Set `data-endpoint="https://…"` on `#bid-form` (Formspree, Basin, HubSpot or a CRM webhook). Without it, the form opens a pre-filled email to `hi@verilyclean.net`.
2. **Add real proof.** Real before/after job photos, Google reviews (with permission) and GC or property-manager logos will do more for conversions than any animation.
3. **Confirm the facts:** licence number, insurance limits, hours, and whether Gresham, Port Moody and other areas are still served.
4. **Add analytics and a privacy policy page.** The canonical/OG URL currently points at `verilycleanqs.com`.
5. **Add an OG share image** (`og:image`) at 1200×630.
