# Unidad 2 — Diseño e implementación de APIs

API REST CRUD, modular y documentada, construida con **TypeScript + Express** y
persistencia en **SQLite gestionada por Prisma ORM**. Sigue la arquitectura por
capas: `Router → Controller → Service → Repository → Prisma`.

La documentación de los endpoints se diseña como **contrato OpenAPI 3.1** y se
sirve de forma **interactiva con Swagger UI** en `/api/v1/docs`.

## Contenido del ejercicio (punto 7 de la guía)

1. **Reestructurar la app de backend** con el formato por capas del punto 7.
2. **Crear 2 entidades nuevas**: `Proyecto` y `Tarea` (relación 1 → N).
3. **Generar el CRUD completo**, incluida una **búsqueda por Id** para cada entidad.
4. **Usar motor de base de datos SQLite** (vía Prisma ORM).
5. **Generar las pruebas de test con datos mock**.
6. **Diseñar el contrato OpenAPI y documentar los endpoints interactivamente** (Swagger UI).

## Requisitos

- Node.js 22.18 o superior (ejecuta TypeScript directamente, sin compilar).
- Prisma ORM 6.x (el cliente se genera en `postinstall`: `npm install` basta).

## Comandos

```bash
npm install            # instala dependencias y genera el cliente Prisma

npm start              # ejecuta el servidor en http://localhost:3000
npm run dev            # ejecuta y reinicia ante cada cambio

npm run check          # verifica los tipos sin ejecutar
npm test               # pruebas unitarias + de integración (Vitest)
npm run test:watch     # modo observación (ciclo rojo-verde-refactor)
npm run coverage       # cobertura v8 en consola y en coverage/index.html
npm run verificar      # tipos + pruebas, lo mismo que corre CI

# Prisma
npm run prisma:generate   # regenera el cliente tras editar el schema
npm run prisma:migrate    # crea/aplica una migración (prisma migrate dev)
npm run prisma:push       # sincroniza el esquema sin migración (dev rápido)
```

Documentación interactiva:

- Spec OpenAPI en crudo: `GET /api/v1/docs/openapi.yaml`
- Swagger UI (explorador interactivo): `http://localhost:3000/api/v1/docs`

Variables de entorno (ver `.env.example`):

| Variable       | Valor por defecto   | Descripción                                     |
| -------------- | ------------------- | ----------------------------------------------- |
| `PORT`         | `3000`              | Puerto donde escucha el servidor                |
| `DATABASE_URL` | `file:./dev.db`     | URL SQLite de Prisma (relativa a `prisma/`)     |

> Nota: el path de `DATABASE_URL` lo resuelve Prisma **relativo a
> `prisma/schema.prisma`**, así que el archivo por defecto es
> `prisma/dev.db`. El CLI de Prisma carga `.env` automáticamente; en runtime el
> servidor usa la misma ruta por defecto si no se define la variable.

## Entidades

### `Proyecto`

| Campo          | Tipo    | Descripción                          |
| -------------- | ------- | ------------------------------------ |
| `id`           | number  | Generado por el servidor             |
| `nombre`       | string  | Obligatorio, mínimo 3 caracteres     |
| `descripcion`  | string  | Opcional, por defecto `""`           |
| `fechaCreacion`| string  | ISO 8601, generado por el servidor   |

### `Tarea` (pertenece a un proyecto)

| Campo          | Tipo    | Descripción                          |
| -------------- | ------- | ------------------------------------ |
| `id`           | number  | Generado por el servidor             |
| `proyectoId`   | number  | Clave foránea → `Proyecto.id`        |
| `titulo`       | string  | Obligatorio, mínimo 3 caracteres     |
| `prioridad`    | enum    | `baja` \| `media` \| `alta`          |
| `completada`   | boolean | Por defecto `false`                  |
| `fechaCreacion`| string  | ISO 8601, generado por el servidor   |

El esquema vive en `prisma/schema.prisma`; la migración en
`prisma/migrations/`. Eliminar un proyecto borra sus tareas en cascada (FK).

## Endpoints (contrato `/api/v1`)

### `Proyectos`

| Operación | Método | Ruta                            | Éxito        | Errores        |
| --------- | ------ | ------------------------------- | ------------ | -------------- |
| Listar    | GET    | `/api/v1/proyectos`             | `200`        | —              |
| Consultar | GET    | `/api/v1/proyectos/:id`         | `200`        | `400`, `404`   |
| Crear     | POST   | `/api/v1/proyectos`             | `201`        | `400`, `422`   |
| Reemplazar| PUT    | `/api/v1/proyectos/:id`         | `200`        | `400`, `404`, `422` |
| Parcial   | PATCH  | `/api/v1/proyectos/:id`         | `200`        | `400`, `404`, `422` |
| Eliminar  | DELETE | `/api/v1/proyectos/:id`         | `204`        | `400`, `404`   |

