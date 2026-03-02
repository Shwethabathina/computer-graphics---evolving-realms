

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';



// -------------------- Scene --------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c7ff);
scene.fog = new THREE.FogExp2(0x87c7ff, 0.0016);

// -------------------- Camera --------------------
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000);
camera.position.set(0, 175, 260);

// -------------------- Renderer --------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(renderer.domElement);

// -------------------- Controls --------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 16, 0);
controls.enableZoom = true;
controls.zoomSpeed = 1.0;
controls.minDistance = 25;
controls.maxDistance = 1200;
controls.update();

// -------------------- Stats --------------------
const stats = new Stats();
document.body.appendChild(stats.dom);

// -------------------- UI Overlay --------------------
const hud = document.createElement('div');
hud.style.position = 'fixed';
hud.style.left = '12px';
hud.style.bottom = '12px';
hud.style.padding = '10px 12px';
hud.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';
hud.style.fontSize = '13px';
hud.style.lineHeight = '1.35';
hud.style.color = 'rgba(255,255,255,0.92)';
hud.style.background = 'rgba(0,0,0,0.35)';
hud.style.backdropFilter = 'blur(6px)';
hud.style.border = '1px solid rgba(255,255,255,0.12)';
hud.style.borderRadius = '12px';
hud.style.userSelect = 'none';

hud.innerHTML = `
  <div style="font-weight:600;margin-bottom:6px;">Meteor Playground</div>

  <button id="meteorBtn" style="
    appearance:none; border:1px solid rgba(255,255,255,0.18);
    background:rgba(255,255,255,0.10); color:rgba(255,255,255,0.92);
    padding:7px 10px; border-radius:10px; cursor:pointer;
    font-weight:600; margin-bottom:8px;
  "> Meteor Strike</button>

  <div>Space: <b>Random strike</b></div>
  <div>R: <b>Reset craters</b></div>
  <div>E: <b>Toggle earthquake</b></div>
  <div>Q: <b>Quake burst (2s)</b></div>
  <div style="margin-top:6px;opacity:0.85;">Destroyed area: <span id="score">0</span></div>
`;
document.body.appendChild(hud);

const scoreEl = document.getElementById('score');
const meteorBtn = document.getElementById('meteorBtn');

// -------------------- World Params --------------------
const WORLD = {
  size: 240,
  segments: 256,

  heightAmp: 42,
  noiseScale: 0.012,
  octaves: 6,
  persistence: 0.5,

  warpScale: 0.02,
  warpAmp: 18,

  river: {
    points: [
      new THREE.Vector2(-110, -90),
      new THREE.Vector2(-60, -40),
      new THREE.Vector2(-10, -10),
      new THREE.Vector2(45, 20),
      new THREE.Vector2(110, 95),
    ],
    width: 17,
    depth: 19,
    bankSmooth: 7,
  },

  waterLevel: -6.0,

  treeCount: 1300,
  treeMinDistToRiver: 10,

  crater: {
    radius: 10.0,
    depth: 10.0,
    rimHeight: 3.2,
    rimWidth: 4.0,
  },

  shockwave: {
    speed: 26.0,
    life: 3.2,
    thickness: 2.0,
    strength: 1.0,
    bendStrength: 1.0,
    bendBand: 6.0,
  },

  mountain: {
    enabled: true,
    x: 70,
    z: 55,
    radius: 52,
    height: 110,
    peakSharpness: 2.6,
    ridgeNoise: 0.08,
    noTreesBuffer: 10,
  },

  dayNight: {
    enabled: true,
    secondsPerDay: 70,
    sunRadius: 560,
    sunHeight: 380,
    moonOffset: Math.PI,
    fogDayDensity: 0.0016,
    fogNightDensity: 0.003,
  },

  meteor: {
    spawnHeight: 230,
    fallSpeed: 210,
    trailLife: 0.35,
    debrisCount: 900,
    debrisLife: 1.8,
    debrisGravity: 55,
  },

  quake: {
    enabled: false,
    amp: 3.2,
    spatialFreq: 0.055,
    timeFreq: 9.0,
    cameraAmp: 1.8,
    treeBoost: 1.3,
    waterBoost: 1.45,
    burstSeconds: 2.0,
  },

  
  moonBall: {
    radius: 7.0,
    distanceMul: 0.98, // relative to sunRadius
    baseOpacity: 0.15,
    maxExtraOpacity: 0.75,
    fadeInAtNight: 0.15, // night threshold start
    fadeFullAtNight: 0.75, // night threshold full
    pulseAmp: 0.03,
    pulseSpeed: 1.2,
  },
};

// -------------------- Noise --------------------
const noise = new ImprovedNoise();

function fbm(x, z, scale, amp, octaves, persistence) {
  let freq = 1.0;
  let a = 1.0;
  let sum = 0.0;
  let norm = 0.0;

  for (let o = 0; o < octaves; o++) {
    const n = noise.noise(x * scale * freq, 0, z * scale * freq);
    sum += n * a;
    norm += a;
    a *= persistence;
    freq *= 2.0;
  }
  return (sum / Math.max(1e-6, norm)) * amp;
}

function domainWarp(x, z) {
  const wx = fbm(x + 17.0, z + 91.0, WORLD.warpScale, WORLD.warpAmp, 3, 0.55);
  const wz = fbm(x - 63.0, z - 11.0, WORLD.warpScale, WORLD.warpAmp, 3, 0.55);
  return { x: x + wx, z: z + wz };
}

// -------------------- River helpers --------------------
function distanceToPolylineXZ(p, pts) {
  let minD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ab = new THREE.Vector2().subVectors(b, a);
    const ap = new THREE.Vector2().subVectors(p, a);
    const t = THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
    const closest = new THREE.Vector2(a.x + ab.x * t, a.y + ab.y * t);
    const d = closest.distanceTo(p);
    if (d < minD) minD = d;
  }
  return minD;
}

