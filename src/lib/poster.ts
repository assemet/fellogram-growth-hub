/**
 * The printable store poster, drawn on a canvas as an A4 page. One renderer feeds both ways out:
 * printing (desktop browsers) and sending the PNG to the owner's Telegram chat (phones, where printing is unavailable).
 * Browser-only: it needs a canvas.
 */
export const POSTER_WIDTH = 1240; // A4 at 150 dpi
export const POSTER_HEIGHT = 1754;

const NAVY = "#1b1b3a";
const MUTED = "#5b5b78";
const TINT = "#eef0fb";
const FONT = `"Segoe UI", system-ui, -apple-system, "Noto Sans Arabic", "Noto Sans", Roboto, Arial, sans-serif`;

export type PosterText = { headline: string; rewardLine: string; hint: string; powered: string };

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
export async function renderPoster(link: string, text: PosterText, dir: "rtl" | "ltr"): Promise<Blob> {
  const QRCode = (await import("qrcode")).default;
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

  const text1 = (value: string, y: number, size: number, weight: number, color: string) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillText(value, cx, y);
  };

  // Headline: up to three lines, shrinking nothing, wrapping instead.
  const headSize = 84;
  ctx.font = `800 ${headSize}px ${FONT}`;
  const headLines = wrapLines((v) => ctx.measureText(v).width, text.headline, POSTER_WIDTH - 260, 3);
  let y = 215;
  for (const line of headLines) {
    text1(line, y, headSize, 800, NAVY);
    y += headSize * 1.18;
  }

  // Reward pill
  ctx.font = `600 46px ${FONT}`;
  const rewardLines = wrapLines((v) => ctx.measureText(v).width, text.rewardLine, POSTER_WIDTH - 320, 2);
  const pillHeight = 40 + rewardLines.length * 62;
  const pillTop = y + 10;
  ctx.fillStyle = TINT;
  roundRect(ctx, 130, pillTop, POSTER_WIDTH - 260, pillHeight, 28);
  ctx.fill();
  let ry = pillTop + 20 + 46;
  for (const line of rewardLines) {
    text1(line, ry, 46, 600, NAVY);
    ry += 62;
  }

  // Hint lines are measured first so the QR can shrink to keep everything clear of the footer.
  ctx.font = `500 38px ${FONT}`;
  const hintLines = wrapLines((v) => ctx.measureText(v).width, text.hint, POSTER_WIDTH - 300, 2);
  const footerRuleY = POSTER_HEIGHT - 192;
  const hintHeight = hintLines.length * 52;

  // QR: modules are drawn as whole pixels so every edge stays sharp on paper.
  const qrTop = Math.round(pillTop + pillHeight + 56);
  const quiet = 4;
  const room = footerRuleY - 36 - hintHeight - 70 - qrTop;
  const module = Math.max(8, Math.floor(Math.min(760, room) / (count + quiet * 2)));
  const qrSize = module * (count + quiet * 2);
  const qrLeft = Math.round(cx - qrSize / 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(qrLeft, qrTop, qrSize, qrSize);
  ctx.strokeStyle = "#d6d8ea";
  ctx.lineWidth = 4;
  roundRect(ctx, qrLeft - 14, qrTop - 14, qrSize + 28, qrSize + 28, 24);
  ctx.stroke();
  ctx.fillStyle = NAVY;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.modules.get(row, col)) ctx.fillRect(qrLeft + (col + quiet) * module, qrTop + (row + quiet) * module, module, module);
    }
  }

  // Hint under the code
  let hy = qrTop + qrSize + 14 + 58;
  for (const line of hintLines) {
    text1(line, hy, 38, 500, MUTED);
    hy += 52;
  }

  // Footer
  const footerY = POSTER_HEIGHT - 120;
  ctx.strokeStyle = "#d6d8ea";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(220, footerRuleY);
  ctx.lineTo(POSTER_WIDTH - 220, footerRuleY);
  ctx.stroke();
  ctx.direction = "ltr"; // the brand line is Latin text in every language
  text1(text.powered, footerY, 44, 700, NAVY);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("POSTER_UNAVAILABLE"))), "image/png");
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("POSTER_UNAVAILABLE"));
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.readAsDataURL(blob);
  });
}
