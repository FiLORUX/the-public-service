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
    .addSeparator()
    .addSubMenu(ui.createMenu('💾 Backup & Restore')
      .addItem('📤 Exportera till JSON', 'exportDatabaseToJson')
      .addItem('💾 Skapa backup nu', 'runBackupNow')
      .addItem('🔄 Återställ från backup', 'showRestoreDialog')
      .addSeparator()
      .addItem('⏰ Aktivera automatisk backup', 'installBackupTriggers')
      .addItem('🚫 Avaktivera automatisk backup', 'removeBackupTriggers'))
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
    .addSeparator()
    .addSubMenu(ui.createMenu('🗑️ Papperskorg')
      .addItem('📋 Visa borttagna poster', 'showTrashDialog')
      .addItem('♻️ Töm papperskorgen', 'emptyTrash'))
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
    .addItem('🎯 Gå till aktiv inspelning', 'goToCurrentPost')
    .addItem('📍 Visa inspelningsstatus', 'showRecordingStatus')
    .addSeparator()
    .addItem('⏺️ Markera post som spelar in', 'markCurrentPostRecording')
    .addItem('✅ Markera post som inspelad', 'markCurrentPostRecorded')
    .addItem('👍 Markera post som godkänd', 'markCurrentPostApproved')
    .addToUi();
  
  ui.createMenu('🔗 Integration')
    .addItem('📊 Visa sync-status', 'showSyncStatusDialog')
    .addItem('⚙️ Konfigurera Supabase sync', 'showSyncConfigDialog')
    .addSeparator()
    .addItem('🔑 Visa API-nycklar', 'showExternalApiDialog')
    .addItem('🔄 Generera ny API-nyckel', 'generateNewApiKey')
    .addSeparator()
    .addItem('📤 Full sync till Supabase', 'fullSyncToSupabase')
    .addItem('📥 Hämta från Supabase', 'pullAllFromSupabase')
    .addSeparator()
    .addItem('🧪 Testa API-anslutning', 'testApiConnection')
    .addToUi();

  ui.createMenu('⚙️ Inställningar')
    .addItem('🎨 Redigera posttyper', 'goToPostTypesSheet')
    .addItem('📝 Redigera program­metadata', 'goToProgramsSheet')
    .addItem('🔧 System­inställningar', 'showSettingsDialog')
    .addSeparator()
    .addSubMenu(ui.createMenu('📦 Arkivering')
      .addItem('📦 Arkivera Program 1', 'archiveProgram1')
      .addItem('📦 Arkivera Program 2', 'archiveProgram2')
      .addItem('📦 Arkivera Program 3', 'archiveProgram3')
      .addItem('📦 Arkivera Program 4', 'archiveProgram4')
      .addSeparator()
      .addItem('🔄 Arkivera & rensa Program 1', 'archiveAndClearProgram1')
      .addItem('🔄 Arkivera & rensa Program 2', 'archiveAndClearProgram2')
      .addItem('🔄 Arkivera & rensa Program 3', 'archiveAndClearProgram3')
      .addItem('🔄 Arkivera & rensa Program 4', 'archiveAndClearProgram4'))
    .addSeparator()
    .addItem('🗑️ Rensa cache', 'invalidateAllCaches')
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
      updatePost(postId, { people_ids: peopleIds.join(',') }, 'ui');
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
// IMPORT DIALOG
// ============================================================================

/**
 * Show dialog for importing posts from CSV/TSV
 */
