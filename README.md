# RAG Knowledge Assistant

A production-ready, full-stack Retrieval-Augmented Generation (RAG) application that enables intelligent conversations with your documents. Built with Next.js 16, featuring an adaptive reasoning engine, multi-layer security, Redis-backed caching, and enterprise-grade architecture.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)
![Weaviate](https://img.shields.io/badge/Weaviate-Vector_DB-FF6B6B?style=for-the-badge)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Production Enhancements](#production-enhancements)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [How RAG Works](#how-rag-works)
- [Project Structure](#project-structure)
- [What I Learned](#what-i-learned)

---

## Overview

RAG Knowledge Assistant transforms how you interact with documents. Upload PDFs, text files, or markdown documents, and engage in intelligent conversations where AI responses are grounded in your actual content — with source citations for every answer.

### The Problem
Traditional LLMs have knowledge cutoffs and can "hallucinate" information. They can't access your private documents or domain-specific knowledge.

### The Solution
RAG (Retrieval-Augmented Generation) bridges this gap by:
1. **Retrieving** relevant chunks from your documents using semantic search
2. **Augmenting** the LLM prompt with this context
3. **Generating** accurate, cited responses based on your actual data

---

## Features

### Core Functionality
- **Document Processing** — Upload and process PDF, TXT, and Markdown files with intelligent chunking
- **Semantic Search** — Find relevant information using natural language queries
- **RAG Chat** — AI-powered conversations grounded in your documents
- **Source Citations** — Every AI response includes references to source documents

### Intelligent Processing
- **Smart Chunking** — Section-aware chunking that respects document structure (headings, paragraphs, lists)
- **Structured Parsers** — Dedicated parsers for PDF (unpdf), Markdown (with frontmatter), and plain text
- **Metadata Enrichment** — Automatic extraction of document metadata, section titles, and content types

### Hybrid Database Layer
- **pgvector Integration** — Supabase-backed vector search alongside Weaviate for redundancy
- **Hybrid Search** — Combined vector similarity + full-text search with configurable weights
- **LLM Re-ranking** — Groq-powered relevance re-ranking of search results for higher precision

### Reasoning Engine
- **Query Classification** — Automatically categorizes queries as simple, complex, or conversational
- **Query Decomposition** — Breaks complex questions into sub-queries for multi-step retrieval
- **Adaptive Orchestration** — Routes queries through the optimal pipeline based on complexity

### Validation & Quality Metrics
- **Automated Evaluation** — LLM-judged response quality scoring (relevance, completeness, accuracy, citation quality)
- **User Feedback** — Thumbs up/down feedback on individual messages, persisted across sessions
- **Quality Analytics** — Per-model quality trends and comparison dashboards

### Security Hardening
- **Input Sanitization** — Strips null bytes, control characters, and prompt structure markers
- **Prompt Injection Defense** — Structural delimiters (`<user_input>`, `<document>` tags) + instruction anchoring
- **Message Length Limits** — 10,000 char limit for chat, 5,000 for search, enforced in UI and API
- **Conversation History Validation** — Role whitelisting (user/assistant only), 50-message cap
- **Security Headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

### Production Infrastructure
- **Structured Logging** — JSON logger with secret redaction across all server-side code
- **Error Boundaries** — Global + dashboard-scoped React error boundaries with retry
- **Retry & Timeout** — Exponential backoff on all external service calls (Groq, Voyage, HuggingFace, Weaviate)
- **Environment Validation** — Fails fast on missing required vars at server startup
- **Health Check** — `GET /api/health` endpoint for monitoring service connectivity
- **CI/CD** — GitHub Actions pipeline: lint, build, dependency audit on every push/PR

### Redis Rate Limiting & Caching
- **Redis-backed Rate Limiting** — Per-user limits using Upstash Redis (INCR + EXPIRE atomic pattern)
- **Embedding Cache** — Query embeddings cached for 24 hours (deterministic, saves API calls)
- **Classification Cache** — Query classifications cached for 1 hour
- **Graceful Fallback** — All Redis features fall back to in-memory when Redis is not configured

### User Experience
- **Real-time Streaming** — Token-by-token response streaming via Server-Sent Events
- **Multi-Model Support** — Choose between Llama 3.3 70B, Llama 3.1 8B, or Qwen3 32B
- **Dual Embedding Providers** — Voyage AI (high quality, 512-dim) or HuggingFace (free tier, 384-dim)
- **Chat Persistence** — Conversations saved and organized by date
- **Three-Panel Layout** — Icon bar + chat history panel + content area with mobile responsive sheet
- **Analytics Dashboard** — Track usage, popular documents, model preferences, and quality metrics
- **Multi-tenant Security** — Complete data isolation between users via Clerk + RLS

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT                                       │
│                          (Next.js Frontend)                                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY LAYER                                     │
│            Input Sanitization · Prompt Defense · Rate Limiting              │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API LAYER                                        │
│                       (Next.js API Routes)                                  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐       │
│  │  /chat   │ │ /search  │ │/documents │ │/analytics │ │ /health  │       │
│  └──────────┘ └──────────┘ └───────────┘ └───────────┘ └──────────┘       │
└────────┬────────────┬────────────┬─────────────┬──────────────┬────────────┘
         │            │            │             │              │
         ▼            ▼            ▼             ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│  Reasoning   │ │ Weaviate │ │ Supabase │ │ Voyage/  │ │   Upstash    │
│   Engine     │ │(Vectors) │ │(DB/Store)│ │HuggingFace│ │   Redis      │
│  Classifier  │ │          │ │ pgvector │ │          │ │ (Cache/Rate) │
│  Decomposer  │ │          │ │          │ │          │ │              │
│ Orchestrator │ │          │ │          │ │          │ │              │
└──────────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘
         │
         ▼
┌──────────────┐
│     Groq     │
│    (LLMs)    │
│ + Re-ranking │
│ + Evaluation │
└──────────────┘
```

### Data Flow

```
Document Upload Flow:
┌────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
│ Upload │───▶│ Supabase │───▶│ Structured│───▶│  Smart    │───▶│ Generate │───▶│ Weaviate │
│  File  │    │ Storage  │    │  Parser   │    │ Chunker   │    │Embeddings│    │ + pgvec  │
└────────┘    └──────────┘    └───────────┘    └───────────┘    └──────────┘    └──────────┘

RAG Chat Flow (Adaptive):
┌────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
│ Query  │───▶│ Sanitize │───▶│ Classify  │───▶│ Retrieve  │───▶│ Re-rank  │───▶│  Stream  │
│        │    │ + Validate│    │ + Route   │    │ + Search  │    │ + Eval   │    │ Response │
└────────┘    └──────────┘    └───────────┘    └───────────┘    └──────────┘    └──────────┘
                                  │                                  │
                                  ├─ Simple → standard retrieval     ├─ Quality scoring
                                  ├─ Complex → decompose + multi-    ├─ Source citations
                                  │   step retrieval + synthesize    └─ Reasoning metadata
                                  └─ Conversational → context-aware
```

---

## Production Enhancements

This application was built through progressive phases of production hardening:

### Intelligent Data Processing
Replaced basic text splitting with structure-aware document processing:
- **Smart Chunker** (`src/lib/processing/smartChunker.ts`) — Detects headings, code blocks, lists, and paragraphs; preserves logical boundaries
- **Structured Parsers** (`src/lib/processing/structuredParsers.ts`) — Format-specific parsers for PDF, Markdown (with frontmatter via gray-matter), and plain text
- **Metadata Enrichment** (`src/lib/processing/enrichment.ts`) — Extracts section titles, content types, and document metadata for each chunk

### Hybrid Database Layer
Added pgvector to Supabase alongside Weaviate for redundancy and hybrid search:
- **pgvector Storage** (`src/lib/supabase/pgvector.ts`) — Embeddings stored in Supabase with cosine similarity search
- **Hybrid Search** (`src/lib/supabase/hybridSearch.ts`) — Combined vector similarity + full-text search with configurable weights
- **LLM Re-ranking** (`src/lib/llm/reranker.ts`) — Groq-powered relevance re-ranking of retrieved chunks

### Reasoning Engine
Added an adaptive reasoning layer that classifies queries and routes them through the optimal pipeline:
- **Query Classifier** (`src/lib/reasoning/classifier.ts`) — Categorizes queries as simple, complex, or conversational using Llama 3.1 8B
- **Query Decomposer** (`src/lib/reasoning/decomposer.ts`) — Breaks complex questions into sub-queries for multi-step retrieval
- **Orchestrator** (`src/lib/reasoning/orchestrator.ts`) — Routes queries through the optimal pipeline; synthesizes multi-step results
- **Reasoning Prompts** (`src/lib/reasoning/prompts.ts`) — Specialized prompts for classification, decomposition, and synthesis

### Validation & Quality Metrics
Added automated response evaluation and user feedback:
- **Evaluator** (`src/lib/validation/evaluator.ts`) — LLM-judged quality scoring across relevance, completeness, accuracy, and citation quality
- **Evaluation Store** (`src/lib/validation/store.ts`) — Persists evaluation results to Supabase for trend analysis
- **User Feedback** (`src/app/api/chat/feedback/route.ts`) — Thumbs up/down feedback persisted per message, restored on page reload

### Security Hardening
Added multi-layer defense against prompt injection and input abuse:
- **Input Sanitization** (`src/lib/security/sanitize.ts`) — Strips null bytes, control characters, and structural markers; enforces length limits
- **Prompt Defense** (`src/lib/security/promptDefense.ts`) — Wraps user input and document context in structural delimiters; adds instruction anchoring
- **Security Headers** (`next.config.ts`) — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

### Production Reliability
- **Structured Logging** (`src/lib/utils/logger.ts`) — JSON logger with automatic secret redaction; all server-side code uses this instead of `console.*`
- **Retry with Backoff** (`src/lib/utils/retry.ts`) — Exponential backoff wrapper for all external API calls
- **Error Boundaries** (`src/app/global-error.tsx`, `src/app/dashboard/error.tsx`) — Catches rendering errors with user-friendly recovery UI
- **Environment Validation** (`src/lib/env.ts`) — Validates all required env vars at server startup via Next.js instrumentation hook
- **Health Check** (`src/app/api/health/route.ts`) — Reports connectivity status for Supabase, Weaviate, Groq, and embedding providers
- **CI/CD** (`.github/workflows/ci.yml`) — GitHub Actions: lint, build, dependency audit on push/PR to main

### Redis Rate Limiting & Caching
Replaced in-memory rate limiting with Upstash Redis and added query caching:
- **Redis Client** (`src/lib/redis/client.ts`) — Upstash Redis singleton with `isRedisConfigured()` graceful fallback
- **Query Cache** (`src/lib/redis/cache.ts`) — Generic cache with TTL, key generators, and deterministic hashing
- **Redis Rate Limiter** (`src/lib/rateLimit/index.ts`) — INCR + EXPIRE atomic pattern; falls back to in-memory Map without Redis
- **Embedding Cache** — 24-hour TTL on query embeddings (deterministic, safe to cache long-term)
- **Classification Cache** — 1-hour TTL on query classifications (contextual, shorter cache)

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS 4** | Utility-first styling |
| **shadcn/ui** | Accessible component primitives |
| **Spline 3D** | Interactive 3D landing page hero |
| **React Markdown** | Markdown rendering in chat |

### Backend & Infrastructure
| Technology | Purpose |
|------------|---------|
| **Next.js API Routes** | Serverless API endpoints |
| **Clerk** | Authentication & user management |
| **Supabase** | PostgreSQL database + file storage + pgvector |
| **Weaviate** | Vector database for semantic search |
| **Upstash Redis** | Rate limiting & query caching (optional) |
| **GitHub Actions** | CI/CD pipeline |

### AI & Machine Learning
| Technology | Purpose |
|------------|---------|
| **Groq** | Ultra-fast LLM inference |
| **Llama 3.3 70B** | Primary large language model |
| **Llama 3.1 8B** | Fast model (classification, re-ranking, evaluation) |
| **Qwen3 32B** | Alternative high-quality model |
| **Voyage AI** | High-quality embeddings (512 dim) |
| **HuggingFace** | Free embeddings (384 dim) |

### Document Processing
| Technology | Purpose |
|------------|---------|
| **unpdf** | PDF text extraction |
| **gray-matter** | Markdown frontmatter parsing |
| **LangChain TextSplitters** | Configurable text chunking |
| **Custom Smart Chunker** | Structure-aware document segmentation |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Accounts for: [Clerk](https://clerk.com), [Supabase](https://supabase.com), [Weaviate](https://weaviate.io), [Groq](https://groq.com)
- At least one embedding provider: [Voyage AI](https://voyage.ai) or [HuggingFace](https://huggingface.co)
- Optional: [Upstash](https://upstash.com) for Redis (rate limiting & caching)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/norbertesekiel47/rag-knowledge-assistant.git
   cd rag-knowledge-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys (see Environment Variables below)
   ```

4. **Set up Supabase database**
   - Create a new Supabase project
   - Run the SQL migrations (see [Database Schema](#database-schema))
   - Create a storage bucket named `documents`
   - Enable the `vector` extension for pgvector

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Initialize Weaviate**
   - Open `http://localhost:3000`
   - Sign in with Clerk
   - Click "Initialize Weaviate" on the documents page

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

---

## Environment Variables

Create a `.env.local` file (or copy from `.env.example`):

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Weaviate Vector Database
WEAVIATE_URL=https://xxx.weaviate.network
WEAVIATE_API_KEY=

# LLM Provider (Groq)
GROQ_API_KEY=gsk_...

# Embedding Providers (at least one required)
VOYAGE_API_KEY=pa-...
HUGGINGFACE_API_KEY=hf_...

# Optional: Upstash Redis (persistent rate limiting & query caching)
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=
```

---

## Database Schema

### Supabase Tables

```sql
-- Users table (synced with Clerk via webhook)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  chunk_count INTEGER DEFAULT 0,
  error_message TEXT,
  embedding_provider TEXT DEFAULT 'huggingface',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessions table
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sources JSONB,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics queries table
CREATE TABLE analytics_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  model TEXT NOT NULL,
  embedding_provider TEXT NOT NULL,
  response_time_ms INTEGER,
  sources_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluation results table
CREATE TABLE evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  message_id TEXT,
  query TEXT NOT NULL,
  model TEXT NOT NULL,
  overall_score NUMERIC,
  relevance_score NUMERIC,
  completeness_score NUMERIC,
  accuracy_score NUMERIC,
  citation_score NUMERIC,
  evaluation_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message feedback table
CREATE TABLE message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  feedback TEXT NOT NULL CHECK (feedback IN ('positive', 'negative')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);
```

### Weaviate Collections

```
DocumentChunkVoyage (512 dimensions)
DocumentChunkHuggingFace (384 dimensions)

Properties:
- content: text
- documentId: uuid
- userId: text
- filename: text
- chunkIndex: int
```

---

## API Endpoints

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/documents?limit=50&offset=0` | List user's documents (paginated) |
| `POST` | `/api/documents` | Upload new document |
| `DELETE` | `/api/documents/[id]` | Delete document |
| `POST` | `/api/documents/[id]/process` | Process document |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message (streaming SSE response) |
| `GET` | `/api/chat/sessions` | List chat sessions |
| `POST` | `/api/chat/sessions` | Create session |
| `GET` | `/api/chat/sessions/[id]` | Get session details |
| `PATCH` | `/api/chat/sessions/[id]` | Update session title |
| `DELETE` | `/api/chat/sessions/[id]` | Delete session |
| `GET` | `/api/chat/sessions/[id]/messages` | Get session messages |
| `POST` | `/api/chat/sessions/[id]/messages` | Save messages |
| `POST` | `/api/chat/generate-title` | Generate chat title via LLM |
| `GET` | `/api/chat/feedback?sessionId=xxx` | Get feedback for a session |
| `POST` | `/api/chat/feedback` | Submit thumbs up/down feedback |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/search` | Semantic search (max 5,000 char query) |

### Analytics & Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics` | Get usage analytics & quality metrics |
| `GET` | `/api/health` | Health check (public) — service connectivity status |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhooks/clerk` | Clerk user sync webhook (Svix verified) |

### Setup
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/setup/weaviate` | Initialize Weaviate collections |

### Rate Limits
| Endpoint | Limit |
|----------|-------|
| `/api/chat` | 20 requests/minute |
| `/api/search` | 30 requests/minute |
| `/api/documents` (upload) | 10 requests/minute |
| `/api/documents/[id]/process` | 5 requests/minute |
| General | 100 requests/minute |

Rate limits are enforced per user. With Redis configured, limits persist across server restarts and work in multi-instance deployments. Without Redis, limits use in-memory storage (reset on restart).

---

## How RAG Works

### 1. Document Ingestion
```
PDF/TXT/MD → Structured Parser → Smart Chunker → Metadata Enrichment → Embed → Store (Weaviate + pgvector)
```

### 2. Query Processing (Adaptive)
```
User Question → Sanitize → Classify (simple/complex/conversational)
  ├─ Simple → Embed query → Vector search → Top 5 chunks → Re-rank → Generate
  ├─ Complex → Decompose into sub-queries → Multi-step retrieval → Synthesize → Generate
  └─ Conversational → Context-aware response with history
```

### 3. Response Generation
```
System Prompt + Instruction Anchor + Retrieved Context (in <document> tags) + User Question (in <user_input> tags) → LLM → Stream → Evaluate quality → Persist
```

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   ├── route.ts              # Chat endpoint (SSE streaming)
│   │   │   ├── feedback/route.ts     # Message feedback (GET/POST)
│   │   │   ├── sessions/             # Session CRUD + messages
│   │   │   └── generate-title/       # LLM title generation
│   │   ├── documents/
│   │   │   ├── route.ts              # Upload/list documents (paginated)
│   │   │   └── [id]/
│   │   │       ├── route.ts          # Get/delete document
│   │   │       └── process/          # Process document
│   │   ├── search/                   # Semantic search
│   │   ├── analytics/                # Usage analytics
│   │   ├── health/                   # Health check endpoint
│   │   ├── setup/weaviate/           # Weaviate initialization
│   │   └── webhooks/clerk/           # Clerk user sync
│   ├── dashboard/
│   │   ├── layout.tsx                # Dashboard shell (three-panel layout)
│   │   ├── page.tsx                  # Chat view (default)
│   │   ├── error.tsx                 # Dashboard error boundary
│   │   ├── documents/page.tsx        # Document management
│   │   ├── search/page.tsx           # Search view
│   │   └── analytics/page.tsx        # Analytics dashboard
│   ├── sign-in/                      # Clerk sign in
│   ├── sign-up/                      # Clerk sign up
│   ├── page.tsx                      # Landing page (Spline 3D hero)
│   ├── layout.tsx                    # Root layout
│   ├── globals.css                   # Global styles + CSS tokens
│   └── global-error.tsx              # Global error boundary
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx         # Chat UI with streaming + feedback
│   │   ├── ChatView.tsx              # Chat page wrapper
│   │   ├── MessageContent.tsx        # Markdown rendering with citations
│   │   └── CitationBadge.tsx         # Superscript [1] citation badges
│   ├── layout/
│   │   ├── IconBar.tsx               # Vertical icon navigation (60px)
│   │   ├── ChatHistoryPanel.tsx      # Conversation list sidebar (280px)
│   │   ├── DashboardShell.tsx        # Three-panel layout composition
│   │   └── MobileSidebar.tsx         # Mobile responsive sheet drawer
│   ├── documents/
│   │   ├── DocumentList.tsx          # Document table with actions
│   │   └── DocumentsView.tsx         # Documents page wrapper
│   ├── search/
│   │   ├── SearchBox.tsx             # Search input with provider select
│   │   ├── SearchFilters.tsx         # Search result filters
│   │   └── SearchView.tsx            # Search page wrapper
│   ├── upload/
│   │   └── FileUpload.tsx            # Drag-and-drop file upload
│   ├── settings/
│   │   └── EmbeddingSettings.tsx     # Embedding provider selection
│   ├── analytics/
│   │   └── AnalyticsDashboard.tsx    # Usage stats + quality metrics
│   └── ui/                           # shadcn/ui primitives + custom components
├── contexts/
│   ├── EmbeddingContext.tsx           # Embedding provider state
│   └── ChatSessionContext.tsx         # Active chat session state
├── lib/
│   ├── analytics/index.ts            # Analytics queries (with safety caps)
│   ├── embeddings/
│   │   ├── config.ts                 # Provider configuration
│   │   ├── huggingface.ts            # HuggingFace embeddings
│   │   ├── voyage.ts                 # Voyage AI embeddings
│   │   └── index.ts                  # Embedding generation (cached)
│   ├── env.ts                        # Environment variable validation
│   ├── feedback/scores.ts            # Chunk feedback scores for reranking
│   ├── llm/
│   │   ├── groq.ts                   # Groq client with retry
│   │   ├── index.ts                  # LLM abstraction + RAG prompts
│   │   ├── reranker.ts               # LLM-powered re-ranking
│   │   ├── titleGenerator.ts         # Chat title generation
│   │   └── types.ts                  # LLM types
│   ├── processing/
│   │   ├── processor.ts              # Processing pipeline
│   │   ├── parsers.ts                # File parsers (PDF, TXT, MD)
│   │   ├── structuredParsers.ts      # CSV, JSON, code parsers
│   │   ├── chunker.ts                # Basic text chunker
│   │   ├── smartChunker.ts           # Structure-aware chunker
│   │   ├── enrichment.ts             # Metadata enrichment
│   │   └── types.ts                  # Processing types
│   ├── rateLimit/
│   │   ├── index.ts                  # Rate limiter (Redis + in-memory)
│   │   └── middleware.ts             # Rate limit middleware
│   ├── reasoning/
│   │   ├── classifier.ts             # Query classifier (cached)
│   │   ├── decomposer.ts             # Query decomposer
│   │   ├── orchestrator.ts           # Adaptive orchestration
│   │   ├── prompts.ts                # Reasoning prompts (secured)
│   │   └── tools.ts                  # Structured LLM output
│   ├── redis/
│   │   ├── client.ts                 # Upstash Redis singleton
│   │   └── cache.ts                  # Cache get/set with TTL
│   ├── security/
│   │   ├── sanitize.ts               # Input sanitization
│   │   └── promptDefense.ts          # Prompt injection defense
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # Server client (service role)
│   │   ├── pgvector.ts               # pgvector operations
│   │   ├── hybridSearch.ts           # Hybrid search
│   │   └── types.ts                  # Database types
│   ├── utils/
│   │   ├── logger.ts                 # Structured JSON logger
│   │   └── retry.ts                  # Retry with exponential backoff
│   ├── validation/
│   │   ├── evaluator.ts              # Response quality evaluator
│   │   ├── prompts.ts                # Evaluation prompts
│   │   └── store.ts                  # Evaluation storage
│   └── weaviate/
│       ├── client.ts                 # Weaviate client
│       ├── schema.ts                 # Collection schemas
│       └── vectors.ts                # Vector CRUD operations
├── proxy.ts                          # Clerk auth middleware
└── instrumentation.ts                # Env validation on startup
```

---

## What I Learned

Building this project provided hands-on experience with:

### AI/ML Concepts
- **RAG Architecture** — Combining retrieval systems with generative AI
- **Vector Embeddings** — Converting text to semantic representations (Voyage AI, HuggingFace)
- **Semantic Search** — Finding relevant content by meaning, not keywords
- **LLM Prompt Engineering** — Crafting effective prompts with injection defense
- **Chunking Strategies** — Structure-aware document segmentation preserving context
- **Query Classification** — Routing queries through adaptive pipelines
- **LLM-as-Judge** — Automated quality evaluation of generated responses

### Full-Stack Development
- **Next.js 16 App Router** — Server components, streaming, and API routes
- **Real-time Streaming** — Server-sent events for token-by-token responses
- **Multi-tenant Architecture** — Data isolation in shared infrastructure
- **Rate Limiting** — Redis-backed per-user limits with graceful fallback
- **Caching Strategy** — TTL-based caching for deterministic operations (embeddings) vs contextual ones (classifications)
- **Security Hardening** — Input sanitization, prompt injection defense, structural delimiters, CSP headers

### Database & Infrastructure
- **Vector Databases** — Weaviate + pgvector for redundant similarity search
- **Hybrid Search** — Combining vector similarity with full-text search
- **PostgreSQL with RLS** — Row-level security for data isolation
- **Upstash Redis** — Serverless Redis for caching and rate limiting
- **Supabase Storage** — Secure file storage with policies
- **CI/CD** — GitHub Actions for automated lint, build, and dependency auditing

---

## Acknowledgments

- [Vercel](https://vercel.com) for Next.js and deployment
- [Clerk](https://clerk.com) for authentication
- [Supabase](https://supabase.com) for database and storage
- [Weaviate](https://weaviate.io) for vector search
- [Groq](https://groq.com) for LLM inference
- [Voyage AI](https://voyage.ai) for embeddings
- [HuggingFace](https://huggingface.co) for open-source models
- [Upstash](https://upstash.com) for serverless Redis
- [shadcn/ui](https://ui.shadcn.com) for component primitives
- [Spline](https://spline.design) for 3D design

---
