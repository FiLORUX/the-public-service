/**
 * THÅST GUDSTJÄNSTPRODUKTIONSSYSTEM
 * Configuration & Constants
 * 
 * British English throughout. Swedish comments where contextually relevant.
 * 
 * Architecture Philosophy:
 * - Normalised database in hidden sheets (single source of truth)
 * - Dynamic views generated via QUERY formulas (read-only presentation)
 * - Apps Script as the orchestration layer (not the data layer)
 * - Prepared for external integration (Companion, BMD, vMix)
 */

// ============================================================================
// SYSTEM METADATA
// ============================================================================

const SYSTEM_VERSION = '1.0.0';
const SYSTEM_NAME = 'Gudstjänst Production System';
const CREATED_BY = 'David Thåst';

// ============================================================================
// SHEET NAMES - Database (hidden, prefixed with _DB_)
// ============================================================================

const DB = {
  POSTS: '_DB_Posts',           // Master post registry (all programs)
  PEOPLE: '_DB_Personer',       // Actor/crew registry
  PROGRAMS: '_DB_Program',      // Program metadata (4 programs per location)
  POST_TYPES: '_DB_PostTyper',  // Templates for post types (predikan, sång, etc)
  LOG: '_DB_Logg',              // Timecode logging (append-only)
  SETTINGS: '_DB_Settings'      // System settings
};

// ============================================================================
// SHEET NAMES - Views (visible, user-facing)
// ============================================================================

const VIEW = {
  PROGRAM_1: 'Program 1',
  PROGRAM_2: 'Program 2',
  PROGRAM_3: 'Program 3',
  PROGRAM_4: 'Program 4',
  SCHEDULE: 'Inspelningsschema',
  OVERVIEW: 'Översikt',
  CREDITS: 'Kreditlista'
};

// ============================================================================
// DATABASE SCHEMA - Posts Table
// ============================================================================

const POST_SCHEMA = {
  // Column indices (0-based for array operations, 1-based for sheets)
  ID: 0,              // post_id (e.g. "P1:10" = Program 1, Post 10)
  PROGRAM_NR: 1,      // 1-4
  SORT_ORDER: 2,      // Integer for ordering
  TYPE: 3,            // Post type (predikan, sång, läsning, etc)
  TITLE: 4,           // Primary content/title
  DURATION: 5,        // Duration in seconds (integer)
  PEOPLE_IDS: 6,      // Comma-separated person IDs
  LOCATION: 7,        // talarplats, altare, kyrkbänk, etc
  INFO_POS: 8,        // Technical info/position
  GRAPHICS: 9,        // Graphics cues
  NOTES: 10,          // Övrig info
  RECORDING_DAY: 11,  // Dag 1, Dag 2, Dag 3
  RECORDING_TIME: 12, // Estimated clock time (calculated)
  STATUS: 13,         // planerad, recording, inspelad, godkänd
  TEXT_AUTHOR: 14,    // Textförfattare (optional, for music)
  COMPOSER: 15,       // Kompositör (optional, for music)
  ARRANGER: 16,       // Arrangör (optional)
  OPEN_TEXT: 17,      // Boolean: show in long format?
  CREATED: 18,        // Timestamp
  MODIFIED: 19        // Timestamp
};

// Human-readable headers for database sheet
const POST_HEADERS = [
  'post_id', 'program_nr', 'sort_order', 'type', 'title', 'duration_sec',
  'people_ids', 'location', 'info_pos', 'graphics', 'notes', 
  'recording_day', 'recording_time', 'status', 'text_author', 
  'composer', 'arranger', 'open_text', 'created', 'modified'
];

// ============================================================================
// DATABASE SCHEMA - People Table
// ============================================================================

const PERSON_SCHEMA = {
  ID: 0,              // person_id (e.g. "P001")
  NAME: 1,            // Full name
  ROLES: 2,           // Comma-separated roles (liturg, predikant, etc)
  CONTACT: 3,         // Email or phone
  TYPE: 4,            // medverkande, team, kompositör, textförfattare
  CREATED: 5
};

const PERSON_HEADERS = [
  'person_id', 'name', 'roles', 'contact', 'type', 'created'
];

// ============================================================================
// DATABASE SCHEMA - Programs Table (metadata for each program 1-4)
// ============================================================================

const PROGRAM_SCHEMA = {
  PROGRAM_NR: 0,      // 1-4
  LOCATION: 1,        // Church name
  START_DATE: 2,      // Recording start date
  BROADCAST_DATE: 3,  // Broadcast date
  CHURCH_YEAR: 4,     // Kyrkoåret (e.g. "2 i fastan")
  PROD_NR: 5,         // Production number
  TARGET_LENGTH: 6,   // Target program length (seconds)
  START_TIME: 7,      // Day 1 start time (HH:MM:SS)
  NOTES: 8,
  CREATED: 9,
  MODIFIED: 10
};

const PROGRAM_HEADERS = [
  'program_nr', 'location', 'start_date', 'broadcast_date', 'church_year',
  'prod_nr', 'target_length_sec', 'start_time', 'notes', 'created', 'modified'
];

