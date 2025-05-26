/**
 * DATABASE LAYER
 * 
 * All database operations go through this layer.
 * This ensures data integrity and provides a clean API for views.
 * 
 * Philosophy:
 * - Database sheets are the single source of truth
 * - All writes happen here (views are read-only)
 * - Validation happens before write
 * - Returns data in consistent format
 */

// ============================================================================
// DATABASE INITIALISATION
// ============================================================================

/**
 * Bootstrap entire database structure
 * This is the ONE function to run when setting up a new spreadsheet
 */
function bootstrapDatabase() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    'Bootstrap Database',
    'This will create/reset the database structure. Existing data in database sheets will be CLEARED. Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    ui.alert('Bootstrap cancelled');
    return;
  }
  
  try {
    // Create database sheets
    createDbPostsSheet_();
    createDbPeopleSheet_();
    createDbProgramsSheet_();
    createDbPostTypesSheet_();
    createDbLogSheet_();
    createDbSettingsSheet_();
    createDbAuditSheet_();

    // Seed initial data
    seedPostTypes_();
    seedPrograms_();

    // Log bootstrap to audit
    logAudit_({
      action: 'bootstrap',
      entity_type: 'system',
      source: 'ui'
    });
    
    // Hide database sheets
    hideDbSheets_();
    
    // Create custom menu
    onOpen();
    
    ui.alert(
      'Success!',
      'Database initialised successfully.\\n\\nNext steps:\\n1. Edit programme metadata in _DB_Program\\n2. Add people to _DB_Personer\\n3. Start creating posts via Programme views',
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    ui.alert('Error', `Bootstrap failed: ${error.message}`, ui.ButtonSet.OK);
    Logger.log(`Bootstrap error: ${error.stack}`);
  }
}

// ============================================================================
// DATABASE SHEET CREATION
// ============================================================================

/**
 * Create _DB_Posts sheet (master post registry)
 */
function createDbPostsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB.POSTS);
  
  if (sheet) {
    // Clear existing data
    sheet.clear();
  } else {
    sheet = ss.insertSheet(DB.POSTS);
  }
  
  // Set headers
  const headerRange = sheet.getRange(1, 1, 1, POST_HEADERS.length);
  headerRange.setValues([POST_HEADERS]);
  headerRange.setBackground(COLOURS.HEADER_BG);
  headerRange.setFontColor(COLOURS.HEADER_TEXT);
  headerRange.setFontWeight('bold');
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Set column widths
  const widths = [80, 60, 80, 100, 250, 80, 150, 120, 120, 120, 200, 100, 100, 100, 150, 150, 150, 80, 150, 150];
  widths.forEach((width, index) => {
    sheet.setColumnWidth(index + 1, width);
  });
  
  // Protect sheet (users should edit via views, not directly)
  const protection = sheet.protect().setDescription('Database sheet - edit via Programme views');
  protection.setWarningOnly(true);
  
  Logger.log('Created _DB_Posts sheet');
}

/**
 * Create _DB_Personer sheet (people registry)
 */
function createDbPeopleSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB.PEOPLE);
  
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(DB.PEOPLE);
  }
  
  // Set headers
  const headerRange = sheet.getRange(1, 1, 1, PERSON_HEADERS.length);
  headerRange.setValues([PERSON_HEADERS]);
  headerRange.setBackground(COLOURS.HEADER_BG);
  headerRange.setFontColor(COLOURS.HEADER_TEXT);
  headerRange.setFontWeight('bold');
  
  sheet.setFrozenRows(1);
  
  // Set column widths
  sheet.setColumnWidth(1, 100);  // person_id
  sheet.setColumnWidth(2, 200);  // name
  sheet.setColumnWidth(3, 200);  // roles
  sheet.setColumnWidth(4, 200);  // contact
  sheet.setColumnWidth(5, 120);  // type
  sheet.setColumnWidth(6, 150);  // created
  
  Logger.log('Created _DB_Personer sheet');
}

/**
 * Create _DB_Program sheet (programme metadata)
 */
function createDbProgramsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB.PROGRAMS);
  
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(DB.PROGRAMS);
  }
  
  // Set headers
  const headerRange = sheet.getRange(1, 1, 1, PROGRAM_HEADERS.length);
  headerRange.setValues([PROGRAM_HEADERS]);
  headerRange.setBackground(COLOURS.HEADER_BG);
  headerRange.setFontColor(COLOURS.HEADER_TEXT);
  headerRange.setFontWeight('bold');
  
  sheet.setFrozenRows(1);
  
  // Set column widths
  const widths = [80, 200, 120, 120, 150, 100, 100, 100, 300, 150, 150];
  widths.forEach((width, index) => {
    sheet.setColumnWidth(index + 1, width);
  });
  
  Logger.log('Created _DB_Program sheet');
}

/**
 * Create _DB_PostTyper sheet (post type templates)
 */
function createDbPostTypesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB.POST_TYPES);
  
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(DB.POST_TYPES);
  }
  
  // Set headers
  const headerRange = sheet.getRange(1, 1, 1, POST_TYPE_HEADERS.length);
  headerRange.setValues([POST_TYPE_HEADERS]);
  headerRange.setBackground(COLOURS.HEADER_BG);
  headerRange.setFontColor(COLOURS.HEADER_TEXT);
  headerRange.setFontWeight('bold');
  
  sheet.setFrozenRows(1);
  
  // Set column widths
  const widths = [120, 150, 100, 50, 100, 150, 120, 120, 100, 80, 300];
  widths.forEach((width, index) => {
    sheet.setColumnWidth(index + 1, width);
  });
  
  Logger.log('Created _DB_PostTyper sheet');
}

/**
 * Create _DB_Logg sheet (timecode logging)
 */
function createDbLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB.LOG);
  
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(DB.LOG);
  }
  
  const headers = ['timestamp', 'post_id', 'operator', 'tc_in', 'tc_out', 'clip_nr', 'duration_sec', 'notes'];
  
  // Set headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground(COLOURS.HEADER_BG);
  headerRange.setFontColor(COLOURS.HEADER_TEXT);
  headerRange.setFontWeight('bold');
  
  sheet.setFrozenRows(1);
  
  // Set column widths
  sheet.setColumnWidth(1, 150);  // timestamp
  sheet.setColumnWidth(2, 80);   // post_id
  sheet.setColumnWidth(3, 120);  // operator
  sheet.setColumnWidth(4, 100);  // tc_in
  sheet.setColumnWidth(5, 100);  // tc_out
  sheet.setColumnWidth(6, 80);   // clip_nr
  sheet.setColumnWidth(7, 100);  // duration_sec
  sheet.setColumnWidth(8, 300);  // notes
  
  Logger.log('Created _DB_Logg sheet');
}

/**
 * Create _DB_Settings sheet (system settings)
 */
function createDbSettingsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB.SETTINGS);
  
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(DB.SETTINGS);
  }
  
  const headers = ['setting_key', 'setting_value', 'description'];
  
  // Set headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground(COLOURS.HEADER_BG);
  headerRange.setFontColor(COLOURS.HEADER_TEXT);
  headerRange.setFontWeight('bold');
  
  sheet.setFrozenRows(1);
  
  // Set column widths
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 300);
  sheet.setColumnWidth(3, 400);
  
  // Add initial settings
  const initialSettings = [
    ['system_version', SYSTEM_VERSION, 'Current system version'],
    ['last_bootstrap', getTimestamp_(), 'Last time database was bootstrapped'],
    ['api_enabled', 'false', 'Enable external API (Companion integration)'],
    ['default_start_time', '09:00:00', 'Default start time for Day 1 recording'],
    ['location_name', 'MARIAKYRKAN VÄXJÖ', 'Current recording location']
  ];
  
  sheet.getRange(2, 1, initialSettings.length, 3).setValues(initialSettings);
  
  Logger.log('Created _DB_Settings sheet');
}

/**
 * Create _DB_Audit sheet (audit log for tracking changes)
 */
function createDbAuditSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DB.AUDIT);

  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(DB.AUDIT);
  }

  const headers = [
    'timestamp',      // When the action occurred
    'user',           // Who performed the action (email if available)
    'action',         // create, update, delete, restore, etc.
    'entity_type',    // post, person, program, settings
    'entity_id',      // ID of the affected entity
    'field',          // Which field was changed (for updates)
    'old_value',      // Previous value
    'new_value',      // New value
    'source'          // ui, api, trigger, import
  ];

  // Set headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground(COLOURS.HEADER_BG);
  headerRange.setFontColor(COLOURS.HEADER_TEXT);
  headerRange.setFontWeight('bold');

  sheet.setFrozenRows(1);

  // Set column widths
  sheet.setColumnWidth(1, 160);  // timestamp
  sheet.setColumnWidth(2, 200);  // user
  sheet.setColumnWidth(3, 100);  // action
  sheet.setColumnWidth(4, 100);  // entity_type
  sheet.setColumnWidth(5, 100);  // entity_id
  sheet.setColumnWidth(6, 120);  // field
  sheet.setColumnWidth(7, 200);  // old_value
  sheet.setColumnWidth(8, 200);  // new_value
  sheet.setColumnWidth(9, 80);   // source

  Logger.log('Created _DB_Audit sheet');
}

/**
 * Log an action to the audit trail
 * @param {Object} auditData - Audit entry data
 */
function logAudit_(auditData) {
  try {
    const sheet = getDbSheet_(DB.AUDIT);

    // Get current user if possible
    let user = 'system';
    try {
      const email = Session.getActiveUser().getEmail();
      if (email) user = email;
    } catch (e) {
      // Session may not be available in triggers
    }

    const row = [
      getTimestamp_(),
      auditData.user || user,
      auditData.action || 'unknown',
      auditData.entity_type || '',
      auditData.entity_id || '',
      auditData.field || '',
      String(auditData.old_value || '').substring(0, 500),  // Truncate long values
      String(auditData.new_value || '').substring(0, 500),
      auditData.source || 'unknown'
    ];

    sheet.appendRow(row);

  } catch (error) {
    // Don't let audit logging errors break the main operation
    Logger.log(`Audit log error: ${error.message}`);
  }
}

