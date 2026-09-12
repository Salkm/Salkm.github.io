import * as THREE from 'three';
import { portraitSampling } from './portrait-sampling.js';

const vertexShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uCover;
  uniform vec2 uOrigin;
  uniform vec2 uPointer;
  uniform vec2 uPan;
  uniform vec2 uResolution;
  uniform float uEnergy;
  uniform float uHoverEnabled;
  uniform float uTime;
  uniform float uPhase;
  uniform float uFollow;
  uniform float uPixelRatio;
  uniform float uPointScale;
  uniform vec2 uFaceCenter;
  uniform vec2 uFaceRadius;
  varying vec3 vColor;
  varying float vAlpha;
  ${portraitSampling}
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main() {
    vec2 source = position.xy;
    float seed = hash(source * 123.4);
    vec3 texel = samplePortraitRgb(source);
    float lum = dot(texel,vec3(.2126,.7152,.0722));
    float tone = pow(lum,.56);
    float face = 1.0-smoothstep(.65,1.1,length((source-uFaceCenter)/uFaceRadius));
    float cloud = smoothstep(.95,1.95,uPhase);
    float scatter = smoothstep(2.0,3.0,uPhase);
    float contour = 1.0-smoothstep(.06,.24,abs(fract(tone*16.0+source.y*72.0+seed*.25)-.5));
    vec2 lean = uPointer-vec2(.5);
    vec2 unlean = (source-.5-lean*vec2(.016,.013))/(1.0+.022*length(lean))+.5;
    vec2 local = (unlean-uOrigin-uPan)/uCover+.5;
    local.y -= uFollow;
    vec2 relative = (local-uPointer)*vec2(uResolution.x/uResolution.y,1.0);
    float influence = exp(-dot(relative,relative)*15.0);
    vec2 tangent = vec2(-relative.y,relative.x)/max(length(relative),.001)/vec2(uResolution.x/uResolution.y,1.0);
    float depth = (.2+tone*.8);
    local += tangent*influence*(.003+uEnergy*.018)*depth*uHoverEnabled;
    local += cloud*vec2(sin(source.y*12.0+uTime*.24),cos(source.x*9.0+uTime*.2))*.004*depth;
    vec2 drift = vec2(.07+seed*.23,(hash(source.yx*74.0)-.3)*.24);
    local += drift*scatter*(.35+hash(source*91.0));
    vColor = mix(vec3(.07,.30,.035),vec3(.46,.92,.29),tone)*mix(.6+contour*.8,.12+tone*1.8,cloud);
    vAlpha = smoothstep(.0009,.007,lum)*mix(.88-face*.53,.98,cloud);
    vAlpha *= (.35+contour*.65)*mix(1.0,.45+seed*.35,scatter);
    vAlpha *= clamp(local.x/.2,0.0,1.0);
    if (lum < .0009) vAlpha = 0.0;
    gl_Position = vec4(local*2.0-1.0,0.0,1.0);
    gl_PointSize = (.9+tone*1.15+contour*.45+cloud*.7)*uPixelRatio*uPointScale;
  }
`;
const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float radius = length(gl_PointCoord-.5);
    float alpha = vAlpha*(1.0-smoothstep(.27,.5,radius));
    if (alpha < .01) discard;
    gl_FragColor = vec4(vColor,alpha);
    #include <colorspace_fragment>
  }
`;

export function createPortraitParticles(uniforms) {
  const side = 360;
  const positions = new Float32Array(side * side * 3);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const i = (y * side + x) * 3;
      const jitter = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      positions[i] = (x + .25 + (jitter - Math.floor(jitter)) * .5) / side;
      positions[i + 1] = (y + .5 + Math.sin(x * 13.4 + y * 7.1) * .2) / side;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 2;
  return points;
}
