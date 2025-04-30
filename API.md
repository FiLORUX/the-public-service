# API Documentation - Gudstjänst Production System

## Deployment

### 1. Deploy as Web App

1. Open Google Apps Script editor (Extensions > Apps Script)
2. Click **Deploy** > **New deployment**
3. Select **Web app**
4. Configure:
   - **Execute as**: Me (your account)
   - **Who has access**: Anyone
5. Click **Deploy**
6. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/XXXXX/exec`)

### 2. Test the deployment

```bash
curl "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=status"
```

Expected response:
```json
{
  "success": true,
  "system": "Gudstjänst Production System",
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "endpoints": {
    "POST": ["tc_in", "tc_out", "status_update", ...],
    "GET": ["status", "posts", "schedule", ...]
  }
}
```

---

## API Endpoints

### GET Endpoints

All GET requests use query parameters.

| Action | Description | Parameters |
|--------|-------------|------------|
| `status` | System status and available endpoints | - |
| `posts` | Get all posts for a program | `program` (1-4) |
| `schedule` | Get recording schedule | `day` (dag1/dag2/dag3, optional) |
| `post` | Get specific post | `post_id` |
| `current` | Get currently recording post | - |
| `clip_counter` | Get next clip number | - |

**Examples:**

```bash
# Get system status
curl "https://YOUR_URL/exec?action=status"

# Get all posts for Program 1
curl "https://YOUR_URL/exec?action=posts&program=1"

# Get schedule for Day 1
curl "https://YOUR_URL/exec?action=schedule&day=dag1"

# Get specific post
curl "https://YOUR_URL/exec?action=post&post_id=P1:5"

# Get currently recording post
curl "https://YOUR_URL/exec?action=current"
```

### POST Endpoints

All POST requests use JSON body with `action` field.

| Action | Description | Required Fields |
|--------|-------------|-----------------|
| `tc_in` | Log timecode IN | `post_id`, `tc_in` (optional) |
| `tc_out` | Log timecode OUT | `post_id`, `tc_out` (optional) |
| `set_recording` | Set post as recording | `post_id` |
| `mark_recorded` | Mark post as recorded | `post_id` |
| `mark_approved` | Mark post as approved | `post_id` |
| `status_update` | Update post status | `post_id`, `status` |
| `get_posts` | Get posts for program | `program_nr` |
| `get_next` | Get next post to record | `program_nr`, `recording_day` (optional) |
| `get_schedule` | Get full schedule | `recording_day` (optional) |
| `increment_clip` | Increment clip counter | - |

**Examples:**

```bash
# Log TC-IN for a post
curl -X POST "https://YOUR_URL/exec" \
  -H "Content-Type: application/json" \
  -d '{"action": "tc_in", "post_id": "P1:5", "tc_in": "01:23:45:00"}'

# Mark post as recorded
curl -X POST "https://YOUR_URL/exec" \
  -H "Content-Type: application/json" \
  -d '{"action": "mark_recorded", "post_id": "P1:5"}'

# Get next post to record
curl -X POST "https://YOUR_URL/exec" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_next", "program_nr": 1, "recording_day": "dag1"}'
```

---

## Bitfocus Companion Integration

### Setup

1. Install **Generic HTTP** module in Companion
2. Create a new connection with your Web App URL

### Button Examples

#### Button: "TC IN" (Start recording)

**Action: HTTP POST Request**
```
URL: https://script.google.com/macros/s/YOUR_ID/exec
Method: POST
Content-Type: application/json
Body:
{
  "action": "tc_in",
  "post_id": "$(internal:custom_current_post)",
  "tc_in": "$(vmix:timecode)",
  "operator": "Companion"
}
```

#### Button: "TC OUT" (Stop recording)

**Action: HTTP POST Request**
```
URL: https://script.google.com/macros/s/YOUR_ID/exec
Method: POST
Content-Type: application/json
Body:
{
  "action": "tc_out",
  "post_id": "$(internal:custom_current_post)",
  "tc_out": "$(vmix:timecode)"
}
```

#### Button: "Mark Recorded"

```json
{
  "action": "mark_recorded",
  "post_id": "$(internal:custom_current_post)"
}
```

#### Button: "Mark Approved"

```json
{
  "action": "mark_approved",
  "post_id": "$(internal:custom_current_post)"
}
```

#### Button: "Next Post"

```json
{
  "action": "get_next",
  "program_nr": 1,
  "recording_day": "dag1"
}
```

### Companion Variables

Set up custom variables in Companion:
- `current_post`: Currently selected post ID (e.g., "P1:5")
- `current_program`: Current program number (1-4)
- `recording_day`: Current recording day (dag1/dag2/dag3)

---

## vMix Integration

### Using vMix Scripting

```vb
' VB.NET script for vMix
Dim url As String = "https://script.google.com/macros/s/YOUR_ID/exec"
Dim postId As String = "P1:5"

