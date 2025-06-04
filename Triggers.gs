/**
 * TRIGGERS & EVENT HANDLERS
 * 
 * Handles spreadsheet events (onEdit, onChange, onOpen)
 * Maintains data integrity and sync between views and database
 */

// ============================================================================
// INSTALLABLE TRIGGERS
// ============================================================================

/**
 * Install all necessary triggers
 * Run this manually once after deploying the script
 */
function installTriggers() {
  // Remove existing triggers first
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // OnOpen trigger (for custom menu)
  ScriptApp.newTrigger('onOpen')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onOpen()
    .create();
  
  // OnEdit trigger (for data validation and sync)
  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  
  Logger.log('All triggers installed');
  SpreadsheetApp.getUi().alert('Triggers installed successfully');
}

// ============================================================================
// ON EDIT HANDLER
// ============================================================================

/**
 * Main onEdit handler
 * This is called every time a cell is edited
 */
function onEditTrigger(e) {
  if (!e || !e.range) return;
  
  try {
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    const row = e.range.getRow();
    const col = e.range.getColumn();
    
    // Only handle edits in view sheets, not database sheets
    if (sheetName.startsWith('_DB_')) return;
    
    // Programme views (Program 1-4)
    if (sheetName.match(/^Program \d$/)) {
      handleProgramViewEdit_(e, sheet, row, col);
      return;
    }
    
    // Schedule view (read-only, but just in case)
    if (sheetName === VIEW.SCHEDULE) {
      // Schedule is read-only (QUERY formula), but user might try to edit
      // We could show a warning here if needed
      return;
    }
    
  } catch (error) {
    Logger.log(`onEditTrigger error: ${error.message}`);
    // Don't alert user for every edit error, just log it
  }
}

// ============================================================================
// PROGRAMME VIEW EDIT HANDLERS
// ============================================================================

/**
 * Handle edits in Programme view sheets
 */
function handleProgramViewEdit_(e, sheet, row, col) {
  // Ignore header rows
  if (row < VIEW_CONFIG.DATA_START_ROW) return;
  
  const programNr = parseInt(sheet.getName().match(/\d/)[0], 10);
  
  // Get post ID from column A
  const postId = sheet.getRange(row, 1).getValue();
  if (!postId || !postId.match(/^P\d:\d+$/)) return;
  
  // Determine which column was edited and update database accordingly
  const columnMap = {
    2: 'type',           // Typ
    3: 'title',          // Innehåll
    4: 'people_ids',     // Medverkande (needs special handling)
    5: 'duration',       // Dur (needs conversion)
    7: 'location',       // Plats
    8: 'recording_day',  // Dag
    9: 'status',         // Status
    10: 'notes'          // Anteckningar
  };
  
  const dbField = columnMap[col];
  if (!dbField) return;  // Column not mapped to database
  
  let newValue = e.value || e.range.getValue();
  
  // Special handling for specific fields
  if (dbField === 'duration') {
    // Convert time format to seconds
    newValue = parseDurationToSeconds_(newValue);
  }
  
  if (dbField === 'people_ids') {
    // If user enters names, convert to IDs
    newValue = convertPeopleNamesToIds_(newValue);
  }
  
  if (dbField === 'recording_day') {
    // Convert display name to key
    const dayMatch = Object.values(RECORDING_DAYS).find(d => d.display === newValue);
    if (dayMatch) newValue = dayMatch.key;
  }
  
  if (dbField === 'status') {
    // Convert display name to key
    const statusMatch = Object.values(POST_STATUS).find(s => s.display === newValue);
    if (statusMatch) newValue = statusMatch.key;
  }
  
  // Update database
  try {
    const updates = {};
    updates[dbField] = newValue;
    updatePost(postId, updates, 'ui');

    // Rolling time is calculated via ARRAYFORMULA in the view - no manual recalc needed

  } catch (error) {
    Logger.log(`Failed to update post ${postId}: ${error.message}`);
    e.range.setNote(`Update failed: ${error.message}`);
  }
}

/**
 * Convert people names to IDs
 * Creates new people if they don't exist
 */
function convertPeopleNamesToIds_(namesString) {
  if (!namesString) return '';
  
  const names = namesString.split(',').map(n => n.trim()).filter(n => n);
  const ids = [];
  
  names.forEach(name => {
    const existing = findPersonByName_(name);
    if (existing) {
      ids.push(existing[PERSON_SCHEMA.ID]);
    } else {
      // Create new person
      const newId = createPerson({ name: name });
      ids.push(newId);
    }
  });
  
  return ids.join(',');
}

// ============================================================================
// CURRENT POST HIGHLIGHTING
// ============================================================================
// Note: Rolling time is calculated via ARRAYFORMULA in Views.gs (F7)
// No manual recalculation needed - the formula updates automatically when
// durations change in _DB_Posts

/**
 * Highlight the currently recording post in programme views
 * Adds a visual indicator (border + background) to make it easy to spot
 */
