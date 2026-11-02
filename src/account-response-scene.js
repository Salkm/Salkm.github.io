import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createEquipmentMaterials } from './lab/equipment-materials.js';
import { createAccountLight, sampleEdges } from './account-hologram-light.js';

const stations = [
  { id: "alert", number: "01", title: "Detect", detail: "Sentinel + Defender XDR risk signal", position: [-11, 0, 0] },
  { id: "recommendation", number: "02", title: "Assess", detail: "AI risk score and response recommendation", position: [-6.5, 0, 0] },
  { id: "decision", number: "03", title: "Review", detail: "Analyst approval control point", position: [-2, 0, 0] },
  { id: "trigger", number: "04", title: "Orchestrate", detail: "Approved n8n playbook", position: [2.5, 0, 0] },
  { id: "sessions", number: "05", title: "Revoke", detail: "Invalidate active sessions", position: [7.2, 0, -4.5] },
  { id: "password", number: "06", title: "Reset", detail: "Force password reset", position: [7.2, 0, 0] },
  { id: "signin", number: "07", title: "Block", detail: "Disable identity sign-in", position: [7.2, 0, 4.5] },
  { id: "ticket", number: "08", title: "Evidence", detail: "Update ServiceDesk Plus", position: [12, 0, 0] },
  { id: "audit", number: "09", title: "Audit", detail: "Close the traceable incident record", position: [0, 0, 6.8] },
];

const routePairs = [
  ["alert", "recommendation"], ["recommendation", "decision"], ["decision", "trigger"],
  ["trigger", "sessions"], ["trigger", "password"], ["trigger", "signin"],
  ["sessions", "ticket"], ["password", "ticket"], ["signin", "ticket"], ["ticket", "audit"],
];

