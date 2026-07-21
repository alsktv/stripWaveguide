// ==========================================
// 1. Scene, Camera, Renderer & Controls
// ==========================================
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

// ==========================================
// 2. 우측 하단 2D 단면 전기장 히트맵 Canvas
// ==========================================
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
    title.style.marginBottom = '4px';
    title.style.color = '#38bdf8';
    title.textContent = 'Output Cross-Section |E(x,y)| Intensity';
    panel.appendChild(title);

    const modeInfo = document.createElement('div');
    modeInfo.id = 'mode-info-text';
    modeInfo.style.fontSize = '11px';
    modeInfo.style.marginBottom = '6px';
    modeInfo.style.color = '#a7f3d0';
    modeInfo.textContent = 'Active Modes: TE00';
    panel.appendChild(modeInfo);

    const cvs = document.createElement('canvas');
    cvs.id = 'cross-section-canvas';
    cvs.width = 240;
    cvs.height = 200;
    cvs.style.borderRadius = '4px';
    cvs.style.background = '#020617';
    panel.appendChild(cvs);

    const legend = document.createElement('div');
    legend.style.marginTop = '6px';
    legend.style.display = 'flex';
    legend.style.justifyContent = 'space-between';
    legend.style.fontSize = '10px';
    legend.style.color = '#94a3b8';
    legend.innerHTML = '<span>Weak Evanescent (Blue)</span><span>Strong Core (Red)</span>';
    panel.appendChild(legend);

    document.body.appendChild(panel);
  }
}
createCrossSectionCanvas();

// ==========================================
// 3. 글로벌 파라미터 상태 관리
// ==========================================
const SCALE = 0.001;
let params = {
  waveguideCount: 1,
  nCore1: 3.45,
  nCore2: 3.45,
  nCladd: 1.45,
  core1: { w: 450, h: 220, l: 3000 },
  core2: { w: 450, h: 220, l: 3000 },
  gap: 200,
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

// 재질 정의
const core1Mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
const core2Mat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.4 });
const subMat = new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.3 });
const topMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.15 });
const wireMat = new THREE.LineBasicMaterial({ color: 0xf8fafc });

let core1Mesh, core2Mesh, subMesh, topMesh, laserBeamMesh, laserBeamMat;

// ==========================================
// 4. 3D 메쉬 생성 및 렌더링
// ==========================================
function build3DScene() {
  if (core1Mesh) scene.remove(core1Mesh);
  if (core2Mesh) scene.remove(core2Mesh);
  if (subMesh) scene.remove(subMesh);
  if (topMesh) scene.remove(topMesh);
  if (laserBeamMesh) scene.remove(laserBeamMesh);

  const c1W = params.core1.w * SCALE;
  const c1H = params.core1.h * SCALE;
  const c1L = params.core1.l * SCALE;

  const c2W = params.core2.w * SCALE;
  const c2H = params.core2.h * SCALE;
  const c2L = params.core2.l * SCALE;

  const gap = params.gap * SCALE;

  let x1 = 0;
  let x2 = 0;
  if (params.waveguideCount === 2) {
    x1 = -(c1W / 2 + gap / 2);
    x2 = (c2W / 2 + gap / 2);
  }

  // A. Core 1
  const cGeo1 = new THREE.BoxGeometry(c1W, c1H, c1L);
  core1Mesh = new THREE.Mesh(cGeo1, core1Mat);
  core1Mesh.position.set(x1, c1H / 2, 0);
  core1Mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(cGeo1), wireMat));
  scene.add(core1Mesh);

  // B. Core 2 (도파로 2개일 때만 생성)
  if (params.waveguideCount === 2) {
    const cGeo2 = new THREE.BoxGeometry(c2W, c2H, c2L);
    core2Mesh = new THREE.Mesh(cGeo2, core2Mat);
    core2Mesh.position.set(x2, c2H / 2, 0);
    core2Mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(cGeo2), wireMat));
    scene.add(core2Mesh);
  }

  // C. Substrate & Top Cladding
  const maxL = Math.max(c1L, params.waveguideCount === 2 ? c2L : 0);
  const subH = params.sub.h * SCALE;
  subMesh = new THREE.Mesh(new THREE.BoxGeometry(params.sub.w * SCALE, subH, maxL), subMat);
  subMesh.position.set(0, -subH / 2, 0);
  scene.add(subMesh);

  const topH = params.top.h * SCALE;
  topMesh = new THREE.Mesh(new THREE.BoxGeometry(params.top.w * SCALE, topH, maxL), topMat);
  topMesh.position.set(0, topH / 2, 0);
  scene.add(topMesh);

  // D. Core 1 입구 방향 빔
  buildStraightLaserBeam(x1, c1W, c1H, c1L);

  // E. 스펙트럼 차트 갱신
  drawSpectrumGraph();
}

