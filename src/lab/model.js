import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { stations } from "./workflow.js";

const GREEN = 0x51ed9b,
  AMBER = 0xffbe62,
  RED = 0xff635c;

export function buildLab() {
  const root = new THREE.Group();
  const materials = {
    floor: new THREE.MeshStandardMaterial({
      color: 0x191b1a,
      roughness: 0.64,
      metalness: 0.35,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x727673,
      roughness: 0.32,
      metalness: 0.85,
    }),
    black: new THREE.MeshStandardMaterial({
      color: 0x171918,
      roughness: 0.42,
      metalness: 0.55,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: 0x2b2e2c,
      roughness: 0.56,
      metalness: 0.38,
    }),
    silver: new THREE.MeshStandardMaterial({
      color: 0xa1aaa6,
      roughness: 0.3,
      metalness: 0.85,
    }),
    paper: new THREE.MeshStandardMaterial({
      color: 0x409465,
      emissive: 0x184c30,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.25,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xd5ded9,
      roughness: 0.08,
      metalness: 0.02,
      transparent: true,
      opacity: 0.065,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    green: new THREE.MeshBasicMaterial({ color: GREEN, toneMapped: false }),
    amber: new THREE.MeshBasicMaterial({ color: AMBER, toneMapped: false }),
    red: new THREE.MeshBasicMaterial({ color: RED, toneMapped: false }),
    white: new THREE.MeshBasicMaterial({ color: 0xdae7df, toneMapped: false }),
  };
  const geometryCache = new Map();
  [materials.green, materials.red, materials.amber].forEach((material) =>
    material.color.multiplyScalar(2.2),
  );
  const pickTargets = [];
  const zoneGroups = new Map();
  const activeLights = new Map();
  const paths = [];
  const pulseMeshes = [];
  const screenTextures = [];
  const scanGroup = new THREE.Group();
  const documentGroup = new THREE.Group();
  const tempMatrix = new THREE.Matrix4();

  function box(
    parent,
    w,
    h,
    d,
    x,
    y,
    z,
    material = materials.black,
    radius = false,
  ) {
    const key = `${w}:${h}:${d}:${radius}`;
    if (!geometryCache.has(key))
      geometryCache.set(
        key,
        radius
          ? new RoundedBoxGeometry(
              w,
              h,
              d,
              2,
              Math.min(0.065, w / 5, h / 5, d / 5),
            )
          : new THREE.BoxGeometry(w, h, d),
      );
    const mesh = new THREE.Mesh(geometryCache.get(key), material);
    mesh.position.set(x, y, z);
    mesh.castShadow =
      material !== materials.glass && !material.isMeshBasicMaterial;
    mesh.receiveShadow = !material.isMeshBasicMaterial;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, radius, height, x, y, z, material, segments = 12) {
    const geometry = new THREE.CylinderGeometry(
      radius,
      radius,
      height,
      segments,
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function rail(parent, a, b, material = materials.metal, radius = 0.026) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 6),
      material,
    );
    mesh.position.copy(start).lerp(end, 0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.sub(start).normalize(),
    );
    parent.add(mesh);
    return mesh;
  }
  function panel(parent, w, h, x, y, z, rotation = 0) {
    const wall = new THREE.Group();
    wall.position.set(x, y, z);
    wall.rotation.y = rotation;
    box(wall, w, h, 0.035, 0, h / 2, 0, materials.glass);
    [-w / 2, w / 2].forEach((sx) =>
      box(wall, 0.055, h, 0.055, sx, h / 2, 0, materials.metal),
    );
    [0, h].forEach((sy) => box(wall, w, 0.05, 0.06, 0, sy, 0, materials.metal));
    box(wall, w, 0.018, 0.06, 0, h - 0.055, 0, materials.white);
    parent.add(wall);
    return wall;
  }
  function screenTexture(title, color = "#51ed9b", variant = 0) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 320;
    const c = canvas.getContext("2d");
    c.fillStyle = "#08110e";
    c.fillRect(0, 0, 512, 320);
    c.strokeStyle = "#254035";
    c.lineWidth = 1;
    for (let x = 16; x < 512; x += 24) {
      c.beginPath();
      c.moveTo(x, 40);
      c.lineTo(x, 306);
      c.stroke();
    }
    for (let y = 40; y < 320; y += 24) {
      c.beginPath();
      c.moveTo(16, y);
      c.lineTo(496, y);
      c.stroke();
    }
    c.fillStyle = color;
    c.font = "bold 22px monospace";
    c.fillText(title, 22, 31);
    c.fillStyle = "#a7bfb1";
    c.font = "13px monospace";
    c.fillText("LAB-WKS-042  /  SIMULATED", 22, 57);
    if (variant === 1) {
      c.strokeStyle = color;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(260, 90);
      c.lineTo(340, 228);
      c.lineTo(180, 228);
      c.closePath();
      c.stroke();
      c.fillStyle = color;
      c.font = "bold 62px monospace";
      c.fillText("!", 244, 210);
      c.font = "15px monospace";
      c.fillText("ENDPOINT ALERT", 190, 270);
    } else {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.beginPath();
      for (let x = 24; x < 490; x += 4) {
        const y = 136 + Math.sin(x * 0.05) * 17 + Math.sin(x * 0.11) * 10;
        x === 24 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
      [
        "EVENT NORMALIZED",
        "EVIDENCE RETAINED",
        "POLICY CHECKED",
        "ACTION RECORDED",
      ].forEach((s, i) => {
        c.fillStyle = i % 2 ? "#acc0b4" : color;
        c.font = "14px monospace";
        c.fillText(`${String(i + 1).padStart(2, "0")}  ${s}`, 26, 202 + i * 27);
      });
      for (let i = 0; i < 14; i++) {
        c.fillStyle = color;
        c.globalAlpha = 0.28 + (i % 3) * 0.2;
        c.fillRect(364 + i * 8, 258 - (i % 5) * 12, 4, 38 + (i % 5) * 12);
      }
      c.globalAlpha = 1;
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    screenTextures.push(texture);
    return texture;
  }
  const textures = {
    endpoint: screenTexture("MICROSOFT DEFENDER", "#ff776c", 1),
    evidence: screenTexture("EVIDENCE / HASH CONTEXT"),
    n8n: screenTexture("n8n / ORCHESTRATION"),
    review: screenTexture("ANALYST REVIEW", "#ffbe62"),
    audit: screenTexture("VERIFY / AUDIT"),
    benign: screenTexture("BENIGN / REVIEWED"),
    isolate: screenTexture("NETWORK ISOLATED", "#ff776c", 1),
    standby: screenTexture("CONTAINMENT / STANDBY", "#a4b9ad"),
  };
  const isolationScreens = [];
  function display(parent, x, y, z, width, texture) {
    box(parent, width, width * 0.64, 0.09, x, y, z, materials.black, true);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.085, width * 0.64 - 0.09),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    );
    plane.position.set(x, y, z + 0.051);
    if (texture === textures.isolate) isolationScreens.push(plane.material);
    parent.add(plane);
    box(parent, 0.09, 0.28, 0.08, x, y - width * 0.4, z, materials.silver);
    box(
      parent,
      width * 0.4,
      0.045,
      0.24,
      x,
      y - width * 0.5,
      z,
      materials.metal,
      true,
    );
  }
  function keyboard(parent, x, y, z, width = 0.95) {
    box(parent, width, 0.045, 0.34, x, y, z, materials.metal, true);
    const keys = new THREE.InstancedMesh(
      new THREE.BoxGeometry(width / 16, 0.015, 0.045),
      materials.black,
      52,
    );
    let i = 0;
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 13; col++) {
        tempMatrix.makeTranslation(
          x - width * 0.44 + (col * width) / 14,
          y + 0.03,
          z - 0.115 + row * 0.066,
        );
        keys.setMatrixAt(i++, tempMatrix);
      }
    parent.add(keys);
    box(
      parent,
      0.12,
      0.045,
      0.18,
      x + width * 0.65,
      y + 0.015,
      z,
      materials.black,
      true,
    );
  }
  function chair(parent, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    box(g, 0.67, 0.12, 0.65, 0, 0.55, 0, materials.black, true);
    const back = box(g, 0.64, 0.75, 0.12, 0, 0.98, 0.3, materials.black, true);
    back.rotation.x = -0.1;
    cylinder(g, 0.045, 0.5, 0, 0.28, 0, materials.silver);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      rail(g, [0, 0.08, 0], [Math.cos(a) * 0.37, 0.08, Math.sin(a) * 0.37]);
    }
    [-0.36, 0.36].forEach((sx) => {
      box(g, 0.035, 0.28, 0.035, sx, 0.73, -0.04, materials.metal);
      box(g, 0.065, 0.05, 0.45, sx, 0.9, 0, materials.black);
    });
    parent.add(g);
  }
  function desk(parent, x, z, texture, double = false) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const w = double ? 3.4 : 2.55;
    box(g, w, 0.13, 1.15, 0, 1.15, 0, materials.silver, true);
    box(g, w - 0.12, 0.025, 1.03, 0, 1.23, 0, materials.dark);
    [-w / 2 + 0.15, w / 2 - 0.15].forEach((sx) => {
      box(g, 0.16, 1.08, 0.86, sx, 0.56, 0, materials.black);
      box(g, 0.35, 0.06, 1.1, sx, 0.055, 0, materials.metal);
    });
    if (double) {
      display(g, -0.76, 1.94, -0.26, 1.32, texture);
      display(g, 0.76, 1.94, -0.26, 1.32, textures.audit);
    } else display(g, 0, 1.95, -0.22, 1.5, texture);
    keyboard(g, 0, 1.28, 0.3);
    box(g, 0.27, 0.45, 0.25, -w / 2 + 0.3, 1.45, -0.2, materials.black, true);
    chair(g, 0, 1.12);
    parent.add(g);
    return g;
  }
  function rack(parent, x, z, height = 2.7) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    box(g, 1.12, height, 0.96, 0, height / 2, 0, materials.black, true);
    box(g, 0.98, height - 0.14, 0.02, 0, height / 2, 0.492, materials.dark);
    for (let i = 0; i < 7; i++) {
      const y = 0.22 + i * 0.33;
      if (y > height - 0.1) break;
      box(g, 0.84, 0.24, 0.05, 0, y, 0.52, materials.metal);
      for (let j = 0; j < 5; j++)
        box(
          g,
          0.048,
          0.013,
          0.015,
          -0.27 + j * 0.08,
          y + 0.04,
          0.555,
          j < 2 ? materials.green : materials.black,
        );
      box(g, 0.54, 0.035, 0.02, -0.08, y - 0.05, 0.558, materials.black);
      box(
        g,
        0.05,
        0.06,
        0.025,
        0.33,
        y,
        0.56,
        i % 3 === 0 ? materials.amber : materials.green,
      );
    }
    [-0.53, 0.53].forEach((sx) =>
      box(
        g,
        0.025,
        height - 0.18,
        0.025,
        sx,
        height / 2,
        0.53,
        materials.silver,
      ),
    );
    box(g, 0.6, 0.025, 0.45, 0, height + 0.018, 0, materials.metal);
    parent.add(g);
    return g;
  }
  function lightFrame(parent, width, height, depth, colorMaterial) {
    for (const x of [-width / 2, width / 2])
      for (const z of [-depth / 2, depth / 2])
        box(parent, 0.035, height, 0.035, x, height / 2, z, colorMaterial);
    for (const y of [0.05, height]) {
      for (const z of [-depth / 2, depth / 2])
        box(parent, width, 0.03, 0.03, 0, y, z, colorMaterial);
      for (const x of [-width / 2, width / 2])
        box(parent, 0.03, 0.03, depth, x, y, 0, colorMaterial);
    }
  }

  // A common raised deck and an open front apron keep every branch visible from the default camera.
  box(root, 34, 0.45, 19.3, 0, -0.2, 0, materials.black, true);
  box(root, 33.8, 0.12, 19.1, 0, 0.08, 0, materials.floor);
  box(root, 33.8, 0.48, 13.65, 0, 0.34, -2.66, materials.black);
  box(root, 33.75, 0.08, 13.6, 0, 0.62, -2.66, materials.floor);
  for (let x = -16; x < 17; x += 1.6)
    box(root, 0.012, 0.003, 13.5, x, 0.663, -2.66, materials.dark);
  for (let z = -8.8; z < 4.3; z += 1.6)
    box(root, 33.6, 0.003, 0.012, 0, 0.664, z, materials.dark);
  for (let x = -15; x < 17; x += 3.2)
    box(root, 2.4, 0.028, 0.035, x, 0.5, 4.2, materials.white);
  for (let i = 0; i < 5; i++)
    box(
      root,
      2.5,
      0.12,
      0.35,
      -11.9,
      0.15 + i * 0.11,
      5.92 - i * 0.34,
      materials.metal,
    );
  for (const x of [-13.3, -10.5]) {
    rail(root, [x, 1, 6.1], [x, 1.65, 4.35]);
    [4.4, 6.05].forEach((z) =>
      rail(root, [x, 0.2, z], [x, z < 5 ? 1.65 : 1, z]),
    );
  }
  panel(root, 33.7, 3.3, 0, 0.67, -9.22);
  [-16.83, 16.83].forEach((x) =>
    panel(root, 13.4, 3.3, x, 0.67, -2.5, Math.PI / 2),
  );
  for (let x = -15.9; x < 17; x += 4.8)
    box(root, 0.07, 3.8, 0.12, x, 2.45, -9.15, materials.silver);
  box(root, 33.7, 0.075, 0.12, 0, 4.32, -9.15, materials.metal);
  box(root, 33.2, 0.03, 0.03, 0, 4.25, -9.05, materials.white);

  for (const station of stations) {
    const group = new THREE.Group();
    group.position.set(
      station.x,
      station.id === "audit" ? 0.15 : 0.67,
      station.z,
    );
    group.userData.station = station.id;
    root.add(group);
    zoneGroups.set(station.id, group);
    const color =
      station.id === "isolate" || station.id === "malware"
        ? RED
        : station.id === "review"
          ? AMBER
          : GREEN;
    const trim = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      toneMapped: false,
    });
    const width =
      station.id === "audit" ? 7.6 : station.id === "decision" ? 2.1 : 4.5;
    const depth =
      station.id === "audit"
        ? 2.9
        : station.id === "decision"
          ? 2.1
          : station.id === "isolate"
            ? 6.2
            : 3.5;
    box(group, width, 0.02, depth, 0, 0.018, 0, materials.dark);
    [-depth / 2, depth / 2].forEach((z) =>
      box(group, width, 0.022, 0.034, 0, 0.038, z, trim),
    );
    [-width / 2, width / 2].forEach((x) =>
      box(group, 0.034, 0.022, depth, x, 0.038, 0, trim),
    );
    activeLights.set(station.id, trim);
    const hit = box(
      group,
      width,
      3.3,
      depth,
      0,
      1.7,
      0,
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.userData.station = station.id;
    pickTargets.push(hit);
    if (["detect", "orchestrate", "investigate"].includes(station.id)) {
      panel(group, 4.75, 3.15, 0, 0, -3.05);
      panel(group, 6.6, 3.15, -2.4, 0, 0.22, Math.PI / 2);
      box(group, 4.2, 0.06, 0.16, 0, 2.9, -2.6, materials.black);
      box(group, 3.7, 0.025, 0.1, 0, 2.85, -2.6, materials.white);
    }
  }
  desk(zoneGroups.get("detect"), 0, -0.35, textures.endpoint);
  rack(zoneGroups.get("detect"), -1.48, -2.08, 1.5);
  const orchestration = zoneGroups.get("orchestrate");
  rack(orchestration, -1.15, -0.8);
  rack(orchestration, 0.1, -0.8);
  rack(orchestration, 1.2, -2, 2.3);
  display(orchestration, 0.48, 1.5, 0.65, 1.2, textures.n8n);
  box(orchestration, 1.8, 0.12, 0.74, 0.5, 0.85, 0.65, materials.silver);
  [-0.25, 1.25].forEach((x) =>
    box(orchestration, 0.09, 0.8, 0.55, x, 0.43, 0.65, materials.black),
  );
  keyboard(orchestration, 0.48, 0.94, 0.86, 0.8);

  const investigation = zoneGroups.get("investigate");
  box(investigation, 2.95, 0.3, 2.75, 0, 0.2, -0.1, materials.black, true);
  box(investigation, 2.72, 0.08, 2.5, 0, 0.41, -0.1, materials.silver);
  panel(investigation, 2.6, 2.6, 0, 0.45, -1.36);
  panel(investigation, 2.5, 2.6, -1.32, 0.45, -0.1, Math.PI / 2);
  panel(investigation, 2.5, 2.6, 1.32, 0.45, -0.1, Math.PI / 2);
  box(investigation, 2.88, 0.13, 2.76, 0, 3.12, -0.1, materials.metal, true);
  box(investigation, 2.3, 0.025, 2.17, 0, 3.04, -0.1, materials.white);
  for (const x of [-1.32, 1.32])
    box(investigation, 0.045, 2.4, 0.045, x, 1.72, 1.12, materials.green);
  documentGroup.position.set(0, 1.35, -0.08);
  box(documentGroup, 0.95, 1.28, 0.055, 0, 0, 0, materials.paper, true);
  for (let i = 0; i < 6; i++)
    box(
      documentGroup,
      i === 0 ? 0.43 : 0.67,
      0.022,
      0.015,
      i === 0 ? -0.12 : 0,
      0.32 - i * 0.115,
      0.042,
      materials.green,
    );
  const docEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03, 1.36, 0.12)),
    new THREE.LineBasicMaterial({ color: GREEN }),
  );
  documentGroup.add(docEdges);
  investigation.add(documentGroup);
  const scanMaterial = new THREE.MeshBasicMaterial({
    color: GREEN,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const scanPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.43, 2.2),
    scanMaterial,
  );
  scanPlane.rotation.x = -Math.PI / 2;
  scanGroup.add(scanPlane);
  box(scanGroup, 2.44, 0.015, 0.018, 0, 0.01, 1.1, materials.green);
  investigation.add(scanGroup);
  display(investigation, 1.68, 1, 0.9, 0.8, textures.evidence);

  const decision = zoneGroups.get("decision");
  box(decision, 1.65, 0.18, 1.65, 0, 0.13, 0, materials.silver, true);
  box(decision, 1.5, 0.07, 1.5, 0, 0.28, 0, materials.black);
  const routeIcon = new THREE.Group();
  routeIcon.position.set(0, 0.34, 0);
  [
    [
      [-0.47, 0, 0],
      [0, 0, 0],
    ],
    [
      [0, 0, 0],
      [0.4, 0, -0.43],
    ],
    [
      [0, 0, 0],
      [0.4, 0, 0.43],
    ],
  ].forEach(([a, b]) => rail(routeIcon, a, b, materials.green, 0.035));
  decision.add(routeIcon);

  for (const id of ["benign", "review", "malware"]) {
    const group = zoneGroups.get(id);
    panel(group, 4.65, 2.7, 0, 0, -1.88);
    panel(group, 3.7, 2.7, -2.36, 0, -0.03, Math.PI / 2);
    panel(group, 3.7, 2.7, 2.36, 0, -0.03, Math.PI / 2);
    if (id !== "malware")
      desk(
        group,
        0,
        -0.45,
        id === "review" ? textures.review : textures.benign,
        true,
      );
  }
  const quarantine = zoneGroups.get("malware");
  box(quarantine, 3.2, 1.8, 1.75, 0, 1.04, -0.35, materials.black, true);
  for (let i = 0; i < 3; i++) {
    const x = -0.98 + i * 0.98;
    box(quarantine, 0.88, 1.44, 0.035, x, 1.04, 0.55, materials.dark);
    box(quarantine, 0.86, 0.04, 0.07, x, 1.7, 0.59, materials.red);
    box(quarantine, 0.038, 1.42, 0.05, x - 0.43, 1.04, 0.6, materials.red);
    box(quarantine, 0.04, 0.28, 0.045, x + 0.25, 1.02, 0.61, materials.silver);
    for (let j = 0; j < 5; j++)
      box(
        quarantine,
        0.55,
        0.025,
        0.028,
        x,
        0.52 + j * 0.065,
        0.6,
        materials.black,
      );
  }
  const isolation = zoneGroups.get("isolate");
  panel(isolation, 4.7, 3.7, 0, 0, -3.28);
  panel(isolation, 6.5, 3.7, -2.4, 0, -0.03, Math.PI / 2);
  panel(isolation, 6.5, 3.7, 2.4, 0, -0.03, Math.PI / 2);
  lightFrame(isolation, 4.58, 3.5, 6.25, materials.red);
  desk(isolation, 0, -0.5, textures.isolate);
  rack(isolation, -1.42, -2.08, 2.1);
  rack(isolation, 1.3, -2.05, 2.1);
  const isolationShutter = box(
    isolation,
    4.48,
    2.95,
    0.035,
    0,
    1.65,
    3.05,
    new THREE.MeshBasicMaterial({
      color: RED,
      transparent: true,
      opacity: 0.025,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  for (let i = 0; i < 10; i++)
    box(
      isolation,
      0.035,
      0.2,
      0.035,
      -2.24,
      0.5 + i * 0.24,
      3.08,
      materials.red,
    );
  const audit = zoneGroups.get("audit");
  desk(audit, -1.78, -0.18, textures.audit, true);
  desk(audit, 1.78, -0.18, textures.evidence, true);
  rack(root, 13.2, 7.9, 1.28);
  rack(root, 14.5, 7.9, 1.28);
  rack(root, 15.8, 7.9, 1.28);
  for (let x = -15.2; x < -5; x += 2.2)
    box(root, 1.7, 0.06, 1.7, x, 0.22, 8.2, materials.dark);

  function addPath(from, to, points, color = GREEN) {
    const curve = new THREE.CurvePath();
    for (let i = 0; i < points.length - 1; i++)
      curve.add(
        new THREE.LineCurve3(
          new THREE.Vector3(...points[i]),
          new THREE.Vector3(...points[i + 1]),
        ),
      );
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.25,
      toneMapped: false,
    });
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        Math.max(12, points.length * 10),
        0.034,
        5,
        false,
      ),
      mat,
    );
    root.add(tube);
    const packet = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    );
    root.add(packet);
    packet.visible = false;
    pulseMeshes.push(packet);
    const glow = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        Math.max(12, points.length * 10),
        0.105,
        5,
        false,
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.035,
        depthWrite: false,
      }),
    );
    root.add(glow);
    paths.push({ from, to, curve, mat, packet, glow, active: false });
  }
  const y = 0.735;
  addPath("detect", "orchestrate", [
    [-10.5, y, 0.65],
    [-9.25, y, 0.65],
    [-9.25, y, 1.65],
    [-7.1, y, 1.65],
  ]);
  addPath("orchestrate", "investigate", [
    [-5.5, y, 1.65],
    [-3.5, y, 1.65],
    [-3.5, y, 0.4],
    [-2.7, y, 0.4],
  ]);
  addPath("investigate", "decision", [
    [-0.1, y, 0.4],
    [1.15, y, 0.4],
    [1.15, y, -1.1],
    [2.5, y, -1.1],
  ]);
  addPath("decision", "benign", [
    [3.8, y, -1.1],
    [4.5, y, -1.1],
    [4.5, y, -5.8],
    [5.6, y, -5.8],
  ]);
  addPath(
    "decision",
    "review",
    [
      [4.05, y, -0.9],
      [5.6, y, -0.9],
    ],
    AMBER,
  );
  addPath(
    "decision",
    "malware",
    [
      [3.8, y, -0.65],
      [4.5, y, -0.65],
      [4.5, y, 3.8],
      [5.6, y, 3.8],
    ],
    RED,
  );
  addPath(
    "review",
    "malware",
    [
      [9.9, y, -0.7],
      [10.1, y, -0.7],
      [10.1, y, 3.8],
      [9.4, y, 3.8],
    ],
    AMBER,
  );
  addPath(
    "orchestrate",
    "isolate",
    [
      [-6.8, 3.8, -4.15],
      [-6.8, 4.65, -8.85],
      [13.1, 4.65, -8.85],
      [13.1, 3.4, -7.65],
    ],
    RED,
  );
  addPath(
    "isolate",
    "investigate",
    [
      [10.65, y, -7.2],
      [1.7, y, -7.2],
      [1.7, y, -3.3],
      [-1.5, y, -3.3],
    ],
    AMBER,
  );
  addPath("benign", "audit", [
    [5.05, y, -5.8],
    [4.75, y, -5.8],
    [4.75, y, 5.4],
    [4.75, 0.22, 6.5],
    [2.5, 0.22, 6.5],
  ]);
  addPath(
    "review",
    "audit",
    [
      [9.75, y, -0.7],
      [10.45, y, -0.7],
      [10.45, y, 5.6],
      [10.45, 0.22, 6.8],
      [2.8, 0.22, 6.8],
    ],
    AMBER,
  );
  addPath("malware", "audit", [
    [7.4, y, 5.5],
    [7.4, 0.22, 7.2],
    [2.8, 0.22, 7.2],
  ]);
  addPath(
    "orchestrate",
    "audit",
    [
      [-6.8, y, 2],
      [-6.8, y, 4.5],
      [-6.8, 0.22, 6.7],
      [-2.8, 0.22, 6.7],
    ],
    AMBER,
  );

  // Static furniture shares draw calls; interactive geometry and animated parts remain independent.
  root.updateMatrixWorld(true);
  const dynamic = new Set([
    documentGroup,
    scanGroup,
    isolationShutter,
    ...pulseMeshes,
  ]);
  const batches = new Map();
  root.traverse((object) => {
    if (
      !object.isMesh ||
      object.isInstancedMesh ||
      object.userData.station ||
      Array.isArray(object.material)
    )
      return;
    for (
      let ancestor = object;
      ancestor && ancestor !== root;
      ancestor = ancestor.parent
    )
      if (dynamic.has(ancestor)) return;
    if (!batches.has(object.material)) batches.set(object.material, []);
    batches.get(object.material).push(object);
  });
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const pieces = meshes.map((mesh) => {
      const geometry = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      return geometry;
    });
    const geometry = mergeGeometries(pieces);
    pieces.forEach((piece) => piece.dispose());
    if (!geometry) continue;
    const combined = new THREE.Mesh(geometry, material);
    combined.castShadow =
      material !== materials.glass && !material.isMeshBasicMaterial;
    combined.receiveShadow = !material.isMeshBasicMaterial;
    meshes.forEach((mesh) => mesh.removeFromParent());
    root.add(combined);
  }

  let activeNode = "detect";
  let hovered = null;
  let selected = null;
  let snapshot = null;
  function setState(state, selectedNode = null) {
    snapshot = state;
    activeNode = state.node;
    selected = selectedNode;
    const nodes = state.events.map((event) => event.node);
    const previousNode = nodes
      .slice(0, -1)
      .reverse()
      .find((node) => node !== activeNode);
    const visited = new Set(
      nodes.slice(1).map((node, i) => `${nodes[i]}:${node}`),
    );
    for (const path of paths) {
      const active = path.to === activeNode && path.from === previousNode;
      path.active = active;
      path.mat.opacity = active
        ? 1
        : visited.has(`${path.from}:${path.to}`)
          ? 0.52
          : 0.2;
      path.glow.material.opacity = active ? 0.1 : 0.018;
      path.packet.visible = active && !state.complete;
    }
    const isolated =
      state.scenario === "ransomware" && state.online && state.index >= 2;
    isolationShutter.material.opacity = isolated ? 0.14 : 0.015;
    isolationScreens.forEach((material) => {
      material.map = isolated ? textures.isolate : textures.standby;
    });
  }
  function update(time) {
    for (const [id, mat] of activeLights)
      mat.opacity =
        id === hovered || id === selected
          ? 0.95
          : id === activeNode
            ? 0.65 + Math.sin(time * 2) * 0.12
            : 0.15;
    scanGroup.position.y = 1.7 + Math.sin(time * 1.5) * 0.98;
    documentGroup.rotation.y = Math.sin(time * 0.45) * 0.17;
    scanGroup.visible =
      !snapshot || activeNode === "investigate" || selected === "investigate";
    for (const path of paths)
      if (path.packet.visible)
        path.packet.position.copy(path.curve.getPoint((time * 0.23) % 1));
  }
  return {
    root,
    pickTargets,
    zoneGroups,
    setState,
    update,
    setHover(id) {
      hovered = id;
    },
    labelPosition(id) {
      const s = stations.find((s) => s.id === id);
      return new THREE.Vector3(
        s.x,
        id === "audit" ? 2.85 : id === "decision" ? 1.5 : 4.1,
        s.z - (id === "isolate" ? 0.6 : 0.1),
      );
    },
    dispose() {
      const geometries = new Set(),
        mats = new Set();
      root.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material)
          (Array.isArray(object.material)
            ? object.material
            : [object.material]
          ).forEach((mat) => mats.add(mat));
      });
      geometryCache.forEach((geometry) => geometries.add(geometry));
      geometries.forEach((geometry) => geometry.dispose());
      mats.forEach((material) => material.dispose());
      screenTextures.forEach((texture) => texture.dispose());
    },
  };
}
