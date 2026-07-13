Actúa como un arquitecto de software senior y desarrollador full stack. Debes diseñar e implementar un MVP funcional de una plataforma web de estimación ágil tipo Planning Poker.

El producto debe permitir que equipos de desarrollo creen una sala, agreguen historias de usuario, inviten participantes mediante un enlace y realicen votaciones privadas con revelación simultánea.

La implementación debe quedar funcional, ejecutable localmente con Docker Compose y organizada como un proyecto mantenible preparado para evolucionar a SaaS.

## 1. Objetivo del MVP

Construir una plataforma de estimación colaborativa en tiempo real que permita:

1. Crear una sala.
2. Entrar a una sala mediante un enlace.
3. Participar sin necesidad de registrarse.
4. Definir un nombre visible.
5. Crear y administrar historias de usuario.
6. Seleccionar una historia activa.
7. Votar usando una baraja Fibonacci.
8. Mantener los votos ocultos hasta que el moderador los revele.
9. Mostrar resultados y estadísticas básicas.
10. Repetir la votación.
11. Guardar una estimación final.
12. Consultar el historial de estimaciones de la sesión.

No implementar todavía pagos, IA, Jira, GitHub, organizaciones empresariales ni autenticación completa. La arquitectura debe permitir agregarlos posteriormente.

---

# 2. Stack tecnológico obligatorio

## Frontend

Utilizar:

* Vue 3.5.
* Nuxt 3 en su versión estable más reciente compatible.
* TypeScript con modo estricto.
* Nuxt UI.
* Composition API.
* Pinia.
* VueUse cuando sea útil.
* Socket.IO Client.
* Zod para validaciones compartidas o validaciones de formularios.
* ESLint.
* Prettier.

No utilizar Options API.

## Backend

Utilizar:

* Node.js LTS.
* NestJS.
* TypeScript con modo estricto.
* Socket.IO mediante WebSocket Gateway.
* Prisma ORM.
* PostgreSQL.
* Redis.
* class-validator.
* class-transformer.
* Swagger/OpenAPI.
* Jest.
* BullMQ solo si existe una necesidad real. No añadirlo innecesariamente al MVP.

## Infraestructura local

Utilizar Docker Compose para levantar:

* frontend;
* backend;
* PostgreSQL;
* Redis.

El frontend y backend deben tener Dockerfiles separados.

Crear un archivo `.env.example` completo.

---

# 3. Estructura general del repositorio

Crear un monorepo con la siguiente estructura aproximada:

```text
planning-platform/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   └── shared/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── .env.example
└── README.md
```

Utilizar `pnpm workspaces`.

El paquete `packages/shared` debe contener:

* enums;
* tipos compartidos;
* esquemas Zod;
* nombres de eventos WebSocket;
* contratos de datos que puedan reutilizar frontend y backend.

Evitar duplicar interfaces entre frontend y backend.

---

# 4. Modelo funcional

## Sala

Una sala debe tener:

* id interno UUID;
* código público corto y difícil de adivinar;
* nombre;
* fecha de creación;
* estado;
* baraja activa;
* participante moderador;
* historia activa opcional;
* configuración de revelado;
* fecha de última actividad.

Estados posibles:

```text
WAITING
VOTING
REVEALED
CLOSED
```

## Participante

Un participante debe tener:

* id UUID;
* roomId;
* nombre visible;
* sessionToken;
* rol;
* estado de conexión;
* fecha de entrada;
* fecha de última actividad.

Roles:

```text
MODERATOR
VOTER
OBSERVER
```

Los observadores no pueden votar.

No implementar usuarios registrados en el MVP.

Al entrar en una sala, generar un `sessionToken` seguro y persistirlo en cookie o almacenamiento local para permitir reconexión.

## Historia de usuario

Una historia debe tener:

* id UUID;
* roomId;
* título;
* descripción opcional;
* criterios de aceptación opcionales;
* posición;
* estado;
* estimación final opcional;
* fecha de creación;
* fecha de actualización.

Estados:

```text
PENDING
ACTIVE
ESTIMATED
SKIPPED
```

## Voto

Un voto debe tener:

* id UUID;
* roomId;
* storyId;
* participantId;
* value;
* round;
* fecha de creación;
* fecha de actualización.

Debe existir como máximo un voto activo por participante, historia y ronda.

---

# 5. Baraja inicial

