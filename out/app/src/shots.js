// Fixed scenes for screenshots: ?shot=editor shows the editor with sample
// photos loaded; ?shot=cover shows one exported cover alone, drawn by the
// app itself at the requested size. Query keys: photo (sample name),
// photo2, layout, grade, size (1080x1080 | 1080x1350 | 1920x1080),
// caption, subtitle, titleStyle. window.__shotReady is set once painted.
import { SIZES, renderCover } from './cover.js';

export async function runShot(shot, query, state, photos, loadImage, redraw) {
  const photoName = query.get('photo') || 'boulevard';
  const photo2Name = query.get('photo2') || 'pier';
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('size')) state.sizeId = query.get('size');
  if (query.get('caption')) state.title = query.get('caption');
  if (query.get('subtitle') !== null) state.subtitle = query.get('subtitle') || '';
  if (query.get('titleStyle')) state.titleStyle = query.get('titleStyle');
  if (query.get('onePhoto') === '0') state.onePhoto = false;

  photos[0] = await loadImage(`samples/${photoName}.jpg`);
  photos[1] = await loadImage(`samples/${photo2Name}.jpg`);
  document.getElementById('slotName0').textContent = `${photoName}.jpg`;
  document.getElementById('slotName1').textContent = `${photo2Name}.jpg`;
  document.getElementById('slotThumb0').textContent = '✓';
  document.getElementById('slotThumb1').textContent = '✓';

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const size = SIZES.find((s) => s.id === state.sizeId) || SIZES[0];
    const canvas = document.getElementById('preview');
    canvas.width = size.w;
    canvas.height = size.h;
    renderCover(canvas, photos, state);
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.objectFit = 'contain';
    canvas.style.background = '#12041f';
  } else {
    redraw();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
