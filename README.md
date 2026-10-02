# Práctica Multi-Contenedor: Spring Boot + PostgreSQL + React con Docker y VS Code

Adaptación del laboratorio *"Despliegue Multi-Contenedor: CakePHP 5 y MariaDB con Docker y VS Code"*, con otra pila tecnológica:

| Capa | Laboratorio original | Esta práctica |
|---|---|---|
| Backend | PHP 8.3 + Apache + CakePHP 5 | **Java 21 + Spring Boot 3** (API REST) |
| Base de datos | MariaDB 11.4 | **PostgreSQL 16** |
| Frontend | Plantillas generadas por *Bake* | **React 18 + Vite** (servido por Nginx) |
| Migraciones | Phinx (`bin/cake migrations migrate`) | **Flyway** (automáticas al arrancar) |
| CRUD | `bin/cake bake all students` | Entidad JPA + Repositorio + Controlador REST + vistas React |

La funcionalidad es la misma: un **CRUD de estudiantes** (nombre, correo, matrícula, fechas de creación y modificación) con paginación, alta, edición, detalle y eliminación. Los datos se guardan en un volumen de Docker, así que no se pierden al apagar los contenedores.

---

## 1. Arquitectura del sistema

Se aplica el mismo principio que en la guía original: **un proceso principal por contenedor**. Docker Compose levanta tres servicios y los conecta a una red privada tipo *bridge* llamada `red-laboratorio`, que incluye un DNS interno.

```
                    Máquina anfitriona (host)
   ┌──────────────────────────────────────────────────────────────┐
   │  Navegador ──► http://localhost:3000                         │
   │                                                              │
   │  ┌─────────────── red-laboratorio (bridge) ───────────────┐  │
   │  │                                                        │  │
   │  │  ┌──────────────┐   /api/*   ┌──────────────┐  JDBC    ┌──────────────┐
   │  │  │  frontend    │ ─────────► │  backend     │ ───────► │  db          │
   │  │  │  Nginx+React │  http://   │  Spring Boot │  db:5432 │  PostgreSQL  │
   │  │  │  :80         │ backend:   │  :8080       │          │  :5432       │
   │  │  └──────────────┘   8080     └──────────────┘          └──────┬───────┘
   │  │        ▲ 3000:80                  ▲ 8080:8080                 │ 5432:5432
   │  └────────┼───────────────────────────┼───────────────────────────┼──────┘
   │           │                           │                    volumen db_data
   └───────────┴───────────────────────────┴──────────────────────────────────┘
```

### ¿Cómo viaja una petición?

1. El usuario abre `http://localhost:3000`. El puerto 3000 del host está mapeado al puerto 80 del contenedor **frontend**, donde Nginx entrega la aplicación React ya compilada (HTML, JS y CSS estáticos).
2. React se ejecuta en el navegador y hace peticiones a rutas relativas como `/api/students?page=0&size=10`.
3. Esas peticiones regresan a Nginx, que las reenvía (*reverse proxy*) a `http://backend:8080`. El nombre `backend` lo resuelve el **DNS interno de Docker** (127.0.0.11) a la IP del contenedor de Spring Boot. Como todo pasa por el mismo origen, no hay que configurar CORS.
4. Spring Boot recibe la petición en el `StudentController`, aplica las validaciones y usa `StudentRepository` (Spring Data JPA / Hibernate) para consultar PostgreSQL.
5. La conexión JDBC apunta a `jdbc:postgresql://db:5432/spring_db`. **El host es `db`, no `localhost`**; es el mismo punto clave de evaluación que en la guía original.
6. PostgreSQL guarda los datos en el volumen administrado `db_data`, que persiste aunque se ejecute `docker compose down`.

### Mecanismo de red (igual que en la guía original)