function riverCarveHeight(dist, width, depth, smooth) {
  const t = THREE.MathUtils.clamp(dist / Math.max(1e-6, width), 0, 1);
  const s = t * t * (3 - 2 * t);
  const bank = Math.pow(1.0 - s, Math.max(1.0, smooth / 4.0));
  return -depth * bank;
}

// -------------------- Crater stamps --------------------
const craterStamps = [];

function smooth01(t) {
  t = THREE.MathUtils.clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

function craterDelta(dx, dz, stamp) {
  const r = Math.sqrt(dx * dx + dz * dz);
  const R = stamp.radius;
  if (r > R + stamp.rimWidth) return 0.0;

  const t = 1.0 - smooth01(r / Math.max(1e-6, R));
  const bowl = -stamp.depth * (t * t);

  const rimBand = stamp.rimWidth;
  const rimT =
    1.0 -
    THREE.MathUtils.clamp(Math.abs(r - R) / Math.max(1e-6, rimBand), 0, 1);
  const rim = stamp.rimHeight * smooth01(rimT) ** 1.5;

  const rimBlend = smooth01(
    THREE.MathUtils.clamp((r - R * 0.55) / (R * 0.45), 0, 1)
  );
  return THREE.MathUtils.lerp(bowl, rim, rimBlend);
}

// -------------------- Big Mountain stamp --------------------
function mountainHeightAt(x, z) {
  if (!WORLD.mountain.enabled) return 0.0;

  const dx = x - WORLD.mountain.x;
  const dz = z - WORLD.mountain.z;
  const r = Math.sqrt(dx * dx + dz * dz);

  const R = WORLD.mountain.radius;
  if (r > R) return 0.0;

  const t = 1.0 - smooth01(r / Math.max(1e-6, R));
  let h = WORLD.mountain.height * Math.pow(t, WORLD.mountain.peakSharpness);

  const ridgeAmp = WORLD.mountain.height * WORLD.mountain.ridgeNoise;
  const ridge = fbm(x + 500, z - 300, 0.03, ridgeAmp, 4, 0.55);
  h += ridge * (0.35 + 0.65 * t);

  return h;
}

// -------------------- Terrain height --------------------
function baseTerrainHeightAt(x, z) {
  const w = domainWarp(x, z);

  let h = fbm(w.x, w.z, WORLD.noiseScale, WORLD.heightAmp, WORLD.octaves, WORLD.persistence);
  h += fbm(w.x + 200, w.z - 120, WORLD.noiseScale * 0.33, WORLD.heightAmp * 0.7, 3, 0.6);

  const d = distanceToPolylineXZ(new THREE.Vector2(x, z), WORLD.river.points);
  h += riverCarveHeight(d, WORLD.river.width, WORLD.river.depth, WORLD.river.bankSmooth);

  return h;
}

function terrainHeightAt(x, z) {
  let h = baseTerrainHeightAt(x, z);
  h += mountainHeightAt(x, z);

  for (let i = 0; i < craterStamps.length; i++) {
    const s = craterStamps[i];
    h += craterDelta(x - s.x, z - s.z, s);
  }
  return h;
}

// -------------------- Earthquake displacement (runtime only) --------------------
let quakeBurstUntil = 0;

function quakeStrength(t) {
  const on = WORLD.quake.enabled || t < quakeBurstUntil;
  if (!on) return 0.0;

  const wobble = 0.75 + 0.25 * Math.sin(t * 1.7);
  return wobble;
}

function quakeDisplacementY(x, z, t) {
  const k = quakeStrength(t);
  if (k <= 0) return 0.0;

  const A = WORLD.quake.amp * k;
  const sf = WORLD.quake.spatialFreq;
  const tf = WORLD.quake.timeFreq;

  const w1 = Math.sin((x + z) * sf + t * tf);
  const w2 = Math.sin((x - z) * (sf * 0.85) - t * (tf * 1.15));
  const n = noise.noise(x * 0.03 + t * 1.3, 0, z * 0.03 - t * 1.1);

  return A * (0.55 * w1 + 0.35 * w2 + 0.2 * n);
}

// -------------------- Terrain shader material --------------------
function makeTerrainShaderMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0.6, 1.0, 0.2).normalize() },
      uSunColor: { value: new THREE.Color(1.0, 0.93, 0.8) },
      uSkyColor: { value: new THREE.Color(0.55, 0.62, 0.72) },
      uFogColor: { value: new THREE.Color(scene.fog.color) },
      uFogDensity: { value: scene.fog.density },
      uNight: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vH;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vH = position.y;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uNight;

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vH;

      float hash(vec2 p){
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      vec3 heightColor(float h, float slope) {
        vec3 deepGrass = vec3(0.06, 0.20, 0.11);
        vec3 grass     = vec3(0.14, 0.34, 0.18);
        vec3 dirt      = vec3(0.34, 0.30, 0.22);
        vec3 rock      = vec3(0.48, 0.48, 0.48);
        vec3 snow      = vec3(0.92, 0.92, 0.94);

        float g = smoothstep(-14.0, 10.0, h);
        float r = smoothstep(16.0, 32.0, h);
        float s = smoothstep(40.0, 70.0, h);

        vec3 base = mix(deepGrass, grass, g);
        base = mix(base, dirt, slope * 0.55);
        base = mix(base, rock, r + slope * 0.65);
        base = mix(base, snow, s);

        float n = hash(vWorldPos.xz * 0.15);
        base *= mix(0.92, 1.08, n);

        float ao = mix(0.78, 1.0, smoothstep(-15.0, 12.0, h));
        base *= ao;

        vec3 cool = vec3(0.65, 0.75, 1.05);
        base = mix(base, base * cool, uNight * 0.55);

        return base;
      }

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 L = normalize(uSunDir);

        float ndl = max(dot(N, L), 0.0);
        float slope = 1.0 - clamp(N.y, 0.0, 1.0);

        vec3 base = heightColor(vH, slope);

        vec3 ambient = (0.90 + 0.25*uNight) * uSkyColor;
        vec3 diffuse = ndl * uSunColor;

        vec3 V = normalize(cameraPosition - vWorldPos);
        float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0) * (0.18 + 0.12*uNight);

        vec3 col = base * (ambient + diffuse) + rim;

        float edge = smoothstep(100.0, 120.0, length(vWorldPos.xz));
        col *= (1.0 - edge * 0.35);

        float dist = length(vWorldPos);
        float fog = 1.0 - exp(-uFogDensity*uFogDensity*dist*dist);
        col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// -------------------- Build Terrain --------------------