// ============================================================================
// CACHING LAYER
// ============================================================================

/**
 * Cache for frequently accessed data
 * Uses CacheService for persistence across executions
 */
const CACHE_CONFIG = {
  POST_TYPES_KEY: 'cache_post_types',
  PEOPLE_KEY: 'cache_people',
  PROGRAMS_KEY: 'cache_programs',
  TTL_SECONDS: 300  // 5 minutes
};

/**
 * Get cached data or fetch from sheet
 * @param {String} cacheKey - Cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @returns {Array} - Cached or fresh data
 */
function getCachedData_(cacheKey, fetchFn) {
  const cache = CacheService.getScriptCache();

  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // Cache miss or parse error
  }

  // Fetch fresh data
  const data = fetchFn();

  // Store in cache
  try {
    cache.put(cacheKey, JSON.stringify(data), CACHE_CONFIG.TTL_SECONDS);
  } catch (e) {
    // Cache too large, skip caching
    Logger.log(`Cache put failed for ${cacheKey}: ${e.message}`);
  }

  return data;
}

/**
 * Invalidate specific cache
 */
function invalidateCache_(cacheKey) {
  const cache = CacheService.getScriptCache();
  cache.remove(cacheKey);
}

/**
 * Invalidate all caches
 */
function invalidateAllCaches() {
  const cache = CacheService.getScriptCache();
  cache.removeAll([
    CACHE_CONFIG.POST_TYPES_KEY,
    CACHE_CONFIG.PEOPLE_KEY,
    CACHE_CONFIG.PROGRAMS_KEY
  ]);
  Logger.log('All caches invalidated');
}

/**
 * Get all post types with caching
 */
function getAllPostTypesCached_() {
  return getCachedData_(CACHE_CONFIG.POST_TYPES_KEY, () => {
    const sheet = getDbSheet_(DB.POST_TYPES);
    const data = sheet.getDataRange().getValues();
    return data.slice(1);  // Skip header
  });
}

/**
 * Get all people with caching
 */
function getAllPeopleCached_() {
  return getCachedData_(CACHE_CONFIG.PEOPLE_KEY, () => {
    const sheet = getDbSheet_(DB.PEOPLE);
    const data = sheet.getDataRange().getValues();
    return data.slice(1);  // Skip header
  });
}

/**
 * Get post type by key with caching
 */
function getPostTypeByKeyCached_(typeKey) {
  const postTypes = getAllPostTypesCached_();

  for (let i = 0; i < postTypes.length; i++) {
    const row = postTypes[i];
    if (row[POST_TYPE_SCHEMA.TYPE_KEY] === typeKey) {
      return {
        type_key: row[POST_TYPE_SCHEMA.TYPE_KEY],
        display_name: row[POST_TYPE_SCHEMA.DISPLAY_NAME],
        default_duration_sec: row[POST_TYPE_SCHEMA.DEFAULT_DURATION],
        icon: row[POST_TYPE_SCHEMA.ICON],
        requires_people: row[POST_TYPE_SCHEMA.REQUIRES_PEOPLE],
        requires_text_author: row[POST_TYPE_SCHEMA.REQUIRES_TEXT_AUTHOR],
        requires_composer: row[POST_TYPE_SCHEMA.REQUIRES_COMPOSER],
        category: row[POST_TYPE_SCHEMA.CATEGORY],
        bg_colour: row[POST_TYPE_SCHEMA.BG_COLOUR],
        row_height: row[POST_TYPE_SCHEMA.ROW_HEIGHT],
        description: row[POST_TYPE_SCHEMA.DESCRIPTION]
      };
    }
  }

  return null;
}

/**
 * Find person by name with caching
 */
function findPersonByNameCached_(name) {
  if (!name) return null;

  const people = getAllPeopleCached_();
  const searchName = name.toLowerCase().trim();

  for (let i = 0; i < people.length; i++) {
    if (people[i][PERSON_SCHEMA.NAME].toLowerCase().trim() === searchName) {
      return people[i];
    }
  }

  return null;
}

/**
 * Get person name by ID with caching
 */
function getPersonNameByIdCached_(personId) {
  if (!personId) return '';

  const people = getAllPeopleCached_();

  for (let i = 0; i < people.length; i++) {
    if (people[i][PERSON_SCHEMA.ID] === personId) {
      return people[i][PERSON_SCHEMA.NAME];
    }
  }

  return personId;  // Return ID if not found
}

// ============================================================================
// SEED DATA
// ============================================================================

/**
 * Seed post types with default templates
 */
function seedPostTypes_() {
  const sheet = getDbSheet_(DB.POST_TYPES);
  
  // Clear existing data (keep headers)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  
  // Insert default post types
  if (DEFAULT_POST_TYPES.length > 0) {
    sheet.getRange(2, 1, DEFAULT_POST_TYPES.length, DEFAULT_POST_TYPES[0].length)
      .setValues(DEFAULT_POST_TYPES);
  }
  
  Logger.log(`Seeded ${DEFAULT_POST_TYPES.length} post types`);
}

/**
 * Seed programmes with initial metadata (empty, ready to fill)
 */