- **Red automática:** Compose crea la red `practica-springboot-react_red-laboratorio`.
- **IPs dinámicas:** cada contenedor recibe una IP interna (p. ej. `172.21.0.2`, `.3`, `.4`).
- **DNS embebido:** los contenedores se encuentran entre sí por el nombre del servicio (`db`, `backend`, `frontend`).
- **Puertos:** solo hace falta exponer el puerto 3000. Los puertos 8080 y 5432 también se publican, pero únicamente para inspeccionar desde el host (Postman, DBeaver, la extensión de PostgreSQL para VS Code).

---

## 2. Estructura del proyecto

```
practica-springboot-react/
├── docker-compose.yml          # Orquestador: 3 servicios, red, volumen
├── .env                        # Credenciales de la BD (no se sube a git)
├── .env.example                # Plantilla del .env para compañeros
├── .gitignore
├── README.md
│
├── backend/                    # API REST con Spring Boot
│   ├── Dockerfile              # Build multi-etapa: Maven → JRE 21
│   ├── pom.xml                 # Dependencias: web, data-jpa, validation, postgresql, flyway, actuator
│   ├── mvnw / mvnw.cmd         # Maven Wrapper (no requiere instalar Maven)
│   └── src/main/
│       ├── java/com/laboratorio/students/
│       │   ├── StudentsApplication.java        # Punto de entrada (@SpringBootApplication)
│       │   ├── model/Student.java              # Entidad JPA (≈ Entity de CakePHP)
│       │   ├── repository/StudentRepository.java  # Acceso a datos (≈ Table de CakePHP)
│       │   ├── controller/StudentController.java  # Endpoints REST (≈ Controller de CakePHP)
│       │   └── exception/
│       │       ├── NotFoundException.java
│       │       └── GlobalExceptionHandler.java  # Errores 400/404/409 en JSON
│       └── resources/
│           ├── application.yml                 # Configuración de la conexión (≈ app_local.php)
│           └── db/migration/
│               └── V1__create_students.sql     # Migración Flyway (≈ Migrations/ de Phinx)
│
└── frontend/                   # Interfaz con React + Vite
    ├── Dockerfile              # Build multi-etapa: Node → Nginx
    ├── nginx.conf              # Sirve el build y hace proxy de /api → backend:8080
    ├── package.json
    ├── vite.config.js          # Proxy /api para modo desarrollo local
    └── src/
        ├── main.jsx
        ├── App.jsx             # Rutas (react-router-dom)
        ├── index.css           # Estilos (con modo oscuro)
        ├── api/students.js     # Cliente HTTP (fetch) hacia /api/students
        └── pages/
            ├── StudentList.jsx    # Tabla paginada + botones Ver / Editar / Eliminar
            ├── StudentForm.jsx    # Formulario "Nuevo estudiante" / "Editar"
            └── StudentView.jsx    # Detalle de un estudiante
```

---

## 3. Componentes en detalle

### 3.1 Base de datos: PostgreSQL 16 (servicio `db`)

- Imagen oficial `postgres:16-alpine`, multi-arquitectura (ARM64 nativo en Mac M-Series y AMD64 en Windows/Linux).
- Las variables `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD` crean la base de datos y el usuario la primera vez que arranca.
- Tiene un *healthcheck* con `pg_isready`, de modo que el backend no arranca hasta que la base acepta conexiones. Esto resuelve el problema de "MariaDB tarda 10-15 s en iniciar" que menciona la guía original.
- Los datos se guardan en el volumen `db_data` → `/var/lib/postgresql/data`.

**Tabla `students`** (creada por Flyway):

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `BIGSERIAL` | PK |
| `name` | `VARCHAR(255)` | NOT NULL |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE |
| `matricula` | `VARCHAR(50)` | NOT NULL, UNIQUE |
| `created` | `TIMESTAMP` | NOT NULL, se llena al insertar |
| `modified` | `TIMESTAMP` | NOT NULL, se actualiza al editar |

