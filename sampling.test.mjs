import assert from 'node:assert/strict';
import test from 'node:test';
import { compileExpression, surfaceSamples, validateDomain } from './app.mjs';
import { sampleCurve, surfaceCells } from './sampling.mjs';

test('clips a steep continuous curve to the visible height range', () => {
  const domain = validateDomain(-6, 6, -4, 4);
  const { paths, hasFiniteSamples } = sampleCurve(compileExpression('1000*x'), domain);
  assert.equal(hasFiniteSamples, true);
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0][0], [-.004, -4]);
  assert.deepEqual(paths[0].at(-1), [.004, 4]);
});

test('keeps tiny signed intersections when clipping an extreme finite slope', () => {
  const domain = validateDomain(-1, 1, -1, 1);
  for (const slope of [1e308, -1e308]) {
    const evaluate = x => slope * x;
    const { paths } = sampleCurve(evaluate, domain);
    assert.equal(paths.length, 1);
    const [x1, y1] = paths[0][0];
    const [x2, y2] = paths[0].at(-1);
    assert.equal(y1, -Math.sign(slope));
    assert.equal(y2, Math.sign(slope));
    assert.ok(Math.abs(x1 * 1e308 + 1) < 1e-12);
    assert.ok(Math.abs(x2 * 1e308 - 1) < 1e-12);
  }
});

test('keeps a narrow continuous transition connected', () => {
  const domain = validateDomain(-4, 4, -2, 2);
  const { paths } = sampleCurve(compileExpression('atan(1e6*x)'), domain);
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0].find(([x]) => x === 0), [0, 0]);
});

test('separates tangent branches when endpoints across a pole are visible', () => {
  const domain = validateDomain(-3, 3, -1000, 1000);
  const { paths } = sampleCurve(compileExpression('tan(x)'), domain);
  assert.equal(paths.length, 3);
  assert.ok(paths[1].at(-1)[0] < Math.PI / 2);
  assert.ok(paths[2][0][0] > Math.PI / 2);
});

test('keeps a gap at a small off-grid pole on a wide y-axis', () => {
  const domain = validateDomain(-2, 2, -4, 4);
  const { paths } = sampleCurve(compileExpression('0.000001/(x-0.001)'), domain);
  assert.equal(paths.length, 2);
  assert.ok(paths[0].at(-1)[0] < .001);
  assert.ok(paths[1][0][0] > .001);
});

test('distinguishes undefined curves from finite curves outside the frame', () => {
  const domain = validateDomain(-1, 1, -1, 1);
  assert.deepEqual(sampleCurve(compileExpression('sqrt(-1)'), domain), { paths: [], hasFiniteSamples: false });
  assert.deepEqual(sampleCurve(compileExpression('2'), domain), { paths: [], hasFiniteSamples: true });
});

test('keeps the full smooth saddle surface mesh', () => {
  const domain = validateDomain(-3, 3, -3, 3);
  const evaluate = compileExpression('x^2-y^2', ['x', 'y']);
  assert.equal(surfaceCells(evaluate, domain, surfaceSamples(evaluate, domain)).length, 900);
});

test('samples the exact domain edges when a square root ends there', () => {
  const domain = validateDomain(-1.23, .85, -1.23, .85);
  const evaluate = compileExpression('sqrt(.85-x)*sqrt(.85-y)', ['x', 'y']);
  const points = surfaceSamples(evaluate, domain);
  assert.ok(points.every(row => row.at(-1).z === 0));
  assert.ok(points.at(-1).every(point => point.z === 0));
  assert.equal(surfaceCells(evaluate, domain, points).length, 900);
});

test('leaves a gap where a pole runs between finite surface samples', () => {
  const domain = validateDomain(-1, 1, -1, 1);
  for (const expression of ['1/(x-.05)', '1/(x-.05)^2']) {
    const evaluate = compileExpression(expression, ['x', 'y']);
    const points = surfaceSamples(evaluate, domain);
    assert.ok(points.flat().every(point => Number.isFinite(point.z)));
    const cells = surfaceCells(evaluate, domain, points);
    assert.equal(cells.length, 870);
    assert.ok(cells.every(([, col]) => col !== 15));
  }
});

test('isolated finite samples do not count as a drawable surface', () => {
  const domain = validateDomain(-1, 1, -1, 1);
  const evaluate = compileExpression('sqrt(-(x^2+y^2))', ['x', 'y']);
  const points = surfaceSamples(evaluate, domain);
  assert.equal(points.flat().filter(point => Number.isFinite(point.z)).length, 1);
  assert.deepEqual(surfaceCells(evaluate, domain, points), []);
});
