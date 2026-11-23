import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/+esm';
import { landmarksFromMediaPipe } from './gestures.js';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class DesktopHands {
  constructor({ video, canvas, onHands, onState }) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onHands = onHands;
    this.onState = onState;
    this.stream = null;
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.running = false;
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera erişimi kullanılamıyor. HTTPS veya localhost gereklidir.');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
    this.video.srcObject = this.stream;
    try { await this.video.play(); }
    catch (error) { await this.stop(); throw error; }
    try {
      const files = await FilesetResolver.forVisionTasks(WASM);
      this.landmarker = await HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
    } catch (gpuError) {
      try {
        const files = await FilesetResolver.forVisionTasks(WASM);
        this.landmarker = await HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      } catch (error) { await this.stop(); throw new Error(`MediaPipe başlatılamadı: ${error?.message || gpuError?.message || 'model yüklenemedi'}`); }
    }
    this.running = true;
    this.onState?.('active');
  }

  update() {
    if (!this.running || !this.landmarker || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    const result = this.landmarker.detectForVideo(this.video, performance.now());
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const hands = [];
    (result.landmarks || []).forEach((points, i) => {
      const category = result.handednesses?.[i]?.[0]?.categoryName || `hand-${i + 1}`;
      const hand = landmarksFromMediaPipe(points, category);
      if (hand) hands.push(hand);
      this.draw(points);
    });
    this.onHands?.(hands);
    if (!hands.length) this.onState?.('searching');
    else this.onState?.('active');
  }

  draw(points) {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.lineWidth = Math.max(2, w / 300); ctx.strokeStyle = '#c5eb75'; ctx.fillStyle = '#f0f5e9';
    const links = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
    for (const [a,b] of links) { ctx.beginPath(); ctx.moveTo(points[a].x*w, points[a].y*h); ctx.lineTo(points[b].x*w, points[b].y*h); ctx.stroke(); }
    for (const p of points) { ctx.beginPath(); ctx.arc(p.x*w, p.y*h, Math.max(2.5, w/150), 0, Math.PI*2); ctx.fill(); }
  }

  async stop() {
    this.running = false;
    this.landmarker?.close(); this.landmarker = null;
    this.stream?.getTracks().forEach((track) => track.stop()); this.stream = null;
    this.video.srcObject = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.onHands?.([]); this.onState?.('stopped');
  }
}

/** Shared normalized pinch classifier for webcam landmarks and WebXR joints. */
export const GESTURES = Object.freeze({ WALK: 'walk', TURN_RIGHT: 'turn-right', TURN_LEFT: 'turn-left', STOP: 'stop' });
const GESTURE_ORDER = [GESTURES.WALK, GESTURES.TURN_RIGHT, GESTURES.TURN_LEFT];

export class GestureEngine {
  constructor({ pressThreshold = 0.34, releaseThreshold = 0.48 } = {}) {
    this.pressThreshold = pressThreshold;
    this.releaseThreshold = releaseThreshold;
    this.pressed = new Map();
  }

  reset() { this.pressed.clear(); }

  update(hands = []) {
    const candidates = [];
    const visibleHands = new Set();
    for (const hand of hands) {
      if (!hand?.landmarks) continue;
      const handId = hand.id ?? 'hand';
      const p = hand.landmarks;
      const scale = distance(p.wrist, p.middleMcp);
      if (!Number.isFinite(scale) || scale < 1e-5) continue;
      visibleHands.add(handId);
      const distances = {
        [GESTURES.WALK]: distance(p.thumb, p.index) / scale,
        [GESTURES.TURN_RIGHT]: distance(p.thumb, p.little) / scale,
        [GESTURES.TURN_LEFT]: distance(p.thumb, p.ring) / scale
      };
      for (const gesture of GESTURE_ORDER) {
        const key = `${handId}:${gesture}`;
        const wasPressed = this.pressed.get(key) === true;
        const threshold = wasPressed ? this.releaseThreshold : this.pressThreshold;
        const active = Number.isFinite(distances[gesture]) && distances[gesture] <= threshold;
        this.pressed.set(key, active);
        if (active) candidates.push({ gesture, handId, normalizedDistance: distances[gesture] });
      }
    }
    for (const key of this.pressed.keys()) {
      if (!visibleHands.has(key.slice(0, key.lastIndexOf(':')))) this.pressed.delete(key);
    }
    // Deterministic priority prevents blended forward and turning movement.
    candidates.sort((a, b) => GESTURE_ORDER.indexOf(a.gesture) - GESTURE_ORDER.indexOf(b.gesture) || a.normalizedDistance - b.normalizedDistance);
    const winner = candidates[0];
    return winner ? { ...winner, active: true } : { gesture: GESTURES.STOP, handId: null, active: false };
  }
}

