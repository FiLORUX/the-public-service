# System Architecture

> **The Public Service Production Toolkit**
> Version: 2.0.0 | Last Updated: January 2026

---

## System Overview

The Public Service toolkit implements a hybrid cloud architecture designed for broadcast production environments. The system prioritises reliability, real-time synchronisation, and offline resilience whilst maintaining zero operational costs through strategic use of free-tier services.

```
                                    THE PUBLIC SERVICE
                              Production System Architecture
    ═══════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                           USER INTERFACE LAYER                           │
    │                                                                          │
    │   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐             │
    │   │               │   │               │   │               │             │
    │   │ Google Sheets │   │  Studio PWA   │   │   Companion   │             │
    │   │               │   │    (iPad)     │   │  (StreamDeck) │             │
    │   │  ┌─────────┐  │   │  ┌─────────┐  │   │  ┌─────────┐  │             │
    │   │  │  Edit   │  │   │  │ Touch   │  │   │  │ Buttons │  │             │
    │   │  │  View   │  │   │  │  View   │  │   │  │  HTTP   │  │             │
    │   │  │  Share  │  │   │  │ Offline │  │   │  │  Macro  │  │             │
    │   │  └─────────┘  │   │  └─────────┘  │   │  └─────────┘  │             │
    │   │               │   │               │   │               │             │
    │   └───────┬───────┘   └───────┬───────┘   └───────┬───────┘             │
    │           │                   │                   │                      │
    └───────────┼───────────────────┼───────────────────┼──────────────────────┘
                │                   │                   │
                │ Apps Script       │ WebSocket         │ REST API
                │ onEdit Trigger    │ (Supabase         │ (HTTPS)
                │                   │  Realtime)        │
                ▼                   ▼                   ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                                                                          │
    │                        CLOUDFLARE WORKER                                 │
    │                         Sync & API Layer                                 │
    │                                                                          │
    │   ┌─────────────────────────────────────────────────────────────────┐   │
    │   │                                                                  │   │
    │   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │   │
    │   │  │Validation│  │ Conflict │  │   Rate   │  │    Webhook       │ │   │
    │   │  │   Layer  │  │ Resolver │  │ Limiter  │  │   Dispatcher     │ │   │
    │   │  │          │  │          │  │          │  │                  │ │   │
    │   │  │ • Schema │  │ • Version│  │ • 60/min │  │ • Sheets notify  │ │   │
    │   │  │ • Types  │  │ • Merge  │  │ • Client │  │ • PWA push       │ │   │
    │   │  │ • Bounds │  │ • Force  │  │ • Burst  │  │ • Audit log      │ │   │
    │   │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │   │
    │   │                                                                  │   │
    │   └─────────────────────────────────────────────────────────────────┘   │
    │                                                                          │
    │   Endpoints:  POST /sync    POST /api/tc_in    GET /api/posts           │
    │               POST /webhook POST /api/tc_out   GET /api/schedule        │
    │                                                                          │
    └─────────────────────────────────┬────────────────────────────────────────┘
                                      │
                                      │ PostgreSQL Wire Protocol
                                      │ (Service Role Key)
                                      │
                                      ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                                                                          │
    │                            SUPABASE                                      │
    │                     PostgreSQL Database Layer                            │
    │                                                                          │
    │   ┌─────────────────────────────────────────────────────────────────┐   │
    │   │                                                                  │   │
    │   │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │   │
    │   │  │            │  │            │  │            │  │            │ │   │
    │   │  │   posts    │  │   people   │  │  programs  │  │ audit_log  │ │   │
    │   │  │            │  │            │  │            │  │            │ │   │
    │   │  │ • version  │  │ • roles    │  │ • metadata │  │ • history  │ │   │
    │   │  │ • status   │  │ • contact  │  │ • schedule │  │ • changes  │ │   │
    │   │  │ • timecode │  │ • type     │  │ • target   │  │ • actor    │ │   │
    │   │  │            │  │            │  │            │  │            │ │   │
    │   │  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │   │
    │   │                                                                  │   │
    │   └─────────────────────────────────────────────────────────────────┘   │
    │                                                                          │
    │   Features:  • ACID Transactions    • Row Level Security (RLS)          │
    │              • Realtime WebSocket   • Automatic Audit Triggers          │
    │              • Optimistic Locking   • Full-text Search                  │
    │                                                                          │
    └─────────────────────────────────────────────────────────────────────────┘

    ═══════════════════════════════════════════════════════════════════════════
```

---