// ============================================================================
// DATABASE SCHEMA - Post Types (templates)
// ============================================================================

const POST_TYPE_SCHEMA = {
  TYPE_KEY: 0,        // Internal key (lowercase, no spaces)
  DISPLAY_NAME: 1,    // Display name
  DEFAULT_DURATION: 2, // Default duration in seconds
  ICON: 3,            // Emoji icon
  REQUIRES_PEOPLE: 4, // Boolean
  REQUIRES_TEXT_AUTHOR: 5,
  REQUIRES_COMPOSER: 6,
  CATEGORY: 7,        // liturgisk, musik, presentation, etc
  BG_COLOUR: 8,       // Hex colour for visual coding
  ROW_HEIGHT: 9,      // Default row height in pixels
  DESCRIPTION: 10
};

const POST_TYPE_HEADERS = [
  'type_key', 'display_name', 'default_duration_sec', 'icon', 
  'requires_people', 'requires_text_author', 'requires_composer',
  'category', 'bg_colour', 'row_height', 'description'
];

// ============================================================================
// DEFAULT POST TYPES (seeded on bootstrap)
// ============================================================================

const DEFAULT_POST_TYPES = [
  // [type_key, display_name, duration_sec, icon, req_people, req_text, req_composer, category, bg_colour, row_height, description]
  ['predikan', 'Predikan', 420, '🎤', true, false, false, 'liturgisk', '#FFE5CC', 60, 'Gudstjänstens predikan'],
  ['lasning', 'Textläsning', 90, '📖', true, false, false, 'liturgisk', '#E3F2FD', 40, 'Läsning från Bibeln'],
  ['sang_kor', 'Sång (kör)', 180, '🎼', true, true, true, 'musik', '#F3E5F5', 50, 'Körsång med kompositör'],
  ['sang_solo', 'Sång (solo)', 150, '🎵', true, true, true, 'musik', '#FCE4EC', 50, 'Solosång'],
  ['orgelspel', 'Orgelspel', 120, '🎹', true, false, true, 'musik', '#FFF9C4', 40, 'Instrumental musik'],
  ['liturgi', 'Liturgiskt element', 45, '✝️', true, false, false, 'liturgisk', '#E8F5E9', 35, 'Kyrie, Agnus Dei, etc'],
  ['forbon', 'Förbön', 120, '🙏', true, false, false, 'liturgisk', '#E0F2F1', 45, 'Församlingens förbön'],
  ['punktinfo', 'Punktinfo', 60, '🎥', false, false, false, 'presentation', '#FFF3E0', 35, 'Kort informationssegment'],
  ['tema_presentation', 'Temapresentation', 150, '📺', true, false, false, 'presentation', '#E1F5FE', 50, 'Längre tematiskt segment'],
  ['mellan_paa', 'Mellan-påa', 30, '⏸️', false, false, false, 'teknisk', '#ECEFF1', 28, 'Teknisk paus'],
  ['valsignelse', 'Välsignelse', 45, '🙌', true, false, false, 'liturgisk', '#C8E6C9', 35, 'Avslutande välsignelse']
];

// ============================================================================
// VIEW CONFIGURATION
// ============================================================================

const VIEW_CONFIG = {
  // Starting row for data in all views
  DATA_START_ROW: 7,
  
  // Programme view columns (simplified, single view instead of Kort/Lång)
  PROGRAM_VIEW: {
    COLUMNS: ['NR', 'Typ', 'Innehåll', 'Medverkande', 'Dur', 'Rullande', 'Plats', 'Dag', 'Status', 'Anteckningar'],
    WIDTHS: [60, 120, 300, 180, 70, 80, 120, 80, 100, 200]
  },
  
  // Schedule view columns (aggregated across all programs)
  SCHEDULE_VIEW: {
    COLUMNS: ['Dag', 'Tid', 'Program', 'Post', 'Innehåll', 'Medverkande', 'Plats', 'Dur', 'Status'],
    WIDTHS: [80, 80, 70, 60, 250, 180, 120, 70, 100]
  }
};

// ============================================================================
// RECORDING DAYS (standard 3-day structure)
// ============================================================================

const RECORDING_DAYS = {
  DAY_1: { key: 'dag1', display: 'Dag 1', description: 'Textläsning & Predikan' },
  DAY_2: { key: 'dag2', display: 'Dag 2', description: 'Musik & Kör' },
  DAY_3: { key: 'dag3', display: 'Dag 3', description: 'Församling (helhet)' }
};

// ============================================================================
// POST STATUS OPTIONS
// ============================================================================

const POST_STATUS = {
  PLANNED: { key: 'planerad', display: 'Planerad', colour: '#FFFFFF' },
  RECORDING: { key: 'recording', display: 'Spelar in', colour: '#FFD54F' },
  RECORDED: { key: 'inspelad', display: 'Inspelad', colour: '#A5D6A7' },
  APPROVED: { key: 'godkand', display: 'Godkänd', colour: '#81C784' }
};

