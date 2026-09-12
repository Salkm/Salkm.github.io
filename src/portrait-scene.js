import * as THREE from "three";
import { getOwnedPortraitRect, getOwnedVideoRect } from './portrait-framing.js';
import { createPortraitParticles } from './portrait-particles.js';
import { portraitSampling } from './portrait-sampling.js';
import appleLogoUrl from './assets/apple.svg?url';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uCover;
  uniform vec2 uOrigin;
  uniform vec2 uRegion;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform vec2 uPan;
  uniform float uTime;
  uniform float uScan;
  uniform float uBaked;
  uniform float uPoster;
  uniform float uBlackPoint;
  uniform float uShift;
  uniform float uEnergy;
  uniform float uPhase;
  uniform float uFollow;
  uniform vec2 uFaceCenter;
  uniform vec2 uFaceRadius;
  varying vec2 vUv;
  ${portraitSampling}
  float portraitLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  vec4 samplePortrait(vec2 p) {
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return vec4(0.0);
    return vec4(samplePortraitRgb(p), texture2D(uTexture, p).a);
  }
  void main() {
    vec2 local = vec2((vUv.x-uRegion.x)/uRegion.y, vUv.y);
    local.y += uFollow;
    if (local.x < 0.0 || local.x > 1.0) discard;
    vec2 source = (local - 0.5) * uCover + uOrigin + uPan;
    source.x += uShift;
    vec2 lean = uPointer - vec2(.5);
    source = (source-.5)*(1.0+.022*length(lean))+.5;
    source += lean*vec2(.016,.013);
    vec4 texel = samplePortrait(source);
    texel.rgb = max(texel.rgb-vec3(uBlackPoint),vec3(0.0))/(1.0-uBlackPoint);
    float lum = portraitLuma(texel.rgb);
    vec3 neutral = mix(vec3(.003,.012,.004),vec3(.28,.84,.34),pow(lum,.7));
    float iso = fract(lum*18.0 + local.y*120.0);
    float contour = 1.0-smoothstep(.025,.085,abs(iso-.5));
    vec3 base = mix(neutral*(.73+.27*contour),texel.rgb,uBaked);
    vec2 texelStep = uCover / max(uResolution*uRegion.y,vec2(1.0));
    float edge = abs(portraitLuma(samplePortrait(source+vec2(texelStep.x,0)).rgb)-lum);
    edge += abs(portraitLuma(samplePortrait(source+vec2(0,texelStep.y)).rgb)-lum);
    float beam = exp(-pow((local.y-fract(uTime*.12))*90.0,2.0));
    vec3 scan = base*.55 + vec3(.09,.8,.29)*(contour*.13+min(edge*7.0,.7)+beam*.13)*smoothstep(.005,.12,lum);
    vec3 color = mix(base,scan,uScan);
    if (uBaked < .5) {
      float face = 1.0-smoothstep(.65,1.1,length((source-uFaceCenter)/uFaceRadius));
      float tone = pow(lum,.56);
      float etch = 1.0-smoothstep(.025,.10,abs(fract(tone*16.0+source.y*72.0)-.5));
      vec3 ink = mix(vec3(.002,.009,.001),vec3(.37,.78,.26),tone);
      vec3 dotted = ink*mix(.065,.68,face);
      dotted += ink*etch*(.15+face*.14);
      vec3 contours = ink*(.07+etch*.66)+ink*face*.15;
      float etchedPhase = max(smoothstep(.05,.95,uPhase),uScan*.85);
      float cloud = smoothstep(.95,1.95,uPhase);
      color = mix(dotted,contours,etchedPhase)*(1.0-cloud);
    }
    float alpha = texel.a*(uPoster>.5 ? 1.0 : clamp(local.x/.2,0.0,1.0));
    if (lum < .0006) alpha = 0.0;
    gl_FragColor = vec4(color,alpha);
    if (uBaked > .5 && uPoster < .5) gl_FragColor.rgb = pow(max(color,vec3(0.0)),vec3(1.0/2.2));
    else {
      #include <colorspace_fragment>
    }
  }
