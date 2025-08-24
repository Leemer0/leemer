import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js';
import * as entity from '../base/entity.js';
import * as passes from '../base/passes.js';
import * as terrain_component from '../base/render/terrain-component.js';

export const third_person_camera = (() => {
  
  class ThirdPersonCamera extends entity.Component {
    static CLASS_NAME = 'ThirdPersonCamera';

    get NAME() {
      return ThirdPersonCamera.CLASS_NAME;
    }

    constructor(params) {
      super();

      this.params_ = params;
      this.camera_ = params.camera;

      this.currentPosition_ = new THREE.Vector3();
      this.currentLookat_ = new THREE.Vector3();
    }

    InitEntity() {
      this.SetPass(passes.Passes.CAMERA);
    }

    CalculateIdealOffset_() {
      // Angled top-down view (~70 degrees from horizontal)
      const height = 30;               // vertical height above player
      const tiltDegrees = 60;          // angle from horizontal
      const tiltRadians = THREE.MathUtils.degToRad(tiltDegrees);
      const horizontalDistance = height / Math.tan(tiltRadians);

      // Fixed world-space azimuth (looking from -Z towards +Z)
      const idealOffset = new THREE.Vector3(0, height, -horizontalDistance);
      // Keep independent of player rotation; do not apply Parent.Quaternion
      idealOffset.add(this.Parent.Position);

      return idealOffset;
    }

    CalculateIdealLookat_() {
      // Look at the player position (slightly above to reduce horizon clipping)
      const idealLookat = new THREE.Vector3(0, 1.0, 0);
      idealLookat.add(this.Parent.Position);
      return idealLookat;
    }

    Update(timeElapsed) {
      const terrain = this.FindEntity('terrain');
      if (terrain) {
        const terrainComponent = terrain.GetComponent(terrain_component.TerrainComponent.CLASS_NAME);
        if (!terrainComponent.IsReady()) {
          return;
        }

        const idealOffset = this.CalculateIdealOffset_();
        const idealLookat = this.CalculateIdealLookat_();
  
        const height = terrainComponent.GetHeight(idealOffset.x, idealOffset.z);
        // For bird's eye view, maintain higher altitude above terrain
        idealOffset.y = Math.max(idealOffset.y, height + 20);

        // const t = 0.05;
        // const t = 4.0 * timeElapsed;
        const t = 1.0 - Math.pow(0.0001, timeElapsed);
  
        this.currentPosition_.lerp(idealOffset, t);
        this.currentLookat_.lerp(idealLookat, t);
  
        this.camera_.position.copy(this.currentPosition_);
        this.camera_.lookAt(this.currentLookat_); 
      }
    }
  }

  return {
    ThirdPersonCamera: ThirdPersonCamera
  };

})();