```sql
-- backend/src/main/resources/db/migration/V1__create_students.sql
CREATE TABLE students (
    id        BIGSERIAL PRIMARY KEY,
    name      VARCHAR(255) NOT NULL,
    email     VARCHAR(255) NOT NULL UNIQUE,
    matricula VARCHAR(50)  NOT NULL UNIQUE,
    created   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Backend: Spring Boot 3 (servicio `backend`)

- **Java 21** y **Maven**. El `Dockerfile` es multi-etapa: la primera etapa (`maven:3.9-eclipse-temurin-21`) compila el `.jar` y la segunda (`eclipse-temurin:21-jre`) solo lo ejecuta, lo que reduce mucho el tamaño de la imagen.
- **Dependencias principales:**
  - `spring-boot-starter-web`: servidor Tomcat embebido y controladores REST.
  - `spring-boot-starter-data-jpa`: ORM Hibernate y repositorios.
  - `spring-boot-starter-validation`: validación de campos (`@NotBlank`, `@Email`).
  - `org.postgresql:postgresql`: driver JDBC.
  - `flyway-core` + `flyway-database-postgresql`: migraciones versionadas.
  - `spring-boot-starter-actuator`: endpoint `/actuator/health` para verificar la conexión a la BD.
- **Migraciones:** al arrancar, Flyway revisa la tabla `flyway_schema_history` y aplica los scripts `V*.sql` pendientes. No hace falta ejecutar ningún comando a mano, a diferencia de `bin/cake migrations migrate`.
- Hibernate se configura con `ddl-auto: validate`, es decir, **no** modifica el esquema por su cuenta y solo verifica que la entidad coincida con la tabla creada por Flyway.

**Configuración de conexión** (equivalente a `app_local.php`):

```yaml
# backend/src/main/resources/application.yml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:db}:${DB_PORT:5432}/${DB_NAME:spring_db}
    username: ${DB_USER:spring_user}
    password: ${DB_PASSWORD:spring_password}
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true
server:
  port: 8080
management:
  endpoints.web.exposure.include: health
  endpoint.health.show-details: always
```

> ⚠️ **Punto clave de evaluación:** el host es `db`, que es el nombre del servicio en `docker-compose.yml`. Si se pone `localhost`, el backend buscaría PostgreSQL **dentro de su propio contenedor** y la conexión fallaría.

**API REST** (todas las rutas bajo `/api/students`):

| Método | Ruta | Descripción | Respuesta |
|---|---|---|---|
| `GET` | `/api/students?page=0&size=10&sort=id,desc` | Lista paginada | `200` + `{ content: [...], page: { size, number, totalElements, totalPages } }` |
| `GET` | `/api/students/{id}` | Detalle | `200` o `404` |
| `POST` | `/api/students` | Crear | `201` + estudiante creado, `400` si falla la validación o `409` si el correo/matrícula ya existen |
| `PUT` | `/api/students/{id}` | Editar | `200`, `400`, `404` o `409` |
| `DELETE` | `/api/students/{id}` | Eliminar | `204` o `404` |
| `GET` | `/actuator/health` | Estado de la app y de la BD | `{"status":"UP","components":{"db":{"status":"UP"}}}` |

Ejemplo de cuerpo para `POST` / `PUT`:

```json
{ "name": "Ana López", "email": "ana@um.edu.mx", "matricula": "1220001" }
```

`created` y `modified` los llena el backend automáticamente con `@CreationTimestamp` y `@UpdateTimestamp`, igual que hace CakePHP con el *TimestampBehavior*.

### 3.3 Frontend: React + Vite (servicio `frontend`)

- El `Dockerfile` también es multi-etapa: `node:20-alpine` ejecuta `npm ci && npm run build` y `nginx:alpine` sirve la carpeta `dist/`.
- **Rutas de la interfaz** (reproducen las vistas de `bake all`):

| Ruta | Vista | Qué hace |
|---|---|---|
| `/students` | `StudentList` | Tabla con paginación (Anterior / Siguiente), botón **New Student** y acciones *View*, *Edit*, *Delete* (con confirmación) |
| `/students/new` | `StudentForm` | Formulario de alta; muestra los errores de validación que devuelve el backend |
| `/students/:id` | `StudentView` | Detalle con fechas de creación y modificación |
| `/students/:id/edit` | `StudentForm` | Formulario precargado para editar |

- **`nginx.conf`** hace dos cosas:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;

    # Proxy de la API hacia el contenedor de Spring Boot (resolución DNS por nombre de servicio)
    location /api/ {
        proxy_pass http://backend:8080;
    }

    # React Router: cualquier ruta desconocida devuelve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 4. Orquestación: `docker-compose.yml`

```yaml
services:
  # SERVICIO 1: Motor de base de datos PostgreSQL 16
  db:
    image: postgres:16-alpine
    container_name: postgres_db
    restart: always
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"            # Expuesto para DBeaver / VS Code
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - red-laboratorio

  # SERVICIO 2: API REST con Spring Boot
  backend:
    build: ./backend
    container_name: springboot_api
    environment:
      DB_HOST: db              # ← nombre del servicio, NO localhost
      DB_PORT: 5432
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
    ports:
      - "8080:8080"            # Expuesto para probar la API con Postman / curl
    depends_on:
      db:
        condition: service_healthy   # Espera a que PostgreSQL esté listo
    networks:
      - red-laboratorio

  # SERVICIO 3: Interfaz React servida por Nginx
  frontend:
    build: ./frontend
    container_name: react_frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - red-laboratorio

