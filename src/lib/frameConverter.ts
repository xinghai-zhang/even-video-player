export function rgbaToGrayscale(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  }
  return gray;
}

export function splitIntoQuadrants(
  gray: Uint8Array,
  width: number,
  height: number
): [Uint8Array, Uint8Array, Uint8Array, Uint8Array] {
  const halfW = width / 2;
  const halfH = height / 2;
  const size = halfW * halfH;
  const q1 = new Uint8Array(size);
  const q2 = new Uint8Array(size);
  const q3 = new Uint8Array(size);
  const q4 = new Uint8Array(size);

  for (let y = 0; y < height; y++) {
    const srcOffset = y * width;
    const dstOffset = (y % halfH) * halfW;
    if (y < halfH) {
      q1.set(gray.subarray(srcOffset, srcOffset + halfW), dstOffset);
      q2.set(gray.subarray(srcOffset + halfW, srcOffset + width), dstOffset);
    } else {
      q3.set(gray.subarray(srcOffset, srcOffset + halfW), dstOffset);
      q4.set(gray.subarray(srcOffset + halfW, srcOffset + width), dstOffset);
    }
  }
  return [q1, q2, q3, q4];
}
