/**
 * The store poster, drawn on a canvas. One renderer feeds every way out: printing on A4 / A5 / A6 paper and saving a
 * PNG for the device or for social media (square post, 9:16 story).
 * Browser-only: it needs a canvas.
 */
export type PosterFormatId = "a4" | "a5" | "a6" | "square" | "story";

export type PosterFormat = {
  id: PosterFormatId;
  /** Pixel size of the saved image. Paper sizes are 150 dpi, so a printout stays sharp. */
  width: number;
  height: number;
  /** Paper size in millimetres, only for formats that can be printed. */
  paper: { w: number; h: number } | null;
};

export const POSTER_FORMATS: readonly PosterFormat[] = [
  { id: "a4", width: 1240, height: 1754, paper: { w: 210, h: 297 } },
  { id: "a5", width: 874, height: 1240, paper: { w: 148, h: 210 } },
  { id: "a6", width: 620, height: 874, paper: { w: 105, h: 148 } },
  { id: "square", width: 1080, height: 1080, paper: null },
  { id: "story", width: 1080, height: 1920, paper: null },
];

export const DEFAULT_POSTER_FORMAT: PosterFormat = POSTER_FORMATS[0]!;

export function posterFormat(id: unknown): PosterFormat {
  return POSTER_FORMATS.find((format) => format.id === id) ?? DEFAULT_POSTER_FORMAT;
}

// The layout below is designed on an A4 page (1240 x 1754) and scaled by `u` to fit any format.
const DESIGN_WIDTH = 1240;
const DESIGN_HEIGHT = 1754;

const NAVY = "#0b1f5c";
const MUTED = "#4a5a86";
const TINT = "#eaf1fe";
// The app's own fonts, so the printed poster matches the screen; system fonts only as a last resort.
const FALLBACK = `system-ui, -apple-system, "Segoe UI", "Noto Sans Arabic", "Noto Sans", Roboto, Arial, sans-serif`;
const FONT = `"DM Sans", "Cairo", "Inter", ${FALLBACK}`;
const DISPLAY_FONT = `"Space Grotesk", "DM Sans", "Cairo", "Inter", ${FALLBACK}`;

/**
 * The app's fonts only download when text in their range appears, so draw nothing until they are ready: a canvas
 * painted too early silently falls back to a system font. Never blocks for long and never fails the poster.
 */
async function loadFonts(text: PosterText): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const sample = `${text.name} ${text.caption} ${text.powered} ${text.address}`;
  const wanted = [`700 46px "DM Sans"`, `500 36px "DM Sans"`, `700 112px "Space Grotesk"`, `700 46px "Cairo"`, `500 36px "Cairo"`];
  const loading = Promise.all(wanted.map((font) => document.fonts.load(font, sample))).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
  try {
    await Promise.race([loading, timeout]);
  } catch {
    // A missing font only changes the look.
  }
}

export type PosterText = { name: string; caption: string; powered: string; address: string };

