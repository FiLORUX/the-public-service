/**
 * VIEW LAYER
 * 
 * Generates user-facing sheets using QUERY formulas from database.
 * Views are READ-ONLY presentation layers.
 * 
 * Philosophy:
 * - Views are disposable (can be regenerated anytime)
 * - All data comes from database sheets via QUERY
 * - User edits trigger custom functions that write to database
 * - Dynamic conditional formatting based on data
 */

// ============================================================================
// MAIN VIEW GENERATION
// ============================================================================

/**
 * Generate all programme views (called after bootstrap or on demand)
 */
function generateAllViews() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    // Create programme views
    for (let i = 1; i <= 4; i++) {
      createProgramView_(i);
    }
    
    // Create schedule view
    createScheduleView_();
    
    // Create overview dashboard
    createOverviewView_();
    
    // Create credits view
    createCreditsView_();
    
    ui.alert('Success', 'All views generated successfully!', ui.ButtonSet.OK);
    
  } catch (error) {
    ui.alert('Error', `View generation failed: ${error.message}`, ui.ButtonSet.OK);
    Logger.log(`View generation error: ${error.stack}`);
  }
}

// ============================================================================
// PROGRAMME VIEW
// ============================================================================

/**
 * Create individual programme view
 * This replaces both "Kort" and "Lång" with a single intelligent view
 */
