import {THREE} from '../three-defs.js';

import * as shaders from '../../game/render/shaders.js';

import * as entity from "../entity.js";

import * as terrain_component from './terrain-component.js';
import * as math from '../math.js';



class InstancedFloat16BufferAttribute extends THREE.InstancedBufferAttribute {

	constructor( array, itemSize, normalized, meshPerAttribute = 1 ) {

		super( new Uint16Array( array ), itemSize, normalized, meshPerAttribute );

		this.isFloat16BufferAttribute = true;
	}
};

const M_TMP = new THREE.Matrix4();
const S_TMP = new THREE.Sphere();
const AABB_TMP = new THREE.Box3();


const NUM_GRASS = (32 * 32) * 3;
const GRASS_SEGMENTS_LOW = 1;
const GRASS_SEGMENTS_HIGH = 6;
const GRASS_VERTICES_LOW = (GRASS_SEGMENTS_LOW + 1) * 2;
const GRASS_VERTICES_HIGH = (GRASS_SEGMENTS_HIGH + 1) * 2;
const GRASS_LOD_DIST = 15;
const GRASS_MAX_DIST = 150;

const GRASS_PATCH_SIZE = 5 * 2;

const GRASS_WIDTH = 0.1;
const GRASS_HEIGHT = 1.5;
// Global time scale for wind-driven grass sway (lower = slower)
const WIND_TIME_SCALE = 0.6;



export class GrassComponent extends entity.Component {
  static CLASS_NAME = 'GrassComponent';

  get NAME() {
    return GrassComponent.CLASS_NAME;
  }

  #params_;
  #meshesLow_;
  #meshesHigh_;
  #group_;
  #totalTime_;
  #grassMaterialLow_;
  #grassMaterialHigh_;
  #geometryLow_;
  #geometryHigh_;
  #geometryLowExtra_;
  #geometryHighExtra_;
  #geometryLowExtra2_;
  #geometryHighExtra2_;
  #mouseWorld_;
  #raycaster_;
  #smoothedMouseWorld_;
  #mouseInitialized_;
  #cutMaskTexture_;
  #cutMaskCanvas_;
  #cutMaskCtx_;
  #cutMaskImageData_;
  #cutMaskSize_;
  #cutMaskBlockWidth_;
  #cutMaskBlockHeight_;
  #cutMaskWorldBaseWidth_;
  #cutMaskWorldScale_;


  constructor(params) {
    super();

    this.#params_ = params;
    this.#meshesLow_ = [];
    this.#meshesHigh_ = [];
    this.#group_ = new THREE.Group();
    this.#group_.name = "GRASS";
    this.#totalTime_ = 0;
    this.#grassMaterialLow_ = null;
    this.#grassMaterialHigh_ = null;
    this.#geometryLow_ = null;
    this.#geometryHigh_ = null;
    this.#geometryLowExtra_ = null;
    this.#geometryHighExtra_ = null;
    this.#mouseWorld_ = new THREE.Vector3();
    this.#raycaster_ = new THREE.Raycaster();
    this.#smoothedMouseWorld_ = new THREE.Vector3(0, -9999, 0);
    this.#mouseInitialized_ = false;
    this.#cutMaskTexture_ = null;
    this.#cutMaskCanvas_ = null;
    this.#cutMaskCtx_ = null;
    this.#cutMaskImageData_ = null;
    this.#cutMaskSize_ = 0;
    this.#cutMaskBlockWidth_ = 1;
    this.#cutMaskBlockHeight_ = 1;
    this.#cutMaskWorldBaseWidth_ = 60; // base world width for mask at scale 1.0
    this.#cutMaskWorldScale_ = 2.0;    // requested: double the size
  }

  Destroy() {
    for (let m of this.#meshesLow_) {
      m.removeFromParent();
    }
    for (let m of this.#meshesHigh_) {
      m.removeFromParent();
    }
    this.#group_.removeFromParent();

  }

  #CreateGeometry_(segments, seed = 0) {
    math.set_seed(seed);

    const VERTICES = (segments + 1) * 2;

