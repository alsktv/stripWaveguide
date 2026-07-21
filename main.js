// 1. 기본 Scene, Camera, Renderer 설정
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(3, 2, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// 2. OrbitControls 설정
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// 3. 조명 (Lighting)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
gridHelper.position.y = -0.5;
scene.add(gridHelper);

// 4. 스케일 변수 및 초기 실측 파라미터 (단위: nm)
const SCALE = 0.001; // 100nm = 0.1 unit

let coreDimensions = {
  width: 450,   // nm
  height: 220,  // nm
  length: 3000  // nm
};

// Material 선언 (재사용)
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
  opacity: 0.3,
  roughness: 0.1,
  metalness: 0.1
});

const wireframeMat = new THREE.LineBasicMaterial({ color: 0xe0f2fe, linewidth: 1.5 });

// 5. Mesh 객체 참조용 변수
let coreMesh, subMesh, wireframeMesh;

// 6. 도파로 생성/갱신 함수
function buildWaveguide() {
  // 기존 Mesh가 있다면 씬에서 제거 및 메모리 해제
  if (coreMesh) {
    scene.remove(coreMesh);
    coreMesh.geometry.dispose();
  }
  if (subMesh) {
    scene.remove(subMesh);
    subMesh.geometry.dispose();
  }

  const w = coreDimensions.width * SCALE;
  const h = coreDimensions.height * SCALE;
  const L = coreDimensions.length * SCALE;

  // Substrate (하부 클래딩) - 코어 가로 폭에 맞춰 비례하여 확장
  const subWidth = Math.max(w * 3, 1500 * SCALE);
  const subHeight = 400 * SCALE;
  
  const subGeo = new THREE.BoxGeometry(subWidth, subHeight, L);
  subMesh = new THREE.Mesh(subGeo, subMat);
  subMesh.position.set(0, -subHeight / 2, 0);
  scene.add(subMesh);

  // Silicon Core
  const coreGeo = new THREE.BoxGeometry(w, h, L);
  coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.set(0, h / 2, 0);

  // Core Wireframe
  const wireframeGeo = new THREE.EdgesGeometry(coreGeo);
  wireframeMesh = new THREE.LineSegments(wireframeGeo, wireframeMat);
  coreMesh.add(wireframeMesh);

  scene.add(coreMesh);
}

// 최초 3D 빌드
buildWaveguide();

// 7. 슬라이더 DOM 이벤트 바인딩
const widthSlider = document.getElementById('width-slider');
const heightSlider = document.getElementById('height-slider');
const lengthSlider = document.getElementById('length-slider');

const widthVal = document.getElementById('width-val');
const heightVal = document.getElementById('height-val');
const lengthVal = document.getElementById('length-val');

widthSlider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  coreDimensions.width = val;
  widthVal.textContent = val;
  buildWaveguide();
});

heightSlider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  coreDimensions.height = val;
  heightVal.textContent = val;
  buildWaveguide();
});

lengthSlider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  coreDimensions.length = val;
  lengthVal.textContent = val;
  buildWaveguide();
});

// 8. 애니메이션 및 창 크기 변경 처리
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