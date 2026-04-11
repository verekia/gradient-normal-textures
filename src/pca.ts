// PCA via power iteration on a 3x3 covariance matrix

export interface PcaResult {
  /** Unit eigenvector for the largest eigenvalue (in Lab space) */
  axis: [number, number, number];
  /** Mean Lab vector */
  mean: [number, number, number];
  /** Largest eigenvalue */
  eigenvalue: number;
}

/**
 * Compute the first principal component of an Nx3 matrix of Lab values.
 * Uses power iteration which is sufficient for extracting the top eigenvector
 * of a 3x3 symmetric positive semi-definite covariance matrix.
 */
export function computePCA(labPixels: Float64Array, count: number): PcaResult {
  // Compute mean
  const mean: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    mean[0] += labPixels[i * 3];
    mean[1] += labPixels[i * 3 + 1];
    mean[2] += labPixels[i * 3 + 2];
  }
  mean[0] /= count;
  mean[1] /= count;
  mean[2] /= count;

  // Compute 3x3 covariance matrix (symmetric, so 6 unique values)
  let c00 = 0, c01 = 0, c02 = 0;
  let c11 = 0, c12 = 0;
  let c22 = 0;

  for (let i = 0; i < count; i++) {
    const d0 = labPixels[i * 3] - mean[0];
    const d1 = labPixels[i * 3 + 1] - mean[1];
    const d2 = labPixels[i * 3 + 2] - mean[2];
    c00 += d0 * d0;
    c01 += d0 * d1;
    c02 += d0 * d2;
    c11 += d1 * d1;
    c12 += d1 * d2;
    c22 += d2 * d2;
  }

  const n = count;
  c00 /= n; c01 /= n; c02 /= n;
  c11 /= n; c12 /= n;
  c22 /= n;

  // Power iteration to find the dominant eigenvector
  // Start with a non-degenerate initial vector
  let v0 = 1, v1 = 0.3, v2 = 0.7;

  for (let iter = 0; iter < 100; iter++) {
    // Multiply by covariance matrix
    const r0 = c00 * v0 + c01 * v1 + c02 * v2;
    const r1 = c01 * v0 + c11 * v1 + c12 * v2;
    const r2 = c02 * v0 + c12 * v1 + c22 * v2;

    // Normalize
    const len = Math.sqrt(r0 * r0 + r1 * r1 + r2 * r2);
    if (len < 1e-15) {
      // Degenerate — no variance
      return { axis: [1, 0, 0], mean, eigenvalue: 0 };
    }
    v0 = r0 / len;
    v1 = r1 / len;
    v2 = r2 / len;
  }

  // Compute the eigenvalue: λ = v^T * C * v
  const ev0 = c00 * v0 + c01 * v1 + c02 * v2;
  const ev1 = c01 * v0 + c11 * v1 + c12 * v2;
  const ev2 = c02 * v0 + c12 * v1 + c22 * v2;
  const eigenvalue = v0 * ev0 + v1 * ev1 + v2 * ev2;

  return { axis: [v0, v1, v2], mean, eigenvalue };
}
