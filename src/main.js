import * as entity_manager from './base/entity-manager.js';
import * as entity from './base/entity.js';

import {load_controller} from './base/load-controller.js';
import {spawners} from './game/spawners.js';

import {threejs_component} from './base/threejs-component.js';
import {THREE, RGBELoader} from './base/three-defs.js';

import * as render_sky_component from './game/render/render-sky-component.js';
import * as shaders from './game/render/shaders.js';
import travel1 from '@me_imgs/travel1.jpeg';
import travel2 from '@me_imgs/travel2.jpeg';
import travel3 from '@me_imgs/travel3.jpeg';
import travel4 from '@me_imgs/travel4.jpeg';
import travel5 from '@me_imgs/travel5.jpeg';
import travel6 from '@me_imgs/travel6.jpeg';

// Imported static assets (now in me_imgs and accessed via @me_imgs alias)
import straitChokepoint from '@me_imgs/strait-chokepoint.png';
import chart1 from '@me_imgs/chart1.png';
import star1 from '@me_imgs/star-1.png';
import videoMp4 from '@me_imgs/video.mp4';
import soulbeamHome from '@me_imgs/soulbeam-home.jpeg';
import beamLanding from '@me_imgs/beam-landingpage.png';
import storybookDiffusion from '@me_imgs/storybook-diffusion.jpeg';
import heroImg from '@me_imgs/hero_img.png';

class QuickFPS1 {
  constructor() {
  }

  async Init() {
    await shaders.loadShaders();
    // Ensure custom fonts are loaded before we create any canvas-based masks
    if (document && document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (_) {}
    }

    this.Initialize_();
  }

  Initialize_() {
    this.entityManager_ = entity_manager.EntityManager.Init();

    this.OnGameStarted_();
  }

  OnGameStarted_() {
    this.LoadControllers_();

    this.previousRAF_ = null;
    // Create custom cursor element
    this.cursorEl_ = document.createElement('div');
    this.cursorEl_.className = 'custom-cursor';
    document.body.appendChild(this.cursorEl_);

    this.cursorPos_ = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.cursorTarget_ = { x: this.cursorPos_.x, y: this.cursorPos_.y };
    this.cursorSmooth_ = 0.15; // lower is smoother

    window.addEventListener('mousemove', (e) => {
      this.cursorTarget_.x = e.clientX;
      this.cursorTarget_.y = e.clientY;
    }, false);
    this.RAF_();

    // Setup bottom shadow box button handlers
    this.InitializeButtons_();
  }

