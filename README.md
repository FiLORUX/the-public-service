# 🎬 Gudstjänst Production System

**Production-grade broadcast management system för kyrkoTV-produktioner**

Byggt av David Thåst för SVT:s gudstjänstproduktioner. Ett modernt, databas-drivet system som ersätter det gamla Excel-baserade arbetsflödet med en intelligent Google Sheets-lösning.

---

## 🎯 **Filosofi**

Detta system följer broadcast-standard: **deterministisk**, **pålitlig**, **läsbar under stress**.

### Arkitektoniska principer
1. **Normaliserad databas** – Single source of truth i dolda sheets
2. **Dynamiska vyer** – Presentationslager genererat via QUERY-formler
3. **Separation of concerns** – Data ≠ Presentation
4. **Future-proof** – Förbered för API-integration (Companion/BMD/vMix)
5. **Git-friendly** – Exporterbar till JSON för versionskontroll

---

## 📦 **Komponenter**

### Database Layer (dolda sheets, prefix `_DB_`)
- **`_DB_Posts`** – Huvudregistret för alla poster (alla program)
- **`_DB_Personer`** – Register över medverkande och personal
- **`_DB_Program`** – Metadata för de 4 programmen per inspelningsplats
- **`_DB_PostTyper`** – Templates för posttyper (predikan, sång, etc)
- **`_DB_Logg`** – Timecode-loggning (append-only)
- **`_DB_Settings`** – Systeminställningar

### View Layer (synliga sheets)
- **`Program 1-4`** – Ett blad per program (ersätter både Kort/Lång)
- **`Inspelningsschema`** – Aggregerad vy över alla program, sorterad på dag/tid
- **`Översikt`** – Dashboard med statistik
- **`Kreditlista`** – Auto-genererad från _DB_Personer

### Apps Script Files
- **`Config.gs`** – Konstanter, schema-definitioner, utility-funktioner
- **`Database.gs`** – All CRUD-logik, databasoperationer
- **`Views.gs`** – Vy-generering, QUERY-formler
- **`UI.gs`** – Menyer, dialoger, användarinteraktion
- **`Triggers.gs`** – Event handlers, API webhooks

---

## 🚀 **Installation**

### 1. Skapa nytt Google Sheet
```
1. Öppna https://sheets.google.com
2. Skapa nytt kalkylblad
3. Namnge det (t.ex. "Gudstjänst Produktion - MARIAKYRKAN 2025")
```

### 2. Öppna Apps Script Editor
```
Tools > Script editor (eller Extensions > Apps Script)
```

### 3. Kopiera in filerna
```
1. Ta bort default Code.gs
2. Skapa 5 nya filer:
   - Config.gs
   - Database.gs
   - Views.gs
   - UI.gs
   - Triggers.gs
3. Kopiera in koden från respektive fil från detta repo
4. Spara projektet (Ctrl+S)
```

### 4. Bootstrap databasen
```
1. Stäng Script Editor, gå tillbaka till spreadsheet
2. Ladda om sidan (F5) så att custom menu dyker upp
3. Välj: System > Bootstrap Database
4. Bekräfta
5. Vänta 10-20 sekunder
```

### 5. Generera vyer
```
System > Generate All Views
```

**Klart!** Du har nu en fullt fungerande installation.

---

## 📖 **Användarguide**

### Initial Setup

#### 1. Konfigurera program-metadata
```
Inställningar > Redigera program­metadata
```
Fyll i för varje program (1-4):
- Plats (kyrkonamn)
- Inspelningsstartdatum
- Sändningsdatum
- Kyrkoåret (t.ex. "2 i fastan")
- Prod.nr
- Måltid (sekunder, default 2610 = 43:30)
- Starttid för Dag 1 (t.ex. "09:00:00")

#### 2. Lägg till personer
```
Personer > Lägg till person
```
- Fyll i namn, roller, kontakt
- Typer: medverkande, team, kompositör, textförfattare

### Skapa Poster

#### Via meny (rekommenderat)
```
Poster > Lägg till ny post
```
Dialog öppnas där du fyller i:
- **Program** (1-4)
- **Posttyp** (välj från dropdown – default-duration sätts automatiskt)
- **Innehåll** (huvudtext)
- **Medverkande** (kommaseparerat, skapar personer automatiskt om nya)
- **Plats** (dropdown)
- **Inspelningsdag** (Dag 1/2/3)
- **Anteckningar**

