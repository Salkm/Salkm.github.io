import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const X = new THREE.Vector3(1, 0, 0);
const v = () => new THREE.Vector3();
const q = () => new THREE.Quaternion();

function colored(geometry, color) {
  const c = new THREE.Color(color);
  const values = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < values.length; i += 3) c.toArray(values, i);
  geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
  return geometry;
}

function merged(parts) {
  const result = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return result;
}

function tube(points, radius, color, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
  return colored(new THREE.TubeGeometry(curve, closed ? 40 : 20, radius, 6, closed), color);
}

function makeGlasses() {
  const parts = [];
  for (const sign of [-1, 1]) {
    const ring = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const cx = Math.cos(a), sy = Math.sin(a);
      ring.push([
        sign * 0.037 + Math.sign(cx) * Math.abs(cx) ** 0.72 * 0.029,
        1.699 + Math.sign(sy) * Math.abs(sy) ** 0.78 * 0.021,
        0.096 - Math.abs(cx) * 0.004,
      ]);
    }
    parts.push(tube(ring, 0.0035, 0x111714, true));
    const lens = colored(new THREE.SphereGeometry(1, 24, 12), 0x101c17);
    lens.scale(0.026, 0.018, 0.0022);
    lens.translate(sign * 0.037, 1.699, 0.094);
    parts.push(lens);
    parts.push(tube([[sign * 0.067, 1.71, 0.092], [sign * 0.081, 1.707, 0.051], [sign * 0.084, 1.698, -0.009]], 0.0025, 0x101612));
    const hinge = colored(new THREE.BoxGeometry(0.007, 0.003, 0.002), 0x89958e);
    hinge.translate(sign * 0.065, 1.711, 0.096);
    parts.push(hinge);
  }
  parts.push(tube([[-0.009, 1.707, 0.096], [0, 1.711, 0.108], [0.009, 1.707, 0.096]], 0.0027, 0x141a16));
  const scalp = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const scalpPosition = scalp.attributes.position;
  for (let i = 0; i < scalpPosition.count; i++) {
    const px = scalpPosition.getX(i), pz = scalpPosition.getZ(i);
    const phi = Math.atan2(pz, px);
    const theta = Math.acos(THREE.MathUtils.clamp(scalpPosition.getY(i), -1, 1));
    const front = Math.max(0, Math.sin(phi));
    const angle = theta / (Math.PI / 2) * (1.48 - front * 0.51 + Math.sin(phi * 13) * 0.016);
    const x = Math.sin(angle) * Math.cos(phi) * 0.087;
    const z = -0.01 + Math.sin(angle) * Math.sin(phi) * 0.096;
    const part = Math.exp(-(((x - 0.029) / 0.004) ** 2));
    const strand = Math.sin(phi * 37 + angle * 8) * 0.0009 * Math.sin(angle);
    const y = 1.704 + Math.cos(angle) * 0.108 + Math.max(0, -x) * 0.11 - part * 0.005 + strand;
    scalpPosition.setXYZ(i, x, y, z);
  }
  scalp.computeVertexNormals();
  parts.push(colored(scalp, 0x101713));
  for (let i = 0; i < 8; i++) {
    const x = -0.065 + i * 0.0105;
    parts.push(tube([[x, 1.777 + i * 0.001, 0.06], [x + 0.011, 1.810, 0.028], [x + 0.026, 1.806, -0.025]], 0.0010, i % 3 ? 0x1b251d : 0x27332a));
  }
  return merged(parts);
}

