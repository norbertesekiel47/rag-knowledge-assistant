# 🧠 RAG Knowledge Assistant

A production-ready, full-stack Retrieval-Augmented Generation (RAG) application that enables intelligent conversations with your documents. Built with Next.js 14, featuring real-time streaming responses, multi-model LLM support, and enterprise-grade security.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)
![Weaviate](https://img.shields.io/badge/Weaviate-Vector_DB-FF6B6B?style=for-the-badge)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Schema](#-database-schema)
- [API Endpoints](#-api-endpoints)
- [How RAG Works](#-how-rag-works)
- [Project Structure](#-project-structure)
- [Screenshots](#-screenshots)
- [Future Enhancements](#-future-enhancements)
- [What I Learned](#-what-i-learned)
- [License](#-license)

---

## 🎯 Overview

RAG Knowledge Assistant transforms how you interact with documents. Upload PDFs, text files, or markdown documents, and engage in intelligent conversations where AI responses are grounded in your actual content—with source citations for every answer.

### The Problem
Traditional LLMs have knowledge cutoffs and can "hallucinate" information. They can't access your private documents or domain-specific knowledge.

### The Solution
RAG (Retrieval-Augmented Generation) bridges this gap by:
1. **Retrieving** relevant chunks from your documents using semantic search
2. **Augmenting** the LLM prompt with this context
3. **Generating** accurate, cited responses based on your actual data

---

## ✨ Features

### Core Functionality
- 📄 **Document Processing** - Upload and process PDF, TXT, and Markdown files
- 🔍 **Semantic Search** - Find relevant information using natural language queries
- 💬 **RAG Chat** - AI-powered conversations grounded in your documents
- 📊 **Source Citations** - Every AI response includes references to source documents

### Technical Highlights
- ⚡ **Real-time Streaming** - Token-by-token response streaming for better UX
- 🤖 **Multi-Model Support** - Choose between Llama 3.3 70B, Llama 3.1 8B, or Qwen3 32B
- 🔄 **Dual Embedding Providers** - Voyage AI (high quality) or HuggingFace (free tier)
- 💾 **Chat Persistence** - Conversations saved and organized by date
- 📈 **Analytics Dashboard** - Track usage, popular documents, and model preferences
- 🛡️ **Rate Limiting** - Per-user API rate limiting to prevent abuse
- 🔐 **Multi-tenant Security** - Complete data isolation between users

### User Experience
- 🎨 **Clean, Modern UI** - Intuitive interface with responsive design
- 📱 **Mobile Friendly** - Works seamlessly on all device sizes
- ⌨️ **Real-time Feedback** - Loading states, progress indicators, and error handling
- 🗂️ **Chat History** - Browse, search, and manage past conversations

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENT                                       │
│                           (Next.js Frontend)                                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│                         (Next.js API Routes)                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   /chat     │ │  /search    │ │ /documents  │ │ /analytics  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
└────────┬────────────────┬────────────────┬────────────────┬─────────────────┘
         │                │                │                │
         ▼                ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    Groq     │  │  Weaviate   │  │  Supabase   │  │  Voyage/    │
│   (LLMs)    │  │ (Vectors)   │  │  (DB/Store) │  │ HuggingFace │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

### Data Flow

```
Document Upload Flow:
┌────────┐    ┌────────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────┐
│ Upload │───▶│  Supabase  │───▶│   Extract    │───▶│  Generate  │───▶│ Weaviate │
│  File  │    │  Storage   │    │    Text      │    │ Embeddings │    │  Store   │
└────────┘    └────────────┘    └──────────────┘    └────────────┘    └──────────┘

RAG Chat Flow:
┌────────┐    ┌────────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────┐
│ Query  │───▶│  Embed     │───▶│   Vector     │───▶│  Build     │───▶│  Stream  │
│        │    │  Query     │    │   Search     │    │  Prompt    │    │ Response │
└────────┘    └────────────┘    └──────────────┘    └────────────┘    └──────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS 4** | Utility-first styling |
| **React Dropzone** | Drag-and-drop file uploads |
| **React Markdown** | Markdown rendering in chat |

### Backend & Infrastructure
| Technology | Purpose |
|------------|---------|
| **Next.js API Routes** | Serverless API endpoints |
| **Clerk** | Authentication & user management |
| **Supabase** | PostgreSQL database + file storage |
| **Weaviate** | Vector database for semantic search |

### AI & Machine Learning
| Technology | Purpose |
|------------|---------|
| **Groq** | Ultra-fast LLM inference |
| **Llama 3.3 70B** | Primary large language model |
| **Llama 3.1 8B** | Fast, lightweight model |
| **Qwen3 32B** | Alternative high-quality model |
| **Voyage AI** | High-quality embeddings (512 dim) |
| **HuggingFace** | Free embeddings (384 dim) |

### Document Processing
| Technology | Purpose |
|------------|---------|
| **pdf-parse** | PDF text extraction |
| **Custom Chunker** | Smart text segmentation |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Accounts for: [Clerk](https://clerk.com), [Supabase](https://supabase.com), [Weaviate](https://weaviate.io), [Groq](https://groq.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/rag-knowledge-assistant.git
   cd rag-knowledge-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

4. **Set up Supabase database**
   - Create a new Supabase project
   - Run the SQL migrations (see [Database Schema](#-database-schema))
   - Create a storage bucket named `documents`

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Initialize Weaviate**
   - Open `http://localhost:3000`
   - Sign in with Clerk
   - Click "Initialize Weaviate" on first run

---

## 🔐 Environment Variables

Create a `.env.local` file with the following variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Weaviate Vector Database
WEAVIATE_URL=https://xxxxx.weaviate.network
WEAVIATE_API_KEY=xxxxx

# LLM Provider (Groq)
GROQ_API_KEY=gsk_xxxxx

# Embedding Providers (at least one required)
VOYAGE_API_KEY=pa-xxxxx          # Optional: Higher quality
HUGGINGFACE_API_KEY=hf_xxxxx     # Optional: Free tier
```

---

## 🗄️ Database Schema

### Supabase Tables

```sql
-- Users table (synced with Clerk)
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

-- Analytics tables
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

## 📡 API Endpoints

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/documents` | List user's documents |
| `POST` | `/api/documents` | Upload new document |
| `DELETE` | `/api/documents/[id]` | Delete document |
| `POST` | `/api/documents/[id]/process` | Process document |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message (streaming) |
| `GET` | `/api/chat/sessions` | List chat sessions |
| `POST` | `/api/chat/sessions` | Create session |
| `DELETE` | `/api/chat/sessions/[id]` | Delete session |
| `POST` | `/api/chat/generate-title` | Generate chat title |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/search` | Semantic search |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics` | Get usage analytics |

### Rate Limits
| Endpoint | Limit |
|----------|-------|
| `/api/chat` | 20 requests/minute |
| `/api/search` | 30 requests/minute |
| `/api/documents` (upload) | 10 requests/minute |
| General | 100 requests/minute |

---

## 🧪 How RAG Works

### 1. Document Ingestion
```
PDF/TXT/MD → Extract Text → Chunk (1000 chars, 200 overlap) → Embed → Store in Weaviate
```

### 2. Query Processing
```
User Question → Generate Query Embedding → Vector Similarity Search → Top 5 Chunks
```

### 3. Response Generation
```
System Prompt + Retrieved Context + User Question → LLM → Streamed Response with Citations
```

### Example RAG Prompt
```
You are a helpful assistant. Use the following context from the user's documents to answer their question.

CONTEXT:
[Source 1: report.pdf, Chunk 3]
"The company achieved 40% revenue growth in Q3..."

[Source 2: notes.txt, Chunk 1]  
"Key factors included market expansion and..."

USER QUESTION: What drove the company's growth?

INSTRUCTIONS:
- Only use information from the provided context
- Cite sources using [Source N] format
- If context doesn't contain the answer, say so
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   ├── route.ts              # Chat endpoint
│   │   │   ├── sessions/             # Session management
│   │   │   └── generate-title/       # LLM title generation
│   │   ├── documents/
│   │   │   ├── route.ts              # Upload/list documents
│   │   │   └── [id]/
│   │   │       ├── route.ts          # Delete document
│   │   │       └── process/          # Process document
│   │   ├── search/                   # Semantic search
│   │   ├── analytics/                # Usage analytics
│   │   └── setup/                    # Weaviate initialization
│   ├── dashboard/
│   │   └── DashboardClient.tsx       # Main dashboard
│   ├── sign-in/                      # Clerk sign in
│   ├── sign-up/                      # Clerk sign up
│   └── layout.tsx                    # Root layout
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx         # Chat UI
│   │   ├── ChatSidebar.tsx           # Chat history
│   │   └── MessageContent.tsx        # Markdown rendering
│   ├── documents/
│   │   └── DocumentList.tsx          # Document management
│   ├── search/
│   │   └── SearchBox.tsx             # Search interface
│   ├── upload/
│   │   └── FileUpload.tsx            # File upload
│   ├── settings/
│   │   └── EmbeddingSettings.tsx     # Provider selection
│   ├── analytics/
│   │   └── AnalyticsDashboard.tsx    # Analytics UI
│   └── setup/
│       └── WeaviateSetup.tsx         # First-time setup
├── lib/
│   ├── llm/
│   │   ├── groq.ts                   # Groq client
│   │   ├── prompts.ts                # RAG prompts
│   │   └── types.ts                  # LLM types
│   ├── embeddings/
│   │   ├── config.ts                 # Provider config
│   │   └── index.ts                  # Embedding generation
│   ├── weaviate/
│   │   ├── client.ts                 # Weaviate client
│   │   ├── schema.ts                 # Collection schemas
│   │   └── vectors.ts                # Vector operations
│   ├── supabase/
│   │   ├── server.ts                 # Server client
│   │   └── types.ts                  # Database types
│   ├── processing/
│   │   ├── chunker.ts                # Text chunking
│   │   └── processor.ts              # Document processing
│   ├── rateLimit/
│   │   ├── index.ts                  # Rate limiter
│   │   └── middleware.ts             # Rate limit middleware
│   └── analytics/
│       └── index.ts                  # Analytics tracking
└── middleware.ts                     # Clerk middleware
```

---

## 📸 Screenshots

### Chat Interface
*AI-powered conversations with source citations*

### Document Management
*Upload, process, and manage your knowledge base*

### Semantic Search
*Find relevant information using natural language*

### Analytics Dashboard
*Track usage patterns and popular documents*

---

## 🔮 Future Enhancements

- [ ] **Dark Mode** - Full dark theme support
- [ ] **Export Chats** - Download conversations as PDF/Markdown
- [ ] **Document Preview** - In-app document viewer
- [ ] **Batch Upload** - Upload multiple files at once
- [ ] **Folder Organization** - Organize documents into folders
- [ ] **Collaborative Sharing** - Share documents with team members
- [ ] **Custom Prompts** - User-defined system prompts
- [ ] **Webhook Integration** - Connect to external services
- [ ] **Mobile App** - React Native companion app

---

## 📚 What I Learned

Building this project provided hands-on experience with:

### AI/ML Concepts
- **RAG Architecture** - Combining retrieval systems with generative AI
- **Vector Embeddings** - Converting text to semantic representations
- **Semantic Search** - Finding relevant content by meaning, not keywords
- **LLM Prompt Engineering** - Crafting effective prompts for accurate responses
- **Chunking Strategies** - Optimal document segmentation for retrieval

### Full-Stack Development
- **Next.js 14 App Router** - Server components, streaming, and API routes
- **Real-time Streaming** - Server-sent events for token-by-token responses
- **Multi-tenant Architecture** - Data isolation in shared infrastructure
- **Rate Limiting** - Protecting APIs from abuse
- **File Processing** - Handling uploads, storage, and text extraction

### Database & Infrastructure
- **Vector Databases** - Weaviate for similarity search
- **PostgreSQL with RLS** - Row-level security for data isolation
- **Supabase Storage** - Secure file storage with policies
- **Authentication** - Clerk integration and webhook sync

---

## 🙏 Acknowledgments

- [Vercel](https://vercel.com) for Next.js
- [Clerk](https://clerk.com) for authentication
- [Supabase](https://supabase.com) for database and storage
- [Weaviate](https://weaviate.io) for vector search
- [Groq](https://groq.com) for LLM inference
- [Voyage AI](https://voyage.ai) for embeddings
- [HuggingFace](https://huggingface.co) for open-source models

---