function buildStraightLaserBeam(x1, c1W, c1H, c1L) {
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
  laserBeamMesh.position.set(x1, c1H / 2, -c1L / 2);
  scene.add(laserBeamMesh);
}

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

build3DScene();

// ==========================================
// 5. HTML 이벤트 헬퍼 및 바인딩
// ==========================================

// HTML 인라인 onclick 함수 선언
window.setWaveguideCount = function(count) {
  params.waveguideCount = count;

  const btn1 = document.getElementById('btn-wg-1');
  const btn2 = document.getElementById('btn-wg-2');
  const wg2Panel = document.getElementById('wg2-panel');

  if (count === 1) {
    if (btn1) btn1.classList.add('active');
    if (btn2) btn2.classList.remove('active');
    if (wg2Panel) wg2Panel.style.display = 'none';
  } else {
    if (btn1) btn1.classList.remove('active');
    if (btn2) btn2.classList.add('active');
    if (wg2Panel) wg2Panel.style.display = 'block';
  }

  build3DScene();
};

window.setCoreMaterial = function(name, nVal) {
  params.nCore1 = nVal;
  params.nCore2 = nVal;
  const slider = document.getElementById('n-core-slider');
  const disp = document.getElementById('n-core-val');
  if (slider) slider.value = nVal;
  if (disp) disp.textContent = nVal.toFixed(2);
  build3DScene();
};

window.setCladdMaterial = function(name, nVal) {
  params.nCladd = nVal;
  const slider = document.getElementById('n-cladd-slider');
  const disp = document.getElementById('n-cladd-val');
  if (slider) slider.value = nVal;
  if (disp) disp.textContent = nVal.toFixed(2);
  build3DScene();
};

window.toggleLaserPanel = function() {
  const panel = document.getElementById('laser-panel');
  if (panel) {
    panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
  }
};

// 슬라이더 바인딩
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

// Laser
bindSlider('wavelength-slider', params.laser, 'wavelength', 'wavelength-val');
bindSlider('rot-x-slider', params.laser, 'rotX', 'rot-x-val');
bindSlider('rot-y-slider', params.laser, 'rotY', 'rot-y-val');
bindSlider('pulse-width-slider', params.laser, 'pulseWidth', 'pulse-width-val');
bindSlider('intensity-slider', params.laser, 'intensity', 'intensity-val');

