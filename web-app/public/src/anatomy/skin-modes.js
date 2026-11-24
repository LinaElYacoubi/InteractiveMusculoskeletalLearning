// Three ways to bend the muscle meshes, switchable at runtime so they can be compared side by side.
// Skeletal bone meshes are already bound rigidly to one rig bone each, so modes only change the muscles.
export const SKIN_MODES = Object.freeze([
  ['smooth', 'Smooth skin (original)'],
  ['segmented', 'Segmented (Ranma / PS1 style)'],
  ['stitched', 'Seamless segmented (stitched seams)'],
]);

/**
 * smooth:    the exported weights, unchanged.
 * segmented: every vertex follows only its strongest bone, so each body segment moves as a rigid piece
 *            (the look of 1990s segmented characters such as the Ranma PS1 models; gaps can open at joints).
 * stitched:  rigid inside each segment, blended only in a narrow seam band where two bones share a vertex
 *            almost equally, the way late-90s games stitched segment edges so no gaps or rubbery stretching show.
 */
export function remapWeights(source, mode, itemSize = 4) {
  if (mode !== 'segmented' && mode !== 'stitched') return source.slice();
  const out = new Float32Array(source.length);
  for (let v = 0; v < source.length; v += itemSize) {
    let best = 0, bestWeight = -Infinity;
    for (let k = 0; k < itemSize; k++) if (source[v + k] > bestWeight) { bestWeight = source[v + k]; best = k; }
    if (mode === 'segmented') { out[v + best] = 1; continue; }
    let sum = 0, max = 0;
    for (let k = 0; k < itemSize; k++) { const w = Math.max(0, source[v + k]) ** 4; out[v + k] = w; sum += w; }
    if (!(sum > 0)) { out[v + best] = 1; continue; }
    for (let k = 0; k < itemSize; k++) { out[v + k] /= sum; max = Math.max(max, out[v + k]); }
    if (max > 0.92) { for (let k = 0; k < itemSize; k++) out[v + k] = 0; out[v + best] = 1; }
  }
  return out;
}

/** Share of vertices that still blend between bones (0..1) for a weight array. */
export function blendedShare(weights, itemSize = 4) {
  let blended = 0, count = 0;
  for (let v = 0; v < weights.length; v += itemSize, count++) {
    let used = 0; for (let k = 0; k < itemSize; k++) if (weights[v + k] > 0.01) used++;
    if (used > 1) blended++;
  }
  return count ? blended / count : 0;
}

export function applySkinMode(meshes, mode) {
  let changed = 0;
  for (const mesh of meshes) {
    const attribute = mesh.geometry?.attributes?.skinWeight;
    if (!attribute || !(attribute.array instanceof Float32Array)) continue;
    mesh.userData.originalSkinWeights ??= attribute.array.slice();
    attribute.array.set(remapWeights(mesh.userData.originalSkinWeights, mode, attribute.itemSize));
    attribute.needsUpdate = true; changed++;
  }
  return changed;
}