let terrainMesh = null;
let terrainGeom = null;
let terrainBaseY = null;

function buildTerrain() {
  const geom = new THREE.PlaneGeometry(WORLD.size, WORLD.size, WORLD.segments, WORLD.segments);
  geom.rotateX(-Math.PI / 2);

  terrainGeom = geom;

  const pos = geom.attributes.position;
  terrainBaseY = new Float32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeightAt(x, z);
    pos.setY(i, y);
    terrainBaseY[i] = y;
  }

  pos.needsUpdate = true;
  geom.computeVertexNormals();

  const mat = makeTerrainShaderMaterial();
  terrainMesh = new THREE.Mesh(geom, mat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  return terrainMesh;
}

function refreshTerrainGeometry() {
  if (!terrainGeom) return;

  const pos = terrainGeom.attributes.position;
  if (!terrainBaseY || terrainBaseY.length !== pos.count) terrainBaseY = new Float32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeightAt(x, z);
    pos.setY(i, y);
    terrainBaseY[i] = y;
  }

  pos.needsUpdate = true;
  terrainGeom.computeVertexNormals();
  terrainGeom.attributes.position.needsUpdate = true;

  rebuildWaterMask();
}

let normalRecalcAccum = 0;
function applyTerrainEarthquake(t, dt) {
  if (!terrainGeom || !terrainBaseY) return;

  const k = quakeStrength(t);
  if (k <= 0) return;

  const pos = terrainGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const dy = quakeDisplacementY(x, z, t);
    pos.setY(i, terrainBaseY[i] + dy);
  }
  pos.needsUpdate = true;

  normalRecalcAccum += dt;
  if (normalRecalcAccum > 0.1) {
    terrainGeom.computeVertexNormals();
    normalRecalcAccum = 0;
  }
}

function resetTerrainToBase() {
  if (!terrainGeom || !terrainBaseY) return;
  const pos = terrainGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainBaseY[i]);
  pos.needsUpdate = true;
  terrainGeom.computeVertexNormals();
  normalRecalcAccum = 0;
}

// -------------------- Water --------------------
let water = null;
let waterGeom = null;

function buildWater() {
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, 220, 220);
  geo.rotateX(-Math.PI / 2);
  waterGeom = geo;

  const pos = geo.attributes.position;
  geo.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
  geo.setAttribute('aMask', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
  geo.setAttribute('aFoam', new THREE.BufferAttribute(new Float32Array(pos.count), 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.86 },
      uDeep: { value: new THREE.Color(0x071f2f) },
      uShallow: { value: new THREE.Color(0x3bbde0) },
      uFoam: { value: new THREE.Color(0xdfeff6) },
      uFlowDir: { value: new THREE.Vector2(0.7, 0.25).normalize() },
      uSunDir: { value: new THREE.Vector3(0.6, 1.0, 0.2).normalize() },
      uSunColor: { value: new THREE.Color(1.0, 0.93, 0.8) },
      uNight: { value: 0.0 },
      uWorldHalf: { value: WORLD.size * 0.5 },
      uAgitate: { value: 1.0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform vec2 uFlowDir;
      uniform float uAgitate;

      attribute float aDepth;
      attribute float aMask;
      attribute float aFoam;

      varying vec3 vWorldPos;
      varying float vDepth;
      varying float vMask;
      varying float vFoam;
      varying float vWave;
      varying vec3 vN;

      float hash(vec2 p){
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 p = position;
        float t = uTime;

        float a1 = 0.07, b1 = 0.06, w1 = 0.9;
        float a2 = -0.05, b2 = 0.085, w2 = 0.6;

        float phase1 = (p.x * a1 + p.z * b1) + t * w1;
        float phase2 = (p.x * a2 + p.z * b2) + t * w2;

        float wave1 = sin(phase1);
        float wave2 = sin(phase2);

        float flow = dot(vec2(p.x, p.z), uFlowDir) * 0.06 + t * 0.7;
        float microPhase = flow + hash(vec2(p.x, p.z)) * 6.283;
        float micro = sin(microPhase) * 0.25;

        float h = (wave1 * 0.55 + wave2 * 0.45 + micro) * 0.45 * uAgitate;
        vWave = h;
        p.y += h;

        float dhdx =
          (cos(phase1) * (a1) * 0.55 +
           cos(phase2) * (a2) * 0.45) * 0.45 * uAgitate;

        float dhdz =
          (cos(phase1) * (b1) * 0.55 +
           cos(phase2) * (b2) * 0.45) * 0.45 * uAgitate;

        float dmicro = cos(microPhase) * 0.25 * 0.45 * uAgitate;
        dhdx += dmicro * (uFlowDir.x * 0.06);
        dhdz += dmicro * (uFlowDir.y * 0.06);

        vN = normalize(vec3(-dhdx, 1.0, -dhdz));

        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorldPos = world.xyz;

        vDepth = aDepth;
        vMask = aMask;
        vFoam = aFoam;

        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform float uOpacity;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;

      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uWorldHalf;
      uniform float uNight;

      varying vec3 vWorldPos;
      varying float vDepth;
      varying float vMask;
      varying float vFoam;
      varying float vWave;
      varying vec3 vN;

      void main() {
        if (vMask < 0.5) discard;

        float edge = smoothstep(uWorldHalf * 0.88, uWorldHalf, length(vWorldPos.xz));

        vec3 shallow = mix(uShallow, uShallow * vec3(0.55, 0.70, 1.00), uNight);
        vec3 deep    = mix(uDeep,    uDeep    * vec3(0.40, 0.55, 0.95), uNight);

        vec3 col = mix(shallow, deep, vDepth);

        float foam = smoothstep(0.15, 0.85, vFoam);
        col = mix(col, uFoam, foam * 0.65);

        col += vec3(0.12) * smoothstep(0.06, 0.30, vWave + 0.14);

        vec3 N = normalize(vN);
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 H = normalize(L + V);

        float specPow = mix(75.0, 95.0, uNight);
        float specAmp = mix(1.10, 0.55, uNight);
        float spec = pow(max(dot(N, H), 0.0), specPow) * specAmp;
        col += spec * uSunColor;

        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        col += fres * mix(vec3(0.06, 0.08, 0.10), vec3(0.08, 0.10, 0.14), uNight);

        float alpha = uOpacity * (1.0 - edge);
        if (alpha < 0.02) discard;

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  water = new THREE.Mesh(geo, mat);
  water.position.y = WORLD.waterLevel;
  water.receiveShadow = true;
  scene.add(water);

  rebuildWaterMask();
  return water;
}

function rebuildWaterMask() {
  if (!waterGeom) return;

  const pos = waterGeom.attributes.position;
  const aDepth = waterGeom.attributes.aDepth.array;
  const aMask = waterGeom.attributes.aMask.array;
  const aFoam = waterGeom.attributes.aFoam.array;

  const waterLevel = WORLD.waterLevel;
  const depthRange = 18.0;
  const foamWidth = 2.2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    const h = terrainHeightAt(x, z);
    const d = waterLevel - h;

    const mask = d > 0.1 ? 1.0 : 0.0;
    aMask[i] = mask;

    aDepth[i] = THREE.MathUtils.clamp(d / depthRange, 0, 1);

    const foam = 1.0 - THREE.MathUtils.clamp(d / foamWidth, 0, 1);
    aFoam[i] = mask * foam;
  }

  waterGeom.attributes.aDepth.needsUpdate = true;
  waterGeom.attributes.aMask.needsUpdate = true;
  waterGeom.attributes.aFoam.needsUpdate = true;
}

// -------------------- Trees --------------------
let forest = null;
let treeData = [];

function randRange(a, b) {
  return a + Math.random() * (b - a);
}

function makeTreeGeometry() {
  const trunk = new THREE.CylinderGeometry(0.18, 0.26, 2.4, 7);
  trunk.translate(0, 1.2, 0);

  const foliage1 = new THREE.ConeGeometry(1.35, 3.0, 8);
  foliage1.translate(0, 3.2, 0);

  const foliage2 = new THREE.ConeGeometry(1.1, 2.6, 8);
  foliage2.translate(0, 4.4, 0);

  const foliage3 = new THREE.ConeGeometry(0.85, 2.2, 8);
  foliage3.translate(0, 5.4, 0);

  const merged = mergeGeometries([trunk, foliage1, foliage2, foliage3], false);
  merged.computeVertexNormals();
  return merged;
}

function makeTreeMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
  });
}