Implementar inicialmente la baraja Fibonacci modificada:

```text
0
0.5
1
2
3
5
8
13
20
40
100
?
BREAK
```

Interpretación:

* `?`: información insuficiente;
* `BREAK`: solicitar una pausa.

La implementación debe dejar preparado el sistema para añadir barajas personalizadas en el futuro.

---

# 6. Reglas de negocio

## Creación de sala

El usuario debe poder crear una sala indicando:

* nombre de la sala;
* su nombre;
* nombre opcional de la primera historia.

La persona que crea la sala se convierte en moderador.

Al crear la sala, redirigir a:

```text
/rooms/{roomCode}
```

## Entrada a la sala

Un usuario puede entrar mediante:

```text
/join/{roomCode}
```

Debe indicar:

* nombre;
* rol, salvo que la sala restrinja la selección.

Por defecto, entrar como `VOTER`.

Si existe una sesión previa válida, permitir reconexión automática.

## Gestión de historias

El moderador puede:

* crear historias;
* editar historias;
* eliminar historias;
* reordenarlas;
* activar una historia;
* marcar una historia como omitida;
* guardar la estimación final.

Los votantes y observadores solo pueden consultar las historias.

No permitir eliminar una historia que tenga una estimación final sin mostrar confirmación.

## Ronda de votación

Cuando el moderador activa una historia:

1. La sala cambia a estado `VOTING`.
2. Se incrementa o inicializa el número de ronda.
3. Se limpian visualmente los votos anteriores.
4. Cada votante puede seleccionar una carta.
5. Los demás participantes solo ven quién votó, no el valor.
6. El moderador puede revelar los votos.
7. La sala cambia a estado `REVEALED`.
8. Todos los participantes ven los valores.
9. Se calculan estadísticas.
10. El moderador puede iniciar una nueva ronda o guardar una estimación final.

## Revelado

Antes del revelado, el backend nunca debe enviar los valores de los votos a clientes no autorizados.

No basta con ocultarlos en el frontend.

El evento previo al revelado solo debe incluir:

* participantId;
* hasVoted;
* timestamp opcional.

Después de revelar, el backend puede enviar los valores.

## Nueva ronda

Al iniciar una nueva ronda:

* incrementar el número de ronda;
* conservar los votos históricos;
* limpiar los votos activos del frontend;
* devolver la sala al estado `VOTING`.

## Estimación final

El moderador puede seleccionar manualmente una estimación final.

No establecer automáticamente la media como estimación final.

Al guardar la estimación:

* actualizar la historia a `ESTIMATED`;
* guardar la estimación final;
* cerrar la ronda;
* mantener el historial;
* permitir activar la siguiente historia.

---

# 7. Estadísticas de votación

Después de revelar, calcular únicamente con valores numéricos:

* cantidad de votos;
* mínimo;
* máximo;
* promedio;
* mediana;
* moda;
* distribución;
* porcentaje de consenso.

Definir el consenso del MVP como:

```text
cantidad del valor más votado / total de votos numéricos * 100
```

Los votos `?` y `BREAK` deben mostrarse, pero excluirse de promedio, mediana y moda numérica.

Mostrar una alerta cuando:

* exista al menos un voto `?`;
* exista al menos un voto `BREAK`;
* la diferencia entre mínimo y máximo sea elevada;
* el consenso sea inferior al 60 %.

---

# 8. Eventos en tiempo real

Definir todos los eventos WebSocket en el paquete compartido.

Eventos mínimos del cliente al servidor:

```text
room:join
room:leave
room:sync

participant:update

story:create
story:update
story:delete
story:reorder
story:activate
story:skip
story:finalize

vote:submit
vote:clear

round:reveal
round:restart

room:close
```

Eventos mínimos del servidor al cliente:

```text
room:state
room:updated
room:closed

participant:joined
participant:left
participant:updated

story:created
story:updated
story:deleted
story:reordered
story:activated
story:finalized

vote:status
vote:revealed

round:started
round:revealed
round:restarted

error
```

Cada evento debe:

* validar payload;
* verificar permisos;
* manejar errores;
* devolver una respuesta consistente;
* actualizar PostgreSQL cuando corresponda;
* publicar el nuevo estado a los miembros de la sala.

---

# 9. Estado y persistencia

## PostgreSQL

Persistir en PostgreSQL:

* salas;
* participantes;
* historias;
* rondas;
* votos;
* estimaciones finales.

