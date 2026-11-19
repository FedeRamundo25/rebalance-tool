import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from './db.js';
import { requireAuth } from './auth.js';
import { importSchema, personSchema, validateImportRelationships } from './schemas.js';

const router = Router();
type ActorRequest = Parameters<typeof requireAuth>[0];
function actor(req: ActorRequest) {
  return req.user as Express.User;
}

async function writeActivity(client: { query: typeof pool.query }, req: ActorRequest, action: string, details: unknown = {}) {
  const user = actor(req);
  await client.query(
    'INSERT INTO activity_log (actor_sub, actor_name, action, details) VALUES ($1, $2, $3, $4)',
    [user.googleSub, user.displayName, action, JSON.stringify(details)],
  );
}

async function insertRows(client: { query: typeof pool.query }, table: string, columns: string[], rows: unknown[][]) {
  const chunkSize = Math.max(1, Math.floor(50000 / columns.length));
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const values: unknown[] = [];
    const tuples = rows.slice(offset, offset + chunkSize).map(row => `(${row.map(value => { values.push(value); return `$${values.length}`; }).join(',')})`);
    await client.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${tuples.join(',')}`, values);
  }
}

router.use('/api', requireAuth);

router.post('/api/people', async (req, res, next) => {
  const parsed = personSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos de persona inválidos.' });
  const person = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO teams (name) VALUES ($1) ON CONFLICT DO NOTHING`, [person.initialTeam]);
    await client.query(`INSERT INTO people (id, name, role, seniority, modality, manager, initial_team, frozen, warning)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [person.id, person.name, person.role, person.seniority, person.modality, person.manager, person.initialTeam, person.frozen, person.warning]);
    await writeActivity(client, req, 'persona_creada', { name: person.name });
    await client.query('COMMIT');
    res.status(201).json({ ok: true });
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

router.patch('/api/people/:id', async (req, res, next) => {
  const schema = z.object({ expectedVersion: z.number().int().positive(), frozen: z.boolean().optional(), warning: z.boolean().optional(), name: z.string().trim().min(1).max(160).optional(), role: z.string().trim().min(1).max(120).optional(), seniority: z.string().trim().max(80).optional(), modality: z.string().trim().max(80).optional(), manager: z.string().trim().max(160).optional() }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Actualización inválida.' });
  const { expectedVersion, ...fields } = parsed.data;
  const columns: Record<string, string> = { frozen: 'frozen', warning: 'warning', name: 'name', role: 'role', seniority: 'seniority', modality: 'modality', manager: 'manager' };
  const updates = Object.entries(fields).filter(([key, value]) => columns[key] && value !== undefined);
  if (!updates.length) return res.status(400).json({ error: 'No hay cambios para guardar.' });
  const sql = updates.map(([key], index) => `${columns[key]} = $${index + 1}`).join(', ');
  try {
    const idPlaceholder = updates.length + 1;
    const versionPlaceholder = updates.length + 2;
    const result = await query(`UPDATE people SET ${sql}, version = version + 1, updated_at = now() WHERE id = $${idPlaceholder} AND version = $${versionPlaceholder} RETURNING version`, [...updates.map(([, value]) => value), req.params.id, expectedVersion]);
    if (!result.rowCount) return res.status(409).json({ error: 'Otra persona actualizó este registro. Actualizá el tablero y reintentá.' });
    await query('INSERT INTO activity_log (actor_sub, actor_name, action, details) VALUES ($1,$2,$3,$4)', [actor(req).googleSub, actor(req).displayName, 'persona_actualizada', JSON.stringify({ personId: req.params.id, changes: Object.keys(fields) })]);
    res.json({ version: result.rows[0].version });
  } catch (error) { next(error); }
});

router.delete('/api/people/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const removed = await client.query('DELETE FROM people WHERE id = $1 RETURNING name', [req.params.id]);
    if (!removed.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Persona no encontrada.' }); }
    await writeActivity(client, req, 'persona_eliminada', { name: removed.rows[0].name });
    await client.query('COMMIT');
    res.status(204).end();
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

router.put('/api/assignments/:personId/:milestone', async (req, res, next) => {
  const parsed = z.object({ teamName: z.string().trim().min(1).max(160), rotationType: z.enum(['indefinida', 'acotada']).default('indefinida'), expectedVersion: z.number().int().positive() }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Asignación inválida.' });
  const { teamName, rotationType, expectedVersion } = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const person = await client.query('SELECT version, frozen FROM people WHERE id = $1 FOR UPDATE', [req.params.personId]);
    if (!person.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Persona no encontrada.' }); }
    if (person.rows[0].frozen) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'La persona está congelada y no se puede mover.' }); }
    if (person.rows[0].version !== expectedVersion) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Otra persona actualizó este registro. Actualizá el tablero y reintentá.' }); }
    await client.query('INSERT INTO teams (name) VALUES ($1) ON CONFLICT DO NOTHING', [teamName]);
    await client.query(`INSERT INTO assignments (person_id, milestone, team_name, rotation_type) VALUES ($1,$2,$3,$4)
      ON CONFLICT (person_id, milestone) DO UPDATE SET team_name = EXCLUDED.team_name, rotation_type = EXCLUDED.rotation_type, updated_at = now()`, [req.params.personId, req.params.milestone, teamName, rotationType]);
    const updated = await client.query('UPDATE people SET version = version + 1, updated_at = now() WHERE id = $1 RETURNING version', [req.params.personId]);
    await writeActivity(client, req, 'asignacion_actualizada', { personId: req.params.personId, milestone: req.params.milestone, teamName, rotationType });
    await client.query('COMMIT');
    res.json({ version: updated.rows[0].version });
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

router.post('/api/milestones', async (req, res, next) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(120) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Nombre de hito inválido.' });
  try {
    await query('INSERT INTO milestones (name, position) VALUES ($1, (SELECT COALESCE(MAX(position), -1) + 1 FROM milestones))', [parsed.data.name]);
    await writeActivity(pool, req, 'hito_creado', { name: parsed.data.name });
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

router.patch('/api/milestones/:name', async (req, res, next) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(120) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Nombre de hito inválido.' });
  const oldName = req.params.name;
  const newName = parsed.data.name;
  if (oldName === newName) return res.json({ ok: true });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT position FROM milestones WHERE name = $1', [oldName]);
    if (!current.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Hito no encontrado.' }); }
    const assignments = await client.query('SELECT person_id, team_name, rotation_type FROM assignments WHERE milestone = $1', [oldName]);
    const needs = await client.query('SELECT team_name, role, required_count FROM role_needs WHERE milestone = $1', [oldName]);
    const needSets = await client.query('SELECT team_name, version FROM need_sets WHERE milestone = $1', [oldName]);
    await client.query('DELETE FROM milestones WHERE name = $1', [oldName]);
    await client.query('INSERT INTO milestones (name, position) VALUES ($1, $2)', [newName, current.rows[0].position]);
    for (const row of assignments.rows) await client.query('INSERT INTO assignments (person_id,milestone,team_name,rotation_type) VALUES ($1,$2,$3,$4)', [row.person_id,newName,row.team_name,row.rotation_type]);
    for (const row of needs.rows) await client.query('INSERT INTO role_needs (milestone,team_name,role,required_count) VALUES ($1,$2,$3,$4)', [newName,row.team_name,row.role,row.required_count]);
    for (const row of needSets.rows) await client.query('INSERT INTO need_sets (milestone,team_name,version) VALUES ($1,$2,$3)', [newName,row.team_name,row.version]);
    await writeActivity(client, req, 'hito_renombrado', { oldName, newName });
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

router.delete('/api/milestones/:name', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const count = await client.query('SELECT count(*)::int AS count FROM milestones');
    if (count.rows[0].count <= 1) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Debe quedar al menos un hito.' }); }
    const removed = await client.query('DELETE FROM milestones WHERE name = $1 RETURNING name', [req.params.name]);
    if (!removed.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Hito no encontrado.' }); }
    await writeActivity(client, req, 'hito_eliminado', { name: req.params.name });
    await client.query('COMMIT');
    res.status(204).end();
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

router.put('/api/role-needs', async (req, res, next) => {
  const parsed = z.object({ milestone: z.string().min(1), teamName: z.string().trim().min(1).max(160), expectedVersion: z.number().int().min(0), needs: z.record(z.string().trim().min(1).max(120), z.number().int().min(0).max(10000)) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Necesidades inválidas.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO teams (name) VALUES ($1) ON CONFLICT DO NOTHING', [parsed.data.teamName]);
    await client.query('INSERT INTO need_sets (milestone, team_name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [parsed.data.milestone, parsed.data.teamName]);
    const current = await client.query('SELECT version FROM need_sets WHERE milestone = $1 AND team_name = $2 FOR UPDATE', [parsed.data.milestone, parsed.data.teamName]);
    if (current.rows[0].version !== parsed.data.expectedVersion) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Otra persona cambió estas necesidades. Actualizá el tablero y reintentá.' }); }
    await client.query('DELETE FROM role_needs WHERE milestone = $1 AND team_name = $2', [parsed.data.milestone, parsed.data.teamName]);
    for (const [role, requiredCount] of Object.entries(parsed.data.needs)) {
      if (requiredCount > 0) await client.query('INSERT INTO role_needs (milestone, team_name, role, required_count) VALUES ($1,$2,$3,$4)', [parsed.data.milestone, parsed.data.teamName, role, requiredCount]);
    }
    const updated = await client.query('UPDATE need_sets SET version = version + 1 WHERE milestone = $1 AND team_name = $2 RETURNING version', [parsed.data.milestone, parsed.data.teamName]);
    await writeActivity(client, req, 'necesidades_actualizadas', { milestone: parsed.data.milestone, teamName: parsed.data.teamName });
    await client.query('COMMIT');
    res.json({ version: updated.rows[0].version });
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

router.get('/api/export', async (_req, res, next) => {
  try {
    const [milestones, people, assignments, needs, activity] = await Promise.all([
      query('SELECT name FROM milestones ORDER BY position'),
      query('SELECT id, name, role, seniority, modality, manager, initial_team AS "initialTeam", frozen, warning FROM people ORDER BY name'),
      query('SELECT person_id AS "personId", milestone, team_name AS "teamName", rotation_type AS "rotationType" FROM assignments'),
      query('SELECT milestone, team_name AS "teamName", role, required_count AS count FROM role_needs'),
      query('SELECT actor_name AS usuario, action AS descripcion, created_at AS fecha FROM activity_log ORDER BY created_at'),
    ]);
    const engineers = people.rows.map((person: Record<string, unknown>) => ({ ...person, teams: Object.fromEntries(assignments.rows.filter(a => a.personId === person.id).map(a => [a.milestone, a.teamName])), rotationTypes: Object.fromEntries(assignments.rows.filter(a => a.personId === person.id).map(a => [a.milestone, a.rotationType])) }));
    const teamNeeds: Record<string, Record<string, Record<string, number>>> = {};
    for (const need of needs.rows) (((teamNeeds[need.milestone] ??= {})[need.teamName] ??= {})[need.role] = Number(need.count));
    res.json({ version: 'v1', exportDate: new Date().toISOString(), milestones: milestones.rows.map(m => m.name), engineers, teamNeeds, changeLog: activity.rows });
  } catch (error) { next(error); }
});

router.get('/api/backups/latest', async (_req, res, next) => {
  try {
    const result = await query('SELECT snapshot FROM board_snapshots ORDER BY created_at DESC LIMIT 1');
    if (!result.rowCount) return res.status(404).json({ error: 'Todavía no hay una copia automática.' });
    res.json(result.rows[0].snapshot);
  } catch (error) { next(error); }
});

router.delete('/api/activity', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM activity_log');
    await writeActivity(client, req, 'historial_limpiado');
    await client.query('COMMIT');
    res.status(204).end();
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

router.post('/api/import', async (req, res, next) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'El archivo no cumple el formato de Rebalance.' });
  const { milestones, engineers, teamNeeds, changeLog } = parsed.data;
  if (!validateImportRelationships(parsed.data)) return res.status(400).json({ error: 'Hay hitos duplicados o relaciones que apuntan a un hito inexistente.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [oldMilestones, oldPeople, oldAssignments, oldNeeds, oldLog] = await Promise.all([
      client.query('SELECT name FROM milestones ORDER BY position'),
      client.query('SELECT id, name, role, seniority, modality, manager, initial_team AS "initialTeam", frozen, warning FROM people ORDER BY name'),
      client.query('SELECT person_id AS "personId", milestone, team_name AS "teamName", rotation_type AS "rotationType" FROM assignments'),
      client.query('SELECT milestone, team_name AS "teamName", role, required_count AS count FROM role_needs'),
      client.query('SELECT actor_name AS usuario, action AS descripcion, created_at AS fecha FROM activity_log ORDER BY created_at'),
    ]);
    if (oldMilestones.rowCount) {
      const snapshotPeople = oldPeople.rows.map((person: Record<string, unknown>) => ({ ...person, teams: Object.fromEntries(oldAssignments.rows.filter(a => a.personId === person.id).map(a => [a.milestone, a.teamName])), rotationTypes: Object.fromEntries(oldAssignments.rows.filter(a => a.personId === person.id).map(a => [a.milestone, a.rotationType])) }));
      const snapshotNeeds: Record<string, Record<string, Record<string, number>>> = {};
      for (const need of oldNeeds.rows) (((snapshotNeeds[need.milestone] ??= {})[need.teamName] ??= {})[need.role] = Number(need.count));
      const snapshot = { version: 'v1', exportDate: new Date().toISOString(), milestones: oldMilestones.rows.map(item => item.name), engineers: snapshotPeople, teamNeeds: snapshotNeeds, changeLog: oldLog.rows };
      await client.query('INSERT INTO board_snapshots (created_by, snapshot) VALUES ($1,$2)', [actor(req).googleSub, JSON.stringify(snapshot)]);
    }
    await client.query('DELETE FROM activity_log'); await client.query('DELETE FROM role_needs'); await client.query('DELETE FROM assignments'); await client.query('DELETE FROM people'); await client.query('DELETE FROM milestones'); await client.query('DELETE FROM teams');
    await insertRows(client, 'milestones', ['name', 'position'], milestones.map((name, position) => [name, position]));
    const teamSet = new Set<string>(['Payments Management']);
    for (const person of engineers) {
      teamSet.add(person.initialTeam);
      Object.values(person.teams).forEach(team => teamSet.add(team));
    }
    Object.values(teamNeeds).forEach(byTeam => Object.keys(byTeam).forEach(team => teamSet.add(team)));
    await insertRows(client, 'teams', ['name'], [...teamSet].map(team => [team]));
    await insertRows(client, 'people', ['id','name','role','seniority','modality','manager','initial_team','frozen','warning'], engineers.map(person => [person.id,person.name,person.role,person.seniority,person.modality,person.manager,person.initialTeam,person.frozen,person.warning]));
    const assignmentRows = engineers.flatMap(person => Object.entries(person.teams).map(([milestone, teamName]) => [person.id,milestone,teamName,person.rotationTypes[milestone] ?? 'indefinida']));
    await insertRows(client, 'assignments', ['person_id','milestone','team_name','rotation_type'], assignmentRows);
    const needRows: unknown[][] = [];
    const needSetRows: unknown[][] = [];
    for (const [milestone, byTeam] of Object.entries(teamNeeds)) {
      for (const [teamName, byRole] of Object.entries(byTeam)) {
        needSetRows.push([milestone, teamName, 1]);
        for (const [role, count] of Object.entries(byRole)) if (count > 0) needRows.push([milestone,teamName,role,count]);
      }
    }
    await insertRows(client, 'need_sets', ['milestone','team_name','version'], needSetRows);
    await insertRows(client, 'role_needs', ['milestone','team_name','role','required_count'], needRows);
    const logRows: unknown[][] = [];
    for (const entry of changeLog.slice(-10000)) {
      const timestamp = entry.fecha && /^\d{4}-\d{2}-\d{2}T/.test(entry.fecha) ? new Date(entry.fecha) : null;
      const createdAt = timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : new Date().toISOString();
      logRows.push([entry.usuario ?? 'Importado', entry.descripcion ?? entry.categoria ?? 'Cambio histórico', JSON.stringify({ imported: true, category: entry.categoria ?? null, milestone: entry.hito ?? null, legacyDate: entry.fecha ?? null }), createdAt]);
    }
    await insertRows(client, 'activity_log', ['actor_name','action','details','created_at'], logRows);
    await writeActivity(client, req, 'datos_importados', { people: engineers.length, milestones: milestones.length });
    await client.query('COMMIT');
    res.json({ ok: true, people: engineers.length, milestones: milestones.length });
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

export default router;