function showImportDialog() {
  const ui = SpreadsheetApp.getUi();

  const html = HtmlService.createHtmlOutput(`
    <style>
      body {
        font-family: 'Roboto', Arial, sans-serif;
        padding: 20px;
        font-size: 13px;
      }
      h2 {
        color: #37474F;
        margin-bottom: 10px;
      }
      label {
        display: block;
        margin-top: 15px;
        font-weight: 500;
        color: #37474F;
      }
      select, textarea {
        width: 100%;
        padding: 8px;
        margin-top: 4px;
        border: 1px solid #CFD8DC;
        border-radius: 4px;
        font-size: 13px;
        font-family: inherit;
        box-sizing: border-box;
      }
      textarea {
        min-height: 200px;
        font-family: monospace;
        font-size: 11px;
      }
      .help-text {
        font-size: 11px;
        color: #78909C;
        margin-top: 4px;
      }
      .format-box {
        background: #E3F2FD;
        padding: 10px;
        border-radius: 4px;
        margin: 15px 0;
        font-size: 11px;
      }
      .format-box code {
        background: #BBDEFB;
        padding: 2px 4px;
        border-radius: 2px;
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
      .result {
        margin-top: 15px;
        padding: 10px;
        border-radius: 4px;
        display: none;
      }
      .result.success {
        background: #C8E6C9;
        display: block;
      }
      .result.error {
        background: #FFCDD2;
        display: block;
      }
    </style>

    <h2>📋 Importera poster</h2>

    <label>Program att importera till</label>
    <select id="program">
      <option value="1">Program 1</option>
      <option value="2">Program 2</option>
      <option value="3">Program 3</option>
      <option value="4">Program 4</option>
    </select>

    <label>Format</label>
    <select id="format">
      <option value="tsv">TSV (tab-separerat)</option>
      <option value="csv">CSV (komma-separerat)</option>
    </select>

    <div class="format-box">
      <strong>Förväntat format (en rad per post):</strong><br>
      <code>typ</code> <code>innehåll</code> <code>medverkande</code> <code>duration</code> <code>plats</code> <code>dag</code> <code>anteckningar</code><br><br>
      <strong>Exempel (TSV):</strong><br>
      <code>predikan&emsp;Predikan om kärlek&emsp;Maria Löfgren&emsp;7:00&emsp;talarplats&emsp;dag1&emsp;</code>
    </div>

    <label>Klistra in data</label>
    <textarea id="data" placeholder="Klistra in dina poster här (en rad per post)..."></textarea>
    <div class="help-text">Tips: Kopiera direkt från Excel eller Google Sheets</div>

    <div id="result" class="result"></div>

    <button onclick="importData()">Importera</button>
    <button class="cancel-btn" onclick="google.script.host.close()">Avbryt</button>

    <script>
      function importData() {
        const data = {
          program_nr: parseInt(document.getElementById('program').value),
          format: document.getElementById('format').value,
          data: document.getElementById('data').value.trim()
        };

        if (!data.data) {
          showResult('Ingen data att importera', true);
          return;
        }

        document.getElementById('result').innerHTML = 'Importerar...';
        document.getElementById('result').className = 'result success';

        google.script.run
          .withSuccessHandler((result) => {
            showResult(result.message, false);
            if (result.success) {
              setTimeout(() => google.script.host.close(), 2000);
            }
          })
          .withFailureHandler((error) => {
            showResult('Fel: ' + error.message, true);
          })
          .importPostsFromDialog(data);
      }

      function showResult(message, isError) {
        const el = document.getElementById('result');
        el.innerHTML = message;
        el.className = 'result ' + (isError ? 'error' : 'success');
      }
    </script>
  `)
    .setWidth(600)
    .setHeight(650);

  ui.showModalDialog(html, 'Importera poster');
}

/**
 * Server-side function to import posts from dialog
 */
function importPostsFromDialog(data) {
  const { program_nr, format, data: rawData } = data;

  // Parse the data
  const delimiter = format === 'csv' ? ',' : '\t';
  const lines = rawData.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return { success: false, message: 'Ingen data att importera' };
  }

  let imported = 0;
  let errors = [];

  lines.forEach((line, index) => {
    try {
      const parts = line.split(delimiter);

      // Expected: typ, innehåll, medverkande, duration, plats, dag, anteckningar
      const postData = {
        program_nr: program_nr,
        type: (parts[0] || 'liturgi').trim().toLowerCase(),
        title: (parts[1] || '').trim(),
        recording_day: (parts[5] || 'dag1').trim().toLowerCase(),
        location: (parts[4] || '').trim(),
        notes: (parts[6] || '').trim()
      };

      // Parse duration
      if (parts[3]) {
        postData.duration = parseDurationToSeconds_(parts[3].trim());
      }

      // Skip empty titles
      if (!postData.title) {
        errors.push(`Rad ${index + 1}: Tom titel, hoppar över`);
        return;
      }

      // Create the post
      const postId = createPost(postData);

      // Handle people if specified
      if (parts[2] && parts[2].trim()) {
        const peopleNames = parts[2].split(',').map(n => n.trim()).filter(n => n);
        const peopleIds = [];

        peopleNames.forEach(name => {
          const existing = findPersonByName_(name);
          if (existing) {
            peopleIds.push(existing[PERSON_SCHEMA.ID]);
          } else {
            const newId = createPerson({ name: name });
            peopleIds.push(newId);
          }
        });

        if (peopleIds.length > 0) {
          updatePost(postId, { people_ids: peopleIds.join(',') }, 'import');
        }
      }

      imported++;
    } catch (error) {
      errors.push(`Rad ${index + 1}: ${error.message}`);
    }
  });

  // Refresh the view
  refreshProgramView(program_nr);

  let message = `Importerade ${imported} av ${lines.length} poster till Program ${program_nr}.`;
  if (errors.length > 0) {
    message += `\n\nVarningar:\n${errors.slice(0, 5).join('\n')}`;
    if (errors.length > 5) {
      message += `\n... och ${errors.length - 5} till`;
    }
  }

  return { success: imported > 0, message: message };
}

// ============================================================================
// DELETE POST
// ============================================================================

/**
 * Delete currently selected post
 */