function seedPrograms_() {
  const sheet = getDbSheet_(DB.PROGRAMS);
  
  // Clear existing data
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  
  const timestamp = getTimestamp_();
  
  // Create 4 empty programme entries
  const programData = [
    [1, 'MARIAKYRKAN VÄXJÖ', '', '', '', '', 2610, '09:00:00', '', timestamp, timestamp],
    [2, 'MARIAKYRKAN VÄXJÖ', '', '', '', '', 2610, '09:00:00', '', timestamp, timestamp],
    [3, 'MARIAKYRKAN VÄXJÖ', '', '', '', '', 2610, '09:00:00', '', timestamp, timestamp],
    [4, 'MARIAKYRKAN VÄXJÖ', '', '', '', '', 2610, '09:00:00', '', timestamp, timestamp]
  ];
  
  sheet.getRange(2, 1, programData.length, programData[0].length).setValues(programData);
  
  Logger.log('Seeded 4 programme entries');
}

// ============================================================================
// DATABASE OPERATIONS - Posts
// ============================================================================

/**
 * Create new post
 * @param {Object} postData - Post data object
 * @returns {String} - Created post_id
 */
function createPost(postData) {
  const sheet = getDbSheet_(DB.POSTS);
  const timestamp = getTimestamp_();
  
  // Generate post_id: P{program_nr}:{next_sequence}
  const nextSeq = getNextPostSequence_(postData.program_nr);
  const postId = `P${postData.program_nr}:${nextSeq}`;
  
  // Get default values from post type if specified
  let defaultDuration = 60;  // 1 minute default
  let defaultType = postData.type || 'liturgi';
  
  if (postData.type) {
    const postType = getPostTypeByKey_(postData.type);
    if (postType) {
      defaultDuration = postType.default_duration_sec || defaultDuration;
    }
  }
  
  // Build row data (follow POST_SCHEMA order)
  const row = [
    postId,                                    // ID
    postData.program_nr,                       // PROGRAM_NR
    postData.sort_order || nextSeq,            // SORT_ORDER
    defaultType,                               // TYPE
    postData.title || '',                      // TITLE
    postData.duration || defaultDuration,      // DURATION
    postData.people_ids || '',                 // PEOPLE_IDS
    postData.location || '',                   // LOCATION
    postData.info_pos || '',                   // INFO_POS
    postData.graphics || '',                   // GRAPHICS
    postData.notes || '',                      // NOTES
    postData.recording_day || 'dag1',          // RECORDING_DAY
    postData.recording_time || '',             // RECORDING_TIME
    POST_STATUS.PLANNED.key,                   // STATUS
    postData.text_author || '',                // TEXT_AUTHOR
    postData.composer || '',                   // COMPOSER
    postData.arranger || '',                   // ARRANGER
    postData.open_text || false,               // OPEN_TEXT
    timestamp,                                 // CREATED
    timestamp                                  // MODIFIED
  ];
  
  // Append to sheet
  sheet.appendRow(row);

  // Audit log
  logAudit_({
    action: 'create',
    entity_type: 'post',
    entity_id: postId,
    new_value: postData.title || '',
    source: postData._source || 'ui'
  });

  Logger.log(`Created post: ${postId}`);
  return postId;
}

/**
 * Get next sequence number for a programme
 */
function getNextPostSequence_(programNr) {
  const posts = getAllPostsForProgram_(programNr);
  
  if (posts.length === 0) return 1;
  
  // Find highest sequence number
  let maxSeq = 0;
  posts.forEach(post => {
    const match = post[POST_SCHEMA.ID].match(/:(\d+)$/);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  });
  
  return maxSeq + 1;
}

/**
 * Get all posts for a specific programme
 * @param {Number} programNr - Programme number (1-4)
 * @returns {Array} - Array of post rows
 */
function getAllPostsForProgram_(programNr) {
  const sheet = getDbSheet_(DB.POSTS);
  const data = sheet.getDataRange().getValues();
  
  // Skip header row, filter by program_nr
  return data.slice(1).filter(row => row[POST_SCHEMA.PROGRAM_NR] === programNr);
}

/**
 * Update post by ID
 * @param {String} postId - Post ID
 * @param {Object} updates - Object with fields to update
 * @param {String} source - Source of update (ui, api, trigger)
 */
function updatePost(postId, updates, source) {
  const sheet = getDbSheet_(DB.POSTS);
  const data = sheet.getDataRange().getValues();

  // Find row with matching post_id
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {  // Skip header
    if (data[i][POST_SCHEMA.ID] === postId) {
      rowIndex = i + 1;  // Sheet rows are 1-based
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error(`Post ${postId} not found`);
  }

  // Get existing row data for audit logging
  const oldRow = [...data[rowIndex - 1]];
  const row = data[rowIndex - 1];

  // Track changes for audit
  const changes = [];

  Object.keys(updates).forEach(key => {
    if (key.startsWith('_')) return;  // Skip internal fields like _source
    const schemaIndex = POST_SCHEMA[key.toUpperCase()];
    if (schemaIndex !== undefined) {
      const oldValue = row[schemaIndex];
      const newValue = updates[key];
      if (oldValue !== newValue) {
        changes.push({ field: key, oldValue, newValue });
      }
      row[schemaIndex] = newValue;
    }
  });

  // Update modified timestamp
  row[POST_SCHEMA.MODIFIED] = getTimestamp_();

  // Write back to sheet
  sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);

  // Audit log for each changed field
  changes.forEach(change => {
    logAudit_({
      action: 'update',
      entity_type: 'post',
      entity_id: postId,
      field: change.field,
      old_value: change.oldValue,
      new_value: change.newValue,
      source: source || updates._source || 'ui'
    });
  });

  Logger.log(`Updated post: ${postId}`);
}

