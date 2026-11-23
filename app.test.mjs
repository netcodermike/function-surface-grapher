import assert from 'node:assert/strict';

import test from 'node:test';
import {compileExpression, validateDomain, surfaceSamples} from './app.mjs';

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
