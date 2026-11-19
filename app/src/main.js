// Vice City Cover Studio — the editor.
// Wires the page: photo slots, layout / grade / size pickers, per-panel
// crop controls, caption editing, undo / redo, and one-click PNG export
// at 1080 x 1080, 1080 x 1350 and 1920 x 1080. The live preview and the
// export both draw through renderCover in ./cover.js, so what you see is
// exactly what the PNG holds. A `?shot=` query sets up a fixed scene for
// screenshots instead (./shots.js).
import { defaultCoverState, layoutPanels, renderCover, GRADES, GRADE_NAMES, LAYOUTS, LAYOUT_NAMES, SIZES } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const state = defaultCoverState();
const photos = [null, null, null, null];
const photoNames = ['Photo 1', 'Photo 2', 'Photo 3', 'Photo 4'];
let selectedPanel = 0;
let history = [];
let historyIndex = -1;
let suppressHistory = false;

const sizeById = (id) => SIZES.find((s) => s.id === id) || SIZES[0];

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function stateSnapshot() {
  return JSON.stringify({ ...state, panels: state.panels.map((p) => ({ ...p })) });
}

function pushHistory() {
  if (suppressHistory) return;
  history = history.slice(0, historyIndex + 1);
  history.push(stateSnapshot());
  if (history.length > 40) history.shift();
  historyIndex = history.length - 1;
  updateUndoButtons();
}

function applySnapshot(json) {
  const next = JSON.parse(json);
  Object.assign(state, next);
  syncControls();
  redraw();
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  suppressHistory = true;
  applySnapshot(history[historyIndex]);
  suppressHistory = false;
  updateUndoButtons();
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  suppressHistory = true;
  applySnapshot(history[historyIndex]);
  suppressHistory = false;
  updateUndoButtons();
}

function updateUndoButtons() {
  $('undo').disabled = historyIndex <= 0;
  $('redo').disabled = historyIndex >= history.length - 1;
}

/** Redraws the live preview at the current size's aspect ratio. */
function redraw() {
  const size = sizeById(state.sizeId);
  const scale = Math.min(560 / size.w, 560 / size.h);
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
  renderCover(preview, photos, state);
  $('sizeLabel').textContent = `${size.w} x ${size.h}`;
  updatePanelList();
}

/** Builds the layout / grade / size picker buttons once. */
function buildPickers() {
  const layoutBox = $('layoutPicker');
  LAYOUTS.forEach((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.layout = id;
    b.textContent = LAYOUT_NAMES[id];
    b.addEventListener('click', () => {
      state.layout = id;
      selectedPanel = 0;
      pushHistory();
      syncControls();
      redraw();
    });
    layoutBox.appendChild(b);
  });
  const gradeBox = $('gradePicker');
  GRADES.forEach((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick grade';
    b.dataset.grade = id;
    b.textContent = GRADE_NAMES[id];
    b.addEventListener('click', () => {
      state.grade = id;
      pushHistory();
      syncControls();
      redraw();
    });
    gradeBox.appendChild(b);
  });
  const sizeBox = $('sizePicker');
  SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.size = s.id;
    b.textContent = s.label;
    b.addEventListener('click', () => {
      state.sizeId = s.id;
      pushHistory();
      syncControls();
      redraw();
    });
    sizeBox.appendChild(b);
  });
}

/** Marks the active picker buttons and fills every control from state. */
function syncControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b.dataset.size === state.sizeId));
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('titleStyle').value = state.titleStyle;
  $('onePhoto').checked = state.onePhoto;
  $('showPalms').checked = state.showPalms;
  $('halftone').checked = state.halftone;
  $('grain').checked = state.grain;
  $('badge').checked = state.badge;
  $('stars').checked = state.stars;
  const slot = state.panels[selectedPanel] || { zoom: 1, ox: 0, oy: 0 };
  $('zoom').value = slot.zoom;
  $('panX').value = slot.ox;
  $('panY').value = slot.oy;
  $('zoomVal').textContent = `${Math.round(slot.zoom * 100)}%`;
  $('panelPhoto').value = String(slot.photo ?? 0);
  $('panelLabel').textContent = `Panel ${selectedPanel + 1} of ${layoutPanels(state.layout).length}`;
}

/** Rebuilds the clickable panel strip under the preview. */
function updatePanelList() {
  const list = $('panelList');
  const count = layoutPanels(state.layout).length;
  list.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'panelChip' + (i === selectedPanel ? ' active' : '');
    b.textContent = `Panel ${i + 1}`;
    b.addEventListener('click', () => {
      selectedPanel = i;
      syncControls();
      redraw();
    });
    list.appendChild(b);
  }
}

