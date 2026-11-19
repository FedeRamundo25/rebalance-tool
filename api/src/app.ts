import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { pool, query } from './db.js';
import { configureGoogleAuth, requireAuth } from './auth.js';
import routes from './routes.js';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET es obligatorio en producción.');
const SessionStore = connectPgSimple(session);
const hasGoogleAuth = configureGoogleAuth();

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(session({
  store: new SessionStore({ pool, createTableIfMissing: true }),
  name: 'rebalance.sid',
  secret: process.env.SESSION_SECRET ?? 'local-only-change-this-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/api/health', (_req, res) => res.json({ ok: true, authConfigured: hasGoogleAuth }));

app.get('/auth/google', (req, res, next) => {
  if (!hasGoogleAuth) return res.status(503).send('Google OAuth no está configurado.');
  passport.authenticate('google', { scope: ['openid', 'email', 'profile'] })(req, res, next);
});

app.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', { failureRedirect: '/?login=denied' }, (error: unknown, user: Express.User | false) => {
    if (error) return next(error);
    if (!user) return res.redirect('/?login=denied');
    req.logIn(user, loginError => {
      if (loginError) return next(loginError);
      res.redirect('/');
    });
  })(req, res, next);
});

app.post('/auth/logout', (req, res, next) => {
  req.logout(error => {
    if (error) return next(error);
    req.session.destroy(() => {
      res.clearCookie('rebalance.sid', { httpOnly: true, secure: isProduction, sameSite: 'lax' });
      res.status(204).end();
    });
  });
});

app.get('/api/session', (req, res) => {
  if (!req.isAuthenticated?.()) return res.json({ user: null });
  res.json({ user: req.user });
});

app.use(routes);

app.get('/api/board', requireAuth, async (_req, res, next) => {
  try {
    const [milestones, teams, people, assignments, needs, needSets, log] = await Promise.all([
      query('SELECT name, position FROM milestones ORDER BY position'),
      query('SELECT name FROM teams ORDER BY name'),
      query('SELECT id, name, role, seniority, modality, manager, initial_team AS "initialTeam", frozen, warning, version FROM people ORDER BY name'),
      query('SELECT person_id AS "personId", milestone, team_name AS "teamName", rotation_type AS "rotationType" FROM assignments'),
      query('SELECT rn.milestone, rn.team_name AS "teamName", rn.role, rn.required_count AS "requiredCount", COALESCE(ns.version, 0) AS version FROM role_needs rn LEFT JOIN need_sets ns USING (milestone, team_name) ORDER BY rn.team_name, rn.role'),
      query('SELECT milestone, team_name AS "teamName", version FROM need_sets'),
      query('SELECT id, actor_name AS "actorName", action, details, created_at AS "createdAt" FROM activity_log ORDER BY created_at DESC LIMIT 500'),
    ]);
    res.json({ milestones: milestones.rows, teams: teams.rows, people: people.rows, assignments: assignments.rows, needs: needs.rows, needSets: needSets.rows, activity: log.rows });
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

export default app;
