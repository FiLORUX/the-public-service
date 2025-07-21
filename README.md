# Gudstjänst – Open Production Toolkit

This repository contains tooling, workflows and reference implementations developed in close proximity to Swedish public service production practices.

The project was built to be practical, transparent and transferable — prioritising robustness, editorial clarity and long-term maintainability over short-term optimisation.

It is now released publicly, in full, to ensure that the knowledge, patterns and solutions developed here remain accessible beyond any single production, contract or organisational context.

---

## Why This Is Public

Public service production depends on continuity of knowledge, not ownership of tooling.

Broadcasting workflows are cumulative by nature: they improve when patterns are shared, scrutinised and iterated across teams, generations and vendors.

Releasing this repository publicly is therefore not a gesture, but a practical decision — aligned with the idea that publicly funded competence should, when possible, result in publicly accessible reference material.

---

## Philosophy

This system follows broadcast standards: **deterministic**, **reliable**, **legible under pressure**.

### Architectural Principles

1. **Normalised database** – Single source of truth in hidden sheets
2. **Dynamic views** – Presentation layer generated via QUERY formulae
3. **Separation of concerns** – Data ≠ Presentation
4. **Future-proof** – Prepared for API integration (Companion/BMD/vMix)
5. **Git-friendly** – Exportable to JSON for version control

---

## Components

### Database Layer (hidden sheets, prefix `_DB_`)

| Sheet | Purpose |
|-------|---------|
| `_DB_Posts` | Master registry for all posts (all programmes) |
| `_DB_Personer` | Registry of contributors and crew |
| `_DB_Program` | Metadata for the 4 programmes per recording location |
| `_DB_PostTyper` | Templates for post types (sermon, hymn, etc.) |
| `_DB_Logg` | Timecode logging (append-only) |
| `_DB_Settings` | System settings |
| `_DB_Audit` | Audit log (who changed what and when) |
| `_DB_Trash` | Soft-deleted posts (recoverable) |

### View Layer (visible sheets)

| Sheet | Purpose |
|-------|---------|
| `Program 1–4` | One sheet per programme |
| `Inspelningsschema` | Aggregated view across all programmes, sorted by day/time |
| `Översikt` | Dashboard with statistics |
| `Kreditlista` | Auto-generated from `_DB_Personer` |

### Apps Script Files

| File | Responsibility |
|------|----------------|
| `Config.gs` | Constants, schema definitions, utility functions |
| `Database.gs` | All CRUD logic, database operations, caching, archiving |
| `Views.gs` | View generation, QUERY formulae |
| `UI.gs` | Menus, dialogues, user interaction |
| `Triggers.gs` | Event handlers, API webhooks, rate limiting |
| `Sync.gs` | Bi-directional synchronisation with external databases |

---

## Installation

### 1. Create a New Google Sheet

1. Navigate to https://sheets.google.com
2. Create a new spreadsheet
3. Name it appropriately (e.g., "Church Service Production – VENUE 2025")

### 2. Open the Apps Script Editor

```
Extensions > Apps Script
```

### 3. Copy the Script Files

1. Delete the default `Code.gs`
2. Create 6 new files:
   - `Config.gs`
   - `Database.gs`
   - `Views.gs`
   - `UI.gs`
   - `Triggers.gs`
   - `Sync.gs`
3. Copy the code from each corresponding file in this repository
4. Save the project (Ctrl+S)

### 4. Bootstrap the Database

1. Close the Script Editor and return to the spreadsheet
2. Reload the page (F5) so the custom menu appears
3. Select: **System > Bootstrap Database**
4. Confirm the prompt
5. Wait 10–20 seconds

### 5. Generate Views

```
System > Generate All Views
```

**Complete.** You now have a fully functional installation.

---

## User Guide

### Initial Setup

#### 1. Configure Programme Metadata

```
Settings > Edit Programme Metadata
```

For each programme (1–4), enter:
- Location (venue name)
- Recording start date
- Broadcast date
- Liturgical season (e.g., "Second Sunday in Lent")
- Production number
- Target duration (seconds; default 2610 = 43:30)
- Day 1 start time (e.g., "09:00:00")

#### 2. Add Contributors

```
People > Add Person
```

- Enter name, roles, contact information
- Types: contributor, crew, composer, lyricist