## Component Descriptions

### 1. Google Sheets (Primary User Interface)

| Attribute      | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| **Role**       | Primary editing interface, team collaboration, mobile access |
| **Technology** | Google Sheets with Apps Script (ES6+)                        |
| **Deployment** | Google Workspace                                             |

**Key Features:**

- Familiar spreadsheet interface requiring no training
- Real-time collaboration with multiple editors
- Native mobile support (iOS/Android)
- Zero licensing costs
- Offline editing capability (syncs when reconnected)
- Custom menus and dialogues via Apps Script

**Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│                    GOOGLE SHEETS                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐      ┌──────────────────────────┐ │
│  │  Database Layer  │      │      View Layer          │ │
│  │   (Hidden)       │      │      (Visible)           │ │
│  │                  │      │                          │ │
│  │  _DB_Posts       │ ───► │  Program 1-4            │ │
│  │  _DB_People      │      │  Recording Schedule     │ │
│  │  _DB_Programs    │      │  Overview Dashboard     │ │
│  │  _DB_PostTypes   │      │  Credits List           │ │
│  │  _DB_Audit       │      │                          │ │
│  │  _DB_Settings    │      │  (QUERY formulae        │ │
│  │                  │      │   generate views)       │ │
│  └──────────────────┘      └──────────────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │               Apps Script Modules                 │   │
│  │                                                   │   │
│  │  Config.gs    Database.gs    Views.gs            │   │
│  │  UI.gs        Triggers.gs    Sync.gs             │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### 2. Cloudflare Worker (Synchronisation Layer)

| Attribute      | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| **Role**       | API gateway, validation, conflict resolution, webhook dispatch |
| **Technology** | Cloudflare Workers (TypeScript, ES2023)                        |
| **Deployment** | Cloudflare Edge Network (global)                               |

**Key Features:**

- Sub-50ms latency globally via edge deployment
- Schema validation before database writes
- Optimistic locking with conflict resolution
- Rate limiting (60 requests/minute per client)
- Webhook dispatch to Google Sheets
- Request transformation (Sheets ↔ Supabase formats)

**API Surface:**

```
┌─────────────────────────────────────────────────────────┐
│                 CLOUDFLARE WORKER API                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │                  GET Endpoints                   │    │
│  │                                                  │    │
│  │  /api/status      System health check (public)  │    │
│  │  /api/posts       Get posts by programme        │    │
│  │  /api/schedule    Get recording schedule        │    │
│  │  /api/post        Get single post by ID         │    │
│  │  /api/current     Get currently recording post  │    │
│  │                                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │                 POST Endpoints                   │    │
│  │                                                  │    │
│  │  /sync            Bi-directional sync           │    │
│  │  /api/tc_in       Log timecode IN               │    │
│  │  /api/tc_out      Log timecode OUT              │    │
│  │  /api/status      Update post status            │    │
│  │  /webhook         Receive external events       │    │
│  │                                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Authentication: API key (header or query parameter)    │
│  Rate Limit: 60 req/min per client_id                   │
│  Response: JSON with success/error structure            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### 3. Supabase (Source of Truth)

| Attribute      | Description                                                               |
| -------------- | ------------------------------------------------------------------------- |
| **Role**       | Persistent storage, ACID guarantees, real-time subscriptions, audit trail |
| **Technology** | PostgreSQL 15, Supabase Platform                                          |
| **Deployment** | Supabase Cloud (managed)                                                  |

**Key Features:**

- Full ACID transaction support
- Row Level Security (RLS) for multi-tenant isolation
- Realtime subscriptions via WebSocket
- Automatic audit logging via database triggers
- Optimistic locking with version column
- Full-text search capabilities

**Database Schema:**

```
┌─────────────────────────────────────────────────────────┐
│                   SUPABASE SCHEMA                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │                    posts                         │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  id              UUID PRIMARY KEY               │    │
│  │  post_id         TEXT UNIQUE (P1:1, P2:5...)    │    │
│  │  program_nr      INTEGER (1-4)                  │    │
│  │  sort_order      INTEGER                        │    │
│  │  type            TEXT REFERENCES post_types     │    │
│  │  title           TEXT                           │    │
│  │  duration_sec    INTEGER                        │    │
│  │  people_ids      TEXT[]                         │    │
│  │  status          TEXT (planned/recording/...)   │    │
│  │  tc_in           TEXT                           │    │
│  │  tc_out          TEXT                           │    │
│  │  version         INTEGER DEFAULT 1              │◄── Optimistic lock
│  │  created_at      TIMESTAMPTZ                    │    │
│  │  modified_at     TIMESTAMPTZ                    │    │
│  │  deleted_at      TIMESTAMPTZ                    │◄── Soft delete
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │                   audit_log                      │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  id              UUID PRIMARY KEY               │    │
│  │  table_name      TEXT                           │    │
│  │  record_id       UUID                           │    │
│  │  action          TEXT (INSERT/UPDATE/DELETE)    │    │
│  │  old_data        JSONB                          │    │
│  │  new_data        JSONB                          │    │
│  │  actor           TEXT                           │    │
│  │  timestamp       TIMESTAMPTZ                    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Views:  posts_active    (excludes soft-deleted)        │
│          program_stats   (aggregated statistics)        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### 4. Studio PWA (iPad Application)

