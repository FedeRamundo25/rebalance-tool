import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'node', include: ['Web/tests/**/*.test.ts'] } });