/** Reads a chosen file into a photo slot and redraws. */
async function setPhotoSlot(index, file) {
  if (!file) return;
  photos[index] = await loadImage(URL.createObjectURL(file));
  photoNames[index] = file.name.length > 18 ? file.name.slice(0, 17) + '…' : file.name;
  $(`slotName${index}`).textContent = photoNames[index];
  $(`slotThumb${index}`).textContent = '✓';
  redraw();
}

/** Builds the four photo-slot cards. */
function buildPhotoSlots() {
  const box = $('photoSlots');
  for (let i = 0; i < 4; i++) {
    const card = document.createElement('div');
    card.className = 'slot';
    card.innerHTML = `
      <span class="thumb" id="slotThumb${i}">+</span>
      <span class="slotName" id="slotName${i}">Photo ${i + 1} — empty</span>
      <label class="slotBtn">Choose file
        <input type="file" accept="image/*" data-slot="${i}" hidden>
      </label>`;
    box.appendChild(card);
  }
  box.querySelectorAll('input[type=file]').forEach((input) => {
    input.addEventListener('change', (e) => setPhotoSlot(Number(input.dataset.slot), e.target.files[0]));
  });
}

/** Exports the current cover at full resolution as a PNG download. */
export function exportCover(sizeId) {
  const size = sizeById(sizeId);
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  renderCover(off, photos, { ...state, sizeId });
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-city-cover-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve(a.download);
    }, 'image/png');
  });
}

function bindControls() {
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  $('titleInput').addEventListener('change', pushHistory);
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  $('subtitleInput').addEventListener('change', pushHistory);
  $('titleStyle').addEventListener('change', (e) => { state.titleStyle = e.target.value; pushHistory(); redraw(); });
  const toggle = (id, key) => $(id).addEventListener('change', (e) => {
    state[key] = e.target.checked;
    pushHistory();
    redraw();
  });
  toggle('onePhoto', 'onePhoto');
  toggle('showPalms', 'showPalms');
  toggle('halftone', 'halftone');
  toggle('grain', 'grain');
  toggle('badge', 'badge');
  toggle('stars', 'stars');
  $('panelPhoto').addEventListener('change', (e) => {
    state.panels[selectedPanel].photo = Number(e.target.value);
    state.onePhoto = false;
    $('onePhoto').checked = false;
    pushHistory();
    redraw();
  });
  $('zoom').addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value);
    $('zoomVal').textContent = `${Math.round(state.panels[selectedPanel].zoom * 100)}%`;
    redraw();
  });
  $('zoom').addEventListener('change', pushHistory);
  $('panX').addEventListener('input', (e) => { state.panels[selectedPanel].ox = Number(e.target.value); redraw(); });
  $('panX').addEventListener('change', pushHistory);
  $('panY').addEventListener('input', (e) => { state.panels[selectedPanel].oy = Number(e.target.value); redraw(); });
  $('panY').addEventListener('change', pushHistory);
  $('resetCrop').addEventListener('click', () => {
    state.panels[selectedPanel] = { ...state.panels[selectedPanel], zoom: 1, ox: 0, oy: 0 };
    pushHistory();
    syncControls();
    redraw();
  });
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  $('exportBtn').addEventListener('click', async () => {
    const name = await exportCover(state.sizeId);
    $('status').textContent = `Saved ${name} — share it anywhere.`;
  });
  $('exportAllBtn').addEventListener('click', async () => {
    for (const s of SIZES) await exportCover(s.id);
    $('status').textContent = 'Saved all three sizes (1080 x 1080, 1080 x 1350, 1920 x 1080).';
  });
  $('sampleBtn').addEventListener('click', async () => {
    photos[0] = await loadImage('samples/boulevard.jpg');
    photos[1] = await loadImage('samples/pier.jpg');
    $('slotName0').textContent = 'boulevard.jpg';
    $('slotName1').textContent = 'pier.jpg';
    $('slotThumb0').textContent = '✓';
    $('slotThumb1').textContent = '✓';
    redraw();
    $('status').textContent = 'Sample photos loaded — replace them with your own any time.';
  });
  // Clicking the preview picks the panel under the pointer.
  preview.addEventListener('click', (e) => {
    const r = preview.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const rects = layoutPanels(state.layout);
    const idx = rects.findIndex((d) => fx >= d.x && fx <= d.x + d.w && fy >= d.y && fy <= d.y + d.h);
    if (idx >= 0) {
      selectedPanel = idx;
      syncControls();
      redraw();
    }
  });
}

buildPickers();
buildPhotoSlots();
bindControls();
syncControls();
pushHistory();

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, state, photos, loadImage, redraw);
} else {
  redraw();
}