function colorizeTreeGeometry(geom) {
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 2.7) {
      colors[i * 3 + 0] = 0.29;
      colors[i * 3 + 1] = 0.18;
      colors[i * 3 + 2] = 0.1;
    } else {
      colors[i * 3 + 0] = 0.12;
      colors[i * 3 + 1] = 0.4;
      colors[i * 3 + 2] = 0.2;
    }
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function isInsideMountainNoTreeZone(x, z) {
  if (!WORLD.mountain.enabled) return false;
  const dx = x - WORLD.mountain.x;
  const dz = z - WORLD.mountain.z;
  const r = Math.sqrt(dx * dx + dz * dz);
  return r <= WORLD.mountain.radius + WORLD.mountain.noTreesBuffer;
}

function buildForest() {
  const geom = makeTreeGeometry();
  colorizeTreeGeometry(geom);
  const mat = makeTreeMaterial();

  forest = new THREE.InstancedMesh(geom, mat, WORLD.treeCount);
  forest.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  forest.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(WORLD.treeCount * 3), 3);

  const half = WORLD.size * 0.5;
  const tmp = new THREE.Object3D();

  treeData = [];
  let placed = 0;
  let tries = 0;

  while (placed < WORLD.treeCount && tries < WORLD.treeCount * 60) {
    tries++;

    const x = randRange(-half * 0.95, half * 0.95);
    const z = randRange(-half * 0.95, half * 0.95);

    if (isInsideMountainNoTreeZone(x, z)) continue;

    const dRiver = distanceToPolylineXZ(new THREE.Vector2(x, z), WORLD.river.points);
    if (dRiver < WORLD.treeMinDistToRiver) continue;

    const y = terrainHeightAt(x, z);
    if (y < WORLD.waterLevel + 1.7) continue;

    const s = randRange(0.9, 2.25);
    const yaw = randRange(0, Math.PI * 2);

    const leanX = randRange(-0.08, 0.08);
    const leanZ = randRange(-0.08, 0.08);

    tmp.position.set(x, y - 0.18 * s, z);
    tmp.rotation.set(leanX, yaw, leanZ);
    tmp.scale.set(s, s, s);
    tmp.updateMatrix();

    forest.setMatrixAt(placed, tmp.matrix);

    const tint = randRange(0.78, 1.15);
    forest.instanceColor.setXYZ(placed, 0.14 * tint, 0.46 * tint, 0.22 * tint);

    treeData.push({ x, y, z, s, yaw, leanX, leanZ, bend: 0.0 });
    placed++;
  }

  forest.count = placed;
  forest.instanceMatrix.needsUpdate = true;
  forest.instanceColor.needsUpdate = true;

  forest.castShadow = true;
  scene.add(forest);
  return forest;
}

// -------------------- Shockwaves --------------------
const shockwaves = [];
function addShockwave(x, z, tNow) {
  shockwaves.push({ x, z, t0: tNow });
}

