import { defaultEngineers, defaultMilestones } from './data/initialData.js';
import { getAllTeams, getVacancyBreakdownByRole } from './engine/capacityEngine.js';

console.log('🚀 Rebalance Tool iniciada correctamente');
console.log('Equipos detectados:', getAllTeams(defaultEngineers));
console.log('Ingenieros cargados:', defaultEngineers.length);
