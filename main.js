// 1. Scene, Camera, Renderer 및 Controls
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(3.5, 2.5, 4.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
gridHelper.position.y = -0.5;
scene.add(gridHelper);

// 2. 우측 하단 2D 단면 전기장 히트맵 Canvas 생성
function createCrossSectionCanvas() {
  let panel = document.getElementById('cross-section-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'cross-section-panel';
    panel.style.position = 'absolute';
    panel.style.bottom = '20px';
    panel.style.right = '20px';
    panel.style.padding = '12px';
    panel.style.background = 'rgba(15, 23, 42, 0.9)';
    panel.style.border = '1px solid #334155';
    panel.style.borderRadius = '8px';
    panel.style.color = '#f8fafc';
    panel.style.fontFamily = 'sans-serif';
    panel.style.fontSize = '12px';
    panel.style.zIndex = '100';

    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.style.color = '#38bdf8';
    title.textContent = 'Output Cross-Section |E(x,y)| Intensity';
    panel.appendChild(title);

    const cvs = document.createElement('canvas');
    cvs.id = 'cross-section-canvas';
    cvs.width = 220;
    cvs.height = 180;
    cvs.style.borderRadius = '4px';
    cvs.style.background = '#020617';
    panel.appendChild(cvs);

    const legend = document.createElement('div');
    legend.style.marginTop = '6px';
    legend.style.display = 'flex';
    legend.style.justifyContent = 'space-between';
    legend.style.fontSize = '10px';
    legend.style.color = '#94a3b8';
    legend.innerHTML = '<span>Weak (Light Blue)</span><span>Strong (Red)</span>';
    panel.appendChild(legend);

    document.body.appendChild(panel);
  }
}
createCrossSectionCanvas();

// 3. 파라미터 관리
const SCALE = 0.001;
let params = {
  nCore: 3.45,
  nCladd: 1.45,
  core1: { w: 450, h: 220, l: 3000 },
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
const coreMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
const subMat = new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.3 });
const topMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.15 });
const wireMat = new THREE.LineBasicMaterial({ color: 0xf8fafc });

let core1Mesh, subMesh, topMesh, laserBeamMesh, laserBeamMat;

function build3DScene() {
  if (core1Mesh) scene.remove(core1Mesh);
  if (subMesh) scene.remove(subMesh);
  if (topMesh) scene.remove(topMesh);
  if (laserBeamMesh) scene.remove(laserBeamMesh);

  const c1W = params.core1.w * SCALE;
  const c1H = params.core1.h * SCALE;
  const c1L = params.core1.l * SCALE;

  // A. Core 1
  const cGeo = new THREE.BoxGeometry(c1W, c1H, c1L);
  core1Mesh = new THREE.Mesh(cGeo, coreMat);
  core1Mesh.position.set(0, c1H / 2, 0);
  core1Mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(cGeo), wireMat));
  scene.add(core1Mesh);

  // B. Substrate & Top Cladding
  const subH = params.sub.h * SCALE;
  subMesh = new THREE.Mesh(new THREE.BoxGeometry(params.sub.w * SCALE, subH, c1L), subMat);
  subMesh.position.set(0, -subH / 2, 0);
  scene.add(subMesh);

  const topH = params.top.h * SCALE;
  topMesh = new THREE.Mesh(new THREE.BoxGeometry(params.top.w * SCALE, topH, c1L), topMat);
  topMesh.position.set(0, topH / 2, 0);
  scene.add(topMesh);

  // C. 외부 입사 레이저 빔 복원
  buildStraightLaserBeam(c1W, c1H, c1L);

  // D. 스펙트럼 그래프 복원
  drawSpectrumGraph();
}

function buildStraightLaserBeam(c1W, c1H, c1L) {
  const beamLength = 1.2;
  const beamRadius = Math.min(c1W, c1H) * 0.4;

  const beamGeo = new THREE.CylinderGeometry(beamRadius, beamRadius, beamLength, 32);
  beamGeo.translate(0, -beamLength / 2, 0);
  beamGeo.rotateX(Math.PI / 2);

  laserBeamMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: params.laser.intensity,
    transparent: true,
    opacity: 0.85
  });

  laserBeamMesh = new THREE.Mesh(beamGeo, laserBeamMat);
  scene.add(laserBeamMesh);
}

// 4. 스펙트럼 캔버스 그래프 복원 함수
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

  // 축 그리기
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

  // 가우시안 커브
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

build3DScene();

// 5. 슬라이더 이벤트 바인딩
function bindSlider(id, targetObj, key, displayId) {
  const slider = document.getElementById(id);
  const display = document.getElementById(displayId);
  if (!slider) return;
  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    targetObj[key] = val;
    if (display) display.textContent = val;
    build3DScene();
  });
}

bindSlider('w-core-slider', params.core1, 'w', 'w-core-val');
bindSlider('h-core-slider', params.core1, 'h', 'h-core-val');
bindSlider('l-core-slider', params.core1, 'l', 'l-core-val');

bindSlider('w-sub-slider', params.sub, 'w', 'w-sub-val');
bindSlider('h-sub-slider', params.sub, 'h', 'h-sub-val');
bindSlider('l-sub-slider', params.sub, 'l', 'l-sub-val');

bindSlider('w-top-slider', params.top, 'w', 'w-top-val');
bindSlider('h-top-slider', params.top, 'h', 'h-top-val');
bindSlider('l-top-slider', params.top, 'l', 'l-top-val');

