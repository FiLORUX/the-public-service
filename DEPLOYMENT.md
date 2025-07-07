# Deployment Guide

## Quick Start (5 minutes)

### Step 1: Create Google Sheet

1. Navigate to https://sheets.google.com
2. Create a new spreadsheet
3. Name it: `Church Service Production – [VENUE] [YEAR]`
   - Example: `Church Service Production – EXAMPLE CHURCH 2025`

### Step 2: Open Apps Script Editor

1. In your Google Sheet, select: **Extensions > Apps Script**
2. You will see the Script Editor with an empty `Code.gs` file

### Step 3: Copy the Script Files

1. **Delete** the default `Code.gs` (click the bin icon)
2. **Create 6 new files** (click + next to Files):

   **File 1: Config.gs**
   ```
   1. Click + > Script
   2. Name it "Config"
   3. Copy the ENTIRE contents from Config.gs
   4. Paste
   ```

   **File 2: Database.gs**
   ```
   1. Click + > Script
   2. Name it "Database"
   3. Copy the ENTIRE contents from Database.gs
   4. Paste
   ```

   **File 3: Views.gs**
   ```
   1. Click + > Script
   2. Name it "Views"
   3. Copy the ENTIRE contents from Views.gs
   4. Paste
   ```

   **File 4: UI.gs**
   ```
   1. Click + > Script
   2. Name it "UI"
   3. Copy the ENTIRE contents from UI.gs
   4. Paste
   ```

   **File 5: Triggers.gs**
   ```
   1. Click + > Script
   2. Name it "Triggers"
   3. Copy the ENTIRE contents from Triggers.gs
   4. Paste
   ```

   **File 6: Sync.gs**
   ```
   1. Click + > Script
   2. Name it "Sync"
   3. Copy the ENTIRE contents from Sync.gs
   4. Paste
   ```

3. **Save the project**: Ctrl+S (or Cmd+S on Mac)
4. **Name the project**: Click on "Untitled project" at the top, name it `Church Service System`

### Step 4: First Run

1. **Close Script Editor** (return to Google Sheet)
2. **Reload the page**: Press F5
3. After 5–10 seconds, you will see new menus at the top:
   - 📋 System
   - 📝 Posts
   - 👥 People
   - 🎬 Production
   - 🔗 Integration
   - ⚙️ Settings

### Step 5: Bootstrap Database

1. Select: **📋 System > 🚀 Bootstrap Database**
2. A dialogue appears: **"This will create/reset the database structure..."**
3. Click **Yes**
4. Wait 10–20 seconds
5. You will see: **"Success! Database initialised successfully."**

### Step 6: Generate Views

1. Select: **📋 System > 🔄 Generate All Views**
2. Wait 5–10 seconds
3. You will see: **"All views generated successfully!"**

### Complete

You now have:
- 7 hidden database sheets (`_DB_*`)
- 4 programme views (`Program 1–4`)
- 1 recording schedule
- 1 overview dashboard
- 1 credits list

---

## Next Steps: Initial Configuration

### Configure Programme Metadata

1. Select: **⚙️ Settings > 📝 Edit Programme Metadata**
2. The sheet `_DB_Program` opens (now visible)
3. Fill in rows 2–5 (Programmes 1–4):

| program_nr | location | start_date | broadcast_date | church_year | prod_nr | target_length_sec | start_time | notes |
|------------|----------|------------|----------------|-------------|---------|-------------------|------------|-------|
| 1 | EXAMPLE CHURCH | 2025-01-30 | 2025-03-01 | 2nd Sunday in Lent | PROD-2025-001 | 2610 | 09:00:00 | |
| 2 | EXAMPLE CHURCH | 2025-01-30 | 2025-03-08 | 3rd Sunday in Lent | PROD-2025-002 | 2610 | 09:00:00 | |
| 3 | EXAMPLE CHURCH | 2025-01-30 | 2025-03-15 | 4th Sunday in Lent | PROD-2025-003 | 2610 | 09:00:00 | |
| 4 | EXAMPLE CHURCH | 2025-01-30 | 2025-03-22 | 5th Sunday in Lent | PROD-2025-004 | 2610 | 09:00:00 | |

4. **target_length_sec** = target duration in seconds
   - 43:30 = 2610 seconds
   - 60:00 = 3600 seconds

5. When complete: **Right-click on the sheet → Hide sheet**

