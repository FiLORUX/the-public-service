/**
 * USER INTERFACE LAYER
 * 
 * Custom menus, dialogues, and user interactions.
 * This provides the "control panel" for the system.
 */

// ============================================================================
// CUSTOM MENU (appears in Google Sheets UI)
// ============================================================================

/**
 * Create custom menu on spreadsheet open
 * This is automatically called by onOpen trigger
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('📋 System')
    .addItem('🚀 Bootstrap Database', 'bootstrapDatabase')
    .addItem('🔄 Generate All Views', 'generateAllViews')
    .addSeparator()
    .addItem('👁️ Show Database Sheets', 'showDbSheets')
    .addItem('💾 Backup to JSON', 'exportDatabaseToJson')
    .addSeparator()
    .addItem('📖 Documentation', 'showDocumentation')
    .addItem('ℹ️ About', 'showAbout')
    .addToUi();
  
  ui.createMenu('📝 Poster')
    .addItem('➕ Lägg till ny post', 'showAddPostDialog')
    .addItem('📋 Import poster (CSV/TSV)', 'showImportDialog')
    .addSeparator()
    .addItem('🗑️ Radera vald post', 'deleteCurrentPost')
    .addItem('⬆️ Flytta post upp', 'movePostUp')
    .addItem('⬇️ Flytta post ner', 'movePostDown')
    .addSeparator()
    .addItem('🔢 Omnumrera alla poster', 'renumberAllPosts')
    .addToUi();
  
  ui.createMenu('👥 Personer')
    .addItem('➕ Lägg till person', 'showAddPersonDialog')
    .addItem('📋 Visa alla personer', 'showPeopleList')
    .addToUi();
  
  ui.createMenu('🎬 Produktion')
    .addItem('📅 Visa inspelningsschema', 'goToScheduleView')
    .addItem('📊 Visa översikt', 'goToOverviewView')
    .addItem('📜 Visa kreditlista', 'goToCreditsView')
    .addSeparator()
    .addItem('✅ Markera post som inspelad', 'markCurrentPostRecorded')
    .addItem('⏺️ Markera post som spelar in', 'markCurrentPostRecording')
    .addToUi();
  
  ui.createMenu('⚙️ Inställningar')
    .addItem('🎨 Redigera posttyper', 'goToPostTypesSheet')
    .addItem('📝 Redigera program­metadata', 'goToProgramsSheet')
    .addItem('🔧 System­inställningar', 'showSettingsDialog')
    .addToUi();
}

// ============================================================================
// POST MANAGEMENT DIALOGUES
// ============================================================================

/**
 * Show dialogue for adding new post
 */
function showAddPostDialog() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  
  // Determine which programme we're in
  const sheetName = activeSheet.getName();
  const match = sheetName.match(/Program (\d)/);
  
  let defaultProgramNr = 1;
  if (match) {
    defaultProgramNr = parseInt(match[1], 10);
  }
  
  // Get post types for dropdown
  const postTypes = getAllPostTypes_();
  const typeNames = postTypes.map(pt => pt[POST_TYPE_SCHEMA.DISPLAY_NAME]).join('\\n');
  
  const html = HtmlService.createHtmlOutput(`
    <style>
      body {
        font-family: 'Roboto', Arial, sans-serif;
        padding: 20px;
        font-size: 13px;
      }
      label {
        display: block;
        margin-top: 12px;
        font-weight: 500;
        color: #37474F;
      }
      input, select, textarea {
        width: 100%;
        padding: 8px;
        margin-top: 4px;
        border: 1px solid #CFD8DC;
        border-radius: 4px;
        font-size: 13px;
        font-family: inherit;
      }
      textarea {
        min-height: 60px;
        resize: vertical;
      }
      button {
        margin-top: 20px;
        padding: 10px 24px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      button:hover {
        background-color: #45A049;
      }
      .cancel-btn {
        background-color: #9E9E9E;
        margin-left: 8px;
      }
      .cancel-btn:hover {
        background-color: #757575;
      }
    </style>
    
    <h2>Lägg till ny post</h2>
    
    <label>Program *</label>
    <select id="program">
      <option value="1" ${defaultProgramNr === 1 ? 'selected' : ''}>Program 1</option>
      <option value="2" ${defaultProgramNr === 2 ? 'selected' : ''}>Program 2</option>
      <option value="3" ${defaultProgramNr === 3 ? 'selected' : ''}>Program 3</option>
      <option value="4" ${defaultProgramNr === 4 ? 'selected' : ''}>Program 4</option>
    </select>
    
    <label>Posttyp *</label>
    <select id="type">
      ${postTypes.map(pt => `<option value="${pt[POST_TYPE_SCHEMA.TYPE_KEY]}">${pt[POST_TYPE_SCHEMA.ICON]} ${pt[POST_TYPE_SCHEMA.DISPLAY_NAME]}</option>`).join('')}
    </select>
    
    <label>Innehåll *</label>
    <textarea id="title" placeholder="T.ex. 'Predikan om hopp'"></textarea>
    
    <label>Medverkande (kommaseparerat)</label>
    <input type="text" id="people" placeholder="T.ex. 'Maria Löfgren, Victor Hjort'" />
    
    <label>Plats</label>
    <select id="location">
      <option value="">- Välj plats -</option>
      ${LOCATIONS.map(loc => `<option value="${loc}">${loc}</option>`).join('')}
    </select>
    
    <label>Inspelningsdag</label>
    <select id="recording_day">
      <option value="dag1">Dag 1 - Textläsning & Predikan</option>
      <option value="dag2">Dag 2 - Musik & Kör</option>
      <option value="dag3">Dag 3 - Församling (helhet)</option>
    </select>
    
    <label>Anteckningar</label>
    <textarea id="notes" placeholder="Övrig info om posten"></textarea>
    
    <button onclick="savePost()">Skapa post</button>
    <button class="cancel-btn" onclick="google.script.host.close()">Avbryt</button>
    
    <script>
      function savePost() {
        const data = {
          program_nr: parseInt(document.getElementById('program').value),
          type: document.getElementById('type').value,
          title: document.getElementById('title').value,
          people: document.getElementById('people').value,
          location: document.getElementById('location').value,
          recording_day: document.getElementById('recording_day').value,
          notes: document.getElementById('notes').value
        };
        
        if (!data.title) {
          alert('Innehåll måste anges');
          return;
        }
        
        google.script.run
          .withSuccessHandler(() => {
            alert('Post skapad!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Fel: ' + error.message);
          })
          .createPostFromDialog(data);
      }
    </script>
  `)
    .setWidth(500)
    .setHeight(650);
  
  ui.showModalDialog(html, 'Ny post');
}

