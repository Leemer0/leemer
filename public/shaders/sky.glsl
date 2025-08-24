
// Enhanced vibrant daytime palette with sunset pink tones
vec3 SKY_lighterBlue = vec3(0.85, 0.95, 1.15) * 1.0; // much brighter horizon with pink hints
vec3 SKY_midBlue = vec3(0.45, 0.68, 0.95) * 1.1;     // more saturated mid sky
vec3 SKY_darkerBlue = vec3(0.12, 0.25, 0.45);        // richer zenith
vec3 SKY_SUN_COLOUR = vec3(1.2, 1.05, 0.95);         // warmer, brighter sun
vec3 SKY_SUN_GLOW_COLOUR = vec3(1.15, 1.0, 0.92);    // enhanced glow
vec3 SKY_FOG_GLOW_COLOUR = vec3(1.0, 1.05, 1.2) * 0.28; // brighter fog with pink tint
float SKY_POWER = 22.0; // increased sky brightness
float SUN_POWER = 180.0; // brighter sun
float SKY_DARK_POWER = 2.2;
// Reduced fog for cleaner, more vibrant look
float SKY_fogScatterDensity = 0.00025;
float SKY_fogExtinctionDensity = 0.0018;
vec3 SUN_DIR = vec3(-1.0, 0.62, 1.0);

// This is just a bunch of nonsense since I didn't want to implement a full
// sky model. It's just a simple gradient with a sun and some fog.
vec3 CalculateSkyLighting(vec3 viewDir, vec3 normalDir) {
  vec3 lighterBlue = col3(SKY_lighterBlue);
  vec3 midBlue = col3(SKY_midBlue);
  vec3 darkerBlue = col3(SKY_darkerBlue);

  vec3 SUN_COLOUR = col3(SKY_SUN_COLOUR);
  vec3 SUN_GLOW_COLOUR = col3(SKY_SUN_GLOW_COLOUR);

  float viewDirY = linearstep(-0.01, 1.0, viewDir.y);

  float skyGradientMixFactor = saturate(viewDirY);
  vec3 skyGradient = mix(darkerBlue, lighterBlue, exp(-sqrt(saturate(viewDirY)) * 1.6));

  vec3 sunDir = normalize(SUN_DIR);
  float mu = 1.0 - saturate(dot(viewDir, sunDir));

  vec3 colour = skyGradient + SUN_GLOW_COLOUR * saturate(exp(-sqrt(mu) * 10.0)) * 0.9;
  colour += SUN_COLOUR * smoothstep(0.9997, 0.9998, 1.0 - mu);

  colour = oklabToRGB(colour);

  return colour;
}

vec3 CalculateSkyFog(vec3 normalDir) {
  return CalculateSkyLighting(normalDir, normalDir);
}

vec3 CalculateFog(vec3 baseColour, vec3 viewDir, float sceneDepth) {
	vec3 fogSkyColour = CalculateSkyFog(-viewDir);
	float fogDepth = sceneDepth * sceneDepth;

	float fogScatterFactor = exp(-SKY_fogScatterDensity * SKY_fogScatterDensity * fogDepth);
	float fogExtinctionFactor = exp(-SKY_fogExtinctionDensity * SKY_fogExtinctionDensity * fogDepth);

	vec3 finalColour = baseColour * fogExtinctionFactor + fogSkyColour * (1.0 - fogScatterFactor);
  return finalColour;
}