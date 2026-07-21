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

// 2. 우측 상단 XYZ 좌표축(Orientation Axis) Mini-Scene 생성
const axisContainer = document.getElementById('axis-container');
const axisScene = new THREE.Scene();
const axisCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
axisCamera.position.set(0, 0, 2.5);

const axisRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
axisRenderer.setSize(120, 120);
axisContainer.appendChild(axisRenderer.domElement);

// 텍스트 라벨(X, Y, Z) 생성용 헬퍼 함수 (Canvas -> Texture -> Sprite)
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

// 축 메쉬 빌드 (X: Red, Y: Green, Z: Blue + Text Labels)
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

  // X, Y, Z 글자 라벨 추가
  const labelX = createTextSprite('X', '#ef4444');
  labelX.position.set(1.0, 0, 0);

  const labelY = createTextSprite('Y', '#22c55e');
  labelY.position.set(0, 1.0, 0);

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
  nCore: 3.45,
  nCladd: 1.45,
  core: { w: 450, h: 220, l: 3000 },
  sub: { w: 1500, h: 400, l: 3000 },
  top: { w: 1500, h: 600, l: 3000 },
  laser: {
    wavelength: 1550,   // nm
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    pulseWidth: 30,     // nm (Spectral Width)
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

let coreMesh, subMesh, topMesh, laserBeamMesh, laserBeamMat;

// 4. 3D 메쉬 생성
function buildStructure() {
  if (coreMesh) { scene.remove(coreMesh); coreMesh.geometry.dispose(); }
  if (subMesh) { scene.remove(subMesh); subMesh.geometry.dispose(); }
  if (topMesh) { scene.remove(topMesh); topMesh.geometry.dispose(); }
  if (laserBeamMesh) { scene.remove(laserBeamMesh); laserBeamMesh.geometry.dispose(); }

  const coreW = params.core.w * SCALE;
  const coreH = params.core.h * SCALE;
  const coreL = params.core.l * SCALE;

  // Substrate
  const subW = params.sub.w * SCALE;
  const subH = params.sub.h * SCALE;
  const subL = params.sub.l * SCALE;
  subMesh = new THREE.Mesh(new THREE.BoxGeometry(subW, subH, subL), subMat);
  subMesh.position.set(0, -subH / 2, 0);
  scene.add(subMesh);

  // Core
  const coreGeo = new THREE.BoxGeometry(coreW, coreH, coreL);
  coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.set(0, coreH / 2, 0);

  const wireframeGeo = new THREE.EdgesGeometry(coreGeo);
  const wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
  coreMesh.add(wireframe);
  scene.add(coreMesh);

  // Upper Cladding
  const topW = params.top.w * SCALE;
  const topH = params.top.h * SCALE;
  const topL = params.top.l * SCALE;
  topMesh = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topL), topMat);
  topMesh.position.set(0, topH / 2, 0);
  scene.add(topMesh);

  // 5. 일자형 실린더 레이저 빔 생성
  buildStraightLaserBeam(coreW, coreH, coreL);
  
  // 그래프 업데이트
  drawSpectrumGraph();
}

// 일자형 스트림 레이저 빔 구성
function buildStraightLaserBeam(coreW, coreH, coreL) {
  const beamLength = 1.5; // 입사 빔 길이
  const beamRadius = 0.04;

  const beamGeo = new THREE.CylinderGeometry(beamRadius, beamRadius, beamLength, 32);
  
  // 일자형 레이저 전용 발광 메티리얼
  laserBeamMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: params.laser.intensity,
    transparent: true,
    opacity: 0.85
  });

  laserBeamMesh = new THREE.Mesh(beamGeo, laserBeamMat);

  // 회전 중심 및 위치 조정 (실린더 축을 Z축 방향으로 정렬)
  beamGeo.rotateX(Math.PI / 2);
  laserBeamMesh.position.set(0, coreH / 2, -coreL / 2 - beamLength / 2);

  // x, y, z 회전 각도 바인딩
  const radX = (params.laser.rotX * Math.PI) / 180;
  const radY = (params.laser.rotY * Math.PI) / 180;
  const radZ = (params.laser.rotZ * Math.PI) / 180;
  laserBeamMesh.rotation.set(radX, radY, radZ);

  scene.add(laserBeamMesh);
}

