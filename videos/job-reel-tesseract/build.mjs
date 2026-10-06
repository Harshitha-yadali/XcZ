// Builds one PrimoBoost job Reel with Tesseract: an editable .tsrct project and
// its rendered MP4 (1080x1920, 8 seconds, silent).
//
//   node build.mjs <card.json> <output-dir>
//   node build.mjs --check              (layout self-check, no rendering)
//
// card.json holds the six strings shown on the Reel: company, role, salary,
// experience, location, eligible. Environment:
//   TSRCT        path to the Tesseract CLI (default: `tsrct` on PATH)
//   TSRCT_FFMPEG path to FFmpeg, for hosts whose Tesseract bundle has no H.264
//                encoder (Linux); switches export to the external encoder
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TSRCT = process.env.TSRCT || 'tsrct';

const DURATION_MS = 8000;
const COMP = 'main';
// Instagram Reel safe area: clear of the top bar, the caption and the action buttons.
const SAFE = { x: 80, y: 270, width: 850, height: 1210 };

const BG = [0.027, 0.043, 0.078, 1];
const MINT = [0.431, 0.906, 0.718, 1];
const TEXT = [0.945, 0.961, 0.976, 1];
const MUTED = [0.58, 0.639, 0.722, 1];

// Tesseract box text wraps but never shrinks or clips, so the layout has to know
// how many lines each string takes. assets/inter-metrics.json holds Inter's real
// advance widths (printable ASCII, per weight), which match the renderer to
// within a few pixels; other characters count as the widest glyph.
const METRICS = JSON.parse(readFileSync(path.join(HERE, 'assets', 'inter-metrics.json'), 'utf8'));

export function textWidth(text, fontSize, fontStyle) {
  const units = [...text].reduce((sum, char) => sum + (METRICS.advances[fontStyle][char.charCodeAt(0) - 32] ?? METRICS.fallback), 0);
  return (units / METRICS.unitsPerEm) * fontSize;
}

