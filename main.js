// 1. Scene, Camera, Renderer 설정
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

// Light & Grid
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
gridHelper.position.y = -0.5;
scene.add(gridHelper);

// 2. 파라미터 상태 관리
const SCALE = 0.001; // 100nm = 0.1 unit

let params = {
  nCore: 3.45,
  nCladd: 1.45,
  core: { w: 450, h: 220, l: 3000 },
  sub: { w: 1500, h: 400, l: 3000 },
  top: { w: 1500, h: 600, l: 3000 },
  laser: {
    wavelength: 1550,   // nm
    rotX: 0,            // deg
    rotY: 0,            // deg
    rotZ: 0,            // deg
    pulseWidth: 300,    // nm
    intensity: 1.0      // a.u.
  }
};

// Material 정의
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

// Mesh 참조
let coreMesh, subMesh, topMesh, laserGroup, pointLight;

// 3. 전체 구조 및 레이저 3D 구축
function buildStructure() {
  if (coreMesh) { scene.remove(coreMesh); coreMesh.geometry.dispose(); }
  if (subMesh) { scene.remove(subMesh); subMesh.geometry.dispose(); }
  if (topMesh) { scene.remove(topMesh); topMesh.geometry.dispose(); }
  if (laserGroup) { scene.remove(laserGroup); }

  const coreW = params.core.w * SCALE;
  const coreH = params.core.h * SCALE;
  const coreL = params.core.l * SCALE;

  // A. Substrate
  const subW = params.sub.w * SCALE;
  const subH = params.sub.h * SCALE;
  const subL = params.sub.l * SCALE;
  const subGeo = new THREE.BoxGeometry(subW, subH, subL);
  subMesh = new THREE.Mesh(subGeo, subMat);
  subMesh.position.set(0, -subH / 2, 0);
  scene.add(subMesh);

  // B. Core
  const coreGeo = new THREE.BoxGeometry(coreW, coreH, coreL);
  coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.set(0, coreH / 2, 0);

  const wireframeGeo = new THREE.EdgesGeometry(coreGeo);
  const wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
  coreMesh.add(wireframe);
  scene.add(coreMesh);

  // C. Upper Cladding (Enclosing Core)
  const topW = params.top.w * SCALE;
  const topH = params.top.h * SCALE;
  const topL = params.top.l * SCALE;
  const topGeo = new THREE.BoxGeometry(topW, topH, topL);
  topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.position.set(0, topH / 2, 0);
  scene.add(topMesh);

  // D. Dynamic Laser Source Construction
  buildLaserSource(coreW, coreH, coreL);
}

// 4. 레이저 각도/파장/가우시안 펄스 반영 생성 함수
function buildLaserSource(coreW, coreH, coreL) {
  laserGroup = new THREE.Group();

  const inputZ = -coreL / 2; // 입력 단면 위치
  const pWidth = params.laser.pulseWidth * SCALE;
  const intensity = params.laser.intensity;

  // 파장에 따른 레이저 빔 가시광 색상 매핑 (1550nm 통신파장은 붉은색계열 시각화)
  const laserColor = params.laser.wavelength > 1000 ? 0xef4444 : 0x3b82f6;

  // A. 입사 가우시안 빔 가이드 링 (Pulse Width 비례 크기)
  const ringGeo = new THREE.RingGeometry(pWidth * 0.1, pWidth * 0.5, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: laserColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8 * intensity
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  laserGroup.add(ringMesh);

  // B. 입사 레이저 원뿔 빔 (Pulse Width 및 Intensity 반영)
  const coneLength = 0.8;
  const coneGeo = new THREE.ConeGeometry(pWidth * 0.6, coneLength, 32, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: laserColor,
    transparent: true,
    opacity: Math.min(0.4 * intensity, 0.9),
    side: THREE.DoubleSide
  });
  const coneMesh = new THREE.Mesh(coneGeo, coneMat);
  coneMesh.rotation.x = Math.PI / 2;
  coneMesh.position.set(0, 0, -coneLength / 2);
  laserGroup.add(coneMesh);

  // C. 발광 포인트 라이트
  pointLight = new THREE.PointLight(laserColor, 2 * intensity, 3);
  laserGroup.add(pointLight);

  // D. 위치 설정 (도파로 단면 입구 중심)
  laserGroup.position.set(0, coreH / 2, inputZ);

  // E. x, y, z 입사 각도(회전) 적용 (Degree -> Radian 변환)
  const radX = (params.laser.rotX * Math.PI) / 180;
  const radY = (params.laser.rotY * Math.PI) / 180;
  const radZ = (params.laser.rotZ * Math.PI) / 180;
  laserGroup.rotation.set(radX, radY, radZ);

  scene.add(laserGroup);
}

buildStructure();

// 5. 슬라이더 이벤트 바인딩
function bindSlider(id, targetObj, key, displayId, callback) {
  const slider = document.getElementById(id);
  const display = document.getElementById(displayId);
  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    targetObj[key] = val;
    display.textContent = val;
    if (callback) callback();
    else buildStructure();
  });
}

// Dimensions Sliders
bindSlider('w-core-slider', params.core, 'w', 'w-core-val');
bindSlider('h-core-slider', params.core, 'h', 'h-core-val');
bindSlider('l-core-slider', params.core, 'l', 'l-core-val');

bindSlider('w-sub-slider', params.sub, 'w', 'w-sub-val');
bindSlider('h-sub-slider', params.sub, 'h', 'h-sub-val');
bindSlider('l-sub-slider', params.sub, 'l', 'l-sub-val');

bindSlider('w-top-slider', params.top, 'w', 'w-top-val');
bindSlider('h-top-slider', params.top, 'h', 'h-top-val');
bindSlider('l-top-slider', params.top, 'l', 'l-top-val');

// Laser Controls Sliders
bindSlider('wavelength-slider', params.laser, 'wavelength', 'wavelength-val');
bindSlider('rot-x-slider', params.laser, 'rotX', 'rot-x-val');
bindSlider('rot-y-slider', params.laser, 'rotY', 'rot-y-val');
bindSlider('rot-z-slider', params.laser, 'rotZ', 'rot-z-val');
bindSlider('pulse-width-slider', params.laser, 'pulseWidth', 'pulse-width-val');
bindSlider('intensity-slider', params.laser, 'intensity', 'intensity-val');

// Refractive Index Sliders
document.getElementById('n-core-slider').addEventListener('input', (e) => {
  params.nCore = parseFloat(e.target.value);
  document.getElementById('n-core-val').textContent = params.nCore;
});

document.getElementById('n-cladd-slider').addEventListener('input', (e) => {
  params.nCladd = parseFloat(e.target.value);
  document.getElementById('n-cladd-val').textContent = params.nCladd;
});

// Presets
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

// Collapsible Panel Toggle
window.toggleLaserPanel = function() {
  const panel = document.getElementById('laser-panel');
  if (panel.style.display === 'none' || panel.style.display === '') {
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
};

// 6. Animation Loop (Gaussian Pulse Motion)
let clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  if (laserGroup) {
    const time = clock.getElapsedTime();
    const intensity = params.laser.intensity;
    
    // Intensity에 비례하는 Pulse 확산 및 점멸 효과
    const scalePulse = 1 + 0.15 * Math.sin(time * 8);
    laserGroup.children[0].scale.set(scalePulse, scalePulse, 1);
    
    if (pointLight) {
      pointLight.intensity = (1.5 + 0.5 * Math.sin(time * 8)) * intensity;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});