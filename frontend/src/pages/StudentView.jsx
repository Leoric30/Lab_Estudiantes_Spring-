import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteStudent, formatDate, getStudent } from '../api/students.js'

export default function StudentView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStudent(id).then(setStudent).catch((e) => setError(e.message))
  }, [id])

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar a ${student.name}?`)) return
    try {
      await deleteStudent(id)
      navigate('/students')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <section>
      <div className="title-row">
        <h1>{student ? student.name : 'Student'}</h1>
        <Link to="/students" className="btn">Volver a la lista</Link>
      </div>

      {error && <p className="alert">{error}</p>}
      {!student && !error && <p>Cargando…</p>}

      {student && (
        <div className="card">
          <table className="details">
            <tbody>
              <tr><th>Id</th><td>{student.id}</td></tr>
              <tr><th>Name</th><td>{student.name}</td></tr>
              <tr><th>Email</th><td>{student.email}</td></tr>
              <tr><th>Matrícula</th><td>{student.matricula}</td></tr>
              <tr><th>Created</th><td>{formatDate(student.created)}</td></tr>
              <tr><th>Modified</th><td>{formatDate(student.modified)}</td></tr>
            </tbody>
          </table>
          <div className="button-row">
            <Link to={`/students/${id}/edit`} className="btn btn-primary">Edit Student</Link>
            <button className="btn btn-danger" onClick={handleDelete}>Delete Student</button>
          </div>
        </div>
      )}
    </section>
  )
}
