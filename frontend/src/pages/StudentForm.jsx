import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createStudent, getStudent, updateStudent } from '../api/students.js'

const EMPTY = { name: '', email: '', matricula: '' }

export default function StudentForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    getStudent(id)
      .then((s) => setForm({ name: s.name, email: s.email, matricula: s.matricula }))
      .catch((e) => setMessage(e.message))
  }, [id, isEdit])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setMessage(null)
    try {
      const saved = isEdit ? await updateStudent(id, form) : await createStudent(form)
      navigate(`/students/${saved.id}`)
    } catch (err) {
      setErrors(err.errors || {})
      setMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  const field = (name, label, type = 'text') => (
    <div className={`field ${errors[name] ? 'has-error' : ''}`}>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} value={form[name]} onChange={handleChange} required />
      {errors[name] && <small>{errors[name]}</small>}
    </div>
  )

  return (
    <section>
      <div className="title-row">
        <h1>{isEdit ? 'Edit Student' : 'New Student'}</h1>
        <Link to="/students" className="btn">Volver a la lista</Link>
      </div>

      {message && <p className="alert">{message}</p>}

      <form onSubmit={handleSubmit} className="card">
        {field('name', 'Name')}
        {field('email', 'Email', 'email')}
        {field('matricula', 'Matrícula')}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Submit'}
        </button>
      </form>
    </section>
  )
}
