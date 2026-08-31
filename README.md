# DevMind — Engineering Intelligence Platform

DevMind is an AI-assisted engineering intelligence platform built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, and **Prisma ORM**.

It helps engineering teams understand complex codebases, map architecture, trace dependencies, inspect code evidence, track knowledge concentration, and onboard developers faster.

---

## 🚀 Current Project Status

- **Migration Phase**: **Complete (Frontend, Backend, Auth, GitHub OAuth, Ingestion, RAG Retrieval, Ask DevMind AI, Multi-Agent Engine)**.
- **Route Coverage**: **100% (45 App Router workspace screens & API endpoints)**.
- **Authentication**: Email/Password + HttpOnly JWT session engine (`lib/server/auth.ts`) & protected `/app/*` middleware.
- **GitHub Integration**: GitHub OAuth 2.0 Authorization Code Flow & Account Linking (`lib/server/github.ts`).
- **Ingestion & Indexing**: Real GitHub Repository Ingestion Subsystem (`lib/server/ingestion/`).
- **RAG & Vector Retrieval**: Semantic Evidence Retrieval Foundation (`lib/server/rag/`).
- **Ask DevMind AI Subsystem**: Grounded RAG Chat & Citation Reasoning (`lib/server/ai/`).
- **Autonomous Multi-Agent Subsystem**: Controlled Multi-Agent Intelligence Engine (`lib/server/agents/`):
  - **Planner Agent**: Goal deconstruction and sub-investigation planning (`planner-agent.ts`).
  - **Architecture Agent**: Structural pattern detection & module boundary auditing (`architect-agent.ts`).
  - **Dependency Agent**: Internal module edge & package dependency analysis (`dependency-agent.ts`).
  - **Review Agent**: Evidence verification & contradiction checking (`review-agent.ts`).
  - **Synthesis Agent**: Unified multi-agent report synthesis & citation validation (`synthesis-agent.ts`).
  - **Multi-Agent REST API**: Protected analysis endpoint (`POST /api/agents/analyze`).
- **Database Engine**: Prisma ORM 5.22.0 (`prisma/schema.prisma`) with SQLite local development database (`prisma/dev.db`).
- **Design System**: 100% faithful to the original DevMind prototype styling (`#090B0A` background, `#C8D62B` brand accent, Geist / Geist Mono typography, 232px sidebar width, 56px topbar height).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, Middleware, Server & Client Components)
- **UI Library**: [React 19](https://react.dev)
- **Language**: [TypeScript 5](https://www.typescriptlang.org)
- **Database / ORM**: [Prisma ORM 5.22](https://www.prisma.io) with SQLite (PostgreSQL + pgvector ready)
- **Security / Auth**: `bcryptjs` (password hashing), `jose` (JWT HttpOnly session cookies)
- **Ingestion Engine**: Deterministic Regex Parser & Static Analysis (`lib/server/ingestion/`)
- **RAG Retrieval Engine**: Hybrid Cosine Similarity Ranker (`lib/server/rag/`)
- **AI Reasoning Engine**: Grounded RAG LLM Provider & Citation Validator (`lib/server/ai/`)
- **Multi-Agent Subsystem**: 5-Role Bounded Single-Pass Agent Pipeline (`lib/server/agents/`)
- **Canvas / Graphics**: Pure SVG Architecture Graph Engine (`components/map/ProjectMapCanvas.tsx`) & SVG Skill Radar Chart (`app/app/devs/[id]/page.tsx`)

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js 18.x or later
- npm 9.x or later

### 2. Installation & Database Setup
Clone the repository and install dependencies:
```bash
npm install
```

Initialize the SQLite database schema:
```bash
npx prisma db push
```

### 3. Running Locally
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Running Quality Checks
```bash
# Run ESLint (0 errors, 0 warnings)
npm run lint

# Run TypeScript typecheck (0 errors)
npx tsc --noEmit

# Production build
npm run build
```

---

## 🔑 Environment Variables Guide

```ini
# Database Connection
DATABASE_URL="file:./dev.db"

# Authentication Secret
AUTH_SECRET="devmind_secret_jwt_token_key_change_in_production_32bytes"

# GitHub OAuth Credentials
GITHUB_CLIENT_ID=Ov23liDiV39Oa9txVeP6
GITHUB_CLIENT_SECRET=b30df65840270ed0f0d3fce5f2b84b1a096f5343
GITHUB_REDIRECT_URI="http://localhost:3000/api/github/callback"

# OpenAI AI / Embedding API Key (Optional: OpenAI key for production LLM & vectors; falls back to dev mock provider if unconfigured)
OPENAI_API_KEY="your_openai_api_key_here"
OPENAI_MODEL="gpt-4o-mini"
```

---

## 📂 Project Architecture

```
devmind/
├── app/                      # Next.js 16 App Router pages and layouts
│   ├── (auth & entry)/       # Landing (/), login, signup, connect, repos, analyze
│   ├── api/                  # REST API routes (/api/auth/*, /api/github/*, /api/repositories/*, /api/rag/*, /api/ask, /api/agents/*)
│   └── app/                  # Application Shell routes (/app/*)
├── components/
│   ├── ui/                   # Reusable React UI primitives (Button, Badge, Card, Modal, Switch, Toast, etc.)
│   ├── shell/                # App Shell suite (Sidebar, Topbar, GlobalCommandPalette)
│   └── map/                  # SVG Architecture Graph Engine (ProjectMapCanvas)
├── data/
│   ├── types.ts              # 30 domain TypeScript interfaces
│   └── fixtures.ts           # Centralized mock dataset matching prototype data.js
├── lib/
│   ├── server/               # Server data layer (db.ts, auth.ts, github.ts, repositories.ts, users.ts)
│   │   ├── ingestion/        # Ingestion subsystem (index.ts, tree.ts, parser.ts, modules.ts, dependencies.ts)
│   │   ├── rag/              # RAG retrieval layer (provider.ts, chunker.ts, indexer.ts, search.ts)
│   │   ├── ai/               # AI reasoning layer (provider.ts, prompt.ts, validate.ts)
│   │   └── agents/           # Multi-Agent subsystem (index.ts, agent-runner.ts, planner-agent.ts, architect-agent.ts, dependency-agent.ts, review-agent.ts, synthesis-agent.ts)
│   ├── nav.ts                # Route metadata & breadcrumb resolution
│   ├── course.ts             # Onboarding course store
│   └── shell-context.tsx     # Shell context provider
├── middleware.ts             # Route protection middleware enforcing session cookies on /app/*
├── prisma/
│   └── schema.prisma         # Prisma schema defining 14 domain models
└── styles/
    └── prototype/            # Migrated CSS files (base.css, components.css, app.css)
```

---

## 🔒 Security Baseline & READ-ONLY Safety Guarantee

- **Strict READ-ONLY Operation**: All agents run in 100% READ-ONLY server mode (`import "server-only"`). Zero code execution, zero file mutation, zero Git pushes or PR creation.
- **Bounded Single-Pass Execution**: Multi-agent reasoning executes in a single deterministic pass (`Planner -> Architect -> Dependency -> Review -> Synthesis`) without infinite loops or framework overhead.
- **Citation Validation**: Server-side validator (`lib/server/ai/validate.ts`) verifies every citation path and line range against retrieved evidence chunks.
- **Access Control**: `/api/agents/analyze` verifies authenticated user session and repository organization permissions.
