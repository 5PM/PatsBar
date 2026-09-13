import * as T from 'three';

export function characterMaterial(texture: T.Texture, hoodieColor?: string) {
  const material = new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const tint = new T.Color(hoodieColor ?? '#ffffff');
  material.onBeforeCompile = shader => {
    shader.uniforms.hoodieTint = { value: tint };
    shader.uniforms.hoodieEnabled = { value: hoodieColor ? 1 : 0 };
    shader.fragmentShader = 'uniform vec3 hoodieTint;\nuniform float hoodieEnabled;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float dominance = sampledDiffuseColor.g - max(sampledDiffuseColor.r, sampledDiffuseColor.b);
      diffuseColor.a *= 1.0 - smoothstep(0.05, 0.24, dominance);
      if (diffuseColor.a < 0.06) discard;
      diffuseColor.g = min(diffuseColor.g, max(diffuseColor.r, diffuseColor.b) + 0.025);
      // Recolor only saturated red fabric, bounded above the hands and below the face.
      float redness = 1.0 - min(sampledDiffuseColor.g, sampledDiffuseColor.b) / max(sampledDiffuseColor.r, 0.001);
      float face = step(0.38, vMapUv.x) * step(vMapUv.x, 0.64) * step(0.825, vMapUv.y);
      float fabric = max(smoothstep(0.68, 0.84, redness), smoothstep(0.0, 0.06, dominance));
      fabric *= step(0.50, vMapUv.y) * step(vMapUv.y, 0.875) * (1.0 - face);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * hoodieTint * sampledDiffuseColor.r * 1.8, fabric * hoodieEnabled);
    `);
  };
  material.customProgramCacheKey = () => 'pats-character-fabric-v1';
  return material;
}
