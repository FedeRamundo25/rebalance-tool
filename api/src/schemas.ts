import { z } from 'zod';

export const personSchema = z.object({
  id: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(120), seniority: z.string().trim().max(80).default('N/A'),
  modality: z.string().trim().max(80).default('Interno'), manager: z.string().trim().max(160).default(''),
  initialTeam: z.string().trim().min(1).max(160), frozen: z.boolean().default(false), warning: z.boolean().default(false),
  teams: z.record(z.string(), z.string().trim().min(1).max(160)).default({}),
  rotationTypes: z.record(z.string(), z.enum(['indefinida', 'acotada'])).default({}),
});

export const importSchema = z.object({
  version: z.string().optional(), exportDate: z.string().optional(),
  milestones: z.array(z.string().trim().min(1).max(120)).min(1).max(60),
  engineers: z.array(personSchema).max(2000),
  teamNeeds: z.record(z.string(), z.record(z.string(), z.record(z.string(), z.number().int().min(0).max(10000)))).default({}),
  changeLog: z.array(z.object({ categoria: z.string().optional(), descripcion: z.string().optional(), usuario: z.string().optional(), fecha: z.string().optional() }).passthrough()).max(20000).default([]),
}).strict();

export function validateImportRelationships(data: z.infer<typeof importSchema>) {
  if (new Set(data.milestones).size !== data.milestones.length || new Set(data.engineers.map(person => person.id)).size !== data.engineers.length) return false;
  const milestones = new Set(data.milestones);
  return !data.engineers.some(person => Object.keys(person.teams).some(name => !milestones.has(name)) || Object.keys(person.rotationTypes).some(name => !milestones.has(name)))
    && !Object.keys(data.teamNeeds).some(name => !milestones.has(name));
}
