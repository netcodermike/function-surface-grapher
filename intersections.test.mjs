import assert from 'node:assert/strict';
import test from 'node:test';
import { findCurveIntersections, findSurfaceIntersections } from './intersections.mjs';
import { gridCoordinate, sampleCurve, surfaceCells } from './sampling.mjs';

const flatDomain = { xmin: -2, xmax: 2, ymin: -2, ymax: 2 };

function compareCurves(a, b, domain = flatDomain) {
  const series = [a, b].map((evaluate, index) => ({ index, evaluate, ...sampleCurve(evaluate, domain) }));
  return findCurveIntersections(series, domain);
}

function compareSurfaces(a, b, domain = flatDomain, steps = 10) {
  const series = [a, b].map((evaluate, index) => {
    const samples = Array.from({length: steps + 1}, (_, row) =>
      Array.from({length: steps + 1}, (_, col) => {
        const x = gridCoordinate(domain.xmin, domain.xmax, col, steps);
        const y = gridCoordinate(domain.ymin, domain.ymax, row, steps);
        return { z: evaluate(x, y) };
      }));
    return { index, evaluate, samples, cells: surfaceCells(evaluate, domain, samples) };
  });
  return findSurfaceIntersections(series, domain);
}

test('finds both true crossings and deduplicates roots on sample boundaries', () => {
  const { points, overlaps } = compareCurves(x => x ** 2, () => 1);
  assert.equal(points.length, 2);
  assert.equal(overlaps.length, 0);
  for (const [i, x] of [-1, 1].entries()) {
    assert.ok(Math.abs(points[i].x - x) < 1e-11);
    assert.ok(Math.abs(points[i].y - 1) < 1e-11);
    assert.deepEqual(points[i].pair, [0, 1]);
  }
});

test('finds all 65 intersections in the reported oscillating graph', () => {
  const domain = { xmin: 0, xmax: 100, ymin: 0, ymax: 2 };
  const wave = x => Math.sin(x) ** 2;
  const { points, limited } = compareCurves(wave, x => x / 100, domain);
  assert.equal(limited, false);
  assert.equal(points.length, 65);
  assert.equal(points[0].x, 0);
  assert.ok(Math.abs(points[1].x - .0100003333622255) < 1e-13);
  assert.ok(Math.abs(points.at(-1).x - 99.0574088924818) < 1e-11);
  for (const [i, point] of points.entries()) {
    assert.ok(Math.abs(wave(point.x) - point.x / 100) < 2e-14);
    if (i) assert.ok(point.x - points[i - 1].x > .001);
  }
});

test('finds two close crossings within a grid interval', () => {
  const domain = { xmin: 0, xmax: 1, ymin: -1, ymax: 1 };
  for (const [a, b] of [[0, .00001], [.50001, .50002]]) {
    const { points } = compareCurves(x => (x - a) * (x - b), () => 0, domain);
    assert.equal(points.length, 2);
    assert.ok(Math.abs(points[0].x - a) < 1e-12);
    assert.ok(Math.abs(points[1].x - b) < 1e-12);
  }
});

test('preserves smooth turns so all in-view tangent contacts can be found', () => {
  const domain = { xmin: 0, xmax: 100, ymin: 0, ymax: 2 };
  const wave = x => Math.sin(x) ** 2;
  assert.equal(sampleCurve(wave, domain).paths.length, 1);
  const { points } = compareCurves(wave, () => 1, domain);
  assert.equal(points.length, 32);
  points.forEach((point, i) => assert.ok(Math.abs(point.x - (i + .5) * Math.PI) < 1e-6));
});

test('reports off-grid tangent contacts and rejects close curves that never touch', () => {
  const tangent = .1234567;
  const { points } = compareCurves(x => (x - tangent) ** 2, () => 0);
  assert.equal(points.length, 1);
  assert.ok(Math.abs(points[0].x - tangent) < 1e-9);
  assert.ok(points[0].y < 1e-18);
  assert.deepEqual(compareCurves(x => 1e-10 + (x - tangent) ** 2, () => 0).points, []);
});

test('does not turn poles, jumps, or a removed root into intersection markers', () => {
  const singular = .1234567;
  for (const evaluate of [
    x => 1 / (x - singular),
    x => x < singular ? -1 : 1,
    x => (x - singular) ** 2 / (x - singular),
  ]) {
    assert.deepEqual(compareCurves(evaluate, () => 0).points, []);
  }
});

