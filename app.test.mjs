import assert from 'node:assert/strict';

import test from 'node:test';
import {buildModel, compileExpression, curveViewport, validateDomain, surfaceSamples} from './app.mjs';
import {axisFraction, axisTicks, axisValue} from './coordinates.mjs';

test('math grammar uses right-associated powers and unary precedence', () => {
  assert.equal(compileExpression('2^3^2')(0),512);
  assert.equal(compileExpression('-2^2+2^-2')(0),-3.75);
  assert.equal(compileExpression('1.5e-2 + 2*x')(2),4.015);
  assert.ok(Math.abs(compileExpression('cos(pi/2)+exp(0)')(0)-1)<1e-12);
});
test('variables are scoped and other tokens are rejected', () => {
  assert.equal(compileExpression('sqrt(x^2+y^2)',['x','y'])(3,4),5);
  for (const expression of ['x y','sin x','(2','2+','x.constructor','y','1e999'])
    assert.throws(()=>compileExpression(expression));
});
test('sampling keeps undefined points as gaps and validates domains', () => {
  const domain=validateDomain(-1,1,-1,1);
  const rows=surfaceSamples(compileExpression('sqrt(x)',['x','y']),domain,2);
  assert.equal(rows[0][0].z,null);
  assert.equal(rows[2][2].z,1);
  assert.throws(()=>validateDomain(1,1,-2,2));
});

test('accepts decimal bounds exactly the advertised minimum apart', () => {
  for (const [min, max] of [[.1, .10001], [-.10001, -.1], [999999, 999999.00001]]) {
    assert.deepEqual(validateDomain(min, max, min, max), {
      xmin: min, xmax: max, ymin: min, ymax: max,
    });
  }
  assert.throws(() => validateDomain(.1, .100009999, -1, 1));
});

test('accepts a matching equation prefix and common real-valued functions', () => {
  assert.equal(compileExpression('y = cbrt(x) + ln(e)')(-8), -1);
  assert.equal(compileExpression('z = x + y', ['x', 'y'])(3, 9), 12);
  assert.throws(() => compileExpression('x = 3'));
  assert.throws(() => compileExpression('y = x + y', ['x', 'y']));
});

test('ticks stay finite, distinct and in range with extreme and narrow bounds', () => {
  const ranges = [[-1.7e308, 1.7e308], [-1e-160, 1e-160], [999999.99999, 1000000], [7, 7]];
  for (const [min, max] of ranges) {
    const ticks = axisTicks(min, max, 5);
    assert.ok(ticks.length >= (min === max ? 1 : 2));
    assert.ok(ticks.every(tick => tick.value >= min && tick.value <= max));
    assert.equal(new Set(ticks.map(tick => tick.text)).size, ticks.length);
    assert.ok(ticks.every(tick => Number.isFinite(axisFraction(tick.value, min, max))));
  }
  assert.equal(axisValue(.5, -1.7e308, 1.7e308), 0);
});

test('2D aspect ratio and pointer transform use the same domain coordinates', () => {
  const domain = validateDomain(40, 50, -25, 25);
  const viewport = curveViewport(domain, {left: 40, right: 550, top: 10, bottom: 300}, true);
  assert.equal(viewport.inputX(viewport.x(45)), 45);
  assert.ok(Math.abs(viewport.x(42) - viewport.x(41) - (viewport.y(1) - viewport.y(2))) < 1e-12);
  assert.ok(!viewport.contains(40, 20));
});

test('multiple surfaces share the sampled z range and expose their intersection', () => {
  const domain = validateDomain(-3, 3, -2, 2);
  const graph = buildModel({mode:'3d', sources:['0.5*x', '-0.5*x+1']}, domain);
  assert.deepEqual(graph.limits, [-1.5, 2.5]);
  assert.deepEqual(graph.series.map(item => item.index), [0, 1]);
  assert.ok(graph.intersections.segments.length > 0);
  for (const {points} of graph.intersections.segments) {
    assert.ok(points.every(([x, , z]) => Math.abs(x - 1) < 1e-10 && Math.abs(z - .5) < 1e-10));
  }
});

test('an invalid expression identifies its row and a missing real domain can coexist with a valid curve', () => {
  const domain = validateDomain(-2, 2, -3, 3);
  assert.throws(() => buildModel({mode:'2d', sources:['x', 'bad(x)']}, domain), /Expression 2/);
  const graph = buildModel({mode:'2d', sources:['x', 'sqrt(-3)']}, domain);
  assert.equal(graph.series[0].hasFiniteSamples, true);
  assert.equal(graph.series[1].hasFiniteSamples, false);
});
