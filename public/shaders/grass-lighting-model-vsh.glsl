

#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

varying vec3 vWorldNormal;
varying vec3 vGrassColour;
varying vec4 vGrassParams;
varying vec3 vNormal2;
varying vec3 vWorldPosition;
varying float vMaskCut;
varying float vMaskRaw;

uniform vec2 grassSize;
uniform vec4 grassParams;
uniform vec4 grassDraw;
uniform float time;
uniform sampler2D heightmap;
uniform vec4 heightParams;
uniform vec3 playerPos;
uniform mat4 viewMatrixInverse;
// Mouse interaction uniforms
uniform vec3 mousePos;
uniform float mouseRadius;
uniform float mouseStrength;
// Name cut mask
uniform sampler2D cutMask;
uniform float cutMinScale;   // minimum height scale inside the mask (e.g., 0.2)
uniform float cutFeather;    // feather width around 0.5 threshold (e.g., 0.05)
uniform vec2 cutOffset;      // world-space XZ offset for mask center
uniform vec2 cutScale;       // world-space size that maps to 1.0 UV (width, height)
uniform float cutRotation;   // rotation in radians (around Y)

attribute float vertIndex;


void main() {
  #include <uv_vertex>
  #include <color_vertex>
  #include <morphcolor_vertex>
  #include <beginnormal_vertex>
  #include <begin_vertex>

  vec3 grassOffset = vec3(position.x, 0.0, position.y);

  // Blade world position
  vec3 grassBladeWorldPos = (modelMatrix * vec4(grassOffset, 1.0)).xyz;
  vec2 heightmapUV = vec2(
      remap(grassBladeWorldPos.x, -heightParams.x * 0.5, heightParams.x * 0.5, 0.0, 1.0),
      remap(grassBladeWorldPos.z, -heightParams.x * 0.5, heightParams.x * 0.5, 1.0, 0.0));
  vec4 heightmapSample = texture2D(heightmap, heightmapUV);
  grassBladeWorldPos.y += heightmapSample.x * grassParams.z - grassParams.w;

  float heightmapSampleHeight = 1.0;//mix(0.5, 1.0, heightmapSample.y);

  vec4 hashVal1 = hash42(vec2(grassBladeWorldPos.x, grassBladeWorldPos.z));

  float highLODOut = smoothstep(grassDraw.x * 0.5, grassDraw.x, distance(cameraPosition, grassBladeWorldPos));
  float lodFadeIn = smoothstep(grassDraw.x, grassDraw.y, distance(cameraPosition, grassBladeWorldPos));

  // Check terrain type, maybe don't allow grass blade
  float isSandy = linearstep(-11.0, -14.0, grassBladeWorldPos.y);
  float grassAllowedHash = hashVal1.w - isSandy;
  float isGrassAllowed = step(0.0, grassAllowedHash);

  float randomAngle = hashVal1.x * 2.0 * 3.14159;
  float randomShade = remap(hashVal1.y, -1.0, 1.0, 0.5, 1.0);
  float randomHeight = remap(hashVal1.z, 0.0, 1.0, 0.75, 1.5) * mix(1.0, 0.0, lodFadeIn) * isGrassAllowed * heightmapSampleHeight;
  float randomWidth = (1.0 - isSandy) * heightmapSampleHeight;
  // Inside letters: slightly wider blades for fuller fill and calmer sway
  randomWidth = mix(randomWidth, randomWidth * 1.22, vMaskCut);
  float randomLean = remap(hashVal1.w, 0.0, 1.0, 0.1, 0.4);

  // Sample name cut mask in transformed world space (XZ)
  vec2 rel = vec2(grassBladeWorldPos.x - cutOffset.x, grassBladeWorldPos.z - cutOffset.y);
  float cr = cos(cutRotation);
  float sr = sin(cutRotation);
  mat2 R = mat2(cr, -sr, sr, cr);
  rel = R * rel;
  // Flip V to match canvas Y orientation (avoid mirrored text)
  vec2 maskUV = vec2(rel.x / cutScale.x + 0.5, 1.0 - (rel.y / cutScale.y + 0.5));
  float maskVal = texture2D(cutMask, maskUV).r;
  float cut = smoothstep(0.5 - cutFeather, 0.5 + cutFeather, maskVal);
  float cutScale = mix(1.0, cutMinScale, cut);
  vMaskCut = cut;
  vMaskRaw = maskVal;

  vec2 hashGrassColour = hash22(vec2(grassBladeWorldPos.x, grassBladeWorldPos.z));
  float leanAnimation = noise12(vec2(time * 0.35) + grassBladeWorldPos.xz * 137.423) * 0.1 * mix(1.0, 0.7, vMaskCut);

  float GRASS_SEGMENTS = grassParams.x;
  float GRASS_VERTICES = grassParams.y;

  // Figure out vertex id, > GRASS_VERTICES is back side
  float vertID = mod(float(vertIndex), GRASS_VERTICES);

  // 1 = front, -1 = back
  float zSide = -(floor(vertIndex / GRASS_VERTICES) * 2.0 - 1.0);

  // 0 = left, 1 = right
  float xSide = mod(vertID, 2.0);

  float heightPercent = (vertID - xSide) / (GRASS_SEGMENTS * 2.0);

  // Set heights: outside mask = 2x, inside mask = 1x (half of outside)
  float heightScaleMask = mix(2.0, 1.0, vMaskCut);
  float grassTotalHeight = grassSize.y * randomHeight * heightScaleMask;
  float grassTotalWidthHigh = easeOut(1.0 - heightPercent, 2.0);
  float grassTotalWidthLow = 1.0 - heightPercent;
  float grassTotalWidth = grassSize.x * mix(grassTotalWidthHigh, grassTotalWidthLow, highLODOut) * randomWidth;

  // Shift verts
  float x = (xSide - 0.5) * grassTotalWidth;
  float y = heightPercent * grassTotalHeight;

  float windDir = noise12(grassBladeWorldPos.xz * 0.05 + 0.05 * time);
  float windNoiseSample = noise12(grassBladeWorldPos.xz * 0.25 + time * 1.0);
  float windLeanAngle = remap(windNoiseSample, -1.0, 1.0, 0.25, 1.0);
  windLeanAngle = easeIn(windLeanAngle, 2.0) * 1.25;
  vec3 windAxis = vec3(cos(windDir), 0.0, sin(windDir));

  // Reduce sway inside letters to hold letterforms
  windLeanAngle *= heightPercent * mix(1.0, 0.35, vMaskCut);

  float distToPlayer = distance(grassBladeWorldPos.xz, playerPos.xz);
  float playerFalloff = smoothstep(2.5, 1.0, distToPlayer);
  float playerLeanAngle = mix(0.0, 0.2, playerFalloff * linearstep(0.5, 0.0, windLeanAngle));
  vec3 grassToPlayer = normalize(vec3(playerPos.x, 0.0, playerPos.z) - vec3(grassBladeWorldPos.x, 0.0, grassBladeWorldPos.z));
  vec3 playerLeanAxis = vec3(grassToPlayer.z, 0, -grassToPlayer.x);

  // Mouse interaction: bend away from cursor within radius
  float distToMouse = distance(grassBladeWorldPos.xz, mousePos.xz);
  // Smoother, softer falloff and slight time modulation for flowy feel
  float mouseFalloff = smoothstep(mouseRadius * 1.2, 0.0, distToMouse);
  float flow = 0.85 + 0.15 * sin(time * 2.0 + hashVal1.x * 6.2831);
  float mouseLeanAngle = mouseStrength * mouseFalloff * flow;
  vec3 grassToMouse = normalize(vec3(mousePos.x, 0.0, mousePos.z) - vec3(grassBladeWorldPos.x, 0.0, grassBladeWorldPos.z));
  vec3 mouseLeanAxis = vec3(grassToMouse.z, 0, -grassToMouse.x);

  randomLean += leanAnimation;

  float easedHeight = mix(easeIn(heightPercent, 2.0), 1.0, highLODOut);
  float curveAmount = -randomLean * easedHeight;

  float ncurve1 = -randomLean * easedHeight;
  vec3 n1 = vec3(0.0, (heightPercent + 0.01), 0.0);
  n1 = rotateX(ncurve1) * n1;

  float ncurve2 = -randomLean * easedHeight * 0.9;
  vec3 n2 = vec3(0.0, (heightPercent + 0.01) * 0.9, 0.0);
  n2 = rotateX(ncurve2) * n2;

  vec3 ncurve = normalize(n1 - n2);

  mat3 grassMat = rotateAxis(playerLeanAxis, playerLeanAngle) * rotateAxis(mouseLeanAxis, mouseLeanAngle) * rotateAxis(windAxis, windLeanAngle) * rotateY(randomAngle);

  vec3 grassFaceNormal = vec3(0.0, 0.0, 1.0);
  grassFaceNormal = grassMat * grassFaceNormal;
  grassFaceNormal *= zSide;

  vec3 grassVertexNormal = vec3(0.0, -ncurve.z, ncurve.y);
  vec3 grassVertexNormal1 = rotateY(PI * 0.3 * zSide) * grassVertexNormal;
  vec3 grassVertexNormal2 = rotateY(PI * -0.3 * zSide) * grassVertexNormal;

  grassVertexNormal1 = grassMat * grassVertexNormal1;
  grassVertexNormal1 *= zSide;

  grassVertexNormal2 = grassMat * grassVertexNormal2;
  grassVertexNormal2 *= zSide;

  vec3 grassVertexPosition = vec3(x, y, 0.0);
  grassVertexPosition = rotateX(curveAmount) * grassVertexPosition;
  grassVertexPosition = grassMat * grassVertexPosition;

  grassVertexPosition += grassOffset;

  // Richer, more saturated greens
  vec3 b1 = vec3(0.03, 0.11, 0.02);
  vec3 b2 = vec3(0.04, 0.14, 0.03);
  vec3 t1 = vec3(0.50, 0.85, 0.28);
  vec3 t2 = vec3(0.65, 0.95, 0.45);

  vec3 baseColour = mix(b1, b2, hashGrassColour.x);
  vec3 tipColour = mix(t1, t2, hashGrassColour.y);
  vec3 highLODColour = mix(baseColour, tipColour, easeIn(heightPercent, 4.0)) * (randomShade * 1.05 + 0.05);
  vec3 lowLODColour = mix(b1, t1, heightPercent);
  vGrassColour = mix(highLODColour, lowLODColour, highLODOut);
  vGrassParams = vec4(heightPercent, grassBladeWorldPos.y, highLODOut, xSide);
  
  const float SKY_RATIO = 0.25;
  // TODO: Grab terrain normal
  vec3 UP = vec3(0.0, 1.0, 0.0);
  // float skyFadeIn = smoothstep(grassDraw.x * 0.5, grassDraw.x, distance(cameraPosition, grassBladeWorldPos)) * SKY_RATIO;
  float skyFadeIn = (1.0 - highLODOut) * SKY_RATIO;
  vec3 normal1 = normalize(mix(UP, grassVertexNormal1, skyFadeIn));
  vec3 normal2 = normalize(mix(UP, grassVertexNormal2, skyFadeIn));

  transformed = grassVertexPosition;
  transformed.y += grassBladeWorldPos.y;

  vec3 cameraWorldLeft = (viewMatrixInverse * vec4(-1.0, 0.0, 0.0, 0.0)).xyz;

  vec3 viewDir = normalize(cameraPosition - grassBladeWorldPos);
  vec3 viewDirXZ = normalize(vec3(viewDir.x, 0.0, viewDir.z));

  vec3 grassFaceNormalXZ = normalize(vec3(grassFaceNormal.x, 0.0, grassFaceNormal.z));

  float viewDotNormal = saturate(dot(grassFaceNormal, viewDirXZ));
  float viewSpaceThickenFactor = easeOut(1.0 - viewDotNormal, 4.0) * smoothstep(0.0, 0.2, viewDotNormal);

  objectNormal = grassVertexNormal1;

  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>

  #include <defaultnormal_vertex>
  #include <normal_vertex>

  vNormal = normalize(normalMatrix * normal1);
  vNormal2 = normalize(normalMatrix * normal2);

  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <displacementmap_vertex>

  // #include <project_vertex>
  vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
  mvPosition = modelViewMatrix * mvPosition;

  // HACK
  mvPosition.x += viewSpaceThickenFactor * (xSide - 0.5) * grassTotalWidth * 0.5 * zSide;

  gl_Position = projectionMatrix * mvPosition;

  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
  vViewPosition = - mvPosition.xyz;
  #include <worldpos_vertex>
  #include <envmap_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>

  vWorldPosition = worldPosition.xyz;
}