function makeLaptop() {
  const parts = [];
  const box = (size, position, color, angle = 0) => {
    const g = colored(new THREE.BoxGeometry(...size), color);
    g.rotateX(angle);
    g.translate(...position);
    parts.push(g);
  };
  box([0.68, 0.021, 0.43], [0, 1.105, 0.421], 0x3b4641);
  box([0.658, 0.005, 0.41], [0, 1.118, 0.421], 0x202923);
  box([0.22, 0.002, 0.083], [0, 1.122, 0.27], 0x47534b);
  box([0.216, 0.002, 0.079], [0, 1.123, 0.27], 0x29332d);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 14; col++) {
      const px = -0.29 + col * 0.0445;
      const pz = 0.363 + row * 0.043;
      box([0.036, 0.008, 0.033], [px, 1.127, pz], 0x0d1510);
      box([0.009, 0.001, 0.0018], [px - 0.007, 1.132, pz + 0.005], 0x839b8b);
    }
  }
  box([0.228, 0.008, 0.029], [0, 1.127, 0.319], 0x131d16);
  const lid = new THREE.Group();
  const lidParts = [];
  const lidBox = (size, position, color) => {
    const geometry = colored(new THREE.BoxGeometry(...size), color);
    geometry.translate(...position);
    lidParts.push(geometry);
  };
  lidBox([0.68, 0.405, 0.016], [0, 0.2025, 0], 0x26342b);
  lidBox([0.636, 0.36, 0.002], [0, 0.203, -0.009], 0x020806);
  for (let line = 0; line < 15; line++) {
    const length = 0.075 + ((line * 17) % 9) * 0.041;
    lidBox([length, 0.004, 0.001], [-0.28 + length / 2, 0.352 - line * 0.018, -0.011], line % 3 ? 0x297c47 : 0x68ce88);
  }
  lidBox([0.026, 0.0025, 0.001], [-0.266, 0.065, -0.011], 0x8fffb5);
  // A small geometric terminal mark on the actual metal lid, not an image plane.
  lidBox([0.037, 0.006, 0.002], [-0.017, 0.20, 0.009], 0x5be894);
  lidBox([0.006, 0.032, 0.002], [-0.033, 0.215, 0.009], 0x5be894);
  lidBox([0.024, 0.005, 0.002], [0.025, 0.20, 0.009], 0x5be894);
  const lidGeometry = merged(lidParts);
  lid.rotation.x = 0.55;
  lid.position.set(0, 1.118, 0.622);
  lid.updateMatrix();
  lidGeometry.applyMatrix4(lid.matrix);
  parts.push(lidGeometry);
  const geometry = merged(parts);
  geometry.translate(0, -1.11, -0.42);
  geometry.scale(0.82, 0.82, 0.82);
  geometry.translate(0, 1.11, 0.42);
  return geometry;
}

