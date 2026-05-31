# TasteTest

TasteTest is a generic adaptive swipe-based data collection system. Enter any natural language task — movie recommendations, personality inference, music taste, startup ideas — and swipe through AI-generated cards to teach the system what you like. When you're ready, get a personalized final answer.

## Stack

- **Next.js** (App Router) + TypeScript
- **Tailwind CSS**
- **Prisma** + PostgreSQL
- **OpenAI API** (structured JSON outputs via Zod)
- Vercel-compatible architecture

## Prerequisites

- Node.js 20+
- PostgreSQL database (local or hosted, e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com))
- OpenAI API key

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and fill in your values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | PostgreSQL connection string |
   | `OPENAI_API_KEY` | Your OpenAI API key |
   | `OPENAI_MODEL` | Fast model for task spec and card batches (default: `gpt-5.4-mini`) |
   | `OPENAI_DIMENSION_MODEL` | Smarter model for inference dimensions/state (default: `gpt-5.1`) |
   | `OPENAI_FINAL_MODEL` | Smarter model for the final answer (default: `gpt-5.1`) |

3. **Set up the database**

   ```bash
   npm run db:push
   ```

   Or use migrations for production:

   ```bash
   npm run db:migrate
   ```

4. **Run locally**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## How it works

1. Enter a natural language task on the home page.
2. OpenAI creates a **task spec** defining what positive/negative/neutral mean for your task.
3. The system generates 5 swipe cards tailored to your goal.
4. You respond to each card (buttons or arrow keys).
5. When ≤2 unanswered cards remain, the next batch of 5 is generated automatically using your response history.
6. After 10+ responses, click **Get my answer** to receive a final result.

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add environment variables: `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_DIMENSION_MODEL`, `OPENAI_FINAL_MODEL`.
3. Use a hosted PostgreSQL provider (Neon recommended).
4. Run `prisma migrate deploy` in your build step, or use `db push` for prototyping.

Add to `package.json` build script or Vercel build settings:

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

## Project structure

```
src/
  app/
    page.tsx                          # Home
    sessions/[id]/page.tsx            # Swipe session
    sessions/[id]/results/page.tsx      # Final answer
    api/                              # REST API routes
  components/                         # UI components
  lib/
    prisma.ts                         # Prisma client
    openai.ts                         # LLM functions
    tasteTestSchemas.ts               # Zod schemas
    tasteTestPrompts.ts               # Prompt templates
    sessionService.ts                 # Session logic
    generationService.ts              # Batch generation + concurrency
prisma/
  schema.prisma                       # Database schema
```

## API routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/sessions` | Create session + first batch |
| GET | `/api/sessions/[id]` | Get session state |
| POST | `/api/responses` | Save a swipe response |
| POST | `/api/sessions/[id]/generate-batch` | Manually trigger/retry batch |
| POST | `/api/sessions/[id]/finalize` | Generate final answer |

## License

MIT
