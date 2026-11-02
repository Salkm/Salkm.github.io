import * as THREE from "three";
import { docks, routeWaypoints, getRouteState } from "./flow-routes.js";

// Rounded corners keep the signal on deliberate lanes, outside the equipment.
function roundedCurve(points) {
  const p = points.map(v => new THREE.Vector3(...v));
  const path = new THREE.CurvePath();
  let cursor = p[0];
  for (let i=1;i<p.length-1;i++) {
    const previous = p[i-1], corner = p[i], next = p[i+1];
    const r = Math.min(.36, previous.distanceTo(corner)*.3, next.distanceTo(corner)*.3);
    const before = corner.clone().add(previous.clone().sub(corner).normalize().multiplyScalar(r));
    const after = corner.clone().add(next.clone().sub(corner).normalize().multiplyScalar(r));
    if(cursor.distanceTo(before)>.001) path.add(new THREE.LineCurve3(cursor,before));
    path.add(new THREE.QuadraticBezierCurve3(before,corner,after));
    cursor = after;
  }
  path.add(new THREE.LineCurve3(cursor,p.at(-1)));
  return path;
}

export function createHologramFlow(parent) {
  const routes = new Map(), pulses = new Map();
  const secondaryRoutes=new Set(['isolate:investigate','review:benign','review:audit','isolate:audit','orchestrate:audit']);
  let time=0, previous=0, state=null, active=null, visited=[];
  const forward = new THREE.Vector3(0,0,-1);
  for(const [key,waypoints] of Object.entries(routeWaypoints)) {
    const to=key.split(":")[1];
    const color = new THREE.Color(to==="malware"||to==="isolate"?0xff4653:to==="review"?0xffc36b:0x5fffc3);
    const curve=roundedCurve(waypoints), group=new THREE.Group(); parent.add(group);
    const uniforms={uTime:{value:0},uColor:{value:color},uStrength:{value:.12},uActive:{value:0}};
    const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
      blending:THREE.AdditiveBlending,toneMapped:false,
      vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uTime,uStrength,uActive; uniform vec3 uColor; varying vec2 vUv;
        void main(){float tail=fract(uTime-vUv.x);float surge=1.-smoothstep(.015,.24,tail);
          float edge=pow(abs(sin(vUv.y*3.14159265)),.7);
          gl_FragColor=vec4(uColor*(1.+surge*uActive*.65),uStrength*edge*(.5+surge*.5));}`});
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve,160,.10,8,false),material);group.add(tube);
    const coreMaterial=new THREE.MeshBasicMaterial({color:color.clone().lerp(new THREE.Color(0xffffff),.08),transparent:true,opacity:0,depthWrite:false,toneMapped:false});
    coreMaterial.color.multiplyScalar(1.1);
    const core=new THREE.Mesh(new THREE.TubeGeometry(curve,160,.028,5,false),coreMaterial);group.add(core);
    const haloMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.025,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    const halo=new THREE.Mesh(new THREE.TubeGeometry(curve,160,.25,8,false),haloMaterial);group.add(halo);
    const arrows=new THREE.Group();group.add(arrows);
    const chevron=new THREE.Shape();chevron.moveTo(0,.34);chevron.lineTo(-.24,-.12);
    chevron.lineTo(-.12,-.20);chevron.lineTo(0,.04);chevron.lineTo(.12,-.20);chevron.lineTo(.24,-.12);chevron.closePath();
    const arrowGeometry=new THREE.ExtrudeGeometry(chevron,{depth:.045,bevelEnabled:false});arrowGeometry.rotateX(-Math.PI/2);
    const arrowMaterial=new THREE.MeshBasicMaterial({color:color.clone().lerp(new THREE.Color(0xffffff),.1),toneMapped:false});arrowMaterial.color.multiplyScalar(1.1);
    const count=Math.max(3,Math.min(14,Math.round(curve.getLength()/1.8)));
    for(let i=0;i<count;i++) arrows.add(new THREE.Mesh(arrowGeometry,arrowMaterial));
    arrows.visible=false;
    routes.set(key,{group,curve,uniforms,core,halo,arrows,started:0,active:false,visited:false});
  }
  for(const [id,p] of Object.entries(docks)) {
    const group=new THREE.Group();group.position.set(...p);parent.add(group);
    const rings=[];
    for(let i=0;i<2;i++) {
      const material=new THREE.MeshBasicMaterial({color:0x83ffda,transparent:true,opacity:.5,side:THREE.DoubleSide,
        depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});material.color.multiplyScalar(1.5);
      const ring=new THREE.Mesh(new THREE.RingGeometry(.15,.20,40),material);ring.rotation.x=-Math.PI/2;ring.position.y=.025*i;
      group.add(ring);rings.push(ring);
    }
    pulses.set(id,{group,rings});
  }
  return {
    setState(next) {
      state=next; const flow=getRouteState(next);active=flow.active;visited=flow.visited;
      for(const [key,route] of routes) {
        const isActive=key===active;
        if(isActive&&!route.active)route.started=time;
        route.active=isActive;route.visited=visited.includes(key);
        const secondary=secondaryRoutes.has(key);
        route.uniforms.uActive.value=isActive?1:0;
        route.uniforms.uStrength.value=isActive?1:route.visited?.65:secondary?.04:.14;
        route.core.material.opacity=isActive?.95:route.visited?.40:secondary?.015:.045;
        route.halo.material.opacity=isActive?.10:route.visited?.035:secondary?.004:.008;
        route.arrows.visible=isActive || (next.complete&&route.visited);
        route.arrows.children.forEach(arrow=>arrow.scale.setScalar(isActive?1:.62));
      }
    },
    update(now) {
      const delta=Math.max(0,now-previous);previous=now;
      if(state?.running || state?.complete)time+=delta;
      for(const route of routes.values()) {
        const travel=(time-route.started)*(route.active?.34:.08);
        route.uniforms.uTime.value=travel;
        if(route.arrows.visible)route.arrows.children.forEach((arrow,i)=>{
          const t=(travel+i/route.arrows.children.length)%1;
          arrow.position.copy(route.curve.getPointAt(t));arrow.position.y+=.07;
          arrow.quaternion.setFromUnitVectors(forward,route.curve.getTangentAt(t).normalize());
        });
      }
      for(const [id,pulse] of pulses) {
        const focus=id===state?.node;
        pulse.group.visible=focus || visited.some(edge=>edge.split(":").includes(id));
        pulse.rings.forEach((ring,i)=>{
          const phase=(time*.65+i*.5)%1;
          ring.scale.setScalar(focus&&!state?.complete?1+phase*3:.7+i*.4);
          ring.material.opacity=focus&&!state?.complete?(1-phase)*.75:.10;
        });
      }
    },
    getDiagnostics(){return {activeRoute:active,visitedRoutes:visited,routeCount:routes.size,flowTime:time,flowStyle:"volumetric lanes with directional arrows"};},
  };
}
