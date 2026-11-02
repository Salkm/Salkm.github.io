import * as THREE from 'three';
import { createProjectionBeams } from './lab/projection-beams.js';

export function hologramPoints(positions, time, { size = 2.6, opacity = .65, drift = false } = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uSize: { value: size }, uScale: { value: 1 }, uOpacity: { value: opacity } },
    vertexShader: `uniform float uTime,uSize,uScale; varying float vSeed;
      void main(){vec3 p=position;vSeed=fract(sin(dot(p,vec3(12.9,78.2,37.7)))*43758.5);
        ${drift ? 'p.y=mod(p.y+7.2+uTime*(.1+vSeed*.12),14.)-7.2;' : ''}
        gl_PointSize=uSize*uScale*(.65+vSeed*.9);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform float uTime,uOpacity;varying float vSeed;
      void main(){vec2 p=gl_PointCoord-.5;float glow=exp(-dot(p,p)*19.);
        float shimmer=.68+.32*sin(uTime*.9+vSeed*40.);
        gl_FragColor=vec4(.12,.56,1.,glow*uOpacity*shimmer);}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.onBeforeRender = renderer => {
    material.uniforms.uScale.value = renderer.getPixelRatio() * Math.max(.3, Math.min(1.15, renderer.domElement.clientWidth / 950));
  };
  return points;
}

export function sampleEdges(group, time) {
  const positions = [];
  group.updateMatrixWorld(true);
  group.traverse(object => {
    if (!object.isLineSegments || object.userData.noDots) return;
    const a = object.geometry.attributes.position;
    for (let i = 0; i < a.count; i += 2) {
      const start = new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(object.matrixWorld);
      const end = new THREE.Vector3().fromBufferAttribute(a, i + 1).applyMatrix4(object.matrixWorld);
      const length = start.distanceTo(end);
      if (length < .16) continue;
      const count = Math.ceil(length / .21);
      for (let j = 0; j <= count; j++) {
        const p = start.clone().lerp(end, j / count);
        positions.push(p.x, p.y, p.z);
      }
    }
  });
  return hologramPoints(positions, time, { size: 2.7, opacity: .42 });
}

function glowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.07, '#c6f7ff');
  gradient.addColorStop(.22, '#269edf99'); gradient.addColorStop(.55, '#137ccb22');
  gradient.addColorStop(1, '#00152d00');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function createAccountLight(time) {
  const group = new THREE.Group();
  const origin = new THREE.Vector3(.5, -7.2, 3.5);
  group.add(createProjectionBeams(0, time, origin));
  const texture = glowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.position.copy(origin); glow.scale.set(3.6, 1.7, 1); group.add(glow);
  const groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .36, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  groundGlow.rotation.x = -Math.PI / 2; groundGlow.position.copy(origin).y -= .06; group.add(groundGlow);
  for (const radius of [.38, .67, 1.05, 1.5, 2.2]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + .014, 96), new THREE.MeshBasicMaterial({ color: 0x43baff, transparent: true, opacity: .52 / Math.sqrt(radius), side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(origin); group.add(ring);
  }
  const points = [];
  // A deterministic field makes visual comparisons reproducible.
  let seed = 721;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 2200; i++) {
    const height = random() * 7.2, spread = height / 7.2;
    points.push(origin.x + (random() - .5) * 29 * spread, origin.y + height, origin.z + (random() - .5) * 14 * spread);
  }
  group.add(hologramPoints(points, time, { size: 2.1, opacity: .38 }));
  const field = [];
  for (let i = 0; i < 700; i++) field.push((random() - .5) * 31, random() * 14 - 7.2, (random() - .5) * 16);
  group.add(hologramPoints(field, time, { size: 2.8, opacity: .54, drift: true }));
  return { group, origin };
}