volumes:
  db_data:

networks:
  red-laboratorio:
    driver: bridge
```

Archivo `.env` en la raíz (Compose lo lee automáticamente):

```env
DB_NAME=spring_db
DB_USER=spring_user
DB_PASSWORD=spring_password
```

---

## 5. Requerimientos

### 5.1 Obligatorios (para correr con Docker)

| Herramienta | Versión mínima | Verificación |
|---|---|---|
| **Docker Desktop** (macOS / Windows) o **Docker Engine** (Linux) | 24+ | `docker --version` |
| **Docker Compose v2** (incluido en Docker Desktop) | 2.20+ | `docker compose version` |
| **Visual Studio Code** | reciente | — |
| RAM libre | ~2 GB | La compilación de Maven es la etapa que más memoria usa |
| Puertos libres | 3000, 8080, 5432 | — |

Con Docker basta: **no necesitas instalar Java, Maven, Node ni PostgreSQL en tu máquina**, porque todo se compila y ejecuta dentro de los contenedores.

**Instalación por sistema operativo** (igual que en la guía original):

- **macOS (Apple Silicon):** `brew install --cask docker visual-studio-code` y después abrir Docker Desktop hasta que la ballena quede estática.
- **Windows 10/11:** `wsl --install` en PowerShell como administrador, reiniciar e instalar Docker Desktop marcando *"Use WSL 2 instead of Hyper-V"*.
- **Linux (Fedora):**
  ```bash
  sudo dnf install docker-ce docker-ce-cli containerd.io docker-compose-plugin   # tras agregar el repo de Docker
  sudo systemctl enable --now docker
  sudo usermod -aG docker $USER   # cerrar sesión y volver a entrar
  ```

### 5.2 Opcionales (para desarrollar fuera de Docker)

| Herramienta | Versión | Uso |
|---|---|---|
| JDK (Temurin / OpenJDK) | 21 | `./mvnw spring-boot:run` |
| Node.js + npm | 20 LTS | `npm run dev` con recarga en caliente |

### 5.3 Extensiones recomendadas de VS Code

| Extensión | Identificador | Propósito |
|---|---|---|
| Docker | `ms-azuretools.vscode-docker` | Ver contenedores, redes y volúmenes |
| Dev Containers | `ms-vscode-remote.remote-containers` | Abrir carpetas dentro de un contenedor |
| Extension Pack for Java | `vscjava.vscode-java-pack` | Autocompletado, depuración y Maven (reemplaza a PHP Intelephense) |
| Spring Boot Extension Pack | `vmware.vscode-boot-dev-pack` | Dashboard de Spring y autocompletado de `application.yml` |
| ES7+ React snippets | `dsznajder.es7-react-js-snippets` | Atajos para componentes React |
| PostgreSQL | `ckolkman.vscode-postgres` | Consultar la BD desde VS Code |

---

## 6. Cómo ejecutar el sistema

Abre la carpeta del proyecto en VS Code y usa la terminal integrada (`` Ctrl+` `` / `` Cmd+` ``).

### Paso 0: Crear el archivo `.env`

```bash
cp .env.example .env
```

### Paso 1: Construir y levantar los tres contenedores

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos porque Maven descarga dependencias y npm instala paquetes. Las siguientes veces se usa la caché.

### Paso 2: Verificar el estado

```bash
docker compose ps
```

```
NAME             IMAGE                                 SERVICE    STATUS                 PORTS
postgres_db      postgres:16-alpine                    db         Up (healthy)           0.0.0.0:5432->5432/tcp
springboot_api   practica-springboot-react-backend     backend    Up                     0.0.0.0:8080->8080/tcp
react_frontend   practica-springboot-react-frontend    frontend   Up                     0.0.0.0:3000->80/tcp
```

### Paso 3: Comprobar la conexión a la base de datos

Este paso equivale al *"✓ CakePHP is able to connect to the database"* de la guía original:

```bash
curl http://localhost:8080/actuator/health
# {"status":"UP","components":{"db":{"status":"UP","details":{"database":"PostgreSQL",...}}}}
```

En los logs debe aparecer la migración aplicada:

```bash
docker compose logs backend | grep -i flyway
# Successfully applied 1 migration to schema "public", now at version v1
```

### Paso 4: Usar la aplicación

Abre **http://localhost:3000/students**. Verás la tabla de estudiantes con paginación y podrás registrar uno nuevo con **New Student**, verlo, editarlo y eliminarlo. Cada operación pasa por React → Nginx → Spring Boot → PostgreSQL y queda guardada en el volumen `db_data`.

### (Opcional) Modo desarrollo con recarga en caliente

Deja solo la base de datos en Docker y corre el backend y el frontend en tu máquina:

```bash
docker compose up -d db

