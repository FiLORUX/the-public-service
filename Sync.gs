/**
 * SUPABASE SYNC MODULE
 * Bi-direktionell synkronisering mellan Google Sheets och Supabase
 *
 * Arkitektur:
 * - Google Sheets = UI + delning + mobil access
 * - Supabase = Source of truth med ACID, optimistic locking, historik
 * - Cloudflare Worker = Mellanhand för validering och konflikthantering
 */

// ============================================================================
// SYNC CONFIGURATION
// ============================================================================

const SYNC_CONFIG = {
  // Cloudflare Worker URL (sätts i Script Properties)
  WORKER_URL_KEY: 'SYNC_WORKER_URL',

  // Webhook secret för autentisering
  WEBHOOK_SECRET_KEY: 'SYNC_WEBHOOK_SECRET',

  // Sync mode
  ENABLED_KEY: 'SYNC_ENABLED',

  // Batching
  BATCH_SIZE: 50,

  // Retry
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000
};

// ============================================================================
// SYNC STATUS TRACKING
// ============================================================================

/**
 * Check if sync is enabled
 */
function isSyncEnabled_() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(SYNC_CONFIG.ENABLED_KEY) === 'true';
}

/**
 * Enable/disable sync
 */
function setSyncEnabled(enabled) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(SYNC_CONFIG.ENABLED_KEY, enabled ? 'true' : 'false');
  Logger.log(`Sync ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Get Worker URL
 */
function getWorkerUrl_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty(SYNC_CONFIG.WORKER_URL_KEY);

  if (!url) {
    throw new Error('SYNC_WORKER_URL not configured. Set it in Script Properties.');
  }

  return url;
}

/**
 * Get webhook secret
 */
function getWebhookSecret_() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(SYNC_CONFIG.WEBHOOK_SECRET_KEY) || '';
}

// ============================================================================
// OUTBOUND SYNC (Sheets → Supabase via Worker)
// ============================================================================

/**
 * Sync a single post to Supabase
 * Called after createPost, updatePost, deletePost
 */
function syncPostToSupabase_(action, postData, version) {
  if (!isSyncEnabled_()) return { success: true, skipped: true };

  try {
    const payload = {
      source: 'sheets',
      action: action,  // 'create', 'update', 'delete'
      entity_type: 'post',
      data: postData,
      version: version,
      timestamp: new Date().toISOString()
    };

    const response = sendToWorker_('/sync/from-sheets', payload);

    if (!response.success) {
      // Handle conflict
      if (response.error === 'Conflict') {
        Logger.log(`Sync conflict for ${postData.post_id}: server version ${response.server_version}, our version ${version}`);
        return {
          success: false,
          conflict: true,
          serverVersion: response.server_version
        };
      }

      Logger.log(`Sync failed: ${response.error}`);
      return { success: false, error: response.error };
    }

    return { success: true, data: response.data };

  } catch (error) {
    Logger.log(`Sync error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Batch sync all posts in a program
 */
function syncProgramToSupabase(programNr) {
  if (!isSyncEnabled_()) {
    SpreadsheetApp.getUi().alert('Sync är inte aktiverat. Konfigurera Worker-URL först.');
    return;
  }

  const posts = getPostsByProgram_(programNr);

  if (posts.length === 0) {
    SpreadsheetApp.getUi().alert(`Inga poster i Program ${programNr}`);
    return;
  }

  // Convert to Supabase format
  const supabasePosts = posts.map(post => convertPostToSupabaseFormat_(post));

  try {
    const payload = {
      source: 'sheets',
      action: 'batch_sync',
      entity_type: 'post',
      data: supabasePosts,
      timestamp: new Date().toISOString()
    };

    const response = sendToWorker_('/sync/from-sheets', payload);

    if (response.success) {
      const msg = `Sync klar!\n\nSkapade: ${response.results.created}\nUppdaterade: ${response.results.updated}\nKonflikter: ${response.results.conflicts.length}`;
      SpreadsheetApp.getUi().alert(msg);
    } else {
      SpreadsheetApp.getUi().alert(`Sync misslyckades: ${response.error}`);
    }

  } catch (error) {
    SpreadsheetApp.getUi().alert(`Sync fel: ${error.message}`);
  }
}

/**
 * Full sync of all data
 */
function fullSyncToSupabase() {
  if (!isSyncEnabled_()) {
    SpreadsheetApp.getUi().alert('Sync är inte aktiverat.');
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Full Sync till Supabase',
    'Detta synkroniserar ALLA poster till Supabase. Fortsätt?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalConflicts = 0;

  for (let programNr = 1; programNr <= 4; programNr++) {
    const posts = getPostsByProgram_(programNr);
    if (posts.length === 0) continue;

    const supabasePosts = posts.map(post => convertPostToSupabaseFormat_(post));

    try {
      const response = sendToWorker_('/sync/from-sheets', {
        source: 'sheets',
        action: 'batch_sync',
        entity_type: 'post',
        data: supabasePosts,
        timestamp: new Date().toISOString()
      });

      if (response.success) {
        totalCreated += response.results.created;
        totalUpdated += response.results.updated;
        totalConflicts += response.results.conflicts.length;
      }
    } catch (error) {
      Logger.log(`Sync error for program ${programNr}: ${error.message}`);
    }
  }

  ui.alert(`Full Sync Klar!\n\nSkapade: ${totalCreated}\nUppdaterade: ${totalUpdated}\nKonflikter: ${totalConflicts}`);
}

// ============================================================================
// INBOUND SYNC (Supabase → Sheets via Webhook)
// ============================================================================

/**
 * Webhook endpoint for receiving updates from Supabase
 * Called by Cloudflare Worker when Supabase data changes
 */
function handleSupabaseWebhook(e) {
  // Verify webhook secret
  const secret = e.parameter.secret || '';
  if (secret !== getWebhookSecret_()) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const payload = JSON.parse(e.postData.contents);

    switch (payload.action) {
      case 'update':
        handleInboundUpdate_(payload.data);
        break;

      case 'create':
        handleInboundCreate_(payload.data);
        break;

      case 'delete':
        handleInboundDelete_(payload.data.post_id);
        break;

      default:
        Logger.log(`Unknown webhook action: ${payload.action}`);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log(`Webhook error: ${error.message}`);
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle inbound update from Supabase
 */
function handleInboundUpdate_(data) {
  const sheet = getDbSheet_(DB.POSTS);
  const allData = sheet.getDataRange().getValues();

  // Find row with matching post_id
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][POST_SCHEMA.ID] === data.post_id) {
      // Convert Supabase format back to Sheets format
      const updates = convertSupabaseToSheetsFormat_(data);

      // Update each field
      for (const [field, value] of Object.entries(updates)) {
        const colIndex = POST_SCHEMA[field.toUpperCase()];
        if (colIndex !== undefined) {
          sheet.getRange(i + 1, colIndex + 1).setValue(value);
        }
      }

      // Update modified timestamp
      sheet.getRange(i + 1, POST_SCHEMA.MODIFIED + 1).setValue(getTimestamp_());

      Logger.log(`Inbound update applied: ${data.post_id}`);
      return;
    }
  }

  Logger.log(`Inbound update: post ${data.post_id} not found`);
}

/**
 * Handle inbound create from Supabase
 */
function handleInboundCreate_(data) {
  const sheetsData = convertSupabaseToSheetsFormat_(data);

  // Check if already exists
  const existing = getPostById_(data.post_id);
  if (existing) {
    Logger.log(`Inbound create: post ${data.post_id} already exists, treating as update`);
    handleInboundUpdate_(data);
    return;
  }

  // Create new post
  const sheet = getDbSheet_(DB.POSTS);
  const newRow = [];

  for (let i = 0; i < POST_HEADERS.length; i++) {
    const header = POST_HEADERS[i];
    newRow.push(sheetsData[header] || '');
  }

  sheet.appendRow(newRow);
  Logger.log(`Inbound create: ${data.post_id}`);
}

/**
 * Handle inbound delete from Supabase
 */
function handleInboundDelete_(postId) {
  // Use soft-delete to match our system
  deletePost(postId, false);
  Logger.log(`Inbound delete: ${postId}`);
}

// ============================================================================
// FORMAT CONVERSION
// ============================================================================

/**
 * Convert Sheets post format to Supabase format
 */
function convertPostToSupabaseFormat_(post) {
  return {
    post_id: post.post_id,
    program_nr: parseInt(post.program_nr) || 1,
    sort_order: parseInt(post.sort_order) || 0,
    type_key: post.type || null,
    title: post.title || null,
    duration_sec: parseInt(post.duration_sec) || 60,
    people_ids: post.people_ids ? post.people_ids.split(',').map(s => s.trim()) : [],
    location: post.location || null,
    text_author: post.text_author || null,
    composer: post.composer || null,
    arranger: post.arranger || null,
    recording_day: post.recording_day || 'dag1',
    recording_time: post.recording_time || null,
    status: post.status || 'planerad',
    info_pos: post.info_pos || null,
    graphics: post.graphics || null,
    notes: post.notes || null,
    open_text: isTruthy_(post.open_text),
    version: 1,  // Will be set by Supabase
    last_modified_by: 'sheets'
  };
}

/**
 * Convert Supabase format back to Sheets format
 */
function convertSupabaseToSheetsFormat_(data) {
  return {
    post_id: data.post_id,
    program_nr: data.program_nr,
    sort_order: data.sort_order,
    type: data.type_key,
    title: data.title,
    duration_sec: data.duration_sec,
    people_ids: Array.isArray(data.people_ids) ? data.people_ids.join(', ') : '',
    location: data.location,
    text_author: data.text_author,
    composer: data.composer,
    arranger: data.arranger,
    recording_day: data.recording_day,
    recording_time: data.recording_time,
    status: data.status,
    info_pos: data.info_pos,
    graphics: data.graphics,
    notes: data.notes,
    open_text: data.open_text ? 'TRUE' : 'FALSE',
    modified: getTimestamp_()
  };
}

// ============================================================================
// HTTP HELPERS
// ============================================================================

/**
 * Send request to Cloudflare Worker
 */
function sendToWorker_(endpoint, payload) {
  const workerUrl = getWorkerUrl_();
  const secret = getWebhookSecret_();

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Webhook-Secret': secret
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  let lastError;

  for (let attempt = 1; attempt <= SYNC_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = UrlFetchApp.fetch(workerUrl + endpoint, options);
      const status = response.getResponseCode();
      const body = JSON.parse(response.getContentText());

      if (status >= 200 && status < 300) {
        return body;
      }

      // Handle specific error codes
      if (status === 409) {
        // Conflict - don't retry
        return body;
      }

      lastError = new Error(`HTTP ${status}: ${body.error || 'Unknown error'}`);

    } catch (error) {
      lastError = error;
    }

    // Wait before retry
    if (attempt < SYNC_CONFIG.MAX_RETRIES) {
      Utilities.sleep(SYNC_CONFIG.RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

/**
 * Show conflict resolution dialog
 */
function showConflictDialog_(postId, localData, serverData) {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: 'Google Sans', Arial, sans-serif; padding: 16px; }
      h2 { color: #d32f2f; }
      .comparison { display: flex; gap: 16px; }
      .version { flex: 1; background: #f5f5f5; padding: 12px; border-radius: 8px; }
      .version h3 { margin-top: 0; }
      .field { margin: 8px 0; }
      .label { font-weight: 500; color: #666; }
      .value { background: white; padding: 4px 8px; border-radius: 4px; margin-top: 2px; }
      .diff { background: #fff3cd; }
      .buttons { margin-top: 16px; display: flex; gap: 8px; }
      button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
      .keep-local { background: #4caf50; color: white; }
      .use-server { background: #2196f3; color: white; }
      .merge { background: #ff9800; color: white; }
    </style>

    <h2>Synkroniseringskonflikt</h2>
    <p>Post <strong>${postId}</strong> har ändrats på båda sidor.</p>

    <div class="comparison">
      <div class="version">
        <h3>Din version (Sheets)</h3>
        ${renderVersionFields_(localData)}
      </div>
      <div class="version">
        <h3>Server-version (Supabase)</h3>
        ${renderVersionFields_(serverData)}
      </div>
    </div>

    <div class="buttons">
      <button class="keep-local" onclick="google.script.run.resolveConflict('${postId}', 'keep_local')">
        Behåll min version
      </button>
      <button class="use-server" onclick="google.script.run.resolveConflict('${postId}', 'use_server')">
        Använd server-version
      </button>
      <button class="merge" onclick="google.script.run.resolveConflict('${postId}', 'merge')">
        Slå ihop (senaste per fält)
      </button>
    </div>

    <script>
      // Close dialog after resolution
      google.script.host.close();
    </script>
  `)
  .setWidth(700)
  .setHeight(500);

  SpreadsheetApp.getUi().showModalDialog(html, 'Synkroniseringskonflikt');
}

function renderVersionFields_(data) {
  const fields = ['title', 'duration_sec', 'status', 'notes'];
  return fields.map(f => `
    <div class="field">
      <div class="label">${f}</div>
      <div class="value">${data[f] || '(tom)'}</div>
    </div>
  `).join('');
}

/**
 * Resolve conflict based on user choice
 */
function resolveConflict(postId, strategy) {
  switch (strategy) {
    case 'keep_local':
      // Force push local version with incremented version
      const localPost = getPostById_(postId);
      syncPostToSupabase_('update', localPost, null);  // null = force
      break;

    case 'use_server':
      // Pull server version and overwrite local
      pullPostFromSupabase_(postId);
      break;

    case 'merge':
      // Use server for base, apply local changes where local is newer
      mergePost_(postId);
      break;
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(`Konflikt löst för ${postId}`, 'Sync', 3);
}

/**
 * Pull single post from Supabase
 */
function pullPostFromSupabase_(postId) {
  const response = sendToWorker_('/api/post?id=' + encodeURIComponent(postId), {});

  if (response.success && response.post) {
    handleInboundUpdate_(response.post);
  }
}

/**
 * Merge local and server versions
 * Uses field-level "last write wins" strategy
 */
function mergePost_(postId) {
  // For now, just use server version
  // TODO: Implement proper field-level merge based on timestamps
  pullPostFromSupabase_(postId);
}

// ============================================================================
// SETUP & CONFIGURATION UI
// ============================================================================

/**
 * Show sync configuration dialog
 */
function showSyncConfigDialog() {
  const props = PropertiesService.getScriptProperties();
  const currentUrl = props.getProperty(SYNC_CONFIG.WORKER_URL_KEY) || '';
  const currentSecret = props.getProperty(SYNC_CONFIG.WEBHOOK_SECRET_KEY) || '';
  const isEnabled = props.getProperty(SYNC_CONFIG.ENABLED_KEY) === 'true';

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: 'Google Sans', Arial, sans-serif; padding: 20px; max-width: 500px; }
      h2 { color: #1a73e8; margin-bottom: 20px; }
      .field { margin-bottom: 16px; }
      label { display: block; font-weight: 500; margin-bottom: 4px; }
      input[type="text"], input[type="password"] {
        width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;
      }
      .checkbox-field { display: flex; align-items: center; gap: 8px; }
      .info { font-size: 12px; color: #666; margin-top: 4px; }
      .buttons { margin-top: 24px; display: flex; gap: 8px; }
      button { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
      .save { background: #1a73e8; color: white; }
      .cancel { background: #f1f3f4; }
      .test { background: #34a853; color: white; }
    </style>

    <h2>Supabase Sync Konfiguration</h2>

    <div class="field">
      <label>Cloudflare Worker URL</label>
      <input type="text" id="workerUrl" value="${currentUrl}" placeholder="https://svt-gudstjanst-sync.workers.dev">
      <div class="info">URL till din deployade Cloudflare Worker</div>
    </div>

    <div class="field">
      <label>Webhook Secret</label>
      <input type="password" id="secret" value="${currentSecret}" placeholder="din-hemliga-nyckel">
      <div class="info">Samma nyckel som är konfigurerad i Worker</div>
    </div>

    <div class="field checkbox-field">
      <input type="checkbox" id="enabled" ${isEnabled ? 'checked' : ''}>
      <label for="enabled">Aktivera synkronisering</label>
    </div>

    <div class="buttons">
      <button class="save" onclick="saveConfig()">Spara</button>
      <button class="test" onclick="testConnection()">Testa anslutning</button>
      <button class="cancel" onclick="google.script.host.close()">Avbryt</button>
    </div>

    <script>
      function saveConfig() {
        const url = document.getElementById('workerUrl').value;
        const secret = document.getElementById('secret').value;
        const enabled = document.getElementById('enabled').checked;

        google.script.run
          .withSuccessHandler(() => {
            alert('Konfiguration sparad!');
            google.script.host.close();
          })
          .withFailureHandler(err => alert('Fel: ' + err))
          .saveSyncConfig(url, secret, enabled);
      }

      function testConnection() {
        const url = document.getElementById('workerUrl').value;
        const secret = document.getElementById('secret').value;

        google.script.run
          .withSuccessHandler(result => alert(result))
          .withFailureHandler(err => alert('Fel: ' + err))
          .testSyncConnection(url, secret);
      }
    </script>
  `)
  .setWidth(550)
  .setHeight(400);

  SpreadsheetApp.getUi().showModalDialog(html, 'Sync-konfiguration');
}

/**
 * Save sync configuration
 */
function saveSyncConfig(url, secret, enabled) {
  const props = PropertiesService.getScriptProperties();

  props.setProperty(SYNC_CONFIG.WORKER_URL_KEY, url);
  props.setProperty(SYNC_CONFIG.WEBHOOK_SECRET_KEY, secret);
  props.setProperty(SYNC_CONFIG.ENABLED_KEY, enabled ? 'true' : 'false');

  Logger.log(`Sync config saved. Enabled: ${enabled}`);
}

/**
 * Test sync connection
 */
function testSyncConnection(url, secret) {
  try {
    const options = {
      method: 'get',
      headers: { 'X-Webhook-Secret': secret },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url + '/health', options);
    const status = response.getResponseCode();
    const body = response.getContentText();

    if (status === 200) {
      return 'Anslutning OK! Worker svarar korrekt.';
    } else {
      return `Fel: HTTP ${status} - ${body}`;
    }

  } catch (error) {
    return `Anslutningsfel: ${error.message}`;
  }
}

// ============================================================================
// TRIGGER INTEGRATION
// ============================================================================

/**
 * Install sync triggers
 * Called from main trigger setup
 */
function installSyncTriggers() {
  // onEdit trigger already exists, we hook into it
  // This is just for periodic full sync if needed

  const triggers = ScriptApp.getProjectTriggers();
  const hasSyncTrigger = triggers.some(t => t.getHandlerFunction() === 'periodicSync');

  if (!hasSyncTrigger) {
    ScriptApp.newTrigger('periodicSync')
      .timeBased()
      .everyHours(1)
      .create();

    Logger.log('Periodic sync trigger installed (every hour)');
  }
}

/**
 * Periodic sync (hourly)
 * Catches any missed changes
 */
function periodicSync() {
  if (!isSyncEnabled_()) return;

  // Get last sync time
  const props = PropertiesService.getScriptProperties();
  const lastSync = props.getProperty('LAST_PERIODIC_SYNC') || '1970-01-01T00:00:00Z';

  // For now, just log
  Logger.log(`Periodic sync running. Last sync: ${lastSync}`);

  // Update last sync time
  props.setProperty('LAST_PERIODIC_SYNC', new Date().toISOString());
}

// ============================================================================
// SYNC STATUS DIALOG
// ============================================================================

/**
 * Show sync status dialog with live information
 */
function showSyncStatusDialog() {
  const props = PropertiesService.getScriptProperties();
  const isEnabled = props.getProperty(SYNC_CONFIG.ENABLED_KEY) === 'true';
  const workerUrl = props.getProperty(SYNC_CONFIG.WORKER_URL_KEY) || '(ej konfigurerad)';
  const lastSync = props.getProperty('LAST_PERIODIC_SYNC') || 'Aldrig';
  const apiSecret = props.getProperty('API_SECRET') ? 'Konfigurerad' : 'Ej satt';

  // Test connection status
  let connectionStatus = 'Okänd';
  let connectionColor = '#666';

  if (isEnabled && workerUrl !== '(ej konfigurerad)') {
    try {
      const secret = props.getProperty(SYNC_CONFIG.WEBHOOK_SECRET_KEY) || '';
      const response = UrlFetchApp.fetch(workerUrl + '/health', {
        method: 'get',
        headers: { 'X-Webhook-Secret': secret },
        muteHttpExceptions: true
      });

      if (response.getResponseCode() === 200) {
        connectionStatus = 'Ansluten';
        connectionColor = '#34a853';
      } else {
        connectionStatus = 'Fel: HTTP ' + response.getResponseCode();
        connectionColor = '#ea4335';
      }
    } catch (e) {
      connectionStatus = 'Ej nåbar';
      connectionColor = '#ea4335';
    }
  }

  // Get post counts
  let postCounts = { total: 0, p1: 0, p2: 0, p3: 0, p4: 0 };
  try {
    const sheet = getDbSheet_(DB.POSTS);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const pn = data[i][POST_SCHEMA.PROGRAM_NR];
      postCounts.total++;
      if (pn === 1) postCounts.p1++;
      else if (pn === 2) postCounts.p2++;
      else if (pn === 3) postCounts.p3++;
      else if (pn === 4) postCounts.p4++;
    }
  } catch (e) { /* ignore */ }

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: 'Google Sans', Arial, sans-serif; padding: 20px; }
      h2 { color: #1a73e8; margin-bottom: 24px; }
      .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .status-card { background: #f8f9fa; padding: 16px; border-radius: 8px; }
      .status-card h3 { margin: 0 0 8px 0; font-size: 14px; color: #666; }
      .status-value { font-size: 18px; font-weight: 500; }
      .status-value.enabled { color: #34a853; }
      .status-value.disabled { color: #ea4335; }
      .connection-indicator { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }
      .section { margin-top: 24px; }
      .section h3 { color: #333; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
      td:first-child { color: #666; }
      td:last-child { text-align: right; font-weight: 500; }
      .buttons { margin-top: 24px; text-align: right; }
      button { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-left: 8px; }
      .primary { background: #1a73e8; color: white; }
      .secondary { background: #f1f3f4; }
    </style>

    <h2>Integrationsstatus</h2>

    <div class="status-grid">
      <div class="status-card">
        <h3>Supabase Sync</h3>
        <div class="status-value ${isEnabled ? 'enabled' : 'disabled'}">
          ${isEnabled ? '✓ Aktiverad' : '✗ Inaktiverad'}
        </div>
      </div>
      <div class="status-card">
        <h3>Worker-anslutning</h3>
        <div class="status-value">
          <span class="connection-indicator" style="background: ${connectionColor}"></span>
          ${connectionStatus}
        </div>
      </div>
    </div>

    <div class="section">
      <h3>Konfiguration</h3>
      <table>
        <tr><td>Worker URL</td><td>${workerUrl}</td></tr>
        <tr><td>Senaste sync</td><td>${lastSync}</td></tr>
        <tr><td>Intern API-nyckel</td><td>${apiSecret}</td></tr>
      </table>
    </div>

    <div class="section">
      <h3>Data i Sheets</h3>
      <table>
        <tr><td>Totalt antal poster</td><td>${postCounts.total}</td></tr>
        <tr><td>Program 1</td><td>${postCounts.p1} poster</td></tr>
        <tr><td>Program 2</td><td>${postCounts.p2} poster</td></tr>
        <tr><td>Program 3</td><td>${postCounts.p3} poster</td></tr>
        <tr><td>Program 4</td><td>${postCounts.p4} poster</td></tr>
      </table>
    </div>

    <div class="buttons">
      <button class="secondary" onclick="google.script.host.close()">Stäng</button>
      <button class="primary" onclick="google.script.run.showSyncConfigDialog(); google.script.host.close();">
        Konfigurera
      </button>
    </div>
  `)
  .setWidth(500)
  .setHeight(550);

  SpreadsheetApp.getUi().showModalDialog(html, 'Sync-status');
}

// ============================================================================
// EXTERNAL API MANAGEMENT
// ============================================================================

/**
 * Show external API dialog with keys and endpoints
 */
function showExternalApiDialog() {
  const props = PropertiesService.getScriptProperties();
  const apiSecret = props.getProperty('API_SECRET') || '';
  const hasApiSecret = apiSecret.length > 0;

  // Get the web app URL
  const scriptId = ScriptApp.getScriptId();
  const webAppUrl = `https://script.google.com/macros/s/${scriptId}/exec`;

  // Get client keys
  const clientKeys = JSON.parse(props.getProperty('CLIENT_API_KEYS') || '{}');
  const clientList = Object.entries(clientKeys).map(([name, key]) =>
    `<tr>
      <td>${name}</td>
      <td><code>${key.substring(0, 8)}...</code></td>
      <td>${clientKeys[name + '_created'] || 'Okänt'}</td>
      <td><button onclick="revokeKey('${name}')">Återkalla</button></td>
    </tr>`
  ).join('') || '<tr><td colspan="4" style="color:#666; text-align:center;">Inga klient-nycklar genererade</td></tr>';

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: 'Google Sans', Arial, sans-serif; padding: 20px; }
      h2 { color: #1a73e8; margin-bottom: 8px; }
      .subtitle { color: #666; margin-bottom: 24px; }
      .section { margin-bottom: 24px; }
      .section h3 { color: #333; margin-bottom: 12px; font-size: 14px; }
      .endpoint-box { background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 12px; }
      .endpoint-box label { font-weight: 500; display: block; margin-bottom: 4px; }
      .endpoint-box code { display: block; background: #fff; padding: 8px; border-radius: 4px; font-size: 12px; word-break: break-all; border: 1px solid #ddd; }
      .copy-btn { margin-top: 8px; padding: 4px 12px; background: #e8f0fe; border: none; border-radius: 4px; cursor: pointer; color: #1a73e8; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { text-align: left; padding: 8px; background: #f8f9fa; font-weight: 500; }
      td { padding: 8px; border-bottom: 1px solid #eee; }
      td button { padding: 4px 8px; background: #fce8e6; border: none; border-radius: 4px; cursor: pointer; color: #c5221f; }
      .status { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
      .status-dot { width: 10px; height: 10px; border-radius: 50%; }
      .status-dot.ok { background: #34a853; }
      .status-dot.warn { background: #ea4335; }
      .actions { display: flex; gap: 8px; margin-top: 24px; }
      button.primary { padding: 10px 20px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer; }
      button.secondary { padding: 10px 20px; background: #f1f3f4; border: none; border-radius: 4px; cursor: pointer; }
      .warning { background: #fef7e0; border: 1px solid #f9ab00; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    </style>

    <h2>Externa API-anslutningar</h2>
    <p class="subtitle">Hantera API-nycklar för Companion, vMix och andra externa system</p>

    <div class="status">
      <span class="status-dot ${hasApiSecret ? 'ok' : 'warn'}"></span>
      <span>API-autentisering: ${hasApiSecret ? 'Aktiverad' : 'Ej konfigurerad'}</span>
    </div>

    ${!hasApiSecret ? `
    <div class="warning">
      <strong>⚠️ Varning:</strong> Ingen API-nyckel är satt. API:et är öppet för alla.
      <br>Klicka "Generera master-nyckel" nedan för att aktivera autentisering.
    </div>
    ` : ''}

    <div class="section">
      <h3>API Endpoint</h3>
      <div class="endpoint-box">
        <label>Web App URL (för Companion/vMix)</label>
        <code id="webAppUrl">${webAppUrl}</code>
        <button class="copy-btn" onclick="copyToClipboard('webAppUrl')">Kopiera</button>
      </div>
    </div>

    <div class="section">
      <h3>Master API-nyckel</h3>
      <div class="endpoint-box">
        <label>API Secret (för Script Properties)</label>
        <code id="apiSecret">${hasApiSecret ? apiSecret : '(ej satt)'}</code>
        ${hasApiSecret ? '<button class="copy-btn" onclick="copyToClipboard(\'apiSecret\')">Kopiera</button>' : ''}
      </div>
    </div>

    <div class="section">
      <h3>Klient-nycklar</h3>
      <table>
        <thead>
          <tr><th>Namn</th><th>Nyckel</th><th>Skapad</th><th></th></tr>
        </thead>
        <tbody>
          ${clientList}
        </tbody>
      </table>
    </div>

    <div class="actions">
      <button class="secondary" onclick="google.script.host.close()">Stäng</button>
      <button class="primary" onclick="generateMasterKey()">
        ${hasApiSecret ? 'Regenerera master-nyckel' : 'Generera master-nyckel'}
      </button>
      <button class="primary" onclick="addClientKey()">Lägg till klient</button>
    </div>

    <script>
      function copyToClipboard(elementId) {
        const text = document.getElementById(elementId).innerText;
        navigator.clipboard.writeText(text).then(() => {
          alert('Kopierat till urklipp!');
        });
      }

      function generateMasterKey() {
        if (confirm('Detta kommer generera en ny master API-nyckel. Alla befintliga integrationer måste uppdateras. Fortsätt?')) {
          google.script.run
            .withSuccessHandler(() => {
              alert('Ny master-nyckel genererad!');
              google.script.host.close();
            })
            .withFailureHandler(err => alert('Fel: ' + err))
            .generateNewApiKey();
        }
      }

      function addClientKey() {
        const name = prompt('Ange namn för klienten (t.ex. "Companion Studio A"):');
        if (name) {
          google.script.run
            .withSuccessHandler(key => {
              alert('Klient-nyckel skapad!\\n\\nNyckel: ' + key + '\\n\\nSpara denna nyckel säkert.');
              google.script.host.close();
            })
            .withFailureHandler(err => alert('Fel: ' + err))
            .generateClientApiKey(name);
        }
      }

      function revokeKey(name) {
        if (confirm('Återkalla nyckel för "' + name + '"? Klienten kommer inte längre kunna ansluta.')) {
          google.script.run
            .withSuccessHandler(() => {
              alert('Nyckel återkallad');
              google.script.host.close();
            })
            .withFailureHandler(err => alert('Fel: ' + err))
            .revokeClientApiKey(name);
        }
      }
    </script>
  `)
  .setWidth(600)
  .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(html, 'API-hantering');
}

/**
 * Generate new master API key
 */
function generateNewApiKey() {
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('API_SECRET', key);

  Logger.log('New API secret generated');
  SpreadsheetApp.getActiveSpreadsheet().toast('Ny API-nyckel genererad', 'API', 3);

  return key;
}

/**
 * Generate client-specific API key
 */
function generateClientApiKey(clientName) {
  const props = PropertiesService.getScriptProperties();
  const clientKeys = JSON.parse(props.getProperty('CLIENT_API_KEYS') || '{}');

  const key = 'client_' + Utilities.getUuid().replace(/-/g, '');
  clientKeys[clientName] = key;
  clientKeys[clientName + '_created'] = new Date().toISOString().split('T')[0];

  props.setProperty('CLIENT_API_KEYS', JSON.stringify(clientKeys));

  Logger.log(`Client API key generated for: ${clientName}`);
  return key;
}

/**
 * Revoke client API key
 */
function revokeClientApiKey(clientName) {
  const props = PropertiesService.getScriptProperties();
  const clientKeys = JSON.parse(props.getProperty('CLIENT_API_KEYS') || '{}');

  delete clientKeys[clientName];
  delete clientKeys[clientName + '_created'];

  props.setProperty('CLIENT_API_KEYS', JSON.stringify(clientKeys));

  Logger.log(`Client API key revoked for: ${clientName}`);
}

/**
 * Pull all posts from Supabase
 */
function pullAllFromSupabase() {
  if (!isSyncEnabled_()) {
    SpreadsheetApp.getUi().alert('Sync är inte aktiverat. Konfigurera först.');
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Hämta från Supabase',
    'Detta kommer hämta alla poster från Supabase och skriva över lokala ändringar. Fortsätt?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  try {
    const response = sendToWorker_('/api/posts', {});

    if (response.success && response.posts) {
      let updated = 0;
      for (const post of response.posts) {
        handleInboundUpdate_(post);
        updated++;
      }

      ui.alert(`Hämtning klar!\n\nUppdaterade ${updated} poster från Supabase.`);
    } else {
      ui.alert('Kunde inte hämta data: ' + (response.error || 'Okänt fel'));
    }
  } catch (error) {
    ui.alert('Fel vid hämtning: ' + error.message);
  }
}

/**
 * Test API connection (menu wrapper)
 */
function testApiConnection() {
  const props = PropertiesService.getScriptProperties();
  const workerUrl = props.getProperty(SYNC_CONFIG.WORKER_URL_KEY);
  const secret = props.getProperty(SYNC_CONFIG.WEBHOOK_SECRET_KEY);

  if (!workerUrl) {
    SpreadsheetApp.getUi().alert('Worker URL är inte konfigurerad.\n\nGå till Integration > Konfigurera Supabase sync');
    return;
  }

  const result = testSyncConnection(workerUrl, secret);
  SpreadsheetApp.getUi().alert('API-test\n\n' + result);
}
