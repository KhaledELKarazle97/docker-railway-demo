import Fastify from 'fastify';
import 'dotenv/config'; 

const app = Fastify({ logger: true });

const LINKUP_API_KEY = process.env.LINKUP_API_KEY;
const LINKUP_BASE_URL = 'https://api.linkup.so/v1';

// Helper to call Linkup API
async function linkupPost(body) {
  const res = await fetch(`${LINKUP_BASE_URL}/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINKUP_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.message || 'Linkup API error');
    err.status = res.status;
    throw err;
  }

  return res.json();
}

app.get('/health', async () => {
  return { status: 'ok', version: '1.2.0' };
});

app.get('/', async () => {
  return {
    name: 'JobSearch API',
    description: 'Powered by Linkup. Search for jobs and companies.',
    endpoints: [
      'GET  /health',
      'GET  /api/jobs?query=<role>&location=<location>',
      'GET  /api/company?name=<company>',
      'POST /api/search   body: { query, depth }',
    ],
  };
});

app.post('/api/search', async (request, reply) => {
  const { query, depth = 'standard' } = request.body;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return reply.status(400).send({ error: 'query must be a non-empty string' });
  }
  if (!['standard', 'deep'].includes(depth)) {
    return reply.status(400).send({ error: 'depth must be "standard" or "deep"' });
  }

  try {
    return await linkupPost({ q: query.trim(), depth, outputType: 'searchResults' });
  } catch (err) {
    return reply.status(err.status || 500).send({ error: err.message });
  }
});

app.get('/api/jobs', async (request, reply) => {
  const { query, location = 'Malaysia' } = request.query;

  if (!query || query.trim() === '') {
    return reply.status(400).send({ error: 'query parameter is required' });
  }

  const searchQuery = `${query.trim()} jobs in ${location}`;

  try {
    const data = await linkupPost({ q: searchQuery, depth: 'standard', outputType: 'searchResults' });
    const results = data.results || [];
    return {
      query: searchQuery,
      count: results.length,
      results: results.map(r => ({
        title: r.name,
        url: r.url,
        snippet: r.content?.slice(0, 300),
      })),
    };
  } catch (err) {
    return reply.status(err.status || 500).send({ error: err.message });
  }
});

app.get('/api/company', async (request, reply) => {
  const { name } = request.query;

  if (!name || name.trim() === '') {
    return reply.status(400).send({ error: 'name parameter is required' });
  }

  try {
    const data = await linkupPost({
      q: `${name.trim()} company hiring jobs open roles 2024 2025`,
      depth: 'standard',
      outputType: 'searchResults',
    });
    const results = data.results || [];
    return {
      company: name.trim(),
      count: results.length,
      results: results.map(r => ({
        title: r.name,
        url: r.url,
        snippet: r.content?.slice(0, 300),
      })),
    };
  } catch (err) {
    return reply.status(err.status || 500).send({ error: err.message });
  }
});

const start = async () => {
  try {
    await app.listen({ port: parseInt(process.env.PORT || '3000'), host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  start();
}

export { app };