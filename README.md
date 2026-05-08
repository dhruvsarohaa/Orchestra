# OrchestrateAI

Production-grade multi-agent AI workspace.

## Workspace

- App: `artifacts/orchestrate-ai`
- Shared provider proxy: `lib/provider-proxy`
- Vercel serverless API: `api/llm/*`
- Self-host API: `artifacts/orchestrate-ai/server/index.ts`

## Requirements

- Node.js 20+
- pnpm 11+

## Setup

1. Copy `.env.example` to `.env` and set required values.
2. Install dependencies:
   - `pnpm install`

## Development

- Full app (frontend + Express API):
  - `pnpm run dev:web`

## Build

- `pnpm run build`

## Deployment targets

- Vercel:
  - Uses `api/llm/*` serverless routes and static output in `artifacts/orchestrate-ai/dist/public`.
- Self-hosted Node:
  - Use `pnpm --filter @workspace/orchestrate-ai serve` to run Express + SPA.
