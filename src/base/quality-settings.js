/**
 * Quality settings module for performance optimization
 * Detects device capabilities and provides quality tier settings
 */

// Quality tiers
export const QUALITY_TIER = {
  LOW: 'low',      // Mobile, low-end laptops
  MEDIUM: 'medium', // Work laptops, tablets
  HIGH: 'high',    // Desktop, gaming laptops
};

// Detect quality tier based on device characteristics
function detectQualityTier() {
  // Check for mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Check screen size
  const screenWidth = window.screen.width * (window.devicePixelRatio || 1);
  const isSmallScreen = screenWidth < 1920;

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Check hardware concurrency (CPU cores)
  const cpuCores = navigator.hardwareConcurrency || 4;
  const isLowCPU = cpuCores <= 4;

  // Check device memory if available
  const deviceMemory = navigator.deviceMemory || 4; // GB
  const isLowMemory = deviceMemory <= 4;

  // Determine tier
  if (isMobile || (isTouch && isSmallScreen)) {
    return QUALITY_TIER.LOW;
  }

  if (isLowCPU || isLowMemory || prefersReducedMotion) {
    return QUALITY_TIER.MEDIUM;
  }

  return QUALITY_TIER.HIGH;
}

// Quality settings per tier
const QUALITY_SETTINGS = {
  [QUALITY_TIER.LOW]: {
    // Grass settings
    grassInstanceCount: 1024,        // Reduced from 3072
    grassSegmentsLow: 1,
    grassSegmentsHigh: 3,            // Reduced from 6
    grassLodDist: 10,                // Reduced LOD distance
    grassMaxDist: 80,                // Reduced from 150
    grassMeshPoolCap: 128,           // Cap mesh pool
    grassExtraPasses: false,         // Disable triple-pass in mask

    // Shadow settings
    shadowMapSize: 1024,             // Reduced from 4096
    shadowsEnabled: true,

    // Particle settings
    particleCount: 12000,            // Reduced from 36000

    // Texture settings
    maxAnisotropy: 2,

    // Post-processing
    fxaaEnabled: false,

    // Renderer
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
  },
  [QUALITY_TIER.MEDIUM]: {
    // Grass settings
    grassInstanceCount: 2048,        // Reduced from 3072
    grassSegmentsLow: 1,
    grassSegmentsHigh: 4,            // Reduced from 6
    grassLodDist: 12,
    grassMaxDist: 100,               // Reduced from 150
    grassMeshPoolCap: 256,
    grassExtraPasses: true,          // Keep triple-pass but capped

    // Shadow settings
    shadowMapSize: 2048,             // Reduced from 4096
    shadowsEnabled: true,

    // Particle settings
    particleCount: 24000,            // Reduced from 36000

    // Texture settings
    maxAnisotropy: 4,

    // Post-processing
    fxaaEnabled: true,

    // Renderer
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  },
  [QUALITY_TIER.HIGH]: {
    // Grass settings
    grassInstanceCount: 3072,        // Original
    grassSegmentsLow: 1,
    grassSegmentsHigh: 6,            // Original
    grassLodDist: 15,
    grassMaxDist: 150,               // Original
    grassMeshPoolCap: 512,
    grassExtraPasses: true,

    // Shadow settings
    shadowMapSize: 4096,             // Original
    shadowsEnabled: true,

    // Particle settings
    particleCount: 36000,            // Original

    // Texture settings
    maxAnisotropy: 16,

    // Post-processing
    fxaaEnabled: true,

    // Renderer
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  },
};

// Singleton quality manager
class QualityManager {
  constructor() {
    this.tier = detectQualityTier();
    this.settings = { ...QUALITY_SETTINGS[this.tier] };

    // Allow URL override for testing: ?quality=low|medium|high
    const urlParams = new URLSearchParams(window.location.search);
    const override = urlParams.get('quality');
    if (override && QUALITY_SETTINGS[override]) {
      this.tier = override;
      this.settings = { ...QUALITY_SETTINGS[override] };
    }

    console.log(`[QualityManager] Detected tier: ${this.tier}`);
  }

  get(key) {
    return this.settings[key];
  }

  getTier() {
    return this.tier;
  }

  isLowQuality() {
    return this.tier === QUALITY_TIER.LOW;
  }

  isMediumQuality() {
    return this.tier === QUALITY_TIER.MEDIUM;
  }

  isHighQuality() {
    return this.tier === QUALITY_TIER.HIGH;
  }
}

// Export singleton instance
export const qualityManager = new QualityManager();
export default qualityManager;
