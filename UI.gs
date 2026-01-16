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
  const ui = SpreadsheetApp.getUi()

  ui.createMenu('📋 System')
    .addItem('🚀 Bootstrap Database', 'bootstrapDatabase')
    .addItem('🔄 Generate All Views', 'generateAllViews')
    .addSeparator()
    .addItem('👁️ Show Database Sheets', 'showDbSheets')
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu('💾 Backup & Restore')
        .addItem('📤 Export to JSON', 'exportDatabaseToJson')
        .addItem('💾 Create backup now', 'runBackupNow')
        .addItem('🔄 Restore from backup', 'showRestoreDialog')
        .addSeparator()
        .addItem('⏰ Enable automatic backup', 'installBackupTriggers')
        .addItem('🚫 Disable automatic backup', 'removeBackupTriggers'),
    )
    .addSeparator()
    .addItem('📖 Documentation', 'showDocumentation')
    .addItem('ℹ️ About', 'showAbout')
    .addToUi()

  ui.createMenu('📝 Posts')
    .addItem('➕ Add new post', 'showAddPostDialog')
    .addItem('📋 Import posts (CSV/TSV)', 'showImportDialog')
    .addSeparator()
    .addItem('🗑️ Delete selected post', 'deleteCurrentPost')
    .addItem('⬆️ Move post up', 'movePostUp')
    .addItem('⬇️ Move post down', 'movePostDown')
    .addSeparator()
    .addItem('🔢 Renumber all posts', 'renumberAllPosts')
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu('🗑️ Recycle Bin')
        .addItem('📋 View deleted posts', 'showTrashDialog')
        .addItem('♻️ Empty recycle bin', 'emptyTrash'),
    )
    .addToUi()

  ui.createMenu('👥 People')
    .addItem('➕ Add person', 'showAddPersonDialog')
    .addItem('📋 View all people', 'showPeopleList')
    .addToUi()

  ui.createMenu('🎬 Production')
    .addItem('📅 View recording schedule', 'goToScheduleView')
    .addItem('📊 View overview', 'goToOverviewView')
    .addItem('📜 View credits', 'goToCreditsView')
    .addSeparator()
    .addItem('🎯 Go to active recording', 'goToCurrentPost')
    .addItem('📍 Show recording status', 'showRecordingStatus')
    .addSeparator()
    .addItem('⏺️ Mark post as recording', 'markCurrentPostRecording')
    .addItem('✅ Mark post as recorded', 'markCurrentPostRecorded')
    .addItem('👍 Mark post as approved', 'markCurrentPostApproved')
    .addToUi()

  ui.createMenu('🔗 Integration')
    .addItem('📊 View sync status', 'showSyncStatusDialog')
    .addItem('⚙️ Configure Supabase sync', 'showSyncConfigDialog')
    .addSeparator()
    .addItem('🔑 View API keys', 'showExternalApiDialog')
    .addItem('🔄 Generate new API key', 'generateNewApiKey')
    .addSeparator()
    .addItem('📤 Full sync to Supabase', 'fullSyncToSupabase')
    .addItem('📥 Pull from Supabase', 'pullAllFromSupabase')
    .addSeparator()
    .addItem('🧪 Test API connection', 'testApiConnection')
    .addToUi()

  ui.createMenu('⚙️ Settings')
    .addItem('🎨 Edit post types', 'goToPostTypesSheet')
    .addItem('📝 Edit programme metadata', 'goToProgramsSheet')
    .addItem('🔧 System settings', 'showSettingsDialog')
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu('📦 Archiving')
        .addItem('📦 Archive Programme 1', 'archiveProgram1')
        .addItem('📦 Archive Programme 2', 'archiveProgram2')
        .addItem('📦 Archive Programme 3', 'archiveProgram3')
        .addItem('📦 Archive Programme 4', 'archiveProgram4')
        .addSeparator()
        .addItem('🔄 Archive & clear Programme 1', 'archiveAndClearProgram1')
        .addItem('🔄 Archive & clear Programme 2', 'archiveAndClearProgram2')
        .addItem('🔄 Archive & clear Programme 3', 'archiveAndClearProgram3')
        .addItem('🔄 Archive & clear Programme 4', 'archiveAndClearProgram4'),
    )
    .addSeparator()
    .addItem('🗑️ Clear cache', 'invalidateAllCaches')
    .addToUi()
}

// ============================================================================
// POST MANAGEMENT DIALOGUES
// ============================================================================

/**
 * Show dialogue for adding new post
 */
