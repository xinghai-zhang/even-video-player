import { describe, it, expect } from 'vitest';
import { rgbaToGrayscale, splitIntoQuadrants } from './frameConverter';

describe('rgbaToGrayscale', () => {
  it('converts white to 255', () => {
    expect(rgbaToGrayscale(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1)[0]).toBe(255);
  });

  it('converts black to 0', () => {
    expect(rgbaToGrayscale(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1)[0]).toBe(0);
  });

  it('converts red (255,0,0) to 76 using ITU-R BT.601', () => {
    // Math.round(0.299 * 255) = 76
    expect(rgbaToGrayscale(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1)[0]).toBe(76);
  });

  it('converts green (0,255,0) to 150', () => {
    // Math.round(0.587 * 255) = 150
    expect(rgbaToGrayscale(new Uint8ClampedArray([0, 255, 0, 255]), 1, 1)[0]).toBe(150);
  });

  it('converts blue (0,0,255) to 29', () => {
    // Math.round(0.114 * 255) = 29
    expect(rgbaToGrayscale(new Uint8ClampedArray([0, 0, 255, 255]), 1, 1)[0]).toBe(29);
  });

  it('returns array of length width×height', () => {
    const rgba = new Uint8ClampedArray(4 * 3 * 4).fill(128);
    expect(rgbaToGrayscale(rgba, 4, 3).length).toBe(12);
  });
});

describe('splitIntoQuadrants', () => {
  it('splits a 4×4 image into 4 equal 2×2 quadrants (row-major order)', () => {
    // Row 0: 1 2 3 4
    // Row 1: 5 6 7 8
    // Row 2: 9 10 11 12
    // Row 3: 13 14 15 16
    const gray = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const [q1, q2, q3, q4] = splitIntoQuadrants(gray, 4, 4);
    expect(Array.from(q1)).toEqual([1, 2, 5, 6]);      // top-left 2×2
    expect(Array.from(q2)).toEqual([3, 4, 7, 8]);      // top-right 2×2
    expect(Array.from(q3)).toEqual([9, 10, 13, 14]);   // bottom-left 2×2
    expect(Array.from(q4)).toEqual([11, 12, 15, 16]);  // bottom-right 2×2
  });

  it('each quadrant has length (width/2)×(height/2)', () => {
    const gray = new Uint8Array(576 * 256).fill(128);
    const quads = splitIntoQuadrants(gray, 576, 256);
    quads.forEach(q => expect(q.length).toBe(288 * 128));
  });
});