## Redis

Usar Redis para:

* presencia;
* sockets activos;
* relación entre socket y participante;
* estado efímero de conexión;
* escalado futuro del adaptador de Socket.IO.

PostgreSQL debe seguir siendo la fuente de verdad.

No guardar exclusivamente en Redis información crítica.

---

# 10. API REST

Aunque la interacción principal sea WebSocket, crear endpoints REST para operaciones iniciales y recuperación.

Endpoints mínimos:

```text
POST   /api/v1/rooms
GET    /api/v1/rooms/:roomCode
POST   /api/v1/rooms/:roomCode/join
POST   /api/v1/rooms/:roomCode/reconnect

GET    /api/v1/rooms/:roomCode/stories
POST   /api/v1/rooms/:roomCode/stories
PATCH  /api/v1/rooms/:roomCode/stories/:storyId
DELETE /api/v1/rooms/:roomCode/stories/:storyId

GET    /api/v1/rooms/:roomCode/history
GET    /api/v1/health
```

Aplicar un prefijo global:

```text
/api/v1
```

Generar documentación Swagger en:

```text
/api/docs
```

---

# 11. Seguridad mínima

Implementar:

* códigos de sala no secuenciales;
* tokens de sesión aleatorios y seguros;
* validación de permisos en backend;
* rate limiting;
* Helmet;
* CORS configurable;
* validación global de DTO;
* sanitización básica de textos;
* límites de longitud;
* protección contra payloads excesivos;
* no exponer votos antes del revelado;
* no confiar en roles enviados por el frontend;
* logs sin tokens ni datos sensibles.

Límites sugeridos:

```text
roomName: 3–80 caracteres
participantName: 2–40 caracteres
storyTitle: 3–200 caracteres
storyDescription: máximo 5.000 caracteres
acceptanceCriteria: máximo 5.000 caracteres
```

El token de sesión debe almacenarse preferiblemente en una cookie segura cuando sea viable. Para desarrollo local puede utilizarse una estrategia compatible con HTTP.

---

# 12. Interfaz de usuario

Utilizar Nuxt UI para todos los componentes principales.

## Página de inicio

Ruta:

```text
/
```

Debe incluir:

* nombre del producto temporal;
* descripción corta;
* botón “Crear sala”;
* formulario de creación;
* campo para entrar mediante código de sala;
* diseño limpio y profesional;
* soporte para modo oscuro.

## Página de entrada

Ruta:

```text
/join/[roomCode]
```

Debe incluir:

* nombre de la sala;
* campo de nombre;
* selección de rol cuando corresponda;
* botón de entrada;
* validaciones;
* mensajes claros de error.

## Página principal de sala

Ruta:

```text
/rooms/[roomCode]
```

Diseño desktop:

### Columna izquierda

* backlog;
* historias pendientes;
* historias estimadas;
* botón para agregar historia;
* drag and drop;
* indicador de historia activa.

### Área central

* título de historia activa;
* descripción;
* criterios de aceptación;
* número de ronda;
* estado de sala;
* cartas de votación;
* botón para revelar, solo moderador;
* resultados después del revelado;
* selector de estimación final;
* botón para guardar estimación;
* botón para iniciar nueva ronda.

### Columna derecha

* participantes;
* rol;
* estado conectado o desconectado;
* indicador de voto emitido;
* moderador identificado claramente.

## Responsive

En móvil:

* backlog en drawer;
* participantes en drawer;
* historia activa en el centro;
* cartas en grid;
* botones principales fijados o fácilmente accesibles.

---

# 13. Componentes frontend sugeridos

Crear componentes reutilizables como:

```text
RoomHeader.vue
RoomStatusBadge.vue
ParticipantsPanel.vue
ParticipantItem.vue
StoryBacklog.vue
StoryListItem.vue
StoryEditorModal.vue
ActiveStoryCard.vue
VotingDeck.vue
VotingCard.vue
VoteProgress.vue
RevealControls.vue
VoteResults.vue
VoteDistribution.vue
ConsensusIndicator.vue
FinalEstimateSelector.vue
ConnectionStatus.vue
EmptyState.vue
ConfirmDialog.vue
```

Crear composables como:

```text
useRoom.ts
useRoomSocket.ts
useParticipantSession.ts
useVoting.ts
useStories.ts
useConnectionStatus.ts
```

