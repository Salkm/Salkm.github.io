# Saleem KM Portfolio

Cybersecurity and AI automation portfolio for [salkm.github.io](https://salkm.github.io/), built with Vite, Three.js, and Lucide.

## Development

Use Node.js 24, then `npm ci` and `npm run dev -- --port 4175`.
For production, run `npm run build` and `npm run preview -- --port 4176`.

GitHub Actions builds and deploys only `dist` on a push to `main`. GitHub Pages must use the **GitHub Actions** build source. A local build does not publish anything.

## Structure

- `index.html`: page content, metadata, navigation, and accessible controls.
- `src/data.js`: project summaries, services, experience, and certifications.
- `src/main.js`: project filtering, dialogs, navigation, contact actions, and scene integration.
- `src/hero.css` and `src/sections.css`: current responsive design. `styles.css` and `responsive.css` contain shared controls and earlier defaults.
- `src/portrait-scene.js`, `portrait-particles.js`, `portrait-sampling.js`, and `portrait-framing.js`: image/video-based WebGL portrait, dots, reactive scan lines, laptop emblem, and four scroll states.
- `src/hero-terminal.js`, `atmosphere.js`, `page-field.js`, and `page-motion.js`: background effects and section entrances, with pause and reduced-motion handling.
- `src/scene.js` and `character.js`: alternate rigged-character renderer, selected with `?renderer=character`.
- `public/portrait-fallback.png`: approved full-sleeve hero still.
- `public/portrait-typing.mp4`: approved 5.125-second generated typing loop. Desktop motion samples this video; mobile, reduced-motion, and failure recovery use the still.
- `public/portrait-travel-waterfall.webp`: selected AI-edited backpack-traveler About portrait.
- `ASSETS.md`: asset provenance and licenses.

The photographic hero is video-driven WebGL, not a rigged human model, biometric scan, or guaranteed likeness percentage. The website has no contact backend, tracking, credentials, or paid AI calls. Contact actions use email and existing public profiles.

## Verification

Browser checks use an installed Playwright module. Set `PLAYWRIGHT_MODULE` to its absolute module path when it is not installed locally. Pixel-comparison scripts also accept `PNGJS_MODULE`. Browser screenshots, profiles, and results are written to ignored `artifacts/`.

- `scripts/verify-zoom.mjs`: actual Chrome page zoom from 50% to 400%, DPR verification, text bounds, header clearance, portrait pixels, menu scrolling, and project dialogs. Uses an isolated test profile, never the user's Chrome profile.
- `scripts/verify-release.mjs`: 18 desktop/tablet/mobile/landscape viewports, section layouts, filtering, dialogs, keyboard focus, clipboard, images, anchors, request failures, and no-WebGL fallback.
- `scripts/verify-hover-experience.mjs`: hover response with video held still, scan lines, pause, mobile behavior, and reduced motion.
- `scripts/verify-laptop-emblem.mjs`: emblem placement and visible pixels in video, still, mobile, and scroll states.
- `scripts/verify-owned-typing.mjs`: generated video playback, loop, pause/resume, responsive switching, and offscreen suspension.
- `scripts/verify-portrait-dots.mjs`: four scroll states, reverse scrolling, pause, and reduced motion.
- `scripts/verify-travel-portrait.mjs`: selected About image, correct dimensions, aspect ratio, and responsive placement.
- `scripts/verify-portrait-video-fallback.mjs`: initial and runtime media failure recovery.

The release and zoom scripts default to `http://127.0.0.1:4176/`. Override with `PORTFOLIO_URL`. `QA_OUTPUT` changes the evidence directory. Older reference-study scripts remain available for local design comparisons.

Reference media, original source photos, unused generation assets, and private generation history are retained locally under ignored `artifacts/` and private documentation. They are not deployed or committed. Development-only reference calibration is restricted to loopback requests; production always uses Saleem's own media. The previous compiled export remains in repository history and is not used by the new deployment.
