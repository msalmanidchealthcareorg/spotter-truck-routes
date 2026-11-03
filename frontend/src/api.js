/** Production API (Render). Dev uses Vite proxy when base is empty. */
export const API_BASE =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.PROD ? 'https://spotter-truck-routes.onrender.com' : '')

export function apiPath(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (!API_BASE) return p
  return `${API_BASE.replace(/\/$/, '')}${p}`
}

export const ROUTE_URL = apiPath('/api/route/')
