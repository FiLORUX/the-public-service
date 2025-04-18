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
    updatePost(postId, updates);
    
    // If duration was edited, recalculate rolling time
    if (dbField === 'duration') {
      recalculateRollingTime_(sheet, programNr);
    }
    
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

/**
 * Recalculate rolling time for a programme
 * Rolling time = cumulative duration
 */
function recalculateRollingTime_(sheet, programNr) {
  const posts = getAllPostsForProgram_(programNr);
  
  // Sort by sort_order
  posts.sort((a, b) => a[POST_SCHEMA.SORT_ORDER] - b[POST_SCHEMA.SORT_ORDER]);
  
  let cumulative = 0;
  posts.forEach((post, index) => {
    cumulative += post[POST_SCHEMA.DURATION];
    
    // Update rolling time in view (column F = Rullande)
    const viewRow = VIEW_CONFIG.DATA_START_ROW + index;
    sheet.getRange(viewRow, 6).setValue(formatDuration_(cumulative));
  });
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
 * Daily backup (example of time-based trigger)
 * Uncomment and install if you want automatic daily backups
 */
function dailyBackup() {
  // This could export to Google Drive, email, etc.
  Logger.log('Daily backup triggered at ' + new Date());
  // exportDatabaseToJson();
}

/**
 * Install time-based triggers (run manually if needed)
 */
function installTimeTriggers() {
  // Example: daily backup at 3 AM
  // ScriptApp.newTrigger('dailyBackup')
  //   .timeBased()
  //   .atHour(3)
  //   .everyDays(1)
  //   .create();
}

// ============================================================================
// API WEBHOOK HANDLERS (prepared for external integration)
// ============================================================================

/**
 * Handle incoming POST request (e.g. from Companion)
 * This is called when the script is deployed as a web app
 */
function doPost(e) {
  if (!API_CONFIG.ENABLED) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'API not enabled'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let response = {};
    
    switch (action) {
      case 'tc_in':
        response = handleTcIn_(data);
        break;
        
      case 'tc_out':
        response = handleTcOut_(data);
        break;
        
      case 'next_clip':
        response = handleNextClip_(data);
        break;
        
      case 'status_update':
        response = handleStatusUpdate_(data);
        break;
        
      default:
        response = { error: 'Unknown action' };
    }
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log(`API error: ${error.message}`);
    return ContentService.createTextOutput(JSON.stringify({
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET request (for status checks)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    system: SYSTEM_NAME,
    version: SYSTEM_VERSION,
    status: 'running',
    api_enabled: API_CONFIG.ENABLED
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// API ACTION HANDLERS (stubs for future implementation)
// ============================================================================

/**
 * Handle TC-In logging from external system
 */
function handleTcIn_(data) {
  // Validate webhook secret
  if (data.secret !== API_CONFIG.WEBHOOK_SECRET) {
    return { error: 'Invalid secret' };
  }
  
  const { post_id, tc_in, operator, clip_nr } = data;
  
  // Log to _DB_Logg
  const logSheet = getDbSheet_(DB.LOG);
  logSheet.appendRow([
    getTimestamp_(),
    post_id,
    operator,
    tc_in,
    '',  // tc_out (empty for now)
    clip_nr,
    '',  // duration (calculated later)
    'TC-IN logged'
  ]);
  
  // Update post status to "recording"
  updatePost(post_id, { status: POST_STATUS.RECORDING.key });
  
  return { success: true, message: `TC-IN logged for ${post_id}` };
}

/**
 * Handle TC-Out logging
 */
function handleTcOut_(data) {
  const { post_id, tc_out, clip_nr } = data;
  
  // Find matching TC-IN entry in log and update it
  const logSheet = getDbSheet_(DB.LOG);
  const logData = logSheet.getDataRange().getValues();
  
  for (let i = logData.length - 1; i >= 1; i--) {
    const row = logData[i];
    if (row[1] === post_id && row[5] === clip_nr && !row[4]) {
      // Found matching entry without TC-OUT
      const tcIn = row[3];
      const duration = calculateTcDuration_(tcIn, tc_out);
      
      // Update row
      logSheet.getRange(i + 1, 5).setValue(tc_out);
      logSheet.getRange(i + 1, 7).setValue(duration);
      logSheet.getRange(i + 1, 8).setValue('TC-OUT logged');
      
      // Update post status to "recorded"
      updatePost(post_id, { status: POST_STATUS.RECORDED.key });
      
      return { success: true, message: `TC-OUT logged for ${post_id}` };
    }
  }
  
  return { error: 'No matching TC-IN found' };
}

/**
 * Handle next clip request
 */
function handleNextClip_(data) {
  // Return info about next clip to record
  // This could be used by Companion to auto-fill clip number
  return { success: true, next_clip: 42 };  // Stub
}

/**
 * Handle status update
 */
function handleStatusUpdate_(data) {
  const { post_id, status } = data;
  updatePost(post_id, { status: status });
  return { success: true, message: `Status updated for ${post_id}` };
}

/**
 * Calculate duration between two timecodes
 */
function calculateTcDuration_(tcIn, tcOut) {
  // Parse HH:MM:SS format
  const parseTC = (tc) => {
    const parts = tc.split(':').map(p => parseInt(p, 10));
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  };
  
  return parseTC(tcOut) - parseTC(tcIn);
}
