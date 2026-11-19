import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getAllTeams, getVacancyBreakdown, teamForMilestone } from './domain/capacity';
import './style.css';

type User = { email: string; displayName: string; avatarUrl: string | null };
type Milestone = { name: string; position: number };
type Person = { id: string; name: string; role: string; seniority: string; modality: string; manager: string; initialTeam: string; frozen: boolean; warning: boolean; version: number };
type Assignment = { personId: string; milestone: string; teamName: string; rotationType: 'indefinida' | 'acotada' };
type Need = { milestone: string; teamName: string; role: string; requiredCount: number; version: number };
type NeedSet = { milestone: string; teamName: string; version: number };
type LogEntry = { id: number; actorName: string; action: string; details: Record<string, unknown>; createdAt: string };
type Board = { milestones: Milestone[]; teams: { name: string }[]; people: Person[]; assignments: Assignment[]; needs: Need[]; needSets: NeedSet[]; activity: LogEntry[] };
type Filters = { text: string; role: string; seniority: string; manager: string; state: string; team: string };

const emptyBoard: Board = { milestones: [], teams: [], people: [], assignments: [], needs: [], needSets: [], activity: [] };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init, headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers } });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Error ${response.status}`);
  return payload as T;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [milestone, setMilestone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filters, setFilters] = useState<Filters>({ text: '', role: '', seniority: '', manager: '', state: '', team: '' });
  const [panel, setPanel] = useState<'needs' | 'roadmap' | 'history' | 'timeline' | 'add' | null>(null);
  const [activeTeam, setActiveTeam] = useState('');
  const [activePerson, setActivePerson] = useState<Person | null>(null);
  const [needDraft, setNeedDraft] = useState<Record<string, string>>({});
  const [needVersion, setNeedVersion] = useState(0);
  const [dragging, setDragging] = useState('');
  const [roadmapTeam, setRoadmapTeam] = useState('');
  const [roadmapStatus, setRoadmapStatus] = useState('');
  const draggingRef = useRef('');

  const refresh = async () => {
    const data = await api<Board>('/api/board');
    setBoard(data);
    setMilestone(current => data.milestones.some(item => item.name === current) ? current : data.milestones[0]?.name ?? '');
  };

  useEffect(() => {
    let live = true;
    api<{ user: User | null }>('/api/session').then(async session => {
      if (!live) return;
      setUser(session.user);
      if (session.user) await refresh();
    }).catch(error => setError(error.message)).finally(() => { if (live) setLoading(false); });
    const params = new URLSearchParams(location.search);
    if (params.get('login') === 'denied') setError('Esa cuenta Google no está autorizada para Rebalance.');
    return () => { live = false; };
  }, []);

  const teams = useMemo(() => [...new Set([...getAllTeams(board.people, board.assignments), ...board.teams.map(team => team.name)])].sort((a, b) => a.localeCompare(b)), [board]);
  const currentPeople = useMemo(() => board.people.filter(person => {
    const team = teamForMilestone(person, board.assignments, milestone);
    if (filters.text && !person.name.toLowerCase().includes(filters.text.toLowerCase())) return false;
    if (filters.role && person.role !== filters.role) return false;
    if (filters.seniority && person.seniority !== filters.seniority) return false;
    if (filters.manager && person.manager !== filters.manager) return false;
    if (filters.team && team !== filters.team) return false;
    if (filters.state === 'frozen' && !person.frozen) return false;
    if (filters.state === 'warning' && !person.warning) return false;
    if (filters.state === 'neutral' && (person.frozen || person.warning)) return false;
    return true;
  }), [board, filters, milestone]);

  const teamPeople = (team: string) => currentPeople.filter(person => teamForMilestone(person, board.assignments, milestone) === team);
  const vacancyBreakdown = (team: string) => getVacancyBreakdown(team, milestone, board.people, board.assignments, board.needs);
  const getNeedCount = (team: string) => vacancyBreakdown(team).totalNeed;
  const getPending = (team: string) => vacancyBreakdown(team).totalPending;

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setError('');
    try { await action(); await refresh(); if (success) setNotice(success); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'No se pudo guardar.'); }
  };

  const patchPerson = (person: Person, field: 'frozen' | 'warning', value: boolean) => run(() => api(`/api/people/${encodeURIComponent(person.id)}`, { method: 'PATCH', body: JSON.stringify({ expectedVersion: person.version, [field]: value }) }), 'Cambio guardado.');

  const movePerson = (personId: string, teamName: string) => {
    if (!milestone || !personId || !teamName) return;
    const assignment = board.assignments.find(item => item.personId === personId && item.milestone === milestone);
    const person = board.people.find(item => item.id === personId);
    if (!person) return;
    void run(() => api(`/api/assignments/${encodeURIComponent(personId)}/${encodeURIComponent(milestone)}`, { method: 'PUT', body: JSON.stringify({ teamName, rotationType: assignment?.rotationType ?? 'indefinida', expectedVersion: person.version }) }), 'Movimiento guardado.');
  };

  const finishDrop = (teamName: string, personId = draggingRef.current) => {
    const person = board.people.find(item => item.id === personId);
    if (person && teamForMilestone(person, board.assignments, milestone) !== teamName) movePerson(personId, teamName);
    draggingRef.current = '';
    setDragging('');
  };

  const openNeeds = (team: string) => {
    setActiveTeam(team);
    const draft: Record<string, string> = {};
    board.needs.filter(item => item.milestone === milestone && item.teamName === team).forEach(item => { draft[item.role] = String(item.requiredCount); });
    setNeedVersion((board.needSets ?? []).find(item => item.milestone === milestone && item.teamName === team)?.version ?? 0);
    setNeedDraft(draft); setPanel('needs');
  };

  const saveNeeds = () => run(() => api('/api/role-needs', { method: 'PUT', body: JSON.stringify({ milestone, teamName: activeTeam, expectedVersion: needVersion, needs: Object.fromEntries(Object.entries(needDraft).map(([role, count]) => [role, Number(count) || 0])) }) }), 'Necesidades actualizadas.').then(() => setPanel(null));

  const addPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    void run(() => api('/api/people', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), name: values.name, role: values.role, seniority: values.seniority, modality: values.modality, manager: values.manager, initialTeam: values.initialTeam, teams: {}, rotationTypes: {} }) }), 'Persona agregada.').then(() => setPanel(null));
  };

  const createMilestone = async () => {
    const name = window.prompt('Nombre del nuevo hito');
    if (!name?.trim()) return;
    await run(async () => { await api('/api/milestones', { method: 'POST', body: JSON.stringify({ name }) }); await refresh(); setMilestone(name); }, 'Hito creado.');
  };

  const exportData = async () => {
    try {
      const response = await fetch('/api/export', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); link.download = `rebalance_${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'No se pudo exportar.'); }
  };

  const downloadLatestBackup = async () => {
    try {
      const data = await api<Record<string, unknown>>('/api/backups/latest');
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); link.download = `rebalance_respaldo_${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'No se pudo descargar la copia.'); }
  };

  const importData = async (file?: File) => {
    if (!file) return;
    if (!confirm('La importación reemplaza el tablero compartido para todas las personas. ¿Querés continuar? Descargá un JSON antes si necesitás conservar el estado actual.')) return;
    try { const parsed: unknown = JSON.parse(await file.text()); await run(() => api('/api/import', { method: 'POST', body: JSON.stringify(parsed) }), 'Datos migrados a la base compartida.'); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'El archivo JSON no es válido.'); }
  };

  const exportCsv = () => {
    const rows = [['Fecha', 'Persona', 'Acción', 'Detalle'], ...board.activity.map(item => [new Date(item.createdAt).toLocaleString(), item.actorName, item.action, JSON.stringify(item.details)])];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = 'rebalance_historial.csv'; link.click(); URL.revokeObjectURL(link.href);
  };

  if (loading) return <div className="loading">Cargando Rebalance…</div>;
  if (!user) return <main className="login-shell"><section className="login-card"><span className="brand-mark">R</span><p className="eyebrow">PLANIFICACIÓN DE CAPACIDAD</p><h1>Rebalance</h1><p className="muted">Organizá equipos, movimientos y necesidades en un tablero compartido.</p>{error && <div className="alert error">{error}</div>}<a className="button primary full" href="/auth/google">Continuar con Google</a><p className="login-foot">Acceso disponible para las cuentas autorizadas.</p></section></main>;

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark small">R</span><div><strong>Rebalance</strong><small>Planificación de capacidad</small></div></div><div className="top-actions"><button className="button subtle" onClick={() => setPanel('roadmap')}>Roadmap</button><button className="button subtle" onClick={() => setPanel('history')}>Historial</button><label className="button subtle import-button">Importar JSON<input type="file" accept="application/json,.json" onChange={event => { void importData(event.target.files?.[0]); event.target.value = ''; }} /></label><button className="button subtle" onClick={() => void exportData()}>Exportar</button><button className="button subtle" onClick={() => void downloadLatestBackup()}>Respaldo</button><div className="user-chip">{user.avatarUrl && <img src={user.avatarUrl} alt="" />}<span>{user.displayName}</span></div><button className="button logout" onClick={() => void api('/auth/logout', { method: 'POST' }).then(() => location.reload())}>Salir</button></div></header>
    <main className="workspace">
      <section className="page-heading"><div><p className="eyebrow">TABLERO COMPARTIDO</p><h1>Plan de equipos</h1><p className="muted">Mové capacidades entre equipos y revisá las necesidades de cada hito.</p></div><div className="heading-actions"><button className="button" onClick={() => void refresh().then(() => setNotice('Tablero actualizado.')).catch(problem => setError(problem.message))}>↻ Actualizar</button><button className="button" onClick={() => setPanel('add')}>＋ Agregar persona</button><button className="button primary" onClick={() => void createMilestone()}>＋ Nuevo hito</button></div></section>
      {error && <div className="alert error" role="alert">{error}<button onClick={() => setError('')}>Cerrar</button></div>}{notice && <div className="alert success" role="status">{notice}<button onClick={() => setNotice('')}>Cerrar</button></div>}
      {board.people.length === 0 && <section className="empty-state"><h2>Importá el estado actual del tablero</h2><p>Usá el JSON exportado desde la app anterior para cargar personas, hitos, rotaciones, necesidades e historial en Neon.</p><label className="button primary import-button">Elegir JSON<input type="file" accept="application/json,.json" onChange={event => { void importData(event.target.files?.[0]); event.target.value = ''; }} /></label></section>}
      <section className="toolbar"><label className="search"><span>⌕</span><input placeholder="Buscar persona…" value={filters.text} onChange={event => setFilters({ ...filters, text: event.target.value })} /></label><select value={milestone} onChange={event => setMilestone(event.target.value)} aria-label="Hito activo">{board.milestones.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select><button className="button compact" disabled={!milestone} onClick={async () => { const name = prompt('Nuevo nombre para el hito', milestone); if (!name?.trim() || name === milestone) return; await run(async () => { await api(`/api/milestones/${encodeURIComponent(milestone)}`, { method: 'PATCH', body: JSON.stringify({ name }) }); await refresh(); setMilestone(name); }, 'Hito renombrado.'); }}>Renombrar</button><button className="button compact danger" disabled={board.milestones.length <= 1} onClick={() => { if (confirm(`¿Eliminar el hito ${milestone}? Se borrarán sus asignaciones y necesidades.`)) void run(() => api(`/api/milestones/${encodeURIComponent(milestone)}`, { method: 'DELETE' }), 'Hito eliminado.'); }}>Eliminar hito</button><select value={filters.role} onChange={event => setFilters({ ...filters, role: event.target.value })}><option value="">Todos los roles</option>{[...new Set(board.people.map(person => person.role))].sort().map(role => <option key={role}>{role}</option>)}</select><select value={filters.seniority} onChange={event => setFilters({ ...filters, seniority: event.target.value })}><option value="">Todas las seniorities</option>{[...new Set(board.people.map(person => person.seniority))].sort().map(item => <option key={item}>{item}</option>)}</select><select value={filters.manager} onChange={event => setFilters({ ...filters, manager: event.target.value })}><option value="">Todos los managers</option>{[...new Set(board.people.map(person => person.manager).filter(Boolean))].sort().map(item => <option key={item}>{item}</option>)}</select><select value={filters.state} onChange={event => setFilters({ ...filters, state: event.target.value })}><option value="">Todos los estados</option><option value="frozen">❄ Congelados</option><option value="warning">⚠ Warning</option><option value="neutral">Neutrales</option></select><select value={filters.team} onChange={event => setFilters({ ...filters, team: event.target.value })}><option value="">Todos los equipos</option>{teams.map(team => <option key={team}>{team}</option>)}</select></section>
      <section className="board-wrap"><div className="board">{teams.map(team => {
        const people = teamPeople(team);
        const needs = getNeedCount(team); const pending = getPending(team);
        return <article className={`team-column ${dragging ? 'drop-ready' : ''}`} key={team} onDragEnter={event => event.preventDefault()} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={event => { event.preventDefault(); finishDrop(team, event.dataTransfer.getData('text/plain') || draggingRef.current || dragging); }} onPointerUp={event => { const column = (event.target as HTMLElement).closest('.team-column'); const targetTeam = column?.querySelector('h2')?.textContent; if (targetTeam) finishDrop(targetTeam); }}>
          <div className="team-head"><div><h2 title={team}>{team}</h2><p>{people.length} {people.length === 1 ? 'persona' : 'personas'}</p></div><button className="icon-button" title="Editar necesidades por rol" onClick={() => openNeeds(team)}>✎</button></div>
          <div className="team-stats"><span className="need-chip">Vacantes {needs}</span>{pending > 0 ? <span className="pending-chip">{pending} pendiente{pending === 1 ? '' : 's'}</span> : needs > 0 ? <span className="covered-chip">Cubiertas</span> : null}<button onClick={() => openNeeds(team)}>Editar</button></div>
          <div className="person-list">{people.map(person => {
            const assignment = board.assignments.find(item => item.personId === person.id && item.milestone === milestone);
            const rotated = teamForMilestone(person, board.assignments, milestone) !== person.initialTeam;
            const roleStatus = vacancyBreakdown(team).roles.find(item => item.role === person.role);
            const movedInRole = board.people.filter(item => item.role === person.role && item.initialTeam !== team && teamForMilestone(item, board.assignments, milestone) === team);
            const excess = Boolean(rotated && roleStatus && movedInRole.findIndex(item => item.id === person.id) >= roleStatus.need);
            return <article className={`person-card ${person.frozen ? 'frozen' : ''} ${rotated ? assignment?.rotationType === 'acotada' ? 'limited' : 'rotated' : ''}`} key={person.id} draggable={!person.frozen} onPointerDown={event => { if ((event.target as HTMLElement).closest('button') || person.frozen) return; draggingRef.current = person.id; setDragging(person.id); }} onDragStart={event => { draggingRef.current = person.id; event.dataTransfer.setData('text/plain', person.id); event.dataTransfer.effectAllowed = 'move'; setDragging(person.id); }} onDragEnd={() => { draggingRef.current = ''; setDragging(''); }}>
              <div className="person-title"><button className="person-name" onClick={() => { setActivePerson(person); setPanel('timeline'); }}>{person.name}</button><div className="card-actions"><button className={person.warning ? 'active-warning' : ''} title="Warning" onClick={() => void patchPerson(person, 'warning', !person.warning)}>⚠</button><button className={person.frozen ? 'active-freeze' : ''} title={person.frozen ? 'Descongelar' : 'Congelar'} onClick={() => void patchPerson(person, 'frozen', !person.frozen)}>{person.frozen ? '❄' : '🧊'}</button><button title="Eliminar persona" onClick={() => { if (confirm(`¿Eliminar a ${person.name}?`)) void run(() => api(`/api/people/${encodeURIComponent(person.id)}`, { method: 'DELETE' }), 'Persona eliminada.'); }}>×</button></div></div>
              <div className="badges"><span>{person.role}</span><span>{person.seniority}</span><span className={person.modality === 'Interno' ? 'internal' : 'external'}>{person.modality}</span>{person.warning && <span className="warning-badge">⚠ Warning</span>}{person.frozen && <span className="freeze-badge">❄ Congelado</span>}{rotated && <span className="origin-badge">← {person.initialTeam}</span>}{rotated && excess && <span className="excess-badge">Exceso</span>}</div>
            </article>;
          })}{people.length === 0 && <p className="column-empty">Soltá aquí una persona para asignarla a este equipo.</p>}</div>
        </article>;
      })}</div></section>
    </main>
    {panel && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPanel(null); }}><section className={`modal ${panel === 'roadmap' || panel === 'history' ? 'wide' : ''}`} role="dialog" aria-modal="true">
      <header className="modal-head"><div><p className="eyebrow">REBALANCE</p><h2>{panel === 'needs' ? `Necesidades · ${activeTeam}` : panel === 'roadmap' ? 'Roadmap' : panel === 'history' ? 'Historial de cambios' : panel === 'timeline' ? activePerson?.name : 'Agregar persona'}</h2></div><button className="icon-button close" onClick={() => setPanel(null)}>×</button></header>
      {panel === 'needs' && <div className="modal-body"><p className="muted">Definí cuántas personas necesitás por rol para {milestone}.</p>{[...new Set([...board.people.map(person => person.role), ...Object.keys(needDraft)])].sort().map(role => <label className="need-row" key={role}><span>{role}</span><input type="number" min="0" value={needDraft[role] ?? '0'} onChange={event => setNeedDraft({ ...needDraft, [role]: event.target.value })} /></label>)}<button className="text-button" onClick={() => setNeedDraft({ ...needDraft, 'Nuevo rol': '0' })}>＋ Agregar rol</button><footer className="modal-footer"><button className="button" onClick={() => setPanel(null)}>Cancelar</button><button className="button primary" onClick={() => void saveNeeds()}>Guardar necesidades</button></footer></div>}
      {panel === 'add' && <form className="modal-body form-grid" onSubmit={addPerson}>{[['name','Nombre'],['role','Rol'],['seniority','Seniority'],['modality','Modalidad'],['manager','Manager'],['initialTeam','Equipo inicial']].map(([name,label]) => <label key={name}>{label}<input name={name} required={name !== 'manager'} defaultValue={name === 'modality' ? 'Interno' : ''} /></label>)}<footer className="modal-footer"><button type="button" className="button" onClick={() => setPanel(null)}>Cancelar</button><button className="button primary">Agregar</button></footer></form>}
      {panel === 'roadmap' && <><div className="roadmap-filters"><select value={roadmapTeam} onChange={event => setRoadmapTeam(event.target.value)}><option value="">Todos los equipos</option>{teams.map(team => <option key={team}>{team}</option>)}</select><select value={roadmapStatus} onChange={event => setRoadmapStatus(event.target.value)}><option value="">Todos los estados</option><option value="warning">Warning</option><option value="frozen">Congelados</option><option value="rotated">Rotados</option></select></div><div className="table-wrap"><table><thead><tr><th>Equipo</th>{board.milestones.map(item => <th key={item.name}>{item.name}</th>)}</tr></thead><tbody>{teams.filter(team => !roadmapTeam || team === roadmapTeam).map(team => <tr key={team}><th>{team}</th>{board.milestones.map(item => <td key={item.name}>{board.people.filter(person => { const assignedTeam = teamForMilestone(person, board.assignments, item.name); if (assignedTeam !== team) return false; if (roadmapStatus === 'warning' && !person.warning) return false; if (roadmapStatus === 'frozen' && !person.frozen) return false; if (roadmapStatus === 'rotated' && assignedTeam === person.initialTeam) return false; return true; }).map(person => <div className="roadmap-person" key={person.id}>{person.name}{person.warning && ' ⚠'}{person.frozen && ' ❄'}</div>)}</td>)}</tr>)}</tbody></table></div></>}
      {panel === 'history' && <div className="modal-body history-list">{board.activity.map(item => <article className="history-item" key={item.id}><span className="history-dot" /><div><strong>{item.actorName}</strong><p>{item.action.replaceAll('_', ' ')} · {JSON.stringify(item.details)}</p><time>{new Date(item.createdAt).toLocaleString()}</time></div></article>)}{board.activity.length === 0 && <p className="muted">Todavía no hay cambios registrados.</p>}<div className="heading-actions"><button className="button" onClick={exportCsv}>Descargar CSV</button><button className="button danger" onClick={() => { if (confirm('¿Limpiar el historial compartido?')) void run(() => api('/api/activity', { method: 'DELETE' }), 'Historial limpiado.'); }}>Limpiar historial</button></div></div>}
      {panel === 'timeline' && activePerson && <div className="modal-body">{board.milestones.map(item => { const assignment = board.assignments.find(a => a.personId === activePerson.id && a.milestone === item.name); return <div className="timeline-row" key={item.name}><strong>{item.name}</strong><select defaultValue={assignment?.teamName ?? activePerson.initialTeam} data-milestone={item.name} className="timeline-team">{teams.map(team => <option key={team}>{team}</option>)}</select><select defaultValue={assignment?.rotationType ?? 'indefinida'} data-type={item.name} className="timeline-type"><option value="indefinida">Indefinida</option><option value="acotada">Acotada</option></select></div>; })}<footer className="modal-footer"><button className="button" onClick={() => setPanel(null)}>Cerrar</button><button className="button primary" onClick={async () => { const teamsToSave = [...document.querySelectorAll<HTMLSelectElement>('.timeline-team')]; const typesToSave = [...document.querySelectorAll<HTMLSelectElement>('.timeline-type')]; await run(async () => { let expectedVersion = activePerson.version; for (let i=0;i<teamsToSave.length;i++) { const result = await api<{ version: number }>(`/api/assignments/${encodeURIComponent(activePerson.id)}/${encodeURIComponent(teamsToSave[i].dataset.milestone!)}`, { method: 'PUT', body: JSON.stringify({ teamName: teamsToSave[i].value, rotationType: typesToSave[i].value, expectedVersion }) }); expectedVersion = result.version; } }, 'Timeline actualizado.'); setPanel(null); }}>Guardar timeline</button></footer></div>}
    </section></div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
