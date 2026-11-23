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
