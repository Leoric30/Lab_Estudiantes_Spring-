package com.laboratorio.students.repository;

import com.laboratorio.students.model.Student;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentRepository extends JpaRepository<Student, Long> {
}