function showAddPostDialog() {
  const ui = SpreadsheetApp.getUi()
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const activeSheet = ss.getActiveSheet()

  // Determine which programme we're in
  const sheetName = activeSheet.getName()
  const match = sheetName.match(/Program (\d)/)

  let defaultProgramNr = 1
  if (match) {
    defaultProgramNr = parseInt(match[1], 10)
  }

  // Get post types for dropdown
  const postTypes = getAllPostTypes_()
  const typeNames = postTypes.map((pt) => pt[POST_TYPE_SCHEMA.DISPLAY_NAME]).join('\\n')

  const html = HtmlService.createHtmlOutput(
    `
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
    
    <h2>Add new post</h2>

    <label>Programme *</label>
    <select id="program">
      <option value="1" ${defaultProgramNr === 1 ? 'selected' : ''}>Programme 1</option>
      <option value="2" ${defaultProgramNr === 2 ? 'selected' : ''}>Programme 2</option>
      <option value="3" ${defaultProgramNr === 3 ? 'selected' : ''}>Programme 3</option>
      <option value="4" ${defaultProgramNr === 4 ? 'selected' : ''}>Programme 4</option>
    </select>

    <label>Post type *</label>
    <select id="type">
      ${postTypes.map((pt) => `<option value="${pt[POST_TYPE_SCHEMA.TYPE_KEY]}">${pt[POST_TYPE_SCHEMA.ICON]} ${pt[POST_TYPE_SCHEMA.DISPLAY_NAME]}</option>`).join('')}
    </select>

    <label>Content *</label>
    <textarea id="title" placeholder="E.g. 'Sermon on hope'"></textarea>

    <label>Participants (comma-separated)</label>
    <input type="text" id="people" placeholder="E.g. 'Mary Smith, John Jones'" />

    <label>Location</label>
    <select id="location">
      <option value="">- Select location -</option>
      ${LOCATIONS.map((loc) => `<option value="${loc}">${loc}</option>`).join('')}
    </select>

    <label>Recording day</label>
    <select id="recording_day">
      <option value="day1">Day 1 - Scripture Reading & Sermon</option>
      <option value="day2">Day 2 - Music & Choir</option>
      <option value="day3">Day 3 - Congregation (full service)</option>
    </select>

    <label>Notes</label>
    <textarea id="notes" placeholder="Additional notes about the post"></textarea>

    <button onclick="savePost()">Create post</button>
    <button class="cancel-btn" onclick="google.script.host.close()">Cancel</button>
    
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
          alert('Content must be specified');
          return;
        }

        google.script.run
          .withSuccessHandler(() => {
            alert('Post created!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .createPostFromDialog(data);
      }
    </script>
  `,
  )
    .setWidth(500)
    .setHeight(650)

  ui.showModalDialog(html, 'New post')
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
    recording_day: data.recording_day,
  })

  // Handle people (create if new)
  if (data.people) {
    const peopleNames = data.people
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n)
    const peopleIds = []

    peopleNames.forEach((name) => {
      // Check if person exists
      const existing = findPersonByName_(name)
      if (existing) {
        peopleIds.push(existing[PERSON_SCHEMA.ID])
      } else {
        // Create new person
        const newId = createPerson({ name: name })
        peopleIds.push(newId)
      }
    })

    // Update post with people IDs
    if (peopleIds.length > 0) {
      updatePost(postId, { people_ids: peopleIds.join(',') }, 'ui')
    }
  }

  // Refresh view
  refreshProgramView(data.program_nr)

  return postId
}

/**
 * Find person by name (helper)
 */
function findPersonByName_(name) {
  const people = getAllPeople_()
  for (let person of people) {
    if (person[PERSON_SCHEMA.NAME].toLowerCase() === name.toLowerCase()) {
      return person
    }
  }
  return null
}

// ============================================================================
// IMPORT DIALOG
// ============================================================================

/**
 * Show dialog for importing posts from CSV/TSV
 */
function showImportDialog() {
  const ui = SpreadsheetApp.getUi()

  const html = HtmlService.createHtmlOutput(
    `
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

    <h2>📋 Import posts</h2>

    <label>Programme to import to</label>
    <select id="program">
      <option value="1">Programme 1</option>
      <option value="2">Programme 2</option>
      <option value="3">Programme 3</option>
      <option value="4">Programme 4</option>
    </select>

    <label>Format</label>
    <select id="format">
      <option value="tsv">TSV (tab-separated)</option>
      <option value="csv">CSV (comma-separated)</option>
    </select>

    <div class="format-box">
      <strong>Expected format (one row per post):</strong><br>
      <code>type</code> <code>content</code> <code>participants</code> <code>duration</code> <code>location</code> <code>day</code> <code>notes</code><br><br>
      <strong>Example (TSV):</strong><br>
      <code>sermon&emsp;Sermon on love&emsp;Mary Smith&emsp;7:00&emsp;pulpit&emsp;day1&emsp;</code>
    </div>

    <label>Paste data</label>
    <textarea id="data" placeholder="Paste your posts here (one row per post)..."></textarea>
    <div class="help-text">Tip: Copy directly from Excel or Google Sheets</div>

    <div id="result" class="result"></div>

    <button onclick="importData()">Import</button>
    <button class="cancel-btn" onclick="google.script.host.close()">Cancel</button>

    <script>
      function importData() {
        const data = {
          program_nr: parseInt(document.getElementById('program').value),
          format: document.getElementById('format').value,
          data: document.getElementById('data').value.trim()
        };

        if (!data.data) {
          showResult('No data to import', true);
          return;
        }

        document.getElementById('result').innerHTML = 'Importing...';
        document.getElementById('result').className = 'result success';

        google.script.run
          .withSuccessHandler((result) => {
            showResult(result.message, false);
            if (result.success) {
              setTimeout(() => google.script.host.close(), 2000);
            }
          })
          .withFailureHandler((error) => {
            showResult('Error: ' + error.message, true);
          })
          .importPostsFromDialog(data);
      }

      function showResult(message, isError) {
        const el = document.getElementById('result');
        el.innerHTML = message;
        el.className = 'result ' + (isError ? 'error' : 'success');
      }
    </script>
  `,
  )
    .setWidth(600)
    .setHeight(650)

  ui.showModalDialog(html, 'Import posts')
}

/**
 * Server-side function to import posts from dialog
 */
