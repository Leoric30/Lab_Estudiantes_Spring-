import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { deleteStudent, formatDate, listStudents } from '../api/students.js'

const PAGE_SIZE = 10

export default function StudentList() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(0, Number(params.get('page') || 1) - 1)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setError(null)
    listStudents(page, PAGE_SIZE)
      .then(setData)
      .catch((e) => setError(e.message))
  }, [page])

  useEffect(load, [load])

  const goTo = (p) => setParams({ page: String(p + 1) })

  const handleDelete = async (student) => {
    if (!window.confirm(`¿Eliminar a ${student.name}?`)) return
    try {
      await deleteStudent(student.id)
      // Si se borró el último registro de la página, regresar a la anterior
      if (data.content.length === 1 && page > 0) goTo(page - 1)
      else load()
    } catch (e) {
      setError(e.message)
    }
  }

  const totalPages = data?.page.totalPages ?? 0

  return (
    <section>
      <div className="title-row">
        <h1>Students</h1>
        <Link to="/students/new" className="btn btn-primary">New Student</Link>
      </div>

      {error && <p className="alert">Error al cargar: {error}</p>}
      {!data && !error && <p>Cargando…</p>}

      {data && (
        <>
          <table>
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Email</th>
                <th>Matrícula</th>
                <th>Created</th>
                <th>Modified</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.content.length === 0 && (
                <tr><td colSpan="7" className="empty">No hay estudiantes registrados.</td></tr>
              )}
              {data.content.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>{s.matricula}</td>
                  <td>{formatDate(s.created)}</td>
                  <td>{formatDate(s.modified)}</td>
                  <td className="actions">
                    <Link to={`/students/${s.id}`}>View</Link>
                    <Link to={`/students/${s.id}/edit`}>Edit</Link>
                    <button className="link danger" onClick={() => handleDelete(s)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="paginator">
            <button className="btn" disabled={page === 0} onClick={() => goTo(page - 1)}>‹ Anterior</button>
            <span>
              Página {totalPages === 0 ? 0 : page + 1} de {totalPages} · {data.page.totalElements} registro(s)
            </span>
            <button className="btn" disabled={page + 1 >= totalPages} onClick={() => goTo(page + 1)}>Siguiente ›</button>
          </div>
        </>
      )}
    </section>
  )
}