// ============================================================================
// LOCATION OPTIONS (common church locations)
// ============================================================================

const LOCATIONS = [
  'talarplats',
  'altare',
  'kyrkbänk',
  'orgelläktare',
  'dop­funt',
  'kyrktorn',
  'sakristia',
  'annat'
];

// ============================================================================
// COLOUR PALETTE (broadcast-grade professional colours)
// ============================================================================

const COLOURS = {
  // Status colours
  STATUS_PLANNED: '#FFFFFF',
  STATUS_RECORDING: '#FFD54F',
  STATUS_RECORDED: '#A5D6A7',
  STATUS_APPROVED: '#81C784',
  
  // Post type category colours
  LITURGISK: '#E3F2FD',
  MUSIK: '#F3E5F5',
  PRESENTATION: '#FFF3E0',
  TEKNISK: '#ECEFF1',
  
  // UI element colours
  HEADER_BG: '#37474F',
  HEADER_TEXT: '#FFFFFF',
  DB_SHEET_TAB: '#B0BEC5',  // Hidden sheets (grey)
  VIEW_SHEET_TAB: '#4CAF50', // View sheets (green)
  
  // Data validation error
  ERROR: '#FFCDD2'
};

// ============================================================================
// TIME FORMATTING
// ============================================================================

const TIME_FORMAT = {
  DURATION: '[hh]:mm:ss',       // Duration format (can exceed 24h)
  CLOCK: 'hh:mm:ss',            // Wall clock time
  DATE: 'yyyy-mm-dd',           // Date format
  TIMESTAMP: 'yyyy-mm-dd hh:mm:ss' // Full timestamp
};

// ============================================================================
// EXTERNAL API CONFIGURATION
// ============================================================================

/**
 * API is always enabled when deployed as Web App.
 * See API.md for full documentation.
 *
 * Supported integrations:
 * - Bitfocus Companion (HTTP module)
 * - vMix (scripting)
 * - BMD HyperDeck (via Companion)
 * - Any HTTP client
 *
 * Deploy: Extensions > Apps Script > Deploy > Web app
 */
const API_CONFIG = {
  // API endpoints (for reference, actual routing is in Triggers.gs)
  ENDPOINTS: {
    // POST actions
    TC_IN: 'tc_in',
    TC_OUT: 'tc_out',
    SET_RECORDING: 'set_recording',
    MARK_RECORDED: 'mark_recorded',
    MARK_APPROVED: 'mark_approved',
    STATUS_UPDATE: 'status_update',
    GET_POSTS: 'get_posts',
    GET_NEXT: 'get_next',
    GET_SCHEDULE: 'get_schedule',
    INCREMENT_CLIP: 'increment_clip',
    // GET actions (via query param ?action=)
    STATUS: 'status',
    POSTS: 'posts',
    SCHEDULE: 'schedule',
    POST: 'post',
    CURRENT: 'current',
    CLIP_COUNTER: 'clip_counter'
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get database sheet by name, ensuring it exists
 */
function getDbSheet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    Logger.log(`Database sheet ${sheetName} does not exist. Run bootstrapDatabase() first.`);
    throw new Error(`Database not initialised. Run Setup > Bootstrap Database from menu.`);
  }
  
  return sheet;
}

/**
 * Get view sheet, creating if needed
 */
function getOrCreateViewSheet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  return sheet;
}

/**
 * Clamp a number between min and max
 */
function clamp_(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate unique ID with prefix
 */
function generateId_(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}${timestamp}${random}`.toUpperCase();
}

/**
 * Parse duration string to seconds
 * Accepts: "1:30", "01:30:00", "90" (seconds), "1.5" (minutes as decimal)
 */
function parseDurationToSeconds_(input) {
  if (typeof input === 'number') return Math.round(input);
  
  const str = String(input || '').trim();
  if (!str) return 0;
  
  // Handle pure numbers as seconds
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  
  // Handle decimal minutes (e.g. "1.5" = 90 seconds)
  if (/^\d+\.\d+$/.test(str)) return Math.round(parseFloat(str) * 60);
  
  // Handle HH:MM:SS or MM:SS
  const parts = str.split(':').map(p => parseInt(p, 10) || 0);
  
  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return 0;
}

/**
 * Format seconds to HH:MM:SS
 */
function formatDuration_(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Get current timestamp in ISO format
 */
function getTimestamp_() {
  return new Date().toISOString();
}

/**
 * Safe string conversion (handles null/undefined)
 */
function safeStr_(value) {
  return String(value || '').trim();
}

/**
 * Check if value is truthy (handles strings like "true", "yes", "1")
 */
function isTruthy_(value) {
  if (typeof value === 'boolean') return value;
  const str = String(value || '').toLowerCase();
  return ['true', 'yes', '1', 'ja'].includes(str);
}

// ============================================================================
// EXPORTS (for access from other files)
// ============================================================================

// Note: In Apps Script, all functions in .gs files are globally accessible
// This section is for documentation purposes only
