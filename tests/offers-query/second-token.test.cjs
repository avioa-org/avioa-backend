"use strict";
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const { authenticate } = require('../../src/modules/offers-query/engine.cjs');
const digest = s => createHash('sha256').update(s).digest('hex');
const primary = randomBytes(32).toString('base64url');
const secondary = randomBytes(32).toString('base64url');
const p = digest(primary), s = digest(secondary);
const bearer = t => 'Bearer ' + t;
const rejects = (header, expected, extra, status) =>
  assert.throws(() => authenticate(header, expected, extra), error => error.status === status);
test('El token original funciona sin configurar el segundo', () => {
  authenticate(bearer(primary), p);
  authenticate(bearer(primary), p, '');
});
test('Ambos tokens funcionan al habilitar el segundo', () => {
  authenticate(bearer(primary), p, s);
  authenticate(bearer(secondary), p, s);
});
test('Un token ajeno devuelve 401', () => {
  rejects(bearer(randomBytes(32).toString('base64url')), p, s, 401);
});
test('Cabeceras ausentes o mal formadas devuelven 401', () => {
  for (const header of [undefined, '', 'Basic abc', 'Bearer corto'])
    rejects(header, p, s, 401);
});
test('Una configuración inválida devuelve 503', () => {
  rejects(bearer(primary), undefined, s, 503);
  rejects(bearer(primary), p, 'incorrecto', 503);
});
test('Retirar el hash secundario revoca solo ese acceso', () => {
  rejects(bearer(secondary), p, undefined, 401);
  authenticate(bearer(primary), p);
});
