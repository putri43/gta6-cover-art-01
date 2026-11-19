// Vice City Cover Studio — the cover engine.
// renderCover draws one complete poster onto any 2D canvas context at any
// size: multi-panel photo layout, Vice City sunset / neon colour grade,
// procedural palm silhouettes, halftone + grain, and bold caption lettering.
// Everything is drawn with canvas primitives: no external art, no fonts
// copied from any game, no network. Deterministic: the grain uses a seeded
// generator, so the same state always exports the same PNG.

export const LAYOUTS = ['hero', 'grid', 'mosaic', 'bleed', 'tilted', 'split'];
export const GRADES = ['sunset', 'neon', 'gold', 'drive', 'noir'];
export const SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  { id: '1080x1350', w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  { id: '1920x1080', w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
];

export const GRADE_NAMES = {
  sunset: 'Vice Sunset',
  neon: 'Neon Nights',
  gold: 'Palm Gold',
  drive: 'Ocean Drive',
  noir: 'Mono Noir',
};

export const LAYOUT_NAMES = {
  hero: 'Hero + 3',
  grid: 'Four Panel',
  mosaic: 'Nine Panel',
  bleed: 'Full Bleed',
  tilted: 'Snapshots',
  split: 'Diagonal Split',
};

/** A fresh default state for a new cover. */
export function defaultCoverState() {
  return {
    layout: 'hero',
    grade: 'sunset',
    sizeId: '1080x1080',
    title: 'NEON SHORE',
    subtitle: 'sunset boulevard',
    titleStyle: 'gradient',
    onePhoto: true,
    showPalms: true,
    halftone: true,
    grain: true,
    badge: true,
    stars: true,
    // One slot per panel the layout can show (max 9): which photo, zoom, pan.
    panels: Array.from({ length: 9 }, (_, i) => ({
      photo: i === 0 ? 0 : 1,
      zoom: 1,
      ox: 0,
      oy: 0,
    })),
  };
}

/** Seeded generator (mulberry32) so grain is identical on every export. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Panel rectangles for a layout, as fractions of the inner area
 * (x, y, w, h in 0..1). The title band is reserved at the bottom except
 * for full-bleed, where the title floats over the photo.
 */
export function layoutPanels(layout) {
  switch (layout) {
    case 'hero':
      return [
        { x: 0, y: 0, w: 0.62, h: 1, photo: 0 },
        { x: 0.62, y: 0, w: 0.38, h: 0.34, photo: 1 },
        { x: 0.62, y: 0.34, w: 0.38, h: 0.33, photo: 0 },
        { x: 0.62, y: 0.67, w: 0.38, h: 0.33, photo: 1 },
      ];
    case 'grid':
      return [
        { x: 0, y: 0, w: 0.5, h: 0.5, photo: 0 },
        { x: 0.5, y: 0, w: 0.5, h: 0.5, photo: 1 },
        { x: 0, y: 0.5, w: 0.5, h: 0.5, photo: 1 },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.5, photo: 0 },
      ];
    case 'mosaic':
      return Array.from({ length: 9 }, (_, i) => ({
        x: (i % 3) / 3,
        y: Math.floor(i / 3) / 3,
        w: 1 / 3,
        h: 1 / 3,
        photo: i % 2,
      }));
    case 'bleed':
      return [{ x: 0, y: 0, w: 1, h: 1, photo: 0 }];
    case 'tilted':
      return [
        { x: 0.02, y: 0.06, w: 0.36, h: 0.82, photo: 0, tilt: -5 },
        { x: 0.33, y: 0.02, w: 0.36, h: 0.82, photo: 1, tilt: 2 },
        { x: 0.63, y: 0.06, w: 0.36, h: 0.82, photo: 0, tilt: 6 },
      ];
    case 'split':
      return [
        { x: 0, y: 0, w: 1, h: 1, photo: 0, clip: 'top' },
        { x: 0, y: 0, w: 1, h: 1, photo: 1, clip: 'bottom' },
      ];
    default:
      return [{ x: 0, y: 0, w: 1, h: 1, photo: 0 }];
  }
}