function importPostsFromDialog(data) {
  const { program_nr, format, data: rawData } = data

  // Parse the data
  const delimiter = format === 'csv' ? ',' : '\t'
  const lines = rawData.split('\n').filter((line) => line.trim())

  if (lines.length === 0) {
    return { success: false, message: 'No data to import' }
  }

  let imported = 0
  let errors = []

  lines.forEach((line, index) => {
    try {
      const parts = line.split(delimiter)

      // Expected: type, content, participants, duration, location, day, notes
      const postData = {
        program_nr: program_nr,
        type: (parts[0] || 'liturgy').trim().toLowerCase(),
        title: (parts[1] || '').trim(),
        recording_day: (parts[5] || 'day1').trim().toLowerCase(),
        location: (parts[4] || '').trim(),
        notes: (parts[6] || '').trim(),
      }

      // Parse duration
      if (parts[3]) {
        postData.duration = parseDurationToSeconds_(parts[3].trim())
      }

      // Skip empty titles
      if (!postData.title) {
        errors.push(`Row ${index + 1}: Empty title, skipping`)
        return
      }

      // Create the post
      const postId = createPost(postData)

      // Handle people if specified
      if (parts[2] && parts[2].trim()) {
        const peopleNames = parts[2]
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n)
        const peopleIds = []

        peopleNames.forEach((name) => {
          const existing = findPersonByName_(name)
          if (existing) {
            peopleIds.push(existing[PERSON_SCHEMA.ID])
          } else {
            const newId = createPerson({ name: name })
            peopleIds.push(newId)
          }
        })

        if (peopleIds.length > 0) {
          updatePost(postId, { people_ids: peopleIds.join(',') }, 'import')
        }
      }

      imported++
    } catch (error) {
      errors.push(`Row ${index + 1}: ${error.message}`)
    }
  })

  // Refresh the view
  refreshProgramView(program_nr)

  let message = `Imported ${imported} of ${lines.length} posts to Programme ${program_nr}.`
  if (errors.length > 0) {
    message += `\n\nWarnings:\n${errors.slice(0, 5).join('\n')}`
    if (errors.length > 5) {
      message += `\n... and ${errors.length - 5} more`
    }
  }

  return { success: imported > 0, message: message }
}

// ============================================================================
// DELETE POST
// ============================================================================

/**
 * Delete currently selected post
 */
function deleteCurrentPost() {
  const ui = SpreadsheetApp.getUi()
  const postId = getCurrentPostId_()

  if (!postId) {
    ui.alert(
      'No post selected',
      'Select a row with a post first (click on a cell in the post row)',
      ui.ButtonSet.OK,
    )
    return
  }

  // Get post details for confirmation
  const sheet = SpreadsheetApp.getActiveSheet()
  const row = sheet.getActiveCell().getRow()
  const postTitle = sheet.getRange(row, 3).getValue() // Column C = Content

  const confirm = ui.alert(
    'Delete post?',
    `Are you sure you want to delete post ${postId}?\n\n"${postTitle}"\n\nThis cannot be undone!`,
    ui.ButtonSet.YES_NO,
  )

  if (confirm !== ui.Button.YES) {
    return
  }

  try {
    deletePost(postId)

    // Determine which program we're in and refresh
    const sheetName = sheet.getName()
    const match = sheetName.match(/Program (\d)/)
    if (match) {
      const programNr = parseInt(match[1], 10)
      refreshProgramView(programNr)
    }

    ui.alert('Post deleted', `Post ${postId} has been deleted.`, ui.ButtonSet.OK)
  } catch (error) {
    ui.alert('Error', `Could not delete post: ${error.message}`, ui.ButtonSet.OK)
    Logger.log(`Delete post error: ${error.stack}`)
  }
}

// ============================================================================
// POST STATUS UPDATES
// ============================================================================

/**
 * Mark current post as recorded
 */
function markCurrentPostRecorded() {
  const postId = getCurrentPostId_()
  if (!postId) {
    SpreadsheetApp.getUi().alert('Select a row with a post first')
    return
  }

  updatePost(postId, { status: POST_STATUS.RECORDED.key }, 'ui')
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Post ${postId} marked as recorded`,
    'Status updated',
    2,
  )

  // Refresh current view
  SpreadsheetApp.flush()
}

/**
 * Mark current post as recording
 */
function markCurrentPostRecording() {
  const postId = getCurrentPostId_()
  if (!postId) {
    SpreadsheetApp.getUi().alert('Select a row with a post first')
    return
  }

  updatePost(postId, { status: POST_STATUS.RECORDING.key }, 'ui')
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Post ${postId} marked as recording`,
    'Status updated',
    2,
  )

  SpreadsheetApp.flush()
}

/**
 * Get post ID from currently selected row
 */
function getCurrentPostId_() {
  const sheet = SpreadsheetApp.getActiveSheet()
  const row = sheet.getActiveCell().getRow()

  if (row < VIEW_CONFIG.DATA_START_ROW) return null

  // Post ID is in column A
  const postId = sheet.getRange(row, 1).getValue()

  // Validate format (PX:YY)
  if (typeof postId === 'string' && postId.match(/^P\d:\d+$/)) {
    return postId
  }

  return null
}

// ============================================================================
// POST MOVEMENT (reordering)
// ============================================================================

/**
 * Move current post up in sort order
 */
function movePostUp() {
  movePost_(-1)
}

/**
 * Move current post down in sort order
 */
function movePostDown() {
  movePost_(1)
}

/**
 * Move post up or down by swapping sort_order values
 * @param {Number} direction - -1 for up, 1 for down
 */