| Attribute      | Description                              |
| -------------- | ---------------------------------------- |
| **Role**       | Touch-optimised floor manager interface  |
| **Technology** | React, TypeScript, Vite, Supabase Client |
| **Deployment** | Vercel (static hosting)                  |

**Key Features:**

- Progressive Web App with offline capability
- Touch-optimised for iPad use in studio
- Real-time updates via Supabase subscriptions
- Recording timer with visual feedback
- Service worker for offline resilience
- Installable as native app

**Component Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│                     STUDIO PWA                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │                 React Components                 │    │
│  │                                                  │    │
│  │  App.tsx                                        │    │
│  │    ├── Header (programme selector, status)      │    │
│  │    ├── PostList (scrollable, touch-friendly)    │    │
│  │    │     └── PostCard (status, timecode, timer) │    │
│  │    ├── RecordingTimer (large display)           │    │
│  │    └── OfflineIndicator                         │    │
│  │                                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │                  Data Layer                      │    │
│  │                                                  │    │
│  │  Supabase Client                                │    │
│  │    ├── Realtime subscription (posts table)      │    │
│  │    ├── Query hooks (React Query)                │    │
│  │    └── Optimistic updates                       │    │
│  │                                                  │    │
│  │  Service Worker                                 │    │
│  │    ├── Cache-first strategy                     │    │
│  │    ├── Background sync                          │    │
│  │    └── Offline queue                            │    │
│  │                                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Primary Synchronisation Flow

```
═══════════════════════════════════════════════════════════════════════════════
                          SYNCHRONISATION DATA FLOW
═══════════════════════════════════════════════════════════════════════════════

                         SHEETS → SUPABASE (Write Path)
    ─────────────────────────────────────────────────────────────────────────

    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │  User   │    │  Sheets │    │  Apps   │    │ Worker  │    │Supabase │
    │  Edit   │───►│  Cell   │───►│ Script  │───►│  /sync  │───►│  posts  │
    │         │    │         │    │ onEdit  │    │         │    │         │
    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
         │              │              │              │              │
         │              │              │              │              │
    1. User edits  2. onEdit     3. Sync.gs     4. Worker      5. Supabase
       cell in        trigger       builds         validates      writes
       programme      fires         payload        & checks       with
       view                                        version        version++

    ─────────────────────────────────────────────────────────────────────────

                         SUPABASE → SHEETS (Read Path)
    ─────────────────────────────────────────────────────────────────────────

    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │External │    │ Worker  │    │Supabase │    │ Worker  │    │  Sheets │
    │ Client  │───►│  /api   │───►│  posts  │───►│ webhook │───►│ Sync.gs │
    │ (iPad)  │    │         │    │         │    │         │    │         │
    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
         │              │              │              │              │
         │              │              │              │              │
    1. iPad app    2. Worker      3. Supabase   4. Worker      5. Sheets
       sends          routes         saves         calls          receives
       status         to DB          change        Sheets         webhook,
       update                                      webhook        updates cell

═══════════════════════════════════════════════════════════════════════════════
```

### Conflict Resolution Flow

When multiple clients edit the same record simultaneously, the system employs optimistic locking to prevent data loss:

```
═══════════════════════════════════════════════════════════════════════════════
                          CONFLICT RESOLUTION FLOW
═══════════════════════════════════════════════════════════════════════════════

    Timeline ──────────────────────────────────────────────────────────────►

    ┌─────────────┐                                     ┌─────────────┐
    │  Client A   │                                     │  Client B   │
    │  (Sheets)   │                                     │  (iPad)     │
    └──────┬──────┘                                     └──────┬──────┘
           │                                                    │
           │  1. Read post P1:5                                 │
           │     version = 5                                    │  2. Read post P1:5
           │                                                    │     version = 5
           ▼                                                    ▼
    ┌─────────────┐                                     ┌─────────────┐
    │ Local edit: │                                     │ Local edit: │
    │ title =     │                                     │ status =    │
    │ "New Title" │                                     │ "recorded"  │
    └──────┬──────┘                                     └──────┬──────┘
           │                                                    │
           │                                                    │  3. Save first
           │                                                    │     version = 5
           │                                                    ▼
           │                                            ┌─────────────┐
           │                                            │  Supabase   │
           │                                            │  version=6  │◄─── Success
           │                                            └─────────────┘
           │
           │  4. Save second
           │     version = 5 (stale!)
           ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                        WORKER CONFLICT HANDLER                       │
    ├─────────────────────────────────────────────────────────────────────┤
    │                                                                      │
    │  Detected: Client version (5) < Server version (6)                  │
    │                                                                      │
    │  Response: 409 Conflict                                             │
    │                                                                      │
    │  ┌────────────────────────────────────────────────────────────┐     │
    │  │                    Resolution Options                       │     │
    │  │                                                             │     │
    │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │     │
    │  │  │   FORCE     │  │   ACCEPT    │  │       MERGE         │ │     │
    │  │  │   PUSH      │  │   SERVER    │  │   (field-level)     │ │     │
    │  │  │             │  │             │  │                     │ │     │
    │  │  │ Overwrite   │  │ Discard     │  │ title from A       │ │     │
    │  │  │ with my     │  │ my changes  │  │ status from B      │ │     │
    │  │  │ version     │  │             │  │ version = 7        │ │     │
    │  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │     │
    │  │                                                             │     │
    │  └────────────────────────────────────────────────────────────┘     │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
```

### Real-time Subscription Flow

```
═══════════════════════════════════════════════════════════════════════════════
                         REALTIME SUBSCRIPTION FLOW
═══════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────────┐
    │                         SUPABASE REALTIME                            │
    │                                                                      │
    │  ┌─────────────┐      WebSocket       ┌─────────────────────────┐   │
    │  │   posts     │ ─────────────────────►  Connected Clients      │   │
    │  │   table     │      broadcast       │                         │   │
    │  │             │                      │  ┌─────────────────┐    │   │
    │  │  INSERT ────┼──────────────────────┼──►  Studio PWA     │    │   │
    │  │  UPDATE ────┼──────────────────────┼──►  (iPad)         │    │   │
    │  │  DELETE ────┼──────────────────────┼──►                 │    │   │
    │  │             │                      │  └─────────────────┘    │   │
    │  └─────────────┘                      │                         │   │
    │                                       │  ┌─────────────────┐    │   │
    │  Subscription filter:                 │  │  Future:        │    │   │
    │  program_nr = eq.1                    │  │  vMix Data      │    │   │
    │                                       │  │  Source         │    │   │
    │                                       │  └─────────────────┘    │   │
    │                                       │                         │   │
    │                                       └─────────────────────────┘   │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘

    Latency: < 100ms (typical)
    Reconnection: Automatic with exponential backoff
    Offline: Queue changes, replay on reconnection

═══════════════════════════════════════════════════════════════════════════════
```

---

## Security Model

### Authentication Architecture