export function distance(a, b) {
  if (!a || !b) return Infinity;
  const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(dx, dy, dz);
}

export function landmarksFromMediaPipe(points, handedness = 'hand') {
  if (!points || points.length < 21) return null;
  const at = (i) => ({ x: points[i].x, y: points[i].y, z: points[i].z ?? 0 });
  return { id: handedness.toLowerCase(), landmarks: { wrist: at(0), thumb: at(4), index: at(8), middleMcp: at(9), ring: at(16), little: at(20) }, raw: points };
}

export function landmarksFromXR(joints, handedness = 'hand') {
  const required = ['wrist', 'thumb-tip', 'index-finger-tip', 'middle-finger-metacarpal', 'ring-finger-tip', 'little-finger-tip'];
  if (!required.every((key) => joints[key])) return null;
  const p = (key) => { const v = joints[key]; return { x: v.x, y: v.y, z: v.z }; };
  return { id: handedness.toLowerCase(), landmarks: { wrist: p(required[0]), thumb: p(required[1]), index: p(required[2]), middleMcp: p(required[3]), ring: p(required[4]), little: p(required[5]) } };
}

import { GESTURES } from './gestures.js';

export class Locomotion {
  constructor({ rig, camera, modelScale = 1 / 70, walkSpeed = 1.05, turnSpeed = 0.82 }) {
    this.rig = rig;
    this.camera = camera;
    this.modelScale = modelScale;
    this.walkSpeed = walkSpeed;
    this.turnSpeed = turnSpeed;
    this.current = { gesture: GESTURES.STOP, handId: null };
    this.forwardSpeed = 0;
    this.rotationSpeed = 0;
    this.home = { position: rig.position.clone(), rotationY: rig.rotation.y };
  }

  setGesture(result) { this.current = result ?? { gesture: GESTURES.STOP }; }

  update(dt, { immersive = false, forwardDirection = null } = {}) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.05);
    this.forwardSpeed = 0;
    this.rotationSpeed = 0;
    if (this.current.gesture === GESTURES.WALK) {
      const direction = this._direction ??= this.camera.position.clone();
      if (immersive && forwardDirection) direction.copy(forwardDirection).applyQuaternion(this.rig.quaternion);
      else this.camera.getWorldDirection(direction);
      direction.y = 0;
      if (direction.lengthSq() > 0) {
        direction.normalize();
        // Rig scale converts real-meter head/body motion into 1:70 model meters.
        const amount = this.walkSpeed * safeDt * (immersive ? 1 : this.modelScale);
        this.rig.position.x += direction.x * amount;
        this.rig.position.z += direction.z * amount;
        this.forwardSpeed = amount / (safeDt || 1);
      }
    } else if (this.current.gesture === GESTURES.TURN_RIGHT) {
      this.rig.rotation.y -= this.turnSpeed * safeDt;
      this.rotationSpeed = this.turnSpeed;
    } else if (this.current.gesture === GESTURES.TURN_LEFT) {
      this.rig.rotation.y += this.turnSpeed * safeDt;
      this.rotationSpeed = -this.turnSpeed;
    }
  }

  reset() {
    this.rig.position.copy(this.home.position);
    this.rig.rotation.set(0, this.home.rotationY, 0);
    this.setGesture({ gesture: GESTURES.STOP });
  }
}

# ScaleWalk — WebXR Hand Locomotion