`;

function fieldGeometry(columns, rows) {
  const points = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const y = row / (rows - 1);
      points.push(column / columns, y, 0, (column + 1) / columns, y, 0);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

const fieldVertex = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uCover;
  uniform vec2 uOrigin;
  uniform vec2 uRegion;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform vec2 uPan;
  uniform float uShift;
  uniform float uBlackPoint;
  uniform float uEnergy;
  uniform float uFieldEnabled;
  uniform float uPixelRatio;
  uniform float uBaked;
  uniform float uFollow;
  varying vec2 vFieldUv;
  varying float vAlpha;
  ${portraitSampling}
  void main() {
    vec2 source = (position.xy-.5)*uCover+uOrigin+uPan+vec2(uShift,0.0);
    vec2 lean = uPointer-vec2(.5);
    source = (source-.5)*(1.0+.022*length(lean))+.5+lean*vec2(.016,.013);
    vec3 raw = samplePortraitRgb(source);
    float lum = max(dot(raw,vec3(.299,.587,.114))-uBlackPoint,0.0)/(1.0-uBlackPoint);
    float signal = uBaked > .5 ? lum : pow(lum,.56);
    float aspect = uResolution.x*uRegion.y/uResolution.y;
    vec2 relative = (position.xy-vec2(0.0,uFollow)-uPointer)*vec2(aspect,1.0);
    float influence = exp(-dot(relative,relative)*10.0);
    vec2 tangent = vec2(-relative.y,relative.x)/max(length(relative),.0001)/vec2(aspect,1.0);
    vec2 displaced = position.xy+tangent*influence*(.010+uEnergy*.035)*(.25+signal*1.5);
    displaced.y -= influence*.006*(.25+signal);
    vec2 screen = vec2(uRegion.x+displaced.x*uRegion.y,displaced.y-uFollow);
    vFieldUv = source;
    // Gate in perceptual brightness: the owned footage is much darker than the scan reference.
    vAlpha = influence*smoothstep(.04,.30,signal)*(.30+uEnergy*.45)*uFieldEnabled*mix(.85,1.0,uBaked);
    vAlpha *= clamp(position.x/.2,0.0,1.0);
    if (source.x<0.0 || source.x>1.0 || source.y<0.0 || source.y>1.0) vAlpha=0.0;
    gl_Position = vec4(screen*2.0-1.0,0.0,1.0);
  }
`;
const fieldFragment = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uBlackPoint;
  uniform float uBaked;
  varying vec2 vFieldUv;
  varying float vAlpha;
  ${portraitSampling}
  void main() {
    if (vAlpha < .01) discard;
    vec3 color=max(samplePortraitRgb(vFieldUv)-vec3(uBlackPoint),vec3(0.0))/(1.0-uBlackPoint);
    if (uBaked < .5) color=vec3(.28,.84,.34)*pow(dot(color,vec3(.2126,.7152,.0722)),.56);
    gl_FragColor=vec4(color,vAlpha);
    if (uBaked > .5) gl_FragColor.rgb=pow(color,vec3(1.0/2.2));
    else {
      #include <colorspace_fragment>
    }
  }
