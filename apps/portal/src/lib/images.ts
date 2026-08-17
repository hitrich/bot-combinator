const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2400;

export function validateShowcaseImage(file: Pick<File, 'size' | 'type'>): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Use a JPEG, PNG, WebP, or AVIF image.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Screenshots must be 10 MB or smaller.';
  }
  if (file.size === 0) return 'The selected file is empty.';
  return null;
}

export interface SanitizedImage {
  file: File;
  width: number;
  height: number;
}

export async function sanitizeShowcaseImage(file: File): Promise<SanitizedImage> {
  const validationError = validateShowcaseImage(file);
  if (validationError) throw new Error(validationError);

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    bitmap.close();
    throw new Error('This browser cannot prepare the screenshot.');
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Screenshot processing failed.'))),
      'image/webp',
      0.9,
    );
  });
  const safeStem = file.name
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return {
    file: new File([blob], `${safeStem || 'showcase'}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    }),
    width,
    height,
  };
}