// -------------------- Ring Mesh (visual shockwave) --------------------
let ringMesh = null;
const ringMax = 24;

function buildRingMesh() {
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, 1, 1);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uParams: { value: new Float32Array(ringMax * 4) },
      uSpeed: { value: WORLD.shockwave.speed },
      uLife: { value: WORLD.shockwave.life },
      uThickness: { value: WORLD.shockwave.thickness },
      uStrength: { value: WORLD.shockwave.strength },
      uColor: { value: new THREE.Color(0x9fe9ff) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform float uTime;
      uniform float uSpeed;
      uniform float uLife;
      uniform float uThickness;
      uniform float uStrength;
      uniform vec3  uColor;
      uniform float uParams[${ringMax * 4}];

      varying vec3 vWorld;

      float ring(float d, float r, float thick){
        float a = smoothstep(r - thick, r, d);
        float b = smoothstep(r, r + thick, d);
        return a - b;
      }

      void main() {
        vec2 p = vWorld.xz;

        float glow = 0.0;
        for(int i=0; i<${ringMax}; i++){
          float alive = uParams[i*4 + 3];
          if(alive < 0.5) continue;

          vec2 c = vec2(uParams[i*4 + 0], uParams[i*4 + 1]);
          float t0 = uParams[i*4 + 2];

          float age = uTime - t0;
          if(age < 0.0 || age > uLife) continue;

          float r = age * uSpeed;
          float d = distance(p, c);

          float band = ring(d, r, uThickness);
          float fade = 1.0 - smoothstep(0.0, uLife, age);
          glow += band * fade;
        }

        glow = clamp(glow, 0.0, 1.0);
        if(glow < 0.01) discard;

        gl_FragColor = vec4(uColor, glow * 0.65 * uStrength);
      }
    `,
  });

  ringMesh = new THREE.Mesh(geo, mat);
  ringMesh.position.y = WORLD.waterLevel + 0.05;
  scene.add(ringMesh);
}

function updateRingUniforms(tNow) {
  if (!ringMesh) return;

  const arr = ringMesh.material.uniforms.uParams.value;
  for (let i = 0; i < ringMax * 4; i++) arr[i] = 0;

  const n = Math.min(shockwaves.length, ringMax);
  for (let i = 0; i < n; i++) {
    const s = shockwaves[shockwaves.length - 1 - i];
    arr[i * 4 + 0] = s.x;
    arr[i * 4 + 1] = s.z;
    arr[i * 4 + 2] = s.t0;
    arr[i * 4 + 3] = 1.0;
  }

  ringMesh.material.uniforms.uTime.value = tNow;
}

// -------------------- Sky Dome + Stars --------------------
const skyGeo = new THREE.SphereGeometry(1200, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    top: { value: new THREE.Color(0x2a4a7a) },
    horizon: { value: new THREE.Color(0x86c9ff) },
    bottom: { value: new THREE.Color(0xdff3ff) },
    night: { value: 0.0 },
  },
  vertexShader: `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform vec3 top;
    uniform vec3 horizon;
    uniform vec3 bottom;
    uniform float night;
    varying vec3 vPos;

    float hash(vec2 p){
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    void main() {
      float h = normalize(vPos).y * 0.5 + 0.5;

      vec3 dayCol = mix(bottom, horizon, smoothstep(0.0, 0.55, h));
      dayCol = mix(dayCol, top, smoothstep(0.55, 1.0, h));

      float s = 0.0;
      vec3 dir = normalize(vPos);
      float n = hash(dir.xz * 200.0 + dir.y * 40.0);
      float star = step(0.9965, n) * smoothstep(0.15, 0.75, h);
      s += star;

      vec3 nightSky = vec3(0.02, 0.03, 0.06) + s * vec3(1.0);

      vec3 col = mix(dayCol, nightSky, night);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const skyDome = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyDome);

// -------------------- Lighting --------------------
const ambient = new THREE.AmbientLight(0xffffff, 0.48);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 6.2);
sun.position.set(170, 280, 140);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 1000;
sun.shadow.camera.left = -240;
sun.shadow.camera.right = 240;
sun.shadow.camera.top = 240;
sun.shadow.camera.bottom = -240;
scene.add(sun);
scene.add(sun.target);

const moon = new THREE.DirectionalLight(0x9db6ff, 0.0);
moon.position.set(-170, 220, -140);
moon.castShadow = false;
scene.add(moon);
scene.add(moon.target);

const rim = new THREE.DirectionalLight(0x88aaff, 0.25);
rim.position.set(-260, 160, -140);
scene.add(rim);

// --------------------  Moon Sphere (comes/goes) --------------------
let moonBall = null;

function buildCuteMoonBall() {
  const geo = new THREE.SphereGeometry(WORLD.moonBall.radius, 22, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xcfd9ff,
    transparent: true,
    opacity: 0.0,     // fades in/out
    depthWrite: false,
  });
  moonBall = new THREE.Mesh(geo, mat);
  moonBall.renderOrder = 10;
  moonBall.frustumCulled = false;
  scene.add(moonBall);
}
buildCuteMoonBall();

// -------------------- Debris Particles --------------------
let debris = null;
let debrisData = [];

function buildDebris() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(WORLD.meteor.debrisCount * 3);
  const vel = new Float32Array(WORLD.meteor.debrisCount * 3);
  const life = new Float32Array(WORLD.meteor.debrisCount);

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));

  const mat = new THREE.PointsMaterial({
    size: 0.9,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });

  debris = new THREE.Points(geo, mat);
  debris.frustumCulled = false;
  scene.add(debris);

  debrisData = new Array(WORLD.meteor.debrisCount).fill(0).map(() => ({ life: 0 }));
  return debris;
}