function deleteCurrentPost() {
  const ui = SpreadsheetApp.getUi();
  const postId = getCurrentPostId_();

  if (!postId) {
    ui.alert('Ingen post vald', 'Markera en rad med en post först (klicka på en cell i post-raden)', ui.ButtonSet.OK);
    return;
  }

  // Get post details for confirmation
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  const postTitle = sheet.getRange(row, 3).getValue(); // Column C = Innehåll

  const confirm = ui.alert(
    'Radera post?',
    `Vill du verkligen radera post ${postId}?\n\n"${postTitle}"\n\nDetta kan inte ångras!`,
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) {
    return;
  }

  try {
    deletePost(postId);

    // Determine which program we're in and refresh
    const sheetName = sheet.getName();
    const match = sheetName.match(/Program (\d)/);
    if (match) {
      const programNr = parseInt(match[1], 10);
      refreshProgramView(programNr);
    }

    ui.alert('Post raderad', `Post ${postId} har raderats.`, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('Fel', `Kunde inte radera post: ${error.message}`, ui.ButtonSet.OK);
    Logger.log(`Delete post error: ${error.stack}`);
  }
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
  
  updatePost(postId, { status: POST_STATUS.RECORDED.key }, 'ui');
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

  updatePost(postId, { status: POST_STATUS.RECORDING.key }, 'ui');
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
  movePost_(-1);
}

/**
 * Move current post down in sort order
 */
function movePostDown() {
  movePost_(1);
}

/**
 * Move post up or down by swapping sort_order values
 * @param {Number} direction - -1 for up, 1 for down
 */
function movePost_(direction) {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();

  // Verify we're in a programme view
  const match = sheetName.match(/^Program (\d)$/);
  if (!match) {
    ui.alert('Fel', 'Denna funktion fungerar bara i Program-vyer (Program 1-4)', ui.ButtonSet.OK);
    return;
  }

  const programNr = parseInt(match[1], 10);
  const postId = getCurrentPostId_();

  if (!postId) {
    ui.alert('Ingen post vald', 'Markera en rad med en post först', ui.ButtonSet.OK);
    return;
  }

  try {
    // Get all posts for this program, sorted by sort_order
    const posts = getAllPostsForProgram_(programNr);
    posts.sort((a, b) => a[POST_SCHEMA.SORT_ORDER] - b[POST_SCHEMA.SORT_ORDER]);

    // Find current post index
    let currentIndex = -1;
    for (let i = 0; i < posts.length; i++) {
      if (posts[i][POST_SCHEMA.ID] === postId) {
        currentIndex = i;
        break;
      }
    }

    if (currentIndex === -1) {
      throw new Error('Posten hittades inte i databasen');
    }

    // Calculate target index
    const targetIndex = currentIndex + direction;

    // Check bounds
    if (targetIndex < 0) {
      ui.alert('Kan inte flytta', 'Posten är redan överst i listan', ui.ButtonSet.OK);
      return;
    }
    if (targetIndex >= posts.length) {
      ui.alert('Kan inte flytta', 'Posten är redan längst ner i listan', ui.ButtonSet.OK);
      return;
    }

    // Get the two posts to swap
    const currentPost = posts[currentIndex];
    const targetPost = posts[targetIndex];

    // Swap sort_order values
    const currentSortOrder = currentPost[POST_SCHEMA.SORT_ORDER];
    const targetSortOrder = targetPost[POST_SCHEMA.SORT_ORDER];

    // Update both posts in database
    updatePost(currentPost[POST_SCHEMA.ID], { sort_order: targetSortOrder }, 'ui');
    updatePost(targetPost[POST_SCHEMA.ID], { sort_order: currentSortOrder }, 'ui');

    // Refresh the view
    refreshProgramView(programNr);

    // Show confirmation
    const directionText = direction === -1 ? 'upp' : 'ner';
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Post ${postId} flyttad ${directionText}`,
      'Post flyttad',
      2
    );

  } catch (error) {
    ui.alert('Fel', `Kunde inte flytta post: ${error.message}`, ui.ButtonSet.OK);
    Logger.log(`Move post error: ${error.stack}`);
  }
}

// ============================================================================
// PERSON MANAGEMENT DIALOGUES
// ============================================================================

/**
 * Show dialogue for adding new person
 */
function showAddPersonDialog() {
  const ui = SpreadsheetApp.getUi();

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
        box-sizing: border-box;
      }
      .required::after {
        content: ' *';
        color: #E53935;
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
      .help-text {
        font-size: 11px;
        color: #78909C;
        margin-top: 4px;
      }
    </style>

    <h2>👥 Lägg till person</h2>

    <label class="required">Namn</label>
    <input type="text" id="name" placeholder="T.ex. 'Maria Löfgren'" />

    <label>Roll(er)</label>
    <input type="text" id="roles" placeholder="T.ex. 'predikant, liturg'" />
    <div class="help-text">Kommaseparerat om flera roller</div>

    <label>Kontakt</label>
    <input type="text" id="contact" placeholder="E-post eller telefon" />

    <label>Typ</label>
    <select id="type">
      <option value="medverkande">Medverkande (i gudstjänsten)</option>
      <option value="team">Team (produktionspersonal)</option>
      <option value="kompositör">Kompositör</option>
      <option value="textförfattare">Textförfattare</option>
    </select>

    <button onclick="savePerson()">Skapa person</button>
    <button class="cancel-btn" onclick="google.script.host.close()">Avbryt</button>

    <script>
      function savePerson() {
        const data = {
          name: document.getElementById('name').value.trim(),
          roles: document.getElementById('roles').value.trim(),
          contact: document.getElementById('contact').value.trim(),
          type: document.getElementById('type').value
        };

        if (!data.name) {
          alert('Namn måste anges');
          return;
        }

        google.script.run
          .withSuccessHandler((personId) => {
            alert('Person skapad: ' + personId);
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Fel: ' + error.message);
          })
          .createPersonFromDialog(data);
      }
    </script>
  `)
    .setWidth(450)
    .setHeight(450);

  ui.showModalDialog(html, 'Ny person');
}

/**
 * Server-side function called from person dialogue
 */
function createPersonFromDialog(data) {
  // Check if person already exists
  const existing = findPersonByName_(data.name);
  if (existing) {
    throw new Error(`En person med namnet "${data.name}" finns redan (ID: ${existing[PERSON_SCHEMA.ID]})`);
  }

  // Create person in database
  const personId = createPerson({
    name: data.name,
    roles: data.roles,
    contact: data.contact,
    type: data.type
  });

  Logger.log(`Created person from dialog: ${personId}`);
  return personId;
}

/**
 * Show list of all people
 */
function showPeopleList() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Navigate to credits view which shows all people
  const sheet = ss.getSheetByName(VIEW.CREDITS);
  if (sheet) {
    ss.setActiveSheet(sheet);
    ui.alert('Kreditlista', 'Här visas alla registrerade personer.\n\nFör att lägga till ny person:\nPersoner > Lägg till person', ui.ButtonSet.OK);
  } else {
    ui.alert('Fel', 'Kreditlista-bladet finns inte. Kör System > Generate All Views först.', ui.ButtonSet.OK);
  }
}

