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
