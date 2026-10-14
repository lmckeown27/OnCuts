/** Stay under nginx's default 1 MB body limit until that limit is raised. */
const TARGET_BYTES = 900 * 1024;

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

async function loadImage(file: File): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    const loaded = await new Promise<boolean>((resolve) => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    });
    return loaded ? image : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Shrink a camera or library photo so the upload is accepted. Videos are unchanged. */
export async function compressUploadPhoto(file: File, maxEdge = 1600): Promise<File> {
  const looksLikeImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
  if (!looksLikeImage || file.type.startsWith('video/')) return file;
  if (file.size <= TARGET_BYTES && (file.type === 'image/jpeg' || file.type === 'image/jpg')) return file;

  const image = await loadImage(file);
  if (!image || !image.width || !image.height) return file;

  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let best: Blob | null = null;
  for (const quality of [0.82, 0.7, 0.58, 0.45]) {
    const blob = await canvasBlob(canvas, quality);
    if (!blob) continue;
    best = blob;
    if (blob.size <= TARGET_BYTES) break;
  }
  if (!best || best.size >= file.size) return file;
  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([best], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