// ============================================================================
// RECORDING STATUS & QUICK ACTIONS
// ============================================================================

/**
 * Show current recording status dialog
 */
function showRecordingStatus() {
  const ui = SpreadsheetApp.getUi();
  const info = getCurrentPostInfo();

  if (!info.hasCurrentPost) {
    // Get stats from database
    const postsSheet = getDbSheet_(DB.POSTS);
    const data = postsSheet.getDataRange().getValues();

    let planned = 0, recording = 0, recorded = 0, approved = 0;

    for (let i = 1; i < data.length; i++) {
      const status = data[i][POST_SCHEMA.STATUS];
      if (status === POST_STATUS.PLANNED.key) planned++;
      else if (status === POST_STATUS.RECORDING.key) recording++;
      else if (status === POST_STATUS.RECORDED.key) recorded++;
      else if (status === POST_STATUS.APPROVED.key) approved++;
    }

    const total = planned + recording + recorded + approved;
    const progress = total > 0 ? Math.round(((recorded + approved) / total) * 100) : 0;

    ui.alert(
      '📊 Inspelningsstatus',
      `Ingen aktiv inspelning just nu.\n\n` +
      `STATISTIK:\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📝 Planerade: ${planned}\n` +
      `⏺️ Spelar in: ${recording}\n` +
      `✅ Inspelade: ${recorded}\n` +
      `👍 Godkända: ${approved}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `Totalt: ${total} poster\n` +
      `Framsteg: ${progress}%`,
      ui.ButtonSet.OK
    );
  } else {
    // Get post details
    const postsSheet = getDbSheet_(DB.POSTS);
    const data = postsSheet.getDataRange().getValues();
    let postData = null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][POST_SCHEMA.ID] === info.post_id) {
        postData = data[i];
        break;
      }
    }

    if (postData) {
      const postType = getPostTypeByKey_(postData[POST_SCHEMA.TYPE]);
      const typeName = postType ? postType.display_name : postData[POST_SCHEMA.TYPE];

      ui.alert(
        '🎬 AKTIV INSPELNING',
        `POST: ${info.post_id}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `Typ: ${typeName}\n` +
        `Innehåll: ${postData[POST_SCHEMA.TITLE] || '(ingen titel)'}\n` +
        `Duration: ${formatDuration_(postData[POST_SCHEMA.DURATION])}\n` +
        `Plats: ${postData[POST_SCHEMA.LOCATION] || '(ej angiven)'}\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `Klicka "Produktion > Gå till aktiv inspelning"\n` +
        `för att navigera till posten.`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert('Aktiv inspelning', `Post ${info.post_id} är markerad som aktiv.`, ui.ButtonSet.OK);
    }
  }
}

/**
 * Mark current post as approved
 */
function markCurrentPostApproved() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const sheetName = activeSheet.getName();

  // Check if we're in a programme view
  const programMatch = sheetName.match(/^Program (\d+)$/);
  if (!programMatch) {
    ui.alert('Fel', 'Denna funktion fungerar bara från Program-vyer (Program 1, 2, 3 eller 4).', ui.ButtonSet.OK);
    return;
  }

  // Get current row
  const activeRow = ss.getActiveRange().getRow();
  if (activeRow < VIEW_CONFIG.DATA_START_ROW) {
    ui.alert('Fel', 'Välj en post-rad först (rad 7 eller senare).', ui.ButtonSet.OK);
    return;
  }

  // Get post_id from column A
  const postId = activeSheet.getRange(activeRow, 1).getValue();
  if (!postId || !postId.match || !postId.match(/^P\d+:\d+$/)) {
    ui.alert('Fel', 'Kunde inte hitta post_id. Välj en rad med en post.', ui.ButtonSet.OK);
    return;
  }

  try {
    updatePost(postId, { status: POST_STATUS.APPROVED.key }, 'ui');
    SpreadsheetApp.getActiveSpreadsheet().toast(`Post ${postId} markerad som godkänd`, '👍 Godkänd', 3);
  } catch (error) {
    ui.alert('Fel', `Kunde inte uppdatera post: ${error.message}`, ui.ButtonSet.OK);
  }
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
// ARCHIVING WRAPPER FUNCTIONS
// ============================================================================

function archiveProgram1() { archiveProgram(1); }
function archiveProgram2() { archiveProgram(2); }
function archiveProgram3() { archiveProgram(3); }
function archiveProgram4() { archiveProgram(4); }

function archiveAndClearProgram1() { archiveAndClearProgram(1); }
function archiveAndClearProgram2() { archiveAndClearProgram(2); }
function archiveAndClearProgram3() { archiveAndClearProgram(3); }
function archiveAndClearProgram4() { archiveAndClearProgram(4); }

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
// SETTINGS DIALOG
// ============================================================================

/**
 * Show system settings dialog
 */
function showSettingsDialog() {
  const ui = SpreadsheetApp.getUi();

  // Get current settings
  const settingsSheet = getDbSheet_(DB.SETTINGS);
  const settingsData = settingsSheet.getDataRange().getValues();

  // Build settings object
  const settings = {};
  for (let i = 1; i < settingsData.length; i++) {
    settings[settingsData[i][0]] = settingsData[i][1];
  }

  const html = HtmlService.createHtmlOutput(`
    <style>
      body {
        font-family: 'Roboto', Arial, sans-serif;
        padding: 20px;
        font-size: 13px;
      }
      h2 {
        color: #37474F;
        margin-bottom: 20px;
      }
      .setting-group {
        margin-bottom: 20px;
        padding: 15px;
        background: #F5F5F5;
        border-radius: 8px;
      }
      .setting-group h3 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #455A64;
      }
      label {
        display: block;
        margin-top: 10px;
        font-weight: 500;
        color: #37474F;
      }
      input, select {
        width: 100%;
        padding: 8px;
        margin-top: 4px;
        border: 1px solid #CFD8DC;
        border-radius: 4px;
        font-size: 13px;
        box-sizing: border-box;
      }
      .help-text {
        font-size: 11px;
        color: #78909C;
        margin-top: 4px;
      }
      .info-box {
        background: #E3F2FD;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 15px;
        font-size: 12px;
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
    </style>

    <h2>⚙️ Systeminställningar</h2>

    <div class="info-box">
      <strong>Version:</strong> ${settings['system_version'] || 'Okänd'}<br>
      <strong>Senaste bootstrap:</strong> ${settings['last_bootstrap'] || 'Aldrig'}
    </div>

    <div class="setting-group">
      <h3>📍 Platsinställningar</h3>
      <label>Standardplats (kyrka)</label>
      <input type="text" id="location_name" value="${settings['location_name'] || ''}" />
      <div class="help-text">Används som default vid nya program</div>
    </div>

    <div class="setting-group">
      <h3>⏰ Tidsinställningar</h3>
      <label>Standard starttid (Dag 1)</label>
      <input type="text" id="default_start_time" value="${settings['default_start_time'] || '09:00:00'}" placeholder="HH:MM:SS" />
      <div class="help-text">Format: HH:MM:SS (t.ex. 09:00:00)</div>
    </div>

    <div class="setting-group">
      <h3>🔌 API-inställningar</h3>
      <label>API aktiverat</label>
      <select id="api_enabled">
        <option value="false" ${settings['api_enabled'] !== 'true' ? 'selected' : ''}>Nej (standard)</option>
        <option value="true" ${settings['api_enabled'] === 'true' ? 'selected' : ''}>Ja</option>
      </select>
      <div class="help-text">Aktivera för Companion/vMix-integration</div>
    </div>

    <button onclick="saveSettings()">Spara inställningar</button>
    <button class="cancel-btn" onclick="google.script.host.close()">Avbryt</button>

    <script>
      function saveSettings() {
        const data = {
          location_name: document.getElementById('location_name').value,
          default_start_time: document.getElementById('default_start_time').value,
          api_enabled: document.getElementById('api_enabled').value
        };

        google.script.run
          .withSuccessHandler(() => {
            alert('Inställningar sparade!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Fel: ' + error.message);
          })
          .saveSettingsFromDialog(data);
      }
    </script>
  `)
    .setWidth(500)
    .setHeight(550);

  ui.showModalDialog(html, 'Systeminställningar');
}

/**
 * Save settings from dialog
 */
function saveSettingsFromDialog(data) {
  const sheet = getDbSheet_(DB.SETTINGS);
  const settingsData = sheet.getDataRange().getValues();

  // Update each setting
  Object.keys(data).forEach(key => {
    for (let i = 1; i < settingsData.length; i++) {
      if (settingsData[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(data[key]);
        break;
      }
    }
  });

  Logger.log('Settings saved from dialog');
}

// ============================================================================
// TRASH / RECYCLE BIN FUNCTIONS
// ============================================================================

/**
 * Show dialog with deleted posts (trash)
 */
function showTrashDialog() {
  const ui = SpreadsheetApp.getUi();
  const deletedPosts = getDeletedPosts_();

  if (deletedPosts.length === 0) {
    ui.alert('Papperskorgen är tom', 'Det finns inga borttagna poster att visa.', ui.ButtonSet.OK);
    return;
  }

  const html = HtmlService.createHtmlOutput(`
    <style>
      body {
        font-family: 'Roboto', Arial, sans-serif;
        padding: 20px;
        font-size: 13px;
      }
      h2 {
        color: #37474F;
        margin-bottom: 15px;
      }
      .info-box {
        background: #E3F2FD;
        padding: 12px;
        border-radius: 4px;
        margin-bottom: 15px;
        font-size: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 15px;
      }
      th, td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid #E0E0E0;
      }
      th {
        background: #ECEFF1;
        font-weight: 500;
      }
      tr:hover {
        background: #F5F5F5;
      }
      .btn {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .btn-restore {
        background: #4CAF50;
        color: white;
      }
      .btn-restore:hover {
        background: #388E3C;
      }
      .result {
        margin-top: 15px;
        padding: 12px;
        border-radius: 4px;
        display: none;
      }
      .result.success { background: #C8E6C9; display: block; }
      .result.error { background: #FFCDD2; display: block; }
      .result.loading { background: #FFF9C4; display: block; }
      .close-btn {
        margin-top: 15px;
        padding: 10px 24px;
        background: #9E9E9E;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    </style>

    <h2>🗑️ Papperskorg</h2>

    <div class="info-box">
      Klicka "Återställ" för att återskapa en borttagen post.
      Posten återställs till sitt ursprungliga program.
    </div>

    <table>
      <tr>
        <th>Post ID</th>
        <th>Pgm</th>
        <th>Typ</th>
        <th>Innehåll</th>
        <th>Raderad</th>
        <th></th>
      </tr>
      ${deletedPosts.map(p => `
        <tr>
          <td>${p.post_id}</td>
          <td>${p.program_nr}</td>
          <td>${p.type}</td>
          <td>${(p.title || '').substring(0, 30)}${(p.title || '').length > 30 ? '...' : ''}</td>
          <td>${p.deleted_at}</td>
          <td><button class="btn btn-restore" onclick="restorePost('${p.post_id}')">♻️ Återställ</button></td>
        </tr>
      `).join('')}
    </table>

    <div id="result" class="result"></div>

    <button class="close-btn" onclick="google.script.host.close()">Stäng</button>

    <script>
      function restorePost(postId) {
        const resultEl = document.getElementById('result');
        resultEl.className = 'result loading';
        resultEl.innerHTML = 'Återställer post...';

        google.script.run
          .withSuccessHandler(function(result) {
            resultEl.className = 'result success';
            resultEl.innerHTML = 'Post återställd! Stänger dialog...';
            setTimeout(() => {
              google.script.host.close();
            }, 1500);
          })
          .withFailureHandler(function(error) {
            resultEl.className = 'result error';
            resultEl.innerHTML = 'Fel: ' + error.message;
          })
          .restoreDeletedPost(postId);
      }
    </script>
  `)
    .setWidth(600)
    .setHeight(450);

  ui.showModalDialog(html, 'Papperskorg - Borttagna poster');
}

// ============================================================================
// BACKUP & RESTORE FUNCTIONS
// ============================================================================

/**
 * Show dialog for restoring from backup
 */
function showRestoreDialog() {
  const ui = SpreadsheetApp.getUi();

  const html = HtmlService.createHtmlOutput(`
    <style>
      body {
        font-family: 'Roboto', Arial, sans-serif;
        padding: 20px;
        font-size: 13px;
      }
      h2 {
        color: #37474F;
        margin-bottom: 10px;
      }
      .warning-box {
        background: #FFCDD2;
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
        border-left: 4px solid #E53935;
      }
      .warning-box h3 {
        margin: 0 0 8px 0;
        color: #C62828;
      }
      .info-box {
        background: #E3F2FD;
        padding: 12px;
        border-radius: 4px;
        margin: 15px 0;
        font-size: 12px;
      }
      label {
        display: block;
        margin-top: 15px;
        font-weight: 500;
        color: #37474F;
      }
      select, textarea {
        width: 100%;
        padding: 8px;
        margin-top: 4px;
        border: 1px solid #CFD8DC;
        border-radius: 4px;
        font-size: 13px;
        font-family: inherit;
        box-sizing: border-box;
      }
      textarea {
        min-height: 150px;
        font-family: monospace;
        font-size: 11px;
      }
      button {
        margin-top: 20px;
        padding: 10px 24px;
        background-color: #E53935;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      button:hover {
        background-color: #C62828;
      }
      .cancel-btn {
        background-color: #9E9E9E;
        margin-left: 8px;
      }
      .cancel-btn:hover {
        background-color: #757575;
      }
      .result {
        margin-top: 15px;
        padding: 12px;
        border-radius: 4px;
        display: none;
      }
      .result.success { background: #C8E6C9; display: block; }
      .result.error { background: #FFCDD2; display: block; }
      .result.loading { background: #FFF9C4; display: block; }
      .tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
      }
      .tab {
        padding: 8px 16px;
        background: #ECEFF1;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .tab.active {
        background: #2196F3;
        color: white;
      }
      .tab-content { display: none; }
      .tab-content.active { display: block; }
    </style>

    <h2>🔄 Återställ från backup</h2>

    <div class="warning-box">
      <h3>⚠️ Varning</h3>
      Detta kommer att <strong>ERSÄTTA</strong> all befintlig data i databasen.
      Denna åtgärd kan inte ångras!
    </div>

    <div class="tabs">
      <button class="tab active" onclick="showTab('drive')">📁 Från Google Drive</button>
      <button class="tab" onclick="showTab('json')">📋 Från JSON</button>
    </div>

    <div id="drive-tab" class="tab-content active">
      <div class="info-box">
        Välj en backup-fil från mappen "Gudstjänst_Backups" i Google Drive.
      </div>
      <label>Tillgängliga backups</label>
      <select id="backup-file">
        <option value="">Laddar...</option>
      </select>
    </div>

    <div id="json-tab" class="tab-content">
      <div class="info-box">
        Klistra in JSON-data från en tidigare export eller backup-fil.
      </div>
      <label>JSON-data</label>
      <textarea id="json-data" placeholder='{"version": "1.0.0", "posts": [...], ...}'></textarea>
    </div>

    <div id="result" class="result"></div>

    <button onclick="doRestore()">⚠️ Återställ data</button>
    <button class="cancel-btn" onclick="google.script.host.close()">Avbryt</button>

    <script>
      let activeTab = 'drive';

      function showTab(tab) {
        activeTab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        document.getElementById(tab + '-tab').classList.add('active');
      }

      // Load backup files on dialog open
      google.script.run
        .withSuccessHandler(function(files) {
          const select = document.getElementById('backup-file');
          if (files.length === 0) {
            select.innerHTML = '<option value="">Inga backups hittade</option>';
          } else {
            select.innerHTML = '<option value="">-- Välj backup --</option>' +
              files.map(f => '<option value="' + f.id + '">' + f.name + ' (' + f.date + ')</option>').join('');
          }
        })
        .withFailureHandler(function(error) {
          document.getElementById('backup-file').innerHTML =
            '<option value="">Fel: ' + error.message + '</option>';
        })
        .getAvailableBackups();

      function doRestore() {
        const resultEl = document.getElementById('result');
        resultEl.className = 'result loading';
        resultEl.innerHTML = 'Återställer data...';

        if (activeTab === 'drive') {
          const fileId = document.getElementById('backup-file').value;
          if (!fileId) {
            resultEl.className = 'result error';
            resultEl.innerHTML = 'Välj en backup-fil först';
            return;
          }
          google.script.run
            .withSuccessHandler(handleResult)
            .withFailureHandler(handleError)
            .restoreFromDriveBackup(fileId);
        } else {
          const json = document.getElementById('json-data').value.trim();
          if (!json) {
            resultEl.className = 'result error';
            resultEl.innerHTML = 'Klistra in JSON-data först';
            return;
          }
          google.script.run
            .withSuccessHandler(handleResult)
            .withFailureHandler(handleError)
            .restoreFromJsonBackup(json);
        }
      }

      function handleResult(result) {
        const resultEl = document.getElementById('result');
        if (result.success) {
          resultEl.className = 'result success';
          resultEl.innerHTML = result.message;
          setTimeout(() => google.script.host.close(), 3000);
        } else {
          resultEl.className = 'result error';
          resultEl.innerHTML = 'Fel: ' + result.error;
        }
      }

      function handleError(error) {
        const resultEl = document.getElementById('result');
        resultEl.className = 'result error';
        resultEl.innerHTML = 'Fel: ' + error.message;
      }
    </script>
  `)
    .setWidth(550)
    .setHeight(600);

  ui.showModalDialog(html, 'Återställ från backup');
}

/**
 * Get list of available backup files from Google Drive
 */
function getAvailableBackups() {
  try {
    // Get backup folder
    const settingsSheet = getDbSheet_(DB.SETTINGS);
    const settingsData = settingsSheet.getDataRange().getValues();
    let folderId = null;

    for (let i = 1; i < settingsData.length; i++) {
      if (settingsData[i][0] === 'backup_folder_id') {
        folderId = settingsData[i][1];
        break;
      }
    }

    if (!folderId) {
      return [];
    }

    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByType(MimeType.PLAIN_TEXT);
    const backups = [];

    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().startsWith('gudstjanst_backup_')) {
        backups.push({
          id: file.getId(),
          name: file.getName(),
          date: file.getDateCreated().toLocaleString('sv-SE')
        });
      }
    }

    // Sort by date (newest first)
    backups.sort((a, b) => b.date.localeCompare(a.date));

    return backups;

  } catch (error) {
    Logger.log(`Error getting backups: ${error.message}`);
    return [];
  }
}

/**
 * Restore database from Google Drive backup file
 */
function restoreFromDriveBackup(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const json = file.getBlob().getDataAsString();

    return restoreFromJsonBackup(json);

  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Restore database from JSON string
 */
function restoreFromJsonBackup(jsonString) {
  const ui = SpreadsheetApp.getUi();

  try {
    const data = JSON.parse(jsonString);

    // Validate required fields
    if (!data.posts || !data.people || !data.programs) {
      return { success: false, error: 'Ogiltig backup-fil: saknar posts, people eller programs' };
    }

    // Create pre-restore backup
    Logger.log('Creating pre-restore backup...');
    const preBackupResult = dailyBackup();
    if (!preBackupResult.success) {
      Logger.log('Warning: Could not create pre-restore backup');
    }

    // Restore each table
    let restored = {
      posts: 0,
      people: 0,
      programs: 0,
      post_types: 0,
      log: 0,
      settings: 0
    };

    // Restore posts
    if (data.posts && data.posts.length > 1) {
      const sheet = getDbSheet_(DB.POSTS);
      sheet.clear();
      sheet.getRange(1, 1, data.posts.length, data.posts[0].length).setValues(data.posts);
      restored.posts = data.posts.length - 1; // Minus header
    }

    // Restore people
    if (data.people && data.people.length > 1) {
      const sheet = getDbSheet_(DB.PEOPLE);
      sheet.clear();
      sheet.getRange(1, 1, data.people.length, data.people[0].length).setValues(data.people);
      restored.people = data.people.length - 1;
    }

    // Restore programs
    if (data.programs && data.programs.length > 1) {
      const sheet = getDbSheet_(DB.PROGRAMS);
      sheet.clear();
      sheet.getRange(1, 1, data.programs.length, data.programs[0].length).setValues(data.programs);
      restored.programs = data.programs.length - 1;
    }

    // Restore post types
    if (data.post_types && data.post_types.length > 1) {
      const sheet = getDbSheet_(DB.POST_TYPES);
      sheet.clear();
      sheet.getRange(1, 1, data.post_types.length, data.post_types[0].length).setValues(data.post_types);
      restored.post_types = data.post_types.length - 1;
    }

    // Restore log
    if (data.log && data.log.length > 1) {
      const sheet = getDbSheet_(DB.LOG);
      sheet.clear();
      sheet.getRange(1, 1, data.log.length, data.log[0].length).setValues(data.log);
      restored.log = data.log.length - 1;
    }

    // Restore settings (but preserve some system settings)
    if (data.settings && data.settings.length > 1) {
      const sheet = getDbSheet_(DB.SETTINGS);
      const currentSettings = sheet.getDataRange().getValues();

      // Preserve backup_folder_id
      let backupFolderId = null;
      for (let i = 1; i < currentSettings.length; i++) {
        if (currentSettings[i][0] === 'backup_folder_id') {
          backupFolderId = currentSettings[i][1];
          break;
        }
      }

      sheet.clear();
      sheet.getRange(1, 1, data.settings.length, data.settings[0].length).setValues(data.settings);

      // Re-add backup folder ID
      if (backupFolderId) {
        sheet.appendRow(['backup_folder_id', backupFolderId, 'Google Drive folder for automatic backups']);
      }

      restored.settings = data.settings.length - 1;
    }

    // Add restore timestamp
    const settingsSheet = getDbSheet_(DB.SETTINGS);
    settingsSheet.appendRow(['last_restore', getTimestamp_(), 'Last restore from backup']);

    Logger.log(`Restore complete: ${JSON.stringify(restored)}`);

    const message = `Återställning klar!

Återställt:
• ${restored.posts} poster
• ${restored.people} personer
• ${restored.programs} program
• ${restored.post_types} posttyper
• ${restored.log} logg-rader

En säkerhetskopia skapades innan återställningen.`;

    return { success: true, message: message, restored: restored };

  } catch (error) {
    Logger.log(`Restore error: ${error.message}\n${error.stack}`);
    return { success: false, error: error.message };
  }
}

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
