// 1. Main Scene, Camera, Renderer 설정
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(3.5, 2.5, 4.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
gridHelper.position.y = -0.5;
scene.add(gridHelper);

// 2. 우측 상단 XYZ 좌표축 Mini-Scene
const axisContainer = document.getElementById('axis-container');
const axisScene = new THREE.Scene();
const axisCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
axisCamera.position.set(0, 0, 2.5);

const axisRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
axisRenderer.setSize(120, 120);
axisContainer.appendChild(axisRenderer.domElement);

function createTextSprite(text, colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.font = 'Bold 44px sans-serif';
  ctx.fillStyle = colorHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.35, 0.35, 1);
  return sprite;
}

function createAxesGizmo() {
  const group = new THREE.Group();
  const dirX = new THREE.Vector3(1, 0, 0);
  const dirY = new THREE.Vector3(0, 1, 0);
  const dirZ = new THREE.Vector3(0, 0, 1);
  const origin = new THREE.Vector3(0, 0, 0);

  const arrowX = new THREE.ArrowHelper(dirX, origin, 0.8, 0xef4444, 0.2, 0.15); 
  const arrowY = new THREE.ArrowHelper(dirY, origin, 0.8, 0x22c55e, 0.2, 0.15); 
  const arrowZ = new THREE.ArrowHelper(dirZ, origin, 0.8, 0x3b82f6, 0.2, 0.15); 

  group.add(arrowX);
  group.add(arrowY);
  group.add(arrowZ);

  const labelX = createTextSprite('X', '#22c55e');
  labelX.position.set(0, 1.0, 0);

  const labelY = createTextSprite('Y', '#ef4444');
  labelY.position.set(1.0, 0, 0);

  const labelZ = createTextSprite('Z', '#3b82f6');
  labelZ.position.set(0, 0, 1.0);

  group.add(labelX);
  group.add(labelY);
  group.add(labelZ);

  return group;
}

const axisGizmo = createAxesGizmo();
axisScene.add(axisGizmo);

// 3. 파라미터 상태
const SCALE = 0.001;

let params = {
  waveguideCount: 1,  // 도파로 개수 (1 또는 2)
  gap: 200,           // nm (도파로 1과 2 사이의 간격)
  nCore: 3.45,
  nCladd: 1.45,
  core1: { w: 450, h: 220, l: 3000 },
  core2: { w: 450, h: 220, l: 3000 },
  sub: { w: 2500, h: 400, l: 3000 },
  top: { w: 2500, h: 600, l: 3000 },
  laser: {
    wavelength: 1550,
    rotX: 0,
    rotY: 0,
    pulseWidth: 30,
    intensity: 1.0
  }
};

// Material
const coreMat = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  roughness: 0.2,
  metalness: 0.8,
  emissive: 0x0284c7,
  emissiveIntensity: 0.3
});

// 도파로 2 메쉬용 동일 재질
const core2Mat = new THREE.MeshStandardMaterial({
  color: 0xf43f5e, // 도파로 2 시각적 구분을 위한 약간의 로즈 톤 색상
  roughness: 0.2,
  metalness: 0.8,
  emissive: 0xe11d48,
  emissiveIntensity: 0.3
});

const subMat = new THREE.MeshStandardMaterial({
  color: 0x64748b,
  transparent: true,
  opacity: 0.35,
  roughness: 0.1
});

const topMat = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  transparent: true,
  opacity: 0.25,
  roughness: 0.1
});

const wireframeMat = new THREE.LineBasicMaterial({ color: 0xf8fafc, linewidth: 1 });

let core1Mesh, core2Mesh, subMesh, topMesh, laserBeamMesh, laserBeamMat;