function spawnDebris(x, y, z) {
  if (!debris) return;

  const pos = debris.geometry.attributes.position.array;
  const vel = debris.geometry.attributes.aVel.array;
  const life = debris.geometry.attributes.aLife.array;

  for (let i = 0; i < WORLD.meteor.debrisCount; i++) {
    const idx = i * 3;

    const ang = Math.random() * Math.PI * 2;
    const up = randRange(0.25, 1.0);
    const sp = randRange(14, 52);

    pos[idx + 0] = x + randRange(-1.2, 1.2);
    pos[idx + 1] = y + randRange(0.2, 1.2);
    pos[idx + 2] = z + randRange(-1.2, 1.2);

    vel[idx + 0] = Math.cos(ang) * sp * (1.0 - up);
    vel[idx + 1] = sp * up;
    vel[idx + 2] = Math.sin(ang) * sp * (1.0 - up);

    life[i] = WORLD.meteor.debrisLife;
    debrisData[i].life = WORLD.meteor.debrisLife;
  }

  debris.geometry.attributes.position.needsUpdate = true;
  debris.geometry.attributes.aVel.needsUpdate = true;
  debris.geometry.attributes.aLife.needsUpdate = true;

  debris.material.opacity = 0.85;
}

function updateDebris(dt) {
  if (!debris) return;

  const pos = debris.geometry.attributes.position.array;
  const vel = debris.geometry.attributes.aVel.array;
  const life = debris.geometry.attributes.aLife.array;

  let anyAlive = false;

  for (let i = 0; i < WORLD.meteor.debrisCount; i++) {
    if (life[i] <= 0) continue;

    anyAlive = true;
    const idx = i * 3;

    vel[idx + 1] -= WORLD.meteor.debrisGravity * dt;

    pos[idx + 0] += vel[idx + 0] * dt;
    pos[idx + 1] += vel[idx + 1] * dt;
    pos[idx + 2] += vel[idx + 2] * dt;

    const ground = terrainHeightAt(pos[idx + 0], pos[idx + 2]) + 0.15;
    if (pos[idx + 1] < ground) {
      pos[idx + 1] = ground;
      vel[idx + 0] *= 0.35;
      vel[idx + 1] *= -0.25;
      vel[idx + 2] *= 0.35;

      vel[idx + 0] *= 0.85;
      vel[idx + 2] *= 0.85;
    }

    life[i] -= dt;
  }

  debris.geometry.attributes.position.needsUpdate = true;
  debris.geometry.attributes.aLife.needsUpdate = true;

  if (!anyAlive) debris.material.opacity = Math.max(0, debris.material.opacity - dt * 2.5);
}

// -------------------- Meteor (falling) --------------------
let meteor = null;
let meteorTrail = null;
let activeMeteor = null;

function buildMeteor() {
  const geo = new THREE.IcosahedronGeometry(2.4, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a3a2b,
    roughness: 0.95,
    metalness: 0.0,
    emissive: new THREE.Color(0x220900),
    emissiveIntensity: 0.35,
  });

  meteor = new THREE.Mesh(geo, mat);
  meteor.castShadow = true;
  meteor.visible = false;
  scene.add(meteor);

  const tGeo = new THREE.CylinderGeometry(0.6, 1.6, 18, 8, 1, true);
  const tMat = new THREE.MeshBasicMaterial({
    color: 0xffa24a,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });

  meteorTrail = new THREE.Mesh(tGeo, tMat);
  meteorTrail.visible = false;
  scene.add(meteorTrail);
}

function startMeteorStrike(x, z, tNow) {
  activeMeteor = { x, z, y: WORLD.meteor.spawnHeight, v: WORLD.meteor.fallSpeed, spawnT: tNow };

  meteor.visible = true;
  meteor.position.set(x, activeMeteor.y, z);

  meteorTrail.visible = true;
  meteorTrail.position.set(x, activeMeteor.y - 9, z);
  meteorTrail.material.opacity = 0.6;
}

let destroyedScore = 0;

function impactAt(x, z, tNow) {
  const r = WORLD.crater.radius * randRange(1.15, 1.75);
  const d = WORLD.crater.depth * randRange(1.1, 1.65);

  craterStamps.push({
    x,
    z,
    radius: r,
    depth: d,
    rimHeight: WORLD.crater.rimHeight * randRange(1.0, 1.45),
    rimWidth: WORLD.crater.rimWidth * randRange(1.0, 1.55),
  });

  destroyedScore += Math.round(Math.PI * r * r);
  scoreEl.textContent = destroyedScore.toString();

  refreshTerrainGeometry();
  addShockwave(x, z, tNow);

  const blastRadius = 42;
  for (let i = 0; i < treeData.length; i++) {
    const tr = treeData[i];
    const dx = tr.x - x;
    const dz = tr.z - z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < blastRadius) tr.bend = Math.max(tr.bend, (1.0 - dist / blastRadius) * 1.0);
  }

  const y = terrainHeightAt(x, z) + 1.2;
  spawnDebris(x, y, z);

  quakeBurstUntil = Math.max(quakeBurstUntil, tNow + 0.55);
}

// -------------------- Build world --------------------
buildTerrain();
buildWater();
buildForest();
buildRingMesh();
buildDebris();
buildMeteor();

// optional grid
const grid = new THREE.GridHelper(WORLD.size, 40, 0xffffff, 0xffffff);
grid.material.opacity = 0.04;
grid.material.transparent = true;
scene.add(grid);

