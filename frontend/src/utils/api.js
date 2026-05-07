import axios from 'axios'

function normalizeApiBase(raw) {
  if (!raw) return '/api'

  // Allow either:
  // - "/api" (dev proxy / same-origin deployments)
  // - "http(s)://host:port" (we will append "/api")
  // - "http(s)://host:port/api" (kept as-is)
  const trimmed = String(raw).trim().replace(/\/+$/, '')
  if (/^https?:\/\//i.test(trimmed) && !/\/api$/i.test(trimmed)) {
    return `${trimmed}/api`
  }
  return trimmed || '/api'
}

const baseURL = normalizeApiBase(import.meta.env.VITE_API_BASE)

export const api = axios.create({
  baseURL,
  timeout: 120_000,
})

export function setAuthToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`
  else delete api.defaults.headers.common.Authorization
}