/**
 * Renumber all posts in a program sequentially
 * @param {Number} programNr - Programme number (1-4)
 */
function renumberPostsForProgram_(programNr) {
  const sheet = getDbSheet_(DB.POSTS);
  const data = sheet.getDataRange().getValues();

  // Get all posts for this program with their row indices
  const posts = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][POST_SCHEMA.PROGRAM_NR] === programNr) {
      posts.push({
        rowIndex: i + 1,  // 1-based
        sortOrder: data[i][POST_SCHEMA.SORT_ORDER],
        postId: data[i][POST_SCHEMA.ID]
      });
    }
  }

  // Sort by current sort_order
  posts.sort((a, b) => a.sortOrder - b.sortOrder);

  // Renumber sequentially (10, 20, 30, ...)
  posts.forEach((post, index) => {
    const newSortOrder = (index + 1) * 10;
    sheet.getRange(post.rowIndex, POST_SCHEMA.SORT_ORDER + 1).setValue(newSortOrder);
  });

  Logger.log(`Renumbered ${posts.length} posts for Program ${programNr}`);
}

/**
 * Renumber all posts in all programs
 */
function renumberAllPosts() {
  const ui = SpreadsheetApp.getUi();

  const confirm = ui.alert(
    'Omnumrera poster',
    'Detta kommer att omnumrera alla poster i alla program (1-4) så att sort_order blir sekventiell (10, 20, 30...).\n\nOrdningen på posterna ändras INTE, bara de interna sorteringsnumren.\n\nFortsätt?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) {
    return;
  }

  try {
    for (let i = 1; i <= 4; i++) {
      renumberPostsForProgram_(i);
    }

    ui.alert('Klart!', 'Alla poster har omnumrerats.', ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('Fel', `Kunde inte omnumrera: ${error.message}`, ui.ButtonSet.OK);
    Logger.log(`Renumber error: ${error.stack}`);
  }
}

/**
 * Delete post by ID (soft-delete: moves to trash sheet)
 * @param {String} postId - Post ID to delete
 * @param {Boolean} hardDelete - If true, permanently deletes (default: false)
 */
function deletePost(postId, hardDelete) {
  const sheet = getDbSheet_(DB.POSTS);
  const data = sheet.getDataRange().getValues();

  // Find row
  let rowIndex = -1;
  let postData = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][POST_SCHEMA.ID] === postId) {
      rowIndex = i + 1;
      postData = data[i];
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error(`Post ${postId} not found`);
  }

  // Soft delete: archive to trash before deletion
  if (!hardDelete) {
    archiveDeletedPost_(postData);
  }

  // Audit log
  logAudit_({
    action: hardDelete ? 'hard_delete' : 'delete',
    entity_type: 'post',
    entity_id: postId,
    old_value: postData[POST_SCHEMA.TITLE],
    source: 'ui'
  });

  sheet.deleteRow(rowIndex);
  Logger.log(`Deleted post: ${postId} (hard=${!!hardDelete})`);
}

/**
 * Archive deleted post to trash sheet for potential recovery
 */
function archiveDeletedPost_(postData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let trashSheet = ss.getSheetByName('_DB_Trash');

  // Create trash sheet if it doesn't exist
  if (!trashSheet) {
    trashSheet = ss.insertSheet('_DB_Trash');

    // Set headers (same as posts + deleted_at + deleted_by)
    const headers = [...POST_HEADERS, 'deleted_at', 'deleted_by'];
    const headerRange = trashSheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setBackground(COLOURS.HEADER_BG);
    headerRange.setFontColor(COLOURS.HEADER_TEXT);
    headerRange.setFontWeight('bold');
    trashSheet.setFrozenRows(1);
    trashSheet.hideSheet();
  }

  // Get current user
  let deletedBy = 'system';
  try {
    const email = Session.getActiveUser().getEmail();
    if (email) deletedBy = email;
  } catch (e) {}

  // Append post to trash with deletion metadata
  const trashRow = [...postData, getTimestamp_(), deletedBy];
  trashSheet.appendRow(trashRow);

  Logger.log(`Archived post ${postData[POST_SCHEMA.ID]} to trash`);
}

/**
 * Restore a deleted post from trash
 * @param {String} postId - Post ID to restore
 */