### `Tareas`

| Operación | Método | Ruta                            | Éxito        | Errores        |
| --------- | ------ | ------------------------------- | ------------ | -------------- |
| Listar    | GET    | `/api/v1/tareas`                | `200`        | `400` (filtros no numéricos) |
| Consultar | GET    | `/api/v1/tareas/:id`            | `200`        | `400`, `404`   |
| Crear     | POST   | `/api/v1/tareas`                | `201`        | `400`, `404`, `422` |
| Reemplazar| PUT    | `/api/v1/tareas/:id`            | `200`        | `400`, `404`, `422` |
| Parcial   | PATCH  | `/api/v1/tareas/:id`            | `200`        | `400`, `404`, `422` |
| Eliminar  | DELETE | `/api/v1/tareas/:id`            | `204`        | `400`, `404`   |

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

Si `page`, `limit` o `proyectoId` no son numéricos (o `proyectoId` no es un
entero positivo), el listado responde `400` con código `INVALID_QUERY`.
`page`/`limit` preservan la normalización (0 o negativos → página 1, `limit`
mayor de 100 → 100).

### Contratos de respuesta

- Individual: `{ "data": { ... } }`
- Colección paginada: `{ "data": [ ... ], "meta": { "page", "limit", "total", "totalPages" } }`
- Error uniforme: `{ "error": { "code", "message", "details" } }`

El controlador crea con `Location` el recurso generado, por ejemplo
`Location: /api/v1/proyectos/1`.

## Documentación interactiva (OpenAPI + Swagger)

- `GET /api/v1/docs` → **Swagger UI**: explora y prueba cada endpoint desde el
  navegador (los schemas de entrada/salida se cargan desde `openapi.yaml`).
- `GET /api/v1/docs/openapi.yaml` → el contrato OpenAPI 3.1 en crudo.

El contrato es la **única fuente de verdad** del API: define `Proyecto`, `Tarea`,
los DTO de entrada, el esquema `Meta` de paginación y el esquema `Error`
uniforme, junto con todos los códigos de estado posibles por operación.

> Guarda de entorno: con `NODE_ENV=production` la documentación interactiva se
> desactiva (responde 404) para no exponer el mapa completo de la API. En
> desarrollo y en las pruebas permanece activa.

## Arquitectura por capas

```
HTTP → Router → Controller → Service → Repository → Prisma (SQLite)
```

