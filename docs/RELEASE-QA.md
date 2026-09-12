# Portfolio Release QA

Date: September 12, 2026. Target: https://salkm.github.io/.

## Fixes

- Replaced the fixed-height opening section with a content-sized layout. Enlarged text can now extend the page instead of being clipped or moving behind the fixed header.
- Capped the normal desktop hero height to keep the composition balanced when zooming out on a tall effective viewport.
- Allowed action buttons to wrap and reserved separate space for scene controls.
- Made the mobile navigation scroll within the available screen height, including at 400% zoom.
- Close the mobile menu when crossing its layout breakpoint, so resizing does not leave stale open-menu state.
- Increased anchor clearance below the fixed header.
- Preserved the selected waterfall photo, approved hero media, laptop emblem, and interactive portrait effects.

## Verified Before Release

| Area | Coverage | Result |
| --- | --- | --- |
| Native Chrome page zoom | 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400 percent | Passed |
| Responsive layouts | 18 viewport sizes, listed below | Passed |
| Text and controls | Horizontal overflow, header clearance, action/scene-control separation, popup scrolling | Passed |
| Navigation and projects | Menu reachability and Escape, four project filters, dialogs, focus restoration, anchor targets | Passed |
| Contact | Email copying and internal contact navigation; no messages sent | Passed |
| Images | All page images decoded, alternative text present, selected About portrait retained | Passed |
| Portrait hover | Desktop 1440/1900 and mobile 390/320; pixel changes with frozen source video | Passed |
| Typing video | Loop, pause/resume, aspect ratio, reduced motion, mobile still, offscreen suspension | Passed |
| Laptop emblem | Video/still alignment, mobile rendering, pause and dissolve | Passed |
| Scroll states | Four distinct rendered states at 1900, 1440, 390, and 320 pixels; reverse scroll, pause, and reduced motion | Passed |
| Fallback | WebGL disabled: approved still displayed, content remains usable | Passed |
| Video failure recovery | Development-module fixtures: initial load, desktop runtime failure, mobile runtime failure; still restored, controls retained, no retry loop | Passed |
| Runtime | No page exceptions or failed asset responses in the responsive suite | Passed |
| Production dependencies | npm audit --omit=dev: zero reported vulnerabilities | Passed |
| Build | Vite production build completed | Passed |
| Public asset isolation | Original phone screenshot, unused portraits/model, private reference media/history excluded | Passed |

Viewports: 320x568, 360x800, 390x844, 430x932, 568x320, 667x375, 844x390, 760x800, 761x600, 900x900, 901x700, 1024x768, 1150x800, 1151x800, 1280x720, 1440x900, 1920x1080, 2560x1440.

## Method And Evidence

Native zoom used Chrome's page-zoom setting in an isolated temporary profile, verifying both devicePixelRatio and layout-viewport changes. It did not use CSS scaling or pinch-zoom emulation. [Chromium zoom preference tests](https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/browser/profiles/host_zoom_map_browsertest.cc) document the underlying browser preference mechanism.

Playwright checked actual element bounds and WebGL pixels, with screenshot inspection on desktop and mobile. Evidence remains local in ignored `artifacts/zoom-before`, `zoom-final`, `release-qa`, `hover-experience`, `identity-study/typing`, and `release-emblem`. Reusable checks are in `scripts/verify-zoom.mjs` and `scripts/verify-release.mjs`, alongside the portrait-specific tests.

## Limits

- Tested in automated desktop Chrome, including touch-sized viewports and software WebGL. Physical iPhone/Android devices and Safari/Firefox were not tested; this is not a formal accessibility certification.
- At high zoom, vertical scrolling is intentional. All content remains available rather than forcing everything into one screen.
- The Three.js vendor bundle still produces Vite's non-blocking size warning (about 580 kB before gzip). Mobile and reduced-motion users receive a static portrait instead of the typing video.
- The portrait is generated image/video-based WebGL, not a rigged human scan or a measured 99% likeness.
