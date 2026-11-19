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
  const [needsPanelVisible, setNeedsPanelVisible] = useState(true);
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

  if (loading) return <div className="min-h-screen grid place-items-center bg-slate-100 text-slate-500">Cargando Rebalance…</div>;
  if (!user) return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4"><section className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 w-full max-w-md"><span className="bg-blue-600 text-white font-bold text-2xl w-12 h-12 rounded-xl grid place-items-center mb-5">R</span><p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Planificación de capacidad</p><h1 className="text-3xl font-bold text-slate-800 mt-1">Rebalance</h1><p className="text-slate-500 text-sm mt-2 mb-5">Organizá equipos, movimientos y necesidades en un tablero compartido.</p>{error && <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 text-sm mb-4">{error}</div>}<a className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-3 rounded-lg shadow transition" href="/auth/google">Continuar con Google</a><p className="text-slate-400 text-xs text-center mt-4">Acceso disponible para las cuentas autorizadas.</p></section></main>;

  return <div className="bg-slate-100 font-sans p-4 md:p-6 min-h-screen flex flex-col">
    <header className="max-w-full mx-auto w-full mb-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b pb-4 border-slate-200">
      <div>
        <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-slate-800">Rebalanceo y Planificación de Capacidad</h1><span className="bg-blue-100 text-blue-800 font-bold text-xs px-2.5 py-0.5 rounded-full border border-blue-200">v3.5</span></div>
        <p className="text-slate-500 text-sm">Gestionando <span className="font-bold text-slate-700">{board.people.length}</span> integrantes en total.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <label htmlFor="select-milestone" className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2">Hito / Escenario:</label>
        <select id="select-milestone" value={milestone} onChange={event => setMilestone(event.target.value)} className="bg-blue-50 text-blue-800 font-bold text-sm border border-blue-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">{board.milestones.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
        <button onClick={() => void createMilestone()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 transition">+ Nuevo</button>
        <button disabled={!milestone} onClick={async () => { const name = prompt('Nuevo nombre para el hito', milestone); if (!name?.trim() || name === milestone) return; await run(async () => { await api(`/api/milestones/${encodeURIComponent(milestone)}`, { method: 'PATCH', body: JSON.stringify({ name }) }); await refresh(); setMilestone(name); }, 'Hito renombrado.'); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 transition disabled:opacity-40">✏️ Editar</button>
        <button disabled={board.milestones.length <= 1} onClick={() => { if (confirm(`¿Eliminar el hito ${milestone}? Se borrarán sus asignaciones y necesidades.`)) void run(() => api(`/api/milestones/${encodeURIComponent(milestone)}`, { method: 'DELETE' }), 'Hito eliminado.'); }} className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-red-200 transition disabled:opacity-40">🗑️ Eliminar</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setPanel('add')} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2 rounded-lg text-sm shadow transition">＋ Agregar persona</button>
        <button onClick={() => setPanel('roadmap')} className="bg-teal-700 hover:bg-teal-800 text-white font-medium px-3 py-2 rounded-lg text-sm shadow transition flex items-center gap-1.5">🗺️ Roadmap</button>
        <button onClick={() => setPanel('history')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-2 rounded-lg text-sm shadow transition flex items-center gap-1.5">📜 Log de Cambios</button>
        <button onClick={() => setNeedsPanelVisible(value => !value)} className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-3 py-2 rounded-lg text-sm shadow transition">🎯 Panel Vacantes</button>
        <button onClick={() => void downloadLatestBackup()} className="bg-slate-700 hover:bg-slate-800 text-white font-medium px-3 py-2 rounded-lg text-sm shadow transition">↩️ Respaldo</button>
        <button onClick={() => void exportData()} className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium px-3 py-2 rounded-lg text-sm shadow transition">📥 Exportar</button>
        <label className="relative bg-sky-700 hover:bg-sky-800 text-white font-medium px-3 py-2 rounded-lg text-sm shadow transition flex items-center gap-1.5 cursor-pointer">📤 Importar<input className="file-input-overlay" type="file" accept=".json,application/json" onChange={event => { void importData(event.target.files?.[0]); event.target.value = ''; }} /></label>
        <button onClick={() => void refresh().then(() => setNotice('Tablero actualizado.')).catch(problem => setError(problem.message))} className="bg-slate-600 hover:bg-slate-700 text-white font-medium px-3 py-2 rounded-lg text-sm shadow transition">↻ Actualizar</button>
        <div className="flex items-center gap-2 text-xs text-slate-600 px-1">{user.avatarUrl && <img className="w-7 h-7 rounded-full" src={user.avatarUrl} alt="" />}<span>{user.displayName}</span></div>
        <button onClick={() => void api('/auth/logout', { method: 'POST' }).then(() => location.reload())} className="text-slate-500 hover:text-slate-800 text-sm font-semibold px-2">Salir</button>
      </div>
    </header>
    {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-3 flex justify-between" role="alert">{error}<button onClick={() => setError('')}>Cerrar</button></div>}{notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm mb-3 flex justify-between" role="status">{notice}<button onClick={() => setNotice('')}>Cerrar</button></div>}
    {board.people.length === 0 && <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-4 text-center"><h2 className="font-bold text-slate-800">Importá el estado actual del tablero</h2><p className="text-slate-500 text-sm my-2">Usá el JSON exportado desde la app anterior para cargar personas, hitos, rotaciones, necesidades e historial en Neon.</p><label className="relative inline-flex bg-sky-700 hover:bg-sky-800 text-white font-medium px-3 py-2 rounded-lg text-sm shadow transition cursor-pointer">Elegir JSON<input className="file-input-overlay" type="file" accept=".json,application/json" onChange={event => { void importData(event.target.files?.[0]); event.target.value = ''; }} /></label></section>}
    {needsPanelVisible && <section className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm mb-4 transition-all">
      <div className="flex justify-between items-center mb-2"><h2 className="font-bold text-amber-900 text-sm flex items-center gap-2">🎯 Seguimiento de Vacantes y Excesos (<span className="font-semibold">{milestone}</span>)</h2><button onClick={() => setNeedsPanelVisible(false)} className="text-amber-700 text-xs font-bold hover:underline">Ocultar</button></div>
      <div className="flex flex-wrap gap-2 text-xs">{(() => { let records = 0; return teams.map(team => { const result = vacancyBreakdown(team); if (result.totalNeed <= 0 && result.totalExcess <= 0) return null; records++; const pendingText = result.roles.filter(role => role.pending > 0).map(role => `+${role.pending} ${role.role}`).join(', '); const common = 'font-semibold px-3 py-1 rounded-lg flex flex-col gap-0.5 cursor-pointer transition shadow-sm'; if (result.totalPending > 0) return <button key={team} onClick={() => openNeeds(team)} title="Ver el detalle de vacantes y excesos de este equipo" className={`${common} bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 text-left`}><span><strong>{team}:</strong> <b className="bg-amber-600 text-white px-2 rounded-full">+{result.totalPending} pendiente{result.totalPending > 1 ? 's' : ''}</b> {result.totalExcess > 0 && <b className="bg-purple-600 text-white px-2 rounded-full">⚠️ +{result.totalExcess} Exceso</b>}</span><span className="text-[10px] text-amber-800">{pendingText}</span></button>; if (result.totalExcess > 0) return <button key={team} onClick={() => openNeeds(team)} className="bg-purple-100 text-purple-900 border border-purple-300 font-semibold px-3 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-purple-200 transition shadow-sm"><strong>{team}:</strong><b className="bg-purple-600 text-white px-2 rounded-full">⚠️ +{result.totalExcess} Exceso</b></button>; return <button key={team} onClick={() => openNeeds(team)} className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold px-3 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-emerald-200 transition shadow-sm"><strong>{team}:</strong><b className="bg-emerald-600 text-white px-2 rounded-full">✅ Cubiertas ({result.totalCovered}/{result.totalNeed})</b></button>; }).length === 0 ? <span className="text-amber-700 italic">No hay vacantes configuradas ni sobrecapacidades para este hito. Hacé clic en ✏️ Editar en la columna del equipo para definir roles necesarios.</span> : null; })()}</div>
    </section>}
    <section className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <label><span className="block text-xs font-semibold text-slate-500 mb-1">Buscar por Persona</span><input value={filters.text} onChange={event => setFilters({ ...filters, text: event.target.value })} type="text" placeholder="Ej: Carolina..." className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" /></label>
        <label><span className="block text-xs font-semibold text-slate-500 mb-1">Rol</span><select value={filters.role} onChange={event => setFilters({ ...filters, role: event.target.value })} className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Todos los Roles</option>{[...new Set(board.people.map(person => person.role))].sort().map(role => <option key={role}>{role}</option>)}</select></label>
        <label><span className="block text-xs font-semibold text-slate-500 mb-1">Seniority</span><select value={filters.seniority} onChange={event => setFilters({ ...filters, seniority: event.target.value })} className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Todos los Seniorities</option>{[...new Set(board.people.map(person => person.seniority))].sort().map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span className="block text-xs font-semibold text-slate-500 mb-1">Manager</span><select value={filters.manager} onChange={event => setFilters({ ...filters, manager: event.target.value })} className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Todos los Managers</option>{[...new Set(board.people.map(person => person.manager).filter(Boolean))].sort().map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span className="block text-xs font-semibold text-slate-500 mb-1">Estado Rotación</span><select value={filters.state} onChange={event => setFilters({ ...filters, state: event.target.value })} className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Todos</option><option value="frozen">❄️ Congelados</option><option value="warning">⚠️ Warning / Baja Perf.</option><option value="neutral">⚪ Neutrales</option></select></label>
        <label><span className="block text-xs font-semibold text-slate-500 mb-1">Mostrar Equipo</span><select value={filters.team} onChange={event => setFilters({ ...filters, team: event.target.value })} className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Todos los Equipos</option>{teams.map(team => <option key={team}>{team}</option>)}</select></label>
      </div>
    </section>
    <main className="flex-1 overflow-x-auto"><div className="flex gap-4 min-w-max pb-4">{teams.map(team => {
      const people = teamPeople(team);
      const totalTeamCount = board.people.filter(person => teamForMilestone(person, board.assignments, milestone) === team).length;
      const breakdown = vacancyBreakdown(team);
      const badgeParts: string[] = [];
      let badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
      if (breakdown.totalPending > 0) badgeParts.push(`🎯 Vacantes: +${breakdown.totalPending}`);
      else if (breakdown.totalNeed > 0 && breakdown.totalExcess === 0) { badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300'; badgeParts.push(`✅ Cubiertas (${breakdown.totalCovered}/${breakdown.totalNeed})`); }
      if (breakdown.totalExcess > 0) { if (breakdown.totalPending > 0) badgeParts.push(`⚠️ Exceso: +${breakdown.totalExcess}`); else { badgeClass = 'bg-purple-100 text-purple-800 border-purple-300'; badgeParts.push(`⚠️ Exceso: +${breakdown.totalExcess} (${breakdown.totalCovered}/${breakdown.totalNeed} cubiertas)`); } }
      if (!badgeParts.length) badgeParts.push('🎯 Vacantes: +0');
      const rotatedByRole: Record<string, string[]> = {};
      board.people.forEach(person => { if (teamForMilestone(person, board.assignments, milestone) !== team || person.initialTeam === team) return; (rotatedByRole[person.role] ??= []).push(person.id); });
      return <article key={team} data-team={team} className={`bg-slate-200/70 p-4 rounded-xl flex flex-col w-80 shrink-0 h-[calc(100vh-260px)] team-column ${dragging ? 'drag-over' : ''}`} onDragEnter={event => event.preventDefault()} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDragLeave={() => setDragging('')} onDrop={event => { event.preventDefault(); finishDrop(team, event.dataTransfer.getData('text/plain') || draggingRef.current || dragging); }}>
        <div className="mb-3"><div className="flex justify-between items-center mb-1"><div><h2 className="font-bold text-slate-700 text-sm truncate" title={team}>{team}</h2><p className="text-slate-400 text-xs mt-1">{people.length} / {totalTeamCount} personas</p></div><button onClick={() => openNeeds(team)} className="bg-white text-slate-500 hover:text-blue-600 border border-slate-200 rounded-lg w-10 h-10 text-lg" title="Editar necesidades por rol">✏️</button></div><div className="flex justify-between items-center"><button onClick={() => openNeeds(team)} className={`${badgeClass} font-bold border px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1 cursor-pointer hover:opacity-80 transition`} title="Hacé clic para ver el detalle de vacantes y excesos">{badgeParts.join(' | ')}</button><button onClick={() => openNeeds(team)} className="text-slate-400 hover:text-blue-600 font-semibold text-xs ml-1">✏️ Editar</button></div></div>
        <div className="card-list flex-1 space-y-3 overflow-y-auto pr-1">{people.map(person => {
          const assignment = board.assignments.find(item => item.personId === person.id && item.milestone === milestone);
          const rotated = teamForMilestone(person, board.assignments, milestone) !== person.initialTeam;
          const rotationType = assignment?.rotationType ?? 'indefinida';
          const roleStatus = breakdown.roles.find(item => item.role === person.role);
          const moved = rotatedByRole[person.role] ?? [];
          const excess = Boolean(rotated && roleStatus && moved.indexOf(person.id) >= roleStatus.need);
          const cardStyle = person.frozen ? 'is-frozen frozen cursor-not-allowed' : rotated ? rotationType === 'acotada' ? 'bg-yellow-50 border-yellow-300 text-slate-800 cursor-grab' : 'bg-indigo-100 border-indigo-300 text-slate-800 cursor-grab' : 'bg-white border-slate-200 cursor-grab';
          return <article key={person.id} data-testid="person-card" className={`${cardStyle} border p-3 rounded-lg shadow-sm active:cursor-grabbing hover:shadow-md transition text-sm relative group person-card`} draggable={!person.frozen} onDragStart={event => { draggingRef.current = person.id; event.dataTransfer.setData('text/plain', person.id); event.dataTransfer.setData('application/x-rebalance-person', person.id); event.dataTransfer.effectAllowed = 'move'; setDragging(person.id); }} onDragEnd={() => { window.setTimeout(() => { draggingRef.current = ''; setDragging(''); }, 0); }}>
            <div className="flex justify-between items-start mb-1.5"><button onClick={() => { setActivePerson(person); setPanel('timeline'); }} className="font-bold leading-snug pr-16 hover:text-blue-600 cursor-pointer transition text-left" title="Hacé clic para editar asignación acotada por hito">{person.name}</button><div className="flex gap-1.5 absolute top-3 right-3"><button onClick={() => void patchPerson(person, 'warning', !person.warning)} className={`${person.warning ? 'text-amber-500 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'} hover:text-amber-600 font-bold text-xs transition-opacity`} title="Warning">⚠️</button><button onClick={() => void patchPerson(person, 'frozen', !person.frozen)} className={`${person.frozen ? 'text-sky-500 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'} hover:text-sky-600 font-bold text-xs transition-opacity`} title={person.frozen ? 'Descongelar' : 'Congelar'}>{person.frozen ? '❄️' : '🧊'}</button><button onClick={() => { if (confirm(`¿Eliminar a ${person.name}?`)) void run(() => api(`/api/people/${encodeURIComponent(person.id)}`, { method: 'DELETE' }), 'Persona eliminada.'); }} className="text-slate-400 hover:text-red-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar">✕</button></div></div>
            <div className="flex flex-wrap gap-1 text-[11px] mb-1"><span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{person.role}</span><span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{person.seniority}</span><span className={`${person.modality === 'Interno' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} px-1.5 py-0.5 rounded font-medium`}>{person.modality}</span>{person.warning && <span className="bg-red-100 text-red-800 border border-red-200 font-bold px-1.5 py-0.5 rounded warning-badge">⚠️ Warning</span>}{person.frozen && <span className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">❄️ Congelado</span>}{rotated && !person.frozen && <span className={`${rotationType === 'acotada' ? 'bg-yellow-200/80 text-yellow-900' : 'bg-indigo-200 text-indigo-900'} px-1.5 py-0.5 rounded font-semibold text-[10px]`}>{rotationType === 'acotada' ? '⏱️ Acotado' : '♾️ Indefinido'}</span>}{rotated && <span className="bg-slate-200/80 text-slate-700 font-medium px-1.5 py-0.5 rounded text-[10px]">⬅️ {person.initialTeam}</span>}{excess && <span className="bg-purple-600 text-white font-bold px-1.5 py-0.5 rounded text-[10px] shadow-sm">⚠️ Exceso</span>}</div>
          </article>;
        })}{people.length === 0 && <div className="text-xs text-slate-400 text-center py-6 italic">Sin miembros</div>}</div>
      </article>;
    })}</div></main>
    {panel && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setPanel(null); }}><section className={`bg-white rounded-2xl shadow-2xl w-full ${panel === 'roadmap' || panel === 'history' ? 'max-w-6xl h-[85vh]' : 'max-w-xl max-h-[85vh]'} flex flex-col border border-slate-200 overflow-hidden`} role="dialog" aria-modal="true">
      <header className="bg-slate-900 text-white p-4 px-6 flex justify-between items-center border-b border-slate-800 shrink-0"><div><span className="bg-blue-600 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">Rebalance v3.5</span><h2 className="font-bold text-lg leading-tight mt-1">{panel === 'needs' ? `Necesidades · ${activeTeam}` : panel === 'roadmap' ? 'Roadmap' : panel === 'history' ? 'Log de Cambios' : panel === 'timeline' ? activePerson?.name : 'Agregar persona'}</h2></div><button className="text-slate-300 hover:text-white font-bold text-xl" onClick={() => setPanel(null)}>✕</button></header>
      {panel === 'needs' && <div className="p-6 overflow-y-auto"><p className="text-slate-500 text-sm mb-3">Definí cuántas personas necesitás por rol para {milestone}.</p>{[...new Set([...board.people.map(person => person.role), ...Object.keys(needDraft)])].sort().map(role => <label className="grid grid-cols-[1fr_100px] gap-3 items-center py-2 border-b border-slate-100 text-sm text-slate-700 need-row" key={role}><span>{role}</span><input type="number" min="0" value={needDraft[role] ?? '0'} onChange={event => setNeedDraft({ ...needDraft, [role]: event.target.value })} className="border border-slate-300 rounded-lg p-2" /></label>)}<button className="text-blue-600 text-xs font-bold mt-3" onClick={() => { const role = prompt('Nombre del nuevo rol'); if (role?.trim()) setNeedDraft({ ...needDraft, [role.trim()]: '0' }); }}>＋ Agregar rol</button><footer className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-200"><button className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg" onClick={() => setPanel(null)}>Cancelar</button><button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow" onClick={() => void saveNeeds()}>Guardar necesidades</button></footer></div>}
      {panel === 'add' && <form className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={addPerson}>{[['name','Nombre'],['role','Rol'],['seniority','Seniority'],['modality','Modalidad'],['manager','Manager'],['initialTeam','Equipo inicial']].map(([name,label]) => <label key={name} className="text-xs font-semibold text-slate-600 flex flex-col gap-1">{label}<input name={name} required={name !== 'manager'} defaultValue={name === 'modality' ? 'Interno' : ''} className="border border-slate-300 rounded-lg p-2 text-sm" /></label>)}<footer className="col-span-full flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200"><button type="button" className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg" onClick={() => setPanel(null)}>Cancelar</button><button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg">Agregar</button></footer></form>}
      {panel === 'roadmap' && <><div className="bg-slate-100 p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center shrink-0"><select value={roadmapTeam} onChange={event => setRoadmapTeam(event.target.value)} className="text-xs border border-slate-300 rounded-lg p-2 bg-white font-semibold outline-none"><option value="">Todos los equipos</option>{teams.map(team => <option key={team}>{team}</option>)}</select><select value={roadmapStatus} onChange={event => setRoadmapStatus(event.target.value)} className="text-xs border border-slate-300 rounded-lg p-2 bg-white font-semibold outline-none"><option value="">Todos los estados</option><option value="warning">Warning</option><option value="frozen">Congelados</option><option value="rotated">Rotados</option></select></div><div className="overflow-auto p-4"><table className="w-full border-collapse text-xs"><thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase"><tr><th className="p-2 text-left">Equipo</th>{board.milestones.map(item => <th className="p-2 text-left" key={item.name}>{item.name}</th>)}</tr></thead><tbody>{teams.filter(team => !roadmapTeam || team === roadmapTeam).map(team => <tr key={team}><th className="p-2 text-left bg-slate-50">{team}</th>{board.milestones.map(item => <td className="p-2 border-b border-slate-100 align-top" key={item.name}>{board.people.filter(person => { const assignedTeam = teamForMilestone(person, board.assignments, item.name); if (assignedTeam !== team) return false; if (roadmapStatus === 'warning' && !person.warning) return false; if (roadmapStatus === 'frozen' && !person.frozen) return false; if (roadmapStatus === 'rotated' && assignedTeam === person.initialTeam) return false; return true; }).map(person => <div className="bg-slate-100 rounded px-2 py-1 mb-1 text-slate-700" key={person.id}>{person.name}{person.warning && ' ⚠'}{person.frozen && ' ❄'}</div>)}</td>)}</tr>)}</tbody></table></div></>}
      {panel === 'history' && <div className="p-6 overflow-y-auto">{board.activity.map(item => <article className="flex gap-3 border-b border-slate-100 py-3" key={item.id}><span className="w-2 h-2 rounded-full bg-indigo-600 mt-2" /><div><strong className="text-sm text-slate-800">{item.actorName}</strong><p className="text-xs text-slate-600 mt-1">{item.action.replaceAll('_', ' ')} · {JSON.stringify(item.details)}</p><time className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</time></div></article>)}{board.activity.length === 0 && <p className="text-slate-500 text-sm">Todavía no hay cambios registrados.</p>}<div className="flex justify-end gap-2 mt-4"><button className="bg-emerald-700 text-white rounded-lg px-3 py-2 text-xs font-semibold" onClick={exportCsv}>Descargar CSV</button><button className="text-red-600 text-xs font-semibold" onClick={() => { if (confirm('¿Limpiar el historial compartido?')) void run(() => api('/api/activity', { method: 'DELETE' }), 'Historial limpiado.'); }}>Limpiar historial</button></div></div>}
      {panel === 'timeline' && activePerson && <div className="p-6 overflow-y-auto">{board.milestones.map(item => { const assignment = board.assignments.find(a => a.personId === activePerson.id && a.milestone === item.name); return <div className="grid grid-cols-[1fr_1fr_125px] gap-3 items-center py-3 border-b border-slate-100" key={item.name}><strong className="text-sm text-slate-700">{item.name}</strong><select defaultValue={assignment?.teamName ?? activePerson.initialTeam} data-milestone={item.name} className="border border-slate-300 rounded-lg p-2 text-sm timeline-team">{teams.map(team => <option key={team}>{team}</option>)}</select><select defaultValue={assignment?.rotationType ?? 'indefinida'} data-type={item.name} className="border border-slate-300 rounded-lg p-2 text-sm timeline-type"><option value="indefinida">Indefinida</option><option value="acotada">Acotada</option></select></div>; })}<footer className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-200"><button className="px-4 py-2 bg-slate-100 rounded-lg text-sm" onClick={() => setPanel(null)}>Cancelar</button><button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm" onClick={async () => { const teamsToSave = [...document.querySelectorAll<HTMLSelectElement>('.timeline-team')]; const typesToSave = [...document.querySelectorAll<HTMLSelectElement>('.timeline-type')]; await run(async () => { let expectedVersion = activePerson.version; for (let i=0;i<teamsToSave.length;i++) { const result = await api<{ version: number }>(`/api/assignments/${encodeURIComponent(activePerson.id)}/${encodeURIComponent(teamsToSave[i].dataset.milestone!)}`, { method: 'PUT', body: JSON.stringify({ teamName: teamsToSave[i].value, rotationType: typesToSave[i].value, expectedVersion }) }); expectedVersion = result.version; } }, 'Timeline actualizado.'); setPanel(null); }}>Guardar</button></footer></div>}
    </section></div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
