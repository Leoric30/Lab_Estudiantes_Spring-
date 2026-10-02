const BASE = '/api/students'

// Error con el cuerpo JSON del backend (message y, si aplica, errors por campo)
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Error HTTP ${status}`)
    this.status = status
    this.errors = body?.errors || {}
  }
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (res.status === 204) return null
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body)
  return body
}

export const listStudents = (page = 0, size = 10) =>
  request(`${BASE}?page=${page}&size=${size}&sort=id,desc`)

export const getStudent = (id) => request(`${BASE}/${id}`)

export const createStudent = (data) =>
  request(BASE, { method: 'POST', body: JSON.stringify(data) })

export const updateStudent = (id, data) =>
  request(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteStudent = (id) => request(`${BASE}/${id}`, { method: 'DELETE' })

export const formatDate = (value) =>
  value ? new Date(value).toLocaleString('es-MX') : ''