function createProgramView_(programNr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = `Program ${programNr}`;
  
  // Get or create sheet
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(sheetName);
  }
  
  // Set tab colour
  sheet.setTabColor(COLOURS.VIEW_SHEET_TAB);
  
  // ================================
  // HEADER SECTION (Rows 1-5)
  // ================================
  
  // Title row
  sheet.getRange('A1:J1').merge();
  sheet.getRange('A1').setValue(`PROGRAM ${programNr} - KÖRSCHEMA`);
  sheet.getRange('A1').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A1').setBackground(COLOURS.HEADER_BG).setFontColor(COLOURS.HEADER_TEXT);
  sheet.setRowHeight(1, 40);
  
  // Programme metadata row 2
  sheet.getRange('A2').setValue('Plats:');
  sheet.getRange('B2').setFormula(`=IFERROR(INDEX(_DB_Program!B:B,MATCH(${programNr},_DB_Program!A:A,0)),"")`);
  sheet.getRange('D2').setValue('Inspeln.start:');
  sheet.getRange('E2').setFormula(`=IFERROR(INDEX(_DB_Program!C:C,MATCH(${programNr},_DB_Program!A:A,0)),"")`);
  sheet.getRange('G2').setValue('Sändning:');
  sheet.getRange('H2').setFormula(`=IFERROR(INDEX(_DB_Program!D:D,MATCH(${programNr},_DB_Program!A:A,0)),"")`);
  
  // Programme metadata row 3
  sheet.getRange('A3').setValue('Kyrkoåret:');
  sheet.getRange('B3').setFormula(`=IFERROR(INDEX(_DB_Program!E:E,MATCH(${programNr},_DB_Program!A:A,0)),"")`);
  sheet.getRange('D3').setValue('Prod.nr:');
  sheet.getRange('E3').setFormula(`=IFERROR(INDEX(_DB_Program!F:F,MATCH(${programNr},_DB_Program!A:A,0)),"")`);
  sheet.getRange('G3').setValue('Måltid:');
  sheet.getRange('H3').setFormula(`=TEXT(IFERROR(INDEX(_DB_Program!G:G,MATCH(${programNr},_DB_Program!A:A,0))/86400,"00:00:00"),"[hh]:mm:ss")`);
  
  // Statistics row 4
  sheet.getRange('A4').setValue('Total tid:');
  sheet.getRange('B4').setFormula(`=TEXT(SUMIF(_DB_Posts!B:B,${programNr},_DB_Posts!F:F)/86400,"[hh]:mm:ss")`);
  sheet.getRange('D4').setValue('Antal poster:');
  sheet.getRange('E4').setFormula(`=COUNTIF(_DB_Posts!B:B,${programNr})`);
  sheet.getRange('G4').setValue('Inspelningsdagar:');
  sheet.getRange('H4').setFormula(`=JOIN(", ",UNIQUE(FILTER(_DB_Posts!L:L,_DB_Posts!B:B=${programNr},_DB_Posts!L:L<>"")))`);
  
  // Style metadata rows
  sheet.getRange('A2:A4').setFontWeight('bold');
  sheet.getRange('D2:D4').setFontWeight('bold');
  sheet.getRange('G2:G4').setFontWeight('bold');
  sheet.getRange('A2:J4').setBackground('#F5F5F5');
  
  // Empty row 5
  sheet.setRowHeight(5, 10);
  
  // ================================
  // COLUMN HEADERS (Row 6)
  // ================================
  
  const headers = ['NR', 'Typ', 'Innehåll', 'Medverkande', 'Dur', 'Rullande', 'Plats', 'Dag', 'Status', 'Anteckningar'];
  const headerRange = sheet.getRange(6, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground(COLOURS.HEADER_BG);
  headerRange.setFontColor(COLOURS.HEADER_TEXT);
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setRowHeight(6, 35);
  
  // Freeze headers
  sheet.setFrozenRows(6);
  
  // ================================
  // DATA SECTION (Row 7+)
  // ================================
  
  // Main QUERY formula to pull data from _DB_Posts
  // This is the CORE of the view - everything comes from the database
  const queryFormula = `=QUERY(_DB_Posts!A:T,
    "SELECT A, D, E, G, F, F, H, L, N, K 
     WHERE B = ${programNr}
     ORDER BY C",
    0)`;
  
  sheet.getRange('A7').setFormula(queryFormula);
  
  // Set column widths
  const widths = [70, 130, 300, 200, 80, 90, 130, 90, 110, 250];
  widths.forEach((width, index) => {
    sheet.setColumnWidth(index + 1, width);
  });
  
  // ================================
  // CONDITIONAL FORMATTING
  // ================================
  
  applyProgramViewFormatting_(sheet);
  
  // ================================
  // DATA VALIDATION (Dropdowns)
  // ================================
  
  // Post type dropdown (column B, starting row 7)
  const postTypes = getAllPostTypes_();
  const typeKeys = postTypes.map(pt => pt[POST_TYPE_SCHEMA.DISPLAY_NAME]);
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(typeKeys, true)
    .setAllowInvalid(false)
    .build();
  
  // Apply to a large range (rows 7-500)
  sheet.getRange('B7:B500').setDataValidation(typeRule);
  
  // Recording day dropdown (column H)
  const dayOptions = Object.values(RECORDING_DAYS).map(d => d.display);
  const dayRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(dayOptions, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('H7:H500').setDataValidation(dayRule);
  
  // Status dropdown (column I)
  const statusOptions = Object.values(POST_STATUS).map(s => s.display);
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(statusOptions, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('I7:I500').setDataValidation(statusRule);
  
  // Location dropdown (column G)
  const locationRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(LOCATIONS, true)
    .setAllowInvalid(true)  // Allow custom locations
    .build();
  sheet.getRange('G7:G500').setDataValidation(locationRule);
  
  // ================================
  // PROTECTION & NOTES
  // ================================
  
  // Protect calculated columns (Rullande is calculated)
  const protection = sheet.getRange('F7:F500').protect();
  protection.setDescription('Calculated column - automatically updated');
  protection.setWarningOnly(true);
  
  // Add instruction note to header
  sheet.getRange('A1').setNote(
    'Detta är en dynamisk vy baserad på databasen _DB_Posts.\\n\\n' +
    'För att lägga till poster: Använd menyn "Poster > Lägg till ny post"\\n' +
    'För att redigera: Ändra direkt i cellerna nedan\\n' +
    'Rullande tid beräknas automatiskt'
  );
  
  Logger.log(`Created Programme ${programNr} view`);
}

/**
 * Apply conditional formatting to programme view
 */
function applyProgramViewFormatting_(sheet) {
  // Status-based row colouring (column I = Status)
  const dataRange = sheet.getRange('A7:J500');
  
  // Green for "Inspelad"
  const ruleRecorded = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(POST_STATUS.RECORDED.display)
    .setBackground(POST_STATUS.RECORDED.colour)
    .setRanges([dataRange])
    .build();
  
  // Darker green for "Godkänd"
  const ruleApproved = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(POST_STATUS.APPROVED.display)
    .setBackground(POST_STATUS.APPROVED.colour)
    .setRanges([dataRange])
    .build();
  
  // Yellow for "Spelar in"
  const ruleRecording = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(POST_STATUS.RECORDING.display)
    .setBackground(POST_STATUS.RECORDING.colour)
    .setRanges([dataRange])
    .build();
  
  const rules = [ruleRecorded, ruleApproved, ruleRecording];
  sheet.setConditionalFormatRules(rules);
}

// ============================================================================
// SCHEDULE VIEW (aggregated across all programmes)
// ============================================================================

/**
 * Create recording schedule view
 * This shows ALL posts from ALL programmes, sorted by recording day/time
 */
function createScheduleView_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = VIEW.SCHEDULE;
  
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(sheetName);
  }
  
  sheet.setTabColor(COLOURS.VIEW_SHEET_TAB);
  
  // Title
  sheet.getRange('A1:I1').merge();
  sheet.getRange('A1').setValue('INSPELNINGSSCHEMA - ALLA PROGRAM');
  sheet.getRange('A1').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A1').setBackground(COLOURS.HEADER_BG).setFontColor(COLOURS.HEADER_TEXT);
  sheet.setRowHeight(1, 40);
  
  // Statistics row
  sheet.getRange('A2').setValue('Total inspelningstid:');
  sheet.getRange('B2').setFormula(`=TEXT(SUM(_DB_Posts!F:F)/86400,"[hh]:mm:ss")`);
  sheet.getRange('D2').setValue('Totalt antal poster:');
  sheet.getRange('E2').setFormula(`=COUNTA(_DB_Posts!A:A)-1`);
  sheet.getRange('A2:A2').setFontWeight('bold');
  sheet.getRange('D2:D2').setFontWeight('bold');
  sheet.getRange('A2:I2').setBackground('#F5F5F5');
  
  // Empty row
  sheet.setRowHeight(3, 10);
  
  // Headers
  const headers = ['Dag', 'Tid', 'Pgm', 'Post', 'Innehåll', 'Medverkande', 'Plats', 'Dur', 'Status'];
  const headerRange = sheet.getRange(4, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground(COLOURS.HEADER_BG);
  headerRange.setFontColor(COLOURS.HEADER_TEXT);
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setRowHeight(4, 35);
  sheet.setFrozenRows(4);
  
  // QUERY formula - aggregate all posts, sorted by recording day/time
  const queryFormula = `=QUERY(_DB_Posts!A:T,
    "SELECT L, M, B, A, E, G, H, F, N
     WHERE L IS NOT NULL
     ORDER BY L, M",
    0)`;
  
  sheet.getRange('A5').setFormula(queryFormula);
  
  // Set column widths
  const widths = [90, 90, 60, 70, 280, 200, 130, 80, 110];
  widths.forEach((width, index) => {
    sheet.setColumnWidth(index + 1, width);
  });
  
  // Conditional formatting (same status colours)
  applyScheduleViewFormatting_(sheet);
  
  Logger.log('Created Schedule view');
}

/**
 * Apply conditional formatting to schedule view
 */
function applyScheduleViewFormatting_(sheet) {
  const dataRange = sheet.getRange('A5:I500');
  
  // Status-based formatting (column I)
  const ruleRecorded = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(POST_STATUS.RECORDED.display)
    .setBackground(POST_STATUS.RECORDED.colour)
    .setRanges([dataRange])
    .build();
  
  const ruleApproved = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(POST_STATUS.APPROVED.display)
    .setBackground(POST_STATUS.APPROVED.colour)
    .setRanges([dataRange])
    .build();
  
  const ruleRecording = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(POST_STATUS.RECORDING.display)
    .setBackground(POST_STATUS.RECORDING.colour)
    .setRanges([dataRange])
    .build();
  
  // Alternate row banding for readability
  const ruleBanding = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=MOD(ROW(),2)=0')
    .setBackground('#F9F9F9')
    .setRanges([dataRange])
    .build();
  
  const rules = [ruleBanding, ruleRecorded, ruleApproved, ruleRecording];
  sheet.setConditionalFormatRules(rules);
}

// ============================================================================
// OVERVIEW DASHBOARD
// ============================================================================

/**
 * Create overview dashboard with statistics and quick links
 */
function createOverviewView_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = VIEW.OVERVIEW;
  
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(sheetName);
  }
  
  sheet.setTabColor('#2196F3');  // Blue for dashboard
  
  // Title
  sheet.getRange('A1:H1').merge();
  sheet.getRange('A1').setValue('ÖVERSIKT - PRODUKTIONSDASHBOARD');
  sheet.getRange('A1').setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A1').setBackground('#1976D2').setFontColor('#FFFFFF');
  sheet.setRowHeight(1, 50);
  
  // Programme summary section
  sheet.getRange('A3').setValue('PROGRAMÖVERSIKT');
  sheet.getRange('A3').setFontSize(14).setFontWeight('bold');
  sheet.setRowHeight(3, 35);
  
  const summaryHeaders = ['Program', 'Plats', 'Antal poster', 'Total tid', 'Inspelade', 'Godkända', 'Status %'];
  sheet.getRange(4, 1, 1, summaryHeaders.length).setValues([summaryHeaders]);
  sheet.getRange('A4:G4').setBackground(COLOURS.HEADER_BG).setFontColor(COLOURS.HEADER_TEXT).setFontWeight('bold');
  
  // Programme statistics (rows 5-8 for programmes 1-4)
  for (let i = 1; i <= 4; i++) {
    const row = 4 + i;
    sheet.getRange(`A${row}`).setValue(`Program ${i}`);
    sheet.getRange(`B${row}`).setFormula(`=IFERROR(INDEX(_DB_Program!B:B,MATCH(${i},_DB_Program!A:A,0)),"")`);
    sheet.getRange(`C${row}`).setFormula(`=COUNTIF(_DB_Posts!B:B,${i})`);
    sheet.getRange(`D${row}`).setFormula(`=TEXT(SUMIF(_DB_Posts!B:B,${i},_DB_Posts!F:F)/86400,"[hh]:mm:ss")`);
    sheet.getRange(`E${row}`).setFormula(`=COUNTIFS(_DB_Posts!B:B,${i},_DB_Posts!N:N,"${POST_STATUS.RECORDED.key}")`);
    sheet.getRange(`F${row}`).setFormula(`=COUNTIFS(_DB_Posts!B:B,${i},_DB_Posts!N:N,"${POST_STATUS.APPROVED.key}")`);
    sheet.getRange(`G${row}`).setFormula(`=IF(C${row}>0,ROUND((E${row}+F${row})/C${row}*100,0)&"%","0%")`);
  }
  
  // Totals row
  sheet.getRange('A9').setValue('TOTALT');
  sheet.getRange('A9').setFontWeight('bold');
  sheet.getRange('C9').setFormula('=SUM(C5:C8)');
  sheet.getRange('D9').setFormula('=TEXT(SUM(_DB_Posts!F:F)/86400,"[hh]:mm:ss")');
  sheet.getRange('E9').setFormula('=SUM(E5:E8)');
  sheet.getRange('F9').setFormula('=SUM(F5:F8)');
  sheet.getRange('G9').setFormula('=IF(C9>0,ROUND((E9+F9)/C9*100,0)&"%","0%")');
  sheet.getRange('A9:G9').setBackground('#E8EAF6');
  
  // Recording day breakdown
  sheet.getRange('A11').setValue('INSPELNINGSFÖRDELNING');
  sheet.getRange('A11').setFontSize(14).setFontWeight('bold');
  sheet.setRowHeight(11, 35);
  
  const dayHeaders = ['Dag', 'Antal poster', 'Total tid', 'Beskrivning'];
  sheet.getRange(12, 1, 1, dayHeaders.length).setValues([dayHeaders]);
  sheet.getRange('A12:D12').setBackground(COLOURS.HEADER_BG).setFontColor(COLOURS.HEADER_TEXT).setFontWeight('bold');
  
  // Day statistics
  Object.values(RECORDING_DAYS).forEach((day, index) => {
    const row = 13 + index;
    sheet.getRange(`A${row}`).setValue(day.display);
    sheet.getRange(`B${row}`).setFormula(`=COUNTIF(_DB_Posts!L:L,"${day.key}")`);
    sheet.getRange(`C${row}`).setFormula(`=TEXT(SUMIF(_DB_Posts!L:L,"${day.key}",_DB_Posts!F:F)/86400,"[hh]:mm:ss")`);
    sheet.getRange(`D${row}`).setValue(day.description);
  });
  
  // Set column widths
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 110);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 90);
  sheet.setColumnWidth(6, 90);
  sheet.setColumnWidth(7, 100);
  
  Logger.log('Created Overview dashboard');
}