function labelTexture(number, title) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(3,16,23,1)";
  context.strokeStyle = "#29728c";
  context.lineWidth = 2;
  context.beginPath(); context.roundRect(3, 3, 506, 122, 6); context.fill(); context.stroke();
  context.fillStyle = '#124055'; context.fillRect(13, 13, 81, 102);
  context.fillStyle = "#69dfff";
  context.font = "700 48px monospace";
  context.fillText(number, 24, 78);
  context.fillStyle = "#d9f8ff";
  context.font = "600 50px monospace";
  context.fillText(title, 112, 78);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function evidenceTexture(title, lines) {
  const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 520;
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(2,14,22,.66)"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#0b304855'; context.lineWidth = 1;
  for(let x=0;x<1024;x+=40){context.beginPath();context.moveTo(x,0);context.lineTo(x,520);context.stroke();}
  for(let y=0;y<520;y+=40){context.beginPath();context.moveTo(0,y);context.lineTo(1024,y);context.stroke();}
  context.shadowColor = '#29b9ff'; context.shadowBlur = 6;
  context.strokeStyle = "#29a3d3"; context.lineWidth = 3; context.strokeRect(4, 4, 1016, 512);
  context.fillStyle = "#55daf8"; context.font = "600 30px monospace"; context.fillText(title, 40, 65);
  lines.forEach((line, index) => {
    context.fillStyle = index === lines.length - 1 ? "#ffbd68" : "#c7edf5";
    context.font = `${index === lines.length - 1 ? 600 : 400} 27px monospace`;
    context.fillText(line, 40, 135 + index * 58);
    context.fillStyle = index === lines.length - 1 ? "#ff9d37" : "#27c9ec";
    context.fillRect(40, 160 + index * 58, Math.min(870, 260 + line.length * 11), 5);
  });
  const titles=title==='IDENTITY RISK SIGNAL'?['SIGN-IN','IDENTITY','RISK']:title==='AI RECOMMENDATION'?['CONTEXT','ASSESS','REVIEW']:['REVIEW','APPROVE','EXECUTE'];
  context.font='500 23px monospace';context.lineWidth=2;
  titles.forEach((text,index)=>{
    const x=48+index*318;
    context.strokeStyle=index===1?'#e4ac65':'#3595bc';context.strokeRect(x,354,228,86);
    context.fillStyle='#91cee1';context.fillText(text,x+20,405);
    if(index<2){context.beginPath();context.moveTo(x+232,397);context.lineTo(x+303,397);context.lineTo(x+289,388);context.moveTo(x+303,397);context.lineTo(x+289,406);context.stroke();}
  });
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function buildStation(station, equipment) {
  const group = new THREE.Group();
  group.position.set(...station.position);
  group.userData.station = station.id;
  const cyan = new THREE.Color(0x399bdb);
  const responsiveMaterials = [];
  const lineMaterial = (opacity = .45) => new THREE.LineBasicMaterial({ color: cyan, transparent: true, opacity: opacity * .7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const surfaceMaterial = (opacity = .12) => new THREE.MeshBasicMaterial({ color: cyan, transparent: true, opacity, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const wireBox = (w, h, d, x, y, z, opacity = .42) => {
    const source = new THREE.BoxGeometry(w, h, d), geometry = new THREE.EdgesGeometry(source); source.dispose();
    const object = new THREE.LineSegments(geometry, lineMaterial(opacity)); object.position.set(x, y, z); object.userData.station = station.id; group.add(object); return object;
  };
  const panel = (w, h, x, y, z, opacity = .16) => { const object = new THREE.Mesh(new THREE.PlaneGeometry(w, h), surfaceMaterial(opacity)); object.position.set(x, y, z); object.userData.station = station.id; group.add(object); return object; };
  const solid = (w,h,d,x,y,z,material=equipment.body) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);group.add(mesh);return mesh;
  };
  const display = (w,h,x,y,z) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w,h),equipment.screen('identity'));
    mesh.position.set(x,y,z);group.add(mesh);
  };
  const desk = (dual = false) => {
    wireBox(dual ? 2.35 : 1.8, .12, 1, 0, .72, 0, .6);
    solid(dual?2.35:1.8,.12,1,0,.72,0);
    for(const x of [-.72,.72]){wireBox(.12,.66,.60,x,.36,0,.32);solid(.12,.66,.60,x,.36,0);}
    for (const x of dual ? [-.55, .55] : [0]) {
      solid(.85,.58,.08,x,1.28,-.30);wireBox(.85, .58, .08, x, 1.28, -.30, .72);
      display(.74,.46,x,1.28,-.252);solid(.08,.23,.08,x,.93,-.3);
    }
    wireBox(.72, .06, .28, 0, .82, .24, .32);
    solid(.55,.12,.5,0,.4,.95);wireBox(.55,.65,.12,0,.72,1.15,.32);
    solid(.55,.65,.12,0,.72,1.15);solid(.1,.36,.1,0,.2,.95);
  };
  const rack = (x) => {
    solid(.88,2.1,.74,x,1.08,0);wireBox(.88, 2.1, .74, x, 1.08, 0, .58);
    for (let y=.35; y<1.95; y+=.27) {
      solid(.70,.18,.03,x,y,.39,equipment.recess);wireBox(.70,.18,.03,x,y,.39,.28);
      solid(.065,.035,.025,x-.23,y,.42,equipment.leds);
      solid(.19,.016,.025,x+.13,y,.42,equipment.leds);
    }
  };
  const pod = (symbol = "◆") => {
    solid(1.72,2.15,1.5,0,1.08,0);wireBox(1.72, 2.15, 1.5, 0, 1.08, 0, .72);
    display(1.42,.9,0,1.42,.76);wireBox(1.42, 1.6, .06, 0, 1.12, .78, .34);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture("", symbol), transparent: true, depthWrite: false, toneMapped: false }));
    label.scale.set(1.5, .38, 1); label.position.set(0, .65, .84); group.add(label);
  };
  if (station.id === "alert") { desk(true); rack(-1.25); }
  else if (station.id === "recommendation") { rack(-.72); rack(.32); rack(1.36); }
  else if (station.id === "decision") { desk(true); wireBox(2.65, 2.55, 1.9, 0, 1.28, 0, .24); }
  else if (station.id === "trigger") { rack(-.55); rack(.55); }
  else if (station.id === "sessions") pod("SESSIONS");
  else if (station.id === "password") pod("RESET");
  else if (station.id === "signin") pod("BLOCK");
  else if (station.id === "ticket") { desk(true); display(2.4, 1.45, 0, 2.5, -.45); wireBox(2.6, 1.65, .08, 0, 2.5, -.49, .55); }
  else { desk(true); rack(-1.6); rack(1.6); }
  if(station.id==='audit')group.children.forEach(child=>{child.position.multiplyScalar(.68);child.scale.multiplyScalar(.68);});
  const baseMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const deckWidth = station.id === 'audit' ? 4.5 : 3.5;
  const isAction=['sessions','password','signin'].includes(station.id);
  const baseHeight=station.id==='audit'?1.5:isAction?2.15:2.25;
  const base = new THREE.Mesh(new THREE.BoxGeometry(isAction?1.72:deckWidth, baseHeight, isAction?1.5:2.8), baseMaterial);
  base.position.y = baseHeight/2+.05; base.userData.station = station.id; group.add(base);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(deckWidth, .10, 2.8), new THREE.MeshBasicMaterial({ color: 0x062f48, transparent: true, opacity: .22, toneMapped: false, depthWrite:false }));
  deck.position.y = .05; deck.userData.station = station.id; group.add(deck);
  const boundary = wireBox(deckWidth,.1,2.8,0,.05,0,.65);responsiveMaterials.push(boundary.material);
  const enclosureHeight=station.id==='audit'?1.65:2.65;
  wireBox(deckWidth,enclosureHeight,2.8,0,enclosureHeight/2+.05,0,.18);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .78), surfaceMaterial(.04));
  screen.position.set(0, 1.28, -.56); screen.rotation.x = -.22; screen.userData.station = station.id; group.add(screen);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(station.number, station.title), transparent: true, depthWrite: false, toneMapped: false }));
  label.material.color.setRGB(.58,.64,.67);
  label.scale.set(4.05, 1.01, 1); label.position.set(0, station.id==='audit'?2:station.id==='ticket'?3.7:3, 0); group.add(label);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: cyan, transparent: true, opacity: .28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  responsiveMaterials.push(ringMaterial);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.32, 40), ringMaterial);
  ring.rotation.x = -Math.PI / 2; ring.position.y = .12; group.add(ring);
  return { station, group, base, deck, screen, ring, label, responsiveMaterials, deckWidth, phase: "locked" };
}

