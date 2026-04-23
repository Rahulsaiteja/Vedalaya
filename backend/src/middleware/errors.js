export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { message: 'Not found' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  console.error('[Global Error]', err);
  const status = typeof err?.status === 'number' ? err.status : 500;
  const message = err?.message || 'Server error';
  res.status(status).json({ error: { message } });
}

