# OrchestrateAI — Multi-Agent AI Orchestrator

## Overview

OrchestrateAI is a professional multi-agent AI orchestrator web app for college students. It routes student queries to specialized AI agents and uses Gemini AI (via Replit AI Integrations) for all responses. Built as a full-stack React + Vite app in a pnpm monorepo.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/orchestrate-ai)
- **Backend**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM (conversations, messages tables)
- **AI**: Gemini via Replit AI Integrations (`@workspace/integrations-gemini-ai`)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

- Login/Signup with session via localStorage (demo auth, no real auth)
- Profile setup with domain selection (BTech CS - AI/ML, Cybersecurity, etc.)
- Dark/light mode toggle (next-themes)
- Fake LLM selector dropdown (11 models — all route to Gemini 3 Flash behind scenes)
- 11 Specialized AI Agents:
  1. Career Agent — Resume analysis, AI risk scores, roadmaps
  2. Learning Agent — Domain roadmaps, free resources, mini-projects
  3. Code Judge — Code evaluation, test cases, complexity
  4. Vision Agent — Solve handwritten/photo problems (multimodal)
  5. Resume Builder — ATS optimization, improvements
  6. Interview Prep — Mock questions + STAR answers
  7. Project Ideas — 5 innovative ideas with tech stack
  8. Study Planner — Personalized schedules
  9. Skill Gap Analyzer — Skills vs 2026 industry requirements
  10. Competitive Exam — NDA, UPSC, SSC, Merchant Navy roadmaps
  11. Progress Tracker — History and improvement insights
- Image upload support (multimodal via Vision Agent)
- SSE streaming chat responses
- History sidebar with past conversations
- Bottom caption crediting the builder

## Routes

- `GET/POST /api/orchestrate/chat` — SSE streaming orchestrator
- `GET /api/orchestrate/history` — Chat history
- `DELETE /api/orchestrate/history` — Clear history
- Standard Gemini conversation CRUD endpoints

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
