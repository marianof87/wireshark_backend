# Ej Backend API

Ejercicio de la **Unidad 2 — Diseño e implementación de APIs**: reestructurar una
aplicación de backend bajo la **arquitectura por capas** del punto 7 de la guía,
crear **dos entidades nuevas**, generar su **CRUD completo** con **búsqueda por Id**,
usar **SQLite** como motor de base de datos y escribir **pruebas con datos mock**.

---

## 1. Objetivo del ejercicio

1. Reestructurar la app de backend con el **formato por capas del punto 7**.
2. Crear **2 entidades nuevas**: `Proyecto` y `Tarea` (relación 1 → N).
3. Generar el **CRUD completo**, incluida una **búsqueda por Id** para cada entidad.
4. Usar **motor de base de datos SQLite**.
5. Generar las **pruebas de test con datos mock**.

---

## 2. Arquitectura por capas (punto 7)

Flujo de una petición:

```
HTTP → Router → Controller → Service → Repository → SQLite
```

```
unidad-2/
├── src/
│   ├── app.ts                        arma la aplicación: monta routers y middlewares
│   ├── server.ts                     punto de entrada: sólo escucha
│   ├── db/
│   │   ├── database.ts               conexión SQLite compartida (archivo o :memory:)
│   │   └── migraciones.ts            esquema: tablas proyectos y tareas + FK en cascada
│   ├── errors/
│   │   └── app-error.ts              error de aplicación (status, code, details)
│   ├── middlewares/
│   │   ├── error-handler.ts          respuesta de error uniforme + 500 genérico
│   │   └── not-found.ts              404 para rutas desconocidas
│   ├── proyectos/                    entidad Proyecto (router/controller/service/repository)
│   │   ├── proyecto.ts               entidad + DTOs de entrada
│   │   ├── proyectos.routes.ts       router
│   │   ├── proyectos.controller.ts   traduce HTTP ↔ servicio
│   │   ├── proyectos.service.ts      reglas de negocio + validación
│   │   ├── proyectos.repository.ts   SQL de acceso a SQLite
│   │   ├── proyectos.service.test.ts pruebas unitarias (repositorio mock)
│   │   └── proyectos.api.test.ts     pruebas de integración HTTP (SQLite en memoria)
│   ├── tareas/                       entidad Tarea (igual estructura que proyectos)
│   │   ├── tarea.ts
│   │   ├── tareas.routes.ts
│   │   ├── tareas.controller.ts
│   │   ├── tareas.service.ts
│   │   ├── tareas.repository.ts
│   │   ├── tareas.service.test.ts
│   │   └── tareas.api.test.ts
│   └── test/
│       ├── app-de-prueba.ts          levanta la app con SQLite :memory:
│       └── mocks/                    repositorios simulados (datos mock)
│           ├── proyectos.repository.mock.ts
│           └── tareas.repository.mock.ts
├── .env.example
├── .gitignore
├── openapi.yaml
├── package.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

---

## 3. Entidades nuevas

### `Proyecto`

| Campo           | Tipo    | Descripción                          |
| --------------- | ------- | ------------------------------------ |
| `id`            | number  | Generado por el servidor             |
| `nombre`        | string  | Obligatorio, mínimo 3 caracteres     |
| `descripcion`   | string  | Opcional, por defecto `""`           |
| `fechaCreacion` | string  | ISO 8601, generado por el servidor   |

### `Tarea` (pertenece a un proyecto)

| Campo           | Tipo    | Descripción                          |
| --------------- | ------- | ------------------------------------ |
| `id`            | number  | Generado por el servidor             |
| `proyectoId`    | number  | Clave foránea → `proyectos.id`       |
| `titulo`        | string  | Obligatorio, mínimo 3 caracteres     |
| `prioridad`     | enum    | `baja` \| `media` \| `alta`          |
| `completada`    | boolean | Por defecto `false`                  |
| `fechaCreacion` | string  | ISO 8601, generado por el servidor   |

---

## 4. Endpoints (contrato `/api/v1`)

### `Proyectos`

| Operación | Método | Ruta                    | Éxito  | Errores          |
| --------- | ------ | ----------------------- | ------ | ---------------- |
| Listar    | GET    | `/api/v1/proyectos`     | `200`  | —                |
| Consultar | GET    | `/api/v1/proyectos/:id` | `200`  | `400`, `404`     |
| Crear     | POST   | `/api/v1/proyectos`     | `201`  | `400`, `422`     |
| Reemplazar| PUT    | `/api/v1/proyectos/:id` | `200`  | `400`, `404`, `422` |
| Parcial   | PATCH  | `/api/v1/proyectos/:id` | `200`  | `400`, `404`, `422` |
| Eliminar  | DELETE | `/api/v1/proyectos/:id` | `204`  | `400`, `404`     |

### `Tareas`

| Operación | Método | Ruta                    | Éxito  | Errores          |
| --------- | ------ | ----------------------- | ------ | ---------------- |
| Listar    | GET    | `/api/v1/tareas`        | `200`  | —                |
| Consultar | GET    | `/api/v1/tareas/:id`    | `200`  | `400`, `404`     |
| Crear     | POST   | `/api/v1/tareas`        | `201`  | `400`, `404`, `422` |
| Reemplazar| PUT    | `/api/v1/tareas/:id`    | `200`  | `400`, `404`, `422` |
| Parcial   | PATCH  | `/api/v1/tareas/:id`    | `200`  | `400`, `404`, `422` |
| Eliminar  | DELETE | `/api/v1/tareas/:id`    | `204`  | `400`, `404`     |

`GET /api/v1/tareas` acepta filtros, búsqueda y paginación:

```
GET /api/v1/tareas?page=1&limit=10&q=backend&completada=false&proyectoId=1
```

| Parámetro    | Función                                                     |
| ------------ | ----------------------------------------------------------- |
| `page`       | Página solicitada (por defecto `1`)                         |
| `limit`      | Elementos por página (1..100, por defecto `50`)             |
| `q`          | Búsqueda textual sobre el título                            |
| `completada` | Filtro por estado (`true`/`false`)                          |
| `proyectoId` | Filtro por proyecto                                         |

### Contratos de respuesta

- Individual: `{ "data": { ... } }`
- Colección paginada: `{ "data": [ ... ], "meta": { "page", "limit", "total", "totalPages" } }`
- Error uniforme: `{ "error": { "code", "message", "details" } }`

Al crear, el controlador responde `201` con `Location: /api/v1/<recurso>/<id>`.

---

## 5. Comandos

```bash
npm install