function movePost_(direction) {
  const ui = SpreadsheetApp.getUi()
  const sheet = SpreadsheetApp.getActiveSheet()
  const sheetName = sheet.getName()

  // Verify we're in a programme view
  const match = sheetName.match(/^Programme (\d)$/)
  if (!match) {
    ui.alert(
      'Error',
      'This function only works in Programme views (Programme 1-4)',
      ui.ButtonSet.OK,
    )
    return
  }

  const programNr = parseInt(match[1], 10)
  const postId = getCurrentPostId_()

  if (!postId) {
    ui.alert('No post selected', 'Select a row with a post first', ui.ButtonSet.OK)
    return
  }

  try {
    // Get all posts for this program, sorted by sort_order
    const posts = getAllPostsForProgram_(programNr)
    posts.sort((a, b) => a[POST_SCHEMA.SORT_ORDER] - b[POST_SCHEMA.SORT_ORDER])

    // Find current post index
    let currentIndex = -1
    for (let i = 0; i < posts.length; i++) {
      if (posts[i][POST_SCHEMA.ID] === postId) {
        currentIndex = i
        break
      }
    }

    if (currentIndex === -1) {
      throw new Error('Post not found in database')
    }

    // Calculate target index
    const targetIndex = currentIndex + direction

    // Check bounds
    if (targetIndex < 0) {
      ui.alert('Cannot move', 'The post is already at the top of the list', ui.ButtonSet.OK)
      return
    }
    if (targetIndex >= posts.length) {
      ui.alert('Cannot move', 'The post is already at the bottom of the list', ui.ButtonSet.OK)
      return
    }

    // Get the two posts to swap
    const currentPost = posts[currentIndex]
    const targetPost = posts[targetIndex]

    // Swap sort_order values
    const currentSortOrder = currentPost[POST_SCHEMA.SORT_ORDER]
    const targetSortOrder = targetPost[POST_SCHEMA.SORT_ORDER]

    // Update both posts in database
    updatePost(currentPost[POST_SCHEMA.ID], { sort_order: targetSortOrder }, 'ui')
    updatePost(targetPost[POST_SCHEMA.ID], { sort_order: currentSortOrder }, 'ui')

    // Refresh the view
    refreshProgramView(programNr)

    // Show confirmation
    const directionText = direction === -1 ? 'up' : 'down'
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Post ${postId} moved ${directionText}`,
      'Post moved',
      2,
    )
  } catch (error) {
    ui.alert('Error', `Could not move post: ${error.message}`, ui.ButtonSet.OK)
    Logger.log(`Move post error: ${error.stack}`)
  }
}

// ============================================================================
// PERSON MANAGEMENT DIALOGUES
// ============================================================================

/**
 * Show dialogue for adding new person
 */
function showAddPersonDialog() {
  const ui = SpreadsheetApp.getUi()

  const html = HtmlService.createHtmlOutput(
    `
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

    <h2>👥 Add person</h2>

    <label class="required">Name</label>
    <input type="text" id="name" placeholder="E.g. 'Mary Smith'" />

    <label>Role(s)</label>
    <input type="text" id="roles" placeholder="E.g. 'preacher, liturgist'" />
    <div class="help-text">Comma-separated if multiple roles</div>

    <label>Contact</label>
    <input type="text" id="contact" placeholder="Email or phone" />

    <label>Type</label>
    <select id="type">
      <option value="participant">Participant (in the service)</option>
      <option value="team">Team (production staff)</option>
      <option value="composer">Composer</option>
      <option value="text_author">Text author</option>
    </select>

    <button onclick="savePerson()">Create person</button>
    <button class="cancel-btn" onclick="google.script.host.close()">Cancel</button>

    <script>
      function savePerson() {
        const data = {
          name: document.getElementById('name').value.trim(),
          roles: document.getElementById('roles').value.trim(),
          contact: document.getElementById('contact').value.trim(),
          type: document.getElementById('type').value
        };

        if (!data.name) {
          alert('Name must be specified');
          return;
        }

        google.script.run
          .withSuccessHandler((personId) => {
            alert('Person created: ' + personId);
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .createPersonFromDialog(data);
      }
    </script>
  `,
  )
    .setWidth(450)
    .setHeight(450)

  ui.showModalDialog(html, 'New person')
}

/**
 * Server-side function called from person dialogue
 */
function createPersonFromDialog(data) {
  // Check if person already exists
  const existing = findPersonByName_(data.name)
  if (existing) {
    throw new Error(
      `A person with the name "${data.name}" already exists (ID: ${existing[PERSON_SCHEMA.ID]})`,
    )
  }

  // Create person in database
  const personId = createPerson({
    name: data.name,
    roles: data.roles,
    contact: data.contact,
    type: data.type,
  })

  Logger.log(`Created person from dialog: ${personId}`)
  return personId
}

/**
 * Show list of all people
 */
function showPeopleList() {
  const ui = SpreadsheetApp.getUi()
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  // Navigate to credits view which shows all people
  const sheet = ss.getSheetByName(VIEW.CREDITS)
  if (sheet) {
    ss.setActiveSheet(sheet)
    ui.alert(
      'Credits',
      'All registered people are shown here.\n\nTo add a new person:\nPeople > Add person',
      ui.ButtonSet.OK,
    )
  } else {
    ui.alert(
      'Error',
      'Credits sheet does not exist. Run System > Generate All Views first.',
      ui.ButtonSet.OK,
    )
  }
}

// ============================================================================
// RECORDING STATUS & QUICK ACTIONS
// ============================================================================

/**
 * Show current recording status dialog
 */
function showRecordingStatus() {
  const ui = SpreadsheetApp.getUi()
  const info = getCurrentPostInfo()

  if (!info.hasCurrentPost) {
    // Get stats from database
    const postsSheet = getDbSheet_(DB.POSTS)
    const data = postsSheet.getDataRange().getValues()

    let planned = 0,
      recording = 0,
      recorded = 0,
      approved = 0

    for (let i = 1; i < data.length; i++) {
      const status = data[i][POST_SCHEMA.STATUS]
      if (status === POST_STATUS.PLANNED.key) planned++
      else if (status === POST_STATUS.RECORDING.key) recording++
      else if (status === POST_STATUS.RECORDED.key) recorded++
      else if (status === POST_STATUS.APPROVED.key) approved++
    }

    const total = planned + recording + recorded + approved
    const progress = total > 0 ? Math.round(((recorded + approved) / total) * 100) : 0

    ui.alert(
      '📊 Recording Status',
      `No active recording at this time.\n\n` +
        `STATISTICS:\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📝 Planned: ${planned}\n` +
        `⏺️ Recording: ${recording}\n` +
        `✅ Recorded: ${recorded}\n` +
        `👍 Approved: ${approved}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `Total: ${total} posts\n` +
        `Progress: ${progress}%`,
      ui.ButtonSet.OK,
    )
  } else {
    // Get post details
    const postsSheet = getDbSheet_(DB.POSTS)
    const data = postsSheet.getDataRange().getValues()
    let postData = null

    for (let i = 1; i < data.length; i++) {
      if (data[i][POST_SCHEMA.ID] === info.post_id) {
        postData = data[i]
        break
      }
    }

    if (postData) {
      const postType = getPostTypeByKey_(postData[POST_SCHEMA.TYPE])
      const typeName = postType ? postType.display_name : postData[POST_SCHEMA.TYPE]

      ui.alert(
        '🎬 ACTIVE RECORDING',
        `POST: ${info.post_id}\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `Type: ${typeName}\n` +
          `Content: ${postData[POST_SCHEMA.TITLE] || '(no title)'}\n` +
          `Duration: ${formatDuration_(postData[POST_SCHEMA.DURATION])}\n` +
          `Location: ${postData[POST_SCHEMA.LOCATION] || '(not specified)'}\n` +
          `━━━━━━━━━━━━━━━━━━━\n\n` +
          `Click "Production > Go to active recording"\n` +
          `to navigate to the post.`,
        ui.ButtonSet.OK,
      )
    } else {
      ui.alert('Active recording', `Post ${info.post_id} is marked as active.`, ui.ButtonSet.OK)
    }
  }
}

/**
 * Mark current post as approved
 */
function markCurrentPostApproved() {
  const ui = SpreadsheetApp.getUi()
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const activeSheet = ss.getActiveSheet()
  const sheetName = activeSheet.getName()

  // Check if we're in a programme view
  const programMatch = sheetName.match(/^Programme (\d+)$/)
  if (!programMatch) {
    ui.alert(
      'Error',
      'This function only works from Programme views (Programme 1, 2, 3 or 4).',
      ui.ButtonSet.OK,
    )
    return
  }

  // Get current row
  const activeRow = ss.getActiveRange().getRow()
  if (activeRow < VIEW_CONFIG.DATA_START_ROW) {
    ui.alert('Error', 'Select a post row first (row 7 or later).', ui.ButtonSet.OK)
    return
  }

  // Get post_id from column A
  const postId = activeSheet.getRange(activeRow, 1).getValue()
  if (!postId || !postId.match || !postId.match(/^P\d+:\d+$/)) {
    ui.alert('Error', 'Could not find post_id. Select a row with a post.', ui.ButtonSet.OK)
    return
  }

  try {
    updatePost(postId, { status: POST_STATUS.APPROVED.key }, 'ui')
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Post ${postId} marked as approved`,
      '👍 Approved',
      3,
    )
  } catch (error) {
    ui.alert('Error', `Could not update post: ${error.message}`, ui.ButtonSet.OK)
  }
}

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Navigate to schedule view
 */
function goToScheduleView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(VIEW.SCHEDULE)
  if (sheet) {
    ss.setActiveSheet(sheet)
  }
}

/**
 * Navigate to overview
 */
function goToOverviewView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(VIEW.OVERVIEW)
  if (sheet) {
    ss.setActiveSheet(sheet)
  }
}

