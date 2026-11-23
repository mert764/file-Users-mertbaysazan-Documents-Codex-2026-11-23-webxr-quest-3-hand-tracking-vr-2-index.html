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