### Creating Posts

#### Via Menu (recommended)

```
Posts > Add New Post
```

A dialogue opens where you enter:
- **Programme** (1–4)
- **Post type** (select from dropdown — default duration is set automatically)
- **Content** (main text)
- **Contributors** (comma-separated; new names are created automatically)
- **Location** (dropdown)
- **Recording day** (Day 1/2/3)
- **Notes**

#### Directly in Programme View

You may also edit directly in the Programme 1–4 views:
- Cell changes update the database automatically
- Dropdowns for type, location, day, status
- Rolling time is calculated automatically

### Post Types (default templates)

| Type | Icon | Default Duration | Description |
|------|------|------------------|-------------|
| **Sermon** | 🎤 | 7:00 | Main sermon |
| **Scripture Reading** | 📖 | 1:30 | Bible reading |
| **Hymn (choir)** | 🎼 | 3:00 | Choral piece |
| **Hymn (solo)** | 🎵 | 2:30 | Solo vocal |
| **Organ** | 🎹 | 2:00 | Instrumental |
| **Liturgy** | ✝️ | 0:45 | Kyrie, Agnus Dei, etc. |
| **Intercession** | 🙏 | 2:00 | Congregational prayer |
| **Info segment** | 🎥 | 1:00 | Short segment |
| **Theme presentation** | 📺 | 2:30 | Longer presentation |
| **Interstitial** | ⏸️ | 0:30 | Technical pause |
| **Benediction** | 🙌 | 0:45 | Closing blessing |

**Customise:**
```
Settings > Edit Post Types
```

Add custom types with your own default values, colours and icons.

### Recording Schedule

Navigate to the `Inspelningsschema` sheet to view:
- **All posts from all programmes** aggregated
- Sorted by **Day** → **Time**
- Colour-coded by status

This is the primary view used during recording sessions.

### Status Tracking

#### Status Values

| Status | Colour | Meaning |
|--------|--------|---------|
| Planned | White | Not yet recorded |
| Recording | Yellow | Currently being recorded |
| Recorded | Light green | Recording complete |
| Approved | Dark green | Approved for broadcast |

#### Updating Status

1. **Manually:** Change the status column directly in the view
2. **Via menu:** Select a row, then `Production > Mark Post as Recorded`
3. **Via API:** Automatic updates from Companion or other integrations

---

## API Integration

The system includes a full REST API for integration with broadcast control systems.

### Supported Integrations

- **Bitfocus Companion** (Stream Deck automation)
- **Blackmagic Design HyperDeck** (deck control)
- **vMix** (video mixing software)
- **Any HTTP client**

### Deployment

```
Deploy > New Deployment > Web App
```

See [API.md](API.md) for complete endpoint documentation.

### Security

API authentication is configured via Script Properties:
- `API_SECRET` – Master key for all access
- Client-specific keys can be generated via **Integration > API Keys**

---

## Advanced Usage

### Export to JSON (for version control)

```
System > Backup to JSON
```

Copies the entire database to JSON format. Save to your repository:
```
data/backup_2025-01-01.json
```

### Show/Hide Database Sheets

```
System > Show Database Sheets
```

For manual editing or debugging. **Use with care** — these sheets are the single source of truth.

### Renumber Posts

```
Posts > Renumber All Posts
```

Ensures post IDs are sequential (P1:1, P1:2, P1:3...).

### Soft Delete and Recovery

Deleted posts are moved to a recycle bin (`_DB_Trash`) and can be recovered:
```
Posts > Recycle Bin > View Deleted Posts
```

### Archiving

Complete programmes can be archived to Google Drive:
```
Settings > Archive > Archive Programme 1
```

Archives are stored as JSON files in a `Gudstjänst_Arkiv` folder.

---

## Data Model

### Post (primary entity)

```javascript
{
  post_id: "P1:10",              // Programme 1, Post 10
  program_nr: 1,                 // 1–4
  sort_order: 10,                // For ordering
  type: "predikan",              // Post type key
  title: "Sermon on Hope",       // Main content
  duration_sec: 420,             // 7 minutes
  people_ids: "P001,P002",       // Comma-separated
  location: "pulpit",
  info_pos: "Camera 1, close-up",
  graphics: "Name lower third",
  notes: "Additional lighting required",
  recording_day: "dag1",         // dag1/dag2/dag3
  recording_time: "09:15:00",    // Calculated
  status: "planerad",            // planerad/recording/inspelad/godkänd
  text_author: "",               // For music
  composer: "",                  // For music
  arranger: "",                  // For music
  open_text: false,              // Show in extended view?
  created: "2025-02-01T09:30:00Z",
  modified: "2025-02-02T15:20:00Z"
}
```

