# Smart Gym Backend Integration

## Base URLs

- REST API: `http://localhost:5000/api`
- Swagger: `http://localhost:5000/api/docs`
- Health: `http://localhost:5000/health`
- Socket.io: `http://localhost:5000`

## Authentication

1. Register:
   - `POST /api/auth/register`
2. Login:
   - `POST /api/auth/login`
3. Use the returned JWT in:
   - `Authorization: Bearer <token>`

## Frontend Core Flow

1. Login or register.
2. Fetch profile:
   - `GET /api/auth/profile`
   - `GET /api/user/profile`
3. Save body data:
   - `PUT /api/user/body-data`
4. Generate plans:
   - `POST /api/ai/plan`
   - or use `POST /api/workout/generate` and `POST /api/meal/generate`
5. Load current plans:
   - `GET /api/workout/current`
   - `GET /api/meal/current`
6. Machines and tokens:
   - `GET /api/tokens/balance`
   - `GET /api/machines/available`
   - `POST /api/machines/book`

## AI Agent Flow

1. Pull context:
   - `GET /api/ai/context`
2. Generate structured plans:
   - `POST /api/ai/plan`
3. Chat:
   - `POST /api/ai/chat`

## AI Agent On Another Machine

If the Node.js backend and the FastAPI AI agent run on different machines:

1. Run the AI agent with a public or LAN bind:
   - `uvicorn ai_agent.main:app --host 0.0.0.0 --port 8000`
2. On the AI agent machine, allow inbound traffic on port `8000` in the firewall.
3. Find the AI agent machine IP address, for example `192.168.1.50`.
4. In the backend `.env`, point `AI_AGENT_URL` to that machine:
   - `AI_AGENT_URL=http://192.168.1.50:8000`
5. Restart the backend after changing `.env`.
6. Verify connectivity from the backend machine:
   - `curl http://192.168.1.50:8000/health`

Recommended production setup:

- Put both services behind HTTPS through Nginx or a reverse proxy.
- Restrict the AI agent port to the backend server IP only.
- Add an internal shared secret or service token between backend and AI agent.

## Socket.io Chat

After connecting:

1. Join room:
   - event: `chat:join`
   - payload: current user id
2. Receive messages:
   - event: `chat:message`

## CORS

If Flutter web or Angular runs on another origin, set:

`CORS_ORIGIN=http://localhost:4200,http://localhost:3000`

Current backend `.env` is already prepared for Angular local dev:

`CORS_ORIGIN=http://localhost:4200`

## Optional Real AI Provider

If you want live LLM responses instead of local fallback:

- `OPENAI_API_KEY=...`
- `AI_MODEL=gpt-4.1-mini`
- optional: `AI_BASE_URL=https://api.openai.com/v1`

## Angular Starter Files

Ready-to-copy Angular integration starter files are included under:

`integration/angular/src/app/`

Included:

- `core/services/auth.service.ts`
- `core/services/profile.service.ts`
- `core/interceptors/auth.interceptor.ts`
- `core/guards/auth.guard.ts`
- `features/auth/login/*`
- `features/dashboard/*`
- `shared/components/logout-button/*`
- `app.routes.ts`
- `app.config.ts`
