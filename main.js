// 1. Scene, Camera, Renderer 초기화
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

// 조명
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
  wavelength: 1550, // nm
  core: { w: 450, h: 220, l: 3000 },
  sub: { w: 1500, h: 400, l: 3000 },
  top: { w: 1500, h: 600, l: 3000 } // Upper cladding은 코어 높이보다 높아야 완전히 감쌈
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

// Mesh 참조 변수
let coreMesh, subMesh, topMesh, laserGroup;

// 3. 3D 도파로 구조 및 레이저 광원 구축 함수
function buildStructure() {
  if (coreMesh) { scene.remove(coreMesh); coreMesh.geometry.dispose(); }
  if (subMesh) { scene.remove(subMesh); subMesh.geometry.dispose(); }
  if (topMesh) { scene.remove(topMesh); topMesh.geometry.dispose(); }
  if (laserGroup) { scene.remove(laserGroup); }

  const coreW = params.core.w * SCALE;
  const coreH = params.core.h * SCALE;
  const coreL = params.core.l * SCALE;

  // A. Lower Cladding (BOX / Substrate)
  const subW = params.sub.w * SCALE;
  const subH = params.sub.h * SCALE;
  const subL = params.sub.l * SCALE;
  const subGeo = new THREE.BoxGeometry(subW, subH, subL);
  subMesh = new THREE.Mesh(subGeo, subMat);
  subMesh.position.set(0, -subH / 2, 0);
  scene.add(subMesh);

  // B. Silicon Core (상부 클래딩 내부 바닥에 위치)
  const coreGeo = new THREE.BoxGeometry(coreW, coreH, coreL);
  coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.set(0, coreH / 2, 0);

  const wireframeGeo = new THREE.EdgesGeometry(coreGeo);
  const wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
  coreMesh.add(wireframe);
  scene.add(coreMesh);

  // C. Upper Cladding (Core 상단 및 측면을 완전히 둘러싸도록 배치)
  const topW = params.top.w * SCALE;
  const topH = params.top.h * SCALE;
  const topL = params.top.l * SCALE;
  const topGeo = new THREE.BoxGeometry(topW, topH, topL);
  topMesh = new THREE.Mesh(topGeo, topMat);
  // Upper Cladding의 바닥이 Substrate 상단(y=0)에 맞춰지도록 배치하면 코어를 감싸게 됨
  topMesh.position.set(0, topH / 2, 0);
  scene.add(topMesh);

  // D. Input Laser Beam (입력단 z = -L/2 위치에 생성)
  buildLaserBeam(coreW, coreH, coreL);
}

// 레이저 입력 광원 생성 함수
function buildLaserBeam(coreW, coreH, coreL) {
  laserGroup = new THREE.Group();

  const inputZ = -coreL / 2; // 입력 단면 위치

  // 1. 입사 레이저 빔 링 (가우시안 빔 프로파일 표현)
  const ringGeo = new THREE.RingGeometry(coreW * 0.2, coreW * 0.8, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xef4444, // 붉은색 레이저 광원
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.set(0, coreH / 2, inputZ);
  laserGroup.add(ringMesh);

  // 2. 외부에서 도파로 단면으로 들어오는 레이저 원뿔 빔 (입사 과정 시각화)
  const coneLength = 0.8;
  const coneGeo = new THREE.ConeGeometry(coreW * 1.2, coneLength, 32, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xf87171,
    transparent: true,
    opacity: 0.3,
    wireframe: false,
    side: THREE.DoubleSide
  });
  const coneMesh = new THREE.Mesh(coneGeo, coneMat);
  coneMesh.rotation.x = Math.PI / 2; // Z축 방향으로 회전
  coneMesh.position.set(0, coreH / 2, inputZ - coneLength / 2);
  laserGroup.add(coneMesh);

  // 3. 입력단 중심 발광 점 (Point Light)
  const laserLight = new THREE.PointLight(0xef4444, 2, 2);
  laserLight.position.set(0, coreH / 2, inputZ);
  laserGroup.add(laserLight);

  scene.add(laserGroup);
}

buildStructure();

// 4. 슬라이더 바인딩
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

// Core Dimensions
bindSlider('w-core-slider', params.core, 'w', 'w-core-val');
bindSlider('h-core-slider', params.core, 'h', 'h-core-val');
bindSlider('l-core-slider', params.core, 'l', 'l-core-val');

// Lower Cladding
bindSlider('w-sub-slider', params.sub, 'w', 'w-sub-val');
bindSlider('h-sub-slider', params.sub, 'h', 'h-sub-val');
bindSlider('l-sub-slider', params.sub, 'l', 'l-sub-val');

// Upper Cladding
bindSlider('w-top-slider', params.top, 'w', 'w-top-val');
bindSlider('h-top-slider', params.top, 'h', 'h-top-val');
bindSlider('l-top-slider', params.top, 'l', 'l-top-val');

// Laser Wavelength
document.getElementById('wavelength-slider').addEventListener('input', (e) => {
  params.wavelength = parseFloat(e.target.value);
  document.getElementById('wavelength-val').textContent = params.wavelength;
});

// Refractive Index Sliders
document.getElementById('n-core-slider').addEventListener('input', (e) => {
  params.nCore = parseFloat(e.target.value);
  document.getElementById('n-core-val').textContent = params.nCore;
});

document.getElementById('n-cladd-slider').addEventListener('input', (e) => {
  params.nCladd = parseFloat(e.target.value);
  document.getElementById('n-cladd-val').textContent = params.nCladd;
});

// 물질 프리셋 버튼 함수
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

// Render Loop & Laser Pulse Animation
let clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  // 레이저 입력단에 맥동(Pulse) 애니메이션 효과 주기
  if (laserGroup) {
    const time = clock.getElapsedTime();
    const scalePulse = 1 + 0.1 * Math.sin(time * 6);
    laserGroup.children[0].scale.set(scalePulse, scalePulse, 1); // Ring pulse
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