' TC-IN
Dim json As String = "{""action"":""tc_in"",""post_id"":""" & postId & """,""tc_in"":""" & API.GetTimecode() & """}"
API.HTTPPost(url, json, "application/json")

' TC-OUT
Dim jsonOut As String = "{""action"":""tc_out"",""post_id"":""" & postId & """,""tc_out"":""" & API.GetTimecode() & """}"
API.HTTPPost(url, jsonOut, "application/json")
```

---

## BMD HyperDeck Integration

### With Companion

Use Companion's HyperDeck module to:
1. Get current timecode from HyperDeck
2. Send to Google Sheets API via HTTP module

**Trigger on Record Start:**
```json
{
  "action": "tc_in",
  "post_id": "$(internal:custom_current_post)",
  "tc_in": "$(hyperdeck:timecode)",
  "clip_nr": "$(hyperdeck:clip_id)"
}
```

**Trigger on Record Stop:**
```json
{
  "action": "tc_out",
  "post_id": "$(internal:custom_current_post)",
  "tc_out": "$(hyperdeck:timecode)",
  "clip_nr": "$(hyperdeck:clip_id)"
}
```

---

## Response Format

All responses are JSON with this structure:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed",
  "post_id": "P1:5",
  "status": "inspelad",
  ...additional fields...
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "valid_statuses": ["planerad", "recording", "inspelad", "godkand"]
}
```

---

## Status Values

| Key | Display Name | Color | Description |
|-----|--------------|-------|-------------|
| `planerad` | Planerad | White | Not yet recorded |
| `recording` | Spelar in | Yellow | Currently recording |
| `inspelad` | Inspelad | Light Green | Recorded, needs approval |
| `godkand` | Godkänd | Dark Green | Approved and done |

---

## Post Object Structure

```json
{
  "post_id": "P1:5",
  "program_nr": 1,
  "sort_order": 50,
  "type": "predikan",
  "title": "Predikan om hopp",
  "duration_sec": 420,
  "duration_formatted": "00:07:00",
  "people_ids": "PXYZ123,PABC456",
  "location": "talarplats",
  "recording_day": "dag1",
  "recording_time": "",
  "status": "planerad",
  "notes": "Extra ljus behövs"
}
```

---

## Workflow Example

### Typical Recording Session

1. **Before session:** Get schedule
   ```bash
   curl "https://URL/exec?action=schedule&day=dag1"
   ```

2. **Select first post:** Get next
   ```json
   {"action": "get_next", "recording_day": "dag1"}
   ```

3. **Start recording:** TC-IN
   ```json
   {"action": "tc_in", "post_id": "P1:1", "tc_in": "01:00:00:00"}
   ```

4. **Stop recording:** TC-OUT
   ```json
   {"action": "tc_out", "post_id": "P1:1", "tc_out": "01:07:30:00"}
   ```

5. **Review and approve:**
   ```json
   {"action": "mark_approved", "post_id": "P1:1"}
   ```

6. **Repeat** for next post

---

## Rate Limits

Google Apps Script has execution limits:
- **Trigger executions:** 90 min/day (consumer), 6 hr/day (Workspace)
- **URL Fetch calls:** 20,000/day
- **Script runtime:** 6 minutes max per execution

For high-volume use, consider batching requests or using Google Cloud Functions.

---

## Troubleshooting

### "API not enabled" error
The old API_CONFIG.ENABLED check has been removed. If you see this, you may have an old version of the code.

### CORS errors
Deploy the web app with "Anyone" access. Google Apps Script handles CORS automatically.

### Timeout errors
Google Apps Script has a 30-second timeout for web requests. Keep payloads small.

### Post not found
Ensure post_id format is correct: `P{program}:{number}` (e.g., "P1:5", "P2:10")

---

## Support

- **Issues:** https://github.com/FiLORUX/svt-gudstjanst/issues
- **Documentation:** See README.md and DEPLOYMENT.md