// 4. 3D 메쉬 생성
function buildStructure() {
  if (core1Mesh) { scene.remove(core1Mesh); core1Mesh.geometry.dispose(); }
  if (core2Mesh) { scene.remove(core2Mesh); core2Mesh.geometry.dispose(); }
  if (subMesh) { scene.remove(subMesh); subMesh.geometry.dispose(); }
  if (topMesh) { scene.remove(topMesh); topMesh.geometry.dispose(); }
  if (laserBeamMesh) { scene.remove(laserBeamMesh); laserBeamMesh.geometry.dispose(); }

  const c1W = params.core1.w * SCALE;
  const c1H = params.core1.h * SCALE;
  const c1L = params.core1.l * SCALE;

  const gap = params.gap * SCALE;

  // 도파로 위치 계산 (도파로 1은 왼쪽, 도파로 2는 오른쪽 배치)
  let posX1 = 0;
  let posX2 = 0;

  if (params.waveguideCount === 2) {
    const c2W = params.core2.w * SCALE;
    // 두 코어 중심간의 거리 = w1/2 + gap + w2/2
    const totalSpan = c1W + gap + c2W;
    posX1 = -(totalSpan / 2) + (c1W / 2);
    posX2 = (totalSpan / 2) - (c2W / 2);
  }

  // A. Core 1
  const core1Geo = new THREE.BoxGeometry(c1W, c1H, c1L);
  core1Mesh = new THREE.Mesh(core1Geo, coreMat);
  core1Mesh.position.set(posX1, c1H / 2, 0);

  const wfGeo1 = new THREE.EdgesGeometry(core1Geo);
  core1Mesh.add(new THREE.LineSegments(wfGeo1, wireframeMat));
  scene.add(core1Mesh);

  // B. Core 2 (도파로 2개 모드일 경우 동일한 Y 평면 상에 독립적 크기로 배치)
  if (params.waveguideCount === 2) {
    const c2W = params.core2.w * SCALE;
    const c2H = params.core2.h * SCALE;
    const c2L = params.core2.l * SCALE;

    const core2Geo = new THREE.BoxGeometry(c2W, c2H, c2L);
    core2Mesh = new THREE.Mesh(core2Geo, core2Mat);
    core2Mesh.position.set(posX2, c2H / 2, 0);

    const wfGeo2 = new THREE.EdgesGeometry(core2Geo);
    core2Mesh.add(new THREE.LineSegments(wfGeo2, wireframeMat));
    scene.add(core2Mesh);
  }

  // C. Substrate
  const subW = params.sub.w * SCALE;
  const subH = params.sub.h * SCALE;
  const subL = params.sub.l * SCALE;
  subMesh = new THREE.Mesh(new THREE.BoxGeometry(subW, subH, subL), subMat);
  subMesh.position.set(0, -subH / 2, 0);
  scene.add(subMesh);

  // D. Upper Cladding
  const topW = params.top.w * SCALE;
  const topH = params.top.h * SCALE;
  const topL = params.top.l * SCALE;
  topMesh = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topL), topMat);
  topMesh.position.set(0, topH / 2, 0);
  scene.add(topMesh);

  // E. 레이저 빔 (항상 도파로 1의 입구 중앙에 조사)
  buildStraightLaserBeam(c1W, c1H, c1L, posX1);
  
  drawSpectrumGraph();
}

// 레이저 빔 생성 (도파로 1의 입구에 조준)
function buildStraightLaserBeam(c1W, c1H, c1L, posX1) {
  const beamLength = 1.5; 
  const beamRadius = 0.04;

  const beamGeo = new THREE.CylinderGeometry(beamRadius, beamRadius, beamLength, 32);
  
  laserBeamMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: params.laser.intensity,
    transparent: true,
    opacity: 0.85
  });

  laserBeamMesh = new THREE.Mesh(beamGeo, laserBeamMat);

  beamGeo.rotateX(Math.PI / 2);
  laserBeamMesh.position.set(posX1, c1H / 2, -c1L / 2 - beamLength / 2);

  const radX = (params.laser.rotX * Math.PI) / 180;
  const radY = (params.laser.rotY * Math.PI) / 180;

  laserBeamMesh.rotation.order = 'XYZ';
  laserBeamMesh.rotation.set(-radX, radY, 0);

  scene.add(laserBeamMesh);
}

