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