/** Greedy word wrap by measured width; trims to `maxLines` with an ellipsis. */
export function fitText(text, fontSize, fontStyle, boxWidth, maxLines) {
  const limit = boxWidth * 0.98;
  const fits = (value) => textWidth(value, fontSize, fontStyle) <= limit;
  const lines = [];
  let line = '';
  for (const word of String(text).trim().split(/\s+/)) {
    if (!line) line = word;
    else if (fits(`${line} ${word}`)) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  lines.push(line);
  if (lines.length <= maxLines) return { text: lines.join(' '), lines: lines.length };

  let last = lines[maxLines - 1];
  while (last && !fits(`${last}…`)) last = last.slice(0, -1).trimEnd();
  return { text: [...lines.slice(0, maxLines - 1), `${last}…`].join(' '), lines: maxLines };
}

const identity = (x, y) => ({ anchorPoint: [0, 0], position: [x, y], scale: [100, 100], rotation: 0, opacity: 100 });
const fullRange = { start: 0, duration: DURATION_MS };
const easeOut = { type: 'cubicBezier', x1: 0.16, y1: 1, x2: 0.3, y2: 1 };

/** Lays out the card and returns the Tesseract action batch plus the card group's placement. */
export function buildActions(card) {
  const actions = [];
  let nextId = 1;

  const group = (name, parentLayerId, x, y) => {
    const layerId = nextId++;
    actions.push({ type: 'createFxGroupLayer', compositionId: COMP, layerId, name, parentLayerId, insertIndex: 0, activeRange: fullRange, transform: identity(x, y) });
    return layerId;
  };
  const rect = (name, parentLayerId, x, y, size, shape) => {
    const layerId = nextId++;
    actions.push({ type: 'createFxRectLayer', compositionId: COMP, layerId, name, parentLayerId, insertIndex: 0, activeRange: fullRange, transform: identity(x, y), rect: { size, ...shape } });
    return layerId;
  };
  // `style.centerLines` centres that many lines vertically in the box by placing
  // the first baseline from Inter's cap height.
  const text = (name, parentLayerId, x, y, boxSize, value, style) => {
    const layerId = nextId++;
    const leading = style.leading ?? Math.round(style.fontSize * 1.2);
    const capHeight = (METRICS.capHeight / METRICS.unitsPerEm) * style.fontSize;
    actions.push({
      type: 'createFxTextLayer', compositionId: COMP, layerId, name, parentLayerId, insertIndex: 0, activeRange: fullRange, transform: identity(x, y),
      sourceText: {
        text: value, fontFamily: 'Inter', fontStyle: style.fontStyle, fontSize: style.fontSize, leading,
        fillColor: style.color, strokeWidth: 0, justification: style.align ?? 'left', tracking: style.tracking ?? 0,
        boxText: true, boxPosition: [0, 0], boxSize, verticalAlign: 'top',
        ...(style.centerLines && { boxFirstBaseline: (boxSize[1] - (style.centerLines - 1) * leading + capHeight) / 2 }),
      },
    });
    return layerId;
  };
  // Entrance: fade in while sliding `dx`/`dy` pixels into the authored position.
  const enter = (layerId, atMs, { x, y, dx = 0, dy = 0, durationMs = 550 }) => {
    const track = (propertyType, from, to) => actions.push({
      type: 'setFxPropertyKeyframes', compositionId: COMP, property: { layerId, propertyType },
      keyframes: [
        { id: `l${layerId}-${propertyType}-from`, layerTime: atMs, value: { type: 'float', value: from }, easing: { type: 'linear' } },
        { id: `l${layerId}-${propertyType}-to`, layerTime: atMs + durationMs, value: { type: 'float', value: to }, easing: easeOut },
      ],
    });
    track('opacity', 0, 100);
    if (dx) track('positionX', x + dx, x);
    if (dy) track('positionY', y + dy, y);
  };

  rect('Background', null, 0, 0, [1080, 1920], { fillColor: BG });
  const cardId = group('Job card', null, SAFE.x, SAFE.y);
  const W = SAFE.width;

  // Head: brand, "NOW HIRING" pill, company, role. Brand and pill do not animate
  // in, and the role lands within half a second, so the opening frames already
  // say what the Reel is about.
  const brandId = group('Brand', cardId, 0, 0);
  text('Brand name', brandId, 108, 0, [600, 84], 'PrimoBoost AI', { fontStyle: 'SemiBold', fontSize: 40, color: TEXT, centerLines: 1 });

  const pillId = group('Hiring pill', cardId, 0, 130);
  rect('Pill', pillId, 0, 0, [330, 64], { fillColor: [MINT[0], MINT[1], MINT[2], 0.15], roundness: 32 });
  text('Pill label', pillId, 0, 0, [330, 64], 'NOW HIRING', { fontStyle: 'SemiBold', fontSize: 30, color: MINT, align: 'center', centerLines: 1, tracking: 100 });

  const company = fitText(card.company, 50, 'Medium', W, 2);
  const companyY = 230;
  const companyHeight = company.lines * 60;
  const companyId = text('Company', cardId, 0, companyY, [W, companyHeight], company.text, { fontStyle: 'Medium', fontSize: 50, leading: 60, color: MUTED });
  enter(companyId, 0, { x: 0, y: companyY, dy: 40, durationMs: 350 });

  // Long role titles step down in size so they stay inside the card.
  const roleSize = card.role.length > 44 ? 58 : card.role.length > 24 ? 72 : 92;
  const roleLeading = Math.round(roleSize * 1.12);
  const role = fitText(card.role, roleSize, 'Bold', W, 3);
  const roleY = companyY + companyHeight + 12;
  const roleHeight = role.lines * roleLeading + 12;
  const roleId = text('Role', cardId, 0, roleY, [W, roleHeight], role.text, { fontStyle: 'Bold', fontSize: roleSize, leading: roleLeading, color: TEXT });
  enter(roleId, 100, { x: 0, y: roleY, dy: 60, durationMs: 400 });
  const headHeight = roleY + roleHeight;

  // Detail rows.
  const LABEL_WIDTH = 240;
  const VALUE_WIDTH = W - 36 - LABEL_WIDTH - 24 - 36;
  const rows = [['PACKAGE', card.salary], ['EXPERIENCE', card.experience], ['LOCATION', card.location], ['ELIGIBLE', card.eligible]]
    .map(([label, value]) => {
      const fitted = fitText(value, 42, 'SemiBold', VALUE_WIDTH, 2);
      return { label, value: fitted.text, lines: fitted.lines, height: 44 + fitted.lines * 50 };
    });
  const ROW_GAP = 18;
  const rowsHeight = rows.reduce((sum, row) => sum + row.height, 0) + ROW_GAP * (rows.length - 1);

  const CTA_HEIGHT = 190;
  const GAP = 28;
  const stacked = headHeight + GAP + rowsHeight + GAP + CTA_HEIGHT;
  // When everything fits, rows sit midway between the head and the CTA at the
  // bottom of the safe area. Otherwise stack tightly and shrink the whole card.
  const fits = stacked <= SAFE.height;
  const rowsY = fits ? headHeight + (SAFE.height - headHeight - rowsHeight - CTA_HEIGHT) / 2 : headHeight + GAP;
  const ctaY = fits ? SAFE.height - CTA_HEIGHT : rowsY + rowsHeight + GAP;
  const cardScale = fits ? 100 : (SAFE.height / stacked) * 100;

  let rowY = rowsY;
  rows.forEach((row, index) => {
    const rowId = group(`Row: ${row.label}`, cardId, 0, rowY);
    rect('Row panel', rowId, 0, 0, [W, row.height], {
      fillColor: [MINT[0], MINT[1], MINT[2], 0.04], roundness: 14, strokeEnabled: true, strokeColor: [MINT[0], MINT[1], MINT[2], 0.2], strokeWidth: 1.5,
    });
    text('Row label', rowId, 36, 0, [LABEL_WIDTH, row.height], row.label, { fontStyle: 'SemiBold', fontSize: 28, color: MINT, centerLines: 1, tracking: 80 });
    text('Row value', rowId, 36 + LABEL_WIDTH + 24, 0, [VALUE_WIDTH, row.height], row.value, { fontStyle: 'SemiBold', fontSize: 42, leading: 50, color: TEXT, centerLines: row.lines });
    enter(rowId, 800 + index * 250, { x: 0, y: rowY, dx: -80, durationMs: 450 });
    rowY += row.height + ROW_GAP;
  });

  // Call to action.
  const ctaId = group('Call to action', cardId, 0, ctaY);
  rect('CTA panel', ctaId, 0, 0, [W, CTA_HEIGHT], { fillColor: MINT, roundness: 14 });
  text('CTA keyword', ctaId, 0, 28, [W, 70], 'Comment "LINK"', { fontStyle: 'Bold', fontSize: 58, leading: 70, color: BG, align: 'center', centerLines: 1 });
  text('CTA detail', ctaId, 0, 104, [W, 56], "and we'll DM you the apply link", { fontStyle: 'SemiBold', fontSize: 38, leading: 56, color: BG, align: 'center', centerLines: 1 });
  enter(ctaId, 2000, { x: 0, y: ctaY, dy: 80, durationMs: 500 });

  return { actions, cardId, brandId, cardScale, nextId };
}

function tsrct(args) {
  return execSync(`"${TSRCT}" ${args}`, { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, TESSERACT_SKILL: 'tesseract-motion' } }).toString();
}

