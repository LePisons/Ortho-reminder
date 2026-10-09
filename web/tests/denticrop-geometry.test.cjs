/* eslint-disable @typescript-eslint/no-require-imports -- This test uses Node's CommonJS loader to compile the pure TypeScript utilities. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
// Run the pure TypeScript utilities with the project's existing compiler.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }
).outputText, filename);
const { fitEdit, panEdit, sourceDelta, flipEdit, mapDetectionEdit } = require('../src/lib/denticrop/utils/editorGeometry.ts');
const { expandBoxToRatio } = require('../src/lib/denticrop/utils/aaoRatios.ts');
const base = { centerX: 800, centerY: 600, width: 650, height: 850, rotation: 0, flipX: false, flipY: false };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('a small extraoral rotation uses original margins without shrinking the crop', () => {
  const result = fitEdit({ ...base, rotation: 12 }, 1600, 1200);
  close(result.width, base.width); close(result.height, base.height);
  close(result.centerX, base.centerX); close(result.centerY, base.centerY);
});
test('all output corners remain in the real source for rotated, flipped, off-center crops', () => {
  for (let rotation = -180; rotation <= 180; rotation += 3) {
    for (const flipX of [false, true]) for (const flipY of [false, true]) {
      const edit = fitEdit({ ...base, rotation, flipX, flipY, width: 1900, centerX: -50, centerY: 1400 }, 1600, 1200);
      for (const x of [-edit.width / 2, edit.width / 2]) for (const y of [-edit.height / 2, edit.height / 2]) {
        const p = sourceDelta(x, y, edit);
        assert.ok(p.x + edit.centerX >= -1e-7 && p.x + edit.centerX <= 1600 + 1e-7);
        assert.ok(p.y + edit.centerY >= -1e-7 && p.y + edit.centerY <= 1200 + 1e-7);
      }
    }
  }
});
test('dragging follows screen axes after rotation and mirroring', () => {
  for (const rotation of [0, 12.5, 90, 180]) for (const flipX of [true, false]) {
    const edit = { ...base, rotation, flipX };
    const moved = panEdit(edit, 31, -17);
    const x = (moved.centerX - edit.centerX) * (flipX ? -1 : 1);
    const y = moved.centerY - edit.centerY;
    const angle = rotation * Math.PI / 180;
    close(Math.cos(angle) * x - Math.sin(angle) * y, 31);
    close(Math.sin(angle) * x + Math.cos(angle) * y, -17);
  }
});
test('four quarter turns and two screen-axis flips restore the initial recipe', () => {
  let edit = base;
  for (let i = 0; i < 4; i++) edit = fitEdit({ ...edit, rotation: edit.rotation + 90, width: edit.height, height: edit.width }, 1600, 1200);
  close(edit.width, base.width); close(edit.height, base.height);
  for (const axis of ['x', 'y']) assert.deepEqual(flipEdit(flipEdit(base, axis), axis), base);
});
test('detection rotation maps back to the uploaded source, including occlusal mirrors', () => {
  const angle = 13 * Math.PI / 180, w = 1600, h = 1200;
  const dw = Math.ceil(w * Math.cos(angle) + h * Math.sin(angle));
  const dh = Math.ceil(w * Math.sin(angle) + h * Math.cos(angle));
  for (const flipX of [false, true]) {
    const detection = { ...base, centerX: dw / 2, centerY: dh / 2, rotation: 180, flipX };
    const mapped = mapDetectionEdit(detection, 13, dw, dh, w, h);
    close(mapped.centerX, 800); close(mapped.centerY, 600);
    close(mapped.rotation, flipX ? 167 : 193);
  }
});
test('an impossible requested ratio preserves the entire detected anatomy', () => {
  const box = { x: 0, y: 100, width: 1000, height: 600 };
  assert.deepEqual(expandBoxToRatio(box, 0.75, 1000, 1000), box);
});
test('a feasible standard ratio expands the crop without losing detection edges', () => {
  const box = { x: 1100, y: 150, width: 250, height: 800 };
  const result = expandBoxToRatio(box, 0.75, 1600, 1200);
  close(result.width / result.height, 0.75);
  assert.ok(result.x <= box.x && result.y <= box.y);
  assert.ok(result.x + result.width >= box.x + box.width);
  assert.ok(result.y + result.height >= box.y + box.height);
});
