# OrchestrateAI — Multi-Agent AI Orchestrator

## Overview

OrchestrateAI is a polished multi-agent AI orchestrator web app for college students. It routes student queries to specialized AI agents and provides a premium dark SaaS-style interface for career planning, learning, coding, vision analysis, resume building, interview prep, project ideation, study planning, skill-gap analysis, competitive exam guidance, and progress tracking.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (`artifacts/orchestrate-ai`)
- **UI**: Tailwind CSS, Radix UI primitives, lucide-react, wouter
- **State**: React Context + localStorage
- **AI providers**: Browser-side user API keys for Google Gemini, Groq, Anthropic Claude, OpenRouter, and Together AI

## Current Architecture

The app is served at `/` by a small Express server (`artifacts/orchestrate-ai/server/index.ts`) that mounts Vite as middleware in development and serves the built `dist/public` in production. User auth, API keys, model selection, agent selection, chat history, conversation state, and memory are stored in localStorage.

AI requests are sent directly from the browser for Groq, Anthropic, OpenRouter, and Together (their CORS allows browser calls). **Google Gemini calls are proxied through the Express server** at `POST /api/gemini/stream` (SSE) and `POST /api/gemini/generate` (JSON), because Google's Generative Language API blocks direct browser requests with 404. The user's Gemini key is sent from the browser to the local proxy via the `x-gemini-key` header and the server forwards it to Google. The Express server runs on the artifact's `PORT` env var; both `pnpm run dev` and `pnpm run serve` (production) are powered by `tsx server/index.ts`.

## Features

- Password login with access code `dhruv111`
- Premium modern UI with dark/light/system theme toggle, deep navy surfaces, gradient agent cards, animated hero gradient, glassmorphism memory panel, glowing input field, sidebar inset glow on active item, "Launch" hover affordance on cards, and rich micro-animations throughout
- Model Engine dropdown grouped by provider (Google, Groq, Anthropic, OpenRouter, Together) with provider color dots and badges; 11 selectable models including Gemini 1.5/2.0, Llama 3.3, Claude 3.5 Sonnet/Haiku, GPT-4o Mini, Mixtral 8x7B
- Settings dialog grouped by provider with API key inputs, saved-state checkmarks, per-provider Test Connection, and theme picker
- Auto Orchestrator plus specialized agents:
  1. Career Agent — resume analysis and career roadmaps
  2. Learning Agent — domain roadmaps and resources
  3. Code Judge — code evaluation and complexity guidance
  4. Vision Agent — image/photo problem analysis through Gemini multimodal requests
  5. Resume Builder — ATS optimization and improvements
  6. Interview Prep — mock questions and STAR answers
  7. Project Ideas — innovative ideas with tech stack suggestions
  8. Study Planner — personalized schedules
  9. Skill Gap Analyzer — skills vs industry requirements
  10. Competitive Exam — NDA, UPSC, SSC, Merchant Navy roadmaps
  11. Progress Tracker — history and improvement insights
- Structured memory system (`src/lib/memory.ts`) with three categories — **identity** (who you are), **goals** (what you want), and **context** (what you're working on) — extracted from each user message via regex heuristics plus an AI fact-extraction pass that returns JSON. Stored at `orchestrate_profile_v2`.
- Sliding per-agent recent buffer (last ~8 messages) at `orchestrate_recent_{agent}` plus rolling 2–3 sentence summary at `orchestrate_summary_{agent}` (auto-summarizes older turns once the buffer exceeds the threshold).
- Memory panel rendered as a glassmorphism sheet with chip-based UI ("Who you are / Your goals / Recent context"), per-agent activity grid, export/import JSON, and clear-all confirmation. Empty-state with animated brain icon when nothing is remembered.
- Token-by-token streaming for **all five providers** via SSE (`src/lib/streaming.ts`) with blinking cursor while text arrives, a red Stop button that cancels the in-flight request, and graceful non-streaming fallback if the SSE call fails.
- Multimodal image upload with Gemini inline image payload support
- History sidebar with persisted conversations, delete support, and a glowing inset-shadow indicator on the active item
- Animated welcome hero (gradient drift) with shimmer-text headline and gradient-tinted agent quick-launch cards (each with hover "Launch" pill)
- Glowing input field while focused; gradient send button with hover lift
- Clean responsive sidebar with mobile sheet, smooth open/close animations, and mobile-friendly layout

## Key Commands

- `pnpm --filter @workspace/orchestrate-ai run dev` — run the frontend locally
- `pnpm --filter @workspace/orchestrate-ai run build` — build the frontend artifact
- `pnpm --filter @workspace/orchestrate-ai run typecheck` — typecheck the frontend artifact

## Notes

- API keys are stored locally in the browser for demo use.
- Image analysis requires selecting a Gemini model and adding a Gemini API key.
- Groq, Anthropic, OpenRouter, and Together model options are text-only in the current browser-side implementation.
- Anthropic browser calls use the `anthropic-dangerous-direct-browser-access: true` header — fine for a single-user demo, not appropriate for production.
- Memory is localStorage-only and persists across browser sessions on the same device/browser.
- Theme keys: `dark`, `light`, and `system` (which follows `prefers-color-scheme`).