/**
 * Navigate to credits
 */
function goToCreditsView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(VIEW.CREDITS)
  if (sheet) {
    ss.setActiveSheet(sheet)
  }
}

/**
 * Show post types sheet
 */
function goToPostTypesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(DB.POST_TYPES)
  if (sheet) {
    sheet.showSheet()
    ss.setActiveSheet(sheet)
    SpreadsheetApp.getUi().alert('You can now edit post types. Hide the sheet again when finished.')
  }
}

/**
 * Show programmes metadata sheet
 */
function goToProgramsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(DB.PROGRAMS)
  if (sheet) {
    sheet.showSheet()
    ss.setActiveSheet(sheet)
    SpreadsheetApp.getUi().alert(
      'You can now edit programme metadata. Hide the sheet again when finished.',
    )
  }
}

// ============================================================================
// ARCHIVING WRAPPER FUNCTIONS
// ============================================================================

function archiveProgram1() {
  archiveProgram(1)
}
function archiveProgram2() {
  archiveProgram(2)
}
function archiveProgram3() {
  archiveProgram(3)
}
function archiveProgram4() {
  archiveProgram(4)
}

function archiveAndClearProgram1() {
  archiveAndClearProgram(1)
}
function archiveAndClearProgram2() {
  archiveAndClearProgram(2)
}
function archiveAndClearProgram3() {
  archiveAndClearProgram(3)
}
function archiveAndClearProgram4() {
  archiveAndClearProgram(4)
}