```
unidad-2/
├── prisma/
│   ├── schema.prisma                esquema: modelos Proyecto y Tarea + FK en cascada
│   └── migrations/                  migraciones SQL generadas por Prisma
├── src/
│   ├── app.ts                       arma la aplicación: monta routers y middlewares
│   ├── server.ts                    punto de entrada: sólo escucha
│   ├── db/
│   │   ├── database.ts              cliente Prisma (factory testeable + singleton)
│   │   └── prisma-errors.ts         detección de violaciones de FK (P2003)
│   ├── docs/
│   │   ├── docs.routes.ts           Swagger UI + spec OpenAPI en crudo
│   │   └── docs.test.ts             pruebas de la documentación interactiva
│   ├── errors/
│   │   └── app-error.ts             error de aplicación (status, code, details)
│   ├── middlewares/
│   │   ├── error-handler.ts         respuesta de error uniforme + 500 genérico
│   │   └── not-found.ts             404 para rutas desconocidas
│   ├── proyectos/                   entidad Proyecto (router/controller/service/repository)
│   │   ├── proyecto.ts              entidad + DTOs de entrada
│   │   ├── proyectos.routes.ts      router
│   │   ├── proyectos.controller.ts  traduce HTTP ↔ servicio (async)
│   │   ├── proyectos.service.ts     reglas de negocio + validación (async)
│   │   ├── proyectos.repository.ts  acceso a datos con Prisma (async)
│   │   ├── proyectos.service.test.ts pruebas unitarias (repositorio mock)
│   │   └── proyectos.api.test.ts    pruebas de integración HTTP (Prisma sobre BD temporal)
│   ├── tareas/                      entidad Tarea (igual estructura que proyectos)
│   │   ├── tarea.ts
│   │   ├── tareas.routes.ts
│   │   ├── tareas.controller.ts
│   │   ├── tareas.service.ts
│   │   ├── tareas.repository.ts
│   │   ├── tareas.service.test.ts
│   │   └── tareas.api.test.ts
│   └── test/
│       ├── app-de-prueba.ts         levanta la app con cliente Prisma sobre BD temporal
│       └── mocks/                   repositorios simulados (datos mock, async)
│           ├── proyectos.repository.mock.ts
│           └── tareas.repository.mock.ts
├── .env.example
├── .gitignore
├── openapi.yaml                     contrato OpenAPI 3.1 (fuente de Swagger UI)
├── package.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

## Pruebas con datos mock

Se prueban **dos niveles**:

1. **Unitarias** (`*.service.test.ts`): el servicio se prueba contra un
   **repositorio simulado en memoria** (`src/test/mocks/`) con datos mock de
   partida e implementa la misma interfaz asíncrona que Prisma. Así se aíslan
   las reglas de negocio de la base de datos.
2. **Integración** (`*.api.test.ts`): el CRUD completo se prueba por HTTP con
   `supertest`, contra una base SQLite real **aislada por suite**: cada
   `levantarApp()` crea un archivo temporal `prisma/prueba-<uuid>.db`, aplica el
   esquema con `prisma db push` y lo borra al cerrar.

### Matriz de pruebas (resumen)

| Área                | Cobertura                                                           |
| ------------------- | ------------------------------------------------------------------- |
| Proyectos (service) | crear, buscar por id, 404/400, reemplazar, eliminar, validaciones     |
| Tareas (service)    | crear con proyecto válido, 404 de proyecto, buscar por id, filtrar, PATCH, eliminar |
| Proyectos (HTTP)    | colección vacía, crear 201 + Location, GET por id, 404/400, PUT, PATCH, DELETE, 422 |
| Tareas (HTTP)       | crear 201, GET por id, 404/422, PATCH, filtros + paginación, DELETE, borrado en cascada |
| Aplicación          | `/salud`, 404 uniforme, documentación Swagger UI y OpenAPI           |

## Decisiones técnicas

- **Inyección de dependencias por constructor.** El router recibe los
  repositorios y construye servicio y controlador; el servicio de tareas recibe
  también el repositorio de proyectos para verificar existencia.
- **SQLite con Prisma ORM.** Consultas tipadas por el cliente generado y borrado
  en cascada vía clave foránea. Cambiar de motor relacional (p.ej. PostgreSQL)
  sólo requiere editar `provider` en `prisma/schema.prisma` y regenerar.
- **Capas asíncronas.** Prisma es asíncrono, así que Repository → Service →
  Controller usan `async/await`; Express 5 propaga los rechazos al
  `errorHandler` central sin `try/catch` manual.
- **Validación en tiempo de ejecución.** TypeScript no reemplaza la validación
  del `request.body`: los validadores lanzan `AppError(422/400)` y el manejador
  central los traduce al contrato de error.
- **Errores centralizados.** `errorHandler` responde `AppError` con su contrato
  y cualquier otra excepción como `500 INTERNAL_ERROR`, sin filtrar trazas.
- **Códigos de estado coherentes** (201 al crear, 204 al eliminar, 404 si no
  existe, 400 si el id es inválido, 422 si la forma es válida pero los datos
  incumplen las reglas).
- **Contrato OpenAPI como fuente de verdad** y Swagger UI para explorar y probar
  los endpoints desde el navegador.

## Comprobación manual

```bash
# Aplicar migraciones y arrancar
npm install
npm run prisma:migrate
npm start

# Documentación interactiva
# Abrir http://localhost:3000/api/v1/docs

# Crear un proyecto
curl -i -X POST http://localhost:3000/api/v1/proyectos \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Proyecto Demo","descripcion":"Prueba"}'

# Crear una tarea dentro del proyecto 1
curl -i -X POST http://localhost:3000/api/v1/tareas \
  -H 'Content-Type: application/json' \
  -d '{"proyectoId":1,"titulo":"Diseñar API","prioridad":"alta"}'

# Buscar por Id
curl -i http://localhost:3000/api/v1/tareas/1
curl -i http://localhost:3000/api/v1/proyectos/1

# Listar con filtros y paginación
curl -i "http://localhost:3000/api/v1/tareas?completada=false&q=api&page=1&limit=10"
```

## Limitaciones conocidas

- El archivo `prisma/dev.db` (base persistente) no se versiona en el repositorio:
  se recrea con `prisma migrate dev` o `prisma db push` al primer arranque.
- No hay autenticación ni autorización (queda para la siguiente unidad según la guía).