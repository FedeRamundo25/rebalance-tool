import app from './app.js';
import { pool } from './db.js';

const port = Number(process.env.PORT ?? 8788);
const server = app.listen(port, '0.0.0.0', () => console.log(`Rebalance API escuchando en ${port}`));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => { void pool.end().finally(() => process.exit(0)); }));
}