```
═══════════════════════════════════════════════════════════════════════════════
                          AUTHENTICATION ARCHITECTURE
═══════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────────┐
    │                         SECURITY LAYERS                              │
    ├─────────────────────────────────────────────────────────────────────┤
    │                                                                      │
    │  Layer 1: Transport Security                                        │
    │  ─────────────────────────────                                      │
    │  • All communications over HTTPS/TLS 1.3                            │
    │  • Certificate pinning in PWA                                       │
    │  • Cloudflare edge SSL termination                                  │
    │                                                                      │
    │  Layer 2: API Authentication                                        │
    │  ─────────────────────────────                                      │
    │                                                                      │
    │  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐    │
    │  │  Google Apps   │    │   Cloudflare   │    │    Supabase    │    │
    │  │    Script      │    │    Worker      │    │                │    │
    │  ├────────────────┤    ├────────────────┤    ├────────────────┤    │
    │  │ API_SECRET     │───►│ Validates key  │───►│ service_role   │    │
    │  │ (Script        │    │ from header/   │    │ key (full      │    │
    │  │  Properties)   │    │ query param    │    │ access)        │    │
    │  │                │    │                │    │                │    │
    │  │ Per-client     │    │ Rate limiting  │    │ anon key       │    │
    │  │ keys optional  │    │ per client_id  │    │ (RLS enforced) │    │
    │  └────────────────┘    └────────────────┘    └────────────────┘    │
    │                                                                      │
    │  Layer 3: Database Security (Row Level Security)                    │
    │  ─────────────────────────────────────────────────                  │
    │                                                                      │
    │  ┌─────────────────────────────────────────────────────────────┐   │
    │  │                    SUPABASE RLS POLICIES                     │   │
    │  ├─────────────────────────────────────────────────────────────┤   │
    │  │                                                              │   │
    │  │  Policy: posts_select                                       │   │
    │  │  ────────────────────                                       │   │
    │  │  USING (                                                    │   │
    │  │    auth.role() = 'service_role'                             │   │
    │  │    OR                                                       │   │
    │  │    (auth.role() = 'authenticated' AND deleted_at IS NULL)   │   │
    │  │  )                                                          │   │
    │  │                                                              │   │
    │  │  Policy: posts_insert                                       │   │
    │  │  ─────────────────────                                      │   │
    │  │  WITH CHECK (                                               │   │
    │  │    auth.role() = 'service_role'                             │   │
    │  │  )                                                          │   │
    │  │                                                              │   │
    │  │  Policy: posts_update                                       │   │
    │  │  ─────────────────────                                      │   │
    │  │  USING (auth.role() = 'service_role')                       │   │
    │  │  WITH CHECK (version = old.version + 1)  ◄── Version check  │   │
    │  │                                                              │   │
    │  │  Policy: audit_log_insert                                   │   │
    │  │  ──────────────────────────                                 │   │
    │  │  WITH CHECK (true)  ◄── All actors can write audit         │   │
    │  │                                                              │   │
    │  └─────────────────────────────────────────────────────────────┘   │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
```

### Row Level Security (RLS) Explanation

Row Level Security provides fine-grained access control at the database level, ensuring that even if application-level security is bypassed, unauthorised data access is prevented.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      RLS IN PRACTICE                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Request Flow:                                                          │
│                                                                          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────────────┐  │
│  │ Client  │───►│ Supabase│───►│  RLS    │───►│  Result Set         │  │
│  │ Request │    │ Auth    │    │ Policies│    │  (filtered by RLS)  │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────────────────┘  │
│       │              │              │                   │               │
│       │              │              │                   │               │
│  SELECT * FROM   Extracts     Evaluates           Returns only        │
│  posts           JWT/API key  USING clause       rows matching        │
│                  → role                          policy                │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  Role Hierarchy:                                                        │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  service_role                                                    │   │
│  │  ─────────────                                                   │   │
│  │  • Full database access                                         │   │
│  │  • Bypasses all RLS policies                                    │   │
│  │  • Used by: Cloudflare Worker                                   │   │
│  │  • Secret: SUPABASE_SERVICE_KEY                                 │   │
│  │                                                                  │   │
│  │  authenticated                                                   │   │
│  │  ─────────────                                                   │   │
│  │  • Subject to RLS policies                                      │   │
│  │  • Cannot see soft-deleted records                              │   │
│  │  • Used by: Studio PWA (after auth)                             │   │
│  │                                                                  │   │
│  │  anon                                                            │   │
│  │  ─────                                                           │   │
│  │  • Most restrictive                                             │   │
│  │  • Read-only access to public data                              │   │
│  │  • Used by: Unauthenticated PWA views                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### API Key Management

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       API KEY ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Key Types:                                                             │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  Master Key (API_SECRET)                                        │   │
│  │  ──────────────────────────                                     │   │
│  │  • Stored in: Apps Script Properties, Worker Secrets            │   │
│  │  • Access: Full API access                                      │   │
│  │  • Rotation: Manual, coordinate across all services             │   │
│  │                                                                  │   │
│  │  Client Keys (optional)                                         │   │
│  │  ──────────────────────                                         │   │
│  │  • Generated via: Integration > API Keys menu                   │   │
│  │  • Access: Scoped per client (Companion, vMix, etc.)            │   │
│  │  • Rotation: Per-client, independent                            │   │
│  │                                                                  │   │
│  │  Supabase Keys                                                  │   │
│  │  ──────────────                                                 │   │
│  │  • anon key: Public, safe to embed in PWA                       │   │
│  │  • service_role key: Secret, Worker only                        │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Key Transmission:                                                      │
│                                                                          │
│  GET requests:   ?api_key=sk_live_xxx                                   │
│  POST requests:  {"api_key": "sk_live_xxx", ...}                        │
│  Headers:        Authorization: Bearer sk_live_xxx                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Audit Trail