/** The GLB's own weighted geometry is retained; no photographs enter the renderer. */
export async function createTypingCharacter() {
  const gltf = await new GLTFLoader().loadAsync("/character-runtime.glb");
  const root = gltf.scene;
  root.name = "TypingHuman";
  root.updateMatrixWorld(true);
  const bones = new Map();
  const meshes = [];
  const sourceMaterials = new Set(), sourceTextures = new Set();
  root.traverse((object) => {
    if (object.isBone) bones.set(object.name, object);
    if (object.isMesh) {
      meshes.push(object);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        sourceMaterials.add(material);
        Object.values(material).forEach((value) => { if (value?.isTexture) sourceTextures.add(value); });
      }
    }
  });
  const body = meshes.find((mesh) => /SuperHero/i.test(mesh.name));
  const head = bones.get("Head");
  if (!body?.isSkinnedMesh || !head || !bones.has("index_03_l")) {
    sourceMaterials.forEach((m) => m.dispose());
    sourceTextures.forEach((t) => t.dispose());
    meshes.forEach((m) => m.geometry.dispose());
    throw new Error("The character asset must include the complete Quaternius humanoid and finger rig.");
  }
  const skin = new THREE.Color(0x919a91);
  const fabric = new THREE.Color(0x161c18);
  const hair = new THREE.Color(0x111713);
  const beard = new THREE.Color(0x222a25);
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i), py = position.getY(i), pz = position.getZ(i);
      let color = fabric.clone();
      if (mesh === body) {
        const wrist = Math.abs(px) > 0.699 && py > 1.35;
        const headSkin = THREE.MathUtils.smoothstep(py, 1.552, 1.579);
        const neckSkin = THREE.MathUtils.smoothstep(py, 1.526, 1.55) * (1 - THREE.MathUtils.smoothstep(Math.abs(px), 0.048, 0.066));
        color.lerp(skin, wrist ? 1 : Math.max(headSkin, neckSkin));
        const front = THREE.MathUtils.smoothstep(pz, 0.003, 0.085);
        const hairline = 1.712 + front * (0.05 + 0.008 * Math.sin(px * 26));
        const hairMask = THREE.MathUtils.smoothstep(py, hairline - 0.004, hairline + 0.004);
        const jaw = THREE.MathUtils.smoothstep(py, 1.58, 1.604) * (1 - THREE.MathUtils.smoothstep(py, 1.65, 1.68)) * THREE.MathUtils.smoothstep(pz, 0.004, 0.025);
        const moustache = py > 1.662 && py < 1.679 && Math.abs(px) < 0.039 && pz > 0.075;
        const mouth = py > 1.647 && py < 1.662 && Math.abs(px) < 0.027 && pz > 0.088;
        const sideburn = Math.abs(px) > 0.068 && py > 1.65 && py < 1.725 && pz > -0.022;
        const beardMask = Math.max(mouth ? 0 : jaw, moustache ? 0.86 : 0, sideburn ? 0.78 : 0);
        if (beardMask > 0) {
          const salt = Math.max(0, Math.sin(px * 443 + py * 321 + pz * 633));
          const beardColor = beard.clone().lerp(new THREE.Color(0x69746b), salt * 0.26);
          color.lerp(beardColor, beardMask);
          const thickness = (moustache ? 0.002 : 0.006) * beardMask;
          position.setXYZ(i, px + normal.getX(i) * thickness, py + normal.getY(i) * thickness, pz + normal.getZ(i) * thickness);
        }
        if (hairMask > 0) {
          color.lerp(hair, hairMask);
          const part = Math.exp(-(((px - 0.031) / 0.006) ** 2)) * front;
          const lift = (0.005 + 0.004 * Math.max(0, -px / 0.08)) * hairMask * (1 - part * 0.85);
          position.setXYZ(i, px + normal.getX(i) * lift, py + normal.getY(i) * lift, pz + normal.getZ(i) * lift);
          color.multiplyScalar(1 + 0.13 * Math.sin(px * 350 + py * 90));
        }
      } else if (/Eyes/.test(mesh.name)) color.set(0x909a8d);
      else color.copy(hair);
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    position.needsUpdate = true;
    if (mesh === body) geometry.computeVertexNormals();
    mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: mesh === body ? 0.88 : 0.49, metalness: 0.04 });
    mesh.frustumCulled = false;
  }
  sourceMaterials.forEach((m) => m.dispose());
  sourceTextures.forEach((t) => t.dispose());

  const attachment = new THREE.Group();
  attachment.name = "HeadAttachedGlasses";
  head.add(attachment);
  head.matrixWorld.clone().invert().decompose(attachment.position, attachment.quaternion, attachment.scale);
  const glasses = new THREE.Mesh(makeGlasses(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.08 }));
  glasses.name = "BlackWayfarerGlasses";
  attachment.add(glasses);
  meshes.push(glasses);
  const laptop = new THREE.Mesh(makeLaptop(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.32 }));
  laptop.name = "LaptopAndKeyboard";
  root.add(laptop);
  meshes.push(laptop);

  const rest = new Map([...bones].map(([name, bone]) => [name, bone.quaternion.clone()]));
  const setWorldQuaternion = (bone, quaternion) => {
    bone.parent.getWorldQuaternion(parentQ).invert();
    bone.quaternion.copy(parentQ).multiply(quaternion);
    bone.updateWorldMatrix(false, true);
  };
  const parentQ = q(), currentQ = q(), deltaQ = q();
  const origin = v(), direction = v(), currentDirection = v();
  function aim(bone, child, target) {
    bone.getWorldPosition(origin);
    child.getWorldPosition(currentDirection).sub(origin).normalize();
    direction.copy(target).sub(origin).normalize();
    deltaQ.setFromUnitVectors(currentDirection, direction);
    bone.getWorldQuaternion(currentQ).premultiply(deltaQ);
    setWorldQuaternion(bone, currentQ);
  }
  function offset(name, x, y = 0, z = 0) {
    const bone = bones.get(name);
    bone.quaternion.copy(rest.get(name)).multiply(deltaQ.setFromEuler(new THREE.Euler(x, y, z)));
  }
  offset("spine_01", 0.065);
  offset("spine_02", 0.035);
  offset("Head", 0.055);
  root.updateMatrixWorld(true);
  for (const side of ["l", "r"]) {
    const sign = side === "l" ? 1 : -1;
    const thigh = bones.get(`thigh_${side}`), calf = bones.get(`calf_${side}`), foot = bones.get(`foot_${side}`);
    const hip = thigh.getWorldPosition(v());
    aim(thigh, calf, hip.clone().add(new THREE.Vector3(sign * 0.035, -0.06, 0.42)));
    aim(calf, foot, calf.getWorldPosition(v()).add(new THREE.Vector3(0, -0.45, 0.015)));
  }
  const armData = ["l", "r"].map((side) => ({
    side, sign: side === "l" ? 1 : -1,
    upper: bones.get(`upperarm_${side}`), lower: bones.get(`lowerarm_${side}`), hand: bones.get(`hand_${side}`),
    shoulder: v(), target: v(), elbow: v(), axis: v(), pole: v(), handQuaternion: q(),
  }));
  const basis = new THREE.Matrix4();
  function poseArms(time) {
    for (const arm of armData) {
      const { sign, upper, lower, hand, shoulder, target, elbow, axis, pole } = arm;
      upper.quaternion.copy(rest.get(upper.name));
      lower.quaternion.copy(rest.get(lower.name));
      hand.quaternion.copy(rest.get(hand.name));
      upper.updateWorldMatrix(true, true);
      upper.getWorldPosition(shoulder);
      target.set(sign * (0.152 + Math.sin(time * 1.31 + sign) * 0.008), 1.164 + Math.sin(time * 4.3 + sign) * 0.0025, 0.245 + Math.cos(time * 1.1 + sign) * 0.007);
      axis.copy(target).sub(shoulder);
      const distance = axis.length();
      axis.normalize();
      const a = lower.position.length(), b = hand.position.length();
      const d = Math.min(distance, a + b - 0.002);
      const along = (a * a - b * b + d * d) / (2 * d);
      const out = Math.sqrt(Math.max(0, a * a - along * along));
      pole.set(sign * 0.42, 1.03, -0.15).sub(shoulder);
      pole.addScaledVector(axis, -pole.dot(axis)).normalize();
      elbow.copy(shoulder).addScaledVector(axis, along).addScaledVector(pole, out);
      aim(upper, lower, elbow);
      aim(lower, hand, target);
      basis.makeBasis(new THREE.Vector3(0, -sign, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-sign, 0, 0));
      arm.handQuaternion.setFromRotationMatrix(basis);
      setWorldQuaternion(hand, arm.handQuaternion);
    }
  }
  poseArms(0);
  const fingers = [];
  for (const side of ["l", "r"]) {
    for (const [digit, name] of ["index", "middle", "ring", "pinky", "thumb"].entries()) {
      for (let joint = 1; joint <= 3; joint++) {
        const bone = bones.get(`${name}_0${joint}_${side}`);
        bone.getWorldQuaternion(currentQ).invert();
        fingers.push({ bone, rest: bone.quaternion.clone(), axis: X.clone().applyQuaternion(currentQ), digit, joint, phase: digit * 1.77 + (side === "l" ? 0 : 2.4) });
      }
    }
  }
  const seated = new Map(["spine_01", "spine_02", "spine_03", "Head", "neck_01"].map((name) => [name, bones.get(name).quaternion.clone()]));
  const rigSpace = new THREE.Matrix4();
  function update(time) {
    // Solve the arms in unscaled character space, independent of the stage's inspection orbit.
    const parent = root.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      rigSpace.copy(parent.matrixWorld).invert();
    }
    root.matrixAutoUpdate = false;
    root.matrix.copy(parent ? rigSpace : new THREE.Matrix4());
    for (const [name, rotation] of seated) bones.get(name).quaternion.copy(rotation);
    bones.get("spine_02").quaternion.multiply(deltaQ.setFromAxisAngle(X, Math.sin(time * 1.45) * 0.006));
    bones.get("Head").quaternion.multiply(deltaQ.setFromEuler(new THREE.Euler(Math.sin(time * 0.69) * 0.015, Math.sin(time * 0.36) * 0.045, Math.sin(time * 0.53) * 0.007)));
    root.updateMatrixWorld(true);
    poseArms(time);
    for (const finger of fingers) {
      const press = Math.max(0, Math.sin(time * (6.7 + finger.digit * 0.43) + finger.phase)) ** 6;
      const base = finger.digit === 4 ? 0.1 : finger.joint === 1 ? 0.10 : 0.24;
      const amount = base + press * (finger.joint === 1 ? 0.17 : 0.21);
      finger.bone.quaternion.copy(finger.rest).multiply(deltaQ.setFromAxisAngle(finger.axis, amount));
    }
    root.matrix.identity();
    root.updateMatrixWorld(true);
  }
  update(0);
  return {
    root, meshes, bones, skeleton: body.skeleton, update,
    diagnostics() {
      root.updateWorldMatrix(true, true);
      const xyz = (name) => bones.get(name).getWorldPosition(v()).toArray();
      return {
        boneCount: bones.size, fingerJoints: fingers.length,
        skinnedMeshes: meshes.filter((m) => m.isSkinnedMesh).length,
        head: xyz("Head"), leftWrist: xyz("hand_l"), rightWrist: xyz("hand_r"),
        leftFingertip: xyz("index_04_leaf_l"), rightFingertip: xyz("index_04_leaf_r"),
        fingerPose: fingers.slice(0, 6).map(({ bone }) => bone.quaternion.toArray()),
      };
    },
  };
}
