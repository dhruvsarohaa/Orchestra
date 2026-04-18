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
- **AI providers**: Browser-side user API keys for Gemini, Groq, and OpenRouter-compatible models

## Current Architecture

The current app is a frontend-only React artifact served at `/`. User auth, API keys, model selection, agent selection, chat history, conversation state, and memory are stored in localStorage. AI requests are sent directly from the browser using API keys entered by the user in the app settings.

## Features

- Password login with access code `dhruv111`
- Premium modern dark UI with deep navy surfaces, subtle purple accents, clean typography, modern cards, and restrained animation
- Model Engine dropdown with Gemini, Groq, and OpenRouter model options
- API key settings for Gemini, Groq, and OpenRouter
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
- Local memory layer using `orchestrate_memory_{agentName}` keys with up to 30 remembered messages per agent
- Global user summary stored in `orchestrate_memory_global` and injected into every agent prompt
- Memory panel with total/per-agent counts, export, import, and clear-all confirmation
- Memory indicators on agent selections/cards
- Multimodal image upload with Gemini inline image payload support
- History sidebar with persisted conversations and delete support
- Settings dialog for API key management
- Clean responsive sidebar and mobile-friendly layout

## Key Commands

- `pnpm --filter @workspace/orchestrate-ai run dev` — run the frontend locally
- `pnpm --filter @workspace/orchestrate-ai run build` — build the frontend artifact
- `pnpm --filter @workspace/orchestrate-ai run typecheck` — typecheck the frontend artifact

## Notes

- API keys are stored locally in the browser for demo use.
- Image analysis requires selecting a Gemini model and adding a Gemini API key.
- Groq and OpenRouter model options are text-only in the current browser-side implementation.
- Memory is localStorage-only and persists across browser sessions on the same device/browser.