Crear stores Pinia separadas para:

```text
room
participant
stories
voting
connection
```

Evitar una única store global gigante.

---

# 14. Experiencia de usuario

Incluir:

* feedback visual al votar;
* animación discreta al revelar;
* estado de conexión;
* reconexión automática;
* skeletons de carga;
* toasts de éxito y error;
* confirmación antes de acciones destructivas;
* botón para copiar enlace de invitación;
* contador de personas que ya votaron;
* atajos de teclado del 1 al 9 cuando sea viable;
* accesibilidad por teclado;
* etiquetas ARIA;
* contraste correcto;
* estados vacíos bien diseñados.

No sobrecargar la interfaz con animaciones.

---

# 15. Manejo de desconexiones

Cuando un participante se desconecte:

* marcarlo como desconectado;
* no eliminarlo inmediatamente;
* conservar su voto;
* permitir reconexión con el mismo token;
* restaurar su identidad;
* restaurar el estado actual de la sala;
* evitar duplicados.

Cuando el moderador se desconecte:

* conservar la sala activa;
* permitir su reconexión;
* no transferir automáticamente el rol en el MVP.

Mostrar al resto que el moderador está desconectado.

---

# 16. Base de datos

Crear el esquema Prisma completo.

Entidades mínimas:

```text
Room
Participant
Story
EstimationRound
Vote
```

Agregar:

* claves foráneas;
* índices;
* restricciones únicas;
* timestamps;
* borrado lógico únicamente cuando aporte valor;
* migración inicial;
* seed opcional para una sala de demostración.

Restricciones importantes:

* roomCode único;
* sessionToken único;
* posición única o correctamente gestionada por sala;
* un voto por participante, historia y ronda.

---

# 17. Arquitectura backend

Separar NestJS en módulos:

```text
AppModule
ConfigModule
DatabaseModule
RedisModule
HealthModule
RoomsModule
ParticipantsModule
StoriesModule
VotingModule
RealtimeModule
```

Cada módulo debe seguir una separación clara:

```text
controllers
gateways
services
repositories
dto
entities o domain
mappers
guards
```

No colocar toda la lógica dentro del WebSocket Gateway.

Los gateways deben:

* recibir eventos;
* validar contexto;
* invocar servicios;
* publicar resultados.

La lógica de negocio debe estar en servicios de aplicación o dominio.

---

# 18. Formato de errores

Utilizar un formato consistente:

```json
{
  "code": "ROOM_NOT_FOUND",
  "message": "The requested room does not exist.",
  "details": null,
  "timestamp": "2026-07-10T12:00:00.000Z"
}
```

Crear códigos específicos como:

```text
ROOM_NOT_FOUND
ROOM_CLOSED
INVALID_SESSION
PARTICIPANT_NOT_FOUND
FORBIDDEN_ACTION
STORY_NOT_FOUND
NO_ACTIVE_STORY
VOTING_NOT_ACTIVE
ROUND_ALREADY_REVEALED
INVALID_VOTE
DUPLICATE_PARTICIPANT_NAME
```

Los mensajes mostrados en frontend deben ser claros para el usuario.

---

# 19. Pruebas

## Backend

Crear pruebas unitarias para:

* creación de sala;
* entrada de participante;
* permisos del moderador;
* envío de votos;
* ocultamiento de valores antes del revelado;
* revelado;
* cálculo de estadísticas;
* reinicio de ronda;
* guardado de estimación final;
* reconexión.

Crear al menos una prueba end-to-end para el flujo principal.

## Frontend

Crear pruebas para:

* selección de carta;
* estado de voto emitido;
* visibilidad de controles según rol;
* resultados después del revelado;
* formularios de creación y entrada.

Utilizar Vitest.

No buscar cobertura del 100 %, pero cubrir las reglas críticas.

---

# 20. Logging y observabilidad

Implementar logging estructurado con:

* requestId;
* roomCode cuando corresponda;
* participantId cuando corresponda;
* nombre del evento;
* resultado;
* duración;
* errores.

No registrar:

* tokens de sesión;
* cookies;
* contenido sensible completo.

Crear endpoint de health check que valide:

* aplicación;
* PostgreSQL;
* Redis.

---

# 21. Docker y ejecución

El proyecto debe ejecutarse con:

```bash
docker compose up --build
```

También debe permitir desarrollo local con:

```bash
pnpm install
pnpm dev
```