Quest 3 Browser ve masaüstü tarayıcıları için statik, el kontrollü bir mimari keşif demosu. HTML, CSS ve JavaScript ES modules kullanır; Node.js sunucusu veya build adımı gerekmez. Three.js ve MediaPipe, sürümü sabitlenmiş CDN adreslerinden yüklenir.

## Çalıştırma

GitHub Pages’te depoyu **Settings → Pages** bölümünden `main` dalı ve `/ (root)` kaynağıyla yayınlayın. `index.html` kökte olduğundan proje URL’si alt dizinde olsa da göreceli uygulama yolları çalışır. HTTPS bağlantısını açın.

Yerel dosyayı `file://` ile açmak yerine HTTPS destekli statik önizleme ortamında sunun. Kamera erişimi güvenli bağlam gerektirir; `localhost` da güvenli bağlam kabul edilir.

### Quest 3

1. Quest 3 Browser’da yayımlanmış HTTPS bağlantısını açın.
2. Quest ayarlarında hand tracking’i etkinleştirin; uygulama kumanda girdisi istemez.
3. **Enter VR** düğmesine basıp tarayıcının isteğini kabul edin.
4. Başparmak + işaret parmağını yaklaştırıp tutarak ileri yürüyün. Başparmak + serçe sağa, başparmak + yüzük sola döndürür. Pinch bırakıldığında hareket durur.
5. VR’dan çıkınca oturum kapanışı masaüstü önizlemesine döner.

Bu proje gerçek bir Quest 3 üzerinde çalıştırılarak doğrulanmadı. `hand-tracking` opsiyoneldir; tarayıcı özelliği sağlamazsa durum paneli bildirir. `local-floor` yoksa `local` referans alanı denenir. Tarayıcı ve cihaz WebXR desteklemelidir.

### Masaüstü

1. **Start Camera** düğmesine basarak kamera iznini verin.
2. Elinizi görüntü üzerindeki kutuya alın. Landmark çizgileri ve hareket durumu canlı güncellenir.
3. İki el desteklenir. Kamera reddedilirse hata görünür. **Stop Camera** kamera izini kapatır.
4. 3D görünümde sürükleyerek bakış yönünü değiştirin; **Reset Position** başlangıç görünümüne döndürür.

MediaPipe modeli ilk açılışta CDN’den yüklenir. Kamera görüntüsü tarayıcıda işlenir.

## Kontroller

| Jest | Eylem |
| --- | --- |
| Başparmak + işaret parmağı pinch | Başın baktığı yatay yönde ileri hareket |
| Başparmak + serçe pinch | Dünya Y ekseninde sağa dönüş |
| Başparmak + yüzük pinch | Dünya Y ekseninde sola dönüş |
| El yok veya pinch yok | Hemen dur |

Pinch oranı, parmak uçları mesafesinin bilek ile orta parmak MCP eklemi arasındaki mesafeye oranıdır. Basma eşiği `0.34`, bırakma eşiği `0.48`; bu histerezis sınırda titreşmeyi azaltır. Birden fazla pinch olursa öncelik ileri, sağa, sola şeklindedir. El kadrajdan çıkınca jest sıfırlanır.

## 1:70 ölçek yöntemi

Modelin yerel birimi metre kabul edilir; mimari ölçüler tam boy ölçülerin `1/70` ile çarpılmış halidir. Örnek: gerçek 7 m oda sahnede `7 / 70 = 0.10` birim olur. Referans kişi boyu `1.70 / 70 = 0.02429`, göz yüksekliği `1.60 / 70 = 0.02286` sahne birimidir.

WebXR kafa pozu metre cinsinden alınır ve ham pose verisi değiştirilmez. Kamera `tracked-player-rig` parent grubunun altındadır; VR açılırken rig `1/70` ölçeğine alınır. Runtime’ın doğal baş dönüşü ve fiziksel hareketi korunur, standing/crouching hareketleri sabit bir göz yüksekliğine zorlanmaz. `local-floor` tercih edilir, yoksa `local` kullanılır.

