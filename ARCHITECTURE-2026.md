# SVT Gudstjänst - Arkitektur 2026

Modern hybrid-arkitektur som behåller Google Sheets som primärt UI medan Supabase (PostgreSQL) hanterar data som source of truth.

## Översikt

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ANVÄNDARGRÄNSSNITT                             │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  Google Sheets  │   iPad Studio   │    Companion    │      vMix/ATEM        │
│  (SVT-delning,  │   (PWA för      │   (TC-kontroll) │   (Videoproduktion)   │
│   mobil, iPad)  │   studioman)    │                 │                       │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                    │
         │ onEdit trigger  │ Supabase        │ HTTP API           │
         │                 │ Realtime        │                    │
         ▼                 ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE WORKER                                   │
│  - Validering & transformation                                              │
│  - Konflikthantering (optimistic locking)                                   │
│  - Rate limiting                                                            │
│  - Webhook dispatch                                                         │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SUPABASE                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    posts     │  │   people     │  │  programs    │  │  audit_log   │     │
│  │  (ACID, RLS) │  │              │  │              │  │  (historik)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                                             │
│  - PostgreSQL med full ACID                                                 │
│  - Row Level Security (RLS)                                                 │
│  - Automatisk audit via triggers                                            │
│  - Realtime subscriptions (WebSocket)                                       │
│  - Optimistic locking (version column)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Komponenter

### 1. Google Sheets (UI + Delning)
- **Roll**: Primärt användargränssnitt, SVT-delning, mobil access
- **Fördelar**: Alla känner till det, fungerar på alla enheter, gratis
- **Sync**: `onEdit` trigger → Cloudflare Worker → Supabase

### 2. Supabase (Source of Truth)
- **Roll**: Datalagring med ACID-garantier, historik, realtime
- **Schema**: `supabase/schema.sql`
- **Features**:
  - `version` kolumn för optimistic locking
  - `audit_log` tabell fylls automatiskt via triggers
  - `posts_active` view exkluderar soft-deleted poster
  - `program_stats` view för snabb statistik
  - Realtime enabled för live-uppdateringar

### 3. Cloudflare Worker (Sync Layer)
- **Roll**: Mellanhand för all synkronisering
- **Funktioner**:
  - Validering av inkommande data
  - Konfliktdetektering och -lösning
  - Rate limiting
  - Transformation mellan Sheets ↔ Supabase format
- **Deployment**: `worker/` katalog

### 4. iPad Studio PWA
- **Roll**: Optimerad vy för studioman
- **Features**:
  - Touch-optimerat gränssnitt
  - Realtime via Supabase subscriptions
  - Offline-kapabel via service worker
  - Timer för inspelning
- **Deployment**: `studio-app/` → Vercel/Netlify

## Dataflöde

### Sheets → Supabase
```
1. Användare ändrar cell i Sheets
2. onEdit trigger körs
3. Sync.gs skickar till Cloudflare Worker
4. Worker validerar, kollar version
5. Om konflikt: returnerar 409, visar dialog
6. Om OK: sparar till Supabase
7. Supabase trigger loggar till audit_log
```

### Supabase → Sheets
```
1. Extern klient (Studio, Companion) ändrar data
2. Worker validerar och sparar till Supabase
3. Worker anropar Sheets webhook
4. Sync.gs tar emot, uppdaterar cell
```

### Konflikthantering
```
1. Klient A läser post (version=5)
2. Klient B läser samma post (version=5)
3. Klient B sparar ändring → version=6
4. Klient A försöker spara → 409 Conflict
5. Klient A får val:
   - Behåll min version (force push)
   - Använd server-version
   - Slå ihop (senaste per fält)
```

## Setup-guide

### Steg 1: Supabase
```bash
# 1. Skapa projekt på supabase.com

# 2. Kör schema
# Gå till SQL Editor, klistra in supabase/schema.sql

# 3. Notera credentials
# - Project URL: https://xxx.supabase.co
# - anon key: eyJ...
# - service_role key: eyJ... (för Worker)
```

### Steg 2: Cloudflare Worker
```bash
cd worker

# Installera dependencies
npm install

# Konfigurera secrets
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put SHEETS_WEBHOOK_SECRET

# Deploya
npm run deploy

# Notera URL: https://svt-gudstjanst-sync.xxx.workers.dev
```

### Steg 3: Google Sheets
```
1. Öppna Apps Script (Extensions > Apps Script)

2. Lägg till Sync.gs

3. Konfigurera Script Properties:
   - SYNC_WORKER_URL = <Worker URL>
   - SYNC_WEBHOOK_SECRET = <samma som i Worker>
   - SYNC_ENABLED = true

4. Kör syncProgramToSupabase(1) för initial sync
```

### Steg 4: iPad Studio PWA
```bash
cd studio-app

# Installera dependencies
npm install

# Skapa .env från .env.example
cp .env.example .env
# Fyll i VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY

# Kör lokalt
npm run dev

# Bygg för produktion
npm run build

# Deploya till Vercel
vercel
```

## Kostnader

| Tjänst | Kostnad | Inkluderat |
|--------|---------|------------|
| Supabase Free | 0 kr/mån | 500 MB databas, 2 GB bandbredd, unlimited API |
| Cloudflare Workers Free | 0 kr/mån | 100k requests/dag |
| Vercel Free | 0 kr/mån | 100 GB bandbredd, unlimited deploys |
| Google Sheets | 0 kr/mån | Ingår i Workspace |

**Total: 0 kr/mån**

## Migrationsplan

### Vecka 1: Databas
- [ ] Skapa Supabase-projekt
- [ ] Kör schema.sql
- [ ] Verifiera att allt skapats korrekt

### Vecka 2: Worker
- [ ] Deploya Cloudflare Worker
- [ ] Konfigurera secrets
- [ ] Testa /health endpoint

### Vecka 3: Sheets-integration
- [ ] Lägg till Sync.gs
- [ ] Konfigurera Script Properties
- [ ] Kör initial sync för alla program

### Vecka 4: iPad-vy
- [ ] Deploya Studio PWA till Vercel
- [ ] Testa på iPad
- [ ] Optimera för produktionsmiljö

### Vecka 5: Produktion
- [ ] Full produktionstest
- [ ] Utbilda användare
- [ ] Gå live

## Framtida förbättringar

1. **Offline-first i Sheets**: Service worker för Sheets-liknande offline-funktion
2. **Push-notifikationer**: Notifiera vid TC_IN/TC_OUT via PWA
3. **Companion-plugin**: Native integration istället för HTTP
4. **vMix Data Source**: Direkt SQL-koppling till Supabase
5. **Analytics dashboard**: Historisk statistik i Supabase Studio

## Filer i detta repo

```
svt-gudstjanst/
├── supabase/
│   └── schema.sql          # PostgreSQL schema med triggers
├── worker/
│   ├── src/index.ts        # Cloudflare Worker
│   ├── package.json
│   └── wrangler.toml
├── studio-app/
│   ├── src/
│   │   ├── App.tsx         # Huvud-komponent
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
├── Sync.gs                  # Apps Script sync-modul
├── Config.gs
├── Database.gs
├── Triggers.gs
├── UI.gs
├── Views.gs
└── ARCHITECTURE-2026.md     # Denna fil
```