bindSlider('wavelength-slider', params.laser, 'wavelength', 'wavelength-val');
bindSlider('rot-x-slider', params.laser, 'rotX', 'rot-x-val');
bindSlider('rot-y-slider', params.laser, 'rotY', 'rot-y-val');
bindSlider('pulse-width-slider', params.laser, 'pulseWidth', 'pulse-width-val');
bindSlider('intensity-slider', params.laser, 'intensity', 'intensity-val');

const nCoreSlider = document.getElementById('n-core-slider');
if (nCoreSlider) {
  nCoreSlider.addEventListener('input', (e) => {
    params.nCore = parseFloat(e.target.value);
    document.getElementById('n-core-val').textContent = params.nCore;
    build3DScene();
  });
}

const nCladdSlider = document.getElementById('n-cladd-slider');
if (nCladdSlider) {
  nCladdSlider.addEventListener('input', (e) => {
    params.nCladd = parseFloat(e.target.value);
    document.getElementById('n-cladd-val').textContent = params.nCladd;
    build3DScene();
  });
}

window.toggleLaserPanel = function() {
  const panel = document.getElementById('laser-panel');
  if (panel) {
    panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
  }
};

// 6. 출력 단면 전반사 위상변화 & 에바네센트 2D 전기장 계산 함수
function drawCrossSectionField(t) {
  const cvs = document.getElementById('cross-section-canvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const W = cvs.width;
  const H = cvs.height;

  ctx.clearRect(0, 0, W, H);

  const n1 = params.nCladd;
  const n2 = params.nCore;
  const incX = (params.laser.rotX * Math.PI) / 180;
  const incY = (params.laser.rotY * Math.PI) / 180;

  // 스넬의 법칙
  const refrX = Math.asin(Math.min(1.0, (n1 / n2) * Math.sin(incX)));
  const refrY = Math.asin(Math.min(1.0, (n1 / n2) * Math.sin(incY)));

  // 전반사 프레넬 위상 지연 (Phase Shift δ)
  const thetaX = Math.PI / 2 - refrY;
  let deltaPhaseX = 0;
  if (Math.sin(thetaX) > n1 / n2) {
    const num = Math.sqrt(n2 * n2 * Math.sin(thetaX) ** 2 - n1 * n1);
    const den = n2 * Math.cos(thetaX);
    deltaPhaseX = 2 * Math.atan(num / den);
  }

  // 전파 상수 및 에바네센트 감쇠 계수 γ (Gamma)
  const k0 = (2 * Math.PI) / (params.laser.wavelength * 1e-9);
  const beta = k0 * n2 * Math.cos(refrY);
  const gammaX = Math.sqrt(Math.max(0, beta * beta - (k0 * n1) ** 2)) * SCALE * 0.8;
  const gammaY = Math.sqrt(Math.max(0, beta * beta - (k0 * n1) ** 2)) * SCALE * 0.8;

  const coreW = params.core1.w;
  const coreH = params.core1.h;

  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = ((px - W / 2) / (W / 2)) * (coreW * 1.8);
      const y = (((H / 2) - py) / (H / 2)) * (coreH * 1.8);

      const absX = Math.abs(x);
      const absY = Math.abs(y);

      let fieldX = 0;
      let fieldY = 0;

      if (absX <= coreW / 2) {
        fieldX = Math.cos((Math.PI / coreW) * x - deltaPhaseX * 0.1);
      } else {
        const boundaryVal = Math.cos(Math.PI / 2 - deltaPhaseX * 0.1);
        fieldX = boundaryVal * Math.exp(-gammaX * (absX - coreW / 2));
      }

      if (absY <= coreH / 2) {
        fieldY = Math.cos((Math.PI / coreH) * y);
      } else {
        fieldY = Math.exp(-gammaY * (absY - coreH / 2));
      }

      const omega = 8.0;
      const phaseZ = beta * (params.core1.l * SCALE) - omega * t;
      const E_val = Math.abs(params.laser.intensity * fieldX * fieldY * Math.sin(phaseZ));

      // HSL Color Mapping (파란색 -> 주황색 -> 빨간색)
      const hue = (1.0 - Math.min(1.0, E_val)) * 200;
      const lightness = 40 + E_val * 20;

      const [r, g, b] = hslToRgb(hue / 360, 0.9, lightness / 100);

      const idx = (py * W + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // 코어 경계 라인 표시
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  const corePxW = (coreW / (coreW * 3.6)) * W * 2;
  const corePxH = (coreH / (coreH * 3.6)) * H * 2;
  ctx.strokeRect((W - corePxW) / 2, (H - corePxH) / 2, corePxW, corePxH);
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

// 7. 실시간 애니메이션 루프
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();
  const omega = 8.0;

  const c1H = params.core1.h * SCALE;
  const c1L = params.core1.l * SCALE;

  const incX = (params.laser.rotX * Math.PI) / 180;
  const incY = (params.laser.rotY * Math.PI) / 180;

  // 레이저 빔 위치 및 오일러 각도 회전 연동 복원
  if (laserBeamMesh) {
    laserBeamMesh.position.set(0, c1H / 2, -c1L / 2);
    laserBeamMesh.rotation.order = 'XYZ';
    laserBeamMesh.rotation.set(-incX, incY, 0);
  }

  if (laserBeamMat) {
    const pulseFactor = 0.5 + 0.5 * Math.sin(t * omega);
    laserBeamMat.emissiveIntensity = params.laser.intensity * pulseFactor;
    laserBeamMat.opacity = 0.4 + 0.5 * pulseFactor;
  }

  // 2D 단면 전기장 히트맵 갱신
  drawCrossSectionField(t);

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});