/** The app's own mark, drawn small in the footer. A missing logo never stops the poster from being made. */
async function loadLogo(url: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous"; // the store logo comes from storage; without this the canvas could not be saved
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/** Greedy word wrap that also splits a single over-long word, so a long store name never leaves the page. */
export function wrapLines(measure: (text: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const push = () => {
    if (line) lines.push(line);
    line = "";
  };
  for (const word of words) {
    if (measure(word) > maxWidth) {
      push();
      let piece = "";
      for (const char of Array.from(word)) {
        if (piece && measure(piece + char) > maxWidth) {
          lines.push(piece);
          piece = "";
        }
        piece += char;
      }
      line = piece;
      continue;
    }
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= maxWidth) line = next;
    else {
      push();
      line = word;
    }
  }
  push();
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]?.replace(/\s+\S*$/, "")}…`;
  return kept;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export type PosterOptions = {
  format?: PosterFormat;
  /** The store's own logo (a short-lived signed URL). Without one, the store's first letter is drawn instead. */
  storeLogoUrl?: string | null;
  /** The app mark in the footer. */
  brandLogoUrl?: string;
};

/** Draws the poster and returns it as a PNG blob. `link` is encoded as a crisp QR (square modules, no smoothing). */
export async function renderPoster(link: string, text: PosterText, dir: "rtl" | "ltr", options: PosterOptions = {}): Promise<Blob> {
  const format = options.format ?? DEFAULT_POSTER_FORMAT;
  const W = format.width;
  const H = format.height;
  const u = Math.min(W / DESIGN_WIDTH, H / DESIGN_HEIGHT);
  const [{ default: QRCode }, logo, storeLogo] = await Promise.all([
    import("qrcode"),
    loadLogo(options.brandLogoUrl ?? "/logo-mascot.png"),
    options.storeLogoUrl ? loadLogo(options.storeLogoUrl) : Promise.resolve(null),
    loadFonts(text),
  ]);
  const qr = QRCode.create(link, { errorCorrectionLevel: "M" });
  const count = qr.modules.size;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("POSTER_UNAVAILABLE");
  ctx.direction = dir;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const cx = W / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Frame
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = Math.max(3, 8 * u);
  roundRect(ctx, 44 * u, 44 * u, W - 88 * u, H - 88 * u, 36 * u);
  ctx.stroke();

  const draw = (value: string, x: number, y: number, size: number, weight: number, color: string, family = FONT) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${Math.round(size * u)}px ${family}`;
    ctx.fillText(value, x, y);
  };

  // Footer: a thin rule, then the app mark with "Powered by Fellogram" and the app's Telegram address.
  const footerRuleY = H - 290 * u;
  ctx.strokeStyle = "#d3dcf2";
  ctx.lineWidth = Math.max(2, 3 * u);
  ctx.beginPath();
  ctx.moveTo(220 * u, footerRuleY);
  ctx.lineTo(W - 220 * u, footerRuleY);
  ctx.stroke();

  const logoHeight = logo ? 170 * u : 0;
  const logoWidth = logo ? Math.round((logoHeight * logo.naturalWidth) / logo.naturalHeight) : 0;
  const gap = logo ? 34 * u : 0;
  ctx.direction = "ltr"; // brand and address are Latin text in every language
  ctx.font = `700 ${Math.round(46 * u)}px ${FONT}`;
  const poweredWidth = ctx.measureText(text.powered).width;
  ctx.font = `500 ${Math.round(36 * u)}px ${FONT}`;
  const addressWidth = ctx.measureText(text.address).width;
  const blockWidth = logoWidth + gap + Math.max(poweredWidth, addressWidth);
  const left = cx - blockWidth / 2;
  const footerMid = footerRuleY + 40 * u + logoHeight / 2;
  if (logo) ctx.drawImage(logo, Math.round(left), Math.round(footerMid - logoHeight / 2), logoWidth, logoHeight);
  const textCenter = left + logoWidth + gap + Math.max(poweredWidth, addressWidth) / 2;
  draw(text.powered, textCenter, footerMid - 6 * u, 46, 700, NAVY);
  draw(text.address, textCenter, footerMid + 44 * u, 36, 500, MUTED);
  ctx.direction = dir;

  // Store name: the headline. Wraps instead of shrinking, up to three lines.
  const nameSize = 112 * u;
  const lineStep = nameSize * 1.18;
  ctx.font = `700 ${Math.round(nameSize)}px ${DISPLAY_FONT}`;
  const nameLines = wrapLines((v) => ctx.measureText(v).width, text.name, W - 220 * u, 3);
  const aboveBaseline = nameSize * 0.9; // room the first line needs above its baseline
  const nameBlock = aboveBaseline + (nameLines.length - 1) * lineStep;
  const captionGap = 92 * u; // last name baseline -> caption baseline
  const qrGap = 62 * u; // caption baseline -> QR top

  // Store mark above the name: the logo in a circle, or the store's first letter when it has none.
  const markSize = Math.round((format.id === "square" ? 190 : 230) * u);
  const markGap = 56 * u;
  const markBlock = markSize + markGap;

  // The QR takes whatever height is left; the whole block is centred above the footer.
  const quiet = 4;
  const top = 100 * u;
  const bottom = footerRuleY - 40 * u;
  const room = bottom - top - markBlock - nameBlock - captionGap - qrGap;
  const module = Math.max(4, Math.floor(Math.min(860 * u, room) / (count + quiet * 2)));
  const qrSize = module * (count + quiet * 2);
  const blockHeight = markBlock + nameBlock + captionGap + qrGap + qrSize;
  const blockTop = top + (bottom - top - blockHeight) / 2;

  // Mark
  const markCx = cx;
  const markTop = Math.round(blockTop);
  ctx.save();
  ctx.beginPath();
  ctx.arc(markCx, markTop + markSize / 2, markSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = storeLogo ? "#ffffff" : NAVY;
  ctx.fill();
  if (storeLogo) {
    ctx.clip();
    // "cover" fit: fill the circle, cropping the longer side
    const scale = Math.max(markSize / storeLogo.naturalWidth, markSize / storeLogo.naturalHeight);
    const dw = storeLogo.naturalWidth * scale;
    const dh = storeLogo.naturalHeight * scale;
    ctx.drawImage(storeLogo, markCx - dw / 2, markTop + markSize / 2 - dh / 2, dw, dh);
  }
  ctx.restore();
  ctx.strokeStyle = storeLogo ? "#d3dcf2" : NAVY;
  ctx.lineWidth = Math.max(2, 5 * u);
  ctx.beginPath();
  ctx.arc(markCx, markTop + markSize / 2, markSize / 2, 0, Math.PI * 2);
  ctx.stroke();
  if (!storeLogo) {
    const initial = Array.from(text.name.trim())[0]?.toUpperCase() ?? "";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${Math.round(markSize * 0.5)}px ${DISPLAY_FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(initial, markCx, markTop + markSize / 2 + markSize * 0.03);
    ctx.textBaseline = "alphabetic";
  }

  let y = Math.round(blockTop + markBlock + aboveBaseline);
  for (const line of nameLines) {
    draw(line, cx, y, 112, 700, NAVY, DISPLAY_FONT);
    y += lineStep;
  }
  y = Math.round(y - lineStep + captionGap);
  draw(text.caption, cx, y, 42, 500, MUTED);

  // QR: modules are drawn as whole pixels so every edge stays sharp on paper.
  const qrTop = Math.round(y + qrGap);
  const qrLeft = Math.round(cx - qrSize / 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(qrLeft, qrTop, qrSize, qrSize);
  ctx.strokeStyle = "#d3dcf2";
  ctx.lineWidth = Math.max(2, 4 * u);
  roundRect(ctx, qrLeft - 14 * u, qrTop - 14 * u, qrSize + 28 * u, qrSize + 28 * u, 24 * u);
  ctx.stroke();
  ctx.fillStyle = NAVY;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.modules.get(row, col)) ctx.fillRect(qrLeft + (col + quiet) * module, qrTop + (row + quiet) * module, module, module);
    }
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("POSTER_UNAVAILABLE"))), "image/png");
  });
}

