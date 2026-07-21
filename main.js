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

// 3. Mode Number Overlay UI 생성
function createModeOverlayUI() {
  let modeDiv = document.getElementById('mode-info-overlay');
  if (!modeDiv) {
    modeDiv = document.createElement('div');
    modeDiv.id = 'mode-info-overlay';
    modeDiv.style.position = 'absolute';
    modeDiv.style.top = '20px';
    modeDiv.style.left = '20px';
    modeDiv.style.padding = '12px 16px';
    modeDiv.style.background = 'rgba(15, 23, 42, 0.85)';
    modeDiv.style.border = '1px solid #334155';
    modeDiv.style.borderRadius = '8px';
    modeDiv.style.color = '#f8fafc';
    modeDiv.style.fontFamily = 'sans-serif';
    modeDiv.style.fontSize = '13px';
    modeDiv.style.zIndex = '100';
    modeDiv.style.backdropFilter = 'blur(4px)';
    document.body.appendChild(modeDiv);
  }
  return modeDiv;
}
const modeOverlay = createModeOverlayUI();

// 4. 파라미터 상태
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

// Material 설정
const coreMat = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  roughness: 0.2,
  metalness: 0.8,
  emissive: 0x0284c7,
  emissiveIntensity: 0.2,
  transparent: true,
  opacity: 0.45
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
  opacity: 0.15,
  roughness: 0.1
});

const wireframeMat = new THREE.LineBasicMaterial({ color: 0xf8fafc, linewidth: 1 });

const guidedRedBeamMat = new THREE.MeshStandardMaterial({
  color: 0xef4444,
  emissive: 0xef4444,
  emissiveIntensity: 1.0,
  transparent: true,
  opacity: 0.4
});

let core1Mesh, subMesh, topMesh, laserBeamMesh, laserBeamMat;
let guidedRedBeamMesh; 
let emVectorGroup;
let waveLineMesh;

// 5. 3D 메쉬 생성
function buildStructure() {
  if (core1Mesh) { scene.remove(core1Mesh); core1Mesh.geometry.dispose(); }
  if (subMesh) { scene.remove(subMesh); subMesh.geometry.dispose(); }
  if (topMesh) { scene.remove(topMesh); topMesh.geometry.dispose(); }
  if (laserBeamMesh) { scene.remove(laserBeamMesh); laserBeamMesh.geometry.dispose(); }
  if (guidedRedBeamMesh) { scene.remove(guidedRedBeamMesh); guidedRedBeamMesh.geometry.dispose(); }
  if (emVectorGroup) { scene.remove(emVectorGroup); }
  if (waveLineMesh) { scene.remove(waveLineMesh); waveLineMesh.geometry.dispose(); }

  const c1W = params.core1.w * SCALE;
  const c1H = params.core1.h * SCALE;
  const c1L = params.core1.l * SCALE;

  // A. Core 1
  const core1Geo = new THREE.BoxGeometry(c1W, c1H, c1L);
  core1Mesh = new THREE.Mesh(core1Geo, coreMat);
  core1Mesh.position.set(0, c1H / 2, 0);

  const wfGeo1 = new THREE.EdgesGeometry(core1Geo);
  core1Mesh.add(new THREE.LineSegments(wfGeo1, wireframeMat));
  scene.add(core1Mesh);

  // B. Substrate
  const subW = params.sub.w * SCALE;
  const subH = params.sub.h * SCALE;
  const subL = params.sub.l * SCALE;
  subMesh = new THREE.Mesh(new THREE.BoxGeometry(subW, subH, subL), subMat);
  subMesh.position.set(0, -subH / 2, 0);
  scene.add(subMesh);

  // C. Upper Cladding
  const topW = params.top.w * SCALE;
  const topH = params.top.h * SCALE;
  const topL = params.top.l * SCALE;
  topMesh = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topL), topMat);
  topMesh.position.set(0, topH / 2, 0);
  scene.add(topMesh);

  // D. 레이저 빔
  buildStraightLaserBeam(c1W, c1H, c1L);

  // E. 도파로 내부 진행 빔
  buildGuidedRedBeam(c1W, c1H, c1L);

  // F. TE 모드 전자기장 화살표
  buildTEFieldVectors(c1W, c1H, c1L);

  // G. 연속 파동선
  buildWaveLine(c1W, c1H, c1L);

  drawSpectrumGraph();
}