All data modifications are automatically logged for compliance and debugging:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUDIT TRAIL SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Trigger: AFTER INSERT OR UPDATE OR DELETE ON posts                     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Audit Log Entry                              │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │                                                                  │   │
│  │  {                                                              │   │
│  │    "id": "550e8400-e29b-41d4-a716-446655440000",                │   │
│  │    "table_name": "posts",                                       │   │
│  │    "record_id": "123e4567-e89b-12d3-a456-426614174000",         │   │
│  │    "action": "UPDATE",                                          │   │
│  │    "old_data": {                                                │   │
│  │      "status": "planned",                                       │   │
│  │      "version": 5                                               │   │
│  │    },                                                           │   │
│  │    "new_data": {                                                │   │
│  │      "status": "recording",                                     │   │
│  │      "tc_in": "01:23:45:00",                                    │   │
│  │      "version": 6                                               │   │
│  │    },                                                           │   │
│  │    "actor": "companion:streamdeck-1",                           │   │
│  │    "timestamp": "2026-01-15T14:30:00.000Z"                      │   │
│  │  }                                                              │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Retention: Indefinite (audit_log excluded from soft-delete)            │
│  Query: SELECT * FROM audit_log WHERE record_id = ? ORDER BY timestamp  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
═══════════════════════════════════════════════════════════════════════════════
                          DEPLOYMENT TOPOLOGY
═══════════════════════════════════════════════════════════════════════════════

                              INTERNET
                                 │
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
    ┌─────────┐            ┌─────────┐            ┌─────────┐
    │ Google  │            │Cloudflare│            │  Vercel │
    │Workspace│            │  Edge    │            │   Edge  │
    │         │            │         │            │         │
    │ Sheets  │            │ Worker  │            │  Studio │
    │  Apps   │            │ (global)│            │   PWA   │
    │ Script  │            │         │            │         │
    └────┬────┘            └────┬────┘            └────┬────┘
         │                      │                      │
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                                │ PostgreSQL / WebSocket
                                │
                                ▼
                         ┌─────────────┐
                         │  Supabase   │
                         │   Cloud     │
                         │             │
                         │  (managed   │
                         │   Postgres) │
                         └─────────────┘

    ─────────────────────────────────────────────────────────────────────────

    Cost Summary (Free Tier):
    ┌──────────────────────────────────────────────────────────────────────┐
    │  Service              │  Tier     │  Limits                  │ Cost │
    ├───────────────────────┼───────────┼──────────────────────────┼──────┤
    │  Google Sheets        │  Workspace│  Included                │  £0  │
    │  Cloudflare Workers   │  Free     │  100k req/day            │  £0  │
    │  Supabase             │  Free     │  500MB DB, 2GB bandwidth │  £0  │
    │  Vercel               │  Hobby    │  100GB bandwidth         │  £0  │
    ├───────────────────────┼───────────┼──────────────────────────┼──────┤
    │  TOTAL                │           │                          │  £0  │
    └──────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
```

---

## Integration Points

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL INTEGRATIONS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  Bitfocus Companion                                             │   │
│  │  ─────────────────────                                          │   │
│  │  Protocol: HTTP POST                                            │   │
│  │  Module: Generic HTTP                                           │   │
│  │  Features: TC-IN, TC-OUT, status update, next post              │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │  StreamDeck Button → Companion → HTTP POST → Worker     │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  vMix                                                           │   │
│  │  ─────                                                          │   │
│  │  Protocol: HTTP POST (via vMix Scripting)                       │   │
│  │  Features: Timecode capture, status sync                        │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │  vMix Script → API.HTTPPost → Worker                    │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  BMD HyperDeck                                                  │   │
│  │  ──────────────                                                 │   │
│  │  Protocol: HyperDeck Protocol (via Companion)                   │   │
│  │  Features: Record trigger, clip ID, timecode                    │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │  HyperDeck → Companion HyperDeck Module → HTTP → Worker │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Document History

| Version | Date          | Author   | Changes                                  |
| ------- | ------------- | -------- | ---------------------------------------- |
| 2.0.0   | January 2026  | D. Thast | Complete rewrite for hybrid architecture |
| 1.0.0   | February 2025 | D. Thast | Initial Google Sheets-only architecture  |

---

_Built for broadcast professionals. Designed for reliability._
