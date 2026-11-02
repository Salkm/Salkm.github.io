import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildLab } from "./hologram.js";
import { stations } from "./workflow.js";

export function createLabScene({ canvas, labels, onSelect, onError }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03070b);
  const camera = new THREE.OrthographicCamera(-25, 25, 15, -15, 0.1, 160);
  const home = new THREE.Vector3(27.65, 20.135, 51.82);
  const target = new THREE.Vector3(0.1, 7.66, 0);
  camera.position.copy(home);
  camera.lookAt(target);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = 0.42;
  controls.maxPolarAngle = 1.40;
  controls.minAzimuthAngle = -Math.PI;
  controls.maxAzimuthAngle = Math.PI;
  controls.rotateSpeed = 0.45;
  canvas.style.touchAction = "pan-y";
  const coarsePointer = matchMedia("(pointer: coarse)");
  const updatePointerMode = () => {
    controls.enableRotate = !coarsePointer.matches;
    canvas.style.touchAction = "pan-y";
  };
  updatePointerMode();
  coarsePointer.addEventListener("change", updatePointerMode);
  scene.add(new THREE.HemisphereLight(0xe0ede4, 0x141a17, 0.75));
  const key = new THREE.DirectionalLight(0xfff4df, 2.6);
  key.position.set(-10, 25, 15);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  Object.assign(key.shadow.camera, {
    left: -25,
    right: 25,
    top: 25,
    bottom: -25,
    near: 1,
    far: 70,
  });
  key.shadow.normalBias = 0.05;
  key.shadow.bias = -0.00015;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcde7dc, 1.5);
  fill.position.set(15, 12, -14);
  scene.add(fill);
  const front = new THREE.DirectionalLight(0xf4fbf6, 0.4);
  front.position.set(0, 4, 20);
  scene.add(front);
  const lab = buildLab();
  scene.add(lab.root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.22 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.47;
  ground.receiveShadow = true;
  scene.add(ground);
  const bounds = lab.bounds || new THREE.Box3().setFromObject(lab.root);
  const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.65, 0.50, 0.40);
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(outputPass);
  const corners = lab.framingPoints || [];
  if (!lab.framingPoints)
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z])
          corners.push(new THREE.Vector3(x, y, z));
  let disposed = false,
    paused = false,
    visible = !document.hidden,
    time = 0,
    previous = performance.now(),
    frame;
  let width = 1,
    height = 1,
    hovered = null,
    selected = null,
    dirty = true;
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  const labelElements = stations.map((station) => {
    const button = document.createElement("button");
    button.className = `station-tag station-${station.id}`;
    button.dataset.station = station.id;
    button.setAttribute("aria-label", `Inspect ${station.title}`);
    button.innerHTML = `<b>${station.number}</b><span>${station.title}</span>`;
    button.addEventListener("click", () => onSelect(station.id));
    labels.append(button);
    return { station, button, point: lab.labelPosition(station.id) };
  });
  function fitCamera() {
    camera.updateMatrixWorld();
    let halfHeight = 1,
      halfWidth = 1;
    for (const corner of corners) {
      const local = corner.clone().applyMatrix4(camera.matrixWorldInverse);
      halfHeight = Math.max(halfHeight, Math.abs(local.y));
      halfWidth = Math.max(halfWidth, Math.abs(local.x));
    }
    const aspect = width / height;
    const fit = Math.max(halfHeight * 1.035, (halfWidth * 1.035) / aspect);
    camera.left = -fit * aspect;
    camera.right = fit * aspect;
    camera.top = fit;
    camera.bottom = -fit;
    camera.updateProjectionMatrix();
  }
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, r.width);
    height = Math.max(1, r.height);
    const ratio = Math.min(devicePixelRatio || 1, 1.65);
    renderer.setPixelRatio(ratio);
    composer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom.strength = width < 650 ? 0.28 : 0.65;
    bloom.radius = width < 650 ? 0.24 : 0.50;
    bloom.threshold = width < 650 ? 0.45 : 0.40;
    fitCamera();
    dirty = true;
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement);
  resize();
  function updateLabels() {
    const placed = [];
    const entries = labelElements
      .map((entry) => {
        const point = lab.labelPosition(entry.station.id);
        return { ...entry, p: point.project(camera) };
      })
      .sort((a, b) => a.p.y - b.p.y);
    for (const { station, button, p } of entries) {
      const labelWidth =
        width < 650
          ? 29
          : station.id === "review" || station.id === "audit"
            ? 119
            : 103;
      let x = Math.min(
        width - labelWidth - 7,
        Math.max(7, (p.x * 0.5 + 0.5) * width - labelWidth / 2),
      );
      let y = Math.min(
        height - 88,
        Math.max(55, (-p.y * 0.5 + 0.5) * height - 15),
      );
      let attempts = 0;
      while (
        placed.some(
          (r) =>
            x < r.x + r.w + 3 &&
            x + labelWidth + 3 > r.x &&
            y < r.y + 28 &&
            y + 28 > r.y,
        ) &&
        attempts++ < 5
      )
        y -= 30;
      button.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
      button.hidden = p.z > 1 || p.z < -1;
      button.classList.toggle("is-selected", selected === station.id);
      placed.push({ x, y, w: labelWidth });
    }
  }
  function pick(event) {
    const r = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - r.left) / r.width) * 2 - 1,
      (-(event.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return (
      raycaster.intersectObjects(lab.pickTargets, false)[0]?.object.userData
        .station || null
    );
  }
  const move = (event) => {
    const nextHover = pick(event);
    if (nextHover !== hovered) dirty = true;
    hovered = nextHover;
    lab.setHover(hovered);
    canvas.style.cursor = hovered ? "pointer" : "grab";
    canvas.title = hovered ? `Inspect ${stations.find(station=>station.id===hovered).title}` : "";
  };
  const leave = () => {
    if (hovered) dirty = true;
    hovered = null;
    lab.setHover(null);
  };
  let down = null;
  const pointerDown = (event) => {
    down = { x: event.clientX, y: event.clientY };
  };
  const pointerUp = (event) => {
    if (
      down &&
      Math.hypot(event.clientX - down.x, event.clientY - down.y) < 5
    ) {
      const id = pick(event);
      if (id) onSelect(id);
    }
    down = null;
  };
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointerup", pointerUp);
  const visibility = () => {
    visible = !document.hidden;
    dirty = true;
    previous = performance.now();
  };
  document.addEventListener("visibilitychange", visibility);
  const contextLost = (event) => {
    event.preventDefault();
    onError(new Error("The graphics context was interrupted."));
  };
  canvas.addEventListener("webglcontextlost", contextLost);
  function animate(now) {
    if (disposed) return;
    const delta = Math.min(0.1, (now - previous) / 1000);
    previous = now;
    if (visible) {
      if (!paused) time += delta;
      const cameraChanged = controls.update();
      if (cameraChanged) fitCamera();
      if (!paused || dirty || cameraChanged) {
        lab.update(time);
        updateLabels();
        renderer.info.reset();
        composer.render();
        dirty = false;
      }
    }
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  return {
    setState(state, selection = null) {
      dirty = true;
      selected = selection;
      lab.setState(state, selection);
      for (const { button, station } of labelElements)
        button.classList.toggle("is-active", station.id === state.node);
    },
    setPaused(value) {
      if (paused !== value) dirty = true;
      paused = value;
    },
    zoom(amount) {
      dirty = true;
      camera.zoom = THREE.MathUtils.clamp(camera.zoom + amount, 0.75, 1.65);
      camera.updateProjectionMatrix();
    },
    reset() {
      dirty = true;
      controls.enableDamping = false;
      controls.update();
      camera.position.copy(home);
      controls.target.copy(target);
      camera.zoom = 1;
      controls.update();
      controls.enableDamping = true;
      fitCamera();
    },
    getDiagnostics() {
      return {
        ready: !disposed,
        type: "Interactive holographic projection",
        meshCount: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        resources: {
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          programs: renderer.info.programs.length,
        },
        time,
        paused,
        width,
        height,
        camera: camera.position.toArray(),
        zoom: camera.zoom,
        selected,
        hovered,
        labelCount: labelElements.length,
        evidencePanels: lab.getEvidencePositions().map(({station,point})=>{
          const p=point.project(camera);return {station,x:(p.x*.5+.5)*width,y:(-.5*p.y+.5)*height};
        }),
        stationTargets:lab.getStationPickPositions().map(({station,point})=>{
          const p=point.project(camera);return {station,x:(p.x*.5+.5)*width,y:(-.5*p.y+.5)*height};
        }),
        calibrationPoints:Object.fromEntries(Object.entries(lab.getCalibrationPoints()).map(([id,point])=>{
          const p=point.project(camera);return [id,[(p.x*.5+.5)*width,(-.5*p.y+.5)*height]];
        })),
        ...lab.getFlowDiagnostics(),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      coarsePointer.removeEventListener("change", updatePointerMode);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("webglcontextlost", contextLost);
      labelElements.forEach(({ button }) => button.remove());
      lab.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
      bloom.dispose();
      outputPass.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}
