# Sprint Poker

Sprint Poker is a functional MVP for realtime agile estimation with private Planning Poker votes, simultaneous reveal, basic statistics, final estimates, reconnection, and persisted session history.

## Requirements

- Node.js 22 LTS
- pnpm 9+
- Docker and Docker Compose

## Quick Start With Docker

```bash
cp .env.example .env
docker compose up --build
```

- Web: <http://localhost:3000>
- API: <http://localhost:4000/api/v1>
- Swagger: <http://localhost:4000/api/docs>

To enable GIF search in the session chat, set `NUXT_PUBLIC_GIPHY_API_KEY` in `.env`.

## Production Deploy

Production uses `docker-compose.prod.yml`. The stack expects an existing Traefik
instance attached to the external `traefik_default` Docker network. Only the web
and API containers join that network; Postgres and Redis stay on the private
`internal` network.

Create the server env file from `.env.production.example`:

```bash
sudo mkdir -p /srv/secret-envs
sudo cp .env.production.example /srv/secret-envs/sprint-poker.env
sudo nano /srv/secret-envs/sprint-poker.env
```

Required GitHub Actions secrets:

```text
VPS_IP
VPS_SSH_KEY
```

The deploy workflow clones or updates the repo in `/srv/sprint-poker`, copies
`/srv/secret-envs/sprint-poker.env` to `.env`, and runs:

```bash
GITHUB_SHA=<sha> docker compose -f docker-compose.prod.yml up -d --build --pull always --force-recreate --remove-orphans
```

The VPS `deploy` user must have an SSH host alias named `github-sprint-poker`
configured in `~/.ssh/config` for the repository deploy key.

## Local Development

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm dev
```

For local development outside Docker, set `DATABASE_URL` to `DIRECT_DATABASE_URL` or export a localhost PostgreSQL URL.

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm test
pnpm test:e2e
pnpm db:migrate
pnpm db:generate
pnpm db:seed
```

## Architecture

```text
apps/web      Nuxt 3, Vue 3.5, Nuxt UI, Pinia, Socket.IO client
apps/api      NestJS modular monolith, REST recovery API, Socket.IO gateway
packages/shared  shared enums, Zod schemas, event names, DTO-facing view contracts
```

PostgreSQL is the source of truth for rooms, participants, stories, rounds, votes, and final estimates. Redis stores ephemeral socket and presence mappings so the system can move toward a Socket.IO Redis adapter later.

## REST API

The API uses `/api/v1` as global prefix.

- `POST /rooms`
- `GET /rooms/:roomCode`
- `POST /rooms/:roomCode/join`
- `POST /rooms/:roomCode/reconnect`
- `GET /rooms/:roomCode/stories`
- `POST /rooms/:roomCode/stories`
- `PATCH /rooms/:roomCode/stories/:storyId`
- `DELETE /rooms/:roomCode/stories/:storyId`
- `GET /rooms/:roomCode/history`
- `GET /health`

Swagger is generated at `/api/docs`.

## WebSocket Events

Client to server:

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
room:reopen
chat:send
reaction:send
```

Server to client:

```text
room:state
room:updated
room:closed
room:reopened
chat:updated
reaction:created
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

Before reveal, vote broadcasts include only `participantId`, `hasVoted`, and an optional timestamp. Vote values and numeric statistics are emitted only when the room status is `REVEALED`.

## Technical Decisions

- Modular monolith instead of microservices.
- Sessionless participation with random `sessionToken` persisted in local storage and development cookies.
- Shared Zod schemas and TypeScript view contracts avoid duplicating frontend/backend event contracts.
- Final estimate is manual; statistics never set story estimates automatically.
- Redis is used only for ephemeral connection state; critical data stays in PostgreSQL.

## MVP Exclusions

- Payments
- AI features
- Jira/GitHub integrations
- Enterprise organizations
- Full registered-user authentication
- Automatic moderator transfer
- Custom decks UI, though the model is prepared for it

## Verification Flow

Open the app in three browser tabs, create a room, join with two voters, create three stories, activate one, submit votes, confirm values are hidden, reveal, review statistics, restart the round, vote again, save a final estimate, refresh one participant tab, and confirm the participant reconnects with the same identity.
