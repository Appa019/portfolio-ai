# Investimentos Manual
Gestão de investimentos pessoais — full-stack localhost.

**Stack:** Python FastAPI (backend) · Next.js 14+ TypeScript Tailwind v4 (frontend) · Supabase PostgreSQL · Gmail SMTP (notificações) · pnpm (JS) · pip + venv (Python)

## Commands
- `pnpm dev`: Frontend dev server (port 3000)
- `pnpm build`: Production build
- `pnpm lint`: ESLint
- `pnpm type-check`: TypeScript strict
- `source .venv/bin/activate && uvicorn app.main:app --reload --port 8000`: Backend dev
- `pytest -v`: Run tests
- `ruff check --fix .`: Lint Python
- `ruff format .`: Format Python
- `npx supabase db push`: Apply migrations
- `npx supabase migration new <name>`: Create migration

## Architecture
- `/app`: FastAPI backend (routers, services, models, schemas, config)
- `/frontend`: Next.js app (App Router, src/ structure)
- `/frontend/src/components/ui`: Reusable UI components
- `/frontend/src/lib/supabase`: Server and client Supabase instances
- `/supabase/migrations`: Database migrations
- `/tests`: Pytest test suite

## Code Standards
- TypeScript strict mode, no `any` types
- Named exports only, never default exports
- const/let only, never var
- Arrow functions for callbacks, function declarations for top-level
- async/await instead of .then()
- Python: type hints on all functions, Pydantic models for schemas
- Always use Context7 MCP for library documentation before generating code

## Notifications
- Gmail SMTP (smtp.gmail.com:587) with app password
- aiosmtplib for async email sending
- Jinja2 templates for email HTML

## IMPORTANT
- NEVER commit .env files or expose secrets
- NEVER use default exports
- ALWAYS run lint + type-check + tests before committing
- ALWAYS check Context7 for up-to-date library docs before using any external library
- Commits in English, Conventional Commits format (feat:, fix:, chore:, refactor:)
- NEVER mention Claude in commits, code, or co-author tags
- For Supabase schema changes, create a migration file first

## Memória do Projeto — OBRIGATÓRIO
- ANTES de escrever qualquer código, consulte a memória do projeto para verificar:
  - Erros anteriores similares (project_errors.md)
  - Padrões já estabelecidos (project_patterns.md)
  - Feedback do usuário sobre abordagens (feedback_lessons.md)
- DEPOIS de resolver um bug ou erro, salve na memória:
  - O que causou o erro
  - Como foi resolvido
  - Como evitar no futuro
- QUANDO o usuário corrigir sua abordagem, salve como feedback imediatamente
- QUANDO descobrir um padrão que funciona, salve em project_patterns.md
- A memória é seu cérebro persistente — trate como essencial, não opcional
