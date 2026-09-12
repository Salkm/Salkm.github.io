import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() { vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }
`;
const noiseFunctions = `
  float hash(vec2 p) {
    vec3 q=fract(vec3(p.xyx)*.1031);
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  float noise(vec2 p) {
    vec2 cell=floor(p), f=fract(p), s=f*f*(3.0-2.0*f);
    float a=hash(cell), b=hash(cell+vec2(1,0));
    float c=hash(cell+vec2(0,1)), d=hash(cell+vec2(1,1));
    return mix(a,b,s.x)+(c-a)*s.y*(1.0-s.x)+(d-b)*s.x*s.y;
  }
  float fractal(vec2 p, int octaves) {
    float result=0.0, amplitude=.5;
    for(int octave=0;octave<5;octave++) {
      if(octave>=octaves) break;
      result+=amplitude*noise(p); p*=2.05; amplitude*=.5;
    }
    return result;
  }
`;
const gridShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  varying vec2 vUv;
  ${noiseFunctions}
  void main() {
    vec2 aspect=vec2(uResolution.x/uResolution.y,1.0);
    vec2 p=(vUv-.5)*aspect, pointer=(uPointer-.5)*aspect;
    float first=fractal(p*1.6+vec2(uTime*.030,-uTime*.017)+vec2(2,5)-pointer*.22,4);
    float second=fractal(p*1.3+vec2(-uTime*.021,uTime*.026)+vec2(7.3,1.1)-pointer*.14,4);
    vec3 color=vec3(.078,.325,.176)*smoothstep(.42,.9,first)*.16;
    color+=vec3(.020,.180,.086)*smoothstep(.5,.95,second)*.14;
    float horizon=.62+pointer.y*.05;
    if(vUv.y<horizon) {
      float depth=.10/max(horizon-vUv.y,.002);
      vec2 grid=vec2((p.x-pointer.x*.16)*depth*1.4,depth+uTime*.5);
      vec2 distance=abs(fract(grid-.5)-.5)/(fwidth(grid)+.0001);
      float line=1.0-min(min(distance.x,distance.y),1.0);
      color+=vec3(0,1,.255)*line*exp(-depth*.35)*.07;
    }
    color*=1.0-smoothstep(.35,.85,length(p));
    color+=(hash(gl_FragCoord.xy+vec2(uTime*47.0))-.5)*.012;
    gl_FragColor=vec4(color,1.0);
  }
`;
const flowShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uGlow;
  uniform float uCell;
  uniform vec3 uColor;
  varying vec2 vUv;
  ${noiseFunctions}
  vec3 fieldColor(vec2 uv) {
    vec2 p=(uv-.5)*vec2(uResolution.x/uResolution.y,1.0);
    float a=fractal(p*1.7+vec2(uTime*.032,uTime*.012),5);
    float b=fractal(p*2.3+vec2(-uTime*.018,uTime*.024)+vec2(3.7,1.4),5);
    float warp=fractal(p*1.4+vec2(a*1.8,b*1.4)+uTime*.015,5);
    float density=(a*.42+b*.32+warp*.26)*(1.0-smoothstep(.42,.92,length(p)));
    density=clamp(density+(hash(uv*uResolution+vec2(uTime*47.0))-.5)*.022,0.0,1.0);
    vec3 middle=mix(vec3(.028,.082,.05),vec3(.05,.14,.085),smoothstep(.52,1.0,density));
    return mix(vec3(.008,.016,.011),middle,smoothstep(0.0,.68,density));
  }
  float character(int bits,vec2 p) {
    ivec2 cell=ivec2(floor(p*vec2(4,-4)+2.5));
    if(cell.x<0 || cell.x>4 || cell.y<0 || cell.y>4) return 0.0;
    return ((bits>>(cell.x+5*cell.y))&1)==1 ? 1.0 : 0.0;
  }
  void main() {
    vec2 pixel=gl_FragCoord.xy;
    vec2 center=(floor(pixel/uCell)*uCell+uCell*.5)/uResolution;
    float gray=dot(fieldColor(center),vec3(.299,.587,.114));
    vec2 aspect=vec2(uResolution.x/uResolution.y,1.0);
    float halo=1.0-smoothstep(0.0,.32,length((vUv-uPointer)*aspect));
    float boost=halo*uGlow*smoothstep(.18,.42,length((vUv-.5)*aspect));
    gray=clamp(gray+boost*.9,0.0,1.0);
    int bits=0;
    if(gray>.05) bits=4194304;
    if(gray>.15) bits=131200;
    if(gray>.25) bits=4329604;
    if(gray>.35) bits=14815374;
    if(gray>.45) bits=4357252;
    if(gray>.55) bits=15255086;
    if(gray>.65) bits=4532014;
    if(gray>.75) bits=11512810;
    if(gray>.85) bits=27141542;
    float mark=character(bits,mod(pixel,uCell)/uCell*2.0-1.0);
    vec3 color=uColor*(.55+gray*1.35)*mark*gray*1.5;
    color+=uColor*boost*.45;
    color-=pow(sin(pixel.y*6.28318)*.5+.5,1.5)*.07*.15;
    color*=clamp(1.0-length(vUv-.5)*.28*1.2,0.0,1.0);
    gl_FragColor=vec4(color,1.0);
  }
`;

function createLayer(canvas, kind, reducedMotion) {
  const grid = kind === 'grid';
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  const uniforms = {
    uTime: { value: grid ? 12 : 0 }, uResolution: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector2(.5, .5) }, uGlow: { value: 0 },
    uCell: { value: innerWidth < 768 ? 20 : 13 }, uColor: { value: new THREE.Color('#2e7d4f') },
  };
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader: grid ? gridShader : flowShader, uniforms, depthTest: false, depthWrite: false });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  const plane = new THREE.Mesh(geometry, material);
  plane.frustumCulled = false;
  scene.add(plane);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const target = new THREE.Vector2(.5, .5);
  let frame = 0, lastTime = 0, lastPaint = 0, elapsed = 0, frames = 0, glow = 0;
  let paused = false, disposed = false, visible = !document.hidden, intersecting = true, lost = false, error = null;
  let width = 1, height = 1, mobile = innerWidth < 768;
  renderer.debug.onShaderError = (gl, program) => { error = gl.getProgramInfoLog(program) || 'Atmosphere shader failed'; };
  const running = () => !paused && !reducedMotion && !(grid && mobile);
  const available = () => !disposed && !lost && visible && intersecting;
  function stop() { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
  function request() { if (!frame && available()) frame = requestAnimationFrame(draw); }
  function draw(now) {
    frame = 0;
    if (!available() || error) return;
    const advance = lastTime ? (now - lastTime) / 1000 : 0;
    const dt = Math.min(advance, .1);
    lastTime = now;
    if (running()) {
      elapsed += advance;
      if (grid) uniforms.uPointer.value.lerp(target, Math.min(1, dt * 1.1));
      else { uniforms.uPointer.value.copy(target); uniforms.uGlow.value += (glow - uniforms.uGlow.value) * .12; }
    }
    if (!grid && running() && now - lastPaint < 1000 / 30) { request(); return; }
    lastPaint = now;
    uniforms.uTime.value = elapsed + (grid ? 12 : 0);
    try {
      renderer.render(scene, camera);
      if (error) throw new Error(error);
      frames++;
      canvas.dataset.ready = 'true';
    } catch (cause) { error = String(cause); stop(); return; }
    if (running()) request();
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    mobile = innerWidth < 768;
    renderer.setPixelRatio(grid ? Math.min(devicePixelRatio || 1, 1.5) : 1);
    renderer.setSize(width, height, false);
    uniforms.uResolution.value.set(width, height);
    uniforms.uCell.value = mobile ? 20 : 13;
    if (mobile) { target.set(.5, .5); uniforms.uPointer.value.copy(target); glow = uniforms.uGlow.value = 0; }
    request();
  }
  function pointer(event) {
    if (!running() || mobile || event.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / width, y = 1 - (event.clientY - rect.top) / height;
    target.set(THREE.MathUtils.clamp(x, 0, 1), THREE.MathUtils.clamp(y, 0, 1));
    glow = x >= 0 && x <= 1 && y >= 0 && y <= 1 ? 1 : 0;
  }
  const leave = () => { glow = 0; };
  const visibility = () => { visible = !document.hidden; stop(); request(); };
  const contextLost = event => { event.preventDefault(); lost = true; stop(); };
  const contextRestored = () => { lost = false; material.needsUpdate = true; resize(); };
  window.addEventListener('pointermove', pointer, { passive: true });
  document.addEventListener('pointerleave', leave);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersection = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; stop(); request(); });
  intersection.observe(canvas);
  resize();
  return {
    setPaused(value) { paused = Boolean(value); stop(); request(); },
    setReducedMotion(value) {
      reducedMotion = Boolean(value);
      if (reducedMotion) { target.set(.5, .5); uniforms.uPointer.value.copy(target); glow = uniforms.uGlow.value = 0; }
      stop(); request();
    },
    reset() { elapsed = 0; target.set(.5, .5); uniforms.uPointer.value.copy(target); glow = uniforms.uGlow.value = 0; stop(); request(); },
    getDiagnostics() { return { kind, ready: frames > 0, frames, elapsed, width, height, pixelRatio: renderer.getPixelRatio(), paused, reducedMotion, mobile, visible, intersecting, lost, error, pointer: uniforms.uPointer.value.toArray(), glow: uniforms.uGlow.value }; },
    dispose() {
      disposed = true; stop(); resizeObserver.disconnect(); intersection.disconnect();
      window.removeEventListener('pointermove', pointer); document.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
      geometry.dispose(); material.dispose(); renderer.dispose();
    },
  };
}

export function createAtmosphere({ gridCanvas, flowCanvas, reducedMotion = false }) {
  const layers = [];
  for (const [canvas, kind] of [[gridCanvas, 'grid'], [flowCanvas, 'flow']]) {
    try { layers.push(createLayer(canvas, kind, reducedMotion)); }
    catch (error) { canvas.dataset.failed = 'true'; console.warn(`${kind} background unavailable`, error); }
  }
  return {
    setPaused(value) { layers.forEach(layer => layer.setPaused(value)); },
    setReducedMotion(value) { layers.forEach(layer => layer.setReducedMotion(value)); },
    reset() { layers.forEach(layer => layer.reset()); },
    getDiagnostics() { return layers.map(layer => layer.getDiagnostics()); },
    dispose() { layers.forEach(layer => layer.dispose()); },
  };
}