### Add Your First Person

1. Select: **👥 People > ➕ Add Person**
2. A dialogue opens (HTML form)
3. Fill in:
   - **Name:** Maria Löfgren
   - **Role:** preacher, liturgist
   - **Contact:** maria@example.com
   - **Type:** contributor
4. Click **Create Person**

### Create Your First Post

1. Navigate to the sheet **Program 1**
2. Select: **📝 Posts > ➕ Add New Post**
3. Dialogue opens
4. Fill in:
   - **Programme:** 1 (already selected)
   - **Post type:** Sermon
   - **Content:** Sermon on hope and the future
   - **Contributors:** Maria Löfgren
   - **Location:** pulpit
   - **Recording day:** Day 1 – Scripture Readings & Sermons
5. Click **Create Post**

### Your First Post Is Now Visible

- In the `Program 1` sheet
- Automatically assigned post ID: **P1:1**
- Default duration: **07:00** (7 minutes for a sermon)
- Rolling time: **07:00**

---

## Common Problems and Solutions

### Problem: Custom menu does not appear after Bootstrap

**Solution:**
1. Reload the page (F5)
2. If still nothing: Go to Script Editor, select `onOpen` function, click Run
3. Return to the Sheet and reload

### Problem: "Database not initialised" error

**Solution:**
Run **📋 System > 🚀 Bootstrap Database** again

### Problem: Views show no data

**Solution:**
1. Verify that posts exist in `_DB_Posts`
2. Run **📋 System > 🔄 Generate All Views**
3. Check that QUERY formulae in the views reference the correct sheets

### Problem: Edits in views do not update the database

**Solution:**
1. Check that triggers are installed
2. Open Script Editor > Triggers (clock icon on the left)
3. Verify that edit triggers exist

### Problem: Authorisation prompt appears repeatedly

**Solution:**
1. Clear browser cache
2. Remove and re-authorise the script
3. Check that you are using the same Google account

---

## Deploying the API

### Enable Web App Deployment

1. Open Script Editor
2. Click **Deploy > New deployment**
3. Select type: **Web app**
4. Configure:
   - **Description:** Church Service API v1.0
   - **Execute as:** Me
   - **Who has access:** Anyone (for Companion) or Anyone with link
5. Click **Deploy**
6. Copy the **Web app URL**

### Configure API Authentication

1. In Script Editor, go to **Project Settings** (gear icon)
2. Scroll to **Script Properties**
3. Add property:
   - **Property:** `API_SECRET`
   - **Value:** Generate a strong random key
4. Save

### Test the API

```bash
# Health check (no auth required)
curl "YOUR_WEB_APP_URL?action=status"

# Get posts (requires auth)
curl "YOUR_WEB_APP_URL?action=posts&program=1&api_key=YOUR_API_KEY"
```

---

## Setting Up Automatic Backups

1. Select: **📋 System > 💾 Backup & Restore > ⏰ Enable Automatic Backup**
2. Backups will run at 03:00, 11:00 and 19:00 daily
3. Files are saved to Google Drive folder: `Gudstjänst_Backups`
4. Last 30 backups are retained

---

## Deploying the 2026 Architecture

For teams requiring the advanced hybrid architecture (Supabase + Cloudflare Worker + iPad PWA), see [ARCHITECTURE-2026.md](ARCHITECTURE-2026.md).

---

## Checklist

### Pre-Production

- [ ] Database bootstrapped
- [ ] Views generated
- [ ] Programme metadata configured
- [ ] Contributors added
- [ ] Posts created for all programmes
- [ ] Recording days assigned
- [ ] API deployed (if using Companion)
- [ ] Automatic backups enabled

### Recording Day

- [ ] Recording schedule printed/displayed
- [ ] All contributors present in system
- [ ] Status tracking tested
- [ ] Companion buttons configured (if applicable)

### Post-Production

- [ ] All posts marked as recorded or approved
- [ ] Final backup taken
- [ ] Programme archived (optional)

---

## Support

**GitHub Issues:** https://github.com/FiLORUX/the-public-service/issues

**Documentation:**
- [README.md](README.md) – Overview and user guide
- [API.md](API.md) – API documentation
- [ARCHITECTURE-2026.md](ARCHITECTURE-2026.md) – Advanced architecture
- [FAQ.md](FAQ.md) – Frequently asked questions