  InitializeButtons_() {
    // Setup button click handlers
    const projectsBtn = document.getElementById('projects-btn');
    const linkedinBtn = document.getElementById('linkedin-btn');

    if (projectsBtn) {
      projectsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.OpenProjectsOverlay_();
      });
      projectsBtn.addEventListener('mouseenter', () => this.cursorEl_?.classList.add('on-button'));
      projectsBtn.addEventListener('mouseleave', () => this.cursorEl_?.classList.remove('on-button'));
    }

    if (linkedinBtn) {
      linkedinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          // Open LinkedIn profile in new tab
          window.open('https://www.linkedin.com/in/liam-elia', '_blank', 'noopener');
        } catch (_) {}
      });
      linkedinBtn.addEventListener('mouseenter', () => this.cursorEl_?.classList.add('on-button'));
      linkedinBtn.addEventListener('mouseleave', () => this.cursorEl_?.classList.remove('on-button'));
    }

    // Start positioning the buttons within the grass frame
    this.UpdateButtonPositions_();
  }

  UpdateButtonPositions_() {
    const projectsBtn = document.getElementById('projects-btn');
    const linkedinBtn = document.getElementById('linkedin-btn');
    
    if (!projectsBtn || !linkedinBtn) return;

    // Pause positioning while projects overlay is open
    if (document.body.classList.contains('projects-open') || document.body.classList.contains('projects-opening')) {
      return;
    }

    try {
      // Get the grass component to access the frame positioning
      const grassEntity = this.entityManager_.FindEntity('grass');
      if (!grassEntity) return;

      const grassComponent = grassEntity.GetComponent('GrassComponent');
      if (!grassComponent) return;

      // Calculate button positions based on the cut mask transform
      // Position buttons inside the rectangular frame below the "LIAM ELIA" text
      // Trying much lower V values and testing coordinate system
      const projectsUV = { 
        u0: 0.35, v0: 0.40, // Left button area - trying lower V values
        u1: 0.47, v1: 0.46  
      };
      const linkedinUV = { 
        u0: 0.53, v0: 0.40, // Right button area - trying lower V values
        u1: 0.65, v1: 0.46  
      };

      // Convert UV coordinates to screen positions
      const convertUVToScreen = (uv) => {
        // Get current camera and frame transform parameters
        const camera = this.camera_;
        if (!camera) return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };

        // Calculate frame center position (similar to grass component logic)
        const camPos = camera.position;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const yaw = Math.atan2(forward.x, forward.z);
        const forwardXZ = new THREE.Vector2(forward.x, forward.z);
        if (forwardXZ.lengthSq() > 0) {
          forwardXZ.normalize();
        }
        
        const distanceAhead = 32;
        const offsetXZ = forwardXZ.clone().multiplyScalar(distanceAhead);
        const frameWorldX = camPos.x + offsetXZ.x;
        const frameWorldZ = camPos.z + offsetXZ.y;
        
        // Convert UV to world position within frame
        const worldWidth = 60 * 2.0; // cutMaskWorldBaseWidth * scale
        const worldHeight = worldWidth * 0.6; // approximate aspect
        
        const localX = (uv.u - 0.5) * worldWidth;
        const localZ = (uv.v - 0.5) * worldHeight;
        
        // Apply rotation
        const cr = Math.cos(yaw + Math.PI);
        const sr = Math.sin(yaw + Math.PI);
        const worldX = frameWorldX + cr * localX + sr * localZ;
        const worldZ = frameWorldZ - sr * localX + cr * localZ;
        
        // Project to screen coordinates
        const worldPos = new THREE.Vector3(worldX, camPos.y - 10, worldZ);
        const screenPos = worldPos.project(camera);
        
        return {
          x: (screenPos.x * 0.5 + 0.5) * window.innerWidth,
          y: (-screenPos.y * 0.5 + 0.5) * window.innerHeight
        };
      };

      // Position buttons
      const projectsCenter = {
        u: (projectsUV.u0 + projectsUV.u1) * 0.5,
        v: (projectsUV.v0 + projectsUV.v1) * 0.5
      };
      const linkedinCenter = {
        u: (linkedinUV.u0 + linkedinUV.u1) * 0.5,
        v: (linkedinUV.v0 + linkedinUV.v1) * 0.5
      };

      const projectsScreen = convertUVToScreen(projectsCenter);
      const linkedinScreen = convertUVToScreen(linkedinCenter);

      // Nudge buttons to sit centered within the grass box (eyeballed)
      const downwardOffset = 260; // push further down into the box
      const horizontalAdjust = -4; // tiny horizontal tweak for visual centering

      // Force the positioning with !important styles
      projectsBtn.style.setProperty('left', `${projectsScreen.x + horizontalAdjust}px`, 'important');
      projectsBtn.style.setProperty('top', `${projectsScreen.y + downwardOffset}px`, 'important');
      
      linkedinBtn.style.setProperty('left', `${linkedinScreen.x + horizontalAdjust}px`, 'important');
      linkedinBtn.style.setProperty('top', `${linkedinScreen.y + downwardOffset}px`, 'important');

    } catch (error) {
      // Fallback positioning if calculation fails - also move down
      const centerX = window.innerWidth * 0.5;
      const centerY = window.innerHeight * 0.5;
      
      projectsBtn.style.left = `${centerX - 80}px`;
      projectsBtn.style.top = `${centerY + 150}px`; // Moved further down
      
      linkedinBtn.style.left = `${centerX + 80}px`;
      linkedinBtn.style.top = `${centerY + 150}px`; // Moved further down
    }
  }

  OpenProjectsOverlay_() {
    if (document.body.classList.contains('projects-open')) return;

    const projectsBtn = document.getElementById('projects-btn');
    const linkedinBtn = document.getElementById('linkedin-btn');

    // Ensure inline positioning doesn't interfere
    if (projectsBtn) {
      projectsBtn.style.removeProperty('left');
      projectsBtn.style.removeProperty('top');
      projectsBtn.style.removeProperty('transform');
      projectsBtn.style.removeProperty('width');
      projectsBtn.style.removeProperty('height');
    }
    if (linkedinBtn) {
      linkedinBtn.style.removeProperty('left');
      linkedinBtn.style.removeProperty('top');
      linkedinBtn.style.removeProperty('transform');
    }

    // Create overlay once and reuse
    let overlay = document.getElementById('projects-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'projects-overlay';
      overlay.id = 'projects-overlay';
      overlay.innerHTML = `
        <div class="projects-title">PROJECTS</div>
        <div class="projects-close" role="button" aria-label="Close overlay" tabindex="0">×</div>
        <div class="projects-content">
          <div class="projects-left">
            <div id="projects-globe" class="projects-globe-canvas top-left"></div>
            <div id="project-detail" class="project-detail" aria-live="polite"></div>
          </div>
          <div class="projects-right">
            <h3>Selected Projects</h3>
            <ul class="project-list" id="project-list"></ul>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const closeEl = overlay.querySelector('.projects-close');
      closeEl?.addEventListener('click', () => this.CloseProjectsOverlay_());
      // Cursor hover reaction for close
      closeEl?.addEventListener('mouseenter', () => this.cursorEl_?.classList.add('on-button'));
      closeEl?.addEventListener('mouseleave', () => this.cursorEl_?.classList.remove('on-button'));
      closeEl?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          this.CloseProjectsOverlay_();
        }
      });
    }

    // Show overlay
    document.body.classList.add('projects-open');

    // Initialize particle field + project list
    try { this.InitProjectsParticles_(); } catch (_) {}
    try { this.PopulateProjectsList_(); } catch (_) {}

    this._escHandler_ = (ev) => {
      if (ev.key === 'Escape') this.CloseProjectsOverlay_();
    };
    window.addEventListener('keydown', this._escHandler_);

    // Controls removed
  }

  CloseProjectsOverlay_() {
    document.body.classList.remove('projects-open');
    if (this._escHandler_) {
      window.removeEventListener('keydown', this._escHandler_);
      this._escHandler_ = null;
    }
    // Remove overlay element completely to avoid any interaction blocking
    const overlay = document.getElementById('projects-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    // Dispose ECharts globe if present
    if (this._projectsGlobe_) {
      try {
        if (this._projectsGlobe_.timerId) clearInterval(this._projectsGlobe_.timerId);
        if (this._projectsGlobe_.onResize) window.removeEventListener('resize', this._projectsGlobe_.onResize);
        if (this._projectsGlobe_.chart) this._projectsGlobe_.chart.dispose();
      } catch (_) {}
      this._projectsGlobe_ = null;
    }

    // Dispose Three.js globe if present
    if (this._projectsThree_) {
      try {
        const { renderer, scene, overlayTexture, resizeHandler, rafId } = this._projectsThree_;
        if (rafId) cancelAnimationFrame(rafId);
        if (resizeHandler) window.removeEventListener('resize', resizeHandler);
        if (overlayTexture) overlayTexture.dispose?.();
        renderer?.dispose?.();
        scene?.traverse?.((obj) => {
          if (obj.geometry) obj.geometry.dispose?.();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
            else obj.material.dispose?.();
          }
        });
        if (this._projectsContoursTimer_) {
          try { this._projectsContoursTimer_.stop(); } catch (_) {}
          this._projectsContoursTimer_ = null;
        }
      } catch (_) {}
      this._projectsThree_ = null;
    }

    // Ensure buttons regain interactivity and position immediately
    const projectsBtn = document.getElementById('projects-btn');
    const linkedinBtn = document.getElementById('linkedin-btn');
    if (projectsBtn) {
      projectsBtn.style.removeProperty('pointer-events');
      projectsBtn.style.removeProperty('opacity');
    }
    if (linkedinBtn) {
      linkedinBtn.style.removeProperty('pointer-events');
      linkedinBtn.style.removeProperty('opacity');
    }

    // Force a reposition after closing
    try {
      this.UpdateButtonPositions_();
    } catch (_) {}
  }

  InitProjectsGlobeThree_() {}

  InitProjectsParticles_() {
    const container = document.getElementById('projects-globe');
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeHandler = () => resize();
    window.addEventListener('resize', resizeHandler);

    // Particles
    const num = 36000;
    const positions = new Float32Array(num * 3);
    const velocities = new Float32Array(num * 3);
    const disruptions = new Float32Array(num);
    for (let i = 0; i < num; i++) {
      const i3 = i * 3;
      positions[i3 + 0] = (Math.random() - 0.5) * 0.01;
      positions[i3 + 1] = (Math.random() - 0.5) * 0.01;
      positions[i3 + 2] = (Math.random() - 0.5) * 0.01;
      velocities[i3 + 0] = 0;
      velocities[i3 + 1] = 0;
      velocities[i3 + 2] = 0;
    }

    const geom = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('position', posAttr);

    // soft round sprite
    const dot = document.createElement('canvas');
    dot.width = 64; dot.height = 64;
    const dctx = dot.getContext('2d');
    const g = dctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    dctx.fillStyle = g;
    dctx.beginPath(); dctx.arc(32, 32, 32, 0, Math.PI * 2); dctx.fill();
    const dotTex = new THREE.CanvasTexture(dot);
    dotTex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 1;

    const mat = new THREE.PointsMaterial({
      color: 0xeef9ff,
      map: dotTex,
      size: 0.012,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      alphaMap: dotTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const points = new THREE.Points(geom, mat);
    // Slightly smaller overall scale
    points.scale.set(0.8, 0.8, 0.8);
    scene.add(points);

    // Shapes (targets)
    const golden = Math.PI * (3 - Math.sqrt(5));
    const genSphere = (count, radius) => {
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = golden * i;
        arr[i * 3 + 0] = Math.cos(theta) * r * radius;
        arr[i * 3 + 1] = y * radius;
        arr[i * 3 + 2] = Math.sin(theta) * r * radius;
      }
      return arr;
    };
    const genTorus = (count, R, r) => {
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const u = (i / count) * Math.PI * 2;
        const v = ((i * 7) % count) / count * Math.PI * 2; // decorrelate
        const x = (R + r * Math.cos(v)) * Math.cos(u);
        const y = (R + r * Math.cos(v)) * Math.sin(u);
        const z = r * Math.sin(v);
        arr[i * 3 + 0] = x;
        arr[i * 3 + 1] = z; // flip so ring is in XZ
        arr[i * 3 + 2] = y;
      }
      return arr;
    };
    const genCone = (count, radius, height) => {
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const h = t * height - height * 0.5;
        const r = radius * (1 - t);
        const a = golden * i;
        arr[i * 3 + 0] = Math.cos(a) * r;
        arr[i * 3 + 1] = h;
        arr[i * 3 + 2] = Math.sin(a) * r;
      }
      return arr;
    };
    const genCapsule = (count, radius, height) => {
      const arr = new Float32Array(count * 3);
      const half = Math.floor(count * 0.6);
      // cylinder
      for (let i = 0; i < half; i++) {
        const a = golden * i;
        const y = (i / half - 0.5) * height;
        arr[i * 3 + 0] = Math.cos(a) * radius;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = Math.sin(a) * radius;
      }
      // hemispheres
      for (let i = half; i < count; i++) {
        const j = i - half;
        const phi = Math.acos(1 - 2 * ((j % (count - half)) / (count - half)));
        const theta = golden * j;
        const s = Math.sin(phi);
        const x = Math.cos(theta) * s * radius;
        const z = Math.sin(theta) * s * radius;
        const y = Math.cos(phi) * radius + (j % 2 ? height * 0.5 : -height * 0.5);
        arr[i * 3 + 0] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
      return arr;
    };
    // Generate a 3D text shape by sampling a canvas alpha mask and extruding in Z with slight curvature
    const genText = (count, text, options = {}) => {
      const w = options.width || 1024;
      const h = options.height || 512;
      const planeWidth = options.planeWidth || 3.9;   // world units
      const planeHeight = options.planeHeight || 1.6; // world units
      const thickness = options.thickness || 0.6;
      const curvature = options.curvature || 0.18;    // bulge towards camera
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cx = c.getContext('2d');
      cx.clearRect(0, 0, w, h);
      cx.fillStyle = '#000';
      cx.fillRect(0, 0, w, h);
      cx.fillStyle = '#fff';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.font = options.font || 'bold 340px "IBM Plex Mono", monospace';
      cx.fillText(text, w * 0.5, h * 0.5 + (options.dy || 8));

      const data = cx.getImageData(0, 0, w, h).data;
      const pts = [];
      for (let y = 0; y < h; y += 2) { // sample every 2px for speed
        for (let x = 0; x < w; x += 2) {
          const a = data[(y * w + x) * 4 + 3];
          if (a > 128) {
            const u = x / (w - 1);
            const v = y / (h - 1);
            const px = (u - 0.5) * planeWidth;
            const py = (0.5 - v) * planeHeight;
            // extrude and add gentle convex curvature so it reads 3D
            let pz = (Math.random() - 0.5) * thickness;
            const nx = px / (planeWidth * 0.5);
            const ny = py / (planeHeight * 0.5);
            pz += curvature * (1 - Math.min(1, nx * nx + ny * ny));
            pts.push(px, py, pz);
          }
        }
      }
      const total = Math.max(1, Math.floor(pts.length / 3));
      const out = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const k = (i * Math.floor(total / count + 1)) % total;
        out[i * 3 + 0] = pts[k * 3 + 0];
        out[i * 3 + 1] = pts[k * 3 + 1];
        out[i * 3 + 2] = pts[k * 3 + 2];
      }
      return out;
    };
    // Generate an elongated 3D star analytically and extrude in Z
    const genStar = (count, options = {}) => {
      const spikes = options.spikes || 5;
      const inner = options.inner || 0.55;
      const outer = options.outer || 1.25;
      const radius = options.radius || 1.35;
      const elongY = options.elongY || 1.45;
      const thickness = options.thickness || 0.9;
      const jitter = options.jitter || 0.035;
      const arr = new Float32Array(count * 3);
      const step = Math.PI / spikes;
      for (let i = 0; i < count; i++) {
        // Use golden angle to cover angles uniformly
        const a = (i * (Math.PI * (3 - Math.sqrt(5)))) % (Math.PI * 2);
        // Triangular wave 0..1..0 across each spike pair to switch inner/outer
        const t = (a % (step * 2)) / step; // 0..2
        const tri = t < 1 ? t : 2 - t;     // 0..1..0
        // Base radius between inner and outer
        const rEdge = inner + (outer - inner) * tri;
        // Fill interior by mixing towards inner using random factor
        const fillMix = Math.pow(Math.random(), 0.6);
        const r = inner + (rEdge - inner) * fillMix;
        const rr = (radius * r) + (Math.random() - 0.5) * jitter;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr * elongY;
        // Extrusion with soft bulge (thicker near outer points)
        const bulge = 0.35 * (r - inner) / Math.max(0.0001, outer - inner);
        const z = (Math.random() - 0.5) * thickness + bulge;
        const i3 = i * 3;
        arr[i3 + 0] = x;
        arr[i3 + 1] = y;
        arr[i3 + 2] = z;
      }
      return arr;
    };
    const genBust = (count) => {
      // Rough bust: head sphere, neck cylinder, shoulder torus segment, chest ellipsoid
      const arr = new Float32Array(count * 3);
      const R = 2.36;
      const headCount = Math.floor(count * 0.38);
      const neckCount = Math.floor(count * 0.10);
      const shouldersCount = Math.floor(count * 0.28);
      const chestCount = count - headCount - neckCount - shouldersCount;

      // Head
      const headR = 0.72;
      const headY = 0.9;
      for (let i = 0; i < headCount; i++) {
        const y = 1 - (i / (headCount - 1)) * 2;
        const r = Math.sqrt(Math.max(0.000001, 1 - y * y));
        const theta = golden * i;
        arr[i * 3 + 0] = Math.cos(theta) * r * headR;
        arr[i * 3 + 1] = y * headR + headY;
        arr[i * 3 + 2] = Math.sin(theta) * r * headR;
      }

      // Neck (short cylinder)
      const neckR = 0.28;
      const neckH = 0.35;
      const neckBaseY = 0.55;
      for (let j = 0; j < neckCount; j++) {
        const a = golden * j;
        const t = j / Math.max(1, neckCount - 1);
        const y = neckBaseY + t * neckH;
        const x = Math.cos(a) * neckR;
        const z = Math.sin(a) * neckR;
        const i3 = (headCount + j) * 3;
        arr[i3 + 0] = x;
        arr[i3 + 1] = y;
        arr[i3 + 2] = z;
      }

      // Shoulders (torus segment around Y axis)
      const Rm = 1.25;
      const rm = 0.42;
      const shoulderY = 0.25;
      for (let k = 0; k < shouldersCount; k++) {
        const u = (k / shouldersCount) * (Math.PI * 1.6) - Math.PI * 0.8; // segment
        const v = (golden * k) % (Math.PI * 2);
        const x = (Rm + rm * Math.cos(v)) * Math.cos(u);
        const z = (Rm + rm * Math.cos(v)) * Math.sin(u);
        const y = rm * Math.sin(v) + shoulderY;
        const i3 = (headCount + neckCount + k) * 3;
        arr[i3 + 0] = x;
        arr[i3 + 1] = y;
        arr[i3 + 2] = z;
      }

      // Chest (lower ellipsoid)
      const aX = 0.95, aY = 0.65, aZ = 0.75;
      const chestY = -0.05;
      for (let m = 0; m < chestCount; m++) {
        const t = m / chestCount;
        const phi = Math.acos(1 - 2 * t); // 0..pi
        const theta = golden * m;
        const s = Math.sin(phi);
        const yNorm = Math.cos(phi);
        // use only bottom half more often
        const bias = m % 2 === 0 ? 0.75 : 0.4;
        const yScaled = (yNorm - bias);
        const i3 = (headCount + neckCount + shouldersCount + m) * 3;
        arr[i3 + 0] = Math.cos(theta) * s * aX;
        arr[i3 + 1] = yScaled * aY + chestY;
        arr[i3 + 2] = Math.sin(theta) * s * aZ;
      }

      return arr;
    };

    const targets = {
      sphere: genSphere(num, 2.35),
      cone: genCone(num, 1.8, 3.2),
      torus: genTorus(num, 1.8, 0.55),
      capsule: genCapsule(num, 1.0, 2.8),
      bust: genBust(num),
      star: null,
      me: null,
      coast: null,
    };
    // Smooth morph target that lerps towards selected shape
    const targetCurrent = new Float32Array(num * 3);
    let targetNext = targets.sphere;
    targetCurrent.set(targetNext);

    // Interaction
    const mouse = new THREE.Vector2(0, 0);
    const mouseWorld = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const raycaster = new THREE.Raycaster();
    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    const setShape = (key) => {
      if (key === 'me' && !targets.me) {
        // Build the text on demand
        targets.me = genText(num, 'me');
      }
      if (key === 'star' && !targets.star) {
        targets.star = genStar(num);
      }
      if (targets[key]) targetNext = targets[key];
    };

    // Build coastline target from world map edges
    const buildCoastTarget = async () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const url = 'https://fastly.jsdelivr.net/gh/apache/echarts-website@asf-site/examples/data-gl/asset/world.topo.bathy.200401.jpg';
      const done = new Promise((resolve) => { img.onload = resolve; });
      img.src = url;
      await done;

      const w = 1024, h = 512; // downsample for speed
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0, w, h);
      const data = cx.getImageData(0, 0, w, h).data;

      // Compute simple gradient strength per pixel
      const grad = new Float32Array(w * h);
      const idx = (x, y) => (y * w + x) * 4;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = idx(x, y);
          const r = data[i], g2 = data[i + 1], b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g2 + 0.114 * b;
          const iR = idx(x + 1, y), iD = idx(x, y + 1);
          const lumR = 0.299 * data[iR] + 0.587 * data[iR + 1] + 0.114 * data[iR + 2];
          const lumD = 0.299 * data[iD] + 0.587 * data[iD + 1] + 0.114 * data[iD + 2];
          const gx = Math.abs(lumR - lum);
          const gy = Math.abs(lumD - lum);
          grad[y * w + x] = gx + gy;
        }
      }

      // Collect edge pixels above threshold
      const points = [];
      const threshold = 28; // tweak for coastline contrast
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (grad[y * w + x] > threshold) {
            const u = x / (w - 1);
            const v = y / (h - 1);
            const lon = (u - 0.5) * Math.PI * 2;
            const lat = (v - 0.5) * Math.PI;
            const clat = Math.cos(lat);
            const radius = 2.36;
            points.push(radius * clat * Math.cos(lon), radius * Math.sin(lat), radius * clat * Math.sin(lon));
          }
        }
      }

      // Resample to exactly num points (uniform pick with stride)
      const coast = new Float32Array(num * 3);
      const total = Math.max(1, Math.floor(points.length / 3));
      for (let i = 0; i < num; i++) {
        const k = (i * Math.floor(total / num + 1)) % total;
        coast[i * 3 + 0] = points[k * 3 + 0];
        coast[i * 3 + 1] = points[k * 3 + 1];
        coast[i * 3 + 2] = points[k * 3 + 2];
      }
      targets.coast = coast;
      // Switch to coastline as soon as it's ready
      targetNext = targets.coast;
    };
    buildCoastTarget();
    // Build text target up front for responsiveness
    targets.me = genText(num, 'me');
    // Precompute star for instant switch
    targets.star = genStar(num);

    // Animate physics
    const spring = 0.016;          // slightly stronger spring
    const damping = 0.985;         // keep damping high
    const repulse = 0.25;          // unchanged
    const repulseRadius = 0.65;    // unchanged
    const disruptionDecay = 0.975; // unchanged
    const minReturnFactor = 0.15;  // unchanged
    const shapeLerp = 0.085;       // quicker morph blend
    const maxAccel = 0.006;        // allow a bit more acceleration
    const maxSpeed = 0.04;         // allow slightly higher speed
    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);

      // compute mouse world on z=0 plane
      raycaster.setFromCamera(mouse, camera);
      raycaster.ray.intersectPlane(plane, mouseWorld);

      // Smoothly blend target towards the chosen shape for non-bouncy morphs
      const N3 = num * 3;
      for (let i = 0; i < N3; i++) {
        targetCurrent[i] += (targetNext[i] - targetCurrent[i]) * shapeLerp;
      }

      for (let i = 0; i < num; i++) {
        const i3 = i * 3;
        const px = positions[i3 + 0];
        const py = positions[i3 + 1];
        const pz = positions[i3 + 2];

        // spring to target
        const tx = targetCurrent[i3 + 0];
        const ty = targetCurrent[i3 + 1];
        const tz = targetCurrent[i3 + 2];

        // Slow return if recently disrupted
        const returnFactor = minReturnFactor + (1.0 - minReturnFactor) * (1.0 - disruptions[i]);
        const effSpring = spring * returnFactor;
        let ax = (tx - px) * effSpring;
        let ay = (ty - py) * effSpring;
        let az = (tz - pz) * effSpring;

        // mouse repulsion
        const dx = px - mouseWorld.x;
        const dy = py - mouseWorld.y;
        const dz = pz - mouseWorld.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        let wasRepulsed = false;
        if (d2 < repulseRadius * repulseRadius) {
          const inv = 1.0 / Math.max(0.0001, d2);
          ax += dx * inv * repulse;
          ay += dy * inv * repulse;
          az += dz * inv * repulse;
          wasRepulsed = true;
          disruptions[i] = 1.0; // mark as disrupted
        } else {
          disruptions[i] *= disruptionDecay; // slowly calm down
        }

        // Clamp acceleration (avoid sudden bursts)
        const aLen = Math.hypot(ax, ay, az);
        if (aLen > maxAccel) {
          const s = maxAccel / aLen;
          ax *= s; ay *= s; az *= s;
        }

        // Integrate with heavy damping
        let vx = (velocities[i3 + 0] + ax) * damping;
        let vy = (velocities[i3 + 1] + ay) * damping;
        let vz = (velocities[i3 + 2] + az) * damping;

        // Clamp velocity to keep motion chill
        const vLen = Math.hypot(vx, vy, vz);
        if (vLen > maxSpeed) {
          const s = maxSpeed / vLen;
          vx *= s; vy *= s; vz *= s;
        }

        velocities[i3 + 0] = vx;
        velocities[i3 + 1] = vy;
        velocities[i3 + 2] = vz;

        positions[i3 + 0] += velocities[i3 + 0];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];
      }

      geom.attributes.position.needsUpdate = true;
      points.rotation.y += 0.0005; // a touch faster
      renderer.render(scene, camera);
    };
    animate();

    this._projectsThree_ = {
      ...(this._projectsThree_ || {}),
      renderer, scene, points, rafId, resizeHandler,
      positions, velocities, targets,
      setShape
    };
  }


  // Public helpers: tweak earth tint and contour color at runtime
  SetEarthTint_(hexColor) {
    if (!this._projectsThree_?.globeMat) return;
    try {
      this._projectsThree_.globeMat.color = new THREE.Color(hexColor);
      this._projectsThree_.globeMat.needsUpdate = true;
    } catch (_) {}
  }

  SetContourColor_(hexColor) {
    if (!this._projectsThree_?.contourCtx) return;
    try {
      const ctx = this._projectsThree_.contourCtx;
      ctx.strokeStyle = hexColor;
      ctx.fillStyle = hexColor;
    } catch (_) {}
  }

  PopulateProjectsList_() {
    const list = document.getElementById('project-list');
    if (!list) return;

    const projects = [
      { title: 'Strait of Hormuz Oil Trade Dashboard', url: '#' },
      { title: 'Soulbeam.ai', url: '#' },
      { title: 'Storybook Generator', url: '#' },
      { title: 'Me', url: '#' },
    ];

    list.innerHTML = projects.map((p, i) => `
      <li class="project-item"><a href="${p.url}" target="_blank" rel="noopener"><span class="idx">${String(i+1).padStart(2,'0')}</span>${p.title}<span class="arrow">→</span></a></li>
    `).join('');

    // Hook morphs: only switch when clicked (no hover switching)
    const items = Array.from(list.querySelectorAll('.project-item a'));
    // 1: Coast, 2: Elongated Star (Soulbeam), 3: Torus, 4: "me" text
    const shapeMap = ['coast', 'star', 'torus', 'me'];
    items.forEach((a, idx) => {
      const key = shapeMap[idx] || 'sphere';
      const handler = (ev) => {
        ev.preventDefault();
        this._projectsThree_?.setShape?.(key);
        this.ShowProjectDetail_(idx);
      };
      a.addEventListener('click', handler);
      // Cursor hover reaction for overlay items
      a.addEventListener('mouseenter', () => this.cursorEl_?.classList.add('on-button'));
      a.addEventListener('mouseleave', () => this.cursorEl_?.classList.remove('on-button'));
    });

    // Show first project's detail by default
    this.ShowProjectDetail_(0);
  }

  ShowProjectDetail_(idx) {
    const panel = document.getElementById('project-detail');
    if (!panel) return;
    const renderStraitOfHormuz = () => {
      panel.innerHTML = `
        <div class="pd-header">
          <h4>Strait of Hormuz Oil Trade</h4>
          <span class="meta">Tanker Transit Volume • 2019–2024</span>
        </div>
        <div class="pd-body">
          <div class="pd-media multi">
            <img src="${straitChokepoint}" alt="Strait of Hormuz oil tanker chokepoint map" />
            <img src="${chart1}" alt="Strait of Hormuz Passages and Oil Price chart" />
          </div>
          <div class="pd-desc">
            <p><b>Context</b>: Amid Iran–U.S./Israel tensions and the risk of a temporary closure, I explored how crude flows through the Strait of Hormuz relate to oil prices.</p>
            <p><b>Method</b>: I tested correlation using historical daily data — tanker counts from MarineTraffic public APIs (AIS network) and ICE Brent settlements. I aligned timestamps, de‑noised with a 7‑day moving average, and computed Pearson r across lags to check lead/lag effects.</p>
            <p><b>🎯 Overview</b></p>
            <p>The Strait of Hormuz handles approximately 20% of global oil trade (~20 million barrels/day). Normal vessel traffic ranges from 100–120 vessels per day. This monitoring system:</p>
            <ul>
              <li><b>Monitors</b>: Real-time AIS data from the Strait of Hormuz (26.5°N, 56°E, 50km radius).</li>
              <li><b>Alerts</b>: Sends SMS/email notifications when vessel count drops below 80/day.</li>
              <li><b>Logs</b>: Continuous data logging to CSV with timestamp and status.</li>
            </ul>
            <ul>
              <li><b>Historical test</b>: 2019–2024 daily series show a moderate correlation (r≈0.4–0.5), peaking around a +2 day price lag, consistent with markets reacting to flow changes.</li>
              <li><b>Tracking</b>: Built a geofence polygon around the Strait and counted north/southbound crude/chem tankers per day via the MarineTraffic AIS feed; de‑duplicated by MMSI/IMO and direction to reduce noise.</li>
              <li><b>Alerts</b>: A small worker tallies daily passages and sends me an SMS summary with counts, anomaly flags vs 90‑day baseline, and a 7‑day average.</li>
            </ul>
            <p class="note">Data sources: MarineTraffic (AIS public API) and ICE Brent. This demo view uses mocked data; production runs use cached API pulls within rate limits.</p>
          </div>
        </div>
      `;
    };

    const renderSoulbeam = () => {
      panel.innerHTML = `
        <div class="pd-header">
          <h4 class="small">Soulbeam.ai</h4>
          <span class="meta">Personal AI journal • Speech-to-speech</span>
        </div>
        <div class="pd-body">
          <div class="pd-media multi">
            <img class="logo" src="${star1}" alt="Soulbeam star symbol" />
            <video class="demo" src="${videoMp4}" poster="${soulbeamHome}" autoplay playsinline muted loop></video>
            <img class="screenshot" src="${beamLanding}" alt="Soulbeam landing page" />
          </div>
          <div class="pd-desc">
            <p><b>Summary</b>: A voice-first personal journal that converses with you in real time and turns daily reflections into lightweight insights.</p>
            <ul>
              <li><b>Realtime voice</b>: Speech-to-speech conversations via the OpenAI Realtime API.</li>
              <li><b>Insights</b>: Sentiment and simple pattern surfacing from journal sessions.</li>
              <li><b>Memory</b>: Remembers goals and threads to revisit across days.</li>
              <li><b>Status</b>: Prototype UI and audio journal flow (see screenshots).</li>
            </ul>
            <p><b>Tech</b></p>
            <ul>
              <li><b>Stack</b>: Next.js front-end with a small Node service; Three.js reactive voice visualizer; Supabase for auth/data.</li>
              <li><b>LLM</b>: OpenAI Realtime API for duplex voice; transcription, summarization, and sentiment via text endpoints.</li>
              <li><b>Memory</b>: Supabase Postgres + pgvector for long-term embeddings; short-term session state; retrieval-augmented prompting.</li>
              <li><b>Prompting</b>: Prompt/eval harness for few-shot tests, safety checks, and latency/quality tracking.</li>
              <li><b>Data</b>: Private local cache with periodic sync and export.</li>
            </ul>
            <p class="note">Focus is calm technology: minimal UI, voice-first interaction, and privacy-first storage backed by a lightweight service.</p>
          </div>
        </div>
      `;
    };

    const renderStorybook = () => {
      panel.innerHTML = `
        <div class="pd-header">
          <h4>Storybook Generator</h4>
          <span class="meta">LLM + Image generation pipeline • 2023–2024</span>
        </div>
        <div class="pd-body">
          <div class="pd-media multi">
            <img src="${storybookDiffusion}" alt="ComfyUI workflow for consistent character generation" />
            <img src="${heroImg}" alt="Personalized storybook cover example" />
          </div>
          <div class="pd-desc">
            <p><b>Summary</b>: A generator that turns a prompt or reference image into a printable children's storybook.</p>
            <ul>
              <li><b>Inputs</b>: User provides a text description and/or an image, picks book size and story style.</li>
              <li><b>Text</b>: Story drafted with OpenAI (chapters, page beats, captions, back-cover copy).</li>
              <li><b>Images</b>: Generative image workflows (ComfyUI) produce character designs and per-page art; style is kept consistent across pages.</li>
              <li><b>Consistency</b>: ComfyUI graph enforces a character sheet (prompt tokens + palette), seed locking, and reference-image guidance so the protagonist remains recognizable page-to-page.</li>
              <li><b>Assembly</b>: Assets are paginated and typeset into a print-ready PDF.</li>
              <li><b>Delivery</b>: PDF is sent to an on-demand printer API for fulfillment and shipping.</li>
            </ul>
            <p class="note">What I learned: basics of how these models work, prompt design and ComfyUI workflows for consistent characters, and how to shape a practical product and fulfillment model.</p>
          </div>
        </div>
      `;
    };

    const renderMe = () => {
      panel.innerHTML = `
        <div class="pd-header">
          <h4 class="small">Me</h4>
        </div>
        <div class="pd-body">
          <div class="pd-media multi" id="me-media"></div>
          <div class="pd-desc">
            <h4>Books</h4>
            <ul class="book-list">
              <li>Children of Time — Adrian Tchaikovsky</li>
              <li>Lonesome Dove — Larry McMurtry</li>
              <li>Neuromancer — William Gibson</li>
              <li>Benjamin Franklin: An American Life — Walter Isaacson</li>
              <li>Do Androids Dream of Electric Sheep? — Philip K. Dick</li>
              <li>Dune — Frank Herbert</li>
              <li>The Wager: A Tale of Shipwreck, Mutiny and Murder — David Grann</li>
            </ul>
            <p>I like travelling, and building things, either with my hands or on my laptop, muay thai and training, coached sailing with kids for years, hiking and camping.</p>
          </div>
        </div>
      `;
      const media = document.getElementById('me-media');
      if (media) {
        const images = [travel1, travel2, travel3, travel4, travel5, travel6];
        images.forEach((src) => {
          const img = document.createElement('img');
          img.src = src;
          img.alt = 'Travel photo';
          img.style.width = '100%';
          img.style.height = 'auto';
          img.style.borderRadius = '6px';
          img.style.display = 'block';
          img.style.marginBottom = '8px';
          media.appendChild(img);
        });
      }
    };

    switch (idx) {
      case 0: renderStraitOfHormuz(); break;
      case 1: renderSoulbeam(); break;
      case 2: renderStorybook(); break;
      case 3: renderMe(); break;
      default:
        panel.innerHTML = `
          <div class="pd-header"><h4>Project</h4><span class="meta">Details coming soon</span></div>
          <div class="pd-body"><div class="pd-media"></div><div class="pd-desc">Select a project to view details.</div></div>
        `;
        break;
    }
  }

  LoadControllers_() {
    const threejs = new entity.Entity('threejs');
    threejs.AddComponent(new threejs_component.ThreeJSController());
    threejs.Init();

    const sky = new entity.Entity();
    sky.AddComponent(new render_sky_component.RenderSkyComponent());
    sky.Init(threejs);

    // Hack
    this.camera_ = threejs.GetComponent('ThreeJSController').Camera;
    this.threejs_ = threejs.GetComponent('ThreeJSController');

    const loader = new entity.Entity('loader');
    loader.AddComponent(new load_controller.LoadController());
    loader.Init();

    const basicParams = {
      camera: this.camera_,
    };

    const spawner = new entity.Entity('spawners');
    spawner.AddComponent(new spawners.PlayerSpawner(basicParams));
    spawner.AddComponent(new spawners.DemoSpawner(basicParams));
    spawner.Init();

    spawner.GetComponent('PlayerSpawner').Spawn();
    spawner.GetComponent('DemoSpawner').Spawn();
  }

  RAF_() {
    requestAnimationFrame((t) => {
      if (this.previousRAF_ === null) {
        this.previousRAF_ = t;
      } else {
        this.Step_(t - this.previousRAF_);
        this.previousRAF_ = t;
      }

      setTimeout(() => {
        this.RAF_();
      }, 1);
    });
  }

  Step_(timeElapsed) {
    const timeElapsedS = Math.min(1.0 / 30.0, timeElapsed * 0.001);

    this.entityManager_.Update(timeElapsedS);

    this.threejs_.Render(timeElapsedS);

    // Smooth, flowy custom cursor movement
    if (this.cursorEl_) {
      const lerp = (a, b, t) => a + (b - a) * t;
      const t = 1.0 - Math.pow(1.0 - this.cursorSmooth_, timeElapsedS * 60.0);
      this.cursorPos_.x = lerp(this.cursorPos_.x, this.cursorTarget_.x, t);
      this.cursorPos_.y = lerp(this.cursorPos_.y, this.cursorTarget_.y, t);
      this.cursorEl_.style.transform = `translate(${this.cursorPos_.x}px, ${this.cursorPos_.y}px)`;
    }

    // Update button positions to follow the grass frame
    this.UpdateButtonPositions_();
  }
}


let _APP = null;

window.addEventListener('DOMContentLoaded', async () => {
  _APP = new QuickFPS1();
  await _APP.Init();
});
let a = 0;