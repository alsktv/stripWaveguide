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
  core: { w: 450, h: 220, l: 3000 },
  sub: { w: 1500, h: 400, l: 3000 },
  top: { w: 1500, h: 400, l: 3000 }
};

// Material 객체
const coreMat = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  roughness: 0.2,
  metalness: 0.8,
  emissive: 0x0284c7,
  emissiveIntensity: 0.2
});

const subMat = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  transparent: true,
  opacity: 0.35,
  roughness: 0.1
});

const topMat = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0,
  transparent: true,
  opacity: 0.2,
  roughness: 0.1
});

const wireframeMat = new THREE.LineBasicMaterial({ color: 0xf8fafc, linewidth: 1 });

// Mesh 참조
let coreMesh, subMesh, topMesh;

// 3. 3D 도파로 구조 재구축 함수
function buildStructure() {
  if (coreMesh) { scene.remove(coreMesh); coreMesh.geometry.dispose(); }
  if (subMesh) { scene.remove(subMesh); subMesh.geometry.dispose(); }
  if (topMesh) { scene.remove(topMesh); topMesh.geometry.dispose(); }

  // A. Lower Cladding (Substrate)
  const subW = params.sub.w * SCALE;
  const subH = params.sub.h * SCALE;
  const subL = params.sub.l * SCALE;
  const subGeo = new THREE.BoxGeometry(subW, subH, subL);
  subMesh = new THREE.Mesh(subGeo, subMat);
  subMesh.position.set(0, -subH / 2, 0);
  scene.add(subMesh);

  // B. Core
  const coreW = params.core.w * SCALE;
  const coreH = params.core.h * SCALE;
  const coreL = params.core.l * SCALE;
  const coreGeo = new THREE.BoxGeometry(coreW, coreH, coreL);
  coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.set(0, coreH / 2, 0);

  const wireframeGeo = new THREE.EdgesGeometry(coreGeo);
  const wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
  coreMesh.add(wireframe);
  scene.add(coreMesh);

  // C. Upper Cladding (Cover)
  const topW = params.top.w * SCALE;
  const topH = params.top.h * SCALE;
  const topL = params.top.l * SCALE;
  const topGeo = new THREE.BoxGeometry(topW, topH, topL);
  topMesh = new THREE.Mesh(topGeo, topMat);
  // Upper Cladding은 Core 위쪽(Core 상단 + Upper Cladding 절반 높이)에 배치
  topMesh.position.set(0, coreH + topH / 2, 0);
  scene.add(topMesh);
}

buildStructure();

// 4. 슬라이더 이벤트 바인딩
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

// Refractive Index Sliders
document.getElementById('n-core-slider').addEventListener('input', (e) => {
  params.nCore = parseFloat(e.target.value);
  document.getElementById('n-core-val').textContent = params.nCore;
});

document.getElementById('n-cladd-slider').addEventListener('input', (e) => {
  params.nCladd = parseFloat(e.target.value);
  document.getElementById('n-cladd-val').textContent = params.nCladd;
});

// 5. 물질 프리셋 버튼 함수
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

// Render Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});