function restoreDeletedPost(postId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const trashSheet = ss.getSheetByName('_DB_Trash');

  if (!trashSheet) {
    throw new Error('Ingen papperskorg hittades');
  }

  const trashData = trashSheet.getDataRange().getValues();
  let rowIndex = -1;
  let postData = null;

  for (let i = 1; i < trashData.length; i++) {
    if (trashData[i][POST_SCHEMA.ID] === postId) {
      rowIndex = i + 1;
      postData = trashData[i].slice(0, POST_HEADERS.length);  // Remove deleted_at, deleted_by
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error(`Post ${postId} hittades inte i papperskorgen`);
  }

  // Restore to main posts sheet
  const postsSheet = getDbSheet_(DB.POSTS);

  // Update timestamps
  postData[POST_SCHEMA.MODIFIED] = getTimestamp_();

  postsSheet.appendRow(postData);

  // Remove from trash
  trashSheet.deleteRow(rowIndex);

  // Audit log
  logAudit_({
    action: 'restore',
    entity_type: 'post',
    entity_id: postId,
    new_value: postData[POST_SCHEMA.TITLE],
    source: 'ui'
  });

  Logger.log(`Restored post ${postId} from trash`);
  return postId;
}

/**
 * Get all deleted posts from trash
 */
function getDeletedPosts_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const trashSheet = ss.getSheetByName('_DB_Trash');

  if (!trashSheet) {
    return [];
  }

  const data = trashSheet.getDataRange().getValues();
  return data.slice(1).map(row => ({
    post_id: row[POST_SCHEMA.ID],
    program_nr: row[POST_SCHEMA.PROGRAM_NR],
    title: row[POST_SCHEMA.TITLE],
    type: row[POST_SCHEMA.TYPE],
    deleted_at: row[POST_HEADERS.length],
    deleted_by: row[POST_HEADERS.length + 1]
  }));
}

/**
 * Empty trash (permanently delete all trashed posts)
 */
function emptyTrash() {
  const ui = SpreadsheetApp.getUi();

  const confirm = ui.alert(
    'Töm papperskorgen?',
    'Detta kommer att PERMANENT radera alla poster i papperskorgen.\n\nDetta kan inte ångras!',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const trashSheet = ss.getSheetByName('_DB_Trash');

  if (!trashSheet) {
    ui.alert('Papperskorgen är tom');
    return;
  }

  const count = trashSheet.getLastRow() - 1;

  if (count > 0) {
    trashSheet.deleteRows(2, count);

    logAudit_({
      action: 'empty_trash',
      entity_type: 'system',
      old_value: `${count} posts`,
      source: 'ui'
    });
  }

  ui.alert('Papperskorgen tömd', `${count} poster har raderats permanent.`, ui.ButtonSet.OK);
}

// ============================================================================
// PROGRAM ARCHIVING
// ============================================================================

/**
 * Archive a program to Google Drive (for historical records)
 * Creates a JSON backup of the program and all its posts
 */
function archiveProgram(programNr) {
  const ui = SpreadsheetApp.getUi();

  // Validate program number
  if (programNr < 1 || programNr > 4) {
    throw new Error('Invalid program number. Must be 1-4.');
  }

  // Get program data
  const programsSheet = getDbSheet_(DB.PROGRAMS);
  const programsData = programsSheet.getDataRange().getValues();
  let programRow = null;

  for (let i = 1; i < programsData.length; i++) {
    if (programsData[i][0] === programNr) {
      programRow = programsData[i];
      break;
    }
  }

  if (!programRow) {
    throw new Error(`Program ${programNr} not found`);
  }

  // Get all posts for this program
  const posts = getAllPostsForProgram_(programNr);

  if (posts.length === 0) {
    throw new Error(`Program ${programNr} has no posts to archive`);
  }

  // Build archive object
  const archive = {
    archived_at: getTimestamp_(),
    system_version: SYSTEM_VERSION,
    program: {
      program_nr: programNr,
      location: programRow[1],
      production_date: programRow[2],
      broadcast_date: programRow[3],
      theme: programRow[4],
      season: programRow[5],
      target_duration: programRow[6],
      start_time: programRow[7],
      notes: programRow[8]
    },
    posts: posts.map(row => ({
      post_id: row[POST_SCHEMA.ID],
      sort_order: row[POST_SCHEMA.SORT_ORDER],
      type: row[POST_SCHEMA.TYPE],
      title: row[POST_SCHEMA.TITLE],
      duration: row[POST_SCHEMA.DURATION],
      people_ids: row[POST_SCHEMA.PEOPLE_IDS],
      location: row[POST_SCHEMA.LOCATION],
      info_pos: row[POST_SCHEMA.INFO_POS],
      graphics: row[POST_SCHEMA.GRAPHICS],
      notes: row[POST_SCHEMA.NOTES],
      recording_day: row[POST_SCHEMA.RECORDING_DAY],
      recording_time: row[POST_SCHEMA.RECORDING_TIME],
      status: row[POST_SCHEMA.STATUS],
      text_author: row[POST_SCHEMA.TEXT_AUTHOR],
      composer: row[POST_SCHEMA.COMPOSER],
      arranger: row[POST_SCHEMA.ARRANGER],
      open_text: row[POST_SCHEMA.OPEN_TEXT],
      created: row[POST_SCHEMA.CREATED],
      modified: row[POST_SCHEMA.MODIFIED]
    })),
    stats: {
      total_posts: posts.length,
      total_duration: posts.reduce((sum, p) => sum + (p[POST_SCHEMA.DURATION] || 0), 0),
      by_status: {
        planned: posts.filter(p => p[POST_SCHEMA.STATUS] === POST_STATUS.PLANNED.key).length,
        recorded: posts.filter(p => p[POST_SCHEMA.STATUS] === POST_STATUS.RECORDED.key).length,
        approved: posts.filter(p => p[POST_SCHEMA.STATUS] === POST_STATUS.APPROVED.key).length
      }
    }
  };

  // Save to Google Drive
  const folder = getOrCreateArchiveFolder_();
  const filename = `archive_program${programNr}_${archive.program.production_date || 'undated'}_${getTimestamp_().replace(/[: ]/g, '-')}.json`;

  folder.createFile(filename, JSON.stringify(archive, null, 2), MimeType.PLAIN_TEXT);

  // Audit log
  logAudit_({
    action: 'archive',
    entity_type: 'program',
    entity_id: String(programNr),
    new_value: filename,
    source: 'ui'
  });

  Logger.log(`Archived program ${programNr} to ${filename}`);

  return { success: true, filename: filename, posts_count: posts.length };
}

/**
 * Get or create archive folder in Google Drive
 */
function getOrCreateArchiveFolder_() {
  const folderName = 'Gudstjänst_Arkiv';

  // Check if we have a stored folder ID
  const settingsSheet = getDbSheet_(DB.SETTINGS);
  const settingsData = settingsSheet.getDataRange().getValues();

  let folderId = null;
  for (let i = 1; i < settingsData.length; i++) {
    if (settingsData[i][0] === 'archive_folder_id') {
      folderId = settingsData[i][1];
      break;
    }
  }

  // Try to get existing folder
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      // Folder was deleted or not accessible
    }
  }

  // Create new folder
  const folder = DriveApp.createFolder(folderName);
  const newFolderId = folder.getId();

  // Store folder ID in settings
  let found = false;
  for (let i = 1; i < settingsData.length; i++) {
    if (settingsData[i][0] === 'archive_folder_id') {
      settingsSheet.getRange(i + 1, 2).setValue(newFolderId);
      found = true;
      break;
    }
  }
  if (!found) {
    settingsSheet.appendRow(['archive_folder_id', newFolderId, 'Google Drive folder for archived programs']);
  }

  return folder;
}