### Person

```javascript
{
  person_id: "P001",
  name: "Namn Namnsson",
  roles: "preacher, liturgist",
  contact: "namn@domän.com",
  type: "contributor",           // contributor/crew/composer/lyricist
  created: "2025-01-01T00:00:00Z"
}
```

### Programme

```javascript
{
  program_nr: 1,
  location: "EXAMPLE CHURCH",
  start_date: "2025-02-01",
  broadcast_date: "2025-03-01",
  church_year: "Second Sunday in Lent",
  prod_nr: "PROD-2025-001",
  target_length_sec: 2610,       // 43:30
  start_time: "01:00:00",
  notes: "",
  created: "2025-02-01T09:00:00Z",
  modified: "2025-02-01T17:00:00Z"
}
```

---

## Architecture (2026 Edition)

The system now supports a hybrid architecture with Supabase as an optional backend:

```
Google Sheets (UI + sharing)
       │
       ▼
Cloudflare Worker (validation, conflict handling)
       │
       ▼
Supabase (PostgreSQL with ACID, realtime, audit)
       │
       ▼
iPad Studio PWA (touch-optimised studio view)
```

See [ARCHITECTURE-2026.md](ARCHITECTURE-2026.md) for full documentation.

---

## File Structure

```
├── Config.gs          // Constants and configuration
├── Database.gs        // CRUD operations
├── Views.gs           // View generation
├── UI.gs              // Menus and dialogues
├── Triggers.gs        // Event handlers and API
└── Sync.gs            // External synchronisation
```

---

## Troubleshooting

### Custom menu does not appear

**Solution:**
1. Reload the page (F5)
2. If still not visible: run `onOpen()` manually from the Script Editor

### "Database not initialised" error

**Solution:**
Run `System > Bootstrap Database`

### Views do not display data

**Solution:**
1. Verify that database sheets exist and contain data
2. Run `System > Generate All Views` again
3. Check QUERY formulae (should begin with `=QUERY(_DB_...`)

### Edits in view do not update the database

**Solution:**
1. Verify that triggers are installed
2. Check Script Editor > Executions for error messages

### Performance issues

**Tips:**
- Limit rows in QUERY (`LIMIT 100`)
- Hide unused sheets
- Minimise conditional formatting rules

---

## Roadmap

### Version 1.1

- [ ] Post reordering (drag-and-drop simulation)
- [ ] Import from CSV/TSV
- [ ] Export to Avid EDL
- [ ] Bulk status update

### Version 1.2 (Companion Integration)

- [ ] Companion button examples
- [ ] Automatic timecode logging from BMD

### Version 2.0 (Advanced Features)

- [ ] Multi-camera timecode tracking
- [ ] Live countdown to next post
- [ ] Google Calendar integration for venue booking
- [ ] SMS notifications (via Twilio)
- [ ] QR codes for rapid scanning

---

## Licence and Credits

**Created by:** David Thåst
**Context:** Swedish public service church broadcast production
**Year:** 2025

**Licence:** MIT (open source, modify freely)

**Acknowledgements:**
- Legacy production systems (inspiration)
- The broadcast community for best practices

---

## Contributing

Contributions are welcome. Please submit pull requests.

### Development Setup

```bash
git clone https://github.com/FiLORUX/the-public-service
cd the-public-service
# Edit .gs files locally
# Deploy via clasp (Google Apps Script CLI)
clasp push
```

### Testing

- Create test data in a separate spreadsheet
- Test CRUD operations
- Verify QUERY formulae
- Check performance with 100+ posts

---

## Support

**GitHub Issues:** https://github.com/FiLORUX/the-public-service/issues
**Email:** david@thast.se

**Frequently Asked Questions:** See [FAQ.md](FAQ.md)

---

## Project History

See [CONTEXT.md](CONTEXT.md)

---

_Built for broadcast professionals_
