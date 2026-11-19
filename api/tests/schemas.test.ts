import assert from 'node:assert/strict';
import test from 'node:test';
import { importSchema, validateImportRelationships } from '../src/schemas.js';

const oldExport = {
  version: 'v3.5',
  exportDate: '2026-11-19T12:00:00.000Z',
  milestones: ['Q4 2026'],
  teamNeeds: { 'Q4 2026': { Payments: { Backend: 2 } } },
  engineers: [{ id: '1', name: 'Ava Demo', role: 'Backend', seniority: 'Sr', modality: 'Interno', manager: 'Mara Demo', initialTeam: 'Payments', frozen: false, warning: true, pip: true, teams: { 'Q4 2026': 'Platform' }, rotationTypes: { 'Q4 2026': 'acotada' } }],
  changeLog: [{ id: '123', fecha: '19/11/2026 09:00', hito: 'Q4 2026', categoria: 'Equipo', descripcion: 'Cambio anterior' }],
};

test('accepts and normalizes the v3.5 JSON exported by the current HTML app', () => {
  const result = importSchema.safeParse(oldExport);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.engineers[0].warning, true);
  assert.equal(result.data.engineers[0].rotationTypes['Q4 2026'], 'acotada');
  assert.equal(validateImportRelationships(result.data), true);
});

test('rejects malformed people and negative role needs before any database writes', () => {
  const malformedPerson = { ...oldExport, engineers: [{ ...oldExport.engineers[0], teams: { 'Q4 2026': ['not-a-team'] } }] };
  const negativeNeed = { ...oldExport, teamNeeds: { 'Q4 2026': { Payments: { Backend: -1 } } } };
  assert.equal(importSchema.safeParse(malformedPerson).success, false);
  assert.equal(importSchema.safeParse(negativeNeed).success, false);
});

test('rejects duplicate milestones, duplicate people, and references to missing milestones', () => {
  const parsed = importSchema.parse(oldExport);
  assert.equal(validateImportRelationships({ ...parsed, milestones: ['Q4 2026', 'Q4 2026'] }), false);
  assert.equal(validateImportRelationships({ ...parsed, engineers: [parsed.engineers[0], parsed.engineers[0]] }), false);
  assert.equal(validateImportRelationships({ ...parsed, teamNeeds: { Unknown: { Payments: { Backend: 1 } } } }), false);
});