/**
 * Server-side function called from dialogue
 */
function createPostFromDialog(data) {
  // Create post in database
  const postId = createPost({
    program_nr: data.program_nr,
    type: data.type,
    title: data.title,
    notes: data.notes,
    location: data.location,
    recording_day: data.recording_day
  });
  
  // Handle people (create if new)
  if (data.people) {
    const peopleNames = data.people.split(',').map(n => n.trim()).filter(n => n);
    const peopleIds = [];
    
    peopleNames.forEach(name => {
      // Check if person exists
      const existing = findPersonByName_(name);
      if (existing) {
        peopleIds.push(existing[PERSON_SCHEMA.ID]);
      } else {
        // Create new person
        const newId = createPerson({ name: name });
        peopleIds.push(newId);
      }
    });
    
    // Update post with people IDs
    if (peopleIds.length > 0) {
      updatePost(postId, { people_ids: peopleIds.join(',') });
    }
  }
  
  // Refresh view
  refreshProgramView(data.program_nr);
  
  return postId;
}

/**
 * Find person by name (helper)
 */
function findPersonByName_(name) {
  const people = getAllPeople_();
  for (let person of people) {
    if (person[PERSON_SCHEMA.NAME].toLowerCase() === name.toLowerCase()) {
      return person;
    }
  }
  return null;
}

// ============================================================================
// POST STATUS UPDATES
// ============================================================================

/**
 * Mark current post as recorded
 */
function markCurrentPostRecorded() {
  const postId = getCurrentPostId_();
  if (!postId) {
    SpreadsheetApp.getUi().alert('Markera en rad med en post först');
    return;
  }
  
  updatePost(postId, { status: POST_STATUS.RECORDED.key });
  SpreadsheetApp.getActiveSpreadsheet().toast(`Post ${postId} markerad som inspelad`, 'Status uppdaterad', 2);
  
  // Refresh current view
  SpreadsheetApp.flush();
}

/**
 * Mark current post as recording
 */
function markCurrentPostRecording() {
  const postId = getCurrentPostId_();
  if (!postId) {
    SpreadsheetApp.getUi().alert('Markera en rad med en post först');
    return;
  }
  
  updatePost(postId, { status: POST_STATUS.RECORDING.key });
  SpreadsheetApp.getActiveSpreadsheet().toast(`Post ${postId} markerad som spelar in`, 'Status uppdaterad', 2);
  
  SpreadsheetApp.flush();
}

/**
 * Get post ID from currently selected row
 */
function getCurrentPostId_() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  
  if (row < VIEW_CONFIG.DATA_START_ROW) return null;
  
  // Post ID is in column A
  const postId = sheet.getRange(row, 1).getValue();
  
  // Validate format (PX:YY)
  if (typeof postId === 'string' && postId.match(/^P\d:\d+$/)) {
    return postId;
  }
  
  return null;
}