#### Direkt i Program-vyn
Du kan också redigera direkt i Program 1-4 vyerna:
- Ändra celler → uppdateras automatiskt i databasen
- Dropdowns för typ, plats, dag, status
- Rullande tid beräknas automatiskt

### Posttyper (default templates)

| Typ | Icon | Default tid | Beskrivning |
|-----|------|-------------|-------------|
| **Predikan** | 🎤 | 7:00 | Huvudpredikan |
| **Textläsning** | 📖 | 1:30 | Bibelläsning |
| **Sång (kör)** | 🎼 | 3:00 | Körsång |
| **Sång (solo)** | 🎵 | 2:30 | Solosång |
| **Orgelspel** | 🎹 | 2:00 | Instrumental |
| **Liturgi** | ✝️ | 0:45 | Kyrie, Agnus Dei, etc |
| **Förbön** | 🙏 | 2:00 | Församlingens förbön |
| **Punktinfo** | 🎥 | 1:00 | Kort segment |
| **Temapresentation** | 📺 | 2:30 | Längre presentation |
| **Mellan-påa** | ⏸️ | 0:30 | Teknisk paus |
| **Välsignelse** | 🙌 | 0:45 | Avslutning |

**Anpassa:**
```
Inställningar > Redigera posttyper
```
Lägg till egna typer med egna default-värden, färger, ikoner.

### Inspelningsschema

Navigera till `Inspelningsschema`-bladet för att se:
- **Alla poster från alla program** aggregerat
- Sorterat på **Dag** → **Tid**
- Färgkodning baserat på status

Detta är den vy som används under inspelning.

### Status Tracking

#### Statusvärden
- 🟢 **Planerad** (vit)
- 🟡 **Spelar in** (gul)
- 🟢 **Inspelad** (ljusgrön)
- 🟢 **Godkänd** (mörkgrön)

#### Uppdatera status
1. **Manuellt:** Ändra status-kolumn direkt i vy
2. **Via meny:**
   - Markera rad
   - `Produktion > Markera post som inspelad`
3. **Via API** (framtida): Automatisk från Companion

---

## 🔌 **API Integration (förbered, ej aktiverat än)**

Systemet är förberett för integration med:
- **Bitfocus Companion** (Stream Deck)
- **Blackmagic Design HyperDeck**
- **vMix**

### Aktivering (framtida)
```javascript
// I Config.gs, sätt:
API_CONFIG.ENABLED = true;

// Deployas som Web App:
Deploy > New deployment > Web app
```

### Endpoints (stubs finns i Triggers.gs)
- `POST /api/timecode/in` – Logga TC-IN
- `POST /api/timecode/out` – Logga TC-OUT
- `POST /api/clip/next` – Hämta nästa klippnummer
- `POST /api/post/status` – Uppdatera status

### Companion Example (framtida)
```json
{
  "action": "http_request",
  "url": "https://script.google.com/macros/s/DEPLOY_ID/exec",
  "method": "POST",
  "body": {
    "action": "tc_in",
    "post_id": "$(internal:custom_PostID)",
    "tc_in": "$(vmix:timecode)",
    "operator": "David",
    "clip_nr": "$(internal:custom_ClipCounter)"
  }
}
```

---

## 🔧 **Avancerad användning**

### Export till JSON (för GitHub)
```
System > Backup to JSON
```
Kopierar hela databasen till JSON-format. Spara i repo:
```
data/backup_2025-10-22.json
```

### Visa/Dölja databas-sheets
```
System > Show Database Sheets
```
För manuell redigering eller debugging. **Var försiktig** – dessa är single source of truth.

### Omnumrera poster
```
Poster > Omnumrera alla poster
```
Säkerställer att post-IDs är sekventiella (P1:1, P1:2, P1:3...).

### Flytta poster (ej implementerat än)
```
Poster > Flytta post upp/ner
```
TODO: Kommer swappa `sort_order` värden.

---

## 📊 **Datamodell**

### Post (huvudentitet)
```javascript
{
  post_id: "P1:10",           // Program 1, Post 10
  program_nr: 1,              // 1-4
  sort_order: 10,             // För sortering
  type: "predikan",           // Posttyp-key
  title: "Predikan om hopp",  // Huvudinnehåll
  duration_sec: 420,          // 7 minuter
  people_ids: "P001,P002",    // Kommaseparerade
  location: "talarplats",
  info_pos: "Kamera 1, nära",
  graphics: "Namn underlägger",
  notes: "Extra ljus behövs",
  recording_day: "dag1",      // dag1/dag2/dag3
  recording_time: "09:15:00", // Beräknad
  status: "planerad",         // planerad/recording/inspelad/godkänd
  text_author: "",            // För musik
  composer: "",               // För musik
  arranger: "",               // För musik
  open_text: false,           // Visa i lång vy?
  created: "2025-10-22T10:30:00Z",
  modified: "2025-10-22T14:20:00Z"
}
```