function buildStraightLaserBeam(c1W, c1H, c1L) {
  const beamLength = 1.5; 
  const beamRadius = 0.04;

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

function buildGuidedRedBeam(c1W, c1H, c1L) {
  const beamRadius = Math.min(c1W, c1H) * 0.25;
  const beamGeo = new THREE.CylinderGeometry(beamRadius, beamRadius, c1L, 32);
  beamGeo.rotateX(Math.PI / 2);

  guidedRedBeamMesh = new THREE.Mesh(beamGeo, guidedRedBeamMat);
  scene.add(guidedRedBeamMesh);
}

function buildTEFieldVectors(c1W, c1H, c1L) {
  emVectorGroup = new THREE.Group();

  const numSamplePoints = 16;
  const stepZ = c1L / (numSamplePoints - 1);

  for (let i = 0; i < numSamplePoints; i++) {
    const zPos = -c1L / 2 + i * stepZ;
    const origin = new THREE.Vector3(0, c1H / 2, zPos);

    const arrowE = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), origin, 0.2, 0xf87171, 0.08, 0.05);
    const arrowH = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), origin, 0.2, 0x4ade80, 0.08, 0.05);

    arrowE.userData = { index: i, zPos: zPos, type: 'E' };
    arrowH.userData = { index: i, zPos: zPos, type: 'H' };

    emVectorGroup.add(arrowE);
    emVectorGroup.add(arrowH);
  }

  scene.add(emVectorGroup);
}

