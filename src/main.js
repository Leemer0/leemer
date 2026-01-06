import * as entity_manager from './base/entity-manager.js';
import * as entity from './base/entity.js';

import {load_controller} from './base/load-controller.js';
import {spawners} from './game/spawners.js';

import {threejs_component} from './base/threejs-component.js';
import {THREE, RGBELoader} from './base/three-defs.js';
import { qualityManager } from './base/quality-settings.js';

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
import marketIntel1 from '@me_imgs/MarketIntel-1.png';
import marketIntel2 from '@me_imgs/MarketIntel-2.png';
import marketIntel3 from '@me_imgs/MarketIntel-3.png';
import marketIntel4 from '@me_imgs/MarketIntel-4.png';
import marketIntel5 from '@me_imgs/MarketIntel-5.png';
import oldPortfolioVideo from '@me_imgs/old_portfolio.mp4';

class QuickFPS1 {
  constructor() {
    this.is3DMode_ = false;
  }

  async Init() {
    // Show static landing page first
    this.ShowStaticLanding_();

    // Setup custom cursor for static mode too
    this.cursorEl_ = document.createElement('div');
    this.cursorEl_.className = 'custom-cursor';
    document.body.appendChild(this.cursorEl_);

    this.cursorPos_ = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.cursorTarget_ = { x: this.cursorPos_.x, y: this.cursorPos_.y };
    this.cursorSmooth_ = 0.15;

    window.addEventListener('mousemove', (e) => {
      this.cursorTarget_.x = e.clientX;
      this.cursorTarget_.y = e.clientY;
    }, false);

    // Start cursor animation loop (lightweight)
    this.AnimateCursor_();
  }

  ShowStaticLanding_() {
    const container = document.getElementById('container');
    container.innerHTML = `
      <div class="static-landing">
        <div class="grid-overlay"></div>

        <!-- Corner markers -->
        <span class="corner-mark tl">◈</span>
        <span class="corner-mark tr">◈</span>
        <span class="corner-mark bl">◈</span>
        <span class="corner-mark br">◈</span>

        <!-- Top labels -->
        <div class="top-labels">
          <span class="label-text">PORTFOLIO</span>
          <span class="label-text">◇</span>
          <span class="label-text">2025</span>
        </div>

        <!-- Main content -->
        <div class="static-content">
          <div class="title-container">
            <span class="glyph-left">⟨</span>
            <h1 class="static-name">Liam Elia</h1>
            <span class="glyph-right">⟩</span>
          </div>
        </div>

        <!-- Navigation -->
        <div class="static-nav">
          <button class="nav-item" id="static-projects-btn">
            <span class="nav-marker">○</span>
            <span class="nav-text">PROJECTS</span>
          </button>
          <a class="nav-item" href="https://www.linkedin.com/in/liam-elia" target="_blank" rel="noopener">
            <span class="nav-marker">○</span>
            <span class="nav-text">LINKEDIN</span>
          </a>
        </div>

        <!-- Bottom labels -->
        <div class="bottom-labels">
          <span class="label-text">TORONTO</span>
        </div>

        <!-- 3D Toggle -->
        <div class="toggle-3d-container">
          <video class="toggle-3d-video" src="${oldPortfolioVideo}" autoplay muted loop playsinline></video>
          <button class="toggle-3d-btn" id="toggle-3d-btn">
            <span class="toggle-3d-text">ENTER 3D MODE</span>
          </button>
          <span class="toggle-3d-warning">◁ PERFORMANCE WARNING ▷</span>
        </div>

        <!-- Side text -->
        <span class="side-text left">SYSTEMS · DESIGN · CODE</span>
        <span class="side-text right">EST. MMXXV</span>
      </div>
    `;

    // Setup static button handlers
    const projectsBtn = document.getElementById('static-projects-btn');
    const toggle3dBtn = document.getElementById('toggle-3d-btn');

    projectsBtn?.addEventListener('click', () => this.OpenProjectsOverlay_());
    projectsBtn?.addEventListener('mouseenter', () => this.cursorEl_?.classList.add('on-button'));
    projectsBtn?.addEventListener('mouseleave', () => this.cursorEl_?.classList.remove('on-button'));

    toggle3dBtn?.addEventListener('click', () => this.Enable3DMode_());
    toggle3dBtn?.addEventListener('mouseenter', () => this.cursorEl_?.classList.add('on-button'));
    toggle3dBtn?.addEventListener('mouseleave', () => this.cursorEl_?.classList.remove('on-button'));

    // LinkedIn button cursor
    const linkedinBtn = document.querySelector('.static-landing .nav-item[href]');
    linkedinBtn?.addEventListener('mouseenter', () => this.cursorEl_?.classList.add('on-button'));
    linkedinBtn?.addEventListener('mouseleave', () => this.cursorEl_?.classList.remove('on-button'));
  }