// 6. 파장 대비 세기 ($I$ vs $\lambda$) 스펙트럼 Canvas 그래프 그리기
function drawSpectrumGraph() {
  const canvas = document.getElementById('spectrum-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // 가우시안 변수
  const lambda0 = params.laser.wavelength;
  const deltaLambda = params.laser.pulseWidth;
  const I0 = params.laser.intensity;

  // 축 그리기
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 10);
  ctx.lineTo(30, h - 20);
  ctx.lineTo(w - 10, h - 20);
  ctx.stroke();

  // 라벨
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px sans-serif';
  ctx.fillText('I', 10, 15);
  ctx.fillText('λ (nm)', w - 35, h - 5);

  // 가우시안 곡선 계산 및 그리기
  ctx.strokeStyle = '#ef4444';
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();

  const minLambda = 700;
  const maxLambda = 1800;

  let started = false;
  for (let px = 30; px <= w - 10; px++) {
    // 픽셀을 파장(nm)으로 매핑
    const lam = minLambda + ((px - 30) / (w - 40)) * (maxLambda - minLambda);
    
    // Gaussian: I = I0 * exp( - (lam - lambda0)^2 / (2 * sigma^2) )
    const sigma = deltaLambda / 2.355; // FWHM 변환
    const intensity = I0 * Math.exp(-Math.pow(lam - lambda0, 2) / (2 * Math.pow(sigma, 2)));

    // y 픽셀 변환
    const py = (h - 20) - (intensity / 3.0) * (h - 30);

    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();

  // 하단 영역 색칠
  ctx.lineTo(w - 10, h - 20);
  ctx.lineTo(30, h - 20);
  ctx.closePath();
  ctx.fill();
}

buildStructure();

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

bindSlider('w-core-slider', params.core, 'w', 'w-core-val');
bindSlider('h-core-slider', params.core, 'h', 'h-core-val');
bindSlider('l-core-slider', params.core, 'l', 'l-core-val');

bindSlider('w-sub-slider', params.sub, 'w', 'w-sub-val');
bindSlider('h-sub-slider', params.sub, 'h', 'h-sub-val');
bindSlider('l-sub-slider', params.sub, 'l', 'l-sub-val');

bindSlider('w-top-slider', params.top, 'w', 'w-top-val');
bindSlider('h-top-slider', params.top, 'h', 'h-top-val');
bindSlider('l-top-slider', params.top, 'l', 'l-top-val');

bindSlider('wavelength-slider', params.laser, 'wavelength', 'wavelength-val');
bindSlider('rot-x-slider', params.laser, 'rotX', 'rot-x-val');
bindSlider('rot-y-slider', params.laser, 'rotY', 'rot-y-val');
bindSlider('rot-z-slider', params.laser, 'rotZ', 'rot-z-val');
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

// 8. 애니메이션 루프 (일자 빔의 주기적 밝기 변화 & 좌표축 연동)
let clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  // 일자형 레이저 빔이 주기에 따라 밝아졌다 어두워짐 (Sine 파동)
  if (laserBeamMat) {
    const freq = 10; // 파동 주파수
    const pulseFactor = 0.5 + 0.5 * Math.sin(t * freq);
    laserBeamMat.emissiveIntensity = params.laser.intensity * pulseFactor;
    laserBeamMat.opacity = 0.4 + 0.5 * pulseFactor;
  }

  // 메인 카메라의 회전 상태를 우측 상단 축 Gizmo 카메라에 연동
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