Agregar scripts:

```text
dev
build
lint
format
test
test:e2e
db:migrate
db:generate
db:seed
```

El README debe incluir:

* requisitos;
* variables de entorno;
* instalación;
* ejecución con Docker;
* ejecución local;
* migraciones;
* pruebas;
* arquitectura;
* eventos WebSocket;
* decisiones técnicas;
* limitaciones conocidas.

---

# 22. Variables de entorno

Crear `.env.example` con al menos:

```env
NODE_ENV=development

WEB_PORT=3000
API_PORT=4000

NUXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
NUXT_PUBLIC_SOCKET_URL=http://localhost:4000

DATABASE_URL=postgresql://planning:planning@postgres:5432/planning

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

CORS_ORIGIN=http://localhost:3000

SESSION_TOKEN_SECRET=change-this-secret
ROOM_CODE_LENGTH=8

LOG_LEVEL=debug
```

Adaptar nombres según la implementación final.

---

# 23. Criterios de aceptación del MVP

La implementación se considera completa cuando se pueda demostrar este flujo:

1. Un usuario abre la página.
2. Crea una sala.
3. Se convierte en moderador.
4. Copia el enlace de invitación.
5. Dos participantes entran desde navegadores o pestañas diferentes.
6. El moderador crea tres historias.
7. Activa una historia.
8. Los votantes seleccionan cartas.
9. Todos ven quién votó, pero no los valores.
10. El moderador revela.
11. Todos ven los mismos resultados en tiempo real.
12. Se muestran promedio, mediana, moda, rango y consenso.
13. El moderador inicia otra ronda.
14. Los participantes vuelven a votar.
15. El moderador guarda una estimación final.
16. La historia queda marcada como estimada.
17. Se activa la historia siguiente.
18. Un participante actualiza la página y recupera su sesión.
19. Los datos siguen existiendo después de reiniciar los contenedores.
20. No se puede ejecutar una acción de moderador desde un participante normal.

---

# 24. Enfoque de implementación

Trabaja por iteraciones.

## Iteración 1

* monorepo;
* Docker Compose;
* PostgreSQL;
* Redis;
* Prisma;
* Nuxt;
* NestJS;
* health checks.

## Iteración 2

* creación de sala;
* entrada;
* participantes;
* tokens de sesión;
* reconexión.

## Iteración 3

* historias;
* backlog;
* activación;
* reordenamiento.

## Iteración 4

* WebSockets;
* votación;
* ocultamiento;
* revelado;
* nueva ronda.

## Iteración 5

* estadísticas;
* estimación final;
* historial.

## Iteración 6

* responsive;
* manejo de errores;
* seguridad;
* pruebas;
* documentación.

Después de cada iteración:

* ejecutar lint;
* ejecutar pruebas;
* corregir errores;
* comprobar tipos;
* verificar que Docker continúe funcionando.

---

# 25. Reglas de calidad

* No dejar pseudocódigo.
* No dejar métodos vacíos.
* No simular persistencia con arrays en memoria.
* No usar `any` salvo justificación técnica explícita.
* No confiar en validaciones exclusivas del frontend.
* No exponer valores de voto antes del revelado.
* No acoplar componentes directamente a detalles internos de Socket.IO.
* No duplicar contratos entre frontend y backend.
* No crear abstracciones innecesarias.
* No implementar microservicios para este MVP.
* Construir un monolito modular.
* Mantener nombres, código y documentación en inglés.
* La interfaz puede estar inicialmente en español, pero debe dejarse preparada para i18n.
* Priorizar funcionalidad, claridad y mantenibilidad sobre complejidad arquitectónica.

---

# 26. Entregables esperados

Genera:

1. Estructura completa del repositorio.
2. Código funcional del frontend.
3. Código funcional del backend.
4. Esquema Prisma.
5. Migraciones.
6. Dockerfiles.
7. Docker Compose.
8. `.env.example`.
9. Pruebas esenciales.
10. README.
11. Documentación de API.
12. Documentación de eventos WebSocket.
13. Datos de demostración opcionales.
14. Lista de decisiones técnicas.
15. Lista de funcionalidades excluidas del MVP.

Antes de finalizar, verifica de extremo a extremo el flujo completo con al menos tres participantes simulados.

No presentes únicamente una guía. Implementa los archivos y el código necesarios para que el sistema pueda ejecutarse.