test('represents both whole and partial curve overlap as runs without point floods', () => {
  const whole = compareCurves(x => Math.sin(x) ** 2 + Math.cos(x) ** 2, () => 1);
  assert.deepEqual(whole.overlaps, [[0, 1]]);
  assert.deepEqual(whole.points, []);
  assert.equal(whole.overlapPaths.length, 1);
  const partial = compareCurves(Math.abs, x => x);
  assert.deepEqual(partial.overlaps, [[0, 1]]);
  assert.equal(partial.overlapPaths.length, 1);
  assert.equal(partial.overlapPaths[0].points[0].x, 0);
  assert.equal(partial.overlapPaths[0].points.at(-1).x, 2);
  assert.deepEqual(partial.points, []);
});

test('traces surface intersections in domain coordinates rather than normalized coordinates', () => {
  const domain = { xmin: 20, xmax: 22, ymin: -4, ymax: -2 };
  const { segments, points, overlaps } = compareSurfaces((x, y) => x + y, x => x - 3.1, domain);
  assert.ok(segments.length >= 10);
  assert.deepEqual(points, []);
  assert.deepEqual(overlaps, []);
  for (const { pair, points: endpoints } of segments) {
    assert.deepEqual(pair, [0, 1]);
    for (const [x, y, z] of endpoints) {
      assert.ok(x >= 20 && x <= 22);
      assert.ok(Math.abs(y + 3.1) < 1e-12);
      assert.ok(Math.abs(z - (x + y)) < 1e-12);
    }
  }
});

test('renders each shared contour edge only once and includes point tangencies', () => {
  const edge = compareSurfaces(x => x, () => 0);
  assert.equal(edge.segments.length, 10);
  assert.ok(edge.segments.every(segment => segment.points.every(([x, , z]) => x === 0 && z === 0)));
  const contact = compareSurfaces((x, y) => x * x + y * y, () => 0);
  assert.deepEqual(contact.segments, []);
  assert.deepEqual(contact.points, [{ pair: [0, 1], point: [0, 0, 0] }]);
});

test('does not invent intersections across rejected surface cells', () => {
  const result = compareSurfaces(x => 1 / (x - .15), () => 0);
  assert.deepEqual(result.segments, []);
  assert.deepEqual(result.points, []);
});

test('finds all six off-grid peaks touched by the z = 1 plane without inventing near misses', () => {
  const domain = { xmin: -6, xmax: 6, ymin: -6, ymax: 6 };
  const wave = (x, y) => Math.cos(x) * Math.sin(y);
  const { segments, points, overlaps } = compareSurfaces(wave, () => 1, domain, 30);
  assert.deepEqual(segments, []);
  assert.deepEqual(overlaps, []);
  assert.equal(points.length, 6);
  for (const [x, y] of [[0, -1.5], [0, .5], [-1, -.5], [-1, 1.5], [1, -.5], [1, 1.5]]) {
    const contact = points.find(({ point }) => Math.hypot(point[0] - x * Math.PI, point[1] - y * Math.PI) < 1e-7);
    assert.ok(contact, `Missing peak at (${x}π, ${y}π)`);
    assert.ok(Math.abs(contact.point[2] - 1) < 1e-14);
    assert.ok(Math.abs(wave(...contact.point) - 1) < 1e-14);
  }
  for (const height of [1 + 1e-10, 1 - 1e-10, .99]) {
    assert.deepEqual(compareSurfaces(wave, () => height, domain, 30).points, []);
  }
  assert.ok(compareSurfaces(wave, () => .99, domain, 30).segments.length > 0);
});

test('finds zero-height off-grid contacts and does not label a tilted ridge as isolated points', () => {
  const a = .1234567, b = -.2718281;
  for (const tangent of [
    (x, y) => (x - a) ** 2 + 2 * (y - b) ** 2,
    (x, y) => (x - a + 2 * (y - b)) ** 2 + .01 * (y - b) ** 2,
  ]) {
    const { points } = compareSurfaces(tangent, () => 0);
    assert.equal(points.length, 1);
    assert.ok(Math.hypot(points[0].point[0] - a, points[0].point[1] - b) < 1e-10);
    assert.deepEqual(compareSurfaces((x, y) => tangent(x, y) + 1e-12, () => 0).points, []);
  }
  assert.deepEqual(compareSurfaces((x, y) => (x - 2 * y + .3) ** 2, () => 0).points, []);
});

test('keeps an isolated surface contact alongside contours for the same expression pair', () => {
  const tangent = (x, y) => ((x - .1234567) ** 2 + (y + .2718281) ** 2) * (x + 1.03);
  const { points, segments } = compareSurfaces(tangent, () => 0, flatDomain, 30);
  assert.equal(points.length, 1);
  assert.ok(segments.length > 0);
});

test('reports coincident surfaces without outlining every facet', () => {
  const result = compareSurfaces((x, y) => x + y, (x, y) => y + x);
  assert.deepEqual(result, { segments: [], overlaps: [[0, 1]], points: [] });
});