export function buildReel(card, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  const project = path.join(outputDir, 'reel.tsrct');
  const video = path.join(outputDir, 'reel.mp4');
  const editable = path.join(outputDir, 'editable.json');
  const actionsFile = path.join(outputDir, 'actions.json');
  rmSync(project, { force: true });

  const editDocument = (edit) => {
    tsrct(`project checkout --project "${project}" --output "${editable}"`);
    const document = JSON.parse(readFileSync(editable, 'utf8'));
    edit(document);
    writeFileSync(editable, JSON.stringify(document));
    tsrct(`project commit --project "${project}" --file "${editable}"`);
  };

  tsrct(`project create --project "${project}"`);
  editDocument((document) => { document.duration = DURATION_MS / 1000; });
  tsrct(`project import-font --project "${project}" --file "${path.join(HERE, 'assets', 'Inter-Variable.ttf')}"`);
  tsrct(`project import-asset --project "${project}" --file "${path.join(HERE, 'assets', 'primoboost-ai-logo.jpg')}" --asset-id logo --kind image`);

  const { actions, cardId, brandId, cardScale, nextId } = buildActions(card);
  writeFileSync(actionsFile, JSON.stringify(actions));
  tsrct(`project apply --project "${project}" --actions "${actionsFile}"`);

  // Image layers and group scale are document edits, not actions.
  editDocument((document) => {
    const find = (layers, id) => {
      for (const layer of layers) {
        if (layer.id === id) return layer;
        const nested = layer.layers && find(layer.layers, id);
        if (nested) return nested;
      }
      return null;
    };
    find(document.composition.layers, cardId).transform.scale = [cardScale, cardScale];
    // The logo file is 1010x1010; show it at 84x84.
    find(document.composition.layers, brandId).layers.unshift({
      type: 'Image', id: nextId, name: 'Logo', activeRange: fullRange,
      transform: { anchorPoint: [0, 0], position: [0, 0], scale: [84 / 10.1, 84 / 10.1], rotation: 0, opacity: 100 },
      source: { assetId: 'logo', fit: 'contain' },
    });
  });

  const encoder = process.env.TSRCT_FFMPEG ? ` --encoder-backend external-ffmpeg-command --ffmpeg-path "${process.env.TSRCT_FFMPEG}"` : '';
  tsrct(`export --project "${project}" --output "${video}"${encoder}`);
  return { project, video };
}

