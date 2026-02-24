import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import taskRoutes from './routes/tasks.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check (no auth)
app.get('/', (req, res) => {
  res.json({
    name: 'js-express-api-template',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/register, /api/auth/login',
      users: '/api/users/me (GET, PUT, DELETE)',
      posts: '/api/posts (CRUD)',
      tasks: '/api/tasks (CRUD)',
    },
    auth: 'Use header: Authorization: Bearer <token>',
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/tasks', taskRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
