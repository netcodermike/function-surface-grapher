import assert from 'node:assert/strict';
import test from 'node:test';
import { gridCoordinate } from './sampling.mjs';
import { paintSurface } from './surface-view.mjs';

const defaultDomain = {xmin: -1, xmax: 1, ymin: -1, ymax: 1};
const angles = {yaw: -.65, pitch: .57};
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `Expected ${actual} to be near ${expected}`);

function buildSeries(index, evaluate, domain = defaultDomain, steps = 4, exclude = () => false) {
  const {xmin, xmax, ymin, ymax} = domain;
  const samples = Array.from({length: steps + 1}, (_, row) =>
    Array.from({length: steps + 1}, (_, col) => ({
      x: 2 * col / steps - 1,
      y: 2 * row / steps - 1,
      z: evaluate(gridCoordinate(xmin, xmax, col, steps), gridCoordinate(ymin, ymax, row, steps)),
    })));
  const cells = [];
  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      if (!exclude(row, col)) cells.push([row, col]);
    }
  }
  return {index, samples, cells, evaluate};
}

function draw(series, options = {}) {
  const labels = [], fills = [];
  const context = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, strokeText() {},
    fill() { fills.push(this.fillStyle); },
    measureText(text) { return {width: text.length * 6.8}; },
    fillText(text, x, y) { labels.push({text, x, y, color: this.fillStyle, font: this.font, width: this.measureText(text).width}); },
  };
  const {domain = defaultDomain, ...view} = options;
  const values = series.flatMap(({samples}) => samples.flat().map(({z}) => z).filter(Number.isFinite));
  const projector = paintSurface(context, {series, limits: [Math.min(...values), Math.max(...values)], domain},
    {width: 920, height: 520, ...angles, ...view});
  return {...projector, labels, fills};
}

test('asymmetric domains use actual axis values and interpolate an exact plane under the pointer', () => {
  const domain = {xmin: -7, xmax: 11, ymin: 9, ymax: 13};
  const fn = (x, y) => x + 2 * y;
  const renderer = draw([buildSeries(2, fn, domain)], {domain});
  const point = {x: 2.5, y: 9.75};
  const z = fn(point.x, point.y);
  const [px, py] = renderer.projectPoint({...point, z});
  const readout = renderer.pick(px, py);
  assert.equal(readout.seriesIndex, 2);
  near(readout.x, point.x);
  near(readout.y, point.y);
  near(readout.z, z);
  const labelsFor = letter => {
    const name = renderer.labels.find(label => label.text === letter);
    return renderer.labels.filter(label => label.color === name.color).map(label => label.text);
  };
  assert.ok(labelsFor('x').includes('11'));
  assert.ok(labelsFor('y').includes('9'));
  assert.ok(labelsFor('z').includes('37'));
});

test('a probe returns the true function and follows the rendered mesh when the view rotates', () => {
  const fn = (x, y) => x * x + y;
  const series = [buildSeries(0, fn)];
  const x = .125, y = .125;
  for (const yaw of [-1.4, -.65, .9]) {
    const view = draw(series, {yaw, pitch: 1.18});
    const marker = view.probeAt(x, y, 0);
    assert.equal(marker.z, fn(x, y));
    assert.equal(marker.seriesIndex, 0);
    const atMarker = view.pick(marker.px, marker.py);
    near(atMarker.x, x);
    near(atMarker.y, y);
    near(atMarker.z, marker.z);
  }
});

test('surface holes and out-of-domain probes leave the readout empty', () => {
  const series = buildSeries(0, () => 2, defaultDomain, 2, (row, col) => row === 0 && col === 0);
  const view = draw([series], {yaw: 0, pitch: .7});
  assert.equal(view.probeAt(-.5, -.5, 0), null);
  assert.equal(view.pick(...view.projectPoint({x: -.5, y: -.5, z: 2})), null);
  assert.equal(view.probeAt(2, 0, 0), null);
  assert.equal(view.probeAt(0, 0, 50), null);
  assert.equal(view.probeAt(0, 0, 0).z, 2);
  assert.equal(view.pick(0, 0), null);
});

test('visible-triangle picking handles overlapping surfaces in paint order', () => {
  const layers = [buildSeries(0, () => -2), buildSeries(1, () => 2)];
  const view = draw(layers, {yaw: 0, pitch: Math.PI / 3});
  const [px, py] = view.projectPoint({x: 0, y: .4, z: 2});
  const hit = view.pick(px, py);
  assert.equal(hit.seriesIndex, 1);
  near(hit.y, .4);
  assert.equal(hit.z, 2);
  assert.equal(view.probeAt(0, .4, 0).z, -2);
  assert.equal(new Set(view.fills).size, 2);
});

test('the first surface keeps its blue-to-purple height ramp when adding other surfaces', () => {
  const first = buildSeries(0, x => x);
  const single = new Set(draw([first]).fills);
  assert.ok(single.has('hsl(202.875 69% 50%)'));
  assert.ok(single.has('hsl(268.125 69% 50%)'));

  const comparison = new Set(draw([first, buildSeries(1, () => 0),
    buildSeries(2, () => 0), buildSeries(3, () => 0)]).fills);
  for (const fill of single) assert.ok(comparison.has(fill));
  assert.equal(comparison.size, single.size + 3);
});

test('equal units project equal world lengths under the same foreshortening', () => {
  const domain = {xmin: -20, xmax: 20, ymin: -3, ymax: 3};
  const series = [buildSeries(0, (x, y) => 3 * y, domain)];
  const view = draw(series, {domain, yaw: 0, pitch: Math.PI / 4, scaleMode: 'equal'});
  const origin = view.projectPoint({x: 0, y: 0, z: 0});
  const x = view.projectPoint({x: 1, y: 0, z: 0});
  const y = view.projectPoint({x: 0, y: 1, z: 0});
  const z = view.projectPoint({x: 0, y: 0, z: 1});
  near(Math.abs(y[1] - origin[1]), Math.abs(z[1] - origin[1]));
  near(Math.abs(x[0] - origin[0]), Math.SQRT2 * Math.abs(z[1] - origin[1]));
});

test('small views keep axes readable through a full rotation and handle flat or extreme z', () => {
  for (const fn of [() => 17, x => x * 1.7e308]) {
    const series = [buildSeries(0, fn)];
    for (const yaw of [-Math.PI, -2, -1, 0, 1, 2, Math.PI]) {
      const view = draw(series, {width: 272, height: 232, yaw});
      for (const name of ['x', 'y', 'z']) assert.ok(view.labels.some(label => label.text === name));
      assert.ok(view.labels.filter(label => !['x', 'y', 'z'].includes(label.text)).length >= 3);
      for (const label of view.labels) {
        assert.ok(label.x - label.width / 2 >= 0 && label.x + label.width / 2 <= 272);
        assert.ok(label.y > 6 && label.y < 226);
        assert.ok(!/NaN|Infinity/.test(label.text));
      }
      const hit = view.probeAt(0, 0);
      assert.ok(Number.isFinite(hit.px) && Number.isFinite(hit.py));
      assert.equal(hit.z, fn(0, 0));
    }
  }
});
