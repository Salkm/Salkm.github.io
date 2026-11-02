import * as THREE from 'three';

export function createProjectionBeams(height, time, origin) {
  const starts=[], ends=[], coordinates=[], seeds=[];
  const triangle=[[0,-1],[0,1],[1,-1],[1,-1],[0,1],[1,1]];
  for(let i=0;i<72;i++) {
    const angle=i*2.39996, radius=Math.sqrt((i+1)/72);
    const end=[Math.cos(angle)*16.4*radius,height-.04,Math.sin(angle)*8.1*radius];
    for(const [t,side] of triangle) {
      starts.push(origin.x,origin.y+.16,origin.z);ends.push(...end);coordinates.push(t,side);seeds.push(i/72);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(starts,3));
  geometry.setAttribute('end',new THREE.Float32BufferAttribute(ends,3));
  geometry.setAttribute('beamUv',new THREE.Float32BufferAttribute(coordinates,2));
  geometry.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,1));
  // Camera-facing ribbons have a soft cross-section rather than a hard wire edge.
  const material=new THREE.ShaderMaterial({
    uniforms:{uTime:time},
    vertexShader:`attribute vec3 end;attribute vec2 beamUv;attribute float seed;
      varying vec2 vUv;varying float vSeed;
      void main(){vec4 start=modelViewMatrix*vec4(position,1.);vec4 finish=modelViewMatrix*vec4(end,1.);
        vec2 direction=normalize(finish.xy-start.xy);vec2 normal=vec2(-direction.y,direction.x);
        vec4 p=mix(start,finish,beamUv.x);float width=(.02+.28*beamUv.x)*(.65+seed);
        p.xy+=normal*beamUv.y*width;vUv=beamUv;vSeed=seed;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform float uTime;varying vec2 vUv;varying float vSeed;
      void main(){float soft=exp(-vUv.y*vUv.y*5.);float fade=pow(clamp(1.-vUv.x,0.,1.),1.15);
        float pulse=.82+.18*sin(uTime*.65+vSeed*20.);float rays=.06+.10*vSeed;
        gl_FragColor=vec4(.035,.40,1.2,soft*fade*pulse*rays);}`,
    transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending,toneMapped:false,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
  return mesh;
}

export function createProjectionTraces(time) {
  const positions=[];
  for(let i=0;i<56;i++) {
    const column=i%14,angle=column*2.399;
    positions.push(Math.sin(angle)*17,.4+(i*.618034%1)*10.5,Math.cos(angle)*8);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const material=new THREE.ShaderMaterial({
    uniforms:{uTime:time,uScale:{value:1}},
    vertexShader:`uniform float uScale;varying float vSeed;
      void main(){vSeed=fract(sin(dot(position,vec3(12.9,78.2,37.7)))*43758.5);
        gl_PointSize=(14.+vSeed*22.)*uScale;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uTime;varying float vSeed;
      void main(){vec2 p=gl_PointCoord-.5;
        float trace=exp(-p.x*p.x*700.-p.y*p.y*15.);
        float core=exp(-dot(p,p)*1600.);float pulse=.75+.25*sin(uTime*.6+vSeed*30.);
        gl_FragColor=vec4(.025,.33,1.,(trace*.18+core*.60)*pulse);}`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
  });
  const points=new THREE.Points(geometry,material);
  points.onBeforeRender=function(renderer){material.uniforms.uScale.value=Math.max(.55,Math.min(1,renderer.domElement.clientWidth/760));};
  return points;
}