// node build.mjs --check
function selfCheck() {
  const short = fitText('Bengaluru (Hybrid)', 42, 'SemiBold', 514, 2);
  assert.deepEqual(short, { text: 'Bengaluru (Hybrid)', lines: 1 });
  const wrapped = fitText('Bengaluru, Hyderabad, Pune (Hybrid)', 42, 'SemiBold', 514, 2);
  assert.deepEqual(wrapped, { text: 'Bengaluru, Hyderabad, Pune (Hybrid)', lines: 2 });
  const cut = fitText('one two three four five six seven eight nine ten eleven twelve', 42, 'SemiBold', 300, 2);
  assert.equal(cut.lines, 2);
  assert.ok(cut.text.endsWith('…') && cut.text.startsWith('one two'));
  // Every text layer stays inside the 850px-wide card, long text or not.
  const long = { company: 'Tata Consultancy Services Digital Private Limited', role: 'Senior Software Development Engineer, Backend Platform', salary: 'Rs.45,000 / month', experience: '0-2 years (Freshers can apply)', location: 'Bengaluru, Hyderabad, Pune (Hybrid)', eligible: '2023, 2024, 2025, 2026' };
  const { actions, cardScale } = buildActions(long);
  assert.ok(cardScale > 75 && cardScale <= 100, `card scale ${cardScale}`);
  assert.ok(actions.filter((action) => action.type === 'createFxTextLayer').every((action) => action.sourceText.boxSize[0] <= SAFE.width));
  console.log('build.mjs self-check passed');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cardFile, outputDir] = process.argv.slice(2);
  if (cardFile === '--check') {
    selfCheck();
    process.exit(0);
  }
  if (!cardFile || !outputDir) {
    console.error('Usage: node build.mjs <card.json> <output-dir>');
    process.exit(1);
  }
  const result = buildReel(JSON.parse(readFileSync(cardFile, 'utf8')), outputDir);
  console.log(JSON.stringify(result));
}