### Person
```javascript
{
  person_id: "P001",
  name: "Maria Löfgren",
  roles: "predikant, liturg",
  contact: "maria@exempel.se",
  type: "medverkande",        // medverkande/team/kompositör/textförfattare
  created: "2025-10-22T09:00:00Z"
}
```

### Program
```javascript
{
  program_nr: 1,
  location: "MARIAKYRKAN VÄXJÖ",
  start_date: "2025-01-30",
  broadcast_date: "2025-03-01",
  church_year: "2 i fastan",
  prod_nr: "SVT2025-GUD-001",
  target_length_sec: 2610,    // 43:30
  start_time: "09:00:00",
  notes: "",
  created: "2025-10-22T08:00:00Z",
  modified: "2025-10-22T08:00:00Z"
}
```

---

## 🎨 **Stilguide**

### Kod (British English)
```javascript
// ✅ Correct
colour, initialise, behaviour

// ❌ Incorrect
color, initialize, behavior
```

### Kommentarer (Svenska för kontext)
```javascript
// Beräkna rullande tid för alla poster i programmet
// (Calculate rolling time for all posts in programme)
```

### Filstruktur
```
├── Config.gs          // Konstanter & konfiguration
├── Database.gs        // CRUD-operationer
├── Views.gs           // Vy-generering
├── UI.gs              // Menyer & dialoger
└── Triggers.gs        // Event handlers & API
```

---

## 🐛 **Troubleshooting**

### Problem: Custom menu dyker inte upp
**Lösning:**
1. Ladda om sidan (F5)
2. Om fortfarande inte syns: kör `onOpen()` manuellt från Script Editor

### Problem: "Database not initialised"
**Lösning:**
Kör `System > Bootstrap Database`

### Problem: Vyer visar inte data
**Lösning:**
1. Kontrollera att databas-sheets finns och innehåller data
2. Kör `System > Generate All Views` igen
3. Kontrollera QUERY-formlerna (ska börja med `=QUERY(_DB_...`)

### Problem: Edit i vy uppdaterar inte databasen
**Lösning:**
1. Kontrollera att triggers är installerade (kan köras från Script Editor)
2. Kolla Script Editor > Executions för felmeddelanden

### Problem: Performance (långsam)
**Tips:**
- Begränsa antal rader i QUERY (`LIMIT 100`)
- Dölj oanvända sheets
- Minimera conditional formatting rules

---

## 🔮 **Roadmap**

### Version 1.1 (nästa iteration)
- [ ] Post reordering (drag & drop simulering)
- [ ] Import från CSV/TSV
- [ ] Export till Avid EDL
- [ ] Bulk status update

### Version 1.2 (Companion integration)
- [ ] Aktivera API_CONFIG
- [ ] Web app deployment
- [ ] Companion button examples
- [ ] Auto TC-logging från BMD

### Version 2.0 (Advanced features)
- [ ] Multi-camera TC tracking
- [ ] Live countdown till nästa post
- [ ] Google Calendar integration för kyrkobokning
- [ ] SMS-notiser (via Twilio)
- [ ] QR-codes för snabb scanning

---

## 📝 **Licens & Credits**

**Skapad av:** David Thåst  
**För:** SVT Gudstjänstproduktioner  
**År:** 2025  

**Licens:** MIT (open source, modifiera fritt)

**Tack till:**
- SVT:s gamla Excel-system (inspiration & datamodell)
- Broadcast-community för best practices

---

## 🤝 **Kontribut

Vill du förbättra systemet? Skicka pull requests!

### Dev Setup
```bash
git clone https://github.com/FiLORUX/svt-gudstjanst
cd svt-gudstjanst
# Edit .gs files locally
# Deploy via clasp (Google Apps Script CLI)
clasp push
```

### Testing
- Skapa test-data i separat spreadsheet
- Testa CRUD-operationer
- Verifiera QUERY-formler
- Check performance med 100+ poster

---

## 📞 **Support**

**GitHub Issues:** https://github.com/FiLORUX/svt-gudstjanst/issues  
**Email:** david@thast.se  

**Vanliga frågor:** Se [FAQ.md](FAQ.md) (skapas senare)

---

_Built with ❤️ for broadcast professionals_
