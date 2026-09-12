// Three.js uploads sRGB video as RGBA; custom shaders must decode it before lighting.
export const portraitSampling = /* glsl */ `
  uniform float uVideoSrgb;
  uniform sampler2D uLidLogo;
  uniform mat3 uLidLogoTransform;
  uniform float uLidLogoEnabled;
  float sampleLidLogo(vec2 uv) {
    if (uLidLogoEnabled < .5) return 0.0;
    vec2 local = (uLidLogoTransform * vec3(uv, 1.0)).xy;
    if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) return 0.0;
    return texture2D(uLidLogo, local).a;
  }
  vec3 samplePortraitRgb(vec2 uv) {
    vec3 color = texture2D(uTexture, uv).rgb;
    if (uVideoSrgb > .5) {
      color = mix(color / 12.92, pow((color + .055) / 1.055, vec3(2.4)), step(vec3(.04045), color));
      color = max(color - vec3(.003), vec3(0.0)) / .997;
    }
    return mix(color, vec3(.42), sampleLidLogo(uv));
  }
`;