function highlightCurrentPost_(postId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Parse post_id to get program number
    const match = postId.match(/^P(\d+):(\d+)$/);
    if (!match) return;

    const programNr = parseInt(match[1], 10);
    const sheetName = `Program ${programNr}`;
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) return;

    // Find the row with this post
    const data = sheet.getDataRange().getValues();
    let targetRow = -1;

    for (let i = VIEW_CONFIG.DATA_START_ROW - 1; i < data.length; i++) {
      if (data[i][0] === postId) {
        targetRow = i + 1;  // 1-based
        break;
      }
    }

    if (targetRow === -1) return;

    // Clear any previous "current" highlighting
    clearCurrentHighlight_(sheet);

    // Apply highlight to current row
    const rowRange = sheet.getRange(targetRow, 1, 1, 10);
    rowRange.setBorder(true, true, true, true, false, false, '#FF5722', SpreadsheetApp.BorderStyle.SOLID_THICK);

    // Store current post in document properties for reference
    const docProps = PropertiesService.getDocumentProperties();
    docProps.setProperty('CURRENT_POST', postId);
    docProps.setProperty('CURRENT_POST_SHEET', sheetName);
    docProps.setProperty('CURRENT_POST_ROW', String(targetRow));

    Logger.log(`Highlighted current post: ${postId} at row ${targetRow}`);

  } catch (error) {
    Logger.log(`Highlight error: ${error.message}`);
  }
}

/**
 * Clear current post highlighting from a sheet
 */
function clearCurrentHighlight_(sheet) {
  try {
    const docProps = PropertiesService.getDocumentProperties();
    const prevRow = docProps.getProperty('CURRENT_POST_ROW');
    const prevSheet = docProps.getProperty('CURRENT_POST_SHEET');

    if (prevRow && prevSheet === sheet.getName()) {
      const rowNum = parseInt(prevRow, 10);
      if (rowNum >= VIEW_CONFIG.DATA_START_ROW) {
        const rowRange = sheet.getRange(rowNum, 1, 1, 10);
        rowRange.setBorder(false, false, false, false, false, false);
      }
    }
  } catch (error) {
    Logger.log(`Clear highlight error: ${error.message}`);
  }
}

/**
 * Clear all current post highlighting (called when recording stops)
 */
function clearAllCurrentHighlights_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const docProps = PropertiesService.getDocumentProperties();

    const prevSheet = docProps.getProperty('CURRENT_POST_SHEET');
    const prevRow = docProps.getProperty('CURRENT_POST_ROW');

    if (prevSheet && prevRow) {
      const sheet = ss.getSheetByName(prevSheet);
      if (sheet) {
        const rowNum = parseInt(prevRow, 10);
        if (rowNum >= VIEW_CONFIG.DATA_START_ROW) {
          const rowRange = sheet.getRange(rowNum, 1, 1, 10);
          rowRange.setBorder(false, false, false, false, false, false);
        }
      }
    }

    // Clear properties
    docProps.deleteProperty('CURRENT_POST');
    docProps.deleteProperty('CURRENT_POST_SHEET');
    docProps.deleteProperty('CURRENT_POST_ROW');

  } catch (error) {
    Logger.log(`Clear all highlights error: ${error.message}`);
  }
}

/**
 * Get the currently recording post info
 */
function getCurrentPostInfo() {
  const docProps = PropertiesService.getDocumentProperties();
  const postId = docProps.getProperty('CURRENT_POST');

  if (!postId) {
    return { hasCurrentPost: false };
  }

  return {
    hasCurrentPost: true,
    post_id: postId,
    sheet: docProps.getProperty('CURRENT_POST_SHEET'),
    row: parseInt(docProps.getProperty('CURRENT_POST_ROW'), 10)
  };
}

/**
 * Navigate to and highlight the current recording post
 */