  async Enable3DMode_() {
    if (this.is3DMode_) return;
    this.is3DMode_ = true;

    // Show loading state
    const toggle3dBtn = document.getElementById('toggle-3d-btn');
    if (toggle3dBtn) {
      toggle3dBtn.innerHTML = '<span class="toggle-3d-text">Loading...</span>';
      toggle3dBtn.disabled = true;
    }

    // Load shaders and fonts
    await shaders.loadShaders();
    if (document?.fonts?.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }

    // Clear static landing
    const container = document.getElementById('container');
    container.innerHTML = '';

    // Hide static landing, show 3D elements
    document.body.classList.add('mode-3d');

    // Initialize 3D
    this.Initialize_();
  }

  AnimateCursor_() {
    requestAnimationFrame(() => {
      if (this.cursorEl_) {
        const lerp = (a, b, t) => a + (b - a) * t;
        const t = 0.15;
        this.cursorPos_.x = lerp(this.cursorPos_.x, this.cursorTarget_.x, t);
        this.cursorPos_.y = lerp(this.cursorPos_.y, this.cursorTarget_.y, t);
        this.cursorEl_.style.transform = `translate(${this.cursorPos_.x}px, ${this.cursorPos_.y}px)`;
      }

      // Only run lightweight cursor loop in static mode
      if (!this.is3DMode_) {
        this.AnimateCursor_();
      }
    });
  }

  Initialize_() {
    this.entityManager_ = entity_manager.EntityManager.Init();
    this.OnGameStarted_();
  }

