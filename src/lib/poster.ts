/**
 * The printable store poster, drawn on a canvas as an A4 page. One renderer feeds both ways out:
 * printing and saving the PNG to the device.
 * Browser-only: it needs a canvas.
 */
export const POSTER_WIDTH = 1240; // A4 at 150 dpi
export const POSTER_HEIGHT = 1754;

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

/** Draws the poster and returns it as a PNG blob. `link` is encoded as a crisp QR (square modules, no smoothing). */
export async function renderPoster(link: string, text: PosterText, dir: "rtl" | "ltr", logoUrl = "/logo-mascot.png"): Promise<Blob> {
  const [{ default: QRCode }, logo] = await Promise.all([import("qrcode"), loadLogo(logoUrl), loadFonts(text)]);
  const qr = QRCode.create(link, { errorCorrectionLevel: "M" });
  const count = qr.modules.size;

  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("POSTER_UNAVAILABLE");
  ctx.direction = dir;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const cx = POSTER_WIDTH / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  // Frame
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 8;
  roundRect(ctx, 44, 44, POSTER_WIDTH - 88, POSTER_HEIGHT - 88, 36);
  ctx.stroke();

  const draw = (value: string, x: number, y: number, size: number, weight: number, color: string, family = FONT) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillText(value, x, y);
  };

  // Footer: a thin rule, then the app mark with "Powered by Fellogram" and the app's Telegram address.
  const footerRuleY = POSTER_HEIGHT - 290;
  ctx.strokeStyle = "#d3dcf2";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(220, footerRuleY);
  ctx.lineTo(POSTER_WIDTH - 220, footerRuleY);
  ctx.stroke();

  const logoHeight = logo ? 170 : 0;
  const logoWidth = logo ? Math.round((logoHeight * logo.naturalWidth) / logo.naturalHeight) : 0;
  const gap = logo ? 34 : 0;
  ctx.direction = "ltr"; // brand and address are Latin text in every language
  ctx.font = `700 46px ${FONT}`;
  const poweredWidth = ctx.measureText(text.powered).width;
  ctx.font = `500 36px ${FONT}`;
  const addressWidth = ctx.measureText(text.address).width;
  const blockWidth = logoWidth + gap + Math.max(poweredWidth, addressWidth);
  const left = cx - blockWidth / 2;
  const footerMid = footerRuleY + 40 + logoHeight / 2;
  if (logo) ctx.drawImage(logo, Math.round(left), Math.round(footerMid - logoHeight / 2), logoWidth, logoHeight);
  const textCenter = left + logoWidth + gap + Math.max(poweredWidth, addressWidth) / 2;
  draw(text.powered, textCenter, footerMid - 6, 46, 700, NAVY);
  draw(text.address, textCenter, footerMid + 44, 36, 500, MUTED);
  ctx.direction = dir;

  // Store name: the headline. Wraps instead of shrinking, up to three lines.
  const nameSize = 112;
  const lineStep = nameSize * 1.18;
  ctx.font = `700 ${nameSize}px ${DISPLAY_FONT}`;
  const nameLines = wrapLines((v) => ctx.measureText(v).width, text.name, POSTER_WIDTH - 220, 3);
  const aboveBaseline = nameSize * 0.9; // room the first line needs above its baseline
  const nameBlock = aboveBaseline + (nameLines.length - 1) * lineStep;
  const captionGap = 92; // last name baseline -> caption baseline
  const qrGap = 62; // caption baseline -> QR top

  // The QR takes whatever height is left; the whole block is centred above the footer.
  const quiet = 4;
  const top = 100;
  const bottom = footerRuleY - 40;
  const room = bottom - top - nameBlock - captionGap - qrGap;
  const module = Math.max(8, Math.floor(Math.min(860, room) / (count + quiet * 2)));
  const qrSize = module * (count + quiet * 2);
  const blockHeight = nameBlock + captionGap + qrGap + qrSize;
  let y = Math.round(top + (bottom - top - blockHeight) / 2 + aboveBaseline);

  for (const line of nameLines) {
    draw(line, cx, y, nameSize, 700, NAVY, DISPLAY_FONT);
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
  ctx.lineWidth = 4;
  roundRect(ctx, qrLeft - 14, qrTop - 14, qrSize + 28, qrSize + 28, 24);
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

/** Prints the already-rendered poster image on a full A4 page through a hidden iframe (no pop-up needed). */
export function printPosterImage(url: string, title: string): Promise<void> {
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
<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}img{display:block;width:210mm;height:297mm}</style></head><body><img alt=""></body></html>`);
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
export function posterPageUrl(origin: string, name: string, link: string, lang: string): string {
  const query = new URLSearchParams({ n: name.slice(0, 80), l: link, lang });
  return `${origin}/poster?${query.toString()}`;
}

/** The poster page is public, so it only accepts a store name and a real join link; anything else is refused. */
export function readPosterParams(search: Record<string, unknown>): { name: string; link: string; lang: string } | null {
  const name = String(search["n"] ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const link = String(search["l"] ?? "");
  if (!name || !POSTER_LINK.test(link)) return null;
  return { name, link, lang: String(search["lang"] ?? "") };
}