    const indices = [];
    for (let i = 0; i < segments; ++i) {
      const vi = i * 2;
      indices[i*12+0] = vi + 0;
      indices[i*12+1] = vi + 1;
      indices[i*12+2] = vi + 2;

      indices[i*12+3] = vi + 2;
      indices[i*12+4] = vi + 1;
      indices[i*12+5] = vi + 3;

      const fi = VERTICES + vi;
      indices[i*12+6] = fi + 2;
      indices[i*12+7] = fi + 1;
      indices[i*12+8] = fi + 0;

      indices[i*12+9]  = fi + 3;
      indices[i*12+10] = fi + 1;
      indices[i*12+11] = fi + 2;
    }

    const offsets = [];
    for (let i = 0; i < NUM_GRASS; ++i) {
      offsets.push(math.rand_range(-GRASS_PATCH_SIZE * 0.5, GRASS_PATCH_SIZE * 0.5));
      offsets.push(math.rand_range(-GRASS_PATCH_SIZE * 0.5, GRASS_PATCH_SIZE * 0.5));
      offsets.push(0);
    }

    const offsetsData = offsets.map(THREE.DataUtils.toHalfFloat);

    const vertID = new Uint8Array(VERTICES*2);
    for (let i = 0; i < VERTICES*2; ++i) {
      vertID[i] = i;
    }

