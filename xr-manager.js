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