// ============================================================================
// INFORMATION DIALOGUES
// ============================================================================

/**
 * Show about dialogue
 */
function showAbout() {
  const ui = SpreadsheetApp.getUi()
  ui.alert(
    'About',
    `${SYSTEM_NAME} v${SYSTEM_VERSION}\\n\\n` +
      `Created by: ${CREATED_BY}\\n\\n` +
      'A modern production system for church service television based on ' +
      'normalised database and dynamic views.\\n\\n' +
      'Architecture:\\n' +
      '• Database layer (_DB_*): Single source of truth\\n' +
      '• View layer (Programme 1-4, etc): Read-only presentation\\n' +
      '• API layer: Prepared for Companion/BMD integration',
    ui.ButtonSet.OK,
  )
}

/**
 * Show documentation
 */
function showDocumentation() {
  const ui = SpreadsheetApp.getUi()
  ui.alert(
    'Documentation',
    'QUICK START:\\n\\n' +
      '1. Run "System > Bootstrap Database" (once)\\n' +
      '2. Edit programme metadata via "Settings > Edit programme metadata"\\n' +
      '3. Add people via "People > Add person"\\n' +
      '4. Create posts via "Posts > Add new post"\\n\\n' +
      'WORKFLOW:\\n' +
      '• Programme 1-4: Edit directly in the views\\n' +
      '• Recording Schedule: Auto-generated overview\\n' +
      '• Overview: Dashboard with statistics\\n\\n' +
      'Full documentation: github.com/davidthast/church-service-system',
    ui.ButtonSet.OK,
  )
}

// ============================================================================
// SETTINGS DIALOG
// ============================================================================

/**
 * Show system settings dialog
 */
function showSettingsDialog() {
  const ui = SpreadsheetApp.getUi()

  // Get current settings
  const settingsSheet = getDbSheet_(DB.SETTINGS)
  const settingsData = settingsSheet.getDataRange().getValues()

  // Build settings object
  const settings = {}
  for (let i = 1; i < settingsData.length; i++) {
    settings[settingsData[i][0]] = settingsData[i][1]
  }

  const html = HtmlService.createHtmlOutput(
    `
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

    <h2>⚙️ System Settings</h2>

    <div class="info-box">
      <strong>Version:</strong> ${settings['system_version'] || 'Unknown'}<br>
      <strong>Last bootstrap:</strong> ${settings['last_bootstrap'] || 'Never'}
    </div>

    <div class="setting-group">
      <h3>📍 Location Settings</h3>
      <label>Default location (church)</label>
      <input type="text" id="location_name" value="${settings['location_name'] || ''}" />
      <div class="help-text">Used as default for new programmes</div>
    </div>

    <div class="setting-group">
      <h3>⏰ Time Settings</h3>
      <label>Default start time (Day 1)</label>
      <input type="text" id="default_start_time" value="${settings['default_start_time'] || '09:00:00'}" placeholder="HH:MM:SS" />
      <div class="help-text">Format: HH:MM:SS (e.g. 09:00:00)</div>
    </div>

    <div class="setting-group">
      <h3>🔌 API Settings</h3>
      <label>API enabled</label>
      <select id="api_enabled">
        <option value="false" ${settings['api_enabled'] !== 'true' ? 'selected' : ''}>No (default)</option>
        <option value="true" ${settings['api_enabled'] === 'true' ? 'selected' : ''}>Yes</option>
      </select>
      <div class="help-text">Enable for Companion/vMix integration</div>
    </div>

    <button onclick="saveSettings()">Save settings</button>
    <button class="cancel-btn" onclick="google.script.host.close()">Cancel</button>

    <script>
      function saveSettings() {
        const data = {
          location_name: document.getElementById('location_name').value,
          default_start_time: document.getElementById('default_start_time').value,
          api_enabled: document.getElementById('api_enabled').value
        };

        google.script.run
          .withSuccessHandler(() => {
            alert('Settings saved!');
            google.script.host.close();
          })
          .withFailureHandler((error) => {
            alert('Error: ' + error.message);
          })
          .saveSettingsFromDialog(data);
      }
    </script>
  `,
  )
    .setWidth(500)
    .setHeight(550)

  ui.showModalDialog(html, 'System Settings')
}

/**
 * Save settings from dialog
 */