/** Draws one photo cover-fit inside a rect, with zoom and pan offsets. */
export function drawFittedPhoto(ctx, photo, rx, ry, rw, rh, zoom, ox, oy) {
  if (!photo) return false;
  const base = Math.max(rw / photo.naturalWidth, rh / photo.naturalHeight);
  const scale = base * zoom;
  const pw = photo.naturalWidth * scale;
  const ph = photo.naturalHeight * scale;
  const dx = rx + (rw - pw) / 2 + ox * rw;
  const dy = ry + (rh - ph) / 2 + oy * rh;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  ctx.drawImage(photo, dx, dy, pw, ph);
  ctx.restore();
  return true;
}

/** A palm silhouette: curved trunk and seven tapering fronds. */
export function drawPalmSilhouette(ctx, x, y, s, flip, color) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  // Trunk: a gentle S-curve, thicker at the base.
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.quadraticCurveTo(-2, -70, 14, -128);
  ctx.quadraticCurveTo(20, -134, 22, -128);
  ctx.quadraticCurveTo(10, -66, 7, 0);
  ctx.closePath();
  ctx.fill();
  // Fronds fan out from the crown.
  for (let i = 0; i < 7; i++) {
    const a = (-150 + i * 50) * (Math.PI / 180);
    const len = 95 - Math.abs(i - 3) * 10;
    const tipX = 18 + Math.cos(a) * len;
    const tipY = -128 + Math.sin(a) * len * 0.62;
    const midX = 18 + Math.cos(a) * len * 0.55;
    const midY = -128 + Math.sin(a) * len * 0.55 - 26;
    ctx.beginPath();
    ctx.moveTo(18, -128);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.quadraticCurveTo(midX + 9, midY + 16, 18, -122);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A small halftone dot pattern canvas, reused as a fill pattern. */
let halftonePattern = null;
function getHalftonePattern(ctx) {
  if (halftonePattern) return halftonePattern;
  const c = document.createElement('canvas');
  c.width = 10; c.height = 10;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 10, 10);
  g.fillStyle = 'rgba(0,0,0,0.85)';
  g.beginPath(); g.arc(5, 5, 2.1, 0, Math.PI * 2); g.fill();
  halftonePattern = ctx.createPattern(c, 'repeat');
  return halftonePattern;
}

/** A seeded film-grain tile, reused as a fill pattern. */
let grainPattern = null;
function getGrainPattern(ctx) {
  if (grainPattern) return grainPattern;
  const c = document.createElement('canvas');
  c.width = 140; c.height = 140;
  const g = c.getContext('2d');
  const img = g.createImageData(140, 140);
  const rnd = seededRandom(20261119);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(c, 'repeat');
  return grainPattern;
}

const GRADE_OVERLAYS = {
  sunset: { stops: ['#ff9a3d', '#ff2975', '#7b2ff7'], blend: 'soft-light', alpha: 0.62, warm: 0.14 },
  neon: { stops: ['#00e5ff', '#ff2fb3', '#2b0a4a'], blend: 'overlay', alpha: 0.55, warm: 0.0 },
  gold: { stops: ['#ffd319', '#ff8a00', '#7a2d00'], blend: 'soft-light', alpha: 0.55, warm: 0.16 },
  drive: { stops: ['#00c6ff', '#0072ff', '#001a4d'], blend: 'soft-light', alpha: 0.55, warm: 0.0 },
  noir: { stops: ['#8a7bd8', '#3a2b5c', '#12081f'], blend: 'soft-light', alpha: 0.5, warm: 0.0 },
};

