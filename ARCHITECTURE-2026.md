# Architecture 2026

A modern hybrid architecture that retains Google Sheets as the primary user interface whilst Supabase (PostgreSQL) serves as the source of truth.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                 │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  Google Sheets  │   iPad Studio   │    Companion    │      vMix/ATEM        │
│  (sharing,      │   (PWA for      │   (TC control)  │   (video production)  │
│   mobile, iPad) │   floor manager)│                 │                       │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                    │
         │ onEdit trigger  │ Supabase        │ HTTP API           │
         │                 │ Realtime        │                    │
         ▼                 ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE WORKER                                   │
│  - Validation and transformation                                            │
│  - Conflict handling (optimistic locking)                                   │
│  - Rate limiting                                                            │
│  - Webhook dispatch                                                         │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SUPABASE                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    posts     │  │   people     │  │  programs    │  │  audit_log   │     │
│  │  (ACID, RLS) │  │              │  │              │  │  (history)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                                             │
│  - PostgreSQL with full ACID guarantees                                     │
│  - Row Level Security (RLS)                                                 │
│  - Automatic audit via triggers                                             │
│  - Realtime subscriptions (WebSocket)                                       │
│  - Optimistic locking (version column)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Google Sheets (UI + Sharing)

- **Role:** Primary user interface, team sharing, mobile access
- **Advantages:** Familiar interface, works on all devices, zero cost
- **Sync:** `onEdit` trigger → Cloudflare Worker → Supabase

### 2. Supabase (Source of Truth)

- **Role:** Data storage with ACID guarantees, history, realtime
- **Schema:** `supabase/schema.sql`
- **Features:**
  - `version` column for optimistic locking
  - `audit_log` table populated automatically via triggers
  - `posts_active` view excludes soft-deleted posts
  - `program_stats` view for rapid statistics
  - Realtime enabled for live updates

### 3. Cloudflare Worker (Sync Layer)

- **Role:** Intermediary for all synchronisation
- **Functions:**
  - Validation of incoming data
  - Conflict detection and resolution
  - Rate limiting
  - Transformation between Sheets ↔ Supabase formats
- **Deployment:** `worker/` directory

### 4. iPad Studio PWA

- **Role:** Optimised view for floor manager
- **Features:**
  - Touch-optimised interface
  - Realtime via Supabase subscriptions
  - Offline-capable via service worker
  - Recording timer
- **Deployment:** `studio-app/` → Vercel/Netlify

## Data Flow

### Sheets → Supabase

```
1. User modifies cell in Sheets
2. onEdit trigger fires
3. Sync.gs sends to Cloudflare Worker
4. Worker validates, checks version
5. If conflict: returns 409, displays dialogue
6. If OK: saves to Supabase
7. Supabase trigger logs to audit_log
```

### Supabase → Sheets

```
1. External client (Studio, Companion) modifies data
2. Worker validates and saves to Supabase
3. Worker calls Sheets webhook
4. Sync.gs receives, updates cell
```

### Conflict Handling

```
1. Client A reads post (version=5)
2. Client B reads same post (version=5)
3. Client B saves change → version=6
4. Client A attempts save → 409 Conflict
5. Client A receives options:
   - Keep my version (force push)
   - Use server version
   - Merge (latest per field)
```

## Setup Guide

### Step 1: Supabase

```bash
# 1. Create project at supabase.com

# 2. Run schema
# Navigate to SQL Editor, paste supabase/schema.sql

# 3. Note credentials
# - Project URL: https://xxx.supabase.co
# - anon key: eyJ...
# - service_role key: eyJ... (for Worker)
```

### Step 2: Cloudflare Worker

```bash
cd worker

# Install dependencies
npm install

# Configure secrets
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put SHEETS_WEBHOOK_SECRET

# Deploy
npm run deploy

# Note URL: https://gudstjanst-sync.xxx.workers.dev
```

### Step 3: Google Sheets

```
1. Open Apps Script (Extensions > Apps Script)

2. Add Sync.gs

3. Configure Script Properties:
   - SYNC_WORKER_URL = <Worker URL>
   - SYNC_WEBHOOK_SECRET = <same as in Worker>
   - SYNC_ENABLED = true

4. Run syncProgramToSupabase(1) for initial sync
```

### Step 4: iPad Studio PWA

```bash
cd studio-app

# Install dependencies
npm install

# Create .env from .env.example
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Run locally
npm run dev

# Build for production
npm run build

# Deploy to Vercel
vercel
```

## Costs

| Service | Cost | Included |
|---------|------|----------|
| Supabase Free | £0/month | 500 MB database, 2 GB bandwidth, unlimited API |
| Cloudflare Workers Free | £0/month | 100k requests/day |
| Vercel Free | £0/month | 100 GB bandwidth, unlimited deploys |
| Google Sheets | £0/month | Included in Workspace |

**Total: £0/month**

## Migration Plan

### Week 1: Database

- [ ] Create Supabase project
- [ ] Run schema.sql
- [ ] Verify all tables created correctly

### Week 2: Worker

- [ ] Deploy Cloudflare Worker
- [ ] Configure secrets
- [ ] Test /health endpoint

### Week 3: Sheets Integration

- [ ] Add Sync.gs
- [ ] Configure Script Properties
- [ ] Run initial sync for all programmes

### Week 4: iPad View

- [ ] Deploy Studio PWA to Vercel
- [ ] Test on iPad
- [ ] Optimise for production environment

### Week 5: Production

- [ ] Full production test
- [ ] Train users
- [ ] Go live

## Future Improvements

1. **Offline-first in Sheets:** Service worker for Sheets-like offline functionality
2. **Push notifications:** Notify on TC_IN/TC_OUT via PWA
3. **Companion plugin:** Native integration instead of HTTP
4. **vMix Data Source:** Direct SQL connection to Supabase
5. **Analytics dashboard:** Historical statistics in Supabase Studio

## Files in This Repository

```
the-public-service/
├── supabase/
│   └── schema.sql          # PostgreSQL schema with triggers
├── worker/
│   ├── src/index.ts        # Cloudflare Worker
│   ├── package.json
│   └── wrangler.toml
├── studio-app/
│   ├── src/
│   │   ├── App.tsx         # Main component
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
├── Sync.gs                  # Apps Script sync module
├── Config.gs
├── Database.gs
├── Triggers.gs
├── UI.gs
├── Views.gs
└── ARCHITECTURE-2026.md     # This file
```