`;

export async function createPortfolioScene({
  canvas,
  reducedMotion = false,
  onReady = () => {},
  source = "/portrait-fallback.png",
  videoSource = null,
  videoOnMobile = true,
  ownedVideoFraming = false,
  bakedScan = false,
}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !bakedScan,
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
    throw new Error(
      "Portrait shader compilation failed: " +
        [
          gl.getProgramInfoLog(program),
          gl.getShaderInfoLog(vertex),
          gl.getShaderInfoLog(fragment),
        ]
          .filter(Boolean)
          .join(" | "),
    );
  };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;
  let image;
  try {
    image = await new THREE.TextureLoader().loadAsync(source);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  image.colorSpace = THREE.SRGBColorSpace;
  // Composite the emblem in source UVs so it shares the portrait's scan and dissolve.
  const lidLogo = ownedVideoFraming && !bakedScan
    ? await new THREE.TextureLoader().loadAsync(appleLogoUrl).catch(() => null)
    : null;
  const uniforms = {
    uTexture: { value: image },
    uVideoSrgb: { value: 0 },
    uLidLogo: { value: lidLogo || image },
    uLidLogoTransform: { value: new THREE.Matrix3() },
    uLidLogoEnabled: { value: lidLogo ? 1 : 0 },
    uFaceCenter: { value: new THREE.Vector2(.61, .73) },
    uFaceRadius: { value: new THREE.Vector2(.21, .27) },
    uCover: { value: new THREE.Vector2(1, 1) },
    uOrigin: { value: new THREE.Vector2(.5, .5) },
    uRegion: { value: new THREE.Vector2(0, 1) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector2(.5, .5) },
    uPan: { value: new THREE.Vector2() },
    uTime: { value: 0 },
    uScan: { value: 0 },
    uBaked: { value: bakedScan ? 1 : 0 },
    uPoster: { value: 0 },
    uBlackPoint: { value: 0 },
    uShift: { value: 0 },
    uEnergy: { value: 0 },
    uHoverEnabled: { value: 0 },
    uFieldEnabled: { value: 1 },
    uPixelRatio: { value: 1 },
    uPhase: { value: 0 },
    uFollow: { value: 0 },
    uPointScale: { value: 1 },
  };
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(geometry, material));
  const scanGeometry = fieldGeometry(128, 140);
  const fieldMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: fieldVertex, fragmentShader: fieldFragment,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  });
  const scanLines = new THREE.LineSegments(scanGeometry, fieldMaterial);
  scanLines.frustumCulled = false;
  scanLines.renderOrder = 1;
  scene.add(scanLines);
  const particles = bakedScan ? null : createPortraitParticles(uniforms);
  if (particles) scene.add(particles);
  const cleanups = [];
  let width = 0,
    height = 0,
    regionLeft = 0,
    mobile = false,
    disposed = false,
    ready = false,
    frame = 0,
    frames = 0,
    lastTime = 0,
    elapsed = 0;
  let paused = reducedMotion,
    visible = !document.hidden,
    intersecting = true,
    contextLost = false,
    error = null;
  let progress = 0,
    renderedProgress = 0,
    mode = "automation",
    modeBlend = 0,
    energy = 0,
    lastPointerTime = 0,
    pointerDown = null;
  let video = null,
    videoTexture = null,
    videoFrameHandle = null,
    videoStatus = videoSource ? "deferred" : "none";
  let sourceWidth = image.image.width,
    sourceHeight = image.image.height;
  const targetPointer = new THREE.Vector2(.5, .5);
  let lastPointerEvent = 0;
  const previousPointer = new THREE.Vector2();
  const oldStyle = {
    cursor: canvas.style.cursor,
    touchAction: canvas.style.touchAction,
  };
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    cleanups.push(() => target.removeEventListener(type, fn, options));
  };
  const canRender = () =>
    !disposed &&
    !contextLost &&
    visible &&
    intersecting &&
    width > 0 &&
    height > 0;
  const automatic = () => !paused && !reducedMotion;
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
  function request() {
    if (!frame && canRender()) frame = requestAnimationFrame(render);
  }
  function syncVideo() {
    if (!video) return;
    if (videoStatus === 'failed') {
      video.pause();
      return;
    }
    if (automatic() && canRender() && (!mobile || (videoOnMobile && !bakedScan)))
      video.play().catch((cause) => {
        if (!disposed && videoStatus !== 'failed' && cause.name !== 'AbortError') videoStatus = "playback-blocked";
      });
    else video.pause();
  }
  function resize() {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    regionLeft = rect.left - canvas.parentElement.getBoundingClientRect().left;
    mobile = window.innerWidth <= 900;
    if (!width || !height) return;
    if (videoSource && !video && !reducedMotion && (!mobile || (videoOnMobile && !bakedScan))) ensureVideo();
    const useVideo = videoTexture && !reducedMotion && (!mobile || (videoOnMobile && !bakedScan));
    uniforms.uTexture.value = useVideo ? videoTexture : image;
    uniforms.uVideoSrgb.value = useVideo && !bakedScan ? 1 : 0;
    if (lidLogo) {
      // Center on the lid's diagonals, accounting for the still image's cropped left edge.
      const [w, h, cx, cy, xx, xy, yx, yy] = useVideo && ownedVideoFraming
        ? [1280, 720, 370, 514, 43, 2, -14, -51]
        : [1254, 1254, 146, 886, 74, 4, -24, -88];
      uniforms.uLidLogoTransform.value.set(
        xx / w, yx / w, (cx - (xx + yx) / 2) / w,
        -xy / h, -yy / h, 1 - (cy - (xy + yy) / 2) / h,
        0, 0, 1,
      ).invert();
    }
    uniforms.uFaceCenter.value.set(useVideo && ownedVideoFraming ? .555 : .61, .73);
    uniforms.uFaceRadius.value.set(useVideo && ownedVideoFraming ? .12 : .21, .27);
    sourceWidth = useVideo ? video.videoWidth : image.image.width;
    sourceHeight = useVideo ? video.videoHeight : image.image.height;
    uniforms.uShift.value = useVideo && bakedScan ? -0.1 : 0;
    uniforms.uBlackPoint.value = useVideo && bakedScan ? 0.055 : 0;
    renderer.setPixelRatio(
      Math.min(devicePixelRatio || 1, bakedScan ? 2 : mobile ? 1.25 : 1.5),
    );
    renderer.setSize(width, height, false);
    uniforms.uResolution.value.set(width, height);
    uniforms.uPixelRatio.value = renderer.getPixelRatio();
    uniforms.uHoverEnabled.value = mobile || reducedMotion ? 0 : 1;
    uniforms.uFieldEnabled.value = uniforms.uHoverEnabled.value;
    uniforms.uPoster.value = mobile ? 1 : 0;
    scanLines.visible = !mobile;
    if (mobile || reducedMotion) {
      targetPointer.set(.5, .5);
      uniforms.uPointer.value.copy(targetPointer);
      if (mobile) uniforms.uPan.value.set(0, 0);
      energy = 0;
      lastPointerEvent = 0;
    }
    uniforms.uRegion.value.set(0, 1);
    const windowAspect = width / height,
      sourceAspect = sourceWidth / sourceHeight;
    const overscan = mobile ? 1 : 0.97;
    uniforms.uCover.value.set(
      Math.min(1, windowAspect / sourceAspect) * overscan,
      Math.min(1, sourceAspect / windowAspect) * overscan,
    );
    if (!bakedScan) {
      const still = getOwnedPortraitRect(width, height, mobile);
      const portrait = useVideo && ownedVideoFraming ? getOwnedVideoRect(width, height, mobile, sourceAspect) : still;
      uniforms.uCover.value.set(width / portrait.width, height / portrait.height);
      uniforms.uOrigin.value.set((width / 2 - portrait.left) / portrait.width, 1 - (height / 2 - portrait.top) / portrait.height);
      uniforms.uPointScale.value = THREE.MathUtils.clamp(still.width / 870.4, .55, 1.25);
    }
    syncVideo();
    request();
  }
  function render(now) {
    frame = 0;
    if (!canRender()) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;
    if (automatic()) {
      elapsed += dt;
      if (!mobile && elapsed-lastPointerTime > 2.6) {
        targetPointer.set(.5+Math.sin(elapsed*.21)*.22,.48+Math.sin(elapsed*.16+1.3)*.16);
      }
      const ease = Math.min(dt * 5.5, 1);
      renderedProgress += (progress - renderedProgress) * ease;
      modeBlend += ((mode === "security" ? 1 : 0) - modeBlend) * ease;
      uniforms.uPointer.value.lerp(targetPointer, ease);
      energy = Math.max(0, energy - dt * 1.6);
    }
    uniforms.uTime.value = elapsed;
    uniforms.uScan.value = modeBlend;
    uniforms.uPhase.value = bakedScan || reducedMotion ? 0 : renderedProgress * 3;
    uniforms.uFollow.value = bakedScan || reducedMotion ? 0 : renderedProgress * .6;
    uniforms.uEnergy.value = energy;
    uniforms.uFieldEnabled.value = uniforms.uHoverEnabled.value * (1 - THREE.MathUtils.smoothstep(uniforms.uPhase.value, .6, 1.7));
    try {
      renderer.render(scene, camera);
      frames++;
      if (!ready) {
        ready = true;
        onReady();
      }
    } catch (cause) {
      error = String(cause);
      stop();
      return;
    }
    const staticPoster = mobile && uniforms.uTexture.value === image && mode === 'automation' && modeBlend < .001 && Math.abs(progress-renderedProgress) < .001;
    if (automatic() && !staticPoster) request();
  }
  function ensureVideo() {
    videoStatus = "loading";
    video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    listen(
      video,
      "loadeddata",
      () => {
        if (disposed || videoStatus === 'failed') return;
        videoTexture = new THREE.VideoTexture(video);
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        videoTexture.minFilter = THREE.LinearMipmapLinearFilter;
        videoTexture.generateMipmaps = true;
        if (video.requestVideoFrameCallback) {
          const onVideoFrame = () => {
            if (disposed || videoStatus === 'failed') return;
            request();
            videoFrameHandle = video.requestVideoFrameCallback(onVideoFrame);
          };
          videoFrameHandle = video.requestVideoFrameCallback(onVideoFrame);
        }
        videoStatus = "ready";
        resize();
        syncVideo();
        request();
      },
      { once: true },
    );
    listen(video, "error", () => {
      if (disposed || videoStatus === 'failed') return;
      videoStatus = "failed";
      video.pause();
      if (videoFrameHandle !== null) video.cancelVideoFrameCallback(videoFrameHandle);
      videoFrameHandle = null;
      videoTexture?.dispose();
      videoTexture = null;
      resize();
    });
    listen(video, "seeked", request);
    video.src = videoSource;
    video.load();
  }
  canvas.style.cursor = "grab";
  canvas.style.touchAction = "pan-y";
  listen(canvas, "pointerdown", (event) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    pointerDown = event.pointerId;
    previousPointer.set(event.clientX, event.clientY);
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  });
  listen(
    canvas,
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      if (pointerDown === event.pointerId) {
        uniforms.uPan.value.x = THREE.MathUtils.clamp(
          uniforms.uPan.value.x -
            ((event.clientX - previousPointer.x) / width) * 0.3,
          -0.12,
          0.12,
        );
        uniforms.uPan.value.y = THREE.MathUtils.clamp(
          uniforms.uPan.value.y +
            ((event.clientY - previousPointer.y) / height) * 0.3,
          -0.08,
          0.08,
        );
        previousPointer.set(event.clientX, event.clientY);
        request();
      }
    },
    { passive: true },
  );
  listen(window, 'pointermove', event => {
    if (event.pointerType === 'touch' || !automatic() || mobile) return;
    const rect = canvas.getBoundingClientRect();
    const x = THREE.MathUtils.clamp(((event.clientX-rect.left)/width-uniforms.uRegion.value.x)/uniforms.uRegion.value.y,-.15,1.15);
    const y = THREE.MathUtils.clamp(1-(event.clientY-rect.top)/height,-.15,1.15);
    if (lastPointerEvent) {
      const speed = Math.hypot(x-targetPointer.x,y-targetPointer.y)/Math.max((event.timeStamp-lastPointerEvent)/1000,.008);
      energy = Math.min(1,energy+Math.min(1,speed*.55)*.5);
    }
    lastPointerEvent = event.timeStamp;
    lastPointerTime = elapsed;
    targetPointer.set(x,y);
  }, { passive:true });
  function endDrag(event) {
    if (pointerDown !== event.pointerId) return;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    pointerDown = null;
    canvas.style.cursor = "grab";
  }
  listen(canvas, "pointerup", endDrag);
  listen(canvas, "pointercancel", endDrag);
  listen(canvas, "lostpointercapture", endDrag);
  listen(document, "visibilitychange", () => {
    visible = !document.hidden;
    stop();
    syncVideo();
    request();
  });
  listen(canvas, "webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    stop();
    syncVideo();
  });
  listen(canvas, "webglcontextrestored", () => {
    contextLost = false;
    material.needsUpdate = true;
    fieldMaterial.needsUpdate = true;
    if (particles) particles.material.needsUpdate = true;
    image.needsUpdate = true;
    resize();
    syncVideo();
  });
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver(([entry]) => {
    intersecting = entry.isIntersecting;
    stop();
    syncVideo();
    request();
  });
  intersection.observe(canvas);
  resize();
  render(0);
  return {
    setMode(value) {
      if (!["automation", "security"].includes(value) || disposed) return;
      mode = value;
      if (!automatic()) modeBlend = mode === "security" ? 1 : 0;
      request();
    },
    setPaused(value) {
      if (disposed) return;
      paused = Boolean(value);
      stop();
      syncVideo();
      if (!paused) request();
    },
    setReducedMotion(value) {
      if (disposed) return;
      reducedMotion = Boolean(value);
      stop();
      resize();
      syncVideo();
      if (reducedMotion) {
        stop();
        render(performance.now());
      } else if (automatic()) request();
    },
    setScrollProgress(value) {
      if (!Number.isFinite(value) || disposed) return;
      progress = THREE.MathUtils.clamp(value, 0, 1);
      if (paused) return;
      if (reducedMotion) renderedProgress = progress;
      request();
    },
    reset() {
      if (disposed) return;
      elapsed = progress = renderedProgress = energy = lastPointerTime = 0;
      uniforms.uPan.value.set(0, 0);
      lastPointerEvent = 0;
      targetPointer.set(.5, .5);
      uniforms.uPointer.value.copy(targetPointer);
      if (video) video.currentTime = 0;
      stop();
      request();
    },
    getDiagnostics() {
      return {
        ready,
        disposed,
        error,
        contextLost,
        paused,
        reducedMotion,
        visible,
        intersecting,
        mobile,
        mode,
        modeBlend,
        renderedFrames: frames,
        elapsed,
        scrollProgress: progress,
        renderedProgress,
        drawCalls: renderer.info.render.calls,
        representation: "image-video-webgl",
        skeletal: false,
        source,
        videoSource,
        videoOnMobile,
        laptopEmblem: lidLogo ? 'apple' : null,
        hoverEnabled: uniforms.uHoverEnabled.value > .5,
        videoStatus,
        videoTime: video?.currentTime || 0,
        videoPaused: video?.paused ?? true,
        motionSource: uniforms.uTexture.value === videoTexture ? "video" : "image",
        bakedScan,
        size: { width, height, pixelRatio: renderer.getPixelRatio() },
        sourceSize: { width: sourceWidth, height: sourceHeight },
        imageFraming: bakedScan ? null : getOwnedPortraitRect(width, height, mobile),
        videoFraming: ownedVideoFraming && uniforms.uTexture.value === videoTexture ? getOwnedVideoRect(width, height, mobile, sourceWidth / sourceHeight) : null,
        portraitWindow: {
          left: regionLeft,
          width,
          height,
        },
        states: bakedScan ? ["portrait", "scan"] : ["dotted-portrait", "contours", "point-cloud", "dissolve"],
        scrollBehavior: bakedScan ? "continuous-portrait" : "four-state-dissolve",
        portraitPhase: uniforms.uPhase.value,
        scrollFollowPixels: uniforms.uFollow.value * height,
        portraitPoints: particles?.geometry.attributes.position.count || 0,
        cursorField: { type: 'continuous-scan-lines', rows: 140, segments: scanGeometry.attributes.position.count/2, energy, pointer: uniforms.uPointer.value.toArray() },
        pan: uniforms.uPan.value.toArray(),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      cleanups.forEach((fn) => fn());
      observer.disconnect();
      intersection.disconnect();
      if (video) {
        if (videoFrameHandle !== null) video.cancelVideoFrameCallback(videoFrameHandle);
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      videoTexture?.dispose();
      image.dispose();
      lidLogo?.dispose();
      geometry.dispose();
      material.dispose();
      scanGeometry.dispose(); fieldMaterial.dispose();
      particles?.geometry.dispose(); particles?.material.dispose();
      renderer.dispose();
      canvas.style.cursor = oldStyle.cursor;
      canvas.style.touchAction = oldStyle.touchAction;
    },
  };
}