# Terminal 1 – backend (usa localhost porque corre FUERA de Docker)
cd backend
DB_HOST=localhost ./mvnw spring-boot:run

# Terminal 2 – frontend (Vite redirige /api a localhost:8080)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

---

## 7. Demostración de la red interna

```bash
# Prueba 1: inspeccionar la red y ver la IP asignada a cada uno de los 3 contenedores
docker network inspect practica-springboot-react_red-laboratorio

# Prueba 2: resolución DNS desde el backend hacia la base de datos
docker compose exec backend getent hosts db

# Prueba 3: conexión TCP (capa 4) del backend al puerto 5432 de PostgreSQL
docker compose exec backend bash -c 'echo > /dev/tcp/db/5432 && echo "PostgreSQL alcanzable en db:5432"'

# Prueba 4: el frontend (Nginx) alcanza al backend por su nombre de servicio
docker compose exec frontend wget -qO- http://backend:8080/actuator/health

# Prueba 5: consultar la tabla directamente con psql
docker compose exec db psql -U spring_user -d spring_db -c "SELECT * FROM students;"
```

---

## 8. Equivalencias con el flujo de CakePHP

| Paso en la guía original | Equivalente en esta práctica |
|---|---|
| `composer create-project cakephp/app` | Proyecto generado con [start.spring.io](https://start.spring.io) + `npm create vite@latest frontend -- --template react` |
| Editar `app_local.php` con `host => 'db'` | `application.yml` / variable `DB_HOST=db` |
| `bin/cake bake migration CreateStudents ...` | Crear `V1__create_students.sql` (para cambios futuros: `V2__...sql`, `V3__...sql`) |
| `bin/cake migrations migrate` | Automático al iniciar el backend (Flyway) |
| `bin/cake bake all students` | `Student.java` + `StudentRepository.java` + `StudentController.java` + páginas React |
| `http://localhost:8765/students` | `http://localhost:3000/students` |
| `mariadb-admin ping -h db` | `/dev/tcp/db/5432` o `pg_isready -h db` |
| `chown www-data tmp logs` (macOS) | No hace falta: no hay *bind mounts* de código en producción |

---

## 9. Comandos esenciales

| Comando | Acción |
|---|---|
| `docker compose up -d --build` | Construye e inicia los 3 contenedores en segundo plano |
| `docker compose stop` | Pausa los contenedores sin borrar nada |
| `docker compose down` | Elimina contenedores y red (**conserva** el volumen de datos) |
| `docker compose down -v` | Elimina también el volumen (⚠️ **borra la base de datos**) |
| `docker compose logs -f backend` | Sigue los logs de Spring Boot en tiempo real |
| `docker compose up -d --build backend` | Reconstruye solo el backend después de cambiar código Java |
| `docker compose exec backend bash` | Abre una terminal dentro del contenedor del backend |
| `docker compose exec db psql -U spring_user -d spring_db` | Abre la consola de PostgreSQL |

---

## 10. Solución de problemas

**`http://localhost:3000` no carga.**
Revisa `docker compose ps`. Si `react_frontend` no está `Up`, consulta `docker compose logs frontend`. Suele tratarse de un error de compilación de React o de sintaxis en `nginx.conf`.

**La tabla muestra "Error al cargar" o Nginx devuelve `502 Bad Gateway`.**
El backend todavía no termina de arrancar (Spring Boot tarda ~10-20 s) o se cayó. Revisa `docker compose logs backend`.

**`Connection to localhost:5432 refused` en los logs del backend.**
`DB_HOST` está apuntando a `localhost`. Dentro de Docker debe ser `db`.

**`password authentication failed for user "spring_user"`.**
Las credenciales del `.env` cambiaron después de crear el volumen, y PostgreSQL solo las aplica la primera vez. Ejecuta `docker compose down -v` y vuelve a levantar (esto borra los datos).

**`Validate failed: Migrations have failed validation` (Flyway).**
Se modificó un script `V*.sql` que ya estaba aplicado. Nunca edites migraciones aplicadas: crea una nueva `V2__...sql`.

**`Schema-validation: missing column` (Hibernate).**
La entidad `Student.java` tiene un campo que no existe en la tabla. Agrega la columna con una migración nueva.

**`port is already allocated`.**
Ya hay un PostgreSQL local, otra app en el 8080 o algo en el 3000. Cambia el puerto del lado del host en `docker-compose.yml` (p. ej. `"5433:5432"`, `"8081:8080"`, `"3001:80"`).

**Linux: `permission denied while trying to connect to the Docker daemon socket`.**
Tu usuario no está en el grupo `docker`. Ejecuta `sudo usermod -aG docker $USER` y vuelve a iniciar sesión.

---

## 11. Rúbrica adaptada

| Criterio | Entregable | Peso |
|---|---|---|
| Orquestación multi-contenedor | `Dockerfile` (backend y frontend) y `docker-compose.yml` funcionando con los 3 servicios | 25% |
| Aislamiento e interconexión | Red `red-laboratorio` verificada; DNS por nombre (`db`, `backend`) demostrado | 20% |
| Configuración de Spring Boot | Conexión a PostgreSQL operativa: `/actuator/health` con `db: UP` | 20% |
| Migración y CRUD | Migración Flyway aplicada y CRUD completo en React con persistencia | 25% |
| Buenas prácticas | Uso de VS Code, `.env` fuera de git, `.gitignore` (`target/`, `node_modules/`, `dist/`, `.env`) | 10% |