/** Applies the chosen colour grade over a rect. */
export function applyGrade(ctx, grade, rx, ry, rw, rh, noir) {
  const g = GRADE_OVERLAYS[grade] || GRADE_OVERLAYS.sunset;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  if (noir) {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'rgba(128,128,128,1)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.globalCompositeOperation = 'source-over';
  }
  const grad = ctx.createLinearGradient(rx, ry, rx + rw * 0.25, ry + rh);
  grad.addColorStop(0, g.stops[0]);
  grad.addColorStop(0.55, g.stops[1]);
  grad.addColorStop(1, g.stops[2]);
  ctx.globalCompositeOperation = g.blend;
  ctx.globalAlpha = g.alpha;
  ctx.fillStyle = grad;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (g.warm > 0) {
    ctx.globalAlpha = g.warm;
    ctx.fillStyle = '#ff7a18';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** A soft sunset glow from the top-right corner: warmth without a disc. */
export function drawCornerGlow(ctx, x, y, r, innerX, innerY, innerW, innerH) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
  glow.addColorStop(0, 'rgba(255, 214, 120, 0.5)');
  glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(innerX, innerY, innerW, innerH);
  ctx.restore();
}

/** Fits the title to the width and draws it with its style + glow. */
export function drawCoverTitle(ctx, title, subtitle, style, cx, topY, maxW, baseSize) {
  const text = (title || 'UNTITLED').trim().toUpperCase();
  let size = baseSize;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = (s) => {
    ctx.font = `900 ${s}px "Arial Black", "Archivo Black", "Helvetica Neue", Arial, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(s * 0.05)}px`; } catch { /* older canvas */ }
  };
  setFont(size);
  while (ctx.measureText(text).width > maxW && size > 18) {
    size -= 3;
    setFont(size);
  }
  const y = topY + size;
  ctx.shadowColor = 'rgba(255, 41, 117, 0.85)';
  ctx.shadowBlur = size * 0.28;
  ctx.lineJoin = 'round';
  if (style === 'gradient') {
    const grad = ctx.createLinearGradient(cx - maxW / 2, y - size, cx + maxW / 2, y);
    grad.addColorStop(0, '#ffd319');
    grad.addColorStop(0.45, '#ff2975');
    grad.addColorStop(1, '#8c1eff');
    ctx.strokeStyle = '#160423';
    ctx.lineWidth = Math.max(3, size * 0.09);
    ctx.strokeText(text, cx, y);
    ctx.fillStyle = grad;
    ctx.fillText(text, cx, y);
  } else if (style === 'outline') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.strokeText(text, cx, y);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillText(text, cx, y);
  } else {
    ctx.strokeStyle = '#160423';
    ctx.lineWidth = Math.max(3, size * 0.08);
    ctx.strokeText(text, cx, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cx, y);
  }
  ctx.shadowBlur = 0;
  const sub = (subtitle || '').trim();
  if (sub) {
    const subSize = Math.max(14, size * 0.30);
    ctx.font = `italic 600 ${subSize}px Georgia, "Times New Roman", serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.28)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = '#ffe9a8';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = subSize * 0.3;
    const subY = y + subSize * 1.7;
    const tw = ctx.measureText(sub).width;
    ctx.fillText(sub, cx, subY);
    // Thin rules flanking the subtitle.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,233,168,0.85)';
    ctx.lineWidth = Math.max(1.5, subSize * 0.07);
    const gap = tw / 2 + subSize * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - gap - subSize * 3.2, subY - subSize * 0.32);
    ctx.lineTo(cx - gap, subY - subSize * 0.32);
    ctx.moveTo(cx + gap, subY - subSize * 0.32);
    ctx.lineTo(cx + gap + subSize * 3.2, subY - subSize * 0.32);
    ctx.stroke();
  }
  ctx.restore();
  return y;
}

/** A small rotated badge ribbon, top-left of the cover. */
export function drawCoverBadge(ctx, x, y, w, h, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.1);
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#ff2975');
  grad.addColorStop(1, '#ff8a00');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = h * 0.5;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.45);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${h * 0.42}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, h * 0.03);
  ctx.restore();
}

/**
 * Draws the whole cover.
 * `photos` is an array of images (or nulls); `state` is a cover state;
 * the canvas is drawn at its own pixel size.
 */
export function renderCover(canvas, photos, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const noir = state.grade === 'noir';
  ctx.clearRect(0, 0, W, H);

  const frame = Math.round(Math.min(W, H) * 0.022);
  const gutter = Math.round(Math.min(W, H) * 0.011);
  const bleed = state.layout === 'bleed';
  const titleBand = bleed ? Math.round(H * 0.30) : Math.round(H * 0.235);
  const innerX = frame;
  const innerY = frame;
  const innerW = W - frame * 2;
  const innerH = H - frame * 2 - (bleed ? 0 : titleBand);

  // Poster paper: white frame, deep plum ground.
  ctx.fillStyle = '#fdf6ec';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1b0b33';
  ctx.fillRect(innerX, innerY, innerW, innerH + (bleed ? 0 : titleBand));

  const rects = layoutPanels(state.layout);
  const panelAt = (i) => {
    const slot = state.panels[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const def = rects[i];
    const photoIndex = state.onePhoto ? 0 : (slot.photo ?? def.photo ?? 0);
    return { def, slot, photoIndex };
  };

  // Photos, one panel at a time.
  rects.forEach((def, i) => {
    const { slot, photoIndex } = panelAt(i);
    const rx = innerX + def.x * innerW + (i === 0 ? 0 : 0);
    const ry = innerY + def.y * innerH;
    const rw = def.w * innerW;
    const rh = def.h * innerH;
    const gx = gutter / 2;
    const px = rx + (def.x > 0 ? gx : 0);
    const py = ry + (def.y > 0 ? gx : 0);
    const pw = rw - (def.x > 0 ? gx : 0) - (def.x + def.w < 1 ? gx : 0);
    const ph = rh - (def.y > 0 ? gx : 0) - (def.y + def.h < 1 ? gx : 0);
    ctx.save();
    if (def.clip === 'top') {
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(innerX + innerW, innerY);
      ctx.lineTo(innerX, innerY + innerH);
      ctx.closePath();
      ctx.clip();
    } else if (def.clip === 'bottom') {
      ctx.beginPath();
      ctx.moveTo(innerX + innerW, innerY + innerH);
      ctx.lineTo(innerX + innerW, innerY);
      ctx.lineTo(innerX, innerY + innerH);
      ctx.closePath();
      ctx.clip();
    } else if (def.tilt) {
      const cx = px + pw / 2;
      const cy = py + ph / 2;
      ctx.translate(cx, cy);
      ctx.rotate((def.tilt * Math.PI) / 180);
      ctx.translate(-cx, -cy);
      // Snapshot white border.
      ctx.fillStyle = '#fdf6ec';
      ctx.fillRect(px - gutter, py - gutter, pw + gutter * 2, ph + gutter * 2);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = gutter * 2;
      ctx.fillRect(px - gutter, py - gutter, pw + gutter * 2, ph + gutter * 2);
      ctx.shadowBlur = 0;
    }
    const photo = photos[photoIndex] || photos[0] || null;
    if (noir && photo) {
      ctx.save();
      ctx.filter = 'grayscale(1) contrast(1.12) brightness(1.04)';
      drawFittedPhoto(ctx, photo, px, py, pw, ph, slot.zoom || 1, slot.ox || 0, slot.oy || 0);
      ctx.restore();
    } else {
      drawFittedPhoto(ctx, photo, px, py, pw, ph, slot.zoom || 1, slot.ox || 0, slot.oy || 0);
    }
    if (!photo) {
      // Empty panel: a sunset placeholder so the layout still reads.
      const ph2 = ctx.createLinearGradient(px, py, px, py + ph);
      ph2.addColorStop(0, '#ff9a3d');
      ph2.addColorStop(1, '#7b2ff7');
      ctx.fillStyle = ph2;
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `700 ${Math.max(12, pw * 0.05)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('+ ADD PHOTO', px + pw / 2, py + ph / 2);
    }
    applyGrade(ctx, state.grade, px, py, pw, ph, false);
    ctx.restore();
  });

  // Diagonal split seam.
  if (state.layout === 'split') {
    ctx.save();
    ctx.strokeStyle = '#fdf6ec';
    ctx.lineWidth = gutter * 1.4;
    ctx.beginPath();
    ctx.moveTo(innerX + innerW, innerY);
    ctx.lineTo(innerX, innerY + innerH);
    ctx.stroke();
    ctx.restore();
  }

  // Warm-grade glow from the top-right corner of the photo area.
  if ((state.grade === 'sunset' || state.grade === 'gold') && state.layout !== 'mosaic') {
    drawCornerGlow(ctx, innerX + innerW, innerY, Math.min(W, H) * 0.45, innerX, innerY, innerW, innerH);
  }

  // Halftone across the lower half of the photo area.
  if (state.halftone) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = getHalftonePattern(ctx);
    ctx.fillRect(innerX, innerY + innerH * 0.55, innerW, innerH * 0.45);
    ctx.restore();
  }

  // Palm silhouettes in the lower corners of the photo area.
  if (state.showPalms) {
    const s = Math.min(W, H) / 1080;
    ctx.save();
    ctx.globalAlpha = 0.92;
    drawPalmSilhouette(ctx, innerX + innerW * 0.055, innerY + innerH * 0.985, s * 1.05, false, '#150826');
    drawPalmSilhouette(ctx, innerX + innerW * 0.945, innerY + innerH * 0.985, s * 0.85, true, '#150826');
    ctx.restore();
  }

  // Title band: deep gradient rising from the bottom.
  const bandY = innerY + innerH;
  if (!bleed) {
    const band = ctx.createLinearGradient(0, bandY, 0, bandY + titleBand);
    band.addColorStop(0, 'rgba(27,11,51,0)');
    band.addColorStop(0.35, '#1b0b33');
    band.addColorStop(1, '#12041f');
    ctx.fillStyle = band;
    ctx.fillRect(innerX, bandY, innerW, titleBand);
  } else {
    const veil = ctx.createLinearGradient(0, H - titleBand, 0, H);
    veil.addColorStop(0, 'rgba(18,4,31,0)');
    veil.addColorStop(1, 'rgba(18,4,31,0.88)');
    ctx.fillStyle = veil;
    ctx.fillRect(innerX, H - titleBand, innerW, titleBand);
  }
  // Neon rule above the title.
  ctx.fillStyle = '#ff2975';
  ctx.fillRect(innerX + innerW * 0.08, bandY + titleBand * 0.06, innerW * 0.84, Math.max(2, H * 0.004));

  drawCoverTitle(
    ctx,
    state.title,
    state.subtitle,
    state.titleStyle,
    innerX + innerW / 2,
    bandY + titleBand * 0.16,
    innerW * 0.92,
    Math.min(W, H) * 0.105,
  );

  // Badge + heat meter float over the photo area.
  if (state.badge) {
    const bw = Math.min(W, H) * 0.30;
    drawCoverBadge(ctx, innerX + bw / 2 + frame * 0.4, innerY + Math.min(W, H) * 0.045, bw, Math.min(W, H) * 0.052, '★ SUNSET EDITION ★');
  }
  if (state.stars) {
    ctx.save();
    ctx.font = `900 ${Math.round(Math.min(W, H) * 0.038)}px Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd319';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText('★★★★★', innerX + innerW - frame * 0.4, innerY + Math.min(W, H) * 0.045);
    ctx.restore();
  }

  // Film grain + vignette over everything.
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = getGrainPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(20,0,40,0)');
  vig.addColorStop(1, 'rgba(20,0,40,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}
