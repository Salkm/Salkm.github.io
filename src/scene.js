import * as THREE from "three";
import { createTypingCharacter } from "./character.js";

const shared = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uMode;
  uniform float uPixelRatio;
  uniform vec2 uViewport;
  uniform float uMobile;
  varying vec3 vScenePosition;
  varying vec3 vRestPosition;
  float grain(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float dissolveEdge() {
    return smoothstep(mix(0.91, 0.78, uMobile), 1.02, gl_FragCoord.x / uViewport.x);
  }
  vec4 states() {
    float a = smoothstep(0.16, 0.36, uScroll);
    float b = smoothstep(0.43, 0.67, uScroll);
    float c = smoothstep(0.80, 1.0, uScroll);
    return mix(vec4(1.0-a, a*(1.0-b), b*(1.0-c), c), vec4(0.0, 0.0, 0.12, 1.0), uMode);
  }
  float copyMask() {
    float column = mix(smoothstep(0.50, 0.54, gl_FragCoord.x / uViewport.x), 1.0, uMobile);
    return column * smoothstep(0.99, 1.08, vScenePosition.y);
  }
`;

function prepareSurface(mesh, uniforms, resources) {
  const original = mesh.geometry;
  const geometry = original.index ? original.toNonIndexed() : original.clone();
  const barycentric = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < geometry.attributes.position.count; i += 3) {
    barycentric[i * 3] = 1; barycentric[i * 3 + 4] = 1; barycentric[i * 3 + 8] = 1;
  }
  geometry.setAttribute("barycentric", new THREE.BufferAttribute(barycentric, 3));
  mesh.geometry = geometry;
  resources.geometries.add(original);
  resources.geometries.add(geometry);
  const material = mesh.material;
  material.transparent = true;
  material.depthWrite = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.uDetailStrength = { value: /Glasses|Eyes|Eyebrows/.test(mesh.name) ? 0.12 : /Laptop/.test(mesh.name) ? 0.55 : 1 };
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
      attribute vec3 barycentric;
      varying vec3 vBarycentric;
      varying vec3 vScenePosition;
      varying vec3 vRestPosition;`)
      .replace("#include <project_vertex>", `#include <project_vertex>
        vBarycentric = barycentric;
        vRestPosition = position;
        vScenePosition = transformed;`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
      ${shared}
      uniform float uDetailStrength;
      varying vec3 vBarycentric;`)
      .replace("#include <opaque_fragment>", /* glsl */ `
        vec4 state = states();
        vec3 edge = smoothstep(vec3(0.0), max(fwidth(vBarycentric), vec3(0.0001)) * 1.10, vBarycentric);
        float wire = 1.0 - min(min(edge.x, edge.y), edge.z);
        float warp = sin(vRestPosition.x * 93.0 + sin(vRestPosition.z * 37.0) * 1.6) * sin(vRestPosition.y * 71.0);
        warp += sin(vRestPosition.y * 211.0 + vRestPosition.z * 61.0) * 0.22;
        float iso = vRestPosition.y * 205.0 + vRestPosition.z * 43.0 + warp * 2.6;
        float contour = 1.0 - smoothstep(0.012, 0.012 + max(fwidth(iso) * 0.43, 0.008), abs(fract(iso) - 0.5));
        float micro = grain(floor(vRestPosition * 950.0));
        float fleck = smoothstep(0.83, 0.96, micro);
        contour *= smoothstep(0.16, 0.48, grain(floor(vRestPosition * 370.0)));
        float edgeDissolve = dissolveEdge() * state.x * uDetailStrength;
        if (micro < edgeDissolve * 0.74) discard;
        float rim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.9);
        float scanY = 0.8 + mod(uTime * 0.15, 1.2);
        float beam = exp(-pow((vScenePosition.y - scanY) * 34.0, 2.0));
        vec3 green = vec3(0.08, 0.93, 0.35);
        float face = smoothstep(1.57, 1.62, vRestPosition.y) * (1.0 - smoothstep(1.74, 1.79, vRestPosition.y));
        float matte = mix(1.0, 0.58 + micro * 0.27 + face * 0.18, uDetailStrength);
        outgoingLight *= state.x * matte + state.y * 0.10 + state.w * 0.42;
        outgoingLight += green * (rim * (state.x * 0.09 + state.w * 0.55)) * uDetailStrength;
        outgoingLight += green * contour * (state.x * 0.105 + state.w * 0.65) * uDetailStrength;
        outgoingLight += green * fleck * (state.x * (0.095 + edgeDissolve * 0.22) + state.w * 0.14) * uDetailStrength;
        outgoingLight += green * wire * state.y * 0.90;
        outgoingLight += green * beam * (state.w * 1.15 + state.x * 0.025) * uDetailStrength;
        diffuseColor.a *= clamp(state.x + state.y * (0.06 + wire * 0.94) + state.w * 0.9, 0.0, 1.0) * copyMask();
        if (diffuseColor.a < 0.015) discard;
        #include <opaque_fragment>
      `);
  };
  material.customProgramCacheKey = () => "typing-human-surface-v2";
  resources.materials.add(material);
  mesh.frustumCulled = false;
  return original;
}

/** Area samples carry interpolated skin weights, including every finger's articulation. */
function sampleGeometry(geometry, count) {
  const position = geometry.attributes.position, color = geometry.attributes.color, normal = geometry.attributes.normal;
  const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
  const index = geometry.index;
  const triangles = Math.floor((index ? index.count : position.count) / 3);
  const areas = new Float32Array(triangles);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let area = 0;
  const vertexAt = (i) => index ? index.getX(i) : i;
  for (let i = 0; i < triangles; i++) {
    a.fromBufferAttribute(position, vertexAt(i * 3));
    b.fromBufferAttribute(position, vertexAt(i * 3 + 1)).sub(a);
    c.fromBufferAttribute(position, vertexAt(i * 3 + 2)).sub(a);
    area += b.cross(c).length() * 0.5;
    areas[i] = area;
  }
  let seed = 17643;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  const joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4), seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const pick = random() * area;
    let lo = 0, hi = triangles - 1;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (areas[mid] < pick) lo = mid + 1; else hi = mid; }
    const vertices = [vertexAt(lo * 3), vertexAt(lo * 3 + 1), vertexAt(lo * 3 + 2)];
    const root = Math.sqrt(random()), r = random();
    const bary = [1 - root, root * (1 - r), root * r];
    const influences = new Map();
    for (let n = 0; n < 3; n++) {
      const vertex = vertices[n], weight = bary[n];
      for (let component = 0; component < 3; component++) {
        positions[i * 3 + component] += position.getComponent(vertex, component) * weight;
        colors[i * 3 + component] += (color?.getComponent(vertex, component) ?? 0.4) * weight;
        normals[i * 3 + component] += normal.getComponent(vertex, component) * weight;
      }
      if (skinIndex) for (let component = 0; component < 4; component++) {
        const joint = skinIndex.getComponent(vertex, component);
        influences.set(joint, (influences.get(joint) || 0) + skinWeight.getComponent(vertex, component) * weight);
      }
    }
    const strongest = [...influences].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const total = strongest.reduce((sum, item) => sum + item[1], 0) || 1;
    strongest.forEach(([joint, weight], n) => { joints[i * 4 + n] = joint; weights[i * 4 + n] = weight / total; });
    seeds[i] = random();
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  result.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  result.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  result.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
  if (skinIndex) {
    result.setAttribute("skinIndex", new THREE.BufferAttribute(joints, 4));
    result.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
  }
  return result;
}

function createPoints(mesh, source, uniforms, count, resources) {
  const geometry = sampleGeometry(source, count);
  const material = new THREE.ShaderMaterial({
    uniforms, vertexColors: true, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      uniform float uPixelRatio;
      attribute float seed;
      varying vec3 vScenePosition;
      varying vec3 vRestPosition;
      varying vec3 vColor;
      varying float vSeed;
      varying float vFacing;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vScenePosition = transformed;
        vRestPosition = position;
        vColor = color;
        vSeed = seed;
        vFacing = normalize(transformedNormal).z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        gl_Position.z -= 0.00008 * gl_Position.w;
        gl_PointSize = (1.35 + seed * 0.85) * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      ${shared}
      varying vec3 vColor;
      varying float vSeed;
      varying float vFacing;
      void main() {
        vec4 state = states();
        float radial = length(gl_PointCoord - 0.5);
        if (radial > 0.5) discard;
        float amount = state.z + state.w * 0.11 + state.x * dissolveEdge() * 0.95;
        if (amount < 0.01) discard;
        float shade = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
        vec3 color = mix(vec3(0.08, 0.50, 0.20), vec3(0.60, 1.0, 0.73), sqrt(shade));
        float alpha = (1.0 - smoothstep(0.30, 0.5, radial)) * amount * copyMask() * smoothstep(-0.12, 0.25, vFacing);
        gl_FragColor = vec4(color * (0.6 + vSeed * 0.35) * (0.5 + max(vFacing, 0.0) * 0.5), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.name = `${mesh.name}SkinnedPoints`;
  points.frustumCulled = false;
  points.renderOrder = 2;
  points.matrixAutoUpdate = false;
  mesh.updateMatrix();
  points.matrix.copy(mesh.matrix);
  if (mesh.isSkinnedMesh) {
    // This flag makes Three upload the same bone texture for the GL_POINTS pass.
    points.isSkinnedMesh = true;
    points.skeleton = mesh.skeleton;
    points.bindMatrix = mesh.bindMatrix;
    points.bindMatrixInverse = mesh.bindMatrixInverse;
  }
  mesh.parent.add(points);
  resources.geometries.add(geometry);
  resources.materials.add(material);
  return points;
}

export async function createPortfolioScene({ canvas, reducedMotion = false, onReady = () => {} }) {
  if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("createPortfolioScene requires a canvas element.");
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  const scene = new THREE.Scene(), stage = new THREE.Group(), humanScale = new THREE.Group();
  humanScale.scale.x = 0.88;
  stage.add(humanScale);
  scene.add(stage);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 25);
  camera.position.set(0, 3.1, 5);
  camera.lookAt(0, 1.28, 0);
  const resources = { geometries: new Set(), materials: new Set(), skeletons: new Set() };
  const cleanups = [];
  const oldStyle = { cursor: canvas.style.cursor, touchAction: canvas.style.touchAction };
  let character, resizeObserver, intersectionObserver;
  let disposed = false, contextLost = false, ready = false, error = null;
  let visible = !document.hidden, intersecting = true, paused = false;
  let width = 0, height = 0, mobile = false, pointCount = 0;
  let frameId = 0, frames = 0, elapsed = 0, lastTime = 0, lastDraw = 0, dirty = true;
  let mode = "automation", modeBlend = 0, progress = 0, progressBlend = 0;
  let dragging = null, previousX = 0, previousY = 0, dragX = 0, dragY = 0;
  const pointer = new THREE.Vector2(), smoothPointer = new THREE.Vector2();
  const uniforms = {
    uTime: { value: 0 }, uScroll: { value: 0 }, uMode: { value: 0 },
    uPixelRatio: { value: 1 }, uViewport: { value: new THREE.Vector2(1, 1) }, uMobile: { value: 0 },
  };
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }
  function stopFrame() { cancelAnimationFrame(frameId); frameId = 0; lastTime = lastDraw = 0; }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stopFrame();
    resizeObserver?.disconnect(); intersectionObserver?.disconnect();
    cleanups.forEach((cleanup) => cleanup());
    if (dragging !== null && canvas.hasPointerCapture?.(dragging)) canvas.releasePointerCapture(dragging);
    canvas.style.cursor = oldStyle.cursor; canvas.style.touchAction = oldStyle.touchAction;
    resources.geometries.forEach((geometry) => geometry.dispose());
    resources.materials.forEach((material) => material.dispose());
    resources.skeletons.forEach((skeleton) => skeleton.dispose());
    scene.clear(); renderer.dispose();
  }
  try {
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      throw new Error("Character shader compilation failed: " + [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].filter(Boolean).join(" | "));
    };
    scene.add(new THREE.HemisphereLight(0xd3f5df, 0x25382c, 1.65));
    const key = new THREE.DirectionalLight(0xf2f2e7, 3.6); key.position.set(-2, 4, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x43ff87, 1.8); rim.position.set(1, 2.8, -2); scene.add(rim);
    const fill = new THREE.DirectionalLight(0x9eb8c5, 1.0); fill.position.set(3, 1.8, 2); scene.add(fill);
    character = await createTypingCharacter();
    resources.skeletons.add(character.skeleton);
    humanScale.add(character.root);
    for (const mesh of character.meshes) {
      if (mesh.skeleton) resources.skeletons.add(mesh.skeleton);
      const source = prepareSurface(mesh, uniforms, resources);
      const count = /SuperHero/.test(mesh.name) ? 36000 : /Laptop/.test(mesh.name) ? 5600 : /Eyes/.test(mesh.name) ? 180 : /Eyebrows/.test(mesh.name) ? 300 : 1400;
      createPoints(mesh, source, uniforms, count, resources);
      pointCount += count;
    }
    function canRender() { return !disposed && !contextLost && visible && intersecting && width > 0 && height > 0; }
    function requestFrame(explicit = true) {
      if (explicit) dirty = true;
      if (!frameId && canRender()) frameId = requestAnimationFrame(render);
    }
    function pose(dt) {
      if (!paused && !reducedMotion) {
        const easing = 1 - Math.exp(-dt * 6);
        modeBlend += ((mode === "security" ? 1 : 0) - modeBlend) * easing;
        progressBlend += (progress - progressBlend) * easing;
        smoothPointer.lerp(pointer, easing);
      }
      uniforms.uTime.value = elapsed; uniforms.uScroll.value = progressBlend; uniforms.uMode.value = modeBlend;
      stage.rotation.set(THREE.MathUtils.clamp(dragY - smoothPointer.y * 0.065, -0.18, 0.18), -0.67 + THREE.MathUtils.clamp(dragX + smoothPointer.x * THREE.MathUtils.degToRad(10), -0.61, 0.61), 0);
      // Inspect the upper body around its center, not around the character's feet.
      stage.position.set(0, 1.24, 0); humanScale.position.y = -1.24;
      character.update(elapsed);
    }
    function draw() { renderer.render(scene, camera); frames++; if (!ready) { ready = true; onReady(); } }
    function render(now) {
      frameId = 0;
      if (!canRender()) return;
      const automatic = !paused && !reducedMotion, interval = 1000 / (mobile ? 24 : 30);
      if (!dirty && automatic && lastDraw && now - lastDraw < interval - 1) { requestFrame(false); return; }
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
      lastTime = lastDraw = now;
      if (automatic) elapsed += dt;
      try { pose(dt); draw(); } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); stopFrame(); return; }
      dirty = false;
      if (automatic) requestFrame(false);
    }
    function resize() {
      if (disposed || contextLost) return;
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.round(rect.width)), nextHeight = Math.max(0, Math.round(rect.height));
      const nextMobile = nextWidth <= 760;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, nextMobile ? 1.25 : 1.5);
      if (width === nextWidth && height === nextHeight && renderer.getPixelRatio() === pixelRatio) return;
      width = nextWidth; height = nextHeight; mobile = nextMobile;
      if (!width || !height) { stopFrame(); return; }
      renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height, false);
      uniforms.uPixelRatio.value = pixelRatio; uniforms.uViewport.value.set(canvas.width, canvas.height); uniforms.uMobile.value = mobile ? 1 : 0;
      const pixelsPerUnit = mobile ? Math.min(height * 0.45 / 0.83, width * 0.98 / 0.91) * 1.45 : Math.min(height * 0.90 / 1.08, width * 0.57 / 1.05) * 1.24;
      const viewWidth = width / pixelsPerUnit, viewHeight = height / pixelsPerUnit;
      const centerX = mobile ? 0.90 : 0.89, centerY = mobile ? 0.616 - 20 / height : 0.60;
      const offsetX = (0.5 - centerX) * viewWidth, offsetY = (centerY - 0.5) * viewHeight;
      camera.left = -viewWidth / 2 + offsetX; camera.right = viewWidth / 2 + offsetX;
      camera.top = viewHeight / 2 + offsetY; camera.bottom = -viewHeight / 2 + offsetY;
      camera.updateProjectionMatrix(); requestFrame();
    }
    canvas.style.touchAction = "pan-y"; canvas.style.cursor = "grab";
    listen(canvas, "pointerdown", (event) => {
      if (event.pointerType === "touch" || !event.isPrimary || event.button !== 0 || dragging !== null) return;
      dragging = event.pointerId; previousX = event.clientX; previousY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId); canvas.style.cursor = "grabbing";
    });
    listen(canvas, "pointermove", (event) => {
      if (event.pointerType === "touch") return;
      if (dragging === event.pointerId) {
        dragX = THREE.MathUtils.clamp(dragX + (event.clientX - previousX) * 0.004, -0.61, 0.61);
        dragY = THREE.MathUtils.clamp(dragY + (event.clientY - previousY) * 0.002, -0.16, 0.16);
        previousX = event.clientX; previousY = event.clientY; requestFrame();
      } else if (!paused && !reducedMotion) {
        const rect = canvas.getBoundingClientRect();
        pointer.set(THREE.MathUtils.clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -1, 1), THREE.MathUtils.clamp(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1, -1, 1));
      }
    }, { passive: true });
    function endDrag(event) {
      if (dragging !== event.pointerId) return;
      dragging = null;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = "grab";
    }
    listen(canvas, "pointerup", endDrag); listen(canvas, "pointercancel", endDrag); listen(canvas, "lostpointercapture", endDrag);
    listen(canvas, "pointerleave", () => { if (!paused && !reducedMotion) pointer.set(0, 0); });
    listen(document, "visibilitychange", () => { visible = !document.hidden; stopFrame(); if (visible) requestFrame(); });
    listen(canvas, "webglcontextlost", (event) => { event.preventDefault(); contextLost = true; error = "WebGL context lost; waiting for restoration."; stopFrame(); });
    listen(canvas, "webglcontextrestored", () => {
      if (disposed) return;
      contextLost = false; error = null;
      resources.materials.forEach((material) => { material.needsUpdate = true; });
      resources.skeletons.forEach((skeleton) => { if (skeleton.boneTexture) skeleton.boneTexture.needsUpdate = true; });
      width = height = 0; stopFrame(); resize(); requestFrame();
    });
    listen(window, "resize", resize, { passive: true });
    if (typeof ResizeObserver !== "undefined") { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas); }
    if (typeof IntersectionObserver !== "undefined") {
      intersectionObserver = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; stopFrame(); if (intersecting) requestFrame(); }, { threshold: 0 });
      intersectionObserver.observe(canvas);
    }
    resize(); pose(0); renderer.compile(scene, camera);
    if (width && height) draw();
    return {
      setMode(nextMode) {
        if (disposed || !["automation", "security"].includes(nextMode) || nextMode === mode) return;
        mode = nextMode;
        if (paused || reducedMotion) modeBlend = mode === "security" ? 1 : 0;
        requestFrame();
      },
      setPaused(value) { if (disposed) return; paused = Boolean(value); stopFrame(); if (!paused) requestFrame(); },
      setReducedMotion(value) { if (disposed) return; reducedMotion = Boolean(value); stopFrame(); if (!reducedMotion && !paused) requestFrame(); },
      setScrollProgress(value) {
        if (disposed || !Number.isFinite(value)) return;
        progress = THREE.MathUtils.clamp(value, 0, 1);
        if (paused) return;
        if (reducedMotion) progressBlend = progress;
        requestFrame();
      },
      reset() {
        if (disposed) return;
        dragX = dragY = elapsed = progress = progressBlend = 0;
        pointer.set(0, 0); smoothPointer.set(0, 0); modeBlend = mode === "security" ? 1 : 0;
        stopFrame(); requestFrame();
      },
      dispose,
      getDiagnostics() {
        const rig = character.diagnostics();
        return {
          ready, disposed, contextLost, error, mode, paused, reducedMotion, visible, intersecting, mobile,
          renderedFrames: frames, frameCount: frames, elapsed, scrollProgress: progress, renderedProgress: progressBlend, modeBlend,
          size: { width, height, pixelRatio: renderer.getPixelRatio(), drawingBufferWidth: canvas.width, drawingBufferHeight: canvas.height },
          objects: character.meshes.length * 2, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
          points: pointCount, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
          asset: "/character-runtime.glb", representation: "skinned-3d-human", states: ["solid-contour", "wireframe", "skinned-points", "scanlines"],
          skeletal: true, boneCount: rig.boneCount, typingTime: elapsed,
          poseSignature: rig.fingerPose.flat().map((n) => n.toFixed(6)).join(","),
          characterParts: ["skinned-body", "head", "jaw-beard", "side-part-hair", "black-glasses", "upper-arms", "forearms", "wrists", "30-finger-joints", "seated-legs", "laptop", "70-key-keyboard"],
          pointSkinning: "shared-gpu-bone-texture", targetFps: mobile ? 24 : 30,
          orbit: { yaw: stage.rotation.y, pitch: stage.rotation.x, maxDragDegrees: 35, pointerDegrees: 10 }, character: rig,
        };
      },
    };
  } catch (cause) { dispose(); throw cause; }
}
