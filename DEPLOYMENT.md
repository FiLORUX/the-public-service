# 🚀 Deployment Guide

## Snabbstart (5 minuter)

### Steg 1: Skapa Google Sheet
1. Gå till https://sheets.google.com
2. Skapa nytt kalkylblad
3. Döp det till: `Gudstjänst Produktion - [PLATS] [ÅR]`
   - Exempel: `Gudstjänst Produktion - MARIAKYRKAN 2025`

### Steg 2: Öppna Apps Script Editor
1. I ditt Google Sheet, välj: **Extensions > Apps Script**
2. Du ser nu Script Editor med en tom `Code.gs` fil

### Steg 3: Kopiera in kod-filerna
1. **Ta bort** default `Code.gs` (klicka på papperskorgen)
2. **Skapa 5 nya filer** (klicka på + bredvid Files):
   
   **Fil 1: Config.gs**
   ```
   1. Klicka + > Script
   2. Döp till "Config"
   3. Kopiera HELA innehållet från Config.gs
   4. Klistra in
   ```
   
   **Fil 2: Database.gs**
   ```
   1. Klicka + > Script
   2. Döp till "Database"
   3. Kopiera HELA innehållet från Database.gs
   4. Klistra in
   ```
   
   **Fil 3: Views.gs**
   ```
   1. Klicka + > Script
   2. Döp till "Views"
   3. Kopiera HELA innehållet från Views.gs
   4. Klistra in
   ```
   
   **Fil 4: UI.gs**
   ```
   1. Klicka + > Script
   2. Döp till "UI"
   3. Kopiera HELA innehållet från UI.gs
   4. Klistra in
   ```
   
   **Fil 5: Triggers.gs**
   ```
   1. Klicka + > Script
   2. Döp till "Triggers"
   3. Kopiera HELA innehållet från Triggers.gs
   4. Klistra in
   ```

3. **Spara projektet**: Ctrl+S (eller Cmd+S på Mac)
4. **Döp projektet**: Klicka på "Untitled project" längst upp, döp till `Gudstjänst System`

### Steg 4: Första körningen
1. **Stäng Script Editor** (återgå till Google Sheet)
2. **Ladda om sidan**: Tryck F5
3. Efter 5-10 sekunder ser du nya menyer längst upp:
   - 📋 System
   - 📝 Poster
   - 👥 Personer
   - 🎬 Produktion
   - ⚙️ Inställningar

### Steg 5: Bootstrap Database
1. Välj: **📋 System > 🚀 Bootstrap Database**
2. En dialogruta dyker upp: **"This will create/reset the database structure..."**
3. Klicka **Yes**
4. Vänta 10-20 sekunder
5. Du ser: **"Success! Database initialised successfully."**

### Steg 6: Generera vyer
1. Välj: **📋 System > 🔄 Generate All Views**
2. Vänta 5-10 sekunder
3. Du ser: **"All views generated successfully!"**

### ✅ Klart!
Du har nu:
- 6 dolda database-sheets (`_DB_*`)
- 4 program-vyer (`Program 1-4`)
- 1 inspelningsschema
- 1 översikt-dashboard
- 1 kreditlista

---

## Nästa steg: Initial Configuration

### Konfigurera program-metadata
1. Välj: **⚙️ Inställningar > 📝 Redigera program­metadata**
2. Bladet `_DB_Program` öppnas (nu synligt)
3. Fyll i rad 2-5 (Program 1-4):

| program_nr | location | start_date | broadcast_date | church_year | prod_nr | target_length_sec | start_time | notes |
|------------|----------|------------|----------------|-------------|---------|-------------------|------------|-------|
| 1 | MARIAKYRKAN VÄXJÖ | 2025-01-30 | 2025-03-01 | 2 i fastan | SVT-GUD-001 | 2610 | 09:00:00 | |
| 2 | MARIAKYRKAN VÄXJÖ | 2025-01-30 | 2025-03-08 | 3 i fastan | SVT-GUD-002 | 2610 | 09:00:00 | |
| 3 | MARIAKYRKAN VÄXJÖ | 2025-01-30 | 2025-03-15 | 4 i fastan | SVT-GUD-003 | 2610 | 09:00:00 | |
| 4 | MARIAKYRKAN VÄXJÖ | 2025-01-30 | 2025-03-22 | 5 i fastan | SVT-GUD-004 | 2610 | 09:00:00 | |

4. **target_length_sec** = måltid i sekunder
   - 43:30 = 2610 sekunder
   - 60:00 = 3600 sekunder

5. När klart: **Högerklicka på bladet → Hide sheet**