// 5. 스펙트럼 Canvas 그래프
function drawSpectrumGraph() {
  const canvas = document.getElementById('spectrum-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const lambda0 = params.laser.wavelength;
  const deltaLambda = params.laser.pulseWidth;
  const I0 = params.laser.intensity;

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 10);
  ctx.lineTo(30, h - 20);
  ctx.lineTo(w - 10, h - 20);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px sans-serif';
  ctx.fillText('I', 10, 15);
  ctx.fillText('λ (nm)', w - 35, h - 5);

  ctx.strokeStyle = '#ef4444';
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();

  const minLambda = 700;
  const maxLambda = 1800;

  let started = false;
  for (let px = 30; px <= w - 10; px++) {
    const lam = minLambda + ((px - 30) / (w - 40)) * (maxLambda - minLambda);
    const sigma = deltaLambda / 2.355;
    const intensity = I0 * Math.exp(-Math.pow(lam - lambda0, 2) / (2 * Math.pow(sigma, 2)));

    const py = (h - 20) - (intensity / 3.0) * (h - 30);

    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();

  ctx.lineTo(w - 10, h - 20);
  ctx.lineTo(30, h - 20);
  ctx.closePath();
  ctx.fill();
}

buildStructure();

// 6. 도파로 개수 변경 토글 함수
window.setWaveguideCount = function(count) {
  params.waveguideCount = count;

  const btn1 = document.getElementById('btn-wg-1');
  const btn2 = document.getElementById('btn-wg-2');
  const wg2Panel = document.getElementById('wg2-panel');

  if (count === 1) {
    btn1.classList.add('active');
    btn2.classList.remove('active');
    wg2Panel.style.display = 'none';
  } else {
    btn2.classList.add('active');
    btn1.classList.remove('active');
    wg2Panel.style.display = 'block';
  }

  buildStructure();
};

// 7. 슬라이더 이벤트
function bindSlider(id, targetObj, key, displayId) {
  const slider = document.getElementById(id);
  const display = document.getElementById(displayId);
  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    targetObj[key] = val;
    display.textContent = val;
    buildStructure();
  });
}

// Core 1
bindSlider('w-core-slider', params.core1, 'w', 'w-core-val');
bindSlider('h-core-slider', params.core1, 'h', 'h-core-val');
bindSlider('l-core-slider', params.core1, 'l', 'l-core-val');

// Core 2 & Gap
bindSlider('gap-slider', params, 'gap', 'gap-val');
bindSlider('w-core2-slider', params.core2, 'w', 'w-core2-val');
bindSlider('h-core2-slider', params.core2, 'h', 'h-core2-val');
bindSlider('l-core2-slider', params.core2, 'l', 'l-core2-val');

// Claddings
bindSlider('w-sub-slider', params.sub, 'w', 'w-sub-val');
bindSlider('h-sub-slider', params.sub, 'h', 'h-sub-val');
bindSlider('l-sub-slider', params.sub, 'l', 'l-sub-val');

bindSlider('w-top-slider', params.top, 'w', 'w-top-val');
bindSlider('h-top-slider', params.top, 'h', 'h-top-val');
bindSlider('l-top-slider', params.top, 'l', 'l-top-val');

// Laser Controls
bindSlider('wavelength-slider', params.laser, 'wavelength', 'wavelength-val');
bindSlider('rot-x-slider', params.laser, 'rotX', 'rot-x-val');
bindSlider('rot-y-slider', params.laser, 'rotY', 'rot-y-val');
bindSlider('pulse-width-slider', params.laser, 'pulseWidth', 'pulse-width-val');
bindSlider('intensity-slider', params.laser, 'intensity', 'intensity-val');

document.getElementById('n-core-slider').addEventListener('input', (e) => {
  params.nCore = parseFloat(e.target.value);
  document.getElementById('n-core-val').textContent = params.nCore;
});

document.getElementById('n-cladd-slider').addEventListener('input', (e) => {
  params.nCladd = parseFloat(e.target.value);
  document.getElementById('n-cladd-val').textContent = params.nCladd;
});

window.setCoreMaterial = function(name, nVal) {
  params.nCore = nVal;
  document.getElementById('n-core-slider').value = nVal;
  document.getElementById('n-core-val').textContent = nVal;
};

window.setCladdMaterial = function(name, nVal) {
  params.nCladd = nVal;
  document.getElementById('n-cladd-slider').value = nVal;
  document.getElementById('n-cladd-val').textContent = nVal;
};

window.toggleLaserPanel = function() {
  const panel = document.getElementById('laser-panel');
  panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
};

// 8. 애니메이션 루프
let clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  if (laserBeamMat) {
    const freq = 10;
    const pulseFactor = 0.5 + 0.5 * Math.sin(t * freq);
    laserBeamMat.emissiveIntensity = params.laser.intensity * pulseFactor;
    laserBeamMat.opacity = 0.4 + 0.5 * pulseFactor;
  }

  axisGizmo.quaternion.copy(camera.quaternion).invert();

  controls.update();
  renderer.render(scene, camera);
  axisRenderer.render(axisScene, axisCamera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});