export function createAccountResponseScene({ canvas, onSelect }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000307);
  const clock = { value: 0 };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const equipment = createEquipmentMaterials(clock);
  const camera = new THREE.OrthographicCamera(-18, 18, 10, -10, .1, 160);
  const home = new THREE.Vector3(7, 15, 43);
  camera.position.copy(home);
  const target = new THREE.Vector3(.4, .5, 0);
  camera.lookAt(target);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target); controls.enableDamping = !motion.matches; controls.enablePan = false;
  controls.minZoom = .72; controls.maxZoom = 2.4; controls.rotateSpeed = .42; controls.zoomSpeed = .65;
  controls.minPolarAngle = .55; controls.maxPolarAngle = 1.37;
  canvas.style.touchAction = "pan-y";

  const architecture = new THREE.Group(); scene.add(architecture);
  const gridPositions = [];
  for(let x=-15;x<=15;x++)gridPositions.push(x,-.1,-8,x,-.1,8);
  for(let z=-8;z<=8;z++)gridPositions.push(-15,-.1,z,15,-.1,z);
  const gridGeometry = new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(gridPositions,3));
  const grid=new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({color:0x2285ca,transparent:true,opacity:.09,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
  grid.userData.noDots=true;architecture.add(grid);
  const blockMaterial = new THREE.LineBasicMaterial({color:0x2372bb,transparent:true,opacity:.075,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  for(const [x,y,z,w,h,d] of [[-11,1.7,-4.5,3,3.4,2.8],[-6,2.6,-5,4,5.2,3],[-.8,1.9,-4.5,3.8,3.8,3],[4,2.2,-5.5,2.7,4.4,3],[11,1.4,-4.8,3,2.8,2.5]]){
    const geometry=new THREE.BoxGeometry(w,h,d);
    const block=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),blockMaterial);
    block.position.set(x,y,z);architecture.add(block);
    const face=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x075184,transparent:true,opacity:.028,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
    face.position.copy(block.position);architecture.add(face);
    for(let y1=.5;y1<h;y1+=.65){
      const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x-w/2,y1,z+d/2),new THREE.Vector3(x+w/2,y1,z+d/2)]);
      architecture.add(new THREE.LineSegments(g,blockMaterial));
    }
  }
  const light = createAccountLight(clock); scene.add(light.group);
  const panels = [
    { x: -9.5, z: -6.4, y: 6.5, title: "IDENTITY RISK SIGNAL", station: 'alert', lines: ["User: research.admin", "Risk score: 87 / 100", "Impossible travel + token replay"] },
    { x: -.8, z: -6.5, y: 7, title: "AI RECOMMENDATION", station: 'recommendation', lines: ["04 active sessions", "Privileged role detected", "Containment recommended"] },
    { x: 9, z: -6.4, y: 6.5, title: "ANALYST CONTROL", station: 'decision', lines: ["Execution locked", "Approval required", "Audit capture enabled"] },
  ].map((item, index) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 3.1), new THREE.MeshBasicMaterial({ map: evidenceTexture(item.title, item.lines), transparent: true, opacity: .82, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    panel.position.set(item.x, item.y, item.z); panel.rotation.y = (index - 1) * -.10; panel.userData.station=item.station;scene.add(panel);
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry),new THREE.LineBasicMaterial({color:0x5dbeef,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
    border.position.copy(panel.position);border.rotation.copy(panel.rotation);architecture.add(border);
    return panel;
  });

  const stationMap = new Map(stations.map(station => [station.id, buildStation(station, equipment)]));
  stationMap.forEach(entry => scene.add(entry.group));
  scene.updateMatrixWorld(true);
  const dottedGeometry = new THREE.Group();
  dottedGeometry.add(sampleEdges(architecture,clock));
  stationMap.forEach(entry=>dottedGeometry.add(sampleEdges(entry.group,clock)));
  scene.add(dottedGeometry);
  const routes = routePairs.map(([fromId, toId]) => {
    const fromEntry=stationMap.get(fromId),toEntry=stationMap.get(toId);
    const from = fromEntry.group.position.clone().setY(.16);from.x+=fromEntry.deckWidth/2;
    const to = toEntry.group.position.clone().setY(.16);to.x-=toEntry.deckWidth/2;
    let waypoints;
    if(toId==='audit'){
      from.copy(fromEntry.group.position).setY(.16);from.z+=1.4;
      to.copy(toEntry.group.position).setY(.16);to.x+=toEntry.deckWidth/2;
      waypoints=[from,from.clone().setZ(7.8),new THREE.Vector3(3.2,.16,7.8),new THREE.Vector3(3.2,.16,to.z),to];
    }else{
      const midX=(from.x+to.x)/2;
      waypoints=[from,new THREE.Vector3(midX,.16,from.z),new THREE.Vector3(midX,.16,to.z),to];
    }
    const clean=waypoints.filter((p,i)=>!i||p.distanceTo(waypoints[i-1])>.01);
    const curve = new THREE.CatmullRomCurve3(clean,false,'centripetal',.12);
    const color=toId==='decision'?0xffbd69:['sessions','password','signin'].includes(toId)?0xff8276:0x58eac0;
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .23, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, .042, 6, false), material);scene.add(mesh);
    const halo=new THREE.Mesh(new THREE.TubeGeometry(curve,80,.12,6,false),material.clone());halo.material.opacity=.06;scene.add(halo);
    const arrowShape=new THREE.Shape();arrowShape.moveTo(-.19,-.16);arrowShape.lineTo(0,-.04);arrowShape.lineTo(.19,-.16);arrowShape.lineTo(.19,-.03);arrowShape.lineTo(0,.13);arrowShape.lineTo(-.19,-.03);arrowShape.closePath();
    const arrows=Array.from({length:3},()=>{
      const arrow=new THREE.Mesh(new THREE.ShapeGeometry(arrowShape),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.4,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
      arrow.rotation.x=-Math.PI/2;scene.add(arrow);return arrow;
    });
    return { fromId, toId, curve, mesh, halo, arrows, color, active: false, complete: false };
  });

  const renderTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
  const composer = new EffectComposer(renderer,renderTarget);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .68, .5, .4);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const pickTargets = [...stationMap.values()].flatMap(entry => [entry.base, entry.deck, entry.screen]).concat(panels);
  const pickLabels=[...stationMap.values()].map(entry=>entry.label);
  stationMap.forEach(entry=>entry.label.userData.station=entry.station.id);
  let width = 1, height = 1, frame, disposed = false, time = 0, hovered = null;
  const framePoints=[];
  for(const x of [-16,16])for(const z of [-8,8])for(const y of [0,3.8])framePoints.push(new THREE.Vector3(x,y,z));
  framePoints.push(light.origin.clone().add(new THREE.Vector3(0,-1.5,0)));
  panels.forEach(panel=>{panel.updateMatrixWorld();for(const x of [-3.1,3.1])for(const y of [-1.6,1.6])framePoints.push(new THREE.Vector3(x,y,0).applyMatrix4(panel.matrixWorld));});
  function fitCamera(){
    camera.updateMatrixWorld();
    const aspect=width/height;
    let fit=0;
    for(const point of framePoints){const p=point.clone().applyMatrix4(camera.matrixWorldInverse);fit=Math.max(fit,Math.abs(p.y)*1.12,Math.abs(p.x)/aspect*1.07);}
    camera.left=-fit*aspect;camera.right=fit*aspect;camera.top=fit;camera.bottom=-fit;
    camera.updateProjectionMatrix();
  }
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    renderer.setSize(width, height, false); composer.setSize(width, height);
    fitCamera(); bloom.strength = width < 620 ? .22 : .68;
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas.parentElement); resize();
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    // Billboard labels must not steal clicks from real equipment behind them.
    return raycaster.intersectObjects(pickTargets, false)[0]?.object.userData.station || raycaster.intersectObjects(pickLabels,false)[0]?.object.userData.station || null;
  }
  const listeners=new AbortController();const eventOptions={signal:listeners.signal};let down=null,selected=null;
  const select=id=>{const entry=stationMap.get(id);if(entry){selected=id;onSelect?.(entry.station);}};
  const resetView=()=>{
    controls.enableDamping=false;controls.update();
    camera.position.copy(home);camera.zoom=1;controls.target.copy(target);controls.update();
    controls.enableDamping=!motion.matches;fitCamera();
  };
  canvas.addEventListener("pointermove", event => { hovered = pick(event); canvas.style.cursor = hovered ? "pointer" : "grab"; },eventOptions);
  canvas.addEventListener('pointerleave',()=>{hovered=null;},eventOptions);
  canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};},eventOptions);
  canvas.addEventListener("click", event => { if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)return;const id = pick(event); if (id) select(id); },eventOptions);
  canvas.addEventListener("dblclick", resetView,eventOptions);
  canvas.addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight','Home','+','-','=','Enter'].includes(event.key))event.preventDefault();
    if(event.key==='Home')resetView();
    if(['+','-','='].includes(event.key)){camera.zoom=THREE.MathUtils.clamp(camera.zoom*(event.key==='-'?.9:1.1),controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();}
    if(['ArrowLeft','ArrowRight','Enter'].includes(event.key)){
      const index=stations.findIndex(station=>station.id===selected);
      select(stations[(index+(event.key==='ArrowLeft'?-1:1)+stations.length)%stations.length].id);
    }
  },eventOptions);

  const phaseColors = { locked: 0x18566d, ready: 0x31cfff, running: 0xffa23d, complete: 0x5fffb0, rejected: 0xff6f59 };
  function setNodePhase(id, phase) {
    const entry = stationMap.get(id); if (!entry) return;
    entry.phase = phase;
    const color = new THREE.Color(phaseColors[phase] || phaseColors.locked);
    entry.responsiveMaterials.forEach(material => material.color?.copy(color));
    entry.deck.material.opacity = phase === "locked" ? .16 : .26;
    entry.screen.material.opacity = phase === "locked" ? .04 : .1;
    entry.ring.material.opacity = phase === "running" ? .48 : phase === "complete" ? .28 : .09;
    if(id==='decision'&&panels[2].userData.phase!==phase){
      const lines=phase==='complete'?['Execution authorized','Analyst approved','Audit capture enabled']:phase==='rejected'?['Execution blocked','Analyst rejected','No containment executed']:['Execution locked','Approval required','Audit capture enabled'];
      panels[2].material.map.dispose();panels[2].material.map=evidenceTexture('ANALYST CONTROL',lines);panels[2].userData.phase=phase;
    }
    routes.forEach(route => {
      if (route.toId !== id) return;
      route.active = phase === "running";
      route.complete = phase === "complete";
      route.mesh.material.opacity = route.active ? .95 : route.complete ? .62 : .23;
      route.halo.material.opacity = route.active ? .22 : route.complete ? .12 : .035;
    });
  }
  function animate(now) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);controls.enableDamping=!motion.matches;if(controls.update())fitCamera(); time = motion.matches ? 0 : now * .001;clock.value=time;
    stationMap.forEach(entry => {
      const focus = entry.phase === "running" || hovered === entry.station.id || selected===entry.station.id;
      entry.ring.scale.setScalar(focus ? 1 + Math.sin(time * 3) * .12 : 1);
      entry.label.material.opacity = focus ? 1 : .9;
    });
    routes.forEach((route, index) => {
      route.arrows.forEach((arrow,i)=>{
        const t=(i/3+.12+(route.active||route.complete?time*(route.active?.28:.10):0)+index*.07)%1;
        arrow.position.copy(route.curve.getPointAt(t));arrow.position.y+=.04;
        const tangent=route.curve.getTangentAt(t);arrow.rotation.z=Math.atan2(-tangent.x,-tangent.z);
        arrow.material.opacity=route.active?.98:route.complete?.68:.28;
      });
    });
    composer.render();
  }
  animate(0);
  return {
    setNodePhase,
    select,
    resetView,
    inspect(){
      scene.updateMatrixWorld(true);
      const project=p=>{const v=p.clone().project(camera);return{x:(v.x+1)*width/2,y:(1-v.y)*height/2};};
      return {time,zoom:camera.zoom,stations:[...stationMap.values()].map(entry=>({id:entry.station.id,phase:entry.phase,...project(entry.group.position.clone().add(new THREE.Vector3(0,1.4,0)))})),panels:panels.map(panel=>({id:panel.userData.station,...project(panel.position)})),routes:routes.map(({fromId,toId,active,complete})=>({fromId,toId,active,complete})),projector:project(light.origin),memory:{...renderer.info.memory}};
    },
    dispose() {
      if(disposed)return;
      disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); listeners.abort();controls.dispose();
      const materials=new Set(),textures=new Set(),geometries=new Set();
      scene.traverse(object => {if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
      materials.forEach(material=>{if(material.map)textures.add(material.map);material.dispose();});
      geometries.forEach(geometry=>geometry.dispose());textures.forEach(texture=>texture.dispose());equipment.dispose();
      bloom.dispose();composer.dispose(); renderer.dispose();
    },
  };
}