    const geo = new THREE.InstancedBufferGeometry();
    geo.instanceCount = NUM_GRASS;
    geo.setAttribute('vertIndex', new THREE.Uint8BufferAttribute(vertID, 1));
    geo.setAttribute('position', new InstancedFloat16BufferAttribute(offsetsData, 3));
    geo.setIndex(indices);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1 + GRASS_PATCH_SIZE * 2);

    return geo;
  }

  InitEntity() {
    const threejs = this.FindEntity('threejs').GetComponent('ThreeJSController');

    this.#grassMaterialLow_ = new shaders.GameMaterial('GRASS');
    this.#grassMaterialHigh_ = new shaders.GameMaterial('GRASS');
    this.#grassMaterialLow_.side = THREE.FrontSide;
    this.#grassMaterialHigh_.side = THREE.FrontSide;

    this.#geometryLow_ = this.#CreateGeometry_(GRASS_SEGMENTS_LOW, 0);
    this.#geometryHigh_ = this.#CreateGeometry_(GRASS_SEGMENTS_HIGH, 0);
    // Extra randomized geometry for denser grass inside mask
    this.#geometryLowExtra_ = this.#CreateGeometry_(GRASS_SEGMENTS_LOW, 1337);
    this.#geometryHighExtra_ = this.#CreateGeometry_(GRASS_SEGMENTS_HIGH, 1337);
    this.#geometryLowExtra2_ = this.#CreateGeometry_(GRASS_SEGMENTS_LOW, 4242);
    this.#geometryHighExtra2_ = this.#CreateGeometry_(GRASS_SEGMENTS_HIGH, 4242);

    // Create a canvas-based mask with text "LIAM ELIA" and a creative mountain scene
    // with sunset colors that complement the pink/warm tones
    const createCutMaskTexture = () => {
      const size = 2048; // higher-res mask for crisper details
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Background black (no cut)
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, size, size);
      
      // Draw: "LIAM" (first line), "ELIA" (second line), then creative mountain scene below
      ctx.fillStyle = '#fff';
      const fontSize = Math.floor(size * 0.11); // name size
      const lineHeight = Math.floor(fontSize * 1.15);
      // Use system font (no custom), italic bold
      const fontBig = `italic bold ${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.font = fontBig;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      // Slight outer stroke to thicken (thicker for clarity)
      ctx.lineWidth = Math.max(4, Math.floor(size * 0.006));
      ctx.strokeStyle = '#fff';
      // Optional: subtle blur (reduced to sharpen letters)
      ctx.shadowColor = 'rgba(255,255,255,0.45)';
      ctx.shadowBlur = Math.floor(size * 0.004);

      const line1 = 'LIAM';
      const line2 = 'ELIA';

      // Measure to compute block size (left-aligned but block centered)
      const w1 = ctx.measureText(line1).width;
      const w2 = ctx.measureText(line2).width;
      
      // Starburst (elongated vertically) planned to the right of the name block
      // Dimensions
      const nameMaxWidth = Math.max(w1, w2);
      const starGap = Math.floor(fontSize * 0.55);
      const starOuterY = Math.floor(fontSize * 0.55);
      const starAspectY = 2.0; // elongation along Y
      const starOuterX = Math.floor(starOuterY); // horizontal radius (no horizontal stretch)
      const starInnerR = Math.floor(starOuterY * 0.38);
      const starWidth = starOuterX * 2;

      // Button frame dimensions - better proportions
      const sceneWidth = Math.floor(nameMaxWidth * 1.1);
      const sceneHeight = Math.floor(fontSize * 0.9);
      
      const blockWidth = Math.max(nameMaxWidth + starGap + starWidth, sceneWidth);
      const blockHeight = Math.floor(lineHeight * 2 + sceneHeight + fontSize * 0.4);
      const originX = Math.floor((size - blockWidth) * 0.5);
      const originY = Math.floor((size - blockHeight) * 0.5) + fontSize; // baseline adjustment

      // Render name lines
      ctx.strokeText(line1, originX, originY);
      ctx.fillText(line1, originX, originY);
      // Move second line ("ELIA") slightly to the right
      const line2OffsetX = Math.floor(size * 0.04);
      ctx.strokeText(line2, originX + line2OffsetX, originY + lineHeight);
      ctx.fillText(line2, originX + line2OffsetX, originY + lineHeight);

      // Starburst to the right of the name block (centered vertically between LIAM and ELIA)
      {
        const starCX = originX + nameMaxWidth + starGap + starOuterX; // center x
        const starCY = originY + Math.floor(lineHeight * 0.45);
        ctx.save();
        // Sharper edges for the star
        const prevBlur = ctx.shadowBlur;
        ctx.shadowBlur = Math.floor(size * 0.0025);
        ctx.translate(starCX, starCY);
        ctx.scale(1.0, starAspectY);
        ctx.beginPath();
        const points = 4; // number of rays (4-point star)
        for (let i = 0; i < points * 2; i++) {
          const ang = (Math.PI * i) / points;
          const r = (i % 2 === 0) ? starOuterY : starInnerR;
          const x = Math.cos(ang) * r;
          const y = Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = prevBlur;
        ctx.restore();
      }

      // Simple geometric outline frame for housing actual UI buttons
      const frameOriginX = originX + Math.floor((blockWidth - sceneWidth) * 0.5);
      const frameOriginY = originY + Math.floor(lineHeight * 2.1);
      
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(12, Math.floor(size * 0.012)); // much thicker border
      ctx.fillStyle = 'transparent';
      
      // Clean rectangular frame with slight rounded corners
      const frameWidth = sceneWidth;
      const frameHeight = sceneHeight;
      const cornerRadius = Math.floor(sceneHeight * 0.1);
      
      ctx.beginPath();
      ctx.moveTo(frameOriginX + cornerRadius, frameOriginY);
      ctx.lineTo(frameOriginX + frameWidth - cornerRadius, frameOriginY);
      ctx.quadraticCurveTo(frameOriginX + frameWidth, frameOriginY, frameOriginX + frameWidth, frameOriginY + cornerRadius);
      ctx.lineTo(frameOriginX + frameWidth, frameOriginY + frameHeight - cornerRadius);
      ctx.quadraticCurveTo(frameOriginX + frameWidth, frameOriginY + frameHeight, frameOriginX + frameWidth - cornerRadius, frameOriginY + frameHeight);
      ctx.lineTo(frameOriginX + cornerRadius, frameOriginY + frameHeight);
      ctx.quadraticCurveTo(frameOriginX, frameOriginY + frameHeight, frameOriginX, frameOriginY + frameHeight - cornerRadius);
      ctx.lineTo(frameOriginX, frameOriginY + cornerRadius);
      ctx.quadraticCurveTo(frameOriginX, frameOriginY, frameOriginX + cornerRadius, frameOriginY);
      ctx.closePath();
      ctx.stroke();
      
      // Glass buttons are now 3D objects, just store their intended positions for interaction
      const buttonGap = Math.floor(frameWidth * 0.08);
      const buttonWidth = Math.floor((frameWidth - buttonGap * 3) * 0.5);
      const buttonHeight = Math.floor(frameHeight * 0.6);
      const buttonY = frameOriginY + Math.floor((frameHeight - buttonHeight) * 0.5);
      const projectsButtonX = frameOriginX + buttonGap;
      const linkedinButtonX = frameOriginX + buttonGap * 2 + buttonWidth;
      
      ctx.restore();

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.LinearSRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      
      // Store button coordinates for interactivity (normalized to canvas UV)
      const projectsRectUV = {
        u0: projectsButtonX / size,
        v0: buttonY / size,
        u1: (projectsButtonX + buttonWidth) / size,
        v1: (buttonY + buttonHeight) / size,
      };
      const linkedinRectUV = {
        u0: linkedinButtonX / size,
        v0: buttonY / size,
        u1: (linkedinButtonX + buttonWidth) / size,
        v1: (buttonY + buttonHeight) / size,
      };
      return { tex, canvas, ctx, size, blockWidth, blockHeight, projectsRectUV, linkedinRectUV };
    };

    {
      const r = createCutMaskTexture();
      this.#cutMaskTexture_ = r.tex;
      this.#cutMaskCanvas_ = r.canvas;
      this.#cutMaskCtx_ = r.ctx;
      this.#cutMaskSize_ = r.size;
      this.#cutMaskImageData_ = this.#cutMaskCtx_.getImageData(0, 0, this.#cutMaskSize_, this.#cutMaskSize_);
      this.#cutMaskBlockWidth_ = Math.max(1, r.blockWidth);
      this.#cutMaskBlockHeight_ = Math.max(1, r.blockHeight);

    }

    this.#grassMaterialLow_.setVec2('grassSize', new THREE.Vector2(GRASS_WIDTH, GRASS_HEIGHT));
    this.#grassMaterialLow_.setVec4('grassParams', new THREE.Vector4(
        GRASS_SEGMENTS_LOW, GRASS_VERTICES_LOW, this.#params_.height, this.#params_.offset));
    this.#grassMaterialLow_.setVec4('grassDraw', new THREE.Vector4(
        GRASS_LOD_DIST, GRASS_MAX_DIST, 0, 0));
    this.#grassMaterialLow_.setTexture('heightmap', this.#params_.heightmap);
    this.#grassMaterialLow_.setVec4('heightParams', new THREE.Vector4(this.#params_.dims, 0, 0, 0))
    this.#grassMaterialLow_.setVec3('grassLODColour', new THREE.Vector3(0, 0, 1));
    // Set cut mask uniforms
    this.#grassMaterialLow_.setTexture('cutMask', this.#cutMaskTexture_);
    this.#grassMaterialLow_.setFloat('cutMinScale', 0.18);
    this.#grassMaterialLow_.setFloat('cutFeather', 0.008);
    this.#grassMaterialLow_.setVec2('cutOffset', new THREE.Vector2(0, 0));
    {
      const aspect = this.#cutMaskBlockHeight_ / this.#cutMaskBlockWidth_;
      const worldWidth = this.#cutMaskWorldBaseWidth_ * this.#cutMaskWorldScale_;
      const worldHeight = worldWidth * aspect;
      this.#grassMaterialLow_.setVec2('cutScale', new THREE.Vector2(worldWidth, worldHeight));
    }
    this.#grassMaterialLow_.setFloat('cutRotation', 0.0);
    this.#grassMaterialLow_.setVec3('mousePos', new THREE.Vector3(0, -9999, 0));
    this.#grassMaterialLow_.setFloat('mouseRadius', 5.0);
    this.#grassMaterialLow_.setFloat('mouseStrength', 0.35);
    this.#grassMaterialLow_.alphaTest = 0.5;

    this.#grassMaterialHigh_.setVec2('grassSize', new THREE.Vector2(GRASS_WIDTH, GRASS_HEIGHT));
    this.#grassMaterialHigh_.setVec4('grassParams', new THREE.Vector4(
        GRASS_SEGMENTS_HIGH, GRASS_VERTICES_HIGH, this.#params_.height, this.#params_.offset));
    this.#grassMaterialHigh_.setVec4('grassDraw', new THREE.Vector4(
        GRASS_LOD_DIST, GRASS_MAX_DIST, 0, 0));
    this.#grassMaterialHigh_.setTexture('heightmap', this.#params_.heightmap);
    this.#grassMaterialHigh_.setVec4('heightParams', new THREE.Vector4(this.#params_.dims, 0, 0, 0))
    this.#grassMaterialHigh_.setVec3('grassLODColour', new THREE.Vector3(1, 0, 0));
    this.#grassMaterialHigh_.setTexture('cutMask', this.#cutMaskTexture_);
    this.#grassMaterialHigh_.setFloat('cutMinScale', 0.18);
    this.#grassMaterialHigh_.setFloat('cutFeather', 0.008);
    this.#grassMaterialHigh_.setVec2('cutOffset', new THREE.Vector2(0, 0));
    {
      const aspect = this.#cutMaskBlockHeight_ / this.#cutMaskBlockWidth_;
      const worldWidth = this.#cutMaskWorldBaseWidth_ * this.#cutMaskWorldScale_;
      const worldHeight = worldWidth * aspect;
      this.#grassMaterialHigh_.setVec2('cutScale', new THREE.Vector2(worldWidth, worldHeight));
    }
    this.#grassMaterialHigh_.setFloat('cutRotation', 0.0);
    this.#grassMaterialHigh_.setVec3('mousePos', new THREE.Vector3(0, -9999, 0));
    this.#grassMaterialHigh_.setFloat('mouseRadius', 5.0);
    this.#grassMaterialHigh_.setFloat('mouseStrength', 0.35);
    this.#grassMaterialHigh_.alphaTest = 0.5;

    threejs.AddSceneObject(this.#group_);



  }

  // Robust ray vs. heightfield intersection using stepping + bisection refinement
  #RaycastToTerrain_(ray) {
    try {
      const terrainComp = this.#params_.terrain.GetComponent(terrain_component.TerrainComponent.CLASS_NAME);
      const maxDistance = 300.0;
      const step = 2.0;
      let prevS = 0.0;
      let prevPos = ray.origin.clone();
      let prevF = prevPos.y - terrainComp.GetHeight(prevPos.x, prevPos.z);
      for (let s = step; s <= maxDistance; s += step) {
        const pos = ray.origin.clone().add(ray.direction.clone().multiplyScalar(s));
        const f = pos.y - terrainComp.GetHeight(pos.x, pos.z);
        if (f <= 0.0) {
          // bracketed; refine
          let aS = prevS, bS = s;
          for (let i = 0; i < 12; i++) {
            const mS = 0.5 * (aS + bS);
            const mPos = ray.origin.clone().add(ray.direction.clone().multiplyScalar(mS));
            const mF = mPos.y - terrainComp.GetHeight(mPos.x, mPos.z);
            if (mF > 0.0) aS = mS; else bS = mS;
          }
          const hitS = 0.5 * (aS + bS);
          return ray.origin.clone().add(ray.direction.clone().multiplyScalar(hitS));
        }
        prevS = s; prevPos = pos; prevF = f;
      }
    } catch (_) { return null; }
    return null;
  }

  #CreateMesh_(distToCell, extra = false) {
    const meshes = distToCell > GRASS_LOD_DIST ? this.#meshesLow_ : this.#meshesHigh_;
    if (meshes.length > 1000) {
      console.log('crap')
      return null;
    }

    const geo = distToCell > GRASS_LOD_DIST
        ? (extra ? this.#geometryLowExtra_ : this.#geometryLow_)
        : (extra ? this.#geometryHighExtra_ : this.#geometryHigh_);
    const mat = distToCell > GRASS_LOD_DIST ? this.#grassMaterialLow_ : this.#grassMaterialHigh_;

    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, 0, 0);
    m.receiveShadow = true;
    m.castShadow = false;
    m.visible = false;

    meshes.push(m);
    this.#group_.add(m);
    return m;
  }

  Update(timeElapsed) {
    this.#totalTime_ += timeElapsed;

    this.#grassMaterialLow_.setFloat('time', this.#totalTime_ * WIND_TIME_SCALE);
    this.#grassMaterialHigh_.setFloat('time', this.#totalTime_ * WIND_TIME_SCALE);

    const threejs = this.FindEntity('threejs').GetComponent('ThreeJSController');
    const camera = threejs.Camera;
    const frustum = new THREE.Frustum().setFromProjectionMatrix(M_TMP.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse));

    // Compute mouse world position on terrain
    const mouse = this.FindEntity('player').GetComponent('PlayerInput')?.current_;
    if (mouse) {
      const ndc = new THREE.Vector2(
        (mouse.mouseX + window.innerWidth / 2) / window.innerWidth * 2 - 1,
        -((mouse.mouseY + window.innerHeight / 2) / window.innerHeight * 2 - 1)
      );
      this.#raycaster_.setFromCamera(ndc, camera);
      // Intersect with XZ plane at y = terrain height under ray origin
      const ray = this.#raycaster_.ray;
      const terrainComp = this.#params_.terrain.GetComponent(terrain_component.TerrainComponent.CLASS_NAME);
      const guessY = terrainComp.GetHeight(ray.origin.x, ray.origin.z);
      const t = (guessY - ray.origin.y) / ray.direction.y;
      if (t > 0) {
        this.#mouseWorld_.copy(ray.direction).multiplyScalar(t).add(ray.origin);
      }

      // Smooth the mouse world position over time for flowy motion
      const smoothing = 0.001; // lower = smoother
      const lerpT = 1.0 - Math.pow(smoothing, timeElapsed);
      if (!this.#mouseInitialized_) {
        this.#smoothedMouseWorld_.copy(this.#mouseWorld_);
        this.#mouseInitialized_ = true;
      } else {
        this.#smoothedMouseWorld_.lerp(this.#mouseWorld_, lerpT);
      }

      this.#grassMaterialLow_.setVec3('mousePos', this.#smoothedMouseWorld_);
      this.#grassMaterialHigh_.setVec3('mousePos', this.#smoothedMouseWorld_);
    }

    // Keep cut text within current view by aligning mask to camera
    const camPos = camera.position;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const yaw = Math.atan2(forward.x, forward.z); // rotation around Y
    const forwardXZ = new THREE.Vector2(forward.x, forward.z);
    if (forwardXZ.lengthSq() > 0) {
      forwardXZ.normalize();
    }
    const distanceAhead = 32; // tuned to align debug planes over text
    const offsetXZ = forwardXZ.clone().multiplyScalar(distanceAhead);
    const rightXZ = new THREE.Vector2(forward.z, -forward.x).normalize();
    const lateralNudge = 0.0; // center it for predictable UVs while clicking
    const cutOffset = new THREE.Vector2(camPos.x, camPos.z)
        .add(offsetXZ)
        .add(rightXZ.clone().multiplyScalar(lateralNudge));
    const cutRotation = yaw + Math.PI; // face the camera (fix upside-down)
    const aspect = this.#cutMaskBlockHeight_ / this.#cutMaskBlockWidth_;
    const worldWidth = this.#cutMaskWorldBaseWidth_ * this.#cutMaskWorldScale_;
    const worldHeight = worldWidth * aspect;
    const cutScale = new THREE.Vector2(worldWidth, worldHeight);

    this.#grassMaterialLow_.setVec2('cutOffset', cutOffset);
    this.#grassMaterialHigh_.setVec2('cutOffset', cutOffset);
    this.#grassMaterialLow_.setVec2('cutScale', cutScale);
    this.#grassMaterialHigh_.setVec2('cutScale', cutScale);
    this.#grassMaterialLow_.setFloat('cutRotation', cutRotation);
    this.#grassMaterialHigh_.setFloat('cutRotation', cutRotation);



    const meshesLow = [...this.#meshesLow_];
    const meshesHigh = [...this.#meshesHigh_];

    const baseCellPos = camera.position.clone();
    baseCellPos.divideScalar(GRASS_PATCH_SIZE);
    baseCellPos.floor();
    baseCellPos.multiplyScalar(GRASS_PATCH_SIZE);

    // This is dumb and slow
    for (let c of this.#group_.children) {
      c.visible = false;
    }

    const terrain = this.#params_.terrain.GetComponent(terrain_component.TerrainComponent.CLASS_NAME);

    const cameraPosXZ = new THREE.Vector3(camera.position.x, 0, camera.position.z);
    const playerPos = this.FindEntity('player').Position;

    this.#grassMaterialHigh_.setVec3('playerPos', playerPos);
    // this.#grassMaterialHigh_.setVec3('cameraPos', camera.position);
    this.#grassMaterialHigh_.setMatrix('viewMatrixInverse', camera.matrixWorld);
    this.#grassMaterialLow_.setMatrix('viewMatrixInverse', camera.matrixWorld);
    // this.#grassMaterialLow_.setVec3('cameraPos', camera.position);


    // const playerCellPos = this.FindEntity('player').Position.clone();
    // playerCellPos.divideScalar(GRASS_PATCH_SIZE);
    // playerCellPos.round();
    // playerCellPos.multiplyScalar(GRASS_PATCH_SIZE);
    // const playerCellPos = new THREE.Vector3();

    // const m = meshesHigh.length > 0 ? meshesHigh.pop() : this.#CreateMesh_(0);
    // m.position.copy(playerCellPos);
    // m.position.y = 0;
    // m.visible = true;

    let totalGrass = 0;
    let totalVerts = 0;

    // Compute current cut transform aligned to camera (reuse for click mapping)

    // Helper to sample cut mask (0..1) at world XZ
    const sampleCutMask = (wx, wz) => {
      const dx = wx - cutOffset.x;
      const dz = wz - cutOffset.y;
      const cr = Math.cos(cutRotation);
      const sr = Math.sin(cutRotation);
      const rx = cr * dx - sr * dz;
      const rz = sr * dx + cr * dz;
      const u = rx / cutScale.x + 0.5;
      const v = rz / cutScale.y + 0.5;
      if (u < 0 || u > 1 || v < 0 || v > 1) {
        return 0;
      }
      const ix = Math.floor(u * (this.#cutMaskSize_ - 1));
      const iy = Math.floor((1 - v) * (this.#cutMaskSize_ - 1));
      const idx = (ix + iy * this.#cutMaskSize_) * 4;
      return this.#cutMaskImageData_.data[idx] / 255.0;
    };

    for (let x = -16; x < 16; x++) {
      for (let z = -16; z < 16; z++) {
        // Current cell
        const currentCell = new THREE.Vector3(
            baseCellPos.x + x * GRASS_PATCH_SIZE, 0, baseCellPos.z + z * GRASS_PATCH_SIZE);
        currentCell.y = terrain.GetHeight(currentCell.x, currentCell.z);

        AABB_TMP.setFromCenterAndSize(currentCell, new THREE.Vector3(GRASS_PATCH_SIZE, 1000, GRASS_PATCH_SIZE));
        const distToCell = AABB_TMP.distanceToPoint(cameraPosXZ);
        if (distToCell > GRASS_MAX_DIST) {
          continue;
        }

        if (x == 0 && z == 0) {
          let a = 0;
        }

        if (!frustum.intersectsBox(AABB_TMP)) {
          continue;
        }

        const insideMask = sampleCutMask(currentCell.x, currentCell.z) > 0.5;

        if (distToCell > GRASS_LOD_DIST) {
          const m = meshesLow.length > 0 ? meshesLow.pop() : this.#CreateMesh_(distToCell);
          m.position.copy(currentCell);
          m.position.y = 0;
          m.visible = true;
          totalVerts += GRASS_VERTICES_LOW;
          if (insideMask) {
            const m2 = meshesLow.length > 0 ? meshesLow.pop() : this.#CreateMesh_(distToCell, true);
            m2.position.copy(currentCell);
            m2.position.y = 0;
            m2.visible = true;
            totalVerts += GRASS_VERTICES_LOW;
            // Third pass for 3x density inside mask
            const m3 = meshesLow.length > 0 ? meshesLow.pop() : this.#CreateMesh_(distToCell, true);
            if (m3) {
              m3.geometry = this.#geometryLowExtra2_;
              m3.position.copy(currentCell);
              m3.position.y = 0;
              m3.visible = true;
              totalVerts += GRASS_VERTICES_LOW;
            }
          }
        } else {
          const m = meshesHigh.length > 0 ? meshesHigh.pop() : this.#CreateMesh_(distToCell);
          m.position.copy(currentCell);
          m.position.y = 0;
          m.visible = true;
          totalVerts += GRASS_VERTICES_HIGH;
          if (insideMask) {
            const m2 = meshesHigh.length > 0 ? meshesHigh.pop() : this.#CreateMesh_(distToCell, true);
            m2.position.copy(currentCell);
            m2.position.y = 0;
            m2.visible = true;
            totalVerts += GRASS_VERTICES_HIGH;
            // Third pass for 3x density inside mask
            const m3 = meshesHigh.length > 0 ? meshesHigh.pop() : this.#CreateMesh_(distToCell, true);
            if (m3) {
              m3.geometry = this.#geometryHighExtra2_;
              m3.position.copy(currentCell);
              m3.position.y = 0;
              m3.visible = true;
              totalVerts += GRASS_VERTICES_HIGH;
            }
          }
        }
        totalGrass += 1;
      }
    }

    totalGrass *= NUM_GRASS;
    totalVerts *= NUM_GRASS;
    // console.log('total grass: ' + totalGrass + ' total verts: ' + totalVerts);
  }
}