/** Prints the already-rendered poster image full-page on its paper size (A4 by default) through a hidden iframe (no pop-up needed). */
export function printPosterImage(url: string, title: string, paper: { w: number; h: number } = { w: 210, h: 297 }): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win || typeof win.print !== "function") {
      frame.remove();
      reject(new Error("PRINT_UNAVAILABLE"));
      return;
    }
    const safeTitle = title.replace(/[&<>"']/g, " ");
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>@page{size:${paper.w}mm ${paper.h}mm;margin:0}html,body{margin:0;padding:0;background:#fff}img{display:block;width:${paper.w}mm;height:${paper.h}mm}</style></head><body><img alt=""></body></html>`);
    doc.close();
    const img = doc.querySelector("img");
    if (!img) {
      frame.remove();
      reject(new Error("PRINT_UNAVAILABLE"));
      return;
    }
    img.onerror = () => {
      frame.remove();
      reject(new Error("PRINT_UNAVAILABLE"));
    };
    img.onload = () => {
      try {
        win.focus();
        win.print();
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        setTimeout(() => frame.remove(), 60_000);
      }
    };
    img.src = url;
  });
}

/** Saves a blob straight to the device's downloads (no share sheet). Works in Chrome, Safari and desktop browsers. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** The app address printed under "Powered by Fellogram": the Mini App link (t.me/<bot>/<app>), without the store's start parameter. */
export function posterAddress(link: string): string {
  const url = new URL(link);
  return `${url.host}${url.pathname}`.replace(/\/+$/, "");
}

const POSTER_LINK = /^https:\/\/t\.me\/[A-Za-z0-9_]{3,64}\/[A-Za-z0-9_]{1,64}\?startapp=join_[0-9a-f-]{36}$/i;

/** The address of the standalone poster page (opened in the phone's own browser, which can print and save). */
export function posterPageUrl(origin: string, name: string, link: string, lang: string, logoUrl?: string | null): string {
  const query = new URLSearchParams({ n: name.slice(0, 80), l: link, lang });
  if (logoUrl) query.set("lg", logoUrl);
  return `${origin}/poster?${query.toString()}`;
}

/** The poster page is public, so it only accepts a store name and a real join link; anything else is refused. */
const LOGO_URL = /^https:\/\/[A-Za-z0-9.-]+\/storage\/v1\/object\/sign\/store-logos\/[^\s"'<>]{1,600}$/;

export function readPosterParams(search: Record<string, unknown>): { name: string; link: string; lang: string; logoUrl: string | null } | null {
  const name = String(search["n"] ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const link = String(search["l"] ?? "");
  if (!name || !POSTER_LINK.test(link)) return null;
  const logo = String(search["lg"] ?? "");
  return { name, link, lang: String(search["lang"] ?? ""), logoUrl: LOGO_URL.test(logo) ? logo : null };
}
