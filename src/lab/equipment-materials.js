import * as THREE from "three";

export function createEquipmentMaterials(time) {
  const textures = [], materials = [];
  const body = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uContainment: { value: 0 } },
    vertexShader: `varying vec3 vNormal,vView,vWorld;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);
        vView=normalize(-p.xyz);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float uTime,uContainment;varying vec3 vNormal,vView,vWorld;
      void main(){vec3 n=normalize(vNormal);float light=.35+.65*max(0.,dot(n,normalize(vec3(-.4,.8,.6))));
        float rim=pow(max(0.,1.-abs(dot(n,normalize(vView)))),3.);
        float scan=pow(.5+.5*sin(vWorld.y*2.4-uTime*.8),40.);
        float lines=step(.91,fract(vWorld.y*20.));
        vec3 color=mix(vec3(.003,.012,.028),vec3(.018,.095,.21),light);
        color+=vec3(.12,.48,.9)*(rim*.30+scan*.10+lines*.018);
        float grain=fract(sin(dot(floor(vWorld*95.),vec3(12.9898,78.233,37.719)))*43758.5453);
        color+=vec3(.03,.17,.24)*step(.97,grain)*(.18+scan*.6);
        if(uContainment>.5)color=dot(color,vec3(.2126,.7152,.0722))*vec3(1.8,.2,.24);
        gl_FragColor=vec4(color,.78+grain*.12);}`,
    transparent: true, depthWrite: true, side: THREE.FrontSide, toneMapped: false,
  });
  materials.push(body);
  const recess=new THREE.MeshBasicMaterial({color:0x041525,toneMapped:false});
  materials.push(recess);
  const containmentBody=body.clone();containmentBody.uniforms.uTime=time;
  containmentBody.uniforms.uContainment.value=1;
  const containmentRecess=new THREE.MeshBasicMaterial({color:0x210609,toneMapped:false});
  materials.push(containmentBody,containmentRecess);

  const leds = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uColor: { value: new THREE.Color(.08,.9,.46) } },
    vertexShader: `varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uTime;uniform vec3 uColor;varying vec3 p;void main(){float flicker=step(.35,sin(uTime*2.+p.y*11.+p.x*7.));
      gl_FragColor=vec4(uColor*(.6+flicker*.6),1.);}`,
    toneMapped: false,
  });
  materials.push(leds);
  const containmentLeds=leds.clone();containmentLeds.uniforms.uTime=time;
  containmentLeds.uniforms.uColor.value.setRGB(.95,.08,.11);materials.push(containmentLeds);

  const screens = new Map();
  function screen(kind = "telemetry") {
    if (screens.has(kind)) return screens.get(kind);
    const canvas = document.createElement("canvas");
    canvas.width = 384; canvas.height = 240;
    const c = canvas.getContext("2d");
    const containment=kind==='containment',alert=kind==='alert'||containment;
    c.fillStyle = containment?'#21060a':kind==='file'?'#286954':"#03121e"; c.fillRect(0,0,384,240);
    c.strokeStyle = containment?'#461521':kind==='file'?'#347a65':"#0b2e43"; c.lineWidth = 1;
    for(let y=38;y<230;y+=24){c.beginPath();c.moveTo(14,y);c.lineTo(370,y);c.stroke();}
    for(let x=14;x<375;x+=32){c.beginPath();c.moveTo(x,38);c.lineTo(x,224);c.stroke();}
    c.shadowColor=containment?'#f14658':kind==='file'?'#6fd5a7':'#269bca';c.shadowBlur=4;
    c.fillStyle = containment?'#ff9b95':"#74cbe5"; c.font = "14px monospace";
    c.fillText(kind === "file" ? "FILE ANALYSIS" : alert ? "ENDPOINT / ALERT" : "EVENT TELEMETRY",16,24);
    c.fillStyle="#1c4a64";c.fillRect(14,31,356,2);
    if(kind === "file") {
      c.strokeStyle="#99f5df";c.lineWidth=3;c.strokeRect(19,42,346,183);
      c.fillStyle="#a2ead2";
      for(let i=0;i<10;i++)c.fillRect(39+(i%3===1?14:0),59+i*15,196-(i%4)*28,3);
      c.fillStyle="#62c5b8";
      for(let i=0;i<8;i++)c.fillRect(276,59+i*18,61-i%3*12,2);
    } else {
      c.strokeStyle=containment?'#fc6268':"#55cbe8";c.lineWidth=2;
      c.beginPath();c.moveTo(20,151);
      for(let i=0;i<40;i++)c.lineTo(20+i*8.6,145-Math.sin(i*.8)*14-(i%11===0?36:0));c.stroke();
      for(let i=0;i<9;i++) {
        c.fillStyle=containment?(i%4===0?'#ffb59c':'#c5364a'):(i%4===0?"#67e6a4":"#337ea4");c.fillRect(22+i*38,188-(i%4)*9,23,22+(i%4)*9);
        c.fillStyle="#365e71";c.fillRect(25+i*38,221,18,2);
      }
      for(let i=0;i<4;i++){c.fillStyle="#23516a";c.fillRect(22,54+i*17,126-i%2*28,4);}
      if(alert) {
        if(!containment) {
          c.fillStyle='#03121e';c.fillRect(12,40,360,190);
          c.strokeStyle='#73e5ff';c.lineWidth=4;c.beginPath();c.moveTo(192,55);c.lineTo(278,195);c.lineTo(106,195);c.closePath();c.stroke();
          c.fillStyle='#aaf2ff';c.fillRect(188,102,8,43);c.fillRect(188,161,8,8);
        } else {
        c.strokeStyle=containment?'#ff9e97':"#73e5ff";c.lineWidth=3;c.beginPath();c.moveTo(272,47);c.lineTo(322,120);c.lineTo(222,120);c.closePath();c.stroke();
        c.fillStyle=containment?'#ffc2b4':"#aaf2ff";c.fillRect(269,73,6,22);c.fillRect(269,101,6,6);
        }
      } else {
        c.strokeStyle="#54c5e2";c.strokeRect(210,52,130,50);
        c.fillStyle="#74d8e8";for(let i=0;i<5;i++)c.fillRect(219,62+i*7,80+i%2*26,2);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uMap: { value: texture } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float uTime;uniform sampler2D uMap;varying vec2 vUv;
        void main(){vec3 color=texture2D(uMap,vUv).rgb;float band=pow(.5+.5*sin(vUv.y*8.-uTime*.8),25.);
          gl_FragColor=vec4(color*(.9+band*.35),1.);}`,
      toneMapped: false,
    });
    screens.set(kind,material); materials.push(material);
    return material;
  }
  return { body, recess, leds, containmentBody, containmentRecess, containmentLeds, screen,
    dispose() { textures.forEach(t=>t.dispose()); materials.forEach(m=>m.dispose()); } };
}