// -------------------- Day/Night --------------------
function applyDayNightCycle(t) {
  const dayT = (t / WORLD.dayNight.secondsPerDay) % 1.0;
  const ang = dayT * Math.PI * 2.0 - Math.PI * 0.5;

  const sunY = Math.sin(ang);
  const daylight = THREE.MathUtils.clamp((sunY + 0.15) / 1.15, 0, 1);
  const night = 1.0 - daylight;

  const sr = WORLD.dayNight.sunRadius;
  const sh = WORLD.dayNight.sunHeight;

  sun.position.set(
    Math.cos(ang) * sr,
    (sunY * 0.5 + 0.5) * sh + 30,
    Math.sin(ang) * sr
  );
  sun.target.position.set(0, 0, 0);
  sun.target.updateMatrixWorld();

  const mang = ang + WORLD.dayNight.moonOffset;
  const moonY = Math.sin(mang);
  moon.position.set(
    Math.cos(mang) * sr,
    (moonY * 0.5 + 0.5) * (sh * 0.85) + 30,
    Math.sin(mang) * sr
  );
  moon.target.position.set(0, 0, 0);
  moon.target.updateMatrixWorld();

  const warm = 1.0 - Math.abs(sunY);
  const warmT = THREE.MathUtils.clamp((warm - 0.2) / 0.8, 0, 1);

  const noon = new THREE.Color(1.0, 0.95, 0.86);
  const sunset = new THREE.Color(1.0, 0.58, 0.28);
  const nightSun = new THREE.Color(0.55, 0.62, 0.8);

  const sunCol = new THREE.Color().copy(noon).lerp(sunset, warmT * 0.9);
  sunCol.lerp(nightSun, night * 0.7);
  sun.color.copy(sunCol);

  sun.intensity = THREE.MathUtils.lerp(0.0, 7.2, daylight);
  ambient.intensity = THREE.MathUtils.lerp(0.18, 0.55, daylight);
  moon.intensity = THREE.MathUtils.lerp(0.75, 0.0, daylight);
  rim.intensity = THREE.MathUtils.lerp(0.1, 0.25, daylight);

  const fogD = THREE.MathUtils.lerp(
    WORLD.dayNight.fogNightDensity,
    WORLD.dayNight.fogDayDensity,
    daylight
  );
  scene.fog.density = fogD;

  const dayFog = new THREE.Color(0x87c7ff);
  const nightFog = new THREE.Color(0x05070f);
  const fogCol = new THREE.Color().copy(nightFog).lerp(dayFog, daylight);
  scene.fog.color.copy(fogCol);
  scene.background.copy(fogCol);

  const dayTop = new THREE.Color(0x2a4a7a);
  const dayH = new THREE.Color(0x86c9ff);
  const dayB = new THREE.Color(0xdff3ff);

  const nightTop = new THREE.Color(0x02040b);
  const nightH = new THREE.Color(0x071027);
  const nightB = new THREE.Color(0x0a0f22);

  skyMat.uniforms.top.value.copy(nightTop).lerp(dayTop, daylight);
  skyMat.uniforms.horizon.value.copy(nightH).lerp(dayH, daylight);
  skyMat.uniforms.bottom.value.copy(nightB).lerp(dayB, daylight);
  skyMat.uniforms.night.value = night;

  // terrain uniforms
  if (terrainMesh) {
    const mat = terrainMesh.material;
    const sunDir = new THREE.Vector3().copy(sun.position).normalize();

    mat.uniforms.uSunDir.value.copy(sunDir);
    mat.uniforms.uSunColor.value.copy(sun.color);
    mat.uniforms.uSkyColor.value.set(
      THREE.MathUtils.lerp(0.1, 0.55, daylight),
      THREE.MathUtils.lerp(0.14, 0.62, daylight),
      THREE.MathUtils.lerp(0.22, 0.72, daylight)
    );
    mat.uniforms.uFogColor.value.copy(scene.fog.color);
    mat.uniforms.uFogDensity.value = scene.fog.density;
    mat.uniforms.uNight.value = night;
  }

  // water uniforms
  if (water) {
    const wmat = water.material;
    const sunDir = new THREE.Vector3().copy(sun.position).normalize();
    const moonDir = new THREE.Vector3().copy(moon.position).normalize();

    const specDir = new THREE.Vector3().copy(sunDir).lerp(moonDir, night).normalize();
    const specCol = new THREE.Color().copy(sun.color).lerp(new THREE.Color(0x9db6ff), night);

    wmat.uniforms.uSunDir.value.copy(specDir);
    wmat.uniforms.uSunColor.value.copy(specCol);
    wmat.uniforms.uNight.value = night;
  }

  // ✅ Cute moon sphere: position + fade + pulse
  if (moonBall) {
    const moonDir = new THREE.Vector3().copy(moon.position).normalize();
    const moonDist = WORLD.dayNight.sunRadius * WORLD.moonBall.distanceMul;

    moonBall.position.copy(moonDir).multiplyScalar(moonDist);

    const fade = THREE.MathUtils.smoothstep(night, WORLD.moonBall.fadeInAtNight, WORLD.moonBall.fadeFullAtNight);

    moonBall.material.opacity = WORLD.moonBall.baseOpacity + WORLD.moonBall.maxExtraOpacity * fade;
    moonBall.visible = fade > 0.02;

    const pulse = 1.0 + WORLD.moonBall.pulseAmp * Math.sin(t * WORLD.moonBall.pulseSpeed);
    moonBall.scale.setScalar(pulse);
  }
}

// -------------------- Shockwave propagation bending --------------------
function applyShockwaveBends(tNow) {
  if (!treeData || treeData.length === 0) return;
  if (shockwaves.length === 0) return;

  const speed = WORLD.shockwave.speed;
  const life = WORLD.shockwave.life;
  const band = WORLD.shockwave.bendBand;
  const strength = WORLD.shockwave.bendStrength;

  for (let si = 0; si < shockwaves.length; si++) {
    const sw = shockwaves[si];
    const age = tNow - sw.t0;
    if (age < 0 || age > life) continue;

    const ringR = age * speed;
    const fade = 1.0 - smooth01(age / life);

    for (let i = 0; i < treeData.length; i++) {
      const tr = treeData[i];
      const dx = tr.x - sw.x;
      const dz = tr.z - sw.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const diff = Math.abs(dist - ringR);
      if (diff > band) continue;

      const impulse = (1.0 - diff / band) * fade * strength;
      tr.bend = Math.max(tr.bend, impulse);
    }
  }
}

// -------------------- Time --------------------
const clock = new THREE.Clock();
let tAcc = 0;
function timeNow() {
  return tAcc;
}

