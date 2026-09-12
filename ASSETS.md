# Visual Asset Notes

## Owned Portraits

- `public/portrait-fallback.png`: AI-edited hero portrait based on the user's supplied photograph. It preserves the approved glasses, beard, full sleeves, and laptop composition. It is a generated likeness, not a biometric scan or documentary photo.
- `public/portrait-typing.mp4`: user-approved Google Flow / Omni 1.1 Flash footage generated from the owned hero portrait. The accepted H.264 clip is 1280x720, 24fps, and 5.125 seconds, with visible typing. It is muted on the website. No provider provenance mark was intentionally removed or obscured.
- `public/portrait-travel-waterfall.webp`: the user-selected AI-edited backpack-traveler portrait, 1024x1280. The waterfall is a generated setting, not a claim of a documented trip. The image alternative text identifies it as AI-edited.
- `public/social-cover.png`: generated portfolio sharing artwork.

Exact generation prompts, approval history, originals, and comparison captures are retained privately. The unused original phone screenshot and previous portrait edit are outside the public asset directory.

## Laptop Emblem

The requested Apple silhouette in `src/assets/apple.svg` is from [Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/apple.svg), distributed under [CC0](https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md). Apple is a trademark of Apple Inc.; the depicted laptop does not imply endorsement. A source-coordinate decal adds the emblem to the owned still/video in the WebGL renderer, including dot and dissolve passes. The original media files are unchanged.

## Alternate 3D Character

- Model: Quaternius Universal Base Characters, Standard edition, Superhero Male FullBody.
- Author/source: [Quaternius](https://quaternius.com/packs/universalbasecharacters.html).
- License: CC0 1.0, included in `public/character-license.txt`.
- Distribution: [GLB source](https://github.com/Seyamalam/blood-league-kickoff/blob/main/public/assets/vendor/quaternius/night-striker.glb) and [credits](https://github.com/Seyamalam/blood-league-kickoff/blob/main/docs/ASSET_CREDITS.md).
- Runtime: `public/character-runtime.glb`; unused embedded texture images were removed while retaining geometry and skeleton data. Original source model is retained privately.
- Adaptation: local styling, hair, beard, glasses, skeletal posing, typing, and scene effects. This is a stylized approximation, not a scan of Saleem.

## Fonts And Icons

Uncut Sans, Gabarito, JetBrains Mono, Manrope, and Space Grotesk are self-hosted through Fontsource. SIL Open Font License notices are in `public/licenses/`. [Uncut Sans source](https://github.com/kaspernordkvist/uncut_sans). Interface icons use [Lucide](https://lucide.dev/license), licensed under ISC.

## Design Reference

The user requested a visual direction based on [Ruben Marcus](https://www.rubenmarcus.dev/) and its [Awwwards showcase](https://www.awwwards.com/sites/ruben-marcus-portfolio). The deployable portfolio does not ship that site's bundled code, portrait media, personal identity, award badges, or service claims. It is not an endorsed or affiliated reproduction.

Three.js shaders, image-sampled dots, reactive scan lines, procedural dither, terminal text, and workflow diagrams are local implementations. Public reference rendering behavior was studied for visual calibration. Private reference images and video are excluded from both Git and the production build; their optional local study endpoint is development-only and loopback-restricted. No 99% whole-site or identity match is claimed.