  OnGameStarted_() {
    this.LoadControllers_();

    this.previousRAF_ = null;
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
      projectsBtn.addEventListener('touchstart', () => this.cursorEl_?.classList.add('on-button'), {passive: true});
      projectsBtn.addEventListener('touchend', () => this.cursorEl_?.classList.remove('on-button'));
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
      linkedinBtn.addEventListener('touchstart', () => this.cursorEl_?.classList.add('on-button'), {passive: true});
      linkedinBtn.addEventListener('touchend', () => this.cursorEl_?.classList.remove('on-button'));
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
      const isMobile = matchMedia('(max-width: 640px)').matches;
      const downwardOffset = isMobile ? 220 : 260; // push further down into the box
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
        <div class="projects-header">
          <span class="projects-title">Projects</span>
          <button class="projects-close" aria-label="Close">×</button>
        </div>
        <div class="projects-content">
          <nav class="projects-nav" id="project-list"></nav>
          <main class="projects-main" id="project-detail"></main>
        </div>
      `;
      document.body.appendChild(overlay);

      const closeEl = overlay.querySelector('.projects-close');
      closeEl?.addEventListener('click', () => this.CloseProjectsOverlay_());
      closeEl?.addEventListener('mouseenter', () => this.cursorEl_?.classList.add('on-button'));
      closeEl?.addEventListener('mouseleave', () => this.cursorEl_?.classList.remove('on-button'));
    }

    // Show overlay
    document.body.classList.add('projects-open');

    // Initialize project list (no particles - too heavy)
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
    // Remove overlay element completely
    const overlay = document.getElementById('projects-overlay');
    if (overlay?.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  PopulateProjectsList_() {
    const list = document.getElementById('project-list');
    if (!list) return;

    const projects = [
      { title: 'Strait of Hormuz', tag: 'Data' },
      { title: 'Market Intel', tag: 'AI Agents' },
      { title: 'Soulbeam.ai', tag: 'Voice AI' },
      { title: 'Storybook Generator', tag: 'GenAI' },
      { title: 'About Me', tag: '' },
    ];

    list.innerHTML = projects.map((p, i) => `
      <button class="project-btn${i === 0 ? ' active' : ''}" data-idx="${i}">
        <span class="project-title">${p.title}</span>
        ${p.tag ? `<span class="project-tag">${p.tag}</span>` : ''}
      </button>
    `).join('');

    // Click handlers
    list.querySelectorAll('.project-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        list.querySelectorAll('.project-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.ShowProjectDetail_(parseInt(btn.dataset.idx, 10));
      });
      btn.addEventListener('mouseenter', () => this.cursorEl_?.classList.add('on-button'));
      btn.addEventListener('mouseleave', () => this.cursorEl_?.classList.remove('on-button'));
    });

    this.ShowProjectDetail_(0);
  }

  ShowProjectDetail_(idx) {
    const panel = document.getElementById('project-detail');
    if (!panel) return;

    const projects = [
      // Strait of Hormuz
      {
        title: 'Strait of Hormuz Oil Trade',
        meta: 'Python • Data Pipeline',
        images: [straitChokepoint, chart1],
        desc: `
          <p>Built a Python bot that counts oil tanker traffic passing through a geo-fence in the Strait of Hormuz—the world's most critical chokepoint (~20% of global oil).</p>
          <p><b>AIS:</b> Automatic Identification System, GPS tracking for ships.</p>
          <p><b>What it does:</b> Tracks vessel crossings, logs shipment data, and correlates traffic patterns with crude oil price movements.</p>
          <p><b>Tools:</b> Python, MarineTraffic AIS API, ICE Brent price feeds, pandas.</p>
        `
      },
      // Market Intel
      {
        title: 'Market Intel',
        meta: 'Python • CrewAI • Multi-Agent',
        images: [marketIntel1, marketIntel3, marketIntel5],
        desc: `
          <p>5 AI agents analyze real-world data to assess market viability for new business locations.</p>
          <p><b>Agents:</b> Pricing Researcher (menu/delivery rates), Review Analyst (sentiment gaps), Hours Analyst (schedule gaps), Location Specialist (saturation %), Market Analyst (SWOT synthesis).</p>
          <p><b>Tools:</b> CrewAI orchestration, Apify (Google Places), Serper (real-time search).</p>
          <p><b>Skills:</b> Python, multi-agent systems, JSON data pipelines, Next.js + Mapbox frontend.</p>
        `
      },
      // Soulbeam
      {
        title: 'Soulbeam.ai',
        meta: 'Voice AI • Vector DB',
        images: [soulbeamHome, beamLanding],
        video: videoMp4,
        desc: `
          <p>Voice-first AI journal with real-time speech-to-speech conversations.</p>
          <p><b>Skills:</b> OpenAI Realtime API, vector database (pgvector) for memory retrieval, Three.js audio visualizer.</p>
          <p><b>Stack:</b> Next.js, Supabase + pgvector, WebRTC.</p>
        `
      },
      // Storybook
      {
        title: 'Storybook Generator',
        meta: 'Stable Diffusion • PyTorch',
        images: [storybookDiffusion, heroImg],
        desc: `
          <p>Generates printable children's storybooks from a single prompt or reference image.</p>
          <p><b>Skills:</b> Stable Diffusion, PyTorch, model fine-tuning for character consistency, ComfyUI workflows.</p>
          <p><b>Pipeline:</b> OpenAI for story generation, ComfyUI for art, PDF assembly.</p>
        `
      },
      // Me
      {
        title: 'About Me',
        meta: '',
        images: [travel1, travel2, travel3, travel4, travel5, travel6],
        desc: `
          <p>Avid learner and builder, love to explore new tools and technologies. Building side projects both digital and physical—currently working on a wood fire sauna. Learning by doing has been a profoundly impactful experience and essential to the work and lifestyle I want to have.</p>
          <p><b>Interests:</b> Muay thai, hiking, travel, running, tech, reading.</p>
          <p><b>Books I recommend:</b> Children of Time (Tchaikovsky), The Wager (Grann), Neuromancer (Gibson), Dune (Herbert).</p>
          <p><b>Gear I recommend:</b> Hisense Touch Lite (e-ink reader), Claude Code, ULA Ultralight 40L backpack, Sony XM5 headphones.</p>
        `
      }
    ];

    const p = projects[idx] || projects[0];

    panel.innerHTML = `
      <h2>${p.title}</h2>
      ${p.meta ? `<span class="detail-meta">${p.meta}</span>` : ''}
      <div class="detail-content">
        <div class="detail-media">
          ${p.video ? `<video src="${p.video}" autoplay muted loop playsinline></video>` : ''}
          ${p.images.map(img => `<img src="${img}" alt="">`).join('')}
        </div>
        <div class="detail-text">${p.desc}</div>
      </div>
    `;
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

      // Call RAF directly without setTimeout delay for proper frame pacing
      this.RAF_();
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