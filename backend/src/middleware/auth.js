import jwt from 'jsonwebtoken';
import { env } from '../utils/env.js';

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ error: { message: 'Missing token' } });

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: { message: 'Invalid token' } });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: { message: 'Unauthorized' } });
    if (!roles.includes(role)) return res.status(403).json({ error: { message: 'Forbidden' } });
    return next();
  };
}

