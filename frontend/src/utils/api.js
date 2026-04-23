import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE || '/api'

export const api = axios.create({
  baseURL,
  timeout: 120_000,
})

export function setAuthToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`
  else delete api.defaults.headers.common.Authorization
}