/**
 * Clear all posts from a program (after archiving)
 */
function clearProgramPosts(programNr) {
  const ui = SpreadsheetApp.getUi();

  const confirm = ui.alert(
    'Rensa program?',
    `Detta kommer att TA BORT ALLA poster från Program ${programNr}.\n\n` +
    'Se till att du har arkiverat programmet först!\n\n' +
    'Denna åtgärd kan INTE ångras.',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) {
    return { success: false, cancelled: true };
  }

  const postsSheet = getDbSheet_(DB.POSTS);
  const data = postsSheet.getDataRange().getValues();

  // Find rows to delete (from bottom up to preserve row indices)
  const rowsToDelete = [];
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][POST_SCHEMA.PROGRAM_NR] === programNr) {
      rowsToDelete.push(i + 1);  // 1-based
    }
  }

  // Delete rows
  rowsToDelete.forEach(rowIndex => {
    postsSheet.deleteRow(rowIndex);
  });

  // Audit log
  logAudit_({
    action: 'clear_program',
    entity_type: 'program',
    entity_id: String(programNr),
    old_value: `${rowsToDelete.length} posts`,
    source: 'ui'
  });

  // Reset program metadata (optional - keep location)
  const programsSheet = getDbSheet_(DB.PROGRAMS);
  const programsData = programsSheet.getDataRange().getValues();

  for (let i = 1; i < programsData.length; i++) {
    if (programsData[i][0] === programNr) {
      const timestamp = getTimestamp_();
      // Clear production/broadcast dates, theme, etc but keep location and target duration
      programsSheet.getRange(i + 1, 3).setValue('');  // production_date
      programsSheet.getRange(i + 1, 4).setValue('');  // broadcast_date
      programsSheet.getRange(i + 1, 5).setValue('');  // theme
      programsSheet.getRange(i + 1, 9).setValue('');  // notes
      programsSheet.getRange(i + 1, 11).setValue(timestamp);  // modified
      break;
    }
  }

  ui.alert('Program rensat', `${rowsToDelete.length} poster har tagits bort från Program ${programNr}.`, ui.ButtonSet.OK);

  return { success: true, deleted_count: rowsToDelete.length };
}

/**
 * Archive and clear a program (combined operation)
 */