// ============================================================================
// POST MOVEMENT (reordering)
// ============================================================================

/**
 * Move current post up in sort order
 */
function movePostUp() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Post reordering', 'This feature will be implemented in the next version', ui.ButtonSet.OK);
  // TODO: Implement by swapping sort_order values
}

/**
 * Move current post down in sort order
 */
function movePostDown() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Post reordering', 'This feature will be implemented in the next version', ui.ButtonSet.OK);
  // TODO: Implement by swapping sort_order values
}

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Navigate to schedule view
 */
function goToScheduleView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(VIEW.SCHEDULE);
  if (sheet) {
    ss.setActiveSheet(sheet);
  }
}

/**
 * Navigate to overview
 */
function goToOverviewView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(VIEW.OVERVIEW);
  if (sheet) {
    ss.setActiveSheet(sheet);
  }
}

/**
 * Navigate to credits
 */
function goToCreditsView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(VIEW.CREDITS);
  if (sheet) {
    ss.setActiveSheet(sheet);
  }
}

/**
 * Show post types sheet
 */
function goToPostTypesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DB.POST_TYPES);
  if (sheet) {
    sheet.showSheet();
    ss.setActiveSheet(sheet);
    SpreadsheetApp.getUi().alert('Du kan nu redigera posttyper. Dölj bladet igen när du är klar.');
  }
}

/**
 * Show programmes metadata sheet
 */
function goToProgramsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DB.PROGRAMS);
  if (sheet) {
    sheet.showSheet();
    ss.setActiveSheet(sheet);
    SpreadsheetApp.getUi().alert('Du kan nu redigera program­metadata. Dölj bladet igen när du är klar.');
  }
}

// ============================================================================
// INFORMATION DIALOGUES
// ============================================================================

/**
 * Show about dialogue
 */
function showAbout() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Om systemet',
    `${SYSTEM_NAME} v${SYSTEM_VERSION}\\n\\n` +
    `Skapad av: ${CREATED_BY}\\n\\n` +
    'Ett modernt produktionssystem för gudstjänst-TV baserat på ' +
    'normaliserad databas och dynamiska vyer.\\n\\n' +
    'Arkitektur:\\n' +
    '• Database layer (_DB_*): Single source of truth\\n' +
    '• View layer (Program 1-4, etc): Read-only presentation\\n' +
    '• API layer: Prepared for Companion/BMD integration',
    ui.ButtonSet.OK
  );
}

/**
 * Show documentation
 */
function showDocumentation() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Dokumentation',
    'SNABBSTART:\\n\\n' +
    '1. Kör "System > Bootstrap Database" (en gång)\\n' +
    '2. Redigera program­metadata via "Inställningar > Redigera program­metadata"\\n' +
    '3. Lägg till personer via "Personer > Lägg till person"\\n' +
    '4. Skapa poster via "Poster > Lägg till ny post"\\n\\n' +
    'ARBETSFLÖDE:\\n' +
    '• Program 1-4: Redigera direkt i vyerna\\n' +
    '• Inspelningsschema: Auto-genererad översikt\\n' +
    '• Översikt: Dashboard med statistik\\n\\n' +
    'Full dokumentation: github.com/davidthast/gudstjanst-system',
    ui.ButtonSet.OK
  );
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export database to JSON (for backup/GitHub)
 */
function exportDatabaseToJson() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    // Gather all database data
    const dbData = {
      version: SYSTEM_VERSION,
      exported: getTimestamp_(),
      posts: getDbSheet_(DB.POSTS).getDataRange().getValues(),
      people: getDbSheet_(DB.PEOPLE).getDataRange().getValues(),
      programs: getDbSheet_(DB.PROGRAMS).getDataRange().getValues(),
      post_types: getDbSheet_(DB.POST_TYPES).getDataRange().getValues(),
      log: getDbSheet_(DB.LOG).getDataRange().getValues(),
      settings: getDbSheet_(DB.SETTINGS).getDataRange().getValues()
    };
    
    const json = JSON.stringify(dbData, null, 2);
    
    // Show in dialogue for copy/paste
    const html = HtmlService.createHtmlOutput(`
      <style>
        body { font-family: monospace; font-size: 11px; }
        textarea { width: 100%; height: 500px; }
      </style>
      <h3>Database JSON Export</h3>
      <p>Copy this JSON and save it to your GitHub repository:</p>
      <textarea>${json}</textarea>
      <p><small>File suggestion: data/backup_${new Date().toISOString().split('T')[0]}.json</small></p>
    `)
      .setWidth(700)
      .setHeight(650);
    
    ui.showModalDialog(html, 'Export Database');
    
  } catch (error) {
    ui.alert('Export failed', error.message, ui.ButtonSet.OK);
  }
}