// Refractive Index Sliders
const nCoreSlider = document.getElementById('n-core-slider');
if (nCoreSlider) {
  nCoreSlider.addEventListener('input', (e) => {
    params.nCore1 = parseFloat(e.target.value);
    document.getElementById('n-core-val').textContent = params.nCore1;
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

// ==========================================
// 6. 단일 코어 기준 공간 전계 계산
// ==========================================
function computeSingleCoreAmplitude(x, y, coreW, coreH, maxM, maxN, alpha, incX, incY) {
  const absX = Math.abs(x);
  const absY = Math.abs(y);

  let totalSpatialAmplitude = 0;
  let totalWeight = 0;

  for (let m = 0; m <= maxM; m++) {
    for (let n = 0; n <= maxN; n++) {
      const weight = Math.exp(-0.3 * (m * Math.abs(incX * 10) + n * Math.abs(incY * 10)));
      
      const kx_m = ((m + 1) * Math.PI * 0.72) / coreW;
      const ky_n = ((n + 1) * Math.PI * 0.72) / coreH;

      const modeX_in = (m % 2 === 0) ? Math.cos(kx_m * x) : Math.sin(kx_m * x);
      const modeY_in = (n % 2 === 0) ? Math.cos(ky_n * y) : Math.sin(ky_n * y);

      const Eb_x_raw = (m % 2 === 0) ? Math.cos(kx_m * (coreW / 2)) : Math.sin(kx_m * (coreW / 2));
      const Eb_y_raw = (n % 2 === 0) ? Math.cos(ky_n * (coreH / 2)) : Math.sin(ky_n * (coreH / 2));

      const signX = (m % 2 === 1 && x < 0) ? -1 : 1;
      const signY = (n % 2 === 1 && y < 0) ? -1 : 1;

      const Eb_x = signX * Eb_x_raw;
      const Eb_y = signY * Eb_y_raw;

      let amp_mn = 0;

      if (absX <= coreW / 2 && absY <= coreH / 2) {
        amp_mn = modeX_in * modeY_in;
      } else if (absX > coreW / 2 && absY <= coreH / 2) {
        const decayX = Eb_x * Math.exp(-alpha * (absX - coreW / 2));
        amp_mn = decayX * modeY_in;
      } else if (absX <= coreW / 2 && absY > coreH / 2) {
        const decayY = Eb_y * Math.exp(-alpha * (absY - coreH / 2));
        amp_mn = modeX_in * decayY;
      } else {
        const cornerDx = absX - coreW / 2;
        const cornerDy = absY - coreH / 2;
        const cornerDist = Math.sqrt(cornerDx * cornerDx + cornerDy * cornerDy);
        amp_mn = (Eb_x * Eb_y) * Math.exp(-alpha * cornerDist);
      }

      totalSpatialAmplitude += weight * amp_mn;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? (totalSpatialAmplitude / totalWeight) : 0;
}

// ==========================================
// 7. 슈퍼모드 및 결합 모드 히트맵 렌더링
// ==========================================
function drawCrossSectionField(t) {
  const cvs = document.getElementById('cross-section-canvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const W = cvs.width;
  const H = cvs.height;

  ctx.clearRect(0, 0, W, H);

  const n1 = params.nCladd;
  const nCore1 = params.nCore1;
  const nCore2 = params.nCore2;

  const incX = (params.laser.rotX * Math.PI) / 180;
  const incY = (params.laser.rotY * Math.PI) / 180;

  const c1W = params.core1.w; 
  const c1H = params.core1.h; 
  const c1L = params.core1.l; 

  const c2W = params.core2.w; 
  const c2H = params.core2.h; 

  const gap_nm = params.gap; 
  const wavelengthNm = params.laser.wavelength;

  // Core 1 Effective Index
  const rawNA1 = Math.sqrt(Math.max(0, nCore1 * nCore1 - n1 * n1));
  const gammaY1 = Math.min(1.0, c1H / (c1H + (wavelengthNm / (Math.PI * (rawNA1 || 1)))));
  const n_eff1 = Math.sqrt(n1 * n1 + gammaY1 * (nCore1 * nCore1 - n1 * n1));
  const NA_eff1 = Math.sqrt(Math.max(0, n_eff1 * n_eff1 - n1 * n1));

  // Core 2 Effective Index
  const rawNA2 = Math.sqrt(Math.max(0, nCore2 * nCore2 - n1 * n1));
  const gammaY2 = Math.min(1.0, c2H / (c2H + (wavelengthNm / (Math.PI * (rawNA2 || 1)))));
  const n_eff2 = Math.sqrt(n1 * n1 + gammaY2 * (nCore2 * nCore2 - n1 * n1));

  const maxAcceptanceAngleRad = Math.asin(Math.min(1.0, NA_eff1 / n1));
  const totalIncAngleRad = Math.sqrt(incX * incX + incY * incY);
  const isGuided = totalIncAngleRad <= maxAcceptanceAngleRad && NA_eff1 > 0;

  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  let x1_nm = 0;
  let x2_nm = 0;
  if (params.waveguideCount === 2) {
    x1_nm = -(c1W / 2 + gap_nm / 2);
    x2_nm = (c2W / 2 + gap_nm / 2);
  }

  const viewW = params.waveguideCount === 2 ? (c1W + c2W + gap_nm) * 1.8 : c1W * 2.4;
  const viewH = Math.max(c1H, c2H) * 2.4;

  if (!isGuided) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 15; data[i + 1] = 23; data[i + 2] = 42; data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    drawBoundaryAndLabels(ctx, W, H, c1W, c1H, c2W, c2H, x1_nm, x2_nm, viewW, viewH, false);
    return;
  }

  const Vx = (Math.PI * c1W / wavelengthNm) * NA_eff1;
  const Vy = (Math.PI * c1H / wavelengthNm) * NA_eff1;

  const maxM = Math.max(0, Math.floor((2 * Vx) / Math.PI)); 
  const maxN = Math.max(0, Math.floor((2 * Vy) / Math.PI)); 

  const modeTextEl = document.getElementById('mode-info-text');
  if (modeTextEl) {
    const wgStr = params.waveguideCount === 2 ? ' [Directional Coupler]' : '';
    modeTextEl.textContent = `TE${maxM}${maxN}${wgStr} (neff:${n_eff1.toFixed(2)}, Vx:${Vx.toFixed(2)}, Vy:${Vy.toFixed(2)})`;
  }

  const refrY = Math.asin(Math.min(1.0, (n1 / nCore1) * Math.sin(incY)));
  const thetaX = Math.PI / 2 - refrY;
  const dp = (wavelengthNm / (2 * Math.PI)) / Math.sqrt(Math.max(0.001, n_eff1 * n_eff1 * Math.sin(thetaX) ** 2 - n1 * n1));
  const alpha = 1 / (dp * 0.95);

  const beta1 = ((2 * Math.PI) / (wavelengthNm * 1e-9)) * n_eff1;
  const beta2 = ((2 * Math.PI) / (wavelengthNm * 1e-9)) * n_eff2;

  // 슈퍼모드 및 CMT 결합 상수 연산
  const deltaBeta = Math.abs(beta1 - beta2);
  const kappa_0 = 0.003; 
  const kappa = kappa_0 * Math.exp(-gap_nm / (dp * 1.2));
  const S = Math.sqrt(kappa * kappa + (deltaBeta / 2) ** 2);

  let A1 = 1.0;
  let A2 = 0.0;
  if (params.waveguideCount === 2) {
    if (S > 0) {
      A1 = Math.cos(S * c1L);
      A2 = (kappa / S) * Math.sin(S * c1L);
    }
  }

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = ((px - W / 2) / W) * viewW;
      const y = (((H / 2) - py) / H) * viewH;

      const amp1 = computeSingleCoreAmplitude(x - x1_nm, y, c1W, c1H, maxM, maxN, alpha, incX, incY);
      let amp2 = 0;
      if (params.waveguideCount === 2) {
        amp2 = computeSingleCoreAmplitude(x - x2_nm, y, c2W, c2H, maxM, maxN, alpha, incX, incY);
      }

      const finalSpatialAmplitude = A1 * amp1 + A2 * amp2;

      const omega = 8.0;
      const phaseZ = beta1 * (c1L * SCALE) - omega * t;
      const E_val = Math.abs(params.laser.intensity * finalSpatialAmplitude * Math.sin(phaseZ));

      let r = 0, g = 0, b = 0;
      if (E_val < 0.01) {
        r = 15; g = 23; b = 42;
      } else {
        const normE = Math.min(1.0, E_val);
        const hue = (1.0 - normE) * 220; 
        const lightness = 30 + normE * 32;
        [r, g, b] = hslToRgb(hue / 360, 0.95, lightness / 100);
      }

      const idx = (py * W + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  drawBoundaryAndLabels(ctx, W, H, c1W, c1H, c2W, c2H, x1_nm, x2_nm, viewW, viewH, isGuided);
}

function drawBoundaryAndLabels(ctx, W, H, c1W, c1H, c2W, c2H, x1_nm, x2_nm, viewW, viewH, isGuided) {
  const c1PxW = (c1W / viewW) * W;
  const c1PxH = (c1H / viewH) * H;
  
  ctx.strokeStyle = isGuided ? 'rgba(255, 255, 255, 0.85)' : 'rgba(239, 68, 68, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  const c1_X = (W / 2) + (x1_nm / viewW) * W - c1PxW / 2;
  const c1_Y = (H / 2) - c1PxH / 2;
  ctx.strokeRect(c1_X, c1_Y, c1PxW, c1PxH);

  if (params.waveguideCount === 2) {
    const c2PxW = (c2W / viewW) * W;
    const c2PxH = (c2H / viewH) * H;
    const c2_X = (W / 2) + (x2_nm / viewW) * W - c2PxW / 2;
    const c2_Y = (H / 2) - c2PxH / 2;

    ctx.strokeRect(c2_X, c2_Y, c2PxW, c2PxH);

    ctx.fillStyle = isGuided ? '#ffffff' : '#f87171';
    ctx.font = '10px sans-serif';
    ctx.fillText('Core 1', c1_X + 4, c1_Y + 14);
    ctx.fillText('Core 2', c2_X + 4, c2_Y + 14);
  } else {
    ctx.fillStyle = isGuided ? '#ffffff' : '#f87171';
    ctx.font = '10px sans-serif';
    ctx.fillText('Core', c1_X + 4, c1_Y + 14);
  }

  ctx.setLineDash([]);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Cladding (Evanescent Zone)', 8, 14);

  if (!isGuided) {
    ctx.fillStyle = '#f87171';
    ctx.font = 'Bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RADIATION LOSS', W / 2, H / 2 - 6);
    ctx.font = '10px sans-serif';
    ctx.fillText('(No TIR / Field = 0)', W / 2, H / 2 + 10);
    ctx.textAlign = 'left';
  }
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

// ==========================================
// 8. 60 FPS 실시간 메인 애니메이션 루프
// ==========================================
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();
  const omega = 8.0;

  const c1W = params.core1.w * SCALE;
  const c1H = params.core1.h * SCALE;
  const c1L = params.core1.l * SCALE;
  const gap = params.gap * SCALE;

  let x1 = 0;
  if (params.waveguideCount === 2) {
    x1 = -(c1W / 2 + gap / 2);
  }

  const incX = (params.laser.rotX * Math.PI) / 180;
  const incY = (params.laser.rotY * Math.PI) / 180;

  if (laserBeamMesh) {
    laserBeamMesh.position.set(x1, c1H / 2, -c1L / 2);
    laserBeamMesh.rotation.order = 'XYZ';
    laserBeamMesh.rotation.set(-incX, incY, 0);
  }

  if (laserBeamMat) {
    const pulseFactor = 0.5 + 0.5 * Math.sin(t * omega);
    laserBeamMat.emissiveIntensity = params.laser.intensity * pulseFactor;
    laserBeamMat.opacity = 0.4 + 0.5 * pulseFactor;
  }

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