npm start            # ejecuta el servidor en http://localhost:3000 (SQLite en ./data/backend.db)
npm run dev          # ejecuta y reinicia ante cada cambio

npm run check        # verifica los tipos sin ejecutar
npm test             # pruebas unitarias + de integración (Vitest)
npm run test:watch   # modo observación (ciclo rojo-verde-refactor)
npm run coverage     # cobertura v8
npm run verificar    # tipos + pruebas, lo mismo que corre CI
```

Variables de entorno (ver `.env.example`):

| Variable  | Valor por defecto   | Descripción                          |
| --------- | ------------------- | ------------------------------------ |
| `PORT`    | `3000`              | Puerto donde escucha el servidor     |
| `DB_PATH` | `./data/backend.db` | Ruta del archivo de base de datos    |

---

## 6. Pruebas con datos mock

Se prueban **dos niveles**:

1. **Unitarias** (`*.service.test.ts`): el servicio se prueba contra un
   **repositorio simulado en memoria** (`src/test/mocks/`) con datos mock de
   partida, aislando las reglas de negocio del SQLite.
2. **Integración** (`*.api.test.ts`): el CRUD completo se prueba por HTTP con
   `supertest`, sobre una base SQLite real pero en `:memory:`
   (`src/test/app-de-prueba.ts`), verificando ruta, método, cuerpo y código de
   estado de extremo a extremo.

### Matriz de pruebas (resumen)

| Área                | Cobertura                                                        |
| ------------------- | ---------------------------------------------------------------- |
| Proyectos (service) | crear, buscar por id, 404/400, reemplazar, eliminar, validaciones |
| Tareas (service)    | crear con proyecto válido, 404 de proyecto, buscar por id, filtrar, PATCH, eliminar |
| Proyectos (HTTP)    | colección vacía, crear 201 + Location, GET por id, 404/400, PUT, PATCH, DELETE, 422 |
| Tareas (HTTP)       | crear 201, GET por id, 404/422, PATCH, filtros + paginación, DELETE, borrado en cascada |
| App / middlewares   | `/salud`, 404 uniforme, 500 INTERNAL_ERROR (errorHandler)         |

---

## 7. Decisiones técnicas

- **Inyección de dependencias por constructor**: el router recibe los
  repositorios y construye servicio y controlador; el servicio de tareas recibe
  también el de proyectos para verificar existencia.
- **SQLite con `better-sqlite3`**: consultas preparadas (nunca se interpola
  texto del cliente) y borrado en cascada vía clave foránea.
- **Validación en tiempo de ejecución**: los validadores lanzan
  `AppError(422/400)` y el manejador central los traduce al contrato de error.
- **Errores centralizados**: `errorHandler` responde `AppError` con su contrato
  y cualquier otra excepción como `500 INTERNAL_ERROR`, sin filtrar trazas.
- **Códigos de estado coherentes** (201 al crear, 204 al eliminar, 404 si no
  existe, 400 si el id es inválido, 422 si la forma es válida pero los datos
  incumplen las reglas).

---

## 8. Resultado

| Métrica            | Valor                         |
| ------------------ | ----------------------------- |
| Tests              | 48 tests en 6 archivos       |
| Tipos               | `tsc --noEmit` sin errores    |
| Cobertura           | ~88% statements / 96% funciones |
| Smoke test real     | Servidor Express + SQLite OK (salud, CRUD, búsqueda por id, 404) |

La Unidad 1 queda intacta; todo el ejercicio vive en `backend/unidad-2`.
