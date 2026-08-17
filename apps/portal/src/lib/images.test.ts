import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, validateShowcaseImage } from './images';

describe('showcase image validation', () => {
  it('accepts supported image formats inside the size limit', () => {
    expect(validateShowcaseImage({ type: 'image/png', size: 128_000 })).toBeNull();
  });

  it('rejects unsupported files and oversized screenshots', () => {
    expect(validateShowcaseImage({ type: 'image/svg+xml', size: 1000 })).toContain('JPEG');
    expect(validateShowcaseImage({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 })).toContain(
      '10 MB',
    );
  });
});
