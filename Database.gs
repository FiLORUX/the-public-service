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
    
    // Seed initial data
    seedPostTypes_();
    seedPrograms_();
    
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
 */
function updatePost(postId, updates) {
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
  
  // Update specified fields
  const row = data[rowIndex - 1];  // Get existing row data
  
  Object.keys(updates).forEach(key => {
    const schemaIndex = POST_SCHEMA[key.toUpperCase()];
    if (schemaIndex !== undefined) {
      row[schemaIndex] = updates[key];
    }
  });
  
  // Update modified timestamp
  row[POST_SCHEMA.MODIFIED] = getTimestamp_();
  
  // Write back to sheet
  sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  
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
 * Delete post by ID
 */
function deletePost(postId) {
  const sheet = getDbSheet_(DB.POSTS);
  const data = sheet.getDataRange().getValues();
  
  // Find row
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][POST_SCHEMA.ID] === postId) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex === -1) {
    throw new Error(`Post ${postId} not found`);
  }
  
  sheet.deleteRow(rowIndex);
  Logger.log(`Deleted post: ${postId}`);
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
