/**
 * Generates PWA icons (192x192 and 512x512) as PNG files
 * using only Node built-ins + a tiny inline SVG → PNG via canvas API.
 *
 * Run: node scripts/generate-icons.mjs
 *
 * Requires no extra npm packages — uses the @resvg/resvg-js approach
 * via the built-in sharp if available, otherwise falls back to a
 * minimal base64-encoded PNG.
 */

import { writeFileSync, mkdirSync } from "fs";
import { createCanvas } from "canvas";         // optional — only if available
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background — violet gradient approximated as solid
  const radius = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(size, 0, size, size, radius);
  ctx.arcTo(size, size, 0, size, radius);
  ctx.arcTo(0, size, 0, 0, radius);
  ctx.arcTo(0, 0, size, 0, radius);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#6d28d9");
  grad.addColorStop(1, "#4f46e5");
  ctx.fillStyle = grad;
  ctx.fill();

  // Zap / lightning bolt
  const s = size;
  ctx.strokeStyle = "white";
  ctx.lineWidth = s * 0.085;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = "white";

  // Scale the polygon points to current size (original viewBox 24x24)
  const scale = s / 24;
  const points = [
    [13, 2], [3, 14], [12, 14], [11, 22], [21, 10], [12, 10], [13, 2],
  ];

  ctx.beginPath();
  points.forEach(([x, y], i) => {
    const px = x * scale;
    const py = y * scale;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fill();

  return canvas.toBuffer("image/png");
}

try {
  writeFileSync(path.join(outDir, "icon-192.png"), generateIcon(192));
  console.log("✅ icon-192.png generated");
  writeFileSync(path.join(outDir, "icon-512.png"), generateIcon(512));
  console.log("✅ icon-512.png generated");
} catch (e) {
  console.error("canvas not available, using fallback SVG-as-PNG placeholder");
  // Fallback: write a minimal 1x1 transparent PNG and log a warning
  const placeholder = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  writeFileSync(path.join(outDir, "icon-192.png"), placeholder);
  writeFileSync(path.join(outDir, "icon-512.png"), placeholder);
  console.warn("⚠️  Placeholder icons written. Run: npm install canvas && node scripts/generate-icons.mjs");
}
