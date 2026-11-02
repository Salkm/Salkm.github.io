import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { scenarios } from "./workflow.js";
import { stations, labelHeight, stationHeightScale, stationDimensions } from "./scene-layout.js";
import { createHologramFlow } from "./hologram-flow.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createEquipmentMaterials } from "./equipment-materials.js";
import { stationElevations } from "./flow-routes.js";
import { createProjectionBeams, createProjectionTraces } from "./projection-beams.js";

const CYAN = 0x39a8fb, GREEN = 0x63f5b0, AMBER = 0xffc575, RED = 0xff716d;
const LEVEL = 7.2;
const PROJECTOR = new THREE.Vector3(.8,-.3,3.5);

export function buildLab() {
  const root = new THREE.Group();
  const projection = new THREE.Group();
  projection.position.y = LEVEL;
  root.add(projection);
  const pickTargets = [], zoneGroups = new Map(), textures = [];
  const stationData = new Map();
  const timeUniform = { value: 0 };
  const equipment = createEquipmentMaterials(timeUniform);
  let snapshot = null, selected = null, hovered = null;

  function lineMaterial(color = CYAN, opacity = 0.5) {
    return new THREE.LineBasicMaterial({ color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  }
  const fine = lineMaterial(0x348fe6, 0.12), bright = lineMaterial(CYAN, 0.58);
  bright.color.multiplyScalar(1.15);
  const architecture = lineMaterial(0x288bdb, 0.075);
  const faint = lineMaterial(CYAN, 0.060);
  const slots = lineMaterial(0x368db2,.035);
  const containmentDetail=lineMaterial(RED,.12);
  function pointMaterial(color, opacity = 0.65, size = 1) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: timeUniform, uColor: { value: color }, uOpacity: { value: opacity }, uScale: { value: 1 }, uSize: { value: size } },
      vertexShader: `uniform float uTime, uScale, uSize; varying float vLight;
        void main(){float seed=fract(sin(dot(position,vec3(12.9898,78.233,37.719)))*43758.5453);
          vLight=.45+.55*seed; vLight*=.82+.18*sin(uTime*1.2+seed*35.);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
          gl_PointSize=(2.0+seed*2.3)*uScale*uSize;}`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vLight;
        void main(){float r=length(gl_PointCoord-.5)*2.; if(r>1.)discard;
          float glow=exp(-r*r*5.)*(1.-smoothstep(.65,1.,r));
          gl_FragColor=vec4(uColor*1.3,glow*vLight*uOpacity);}`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
  }
  function lines(parent, points, material = fine, segments = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    const object = segments ? new THREE.LineSegments(geometry, material) : new THREE.Line(geometry, material);
    object.renderOrder = 1;
    parent.add(object);
    return object;
  }
  function wireBox(parent, w, h, d, x, y, z, material = fine) {
    const source = new THREE.BoxGeometry(w, h, d);
    const geometry = new THREE.EdgesGeometry(source);
    source.dispose();
    const mesh = new THREE.LineSegments(geometry, material);
    mesh.renderOrder = 1;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function ring(parent, radius, y, material = fine, start = 0, sweep = Math.PI * 2) {
    const points = Array.from({ length: 97 }, (_, i) => {
      const a = start + i / 96 * sweep;
      return [Math.cos(a) * radius, y, Math.sin(a) * radius];
    });
    return lines(parent, points, material);
  }
  // Scan bands and view-dependent edges make surfaces read as light, not glass.
  const surface = new THREE.ShaderMaterial({
    uniforms: { uTime: timeUniform, uColor: { value: new THREE.Color(CYAN) } },
    vertexShader: `varying vec3 vWorld; varying vec3 vNormal; varying vec3 vView;
      void main(){ vec4 w=modelMatrix*vec4(position,1.); vWorld=w.xyz;
        vec4 p=modelViewMatrix*vec4(position,1.); vNormal=normalize(normalMatrix*normal);
        vView=normalize(-p.xyz); gl_Position=projectionMatrix*p; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor;
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vView;
      void main(){float edge=pow(max(0.,1.-abs(dot(normalize(vNormal),normalize(vView)))),2.);
        float band=pow(.5+.5*sin(vWorld.y*30.-uTime*1.5),18.);
        float scan=pow(.5+.5*sin(vWorld.y*.8-uTime*.65),42.);
        gl_FragColor=vec4(uColor*(1.+scan*.5),(.018+edge*.075+band*.015+scan*.035)); }`,
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  function volume(parent, w, h, d, x, y, z, material = equipment.body) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(.10,w/6,h/6,d/6)), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  const gridPoints = [];
  for (let x = -17; x <= 17; x++) gridPoints.push([x, 0, -8.5], [x, 0, 9.5]);
  for (let z = -8.5; z <= 9.5; z++) gridPoints.push([-17, 0, z], [17, 0, z]);
  lines(projection, gridPoints, faint, true);
  lines(projection, [[-17, 0, -8.5], [17, 0, -8.5], [17, 0, 9.5], [-17, 0, 9.5], [-17, 0, -8.5]], fine);
  const floorWash=new THREE.Mesh(new THREE.PlaneGeometry(34,18),new THREE.ShaderMaterial({
    uniforms:{uTime:timeUniform},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uTime;varying vec2 vUv;
      void main(){float edge=smoothstep(0.,.035,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
        float scan=.90+.10*sin(vUv.y*70.-uTime*.4);
        gl_FragColor=vec4(.007,.085,.28,edge*scan*.25);}`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    side:THREE.DoubleSide,toneMapped:false,
  }));
  floorWash.rotation.x=-Math.PI/2;floorWash.position.set(0,-.008,.5);projection.add(floorWash);
  const projectedPillars=[];
  for(const x of [-17,-10,-3,4,11,17]) for(const z of [-8.5,9.5])
    projectedPillars.push([x,0,z],[x,-4.5,z]);
  lines(projection,projectedPillars,lineMaterial(0x2486cc,.008),true);
  const datum = [];
  for (let x = -16; x <= 16; x += 2)
    for (let z = -8; z <= 8; z += 2) datum.push(x, 0.018, z);
  const dotsGeometry = new THREE.BufferGeometry();
  dotsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(datum, 3));
  projection.add(new THREE.Points(dotsGeometry, pointMaterial(new THREE.Color(CYAN).multiplyScalar(1.7), .68, 1.3)));

  const backWall = [];
  for (let x=-16;x<=16;x+=2) backWall.push([x,0,-8.25],[x,4.9,-8.25]);
  for (let y=0;y<=4.9;y+=0.7) backWall.push([-16,y,-8.25],[16,y,-8.25]);
  lines(projection,backWall,lineMaterial(0x2993d0,0.025),true);

  // Holographic volumes add depth without introducing extra workflow stages.
  const blockFaces = new THREE.ShaderMaterial({
    uniforms: { uTime: timeUniform },
    vertexShader: `varying vec3 vLocal,vLocalNormal; varying vec3 vNormal; varying vec3 vView;
      void main(){vLocal=position; vec4 p=modelViewMatrix*vec4(position,1.);
        vLocalNormal=normal;vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float uTime; varying vec3 vLocal,vLocalNormal,vNormal,vView;
      void main(){vec3 cell=abs(fract(vLocal*1.7)-.5);
        float grid=max(step(.487,cell.x),max(step(.487,cell.y),step(.487,cell.z)));
        float rim=pow(max(0.,1.-abs(dot(normalize(vNormal),normalize(vView)))),3.);
        float sweep=pow(.5+.5*sin(vLocal.y*1.4-uTime*.65),32.);
        vec2 uv=abs(vLocalNormal.y)>.5?vLocal.xz:(abs(vLocalNormal.z)>.5?vLocal.xy:vLocal.zy);
        vec2 cellId=floor(uv*8.);vec2 p=fract(uv*8.)-.5;
        float seed=fract(sin(dot(cellId,vec2(12.9898,78.233)))*43758.5453);
        float dots=exp(-dot(p,p)*80.)*step(.80,seed);
        gl_FragColor=vec4(.07,.35,.78,.006+rim*.012+grid*.008+sweep*.009+dots*.12);}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const blockEdge = lineMaterial(0x3aa7d8, .11);
  const blockCorner = new THREE.MeshBasicMaterial({color:0x79dfff, transparent:true, opacity:.75, toneMapped:false});
  const cornerGeometry = new THREE.SphereGeometry(.065, 6, 4);
  blockCorner.color.multiplyScalar(1.7);
  const blockGroups = [];
  for (const [x,z,w,h,d] of [
    [-11.3,-5.4,3.2,4.9,2.8], [-9.0,-5.8,3.0,5.0,2.6],
    [4.1,-7.0,3.2,4.2,2.8], [7.8,-7.5,2.9,4.7,2.8],
  ]) {
    const group = new THREE.Group(); group.position.set(x,.12,z); projection.add(group);
    wireBox(group,w,h,d,0,h/2,0,blockEdge);
    const faces = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),blockFaces);
    faces.position.y=h/2; group.add(faces);
    const ribs=[];
    for(let y=1.5;y<h;y+=1.5) {
      ribs.push([-w/2,y,-d/2],[w/2,y,-d/2],[-w/2,y,d/2],[w/2,y,d/2]);
    }
    lines(group,ribs,architecture,true);
    for(const sx of [-1,1]) for(const sz of [-1,1]) for(const y of [0,h]) {
      const corner = new THREE.Mesh(cornerGeometry,blockCorner);
      corner.position.set(sx*w/2,y,sz*d/2);group.add(corner);
    }
    blockGroups.push(group);
  }

  function server(parent, x, z, material) {
    wireBox(parent, 1.1, 2.6, 0.95, x, 1.45, z, material);
    volume(parent, 1.1, 2.6, 0.95, x, 1.45, z);
    for (let i = 0; i < 7; i++) {
      const y = 0.4 + i * 0.31;
      wireBox(parent,0.94,0.27,0.02,x,y+0.07,z+0.48,slots);
      const recess=new THREE.Mesh(new THREE.PlaneGeometry(.92,.26),equipment.recess);
      recess.position.set(x,y+.07,z+.493);parent.add(recess);
      const led = new THREE.Mesh(new THREE.PlaneGeometry(.09,.034),equipment.leds);
      led.position.set(x+.3,y+.12,z+.545);parent.add(led);
      lines(parent, [[x - 0.35, y + 0.1, z + 0.5], [x - 0.15, y + 0.1, z + 0.5]], bright);
      for(let j=0;j<4;j++) lines(parent,[[x+0.03+j*.075,y+.11,z+.52],[x+.06+j*.075,y+.11,z+.52]],material);
    }
    for(const dx of [-0.5,0.5]) lines(parent,[[x+dx,.2,z+.51],[x+dx,2.65,z+.51]],bright);
  }
  function terminal(parent, material, size = 1, kind = "telemetry") {
    const raised=kind==='benign'||kind==='review';
    const tall=raised||kind==='alert'||kind==='containment',screenY=raised?2.03:tall?1.8:1.6;
    const screenWidth=(kind==='file'?2.15:2)*size,screenHeight=(kind==='file'?2.3:raised?2.15:tall?1.6:1.3)*size;
    wireBox(parent, screenWidth, screenHeight, 0.12, 0, screenY, 0, material);
    volume(parent, screenWidth, screenHeight, 0.12, 0, screenY, 0);
    lines(parent, [[0, 0.93, 0], [0, 0.4, 0], [-0.65, 0.4, 0], [0.65, 0.4, 0]], fine);
    volume(parent,.10,.55,.10,0,.7,0);
    volume(parent,.8,.04,.36,0,.42,.07);
    const display = new THREE.Mesh(new THREE.PlaneGeometry(screenWidth-.16*size,screenHeight-.16*size),equipment.screen(['benign','review'].includes(kind)?'telemetry':kind));
    display.position.set(0,screenY,.069);parent.add(display);
  }
  function file(parent, material) {
    lines(parent, [[-0.7, 0.6, 0], [-0.7, 2.8, 0], [0.35, 2.8, 0], [0.85, 2.3, 0], [0.85, 0.6, 0], [-0.7, 0.6, 0]], material);
    lines(parent, [[0.35, 2.8, 0], [0.35, 2.3, 0], [0.85, 2.3, 0]], material);
    for (let i = 0; i < 6; i++) lines(parent, [[-0.42, 2.1 - i * 0.21, 0], [0.56, 2.1 - i * 0.21, 0]], fine);
  }
  function shield(parent, material) {
    lines(parent, [[0, 2.9, 0], [1.15, 2.35, 0], [0.9, 1.1, 0], [0, 0.5, 0], [-0.9, 1.1, 0], [-1.15, 2.35, 0], [0, 2.9, 0]], material);
    lines(parent, [[-0.48, 1.8, 0], [-0.12, 1.45, 0], [0.55, 2.15, 0]], material);
  }
  function workstation(parent, x, z, material, dual = false, scale = 1, kind = "telemetry") {
    const group = new THREE.Group(); group.position.set(x,0,z); group.scale.setScalar(scale); parent.add(group);
    const width = dual ? 3.3 : 2.6;
    wireBox(group,width,.13,1.25,0,1.12,0,material);
    volume(group,width,.13,1.2,0,1.12,0);
    for(const side of [-1,1]) {
      wireBox(group,.09,1.05,.9,side*(width/2-.17),.56,0,fine);
      volume(group,.12,1.05,.85,side*(width/2-.17),.56,0);
      lines(group,[[side*(width/2-.3),.05,-.6],[side*(width/2+.03),.05,-.6],[side*(width/2+.03),.05,.6],[side*(width/2-.3),.05,.6]],fine);
    }
    for(const monitorX of dual ? [-.8,.8] : [0]) {
      const display = new THREE.Group(); display.position.set(monitorX,.45,-.24); group.add(display);
      display.rotation.y=kind==='file'?.49:kind==='alert'||kind==='containment'?.20:0;
      terminal(display,material,dual?.64:.8,kind);
    }
    wireBox(group,.94,.045,.34,0,1.23,.3,fine);
    const keys=[];
    for(let row=0;row<3;row++) for(let col=0;col<10;col++) keys.push([-.4+col*.085,1.26,.2+row*.09],[-.36+col*.085,1.26,.2+row*.09]);
    lines(group,keys,fine,true);
    wireBox(group,.13,.045,.2,.68,1.24,.3,material);
    const cabinetBench=kind==='alert'||kind==='containment';
    const rightWidth=cabinetBench?.9:.48,rightDepth=cabinetBench?.9:.74;
    const rightX=width/2-(cabinetBench?.62:.48);
    volume(group,rightWidth,.95,rightDepth,rightX,.56,-.05);
    wireBox(group,rightWidth,.95,rightDepth,rightX,.56,-.05,fine);
    if(cabinetBench) {
      const front=new THREE.Mesh(new THREE.PlaneGeometry(rightWidth-.13,.8),equipment.recess);
      front.position.set(rightX,.56,-.05+rightDepth/2+.007);group.add(front);
    }
    const pedestalWidth=cabinetBench?1:.70,pedestalX=-width/2+(cabinetBench?.64:.48);
    volume(group,pedestalWidth,.95,1.0,pedestalX,.56,0);
    wireBox(group,pedestalWidth,.95,1.0,pedestalX,.56,0,material);
    const pedestalFace=new THREE.Mesh(new THREE.PlaneGeometry(pedestalWidth-.13,.8),equipment.recess);
    pedestalFace.position.set(pedestalX,.56,.507);group.add(pedestalFace);
    for(let i=0;i<3;i++) {
      lines(group,[[pedestalX-.2,.79-i*.16,.516],[pedestalX+.09,.79-i*.16,.516]],fine);
      const indicator=new THREE.Mesh(new THREE.PlaneGeometry(.06,.025),equipment.leds);
      indicator.position.set(pedestalX+.18,.79-i*.16,.518);group.add(indicator);
    }
    for(let i=0;i<3;i++){
      const led=new THREE.Mesh(new THREE.PlaneGeometry(.045,.025),equipment.leds);
      led.position.set(rightX+.09,.7-i*.10,-.05+rightDepth/2+.015);group.add(led);
    }
    if(kind==='alert'||kind==='containment')return;
    const chair = new THREE.Group(); chair.position.z=1.03; group.add(chair);
    wireBox(chair,.67,.1,.63,0,.57,0,fine);
    volume(chair,.67,.1,.63,0,.57,0);
    wireBox(chair,.66,.73,.1,0,.96,.3,material);
    volume(chair,.66,.73,.05,0,.96,.3);
    for(const sx of [-1,1]) {
      volume(chair,.055,.34,.055,sx*.34,.74,0);
      volume(chair,.10,.07,.36,sx*.34,.93,.04);
    }
    lines(chair,[[0,.55,0],[0,.12,0]],fine);
    for(let i=0;i<5;i++) {const a=i*Math.PI*2/5; lines(chair,[[0,.12,0],[Math.cos(a)*.42,.1,Math.sin(a)*.42]],fine);}
  }
  function chamber(parent, material) {
    wireBox(parent,2.8,.18,2.5,0,.12,0,material);
    wireBox(parent,2.8,.1,2.5,0,3.35,0,material);
    for(const x of [-1.35,1.35]) for(const z of [-1.2,1.2])
      lines(parent,[[x,.2,z],[x,3.35,z]],material);
    for(let y=.5;y<3.3;y+=.24) for(const x of [-1.2,1.2])
      lines(parent,[[x,y,1.22],[x+(x<0?.15:-.15),y,1.22]],fine);
    const document = new THREE.Group(); document.position.set(0,.45,0); document.scale.setScalar(.8); parent.add(document); file(document,bright);
    volume(parent,2.65,3.1,2.35,0,1.75,0);
  }
  for (const [index, station] of stations.entries()) {
    const group = new THREE.Group();
    const baseY = stationElevations[station.id];
    group.position.set(station.x, baseY, station.z);
    group.scale.y = stationHeightScale(station.id);
    projection.add(group);
    zoneGroups.set(station.id, group);
    const color = station.id === "isolate" || station.id === "malware" ? RED : station.id === "review" ? AMBER : station.id === "benign" || station.id === "audit" ? GREEN : CYAN;
    const material = lineMaterial(station.id === 'isolate' ? RED : CYAN, 0.72);
    material.color.multiplyScalar(station.id === 'isolate' ? 2.2 : 1.35);
    const boundary = lineMaterial(color, 0.22);
    const {width:w,depth:d,height:h}=stationDimensions(station.id);
    wireBox(group, w, 0.03, d, 0, 0, 0, boundary);
    if (!["audit", "decision"].includes(station.id)) {
      wireBox(group, w, h, d, 0, h/2, 0, architecture);
      const rear = new THREE.Mesh(new THREE.PlaneGeometry(w, h), surface);
      rear.position.set(0, h/2, -d / 2);
      group.add(rear);
      for (const side of [-1, 1]) {
        const face = new THREE.Mesh(new THREE.PlaneGeometry(d, h), blockFaces);
        face.rotation.y = side * Math.PI / 2;
        face.position.set(side*w/2,h/2,0);group.add(face);
      }
      for (const side of [-1, 1]) {
        lines(group, [[side*w/2,0,-d/2],[side*w/2,h,-d/2],[side*(w/2-0.65),h,-d/2]], material);
      }
    }
    const corners = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * w / 2, z = sz * d / 2;
      corners.push([x - sx * 0.55, 0, z], [x, 0, z], [x, 0, z], [x, 0, z - sz * 0.55]);
      corners.push([x, 0, z], [x, 0.6, z]);
    }
    lines(group, corners, material, true);
    const cornerDots=[];
    for(const x of [-w/2,w/2]) for(const z of [-d/2,d/2]) {
      cornerDots.push(x,0,z);
      if(station.id==='isolate') cornerDots.push(x,h,z);
    }
    const cornerDotsGeometry=new THREE.BufferGeometry();
    cornerDotsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(cornerDots,3));
    const cornerDotMaterial=pointMaterial(new THREE.Color(color).multiplyScalar(2.4),.9);
    cornerDotMaterial.uniforms.uScale.value=2.2;
    group.add(new THREE.Points(cornerDotsGeometry,cornerDotMaterial));
    if (station.id === "orchestrate") {
      const racks=new THREE.Group();racks.scale.x=.86;group.add(racks);
      server(racks, -1.05, -.65, material);server(racks,.3,-.65,material);server(racks,1.15,-1.4,fine);
      workstation(group,.4,.65,material,false,.50);
    } else if (station.id === "investigate") {
      workstation(group,0,0,material,false,1.06,"file");
    } else if (station.id === "decision") {
      workstation(group,0,0,material,false,.68);
    } else if (station.id === "isolate") {
      workstation(group,0,.4,material,false,1.04,"containment");
      wireBox(group,w-.12,h,d-.12,0,h/2,0,material);
    } else if (station.id === "malware") {
      volume(group,3.4,.10,1.8,0,2.20,0);
      volume(group,3.4,.12,1.8,0,.20,0);
      for(const x of [-1.04,0,1.04]) {
        volume(group,.94,1.86,1.65,x,1.2,0);
        wireBox(group,.94,1.86,1.65,x,1.2,0,material);
        const door=new THREE.Mesh(new THREE.PlaneGeometry(.83,1.73),equipment.recess);
        door.position.set(x,1.2,.887);group.add(door);
        lines(group,[[x-.42,2.08,.9],[x+.42,2.08,.9]],material);
        lines(group,[[x+.24,1.2,.9],[x+.24,1.52,.9]],bright);
        for(let y=.48;y<.9;y+=.09) lines(group,[[x-.28,y,.9],[x+.28,y,.9]],fine);
        const led=new THREE.Mesh(new THREE.PlaneGeometry(.07,.03),equipment.leds);
        led.position.set(x-.26,1.6,.91);group.add(led);
      }
      const console = new THREE.Group();console.position.set(0,1.24,-.45);group.add(console);terminal(console,material,.83);
    } else if (station.id === "benign") workstation(group,0,-.4,material,false,.95,'benign');
    else if (station.id === "audit") {
      for (const x of [-2.7,-.9,.9,2.7]) workstation(group,x,0,material,false,.64);
    } else {
      workstation(group,0,-.25,material,false,.95,station.id==="detect"?"alert":"review");
      if(station.id==='review')for(const x of [-1.15,1.15]) {
        volume(group,.65,1.6,.8,x,.9,-.65);
        wireBox(group,.65,1.6,.8,x,.9,-.65,fine);
      }
    }
    if(station.id==='isolate')group.traverse(object=>{
      if(object.material===equipment.body)object.material=equipment.containmentBody;
      else if(object.material===equipment.recess)object.material=equipment.containmentRecess;
      else if(object.material===equipment.leds)object.material=equipment.containmentLeds;
      else if(object.material===fine||object.material===slots)object.material=containmentDetail;
    });
    const scan = wireBox(group, w - 0.4, 0.015, d - 0.3, 0, 1.6, 0, bright);
    const hitHeight=station.id==='audit'?1.85:station.id==='decision'?2.0:h;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(w, hitHeight, d), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = hitHeight/2;
    hit.userData.station = station.id;
    group.add(hit);
    pickTargets.push(hit);
    stationData.set(station.id, { group, material, boundary, scan, index, baseY });
  }

  const flow = createHologramFlow(projection);

  // Evidence is redrawn from the same simulated incident snapshot as the inspector.
  const evidencePanels = [];
  function evidencePanel(title, x, y, z, rotation, variant, scaleX=1, scaleY=1) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = rotation;
    group.scale.set(scaleX,scaleY,1);
    projection.add(group);
    const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 384;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 4.1), new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: 0.94, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    group.add(plane);
    plane.userData.station = ["detect","investigate","decision"][variant];
    pickTargets.push(plane);
    const sweep = new THREE.Mesh(new THREE.PlaneGeometry(8.1,.075),new THREE.MeshBasicMaterial({
      color:0x52cfff,transparent:true,opacity:.32,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide,
    }));
    sweep.position.z=.04;group.add(sweep);
    wireBox(group, 8.2, 4.1, 0.035, 0, 0, 0, fine);
    for(const sx of [-1,1]) for(const sy of [-1,1]) lines(group,[[sx*3.7,sy*2.05,0],[sx*4.1,sy*2.05,0],[sx*4.1,sy*1.65,0]],bright);
    for(const sx of [-1,1]) for(const sy of [-1,1]) {
      const light=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0x8deaff,toneMapped:false}));
      light.material.color.multiplyScalar(1.8);light.position.set(sx*4.1,sy*2.05,.035);group.add(light);
    }
    const panel = { canvas, texture, group, title, variant, baseY: y, sweep };
    evidencePanels.push(panel);
  }
  evidencePanel("PROCESS TREE", -19.72, 3.60, -7.5, 1.094, 0, 1.097, 1.13);
  evidencePanel("EXECUTABLE SCAN", -4.15, 5.90, -8, 0.32, 1, 1.02, .96);
  evidencePanel("CONTAINMENT APPROVAL", 12.95, 6.53, -8, -.105, 2, 1.06, 1.07);
  function drawEvidence(panel) {
    const c = panel.canvas.getContext("2d"), data = scenarios[snapshot?.scenario || "malware"];
    c.clearRect(0, 0, 768, 384);
    c.shadowBlur=0;
    c.fillStyle = "rgba(5,51,98,.42)"; c.fillRect(0, 0, 768, 384);
    c.strokeStyle="rgba(48,122,156,.19)";c.lineWidth=1;
    for(let x=0;x<768;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,384);c.stroke();}
    for(let y=0;y<384;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(768,y);c.stroke();}
    c.strokeStyle = "#2a7094"; c.lineWidth = 1;
    c.shadowColor='#168fce';c.shadowBlur=5;
    c.beginPath(); c.moveTo(26, 66); c.lineTo(742, 66); c.stroke();
    c.fillStyle = "#79d5ff"; c.font = "bold 31px monospace"; c.fillText(panel.title, 26, 44);
    c.font = "17px monospace"; c.fillStyle = "#67a7c5";
    c.fillText("LAB-WKS-042 / SIMULATION", 26, 360);
    if (panel.variant === 0) {
      const nodes = [[318,92,"ENDPOINT"],[200,150,"PARENT"],[400,150,"SESSION"],
        [120,215,"PROCESS"],[310,215,"CHILD"],[495,215,"SERVICE"],
        [56,290,"FILE"],[230,290,"HASH"],[404,290,"NETWORK"],[582,290,"TOKEN"]];
      const links=[[0,1],[0,2],[1,3],[1,4],[2,5],[3,6],[3,7],[4,8],[5,9]];
      c.lineWidth=2;c.strokeStyle="#398bb6";
      for(const [a,b] of links){const n=nodes[a],m=nodes[b],mid=(n[1]+34+m[1])/2;
        c.beginPath();c.moveTo(n[0]+56,n[1]+34);c.lineTo(n[0]+56,mid);c.lineTo(m[0]+56,mid);c.lineTo(m[0]+56,m[1]);c.stroke();}
      nodes.forEach(([x,y,text],i)=>{c.fillStyle="rgba(11,84,118,.25)";c.fillRect(x,y,112,34);
        c.strokeStyle=i===4&&data.severity!=="Low"?"#ffbb70":"#5ad7ff";c.strokeRect(x,y,112,34);
        c.fillStyle="#aff0ff";c.font="14px monospace";c.fillText(text,x+10,y+22);});
    } else if (panel.variant === 1) {
      c.fillStyle = "#c8f1ff"; c.font = "20px monospace"; c.fillText(data.file, 26, 103);
      const reputation = snapshot?.scenario === "ransomware" && snapshot.index > 3
        ? "Corroborated threat indicators" : data.reputation;
      c.strokeStyle="#70dfff";c.lineWidth=3;c.beginPath();c.moveTo(46,132);c.lineTo(125,132);c.lineTo(155,163);
      c.lineTo(155,306);c.lineTo(46,306);c.closePath();c.moveTo(125,132);c.lineTo(125,163);c.lineTo(155,163);c.stroke();
      c.lineWidth=2;for(let i=0;i<7;i++){c.beginPath();c.moveTo(62,188+i*13);c.lineTo(i%2?133:118,188+i*13);c.stroke();}
      const rows = [reputation, data.signature, data.behavior,"HASH CORRELATION / SIMULATED"];
      rows.forEach((text,i) => { c.fillStyle = "#a1dcf0"; c.font = "17px monospace"; c.fillText(text,205,151+i*49);
        c.strokeStyle="#5fcaef";c.strokeRect(205,162+i*49,14,12);
        c.fillStyle="#163d59";c.fillRect(236,164+i*49,463,8);
        c.fillStyle=i===2?"#dfaa65":"#409ecc";c.fillRect(236,164+i*49,210+i*52,8); });
    } else {
      const status = snapshot?.waiting ? "AWAITING ANALYST" : snapshot?.complete ? "AUDIT RETAINED" : "POLICY EVALUATION";
      c.fillStyle = snapshot?.waiting ? "#ffcc82" : "#86ecd0"; c.font = "21px monospace"; c.fillText(status,26,109);
      c.strokeStyle="#66c7ef";c.lineWidth=2;c.beginPath();c.moveTo(384,138);c.lineTo(433,183);c.lineTo(384,227);c.lineTo(335,183);c.closePath();
      c.moveTo(335,183);c.lineTo(180,183);c.lineTo(180,263);c.moveTo(433,183);c.lineTo(590,183);c.lineTo(590,263);c.moveTo(384,227);c.lineTo(384,300);c.stroke();
      c.font="15px monospace";c.fillStyle="#b2e8f7";c.fillText("POLICY",357,188);
      c.strokeStyle="#58d6ae";c.strokeRect(90,263,180,43);c.fillStyle="#83ebc7";c.fillText("SCOPED ACTION",119,289);
      c.strokeStyle="#ffb565";c.strokeRect(500,263,180,43);c.fillStyle="#ffca8a";c.fillText("ANALYST REVIEW",523,289);
      c.fillStyle="#78c3e0";c.fillText(snapshot?.online===false?"OFFLINE":"AUDIT",359,322);
    }
    panel.texture.needsUpdate = true;
  }

  const projector = new THREE.Group(); projector.position.copy(PROJECTOR); root.add(projector);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.16, 64), new THREE.MeshBasicMaterial({ color: 0x07111a }));
  projector.add(base);
  ring(projector, 1.25, 0.09, bright); ring(projector, 1.72, 0.05, fine);
  ring(projector, 2.1, 0.04, fine, 0.25, 1.9); ring(projector, 2.1, 0.04, fine, 3.4, 1.9);
  const emitter = new THREE.Mesh(new THREE.CircleGeometry(0.24, 48), new THREE.MeshBasicMaterial({ color: 0xadf5ff, toneMapped: false }));
  emitter.material.color.multiplyScalar(2.6); emitter.rotation.x = -Math.PI / 2; emitter.position.y = 0.1;
  projector.add(emitter);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=128;glowCanvas.height=128;
  const glowContext=glowCanvas.getContext('2d');
  const glowGradient=glowContext.createRadialGradient(64,64,0,64,64,64);
  glowGradient.addColorStop(0,'rgba(205,248,255,1)');
  glowGradient.addColorStop(.08,'rgba(92,209,255,.95)');
  glowGradient.addColorStop(.26,'rgba(16,121,255,.30)');
  glowGradient.addColorStop(.65,'rgba(8,78,240,.05)');
  glowGradient.addColorStop(1,'rgba(0,40,200,0)');
  glowContext.fillStyle=glowGradient;glowContext.fillRect(0,0,128,128);
  const glowTexture=new THREE.CanvasTexture(glowCanvas);glowTexture.colorSpace=THREE.SRGBColorSpace;
  textures.push(glowTexture);
  const platformCorners=new THREE.BufferGeometry();
  platformCorners.setAttribute('position',new THREE.Float32BufferAttribute(
    [-17,.025,-8.5,-17,.025,9.5,17,.025,-8.5,17,.025,9.5],3));
  projection.add(new THREE.Points(platformCorners,pointMaterial(new THREE.Color(.45,1,1.8),.95,1.8)));
  const emitterGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,
    transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
  emitterGlow.scale.set(5.8,2.8,1);emitterGlow.position.y=.18;projector.add(emitterGlow);
  const horizontalFlare=new THREE.Sprite(emitterGlow.material.clone());
  horizontalFlare.material.opacity=.18;horizontalFlare.scale.set(15,1.0,1);
  horizontalFlare.position.y=.18;projector.add(horizontalFlare);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(38,16),new THREE.ShaderMaterial({
    uniforms:{uTime:timeUniform},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uTime;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*vec2(2.,1.);
      float r=length(p);float angle=atan(p.y,p.x);float rays=pow(.5+.5*sin(angle*74.+r*7.),24.);
      float rings=pow(.5+.5*sin(r*135.-uTime*.35),30.);
      float alpha=exp(-r*7.)*(.10+rays*.34+rings*.055);
      gl_FragColor=vec4(.02,.37,1.4,alpha);}`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false,
  }));
  spill.rotation.x=-Math.PI/2;spill.position.y=-.03;projector.add(spill);
  root.add(createProjectionBeams(LEVEL,timeUniform,PROJECTOR));
  const beamVolume = new THREE.ConeGeometry(1, 1, 64, 1, true);
  beamVolume.rotateZ(Math.PI);
  beamVolume.rotateY(Math.PI / 4);
  const beamHeight=LEVEL-PROJECTOR.y;
  beamVolume.scale(17, beamHeight, 9);
  beamVolume.translate(0, beamHeight / 2 + PROJECTOR.y, 0);
  const beamVertices=beamVolume.attributes.position;
  for(let i=0;i<beamVertices.count;i++) {
    const taper=1-(beamVertices.getY(i)-PROJECTOR.y)/beamHeight;
    beamVertices.setX(i,beamVertices.getX(i)+PROJECTOR.x*taper);
    beamVertices.setZ(i,beamVertices.getZ(i)+PROJECTOR.z*taper);
  }
  beamVolume.computeVertexNormals();
  beamVolume.computeBoundingSphere();
  const beamWash = new THREE.ShaderMaterial({
    uniforms: { uTime: timeUniform },
    vertexShader: `varying vec3 vPosition,vNormal,vView; void main(){vPosition=position;
      vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);
      gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float uTime; varying vec3 vPosition,vNormal,vView;
      void main(){float h=clamp((vPosition.y+.3)/7.5,0.,1.); float a=pow(1.-h,1.8)*.28;
        float edge=pow(abs(dot(normalize(vNormal),normalize(vView))),.7);
        gl_FragColor=vec4(.025,.37,1.,a*edge*(.92+.08*sin(uTime*.7)));}`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    side:THREE.DoubleSide, toneMapped:false,
  });
  root.add(new THREE.Mesh(beamVolume,beamWash));

  const particleCount = 3800, particlePositions = new Float32Array(particleCount * 3), seeds = [];
  for (let i = 0; i < particleCount; i++) seeds.push({ x: Math.sin(i * 72.3) * 16.8, z: Math.cos(i * 43.7) * 8.5, phase: (i * 0.618034) % 1 });
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const particleMaterial = pointMaterial(new THREE.Color(0x40bcff), 0.30);
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false; root.add(particles);
  const scalePoints = function(renderer) {
    this.material.uniforms.uScale.value = Math.max(.55, Math.min(1, renderer.domElement.clientWidth / 760));
  };
  particles.onBeforeRender = scalePoints;
  const fieldPositions=[];
  const hash=n=>{const value=Math.sin(n*12.9898)*43758.5453;return value-Math.floor(value);};
  for(let i=0;i<650;i++) {
    const x=(hash(i)+hash(i+47)-1)*19.5,z=(hash(i+113)-.5)*20;
    const y=((i*.618034)%1)*15-.25;
    fieldPositions.push(x,y,z);
  }
  const fieldGeometry=new THREE.BufferGeometry();
  fieldGeometry.setAttribute('position',new THREE.Float32BufferAttribute(fieldPositions,3));
  const field=new THREE.Points(fieldGeometry,pointMaterial(new THREE.Color(0x1a80de),.52,1.4));
  field.onBeforeRender=scalePoints;root.add(field);
  root.add(createProjectionTraces(timeUniform));

  // Merge fixed line segments per station/material; moving stations remain independent.
  function batch(parent) {
    parent.updateMatrixWorld(true);
    const inverse = parent.matrixWorld.clone().invert(), buckets = new Map();
    parent.traverse(obj => {
      if (!obj.isLine || obj === parent || [...stationData.values()].some(s => s.scan === obj)) return;
      if (!buckets.has(obj.material)) buckets.set(obj.material, []);
      buckets.get(obj.material).push(obj);
    });
    for (const [material, objects] of buckets) {
      if (objects.length < 2) continue;
      const pieces = objects.map(obj => {
        const positions = obj.geometry.getAttribute("position"), p = [];
        if (obj.isLineSegments) for(let i=0;i<positions.count;i++) p.push(positions.getX(i),positions.getY(i),positions.getZ(i));
        else for(let i=1;i<positions.count;i++) p.push(positions.getX(i-1),positions.getY(i-1),positions.getZ(i-1),positions.getX(i),positions.getY(i),positions.getZ(i));
        const g = new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));
        return g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,obj.matrixWorld));
      });
      const merged = mergeGeometries(pieces); pieces.forEach(p => p.dispose());
      if (merged) { objects.forEach(obj => { obj.removeFromParent(); obj.geometry.dispose(); }); const mesh=new THREE.LineSegments(merged,material);mesh.renderOrder=1;parent.add(mesh); }
    }
  }
  zoneGroups.forEach(batch);
  // Sample real equipment edges in local 3D space; the glow follows orbit and station motion.
  const edgeLines = [], dotMaterials = new Map();
  projection.traverse(object => {
    if (object.isLine && ![...stationData.values()].some(s => s.scan === object)) edgeLines.push(object);
  });
  let edgePointCount = 0;
  for (const object of edgeLines) {
    const positions = object.geometry.getAttribute("position"), points = [];
    const stride = object.isLineSegments ? 2 : 1;
    for (let i = 0; i < positions.count - 1; i += stride) {
      const a = new THREE.Vector3().fromBufferAttribute(positions, i);
      const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
      if(a.distanceTo(b)<.12)continue;
      const count = Math.max(1, Math.ceil(a.distanceTo(b) / .22));
      for (let j = 0; j <= count; j++) {
        if ((i * 7 + j * 11) % 9 === 0) continue;
        const p = a.clone().lerp(b, j / count);
        const seed = i * 47 + j * 13;
        p.x += Math.sin(seed * 1.71) * .024;
        p.y += Math.cos(seed * 2.31) * .024;
        p.z += Math.sin(seed * 3.19) * .024;
        points.push(p.x, p.y, p.z);
      }
    }
    const source = object.material;
    if (!dotMaterials.has(source)) dotMaterials.set(source,
      pointMaterial(source.color, source.opacity < .04 ? .045 : source === architecture ? .17 : source === fine ? .20 : Math.min(.42,source.opacity*1.3),
        source===fine?1.2:source===architecture?1.6:1));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const cloud = new THREE.Points(geometry, dotMaterials.get(source));
    cloud.position.copy(object.position); cloud.quaternion.copy(object.quaternion); cloud.scale.copy(object.scale);
    cloud.renderOrder = 2;
    cloud.onBeforeRender = scalePoints;
    object.parent.add(cloud);
    edgePointCount += points.length / 3;
  }
  // Equipment bodies share materials, so merge them without merging pick targets or screens.
  for(const group of zoneGroups.values()) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    for(const material of [equipment.body,equipment.recess,equipment.leds,equipment.containmentBody,equipment.containmentRecess,equipment.containmentLeds]) {
      const objects=[];group.traverse(obj=>{if(obj.isMesh&&obj.material===material)objects.push(obj);});
      if(objects.length<2)continue;
      const parts=objects.map(obj=>obj.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,obj.matrixWorld)));
      const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());
      if(merged){objects.forEach(obj=>{obj.removeFromParent();obj.geometry.dispose();});group.add(new THREE.Mesh(merged,material));}
    }
  }
  let evidenceKey = "";
  function setState(state, selection = null) {
    snapshot = state; selected = selection;
    flow.setState(state);
    const key = `${state.scenario}:${state.waiting}:${state.complete}:${state.online}:${state.scenario === "ransomware" && state.index > 3}`;
    if (key !== evidenceKey) { evidencePanels.forEach(drawEvidence); evidenceKey = key; }
  }
  function update(time) {
    timeUniform.value = time;
    root.rotation.y = Math.sin(time*.18)*.027;
    blockGroups.forEach((group,i) => { group.position.y = .12 + Math.sin(time*.35+i)*.055; });
    for (const [id,s] of stationData) {
      const focus = id === selected || id === hovered || (id === snapshot?.node && !snapshot?.complete);
      s.group.position.y = s.baseY + Math.sin(time * 0.55 + s.index * 0.5) * 0.1;
      s.material.opacity = focus ? 0.52 : id==='isolate' ? 0.38 : 0.26;
      s.boundary.opacity = focus ? 0.48 : id==='isolate' ? 0.25 : 0.15;
      s.scan.visible = focus && !snapshot?.complete;
      s.scan.position.y = 1.65 + Math.sin(time * 1.1) * 1.4;
    }
    for (const p of evidencePanels) {
      p.group.position.y = p.baseY + Math.sin(time * 0.4 + p.variant) * 0.14;
      p.sweep.position.y = 1.9 - ((time*.36+p.variant*.65)%3.8);
    }
    flow.update(time);
    for (let i=0;i<particleCount;i++) {
      const s=seeds[i], t=(s.phase+time*.025)%1;
      particlePositions[i*3]=PROJECTOR.x*(1-t)+s.x*(0.05+t*.95);
      particlePositions[i*3+1]=PROJECTOR.y+.16+t*(LEVEL+4.5);
      particlePositions[i*3+2]=PROJECTOR.z*(1-t)+s.z*(0.05+t*.95);
    }
    particleGeometry.attributes.position.needsUpdate=true;
    root.updateMatrixWorld(true);
  }
  evidencePanels.forEach(drawEvidence);
  update(0);
  const framingPoints = [];
  for (const x of [-17.5,17.5]) for (const z of [-9,10]) framingPoints.push(new THREE.Vector3(x,LEVEL,z));
  for (const panel of evidencePanels) for (const x of [-4.2,4.2]) for (const y of [-2.15,2.15])
    framingPoints.push(new THREE.Vector3(panel.group.position.x+x,LEVEL+panel.baseY+y,panel.group.position.z));
  for (const panel of evidencePanels) for (const x of [-4.2,4.2]) for (const y of [-2.3,2.3])
    framingPoints.push(panel.group.localToWorld(new THREE.Vector3(x,y,0)));
  for (const x of [-2.5,2.5]) for (const z of [-2,3]) framingPoints.push(new THREE.Vector3(x,-0.5,z));
  for (const station of stations) framingPoints.push(new THREE.Vector3(station.x,LEVEL+4.8,station.z));
  return {
    root, pickTargets, zoneGroups, setState, update, framingPoints,
    getFlowDiagnostics: () => ({ ...flow.getDiagnostics(), edgePointCount, particleCount, hologramBlocks: blockGroups.length }),
    getEvidencePositions() {return evidencePanels.map(p=>({station:p.group.children[0].userData.station,point:p.group.localToWorld(new THREE.Vector3(0,.6,.1))}));},
    getStationPickPositions() {return [...pickTargets.filter(p=>p.geometry.type==='BoxGeometry').map(p=>({
      station:p.userData.station,point:p.localToWorld(new THREE.Vector3(0,0,p.geometry.parameters.depth/2-.05)),
    })),{station:'investigate-base',point:zoneGroups.get('investigate').localToWorld(new THREE.Vector3(0,.5,1.6))}];},
    getCalibrationPoints() {
      const points={projector:projector.localToWorld(new THREE.Vector3(0,.1,0))};
      for(const panel of evidencePanels) {
        const id=panel.group.children[0].userData.station;
        for(const [name,x,y] of [['tl',-4.1,2.05],['tr',4.1,2.05],['bl',-4.1,-2.05],['br',4.1,-2.05]])
          points[`panel-${id}-${name}`]=panel.group.localToWorld(new THREE.Vector3(x,y,.035));
      }
      for(const [id,group] of zoneGroups) {
        points[`floor-${id}`]=group.localToWorld(new THREE.Vector3());
      }
      return points;
    },
    bounds: new THREE.Box3(new THREE.Vector3(-18,-0.5,-9),new THREE.Vector3(18,17.7,10)),
    setHover(id) { hovered=id; },
    labelPosition(id) {
      const s=stationData.get(id);
      return s.group.localToWorld(new THREE.Vector3(0,labelHeight(id),0));
    },
    dispose() {
      const geometries=new Set(), materials=new Set();
      root.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry); if(obj.material)materials.add(obj.material);});
      geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); textures.forEach(t=>t.dispose());equipment.dispose();
    },
  };
}