function buildWaveLine(c1W, c1H, c1L) {
  const pointCount = 200;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(pointCount * 3);

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const lineMat = new THREE.LineBasicMaterial({
    color: 0xef4444,
    linewidth: 2,
    transparent: true,
    opacity: 0.95
  });

  waveLineMesh = new THREE.Line(geometry, lineMat);
  scene.add(waveLineMesh);
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

buildStructure();

// 슬라이더 바인딩
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

document.getElementById('n-core-slider').addEventListener('input', (e) => {
  params.nCore = parseFloat(e.target.value);
  document.getElementById('n-core-val').textContent = params.nCore;
  buildStructure();
});

document.getElementById('n-cladd-slider').addEventListener('input', (e) => {
  params.nCladd = parseFloat(e.target.value);
  document.getElementById('n-cladd-val').textContent = params.nCladd;
  buildStructure();
});

window.setCoreMaterial = function(name, nVal) {
  params.nCore = nVal;
  document.getElementById('n-core-slider').value = nVal;
  document.getElementById('n-core-val').textContent = nVal;
  buildStructure();
};

window.setCladdMaterial = function(name, nVal) {
  params.nCladd = nVal;
  document.getElementById('n-cladd-slider').value = nVal;
  document.getElementById('n-cladd-val').textContent = nVal;
  buildStructure();
};

window.toggleLaserPanel = function() {
  const panel = document.getElementById('laser-panel');
  panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
};

// 8. 실시간 애니메이션 및 전반사/모드 계산 루프
let clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();
  const omega = 8.0;
  const beta = 12.0;

  const c1W = params.core1.w * SCALE;
  const c1H = params.core1.h * SCALE;
  const c1L = params.core1.l * SCALE;

  const incX = (params.laser.rotX * Math.PI) / 180;
  const incY = (params.laser.rotY * Math.PI) / 180;

  const inputZ = -c1L / 2;
  const inputX = 0;
  const inputY = c1H / 2;

  if (laserBeamMesh) {
    laserBeamMesh.position.set(inputX, inputY, inputZ);
    laserBeamMesh.rotation.order = 'XYZ';
    laserBeamMesh.rotation.set(-incX, incY, 0);
  }

  const n1 = params.nCladd;
  const n2 = params.nCore;
  const lam0_um = params.laser.wavelength / 1000; // nm -> um

  // 개구수(NA) 및 수용각(Acceptance Angle) 계산
  const NA = Math.sqrt(Math.max(0, n2 * n2 - n1 * n1));
  const maxAcceptanceAngleRad = Math.asin(Math.min(1.0, NA / n1));
  const maxAcceptanceAngleDeg = (maxAcceptanceAngleRad * 180) / Math.PI;

  const totalIncAngleRad = Math.sqrt(incX * incX + incY * incY);
  const totalIncAngleDeg = (totalIncAngleRad * 180) / Math.PI;

  // 가로/세로 모드 차수(m, n) 계산
  const mMax = Math.max(0, Math.floor((2 * params.core1.w / params.laser.wavelength) * NA));
  const nMax = Math.max(0, Math.floor((2 * params.core1.h / params.laser.wavelength) * NA));

  // 전반사 조건 검증: 입사각이 수용각 이내여야 함
  const isGuided = totalIncAngleRad <= maxAcceptanceAngleRad && NA > 0;

  // UI 상태 업데이트
  if (isGuided) {
    modeOverlay.innerHTML = `
      <div style="color: #38bdf8; font-weight: bold; margin-bottom: 4px;">Propagation Status: <span style="color: #4ade80;">GUIDED (TIR Active)</span></div>
      <div>Mode Numbers: <b>TE<sub>${mMax},${nMax}</sub></b> (m=${mMax}, n=${nMax})</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Incident Angle: ${totalIncAngleDeg.toFixed(1)}° / Max Acceptance: ${maxAcceptanceAngleDeg.toFixed(1)}°</div>
    `;
  } else {
    modeOverlay.innerHTML = `
      <div style="color: #f87171; font-weight: bold; margin-bottom: 4px;">Propagation Status: <span style="color: #f87171;">RADIATION LOSS (No TIR)</span></div>
      <div style="color: #94a3b8;">Mode Numbers: <b>N/A (Cutoff)</b></div>
      <div style="font-size: 11px; color: #f87171; margin-top: 2px;">Incident Angle (${totalIncAngleDeg.toFixed(1)}°) Exceeds Acceptance Limit (${maxAcceptanceAngleDeg.toFixed(1)}°)</div>
    `;
  }

  // 전반사가 일어나지 않을 때: 모든 내부 시각화 요소 완전 차단 및 데이터 초기화
  if (!isGuided) {
    if (guidedRedBeamMesh) guidedRedBeamMesh.visible = false;
    if (emVectorGroup) emVectorGroup.visible = false;
    
    if (waveLineMesh) {
      waveLineMesh.visible = false;
      const positions = waveLineMesh.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i++) positions[i] = 0;
      waveLineMesh.geometry.attributes.position.needsUpdate = true;
    }
  } else {
    if (guidedRedBeamMesh) guidedRedBeamMesh.visible = true;
    if (emVectorGroup) emVectorGroup.visible = true;
    if (waveLineMesh) waveLineMesh.visible = true;

    const refrX = Math.asin((n1 / n2) * Math.sin(incX));
    const refrY = Math.asin((n1 / n2) * Math.sin(incY));

    const kDir = new THREE.Vector3(0, 0, 1);
    kDir.applyEuler(new THREE.Euler(-refrX, refrY, 0, 'XYZ')).normalize();

    const baseE = new THREE.Vector3(1, 0, 0);
    baseE.applyEuler(new THREE.Euler(-refrX, refrY, 0, 'XYZ')).normalize();

    const baseH = new THREE.Vector3().crossVectors(kDir, baseE).normalize();

    const couplingEff = Math.cos((totalIncAngleRad / maxAcceptanceAngleRad) * (Math.PI / 2));

    if (guidedRedBeamMesh) {
      guidedRedBeamMesh.rotation.order = 'XYZ';
      guidedRedBeamMesh.rotation.set(-refrX, refrY, 0);
      guidedRedBeamMesh.position.set(0, c1H / 2, 0);
      
      const intensityFactor = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * omega));
      guidedRedBeamMat.opacity = intensityFactor * params.laser.intensity * couplingEff * 0.5;
      guidedRedBeamMat.emissiveIntensity = (0.5 + 1.2 * intensityFactor) * couplingEff;
    }

    if (emVectorGroup) {
      emVectorGroup.children.forEach((arrow) => {
        const zPos = arrow.userData.zPos;
        const zOffset = zPos - inputZ;
        
        const shiftX = zOffset * Math.tan(refrY);
        const shiftY = -zOffset * Math.tan(refrX);

        arrow.position.set(inputX + shiftX, inputY + shiftY, zPos);

        const phase = beta * zPos - omega * t;
        const fieldVal = Math.sin(phase);

        const maxLen = 0.35 * couplingEff;
        const currentLen = Math.abs(fieldVal) * maxLen + 0.02;

        if (arrow.userData.type === 'E') {
          const dir = fieldVal >= 0 ? baseE.clone() : baseE.clone().negate();
          arrow.setDirection(dir);
          arrow.setLength(currentLen, currentLen * 0.3, currentLen * 0.2);
        } else if (arrow.userData.type === 'H') {
          const dir = fieldVal >= 0 ? baseH.clone() : baseH.clone().negate();
          arrow.setDirection(dir);
          arrow.setLength(currentLen, currentLen * 0.3, currentLen * 0.2);
        }
      });
    }

    if (waveLineMesh) {
      const positions = waveLineMesh.geometry.attributes.position.array;
      const pointCount = positions.length / 3;
      const stepZ = c1L / (pointCount - 1);
      const amplitude = 0.08 * couplingEff;

      for (let i = 0; i < pointCount; i++) {
        const zOffset = i * stepZ;
        const zLocal = inputZ + zOffset;
        const phase = beta * zLocal - omega * t;
        
        const waveOffset = baseE.clone().multiplyScalar(Math.sin(phase) * amplitude);
        
        const centerPos = new THREE.Vector3(
          inputX + zOffset * Math.tan(refrY),
          inputY - zOffset * Math.tan(refrX),
          zLocal
        );

        const finalPos = centerPos.add(waveOffset);

        positions[i * 3]     = finalPos.x;
        positions[i * 3 + 1] = finalPos.y;
        positions[i * 3 + 2] = finalPos.z;
      }

      waveLineMesh.geometry.attributes.position.needsUpdate = true;
    }
  }

  if (laserBeamMat) {
    const pulseFactor = 0.5 + 0.5 * Math.sin(t * omega);
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