// -------------------- Meteor triggers (no click/touch) --------------------
function triggerRandomMeteor() {
  const half = WORLD.size * 0.5 * 0.92;
  const x = randRange(-half, half);
  const z = randRange(-half, half);
  startMeteorStrike(x, z, timeNow());
}

meteorBtn.addEventListener('click', () => triggerRandomMeteor());

// -------------------- Keyboard controls --------------------
addEventListener('keydown', (e) => {
  if (e.code === 'Space') triggerRandomMeteor();

  if (e.code === 'KeyR') {
    craterStamps.length = 0;
    destroyedScore = 0;
    scoreEl.textContent = '0';
    refreshTerrainGeometry();
  }

  if (e.code === 'KeyE') {
    WORLD.quake.enabled = !WORLD.quake.enabled;
    if (!WORLD.quake.enabled) resetTerrainToBase();
  }

  if (e.code === 'KeyQ') {
    quakeBurstUntil = Math.max(quakeBurstUntil, timeNow() + WORLD.quake.burstSeconds);
  }
});

// -------------------- Animate --------------------
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(0.033, clock.getDelta());
  tAcc += dt;
  const t = tAcc;

  if (WORLD.dayNight.enabled) applyDayNightCycle(t);

  // let OrbitControls compute normal camera state first (damping/zoom)
  controls.update();

  // quake
  const q = quakeStrength(t);

  if (q > 0) {
    applyTerrainEarthquake(t, dt);
  } else {
    if (!WORLD.quake.enabled) resetTerrainToBase();
  }

  // water ripples + agitation
  if (water) {
    water.material.uniforms.uTime.value = t;
    water.material.uniforms.uAgitate.value = 1.0 + q * (WORLD.quake.waterBoost - 1.0);
  }

  // shockwave lifecycle
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    if (t - shockwaves[i].t0 > WORLD.shockwave.life) shockwaves.splice(i, 1);
  }
  updateRingUniforms(t);
  applyShockwaveBends(t);

  // meteor update
  if (activeMeteor) {
    activeMeteor.y -= activeMeteor.v * dt;

    meteor.position.set(activeMeteor.x, activeMeteor.y, activeMeteor.z);
    meteor.rotation.y += dt * 3.2;
    meteor.rotation.x += dt * 2.1;

    meteorTrail.position.set(activeMeteor.x, activeMeteor.y - 9, activeMeteor.z);
    meteorTrail.material.opacity = Math.max(
      0,
      meteorTrail.material.opacity - dt * (1.0 / WORLD.meteor.trailLife)
    );

    const ground = terrainHeightAt(activeMeteor.x, activeMeteor.z) + 1.2;
    if (activeMeteor.y <= ground) {
      impactAt(activeMeteor.x, activeMeteor.z, t);
      meteor.visible = false;
      meteorTrail.visible = false;
      activeMeteor = null;
    } else {
      meteorTrail.material.opacity = Math.min(0.75, meteorTrail.material.opacity + dt * 2.2);
    }
  }

  // debris update
  updateDebris(dt);

  // trees sway + bend (+ quake wobble)
  if (forest && treeData.length > 0) {
    const tmp = new THREE.Object3D();
    const quakeTreeBoost = 1.0 + q * (WORLD.quake.treeBoost - 1.0);

    for (let i = 0; i < forest.count; i++) {
      const tr = treeData[i];

      const sway =
        0.22 *
        Math.sin(t * 0.9 + tr.x * 0.05 + tr.z * 0.04) *
        (0.65 + 0.35 * Math.sin(t * 0.33 + tr.x * 0.02));

      const qw =
        q *
        0.22 *
        Math.sin(t * 6.2 + tr.x * 0.06 - tr.z * 0.05) *
        quakeTreeBoost;

      tr.bend *= 0.92;

      let bx = 0.0;
      let bz = 0.0;
      if (shockwaves.length > 0 && tr.bend > 0.001) {
        const s = shockwaves[shockwaves.length - 1];
        const dx = tr.x - s.x;
        const dz = tr.z - s.z;
        const len = Math.max(1e-6, Math.sqrt(dx * dx + dz * dz));
        bx = (dx / len) * tr.bend * 0.25;
        bz = (dz / len) * tr.bend * 0.25;
      }

      tmp.position.set(tr.x, tr.y - 0.18 * tr.s, tr.z);
      tmp.rotation.set(
        tr.leanX + sway * 0.12 + bz + qw,
        tr.yaw,
        tr.leanZ + sway * 0.1 - bx + qw
      );
      tmp.scale.set(tr.s, tr.s, tr.s);
      tmp.updateMatrix();

      forest.setMatrixAt(i, tmp.matrix);
    }
    forest.instanceMatrix.needsUpdate = true;
  }

  // OrbitControls-friendly camera shake: offsets for render only, then restore
  if (q > 0) {
    const basePos = camera.position.clone();
    const baseTarget = controls.target.clone();

    const ca = WORLD.quake.cameraAmp * q;
    const sx = (Math.sin(t * 23.0) + Math.sin(t * 17.0 + 1.7)) * 0.5;
    const sy = (Math.sin(t * 29.0 + 0.8) + Math.sin(t * 13.0)) * 0.5;
    const sz = (Math.sin(t * 19.0 + 2.2) + Math.sin(t * 11.0 + 0.4)) * 0.5;

    camera.position.set(basePos.x + sx * ca, basePos.y + sy * (ca * 0.7), basePos.z + sz * ca);
    controls.target.set(
      baseTarget.x + sx * (ca * 0.15),
      baseTarget.y + sy * (ca * 0.1),
      baseTarget.z + sz * (ca * 0.15)
    );

    renderer.render(scene, camera);

    camera.position.copy(basePos);
    controls.target.copy(baseTarget);
  } else {
    renderer.render(scene, camera);
  }

  stats.update();
}
animate();

// -------------------- Resize --------------------
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