function saveSettingsFromDialog(data) {
  const sheet = getDbSheet_(DB.SETTINGS)
  const settingsData = sheet.getDataRange().getValues()

  // Update each setting
  Object.keys(data).forEach((key) => {
    for (let i = 1; i < settingsData.length; i++) {
      if (settingsData[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(data[key])
        break
      }
    }
  })

  Logger.log('Settings saved from dialog')
}

// ============================================================================
// TRASH / RECYCLE BIN FUNCTIONS
// ============================================================================

/**
 * Show dialog with deleted posts (trash)
 */
function showTrashDialog() {
  const ui = SpreadsheetApp.getUi()
  const deletedPosts = getDeletedPosts_()

  if (deletedPosts.length === 0) {
    ui.alert('Recycle bin is empty', 'There are no deleted posts to display.', ui.ButtonSet.OK)
    return
  }

  const html = HtmlService.createHtmlOutput(
    `
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

    <h2>🗑️ Recycle Bin</h2>

    <div class="info-box">
      Click "Restore" to restore a deleted post.
      The post will be restored to its original programme.
    </div>

    <table>
      <tr>
        <th>Post ID</th>
        <th>Pgm</th>
        <th>Type</th>
        <th>Content</th>
        <th>Deleted</th>
        <th></th>
      </tr>
      ${deletedPosts
        .map(
          (p) => `
        <tr>
          <td>${p.post_id}</td>
          <td>${p.program_nr}</td>
          <td>${p.type}</td>
          <td>${(p.title || '').substring(0, 30)}${(p.title || '').length > 30 ? '...' : ''}</td>
          <td>${p.deleted_at}</td>
          <td><button class="btn btn-restore" onclick="restorePost('${p.post_id}')">♻️ Restore</button></td>
        </tr>
      `,
        )
        .join('')}
    </table>

    <div id="result" class="result"></div>

    <button class="close-btn" onclick="google.script.host.close()">Close</button>

    <script>
      function restorePost(postId) {
        const resultEl = document.getElementById('result');
        resultEl.className = 'result loading';
        resultEl.innerHTML = 'Restoring post...';

        google.script.run
          .withSuccessHandler(function(result) {
            resultEl.className = 'result success';
            resultEl.innerHTML = 'Post restored! Closing dialog...';
            setTimeout(() => {
              google.script.host.close();
            }, 1500);
          })
          .withFailureHandler(function(error) {
            resultEl.className = 'result error';
            resultEl.innerHTML = 'Error: ' + error.message;
          })
          .restoreDeletedPost(postId);
      }
    </script>
  `,
  )
    .setWidth(600)
    .setHeight(450)

  ui.showModalDialog(html, 'Recycle Bin - Deleted Posts')
}

// ============================================================================
// BACKUP & RESTORE FUNCTIONS
// ============================================================================

/**
 * Show dialog for restoring from backup
 */
function showRestoreDialog() {
  const ui = SpreadsheetApp.getUi()

  const html = HtmlService.createHtmlOutput(
    `
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

    <h2>🔄 Restore from backup</h2>

    <div class="warning-box">
      <h3>⚠️ Warning</h3>
      This will <strong>REPLACE</strong> all existing data in the database.
      This action cannot be undone!
    </div>

    <div class="tabs">
      <button class="tab active" onclick="showTab('drive')">📁 From Google Drive</button>
      <button class="tab" onclick="showTab('json')">📋 From JSON</button>
    </div>

    <div id="drive-tab" class="tab-content active">
      <div class="info-box">
        Select a backup file from the "ChurchService_Backups" folder in Google Drive.
      </div>
      <label>Available backups</label>
      <select id="backup-file">
        <option value="">Loading...</option>
      </select>
    </div>

    <div id="json-tab" class="tab-content">
      <div class="info-box">
        Paste JSON data from a previous export or backup file.
      </div>
      <label>JSON data</label>
      <textarea id="json-data" placeholder='{"version": "1.0.0", "posts": [...], ...}'></textarea>
    </div>

    <div id="result" class="result"></div>

    <button onclick="doRestore()">⚠️ Restore data</button>
    <button class="cancel-btn" onclick="google.script.host.close()">Cancel</button>

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
            select.innerHTML = '<option value="">No backups found</option>';
          } else {
            select.innerHTML = '<option value="">-- Select backup --</option>' +
              files.map(f => '<option value="' + f.id + '">' + f.name + ' (' + f.date + ')</option>').join('');
          }
        })
        .withFailureHandler(function(error) {
          document.getElementById('backup-file').innerHTML =
            '<option value="">Error: ' + error.message + '</option>';
        })
        .getAvailableBackups();

      function doRestore() {
        const resultEl = document.getElementById('result');
        resultEl.className = 'result loading';
        resultEl.innerHTML = 'Restoring data...';

        if (activeTab === 'drive') {
          const fileId = document.getElementById('backup-file').value;
          if (!fileId) {
            resultEl.className = 'result error';
            resultEl.innerHTML = 'Select a backup file first';
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
            resultEl.innerHTML = 'Paste JSON data first';
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
          resultEl.innerHTML = 'Error: ' + result.error;
        }
      }

      function handleError(error) {
        const resultEl = document.getElementById('result');
        resultEl.className = 'result error';
        resultEl.innerHTML = 'Error: ' + error.message;
      }
    </script>
  `,
  )
    .setWidth(550)
    .setHeight(600)

  ui.showModalDialog(html, 'Restore from backup')
}

/**
 * Get list of available backup files from Google Drive
 */
function getAvailableBackups() {
  try {
    // Get backup folder
    const settingsSheet = getDbSheet_(DB.SETTINGS)
    const settingsData = settingsSheet.getDataRange().getValues()
    let folderId = null

    for (let i = 1; i < settingsData.length; i++) {
      if (settingsData[i][0] === 'backup_folder_id') {
        folderId = settingsData[i][1]
        break
      }
    }

    if (!folderId) {
      return []
    }

    const folder = DriveApp.getFolderById(folderId)
    const files = folder.getFilesByType(MimeType.PLAIN_TEXT)
    const backups = []

    while (files.hasNext()) {
      const file = files.next()
      if (file.getName().startsWith('gudstjanst_backup_')) {
        backups.push({
          id: file.getId(),
          name: file.getName(),
          date: file.getDateCreated().toLocaleString('sv-SE'),
        })
      }
    }

    // Sort by date (newest first)
    backups.sort((a, b) => b.date.localeCompare(a.date))

    return backups
  } catch (error) {
    Logger.log(`Error getting backups: ${error.message}`)
    return []
  }
}

/**
 * Restore database from Google Drive backup file
 */
function restoreFromDriveBackup(fileId) {
  try {
    const file = DriveApp.getFileById(fileId)
    const json = file.getBlob().getDataAsString()

    return restoreFromJsonBackup(json)
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Restore database from JSON string
 */
function restoreFromJsonBackup(jsonString) {
  const ui = SpreadsheetApp.getUi()

  try {
    const data = JSON.parse(jsonString)

    // Validate required fields
    if (!data.posts || !data.people || !data.programs) {
      return { success: false, error: 'Invalid backup file: missing posts, people or programs' }
    }

    // Create pre-restore backup
    Logger.log('Creating pre-restore backup...')
    const preBackupResult = dailyBackup()
    if (!preBackupResult.success) {
      Logger.log('Warning: Could not create pre-restore backup')
    }

    // Restore each table
    let restored = {
      posts: 0,
      people: 0,
      programs: 0,
      post_types: 0,
      log: 0,
      settings: 0,
    }

    // Restore posts
    if (data.posts && data.posts.length > 1) {
      const sheet = getDbSheet_(DB.POSTS)
      sheet.clear()
      sheet.getRange(1, 1, data.posts.length, data.posts[0].length).setValues(data.posts)
      restored.posts = data.posts.length - 1 // Minus header
    }

    // Restore people
    if (data.people && data.people.length > 1) {
      const sheet = getDbSheet_(DB.PEOPLE)
      sheet.clear()
      sheet.getRange(1, 1, data.people.length, data.people[0].length).setValues(data.people)
      restored.people = data.people.length - 1
    }

    // Restore programs
    if (data.programs && data.programs.length > 1) {
      const sheet = getDbSheet_(DB.PROGRAMS)
      sheet.clear()
      sheet.getRange(1, 1, data.programs.length, data.programs[0].length).setValues(data.programs)
      restored.programs = data.programs.length - 1
    }

    // Restore post types
    if (data.post_types && data.post_types.length > 1) {
      const sheet = getDbSheet_(DB.POST_TYPES)
      sheet.clear()
      sheet
        .getRange(1, 1, data.post_types.length, data.post_types[0].length)
        .setValues(data.post_types)
      restored.post_types = data.post_types.length - 1
    }

    // Restore log
    if (data.log && data.log.length > 1) {
      const sheet = getDbSheet_(DB.LOG)
      sheet.clear()
      sheet.getRange(1, 1, data.log.length, data.log[0].length).setValues(data.log)
      restored.log = data.log.length - 1
    }

    // Restore settings (but preserve some system settings)
    if (data.settings && data.settings.length > 1) {
      const sheet = getDbSheet_(DB.SETTINGS)
      const currentSettings = sheet.getDataRange().getValues()

      // Preserve backup_folder_id
      let backupFolderId = null
      for (let i = 1; i < currentSettings.length; i++) {
        if (currentSettings[i][0] === 'backup_folder_id') {
          backupFolderId = currentSettings[i][1]
          break
        }
      }

      sheet.clear()
      sheet.getRange(1, 1, data.settings.length, data.settings[0].length).setValues(data.settings)

      // Re-add backup folder ID
      if (backupFolderId) {
        sheet.appendRow([
          'backup_folder_id',
          backupFolderId,
          'Google Drive folder for automatic backups',
        ])
      }

      restored.settings = data.settings.length - 1
    }

    // Add restore timestamp
    const settingsSheet = getDbSheet_(DB.SETTINGS)
    settingsSheet.appendRow(['last_restore', getTimestamp_(), 'Last restore from backup'])

    Logger.log(`Restore complete: ${JSON.stringify(restored)}`)

    const message = `Restore complete!

Restored:
• ${restored.posts} posts
• ${restored.people} people
• ${restored.programs} programmes
• ${restored.post_types} post types
• ${restored.log} log rows

A backup was created before the restore.`

    return { success: true, message: message, restored: restored }
  } catch (error) {
    Logger.log(`Restore error: ${error.message}\n${error.stack}`)
    return { success: false, error: error.message }
  }
}

/**
 * Export database to JSON (for backup/GitHub)
 */
function exportDatabaseToJson() {
  const ui = SpreadsheetApp.getUi()

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
      settings: getDbSheet_(DB.SETTINGS).getDataRange().getValues(),
    }

    const json = JSON.stringify(dbData, null, 2)

    // Show in dialogue for copy/paste
    const html = HtmlService.createHtmlOutput(
      `
      <style>
        body { font-family: monospace; font-size: 11px; }
        textarea { width: 100%; height: 500px; }
      </style>
      <h3>Database JSON Export</h3>
      <p>Copy this JSON and save it to your GitHub repository:</p>
      <textarea>${json}</textarea>
      <p><small>File suggestion: data/backup_${new Date().toISOString().split('T')[0]}.json</small></p>
    `,
    )
      .setWidth(700)
      .setHeight(650)

    ui.showModalDialog(html, 'Export Database')
  } catch (error) {
    ui.alert('Export failed', error.message, ui.ButtonSet.OK)
  }
}