// ============================================================================
// CREDITS VIEW
// ============================================================================

/**
 * Create credits/personnel view
 */
function createCreditsView_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = VIEW.CREDITS;
  
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(sheetName);
  }
  
  sheet.setTabColor('#FF9800');  // Orange for credits
  
  // Title
  sheet.getRange('A1:F1').merge();
  sheet.getRange('A1').setValue('KREDITLISTA - MEDVERKANDE OCH PERSONAL');
  sheet.getRange('A1').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A1').setBackground(COLOURS.HEADER_BG).setFontColor(COLOURS.HEADER_TEXT);
  sheet.setRowHeight(1, 40);
  
  sheet.getRange('A2').setValue('Denna lista genereras automatiskt från _DB_Personer');
  sheet.getRange('A2:F2').merge();
  sheet.getRange('A2').setFontStyle('italic').setBackground('#FFF3E0');
  
  sheet.setRowHeight(3, 10);
  
  // Headers
  const headers = ['ID', 'Namn', 'Roll', 'Kontakt', 'Typ', 'Tillagd'];
  const headerRange = sheet.getRange(4, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground(COLOURS.HEADER_BG);
  headerRange.setFontColor(COLOURS.HEADER_TEXT);
  headerRange.setFontWeight('bold');
  sheet.setRowHeight(4, 35);
  sheet.setFrozenRows(4);
  
  // QUERY formula to pull people data
  const queryFormula = `=QUERY(_DB_Personer!A:F,
    "SELECT A, B, C, D, E, F
     ORDER BY B",
    0)`;
  
  sheet.getRange('A5').setFormula(queryFormula);
  
  // Set column widths
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 200);
  sheet.setColumnWidth(4, 200);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 150);
  
  Logger.log('Created Credits view');
}

// ============================================================================
// VIEW UPDATE FUNCTIONS
// ============================================================================

/**
 * Refresh a specific programme view
 */
function refreshProgramView(programNr) {
  createProgramView_(programNr);
  SpreadsheetApp.getUi().alert(`Program ${programNr} view refreshed`);
}

/**
 * Refresh schedule view
 */
function refreshScheduleView() {
  createScheduleView_();
  SpreadsheetApp.getUi().alert('Schedule view refreshed');
}
