// Client-side image helpers shared between Onboarding and Settings. We
// downscale logos/favicons in the browser before stashing them in
// localStorage so the theme stays under the 5MB quota and renders crisply
// in the sidebar.

export const LOGO_MAX_DIMENSION = 512;
export const LOGO_JPEG_QUALITY = 0.85;
// Favicons are tiny in the browser tab, so we downscale aggressively and keep
// them as PNGs to preserve transparency (icons usually need it).
export const FAVICON_MAX_DIMENSION = 64;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

async function loadImage(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not load image"));
      el.src = url;
    });
    return { img, revoke: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export async function compressLogo(file: File): Promise<string> {
  if (file.type === "image/svg+xml") return readFileAsDataUrl(file);
  const { img, revoke } = await loadImage(file);
  try {
    const { naturalWidth: w, naturalHeight: h } = img;
    const scale = Math.min(1, LOGO_MAX_DIMENSION / Math.max(w, h));
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, outW, outH);
    if (file.type === "image/png") return canvas.toDataURL("image/png");
    return canvas.toDataURL("image/jpeg", LOGO_JPEG_QUALITY);
  } finally {
    revoke();
  }
}

export async function compressFavicon(file: File): Promise<string> {
  // SVG favicons are tiny and resolution-independent — pass straight through.
  if (file.type === "image/svg+xml") return readFileAsDataUrl(file);
  const { img, revoke } = await loadImage(file);
  try {
    const { naturalWidth: w, naturalHeight: h } = img;
    const scale = Math.min(1, FAVICON_MAX_DIMENSION / Math.max(w, h));
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, outW, outH);
    return canvas.toDataURL("image/png");
  } finally {
    revoke();
  }
}
