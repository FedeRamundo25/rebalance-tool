import { describe, it, expect } from 'vitest';

function getVacancyBreakdown(need, added) {
    const covered = Math.min(need, added);
    const pending = Math.max(0, need - added);
    const excess = Math.max(0, added - need);
    return { covered, pending, excess };
}

describe('Capacity Engine Core Tests', () => {
    it('debe calcular vacantes pendientes correctamente', () => {
        const res = getVacancyBreakdown(3, 1);
        expect(res.covered).toBe(1);
        expect(res.pending).toBe(2);
        expect(res.excess).toBe(0);
    });

    it('debe detectar exceso de capacidad', () => {
        const res = getVacancyBreakdown(1, 3);
        expect(res.covered).toBe(1);
        expect(res.pending).toBe(0);
        expect(res.excess).toBe(2);
    });
});