function goToCurrentPost() {
  const ui = SpreadsheetApp.getUi();
  const info = getCurrentPostInfo();

  if (!info.hasCurrentPost) {
    ui.alert('Ingen aktiv inspelning', 'Det finns ingen post som spelar in just nu.', ui.ButtonSet.OK);
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(info.sheet);

  if (!sheet) {
    ui.alert('Fel', `Kunde inte hitta bladet ${info.sheet}`, ui.ButtonSet.OK);
    return;
  }

  // Activate sheet and select the row
  sheet.activate();
  const range = sheet.getRange(info.row, 1, 1, 10);
  sheet.setActiveRange(range);

  // Ensure visible
  SpreadsheetApp.flush();
}

// ============================================================================
// CHANGE DETECTION (for database sheet edits)
// ============================================================================

/**
 * On change handler (detects external changes like imports)
 * This is more heavyweight, so only use for specific cases
 */
function onChangeTrigger(e) {
  if (!e) return;
  
  try {
    // Detect if database sheets were modified
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // If _DB_Posts was modified, refresh all programme views
    const dbPosts = ss.getSheetByName(DB.POSTS);
    if (dbPosts && e.source.getSheetId() === dbPosts.getSheetId()) {
      Logger.log('Database posts modified, refreshing views');
      // Refresh all views (expensive, so only do if really needed)
      // For now, just log it
    }
    
  } catch (error) {
    Logger.log(`onChangeTrigger error: ${error.message}`);
  }
}

// ============================================================================
// TIME-BASED TRIGGERS (future: for scheduled tasks)
// ============================================================================

/**
 * Automated backup - saves database to Google Drive
 * Runs automatically when time-based triggers are installed
 */
function dailyBackup() {
  Logger.log('Automated backup triggered at ' + new Date());

  try {
    // Gather all database data
    const dbData = {
      version: SYSTEM_VERSION,
      exported: getTimestamp_(),
      backup_type: 'automatic',
      posts: getDbSheet_(DB.POSTS).getDataRange().getValues(),
      people: getDbSheet_(DB.PEOPLE).getDataRange().getValues(),
      programs: getDbSheet_(DB.PROGRAMS).getDataRange().getValues(),
      post_types: getDbSheet_(DB.POST_TYPES).getDataRange().getValues(),
      log: getDbSheet_(DB.LOG).getDataRange().getValues(),
      settings: getDbSheet_(DB.SETTINGS).getDataRange().getValues()
    };

    const json = JSON.stringify(dbData, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `gudstjanst_backup_${timestamp}.json`;

    // Get or create backup folder in Google Drive
    const folderId = getOrCreateBackupFolder_();
    const folder = DriveApp.getFolderById(folderId);

    // Create backup file
    const file = folder.createFile(filename, json, MimeType.PLAIN_TEXT);

    // Clean up old backups (keep last 30)
    cleanupOldBackups_(folder, 30);

    Logger.log(`Backup created: ${filename} (${file.getId()})`);

    // Update settings with last backup time
    updateBackupTimestamp_();

    return { success: true, filename: filename, fileId: file.getId() };

  } catch (error) {
    Logger.log(`Backup error: ${error.message}\n${error.stack}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get or create backup folder in Google Drive
 */
function getOrCreateBackupFolder_() {
  const folderName = 'Gudstjänst_Backups';

  // Check if folder ID is stored in settings
  const settingsSheet = getDbSheet_(DB.SETTINGS);
  const settingsData = settingsSheet.getDataRange().getValues();

  for (let i = 1; i < settingsData.length; i++) {
    if (settingsData[i][0] === 'backup_folder_id') {
      const folderId = settingsData[i][1];
      // Verify folder still exists
      try {
        DriveApp.getFolderById(folderId);
        return folderId;
      } catch (e) {
        // Folder doesn't exist, create new one
      }
    }
  }

  // Create new folder
  const folder = DriveApp.createFolder(folderName);
  const folderId = folder.getId();

  // Store folder ID in settings
  settingsSheet.appendRow(['backup_folder_id', folderId, 'Google Drive folder for automatic backups']);

  Logger.log(`Created backup folder: ${folderName} (${folderId})`);
  return folderId;
}

/**
 * Clean up old backup files, keeping the most recent N
 */
function cleanupOldBackups_(folder, keepCount) {
  const files = folder.getFilesByType(MimeType.PLAIN_TEXT);
  const fileList = [];

  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().startsWith('gudstjanst_backup_')) {
      fileList.push({
        file: file,
        created: file.getDateCreated()
      });
    }
  }

  // Sort by date (newest first)
  fileList.sort((a, b) => b.created - a.created);

  // Delete files beyond keepCount
  for (let i = keepCount; i < fileList.length; i++) {
    Logger.log(`Deleting old backup: ${fileList[i].file.getName()}`);
    fileList[i].file.setTrashed(true);
  }
}

/**
 * Update last backup timestamp in settings
 */
function updateBackupTimestamp_() {
  const sheet = getDbSheet_(DB.SETTINGS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'last_backup') {
      sheet.getRange(i + 1, 2).setValue(getTimestamp_());
      return;
    }
  }

  // Add setting if not exists
  sheet.appendRow(['last_backup', getTimestamp_(), 'Last automatic backup timestamp']);
}

/**
 * Install time-based triggers for automatic backups
 * Run this once to enable automatic backups (3 times per day)
 */
function installBackupTriggers() {
  const ui = SpreadsheetApp.getUi();

  // Remove existing backup triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailyBackup') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new triggers: 3 AM, 11 AM, 7 PM
  ScriptApp.newTrigger('dailyBackup')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();

  ScriptApp.newTrigger('dailyBackup')
    .timeBased()
    .atHour(11)
    .everyDays(1)
    .create();

  ScriptApp.newTrigger('dailyBackup')
    .timeBased()
    .atHour(19)
    .everyDays(1)
    .create();

  Logger.log('Backup triggers installed: 03:00, 11:00, 19:00');
  ui.alert('Backup-triggers installerade', 'Automatisk backup körs nu 3 gånger per dag:\n• 03:00\n• 11:00\n• 19:00\n\nBackup-filer sparas i Google Drive-mappen "Gudstjänst_Backups".', ui.ButtonSet.OK);
}

/**
 * Remove all backup triggers
 */
function removeBackupTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailyBackup') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  const ui = SpreadsheetApp.getUi();
  ui.alert('Backup-triggers borttagna', `${removed} backup-trigger(s) har tagits bort.\n\nAutomatisk backup är nu inaktiverad.`, ui.ButtonSet.OK);
}

/**
 * Run manual backup now
 */
function runBackupNow() {
  const ui = SpreadsheetApp.getUi();

  const confirm = ui.alert(
    'Skapa backup nu?',
    'Detta skapar en backup av hela databasen till Google Drive.',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) {
    return;
  }

  const result = dailyBackup();

  if (result.success) {
    ui.alert('Backup klar!', `Backup skapad: ${result.filename}\n\nFilen finns i Google Drive-mappen "Gudstjänst_Backups".`, ui.ButtonSet.OK);
  } else {
    ui.alert('Backup misslyckades', `Fel: ${result.error}`, ui.ButtonSet.OK);
  }
}

/**
 * Legacy function - kept for backwards compatibility
 */
function installTimeTriggers() {
  installBackupTriggers();
}

// ============================================================================
// API SECURITY & RATE LIMITING
// ============================================================================

/**
 * Get API secret from Script Properties
 * Set via: Extensions > Apps Script > Project Settings > Script Properties
 */
function getApiSecret_() {
  return PropertiesService.getScriptProperties().getProperty('API_SECRET');
}

/**
 * Validate API authentication
 * Checks for api_key in query params, POST body, or X-API-Key header
 */
function validateApiAuth_(e, data) {
  const secret = getApiSecret_();

  // If no secret is set, allow all requests (for backwards compatibility)
  if (!secret) {
    return { valid: true, warning: 'API_SECRET not configured - API is unprotected' };
  }

  // Check various places for the API key
  const providedKey =
    e.parameter?.api_key ||           // Query param
    data?.api_key ||                  // POST body
    e.parameter?.key ||               // Alternative query param
    null;

  if (!providedKey) {
    return { valid: false, error: 'API key required. Provide api_key parameter.' };
  }

  if (providedKey !== secret) {
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: true };
}

/**
 * Rate limiting using Cache Service
 * Returns true if request is allowed, false if rate limited
 */
function checkRateLimit_(identifier) {
  const cache = CacheService.getScriptCache();
  const key = `rate_limit_${identifier}`;

  const current = cache.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= API_CONFIG.RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: 60 };
  }

  // Increment counter (expires after 60 seconds)
  cache.put(key, String(count + 1), 60);

  return {
    allowed: true,
    remaining: API_CONFIG.RATE_LIMIT - count - 1,
    count: count + 1
  };
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier_(e) {
  // Use a combination of available identifiers
  return e.parameter?.client_id || 'anonymous';
}

// ============================================================================
// WEB APP API - FULL IMPLEMENTATION FOR COMPANION/VMIX/BMD
// ============================================================================

/**
 * Handle incoming POST requests from external systems
 * Deploy as: Web App > Execute as: Me > Access: Anyone
 *
 * SECURITY:
 * - Set API_SECRET in Script Properties for authentication
 * - Rate limited to 60 requests/minute per client
 *
 * Supported actions:
 * - tc_in: Log timecode IN for a post
 * - tc_out: Log timecode OUT for a post
 * - status_update: Update post status
 * - get_posts: Get all posts for a program
 * - get_current: Get currently recording post
 * - get_next: Get next post to record
 * - set_recording: Set a specific post as "recording"
 * - mark_recorded: Mark post as recorded
 * - mark_approved: Mark post as approved
 */
function doPost(e) {
  // Set CORS headers for cross-origin requests
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const data = JSON.parse(e.postData.contents);

    // Check rate limiting
    const clientId = getClientIdentifier_(e);
    const rateCheck = checkRateLimit_(clientId);
    if (!rateCheck.allowed) {
      return output.setContent(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded. Maximum 60 requests per minute.',
        retry_after_seconds: rateCheck.resetIn
      }));
    }

    // Validate authentication
    const auth = validateApiAuth_(e, data);
    if (!auth.valid) {
      return output.setContent(JSON.stringify({
        success: false,
        error: auth.error
      }));
    }

    const action = data.action;

    // Log incoming request
    Logger.log(`API POST: action=${action}, data=${JSON.stringify(data)}`);

    let response = {};

    switch (action) {
      // Timecode logging
      case 'tc_in':
        response = handleTcIn_(data);
        break;
      case 'tc_out':
        response = handleTcOut_(data);
        break;

      // Status management
      case 'status_update':
        response = handleStatusUpdate_(data);
        break;
      case 'set_recording':
        response = handleSetRecording_(data);
        break;
      case 'mark_recorded':
        response = handleMarkRecorded_(data);
        break;
      case 'mark_approved':
        response = handleMarkApproved_(data);
        break;

      // Data retrieval
      case 'get_posts':
        response = handleGetPosts_(data);
        break;
      case 'get_current':
        response = handleGetCurrent_(data);
        break;
      case 'get_next':
        response = handleGetNext_(data);
        break;
      case 'get_post':
        response = handleGetPost_(data);
        break;
      case 'get_schedule':
        response = handleGetSchedule_(data);
        break;

      // Clip management
      case 'next_clip':
        response = handleNextClip_(data);
        break;
      case 'increment_clip':
        response = handleIncrementClip_(data);
        break;

      // Batch operations (for efficiency with large datasets)
      case 'batch_update':
        response = handleBatchUpdate_(data);
        break;
      case 'batch_get':
        response = handleBatchGet_(data);
        break;

      // Cache management
      case 'invalidate_cache':
        invalidateAllCaches();
        response = { success: true, message: 'All caches invalidated' };
        break;

      default:
        response = {
          success: false,
          error: `Unknown action: ${action}`,
          available_actions: [
            'tc_in', 'tc_out', 'status_update', 'set_recording',
            'mark_recorded', 'mark_approved', 'get_posts', 'get_current',
            'get_next', 'get_post', 'get_schedule', 'next_clip', 'increment_clip',
            'batch_update', 'batch_get', 'invalidate_cache'
          ]
        };
    }

    return output.setContent(JSON.stringify(response));

  } catch (error) {
    Logger.log(`API error: ${error.message}\n${error.stack}`);
    return output.setContent(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
}

/**
 * Handle GET requests - for status checks and data retrieval
 *
 * Query parameters:
 * - action: What to retrieve (status, posts, schedule, post)
 * - program: Program number (1-4)
 * - post_id: Specific post ID
 * - day: Recording day (dag1, dag2, dag3)
 */
function doGet(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const params = e.parameter || {};
    const action = params.action || 'status';

    // Check rate limiting
    const clientId = getClientIdentifier_(e);
    const rateCheck = checkRateLimit_(clientId);
    if (!rateCheck.allowed) {
      return output.setContent(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded. Maximum 60 requests per minute.',
        retry_after_seconds: rateCheck.resetIn
      }));
    }

    // Validate authentication (except for status endpoint)
    if (action !== 'status') {
      const auth = validateApiAuth_(e, {});
      if (!auth.valid) {
        return output.setContent(JSON.stringify({
          success: false,
          error: auth.error
        }));
      }
    }

    Logger.log(`API GET: action=${action}, params=${JSON.stringify(params)}`);

    let response = {};

    switch (action) {
      case 'status':
        response = {
          success: true,
          system: SYSTEM_NAME,
          version: SYSTEM_VERSION,
          timestamp: getTimestamp_(),
          endpoints: {
            POST: ['tc_in', 'tc_out', 'status_update', 'set_recording', 'mark_recorded', 'mark_approved', 'get_posts', 'get_current', 'get_next', 'get_post', 'get_schedule'],
            GET: ['status', 'posts', 'schedule', 'post', 'current', 'clip_counter']
          }
        };
        break;

      case 'posts':
        const programNr = parseInt(params.program) || 1;
        response = handleGetPosts_({ program_nr: programNr });
        break;

      case 'schedule':
        const day = params.day || null;
        response = handleGetSchedule_({ recording_day: day });
        break;

      case 'post':
        response = handleGetPost_({ post_id: params.post_id });
        break;

      case 'current':
        response = handleGetCurrent_({});
        break;

      case 'clip_counter':
        response = handleNextClip_({});
        break;

      default:
        response = {
          success: false,
          error: `Unknown action: ${action}`,
          available_actions: ['status', 'posts', 'schedule', 'post', 'current', 'clip_counter']
        };
    }

    return output.setContent(JSON.stringify(response));

  } catch (error) {
    Logger.log(`API GET error: ${error.message}`);
    return output.setContent(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
}

// ============================================================================
// TIMECODE LOGGING HANDLERS
// ============================================================================

/**
 * Handle TC-IN logging from Companion/BMD HyperDeck
 * Expected data: { post_id, tc_in, operator?, clip_nr? }
 */
function handleTcIn_(data) {
  const { post_id, tc_in, operator, clip_nr } = data;

  if (!post_id) {
    return { success: false, error: 'post_id required' };
  }

  // Log to _DB_Logg
  const logSheet = getDbSheet_(DB.LOG);
  const clipNumber = clip_nr || getNextClipNumber_();

  logSheet.appendRow([
    getTimestamp_(),
    post_id,
    operator || 'API',
    tc_in || getTimestamp_(),
    '',  // tc_out (filled later)
    clipNumber,
    '',  // duration (calculated on tc_out)
    'TC-IN'
  ]);

  // Update post status to "recording"
  try {
    updatePost(post_id, { status: POST_STATUS.RECORDING.key }, 'api');
    // Highlight current post in views
    highlightCurrentPost_(post_id);
  } catch (e) {
    Logger.log(`Warning: Could not update post status: ${e.message}`);
  }

  // Audit log
  logAudit_({
    action: 'tc_in',
    entity_type: 'post',
    entity_id: post_id,
    new_value: tc_in || 'auto',
    source: 'api',
    user: operator || 'api'
  });

  return {
    success: true,
    message: `TC-IN logged for ${post_id}`,
    post_id: post_id,
    tc_in: tc_in,
    clip_nr: clipNumber,
    status: POST_STATUS.RECORDING.key
  };
}

/**
 * Handle TC-OUT logging
 * Expected data: { post_id, tc_out, clip_nr? }
 */
function handleTcOut_(data) {
  const { post_id, tc_out, clip_nr } = data;

  if (!post_id) {
    return { success: false, error: 'post_id required' };
  }

  // Find matching TC-IN entry in log
  const logSheet = getDbSheet_(DB.LOG);
  const logData = logSheet.getDataRange().getValues();

  // Search from bottom (most recent first)
  for (let i = logData.length - 1; i >= 1; i--) {
    const row = logData[i];
    const logPostId = row[1];
    const logClipNr = row[5];
    const logTcOut = row[4];

    // Match by post_id and ensure tc_out is empty
    if (logPostId === post_id && !logTcOut) {
      // If clip_nr specified, must match
      if (clip_nr && logClipNr !== clip_nr) continue;

      const tcIn = row[3];
      const duration = tc_out && tcIn ? calculateTcDuration_(tcIn, tc_out) : 0;

      // Update log row
      logSheet.getRange(i + 1, 5).setValue(tc_out || getTimestamp_());
      logSheet.getRange(i + 1, 7).setValue(duration);
      logSheet.getRange(i + 1, 8).setValue('TC-OUT');

      // Update post status to "recorded"
      try {
        updatePost(post_id, { status: POST_STATUS.RECORDED.key }, 'api');
        // Clear current post highlighting since recording is done
        clearAllCurrentHighlights_();
      } catch (e) {
        Logger.log(`Warning: Could not update post status: ${e.message}`);
      }

      // Audit log
      logAudit_({
        action: 'tc_out',
        entity_type: 'post',
        entity_id: post_id,
        old_value: tcIn,
        new_value: tc_out || 'auto',
        field: `duration=${duration}s`,
        source: 'api'
      });

      return {
        success: true,
        message: `TC-OUT logged for ${post_id}`,
        post_id: post_id,
        tc_in: tcIn,
        tc_out: tc_out,
        duration_sec: duration,
        clip_nr: logClipNr,
        status: POST_STATUS.RECORDED.key
      };
    }
  }

  // Warn about missing TC-IN (but still allow logging for manual recovery)
  Logger.log(`Warning: No matching TC-IN found for ${post_id}`);

  return {
    success: false,
    error: `No matching TC-IN found for ${post_id}`,
    hint: 'Send tc_in action first, or check if post_id is correct'
  };
}

// ============================================================================
// STATUS MANAGEMENT HANDLERS
// ============================================================================

/**
 * Update post status
 * Expected data: { post_id, status }
 */
function handleStatusUpdate_(data) {
  const { post_id, status } = data;

  if (!post_id) {
    return { success: false, error: 'post_id required' };
  }

  // Validate status
  const validStatuses = Object.values(POST_STATUS).map(s => s.key);
  if (status && !validStatuses.includes(status)) {
    return {
      success: false,
      error: `Invalid status: ${status}`,
      valid_statuses: validStatuses
    };
  }

  try {
    updatePost(post_id, { status: status || POST_STATUS.PLANNED.key }, 'api');
    return {
      success: true,
      message: `Status updated for ${post_id}`,
      post_id: post_id,
      status: status
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Set specific post as "recording" (and clear any other recording posts)
 * Expected data: { post_id }
 */
function handleSetRecording_(data) {
  const { post_id } = data;

  if (!post_id) {
    return { success: false, error: 'post_id required' };
  }

  try {
    // Clear any currently recording posts in the same program
    const programMatch = post_id.match(/^P(\d):/);
    if (programMatch) {
      const progNr = parseInt(programMatch[1]);
      const posts = getAllPostsForProgram_(progNr);

      posts.forEach(post => {
        if (post[POST_SCHEMA.STATUS] === POST_STATUS.RECORDING.key) {
          updatePost(post[POST_SCHEMA.ID], { status: POST_STATUS.PLANNED.key }, 'api');
        }
      });
    }

    // Set this post as recording
    updatePost(post_id, { status: POST_STATUS.RECORDING.key }, 'api');

    return {
      success: true,
      message: `${post_id} set as recording`,
      post_id: post_id,
      status: POST_STATUS.RECORDING.key
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Mark post as recorded
 * Expected data: { post_id }
 */
function handleMarkRecorded_(data) {
  const { post_id } = data;

  if (!post_id) {
    return { success: false, error: 'post_id required' };
  }

  try {
    updatePost(post_id, { status: POST_STATUS.RECORDED.key }, 'api');
    return {
      success: true,
      message: `${post_id} marked as recorded`,
      post_id: post_id,
      status: POST_STATUS.RECORDED.key
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Mark post as approved
 * Expected data: { post_id }
 */
function handleMarkApproved_(data) {
  const { post_id } = data;

  if (!post_id) {
    return { success: false, error: 'post_id required' };
  }

  try {
    updatePost(post_id, { status: POST_STATUS.APPROVED.key }, 'api');
    return {
      success: true,
      message: `${post_id} marked as approved`,
      post_id: post_id,
      status: POST_STATUS.APPROVED.key
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DATA RETRIEVAL HANDLERS
// ============================================================================

/**
 * Get all posts for a program
 * Expected data: { program_nr }
 */
function handleGetPosts_(data) {
  const programNr = data.program_nr || 1;

  try {
    const posts = getAllPostsForProgram_(programNr);
    posts.sort((a, b) => a[POST_SCHEMA.SORT_ORDER] - b[POST_SCHEMA.SORT_ORDER]);

    const formattedPosts = posts.map(post => formatPostForApi_(post));

    return {
      success: true,
      program_nr: programNr,
      count: formattedPosts.length,
      posts: formattedPosts
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get specific post by ID
 * Expected data: { post_id }
 */
function handleGetPost_(data) {
  const { post_id } = data;

  if (!post_id) {
    return { success: false, error: 'post_id required' };
  }

  try {
    const sheet = getDbSheet_(DB.POSTS);
    const allData = sheet.getDataRange().getValues();

    for (let i = 1; i < allData.length; i++) {
      if (allData[i][POST_SCHEMA.ID] === post_id) {
        return {
          success: true,
          post: formatPostForApi_(allData[i])
        };
      }
    }

    return { success: false, error: `Post ${post_id} not found` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get currently recording post
 */
function handleGetCurrent_(data) {
  try {
    const sheet = getDbSheet_(DB.POSTS);
    const allData = sheet.getDataRange().getValues();

    for (let i = 1; i < allData.length; i++) {
      if (allData[i][POST_SCHEMA.STATUS] === POST_STATUS.RECORDING.key) {
        return {
          success: true,
          recording: true,
          post: formatPostForApi_(allData[i])
        };
      }
    }

    return {
      success: true,
      recording: false,
      post: null,
      message: 'No post currently recording'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get next post to record (first "planerad" post)
 * Expected data: { program_nr?, recording_day? }
 */
function handleGetNext_(data) {
  const { program_nr, recording_day } = data;

  try {
    const sheet = getDbSheet_(DB.POSTS);
    const allData = sheet.getDataRange().getValues();

    // Filter and sort posts
    let candidates = allData.slice(1).filter(post => {
      if (post[POST_SCHEMA.STATUS] !== POST_STATUS.PLANNED.key) return false;
      if (program_nr && post[POST_SCHEMA.PROGRAM_NR] !== program_nr) return false;
      if (recording_day && post[POST_SCHEMA.RECORDING_DAY] !== recording_day) return false;
      return true;
    });

    candidates.sort((a, b) => {
      // Sort by program, then sort_order
      if (a[POST_SCHEMA.PROGRAM_NR] !== b[POST_SCHEMA.PROGRAM_NR]) {
        return a[POST_SCHEMA.PROGRAM_NR] - b[POST_SCHEMA.PROGRAM_NR];
      }
      return a[POST_SCHEMA.SORT_ORDER] - b[POST_SCHEMA.SORT_ORDER];
    });

    if (candidates.length > 0) {
      return {
        success: true,
        has_next: true,
        post: formatPostForApi_(candidates[0]),
        remaining: candidates.length - 1
      };
    }

    return {
      success: true,
      has_next: false,
      post: null,
      message: 'No more posts to record'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get recording schedule
 * Expected data: { recording_day? }
 */
function handleGetSchedule_(data) {
  const { recording_day } = data;

  try {
    const sheet = getDbSheet_(DB.POSTS);
    const allData = sheet.getDataRange().getValues();

    let posts = allData.slice(1);

    // Filter by recording day if specified
    if (recording_day) {
      posts = posts.filter(p => p[POST_SCHEMA.RECORDING_DAY] === recording_day);
    }

    // Sort by recording day, then program, then sort order
    posts.sort((a, b) => {
      const dayOrder = { 'dag1': 1, 'dag2': 2, 'dag3': 3 };
      const dayA = dayOrder[a[POST_SCHEMA.RECORDING_DAY]] || 99;
      const dayB = dayOrder[b[POST_SCHEMA.RECORDING_DAY]] || 99;

      if (dayA !== dayB) return dayA - dayB;
      if (a[POST_SCHEMA.PROGRAM_NR] !== b[POST_SCHEMA.PROGRAM_NR]) {
        return a[POST_SCHEMA.PROGRAM_NR] - b[POST_SCHEMA.PROGRAM_NR];
      }
      return a[POST_SCHEMA.SORT_ORDER] - b[POST_SCHEMA.SORT_ORDER];
    });

    const schedule = posts.map(post => formatPostForApi_(post));

    // Calculate statistics (use database keys, not display names)
    const stats = {
      total: schedule.length,
      planned: schedule.filter(p => p.status === POST_STATUS.PLANNED.key).length,
      recording: schedule.filter(p => p.status === POST_STATUS.RECORDING.key).length,
      recorded: schedule.filter(p => p.status === POST_STATUS.RECORDED.key).length,
      approved: schedule.filter(p => p.status === POST_STATUS.APPROVED.key).length
    };

    return {
      success: true,
      recording_day: recording_day || 'all',
      stats: stats,
      schedule: schedule
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// CLIP COUNTER HANDLERS
// ============================================================================

/**
 * Get next clip number
 */
function handleNextClip_(data) {
  const nextClip = getNextClipNumber_();
  return {
    success: true,
    clip_nr: nextClip
  };
}

/**
 * Increment and return clip number
 */
function handleIncrementClip_(data) {
  const nextClip = getNextClipNumber_();

  // Store in settings for persistence
  const settingsSheet = getDbSheet_(DB.SETTINGS);
  const settingsData = settingsSheet.getDataRange().getValues();

  let found = false;
  for (let i = 1; i < settingsData.length; i++) {
    if (settingsData[i][0] === 'clip_counter') {
      settingsSheet.getRange(i + 1, 2).setValue(nextClip);
      found = true;
      break;
    }
  }

  if (!found) {
    settingsSheet.appendRow(['clip_counter', nextClip, 'Current clip counter']);
  }

  return {
    success: true,
    clip_nr: nextClip,
    message: `Clip counter incremented to ${nextClip}`
  };
}

/**
 * Get next clip number from log
 */
function getNextClipNumber_() {
  try {
    const logSheet = getDbSheet_(DB.LOG);
    const logData = logSheet.getDataRange().getValues();

    let maxClip = 0;
    for (let i = 1; i < logData.length; i++) {
      const clipNr = parseInt(logData[i][5]) || 0;
      if (clipNr > maxClip) maxClip = clipNr;
    }

    return maxClip + 1;
  } catch (e) {
    return 1;
  }
}

// ============================================================================
// BATCH API HANDLERS
// ============================================================================

/**
 * Batch update multiple posts at once
 * Expected data: { updates: [{post_id, status}, {post_id, status}, ...] }
 * More efficient than multiple single updates
 */
function handleBatchUpdate_(data) {
  const { updates } = data;

  if (!updates || !Array.isArray(updates)) {
    return { success: false, error: 'updates array required' };
  }

  if (updates.length > 50) {
    return { success: false, error: 'Maximum 50 updates per batch' };
  }

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  // Get all posts data once (more efficient than individual lookups)
  const sheet = getDbSheet_(DB.POSTS);
  const allData = sheet.getDataRange().getValues();

  // Create lookup map for faster access
  const postRowMap = new Map();
  for (let i = 1; i < allData.length; i++) {
    postRowMap.set(allData[i][POST_SCHEMA.ID], {
      rowIndex: i + 1,
      data: allData[i]
    });
  }

  // Process each update
  updates.forEach((update, index) => {
    const { post_id } = update;

    if (!post_id) {
      results.push({ index, post_id: null, success: false, error: 'post_id required' });
      errorCount++;
      return;
    }

    const postInfo = postRowMap.get(post_id);

    if (!postInfo) {
      results.push({ index, post_id, success: false, error: 'Post not found' });
      errorCount++;
      return;
    }

    try {
      // Build update object (excluding post_id and internal fields)
      const updateFields = {};
      Object.keys(update).forEach(key => {
        if (key !== 'post_id' && !key.startsWith('_')) {
          updateFields[key] = update[key];
        }
      });

      // Use existing updatePost function
      updatePost(post_id, updateFields, 'api_batch');

      results.push({ index, post_id, success: true });
      successCount++;

    } catch (error) {
      results.push({ index, post_id, success: false, error: error.message });
      errorCount++;
    }
  });

  return {
    success: errorCount === 0,
    message: `Batch complete: ${successCount} succeeded, ${errorCount} failed`,
    total: updates.length,
    success_count: successCount,
    error_count: errorCount,
    results: results
  };
}

/**
 * Batch get multiple posts by IDs
 * Expected data: { post_ids: ["P1:1", "P1:2", ...] }
 */
function handleBatchGet_(data) {
  const { post_ids } = data;

  if (!post_ids || !Array.isArray(post_ids)) {
    return { success: false, error: 'post_ids array required' };
  }

  if (post_ids.length > 100) {
    return { success: false, error: 'Maximum 100 posts per batch' };
  }

  // Get all posts data once
  const sheet = getDbSheet_(DB.POSTS);
  const allData = sheet.getDataRange().getValues();

  // Create lookup map
  const postMap = new Map();
  for (let i = 1; i < allData.length; i++) {
    postMap.set(allData[i][POST_SCHEMA.ID], allData[i]);
  }

  // Fetch requested posts
  const posts = [];
  const notFound = [];

  post_ids.forEach(postId => {
    const post = postMap.get(postId);
    if (post) {
      posts.push(formatPostForApi_(post));
    } else {
      notFound.push(postId);
    }
  });

  return {
    success: true,
    found: posts.length,
    not_found: notFound.length,
    posts: posts,
    missing: notFound
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format post data for API response
 */
function formatPostForApi_(postRow) {
  return {
    post_id: postRow[POST_SCHEMA.ID],
    program_nr: postRow[POST_SCHEMA.PROGRAM_NR],
    sort_order: postRow[POST_SCHEMA.SORT_ORDER],
    type: postRow[POST_SCHEMA.TYPE],
    title: postRow[POST_SCHEMA.TITLE],
    duration_sec: postRow[POST_SCHEMA.DURATION],
    duration_formatted: formatDuration_(postRow[POST_SCHEMA.DURATION] || 0),
    people_ids: postRow[POST_SCHEMA.PEOPLE_IDS],
    location: postRow[POST_SCHEMA.LOCATION],
    recording_day: postRow[POST_SCHEMA.RECORDING_DAY],
    recording_time: postRow[POST_SCHEMA.RECORDING_TIME],
    status: postRow[POST_SCHEMA.STATUS],
    notes: postRow[POST_SCHEMA.NOTES]
  };
}

/**
 * Calculate duration between two timecodes (HH:MM:SS or HH:MM:SS:FF)
 * Returns 0 if result would be negative (invalid timecode order)
 */
function calculateTcDuration_(tcIn, tcOut) {
  const parseTC = (tc) => {
    if (!tc) return 0;
    const parts = String(tc).split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length >= 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  const duration = parseTC(tcOut) - parseTC(tcIn);

  // Return 0 if negative (tcOut before tcIn is invalid)
  if (duration < 0) {
    Logger.log(`Warning: Negative duration calculated (tcIn=${tcIn}, tcOut=${tcOut})`);
    return 0;
  }

  return duration;
}