### Lägg till första personen
1. Välj: **👥 Personer > ➕ Lägg till person**
2. En dialog öppnas (HTML-formulär)
3. Fyll i:
   - **Namn**: Maria Löfgren
   - **Roll**: predikant, liturg
   - **Kontakt**: maria@exempel.se
   - **Typ**: medverkande
4. Klicka **Skapa person**

### Skapa första posten
1. Gå till bladet **Program 1**
2. Välj: **📝 Poster > ➕ Lägg till ny post**
3. Dialog öppnas
4. Fyll i:
   - **Program**: 1 (redan förvald)
   - **Posttyp**: Predikan
   - **Innehåll**: Predikan om hopp och framtidstro
   - **Medverkande**: Maria Löfgren
   - **Plats**: talarplats
   - **Inspelningsdag**: Dag 1 - Textläsning & Predikan
5. Klicka **Skapa post**

### ✅ Du ser nu din första post!
- I `Program 1`-bladet
- Automatiskt tilldelat post-ID: **P1:1**
- Default duration: **07:00** (7 minuter för predikan)
- Rullande tid: **07:00**

---

## Vanliga problem & lösningar

### Problem: "Custom menu dyker inte upp efter Bootstrap"
**Lösning:**
1. Ladda om sidan (F5)
2. Om fortfarande inget: Gå till Script Editor
3. Välj funktionen `onOpen` i dropdown längst upp
4. Klicka Run (play-knappen)
5. Första gången: "Authorization required" → klicka Review Permissions
6. Välj ditt Google-konto
7. Klicka Advanced → Go to Gudstjänst System (unsafe)
8. Klicka Allow
9. Återgå till Google Sheet, ladda om

### Problem: "Bootstrap fails with error"
**Lösning:**
1. Gå till Script Editor
2. Kolla **Executions** (vänstermeny, klocksymbol)
3. Hitta fel-loggen, läs error message
4. Vanligaste felet: saknad fil. Kontrollera att alla 5 .gs filer finns

### Problem: "Views are empty after Generate"
**Lösning:**
1. Kontrollera att Bootstrap kördes utan fel
2. Gå till Script Editor > View > Logs
3. Sök efter "Created _DB_Posts sheet"
4. Om inte där: kör Bootstrap igen

### Problem: "Can't edit cells in Programme view"
**Lösning:**
- Kontrollera att du inte redigerar kolumn F (Rullande) – den är låst
- Övriga kolumner ska vara redigerbara
- Om fortfarande problem: kontrollera att triggers är installerade

---

## Advanced: clasp deployment (för dev)

Om du vill version-kontrollera koden lokalt:

### Installation
```bash
npm install -g @google/clasp
clasp login
```

### Setup
```bash
# I ditt projekt
clasp create --type sheets --title "Gudstjänst System"
clasp push
```

### Workflow
```bash
# Edit lokalt i VS Code
# Push till Google Apps Script
clasp push

# Pull ändringar från Apps Script
clasp pull
```

---

## Backup Strategy

### Daglig rutin
1. **📋 System > 💾 Backup to JSON**
2. Kopiera JSON-output
3. Spara som: `data/backup_YYYY-MM-DD.json`
4. Commit till GitHub

### Automatisk (framtida)
Skapa time-based trigger i Triggers.gs:
```javascript
ScriptApp.newTrigger('dailyBackup')
  .timeBased()
  .atHour(3)
  .everyDays(1)
  .create();
```

---

## GitHub Integration

### Repo-struktur
```
gudstjanst-system/
├── README.md
├── DEPLOYMENT.md (denna fil)
├── Config.gs
├── Database.gs
├── Views.gs
├── UI.gs
├── Triggers.gs
├── data/
│   ├── backup_2025-10-22.json
│   ├── backup_2025-10-23.json
│   └── ...
└── docs/
    ├── API.md
    └── FAQ.md
```

### Commit-workflow
```bash
git add .
git commit -m "feat: add new post type template"
git push origin main
```

---

## Production Checklist

Innan en inspelning:

- [ ] All program-metadata korrekt?
- [ ] Alla medverkande tillagda i Personer?
- [ ] Alla poster skapade och sorterade?
- [ ] Inspelningsdagar korrekt satta (Dag 1/2/3)?
- [ ] Tider verkar rimliga? (kolla Översikt-bladet)
- [ ] Backup gjord?
- [ ] Inspelningsschema-bladet printat/tillgängligt?

Efter en inspelning:

- [ ] Alla poster markerade som "Inspelad" eller "Godkänd"?
- [ ] TC-logg kontrollerad (om använd)?
- [ ] Backup gjord?
- [ ] Problemrapport dokumenterad (om något gick fel)?

---

## Support

**Problem?** Öppna issue på GitHub:
https://github.com/davidthast/gudstjanst-system/issues

**Email:** david@thast.se

---

_Happy broadcasting! 🎬_
