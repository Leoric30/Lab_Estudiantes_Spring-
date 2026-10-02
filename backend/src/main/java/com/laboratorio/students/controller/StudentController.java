package com.laboratorio.students.controller;

import com.laboratorio.students.exception.NotFoundException;
import com.laboratorio.students.model.Student;
import com.laboratorio.students.repository.StudentRepository;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentRepository repository;

    public StudentController(StudentRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public Page<Student> index(@PageableDefault(size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        return repository.findAll(pageable);
    }

    @GetMapping("/{id}")
    public Student view(@PathVariable Long id) {
        return find(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Student add(@Valid @RequestBody Student student) {
        student.setId(null);
        return repository.saveAndFlush(student);
    }

    @PutMapping("/{id}")
    public Student edit(@PathVariable Long id, @Valid @RequestBody Student data) {
        Student student = find(id);
        student.setName(data.getName());
        student.setEmail(data.getEmail());
        student.setMatricula(data.getMatricula());
        return repository.saveAndFlush(student);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        repository.delete(find(id));
    }

    private Student find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Estudiante " + id + " no encontrado"));
    }
}