function archiveAndClearProgram(programNr) {
  const ui = SpreadsheetApp.getUi();

  const confirm = ui.alert(
    `Arkivera och rensa Program ${programNr}?`,
    `Detta kommer att:\n\n` +
    `1. Spara en arkivkopia till Google Drive\n` +
    `2. Ta bort alla poster från programmet\n\n` +
    `Programmet blir sedan redo för en ny produktion.`,
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) {
    return;
  }

  try {
    // First archive
    const archiveResult = archiveProgram(programNr);

    if (!archiveResult.success) {
      ui.alert('Arkivering misslyckades', archiveResult.error || 'Okänt fel', ui.ButtonSet.OK);
      return;
    }

    // Then clear (without additional confirmation)
    const postsSheet = getDbSheet_(DB.POSTS);
    const data = postsSheet.getDataRange().getValues();

    const rowsToDelete = [];
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][POST_SCHEMA.PROGRAM_NR] === programNr) {
        rowsToDelete.push(i + 1);
      }
    }

    rowsToDelete.forEach(rowIndex => {
      postsSheet.deleteRow(rowIndex);
    });

    logAudit_({
      action: 'archive_and_clear',
      entity_type: 'program',
      entity_id: String(programNr),
      new_value: archiveResult.filename,
      source: 'ui'
    });

    ui.alert(
      'Klart!',
      `Program ${programNr} har arkiverats och rensats.\n\n` +
      `Arkivfil: ${archiveResult.filename}\n` +
      `Poster arkiverade: ${archiveResult.posts_count}\n\n` +
      `Programmet är nu redo för en ny produktion.`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('Fel', error.message, ui.ButtonSet.OK);
  }
}

// ============================================================================
// DATABASE OPERATIONS - People
// ============================================================================

/**
 * Create new person
 */
function createPerson(personData) {
  const sheet = getDbSheet_(DB.PEOPLE);
  const timestamp = getTimestamp_();
  
  // Generate person_id
  const personId = generateId_('P');
  
  const row = [
    personId,
    personData.name || '',
    personData.roles || '',
    personData.contact || '',
    personData.type || 'medverkande',
    timestamp
  ];
  
  sheet.appendRow(row);
  Logger.log(`Created person: ${personId}`);
  return personId;
}

/**
 * Get all people
 */
function getAllPeople_() {
  const sheet = getDbSheet_(DB.PEOPLE);
  const data = sheet.getDataRange().getValues();
  return data.slice(1);  // Skip header
}

/**
 * Get person name by ID
 * @param {String} personId - Person ID (e.g. "PXYZ123")
 * @returns {String} - Person name or original ID if not found
 */
function getPersonNameById_(personId) {
  if (!personId) return '';

  const sheet = getDbSheet_(DB.PEOPLE);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][PERSON_SCHEMA.ID] === personId) {
      return data[i][PERSON_SCHEMA.NAME];
    }
  }

  return personId;  // Return ID if not found
}

/**
 * Convert comma-separated person IDs to names
 * @param {String} peopleIds - Comma-separated person IDs
 * @returns {String} - Comma-separated names
 */
function convertPeopleIdsToNames(peopleIds) {
  if (!peopleIds) return '';

  const ids = peopleIds.split(',').map(id => id.trim()).filter(id => id);
  const names = ids.map(id => getPersonNameById_(id));

  return names.join(', ');
}

/**
 * Custom function for use in spreadsheet formulas
 * @param {String} peopleIds - Comma-separated person IDs
 * @returns {String} - Comma-separated names
 * @customfunction
 */
function PEOPLE_NAMES(peopleIds) {
  return convertPeopleIdsToNames(peopleIds);
}

// ============================================================================
// DATABASE OPERATIONS - Post Types
// ============================================================================

/**
 * Get post type by key
 */
function getPostTypeByKey_(typeKey) {
  const sheet = getDbSheet_(DB.POST_TYPES);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[POST_TYPE_SCHEMA.TYPE_KEY] === typeKey) {
      return {
        type_key: row[POST_TYPE_SCHEMA.TYPE_KEY],
        display_name: row[POST_TYPE_SCHEMA.DISPLAY_NAME],
        default_duration_sec: row[POST_TYPE_SCHEMA.DEFAULT_DURATION],
        icon: row[POST_TYPE_SCHEMA.ICON],
        requires_people: row[POST_TYPE_SCHEMA.REQUIRES_PEOPLE],
        requires_text_author: row[POST_TYPE_SCHEMA.REQUIRES_TEXT_AUTHOR],
        requires_composer: row[POST_TYPE_SCHEMA.REQUIRES_COMPOSER],
        category: row[POST_TYPE_SCHEMA.CATEGORY],
        bg_colour: row[POST_TYPE_SCHEMA.BG_COLOUR],
        row_height: row[POST_TYPE_SCHEMA.ROW_HEIGHT],
        description: row[POST_TYPE_SCHEMA.DESCRIPTION]
      };
    }
  }
  
  return null;
}

/**
 * Get all post types
 */
function getAllPostTypes_() {
  const sheet = getDbSheet_(DB.POST_TYPES);
  const data = sheet.getDataRange().getValues();
  return data.slice(1);  // Skip header
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Hide all database sheets
 */
function hideDbSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Object.values(DB).forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      sheet.hideSheet();
      sheet.setTabColor(COLOURS.DB_SHEET_TAB);
    }
  });
  
  Logger.log('Hidden all database sheets');
}

/**
 * Show all database sheets (for debugging/manual editing)
 */
function showDbSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Object.values(DB).forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.isSheetHidden()) {
      sheet.showSheet();
    }
  });
  
  SpreadsheetApp.getUi().alert('Database sheets are now visible');
}
