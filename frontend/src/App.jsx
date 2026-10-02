import { Link, Navigate, Route, Routes } from 'react-router-dom'
import StudentList from './pages/StudentList.jsx'
import StudentForm from './pages/StudentForm.jsx'
import StudentView from './pages/StudentView.jsx'

export default function App() {
  return (
    <>
      <header className="top-bar">
        <Link to="/students" className="brand">Laboratorio · Spring Boot + PostgreSQL + React</Link>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/students" replace />} />
          <Route path="/students" element={<StudentList />} />
          <Route path="/students/new" element={<StudentForm />} />
          <Route path="/students/:id" element={<StudentView />} />
          <Route path="/students/:id/edit" element={<StudentForm />} />
          <Route path="*" element={<p>Página no encontrada.</p>} />
        </Routes>
      </main>
    </>
  )
}