Desktop kamerası model birimlerinde, ölçeklenmiş göz yüksekliğinde başlar. Hareket hızı iki modda aynı sahne ölçeğine karşılık gelir: XR’da rig’in ön-ölçek koordinatında hareket parent ölçeğiyle küçülür; desktop delta’sı doğrudan `1/70` ile küçültülür. Yürüme yönü kameranın yatay dünya yönünden alınır.

Kaynak tam boy `.glb`/`.gltf` dosyasını `?model=assets/models/atrium.glb` parametresiyle açabilirsiniz. Model loader `architecture` grubuna ekler ve `1/70` ile ölçekler.

## Dosya yapısı

```text
webxr-quest3/
├── index.html
├── css/style.css
├── js/
│   ├── main.js
│   ├── xr-manager.js
│   ├── hand-tracking.js
│   ├── gestures.js
│   ├── locomotion.js
│   ├── desktop-hands.js
│   └── architecture-loader.js
├── assets/models/
└── tests/
```

## Jest kontrolleri

`tests/gestures.test.html` sayfası eşik histerezisini, jest önceliğini, el kaybını ve landmark eşlemelerini bağımlılıksız biçimde çalıştırır.

## Sınırlar

CDN erişimi ve tarayıcı izinleri gerekir. WebXR ve kamera izni kullanıcı butonuna basınca istenir. Bu proje gerçek Quest 3 cihazında test edilmiş gibi sunulmaz; cihaz, tarayıcı ve CDN erişimiyle ayrıca denenmelidir.

import * as THREE from 'three';

export class XRManager {
  constructor({ renderer, camera, rig, onState, onHands, onPose }) {
    this.renderer = renderer;
    this.camera = camera;
    this.rig = rig;
    this.onState = onState;
    this.onHands = onHands;
    this.onPose = onPose;
    this.session = null;
    this.referenceSpace = null;
    this.handSupported = false;
  }

  async supported() {
    if (!navigator.xr) return false;
    try { return await navigator.xr.isSessionSupported('immersive-vr'); } catch { return false; }
  }

  async enter() {
    if (!navigator.xr) throw new Error('Bu tarayıcı WebXR sunmuyor. Quest 3 Browser veya WebXR destekli bir tarayıcı kullan.');
    if (!(await this.supported())) throw new Error('Immersive VR kullanılamıyor. HTTPS bağlantısını ve cihazın WebXR desteğini kontrol et.');
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking', 'local-floor'] });
    this.session = session;
    try {
      const features = Array.from(session.enabledFeatures ?? []);
      this.handSupported = features.includes('hand-tracking');
      this.renderer.xr.setReferenceSpaceType(features.includes('local-floor') ? 'local-floor' : 'local');
      await this.renderer.xr.setSession(session);
      try { this.referenceSpace = await session.requestReferenceSpace(features.includes('local-floor') ? 'local-floor' : 'local'); }
      catch { this.referenceSpace = await session.requestReferenceSpace('local'); }
    } catch (error) {
      this.session = null;
      try { await session.end(); } catch { /* Session may already be closed by the browser. */ }
      throw error;
    }
    session.addEventListener('end', () => this.handleEnd(), { once: true });
    this.onState?.({ active: true, handSupported: this.handSupported });
  }

  update(frame) {
    if (!this.session || !frame || !this.referenceSpace) return;
    const viewerPose = frame.getViewerPose(this.referenceSpace);
    if (viewerPose?.views?.length) {
      const orientation = viewerPose.views[0].transform.orientation;
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w));
      this.onPose?.(direction);
    }
    const hands = [];
    for (const source of this.session.inputSources) {
      if (!source.hand) continue;
      const joints = {};
      for (const [name, jointSpace] of source.hand.entries()) {
        const pose = frame.getJointPose(jointSpace, this.referenceSpace);
        if (pose) joints[name] = pose.transform.position;
      }
      hands.push({ handedness: source.handedness || 'hand', joints });
    }
    this.onHands?.(hands);
  }

  async handleEnd() {
    this.session = null;
    this.referenceSpace = null;
    this.onHands?.([]);
    this.onState?.({ active: false, handSupported: false });
  }

  async exit() { if (this.session) await this.session.end(); }
}
