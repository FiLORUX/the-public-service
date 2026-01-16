<div align="center">

# The Public Service

[![MIT Licence](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/FiLORUX/the-public-service/actions/workflows/ci.yml/badge.svg)](https://github.com/FiLORUX/the-public-service/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Open-source production toolkit for broadcast workflows**

Build reliable, deterministic systems for live television and media production.

[Quick Start](#quick-start) · [Documentation](#documentation) · [Contributing](#contributing)

</div>

---

## Features

- **Normalised Data Architecture** — Single source of truth with dynamic views
- **Real-time Sync** — Bi-directional synchronisation between Google Sheets and Supabase
- **Edge-First** — Cloudflare Workers for low-latency validation and conflict handling
- **Touch-Optimised Studio View** — React PWA designed for iPad use in production environments
- **API-Ready** — REST endpoints for Companion, HyperDeck, vMix, and custom integrations
- **Broadcast-Grade Reliability** — Built with deterministic behaviour and clear failure modes

---

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   Google Sheets     │     │   Studio PWA        │
│   (Familiar UI)     │     │   (Touch Control)   │
└─────────┬───────────┘     └─────────┬───────────┘
          │                           │
          ▼                           ▼
┌─────────────────────────────────────────────────┐
│              Cloudflare Worker                  │
│         (Validation · Conflict Handling)        │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                   Supabase                      │
│      (PostgreSQL · Realtime · Audit Trail)     │
└─────────────────────────────────────────────────┘
```

---

## Quick Start

### Option 1: Google Sheets Only

1. Create a new Google Sheet at [sheets.google.com](https://sheets.google.com)
2. Open **Extensions > Apps Script**
3. Copy the `.gs` files from this repository
4. Run **System > Bootstrap Database** from the custom menu

See [QUICKSTART.txt](QUICKSTART.txt) for detailed instructions.

### Option 2: Full Stack (Sheets + Supabase + Workers)

```bash
git clone https://github.com/FiLORUX/the-public-service.git
cd the-public-service

# Deploy the sync worker
cd worker
npm install
npx wrangler deploy

# Run the studio app locally
cd ../studio-app
npm install
npm run dev
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment.

---

## Documentation

| Document                                     | Description                          |
| -------------------------------------------- | ------------------------------------ |
| [QUICKSTART.txt](QUICKSTART.txt)             | Get up and running in minutes        |
| [ARCHITECTURE-2026.md](ARCHITECTURE-2026.md) | System design and data flow          |
| [API.md](API.md)                             | REST endpoint reference              |
| [DEPLOYMENT.md](DEPLOYMENT.md)               | Production deployment guide          |
| [FAQ.md](FAQ.md)                             | Common questions and troubleshooting |

---

## Built With

| Component    | Technology                                |
| ------------ | ----------------------------------------- |
| Data Layer   | Google Apps Script, Supabase (PostgreSQL) |
| Edge API     | Cloudflare Workers, TypeScript            |
| Studio App   | React 18, Vite, PWA                       |
| Integrations | Bitfocus Companion, BMD HyperDeck, vMix   |

---

## Contributing

Contributions are welcome. Please read the existing code to understand the conventions, then submit a pull request.

```bash
# Clone and set up
git clone https://github.com/FiLORUX/the-public-service.git
cd the-public-service

# For Apps Script development
npm install -g @google/clasp
clasp push

# For Worker development
cd worker && npm run dev

# For Studio App development
cd studio-app && npm run dev
```

---

## Licence

[MIT](LICENSE) — use freely, modify freely, contribute back if you can.

---

## Acknowledgements

- The broadcast engineering community for decades of battle-tested patterns
- EBU Technical for standards that make reliable systems possible
- Everyone who believes publicly funded work should remain publicly accessible

---

<div align="center">

**Built for broadcast professionals**

</div>
