/**
 * Church Service Sync Worker
 *
 * Cloudflare Worker handling bi-directional synchronisation between:
 * - Google Sheets (UI and sharing)
 * - Supabase (source of truth)
 * - Studio PWA (iPad)
 * - Companion/vMix (timecode control)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z, ZodError } from 'zod'

import {
  UnauthorizedError,
  ValidationError,
  MissingFieldError,
  InvalidActionError,
  NotFoundError,
  ConflictError,
  MethodNotAllowedError,
  DatabaseError,
  wrapError,
  errorResponse,
  logError,
} from './errors'

// ============================================================================
// ENVIRONMENT & CONFIG
// ============================================================================

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SHEETS_WEBHOOK_SECRET: string
  ENVIRONMENT: string
  ALLOWED_ORIGINS?: string // Comma-separated list of allowed origins
}

type CorsHeaders = Record<string, string>

// ============================================================================
// CORS & SECURITY
// ============================================================================

/**
 * Default allowed origins when ALLOWED_ORIGINS env var is not set.
 * Restrictive by default - only localhost for development.
 */
const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
] as const

/**
 * Security headers applied to all responses.
 * These mitigate common web vulnerabilities.
 */
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
} as const

/**
 * Parse allowed origins from environment variable.
 * Falls back to restrictive defaults if not configured.
 */
function getAllowedOrigins(env: Env): readonly string[] {
  if (!env.ALLOWED_ORIGINS) {
    return DEFAULT_ALLOWED_ORIGINS
  }

  return env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

/**
 * Validate request origin against allowed origins list.
 * Returns the origin if valid, null otherwise.
 */
function validateOrigin(
  requestOrigin: string | null,
  allowedOrigins: readonly string[],
): string | null {
  if (!requestOrigin) {
    return null
  }

  // Exact match required - no wildcard patterns for security
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin
  }

  return null
}

/**
 * Build CORS headers based on request origin validation.
 * Only allows credentialed requests from validated origins.
 */
function buildCorsHeaders(requestOrigin: string | null, env: Env): CorsHeaders {
  const allowedOrigins = getAllowedOrigins(env)
  const validatedOrigin = validateOrigin(requestOrigin, allowedOrigins)

  if (validatedOrigin) {
    return {
      'Access-Control-Allow-Origin': validatedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
      ...SECURITY_HEADERS,
    }
  }

  // Origin not allowed - return headers without Access-Control-Allow-Origin
  // This causes browsers to reject the response for cross-origin requests
  return {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret',
    ...SECURITY_HEADERS,
  }
}

// ============================================================================
// ZOD SCHEMAS - Input Validation
// ============================================================================

/**
 * Timecode format validation: HH:MM:SS:FF
 * Follows EBU standard for 25fps PAL regions.
 */
const TimecodeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}:\d{2}:\d{2}$/, 'Invalid timecode format - expected HH:MM:SS:FF')

/**
 * Post entity schema - the core data structure for service items.
 * All fields validated with appropriate constraints for broadcast reliability.
 */
const PostSchema = z.object({
  post_id: z.string().min(1, 'Post ID is required'),
  program_nr: z.number().int().positive('Program number must be positive'),
  sort_order: z.number().int().nonnegative('Sort order must be non-negative'),
  type_key: z.string().optional(),
  title: z.string().optional(),
  duration_sec: z.number().int().nonnegative().optional(),
  people_ids: z.array(z.string()).optional(),
  location: z.string().optional(),
  recording_day: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  version: z.number().int().nonnegative(),
  last_modified_by: z.string(),
})

type Post = z.infer<typeof PostSchema>

/**
 * Partial post for updates - requires post_id, version optional for conflict detection.
 */
const PostUpdateSchema = PostSchema.partial().extend({
  post_id: z.string().min(1, 'Post ID is required'),
  version: z.number().int().nonnegative().optional(),
})

type PostUpdate = z.infer<typeof PostUpdateSchema>

/**
 * Delete payload - just needs the post_id.
 */
const DeletePayloadSchema = z.object({
  post_id: z.string().min(1, 'Post ID is required'),
})

/**
 * Batch sync payload - array of posts.
 */
const BatchSyncPayloadSchema = z.array(PostSchema)

/**
 * Studio update payload - limited to status and notes only.
 * This enforces the restriction that Studio can only modify these fields.
 */
const StudioUpdateSchema = z.object({
  post_id: z.string().min(1, 'Post ID is required'),
  status: z.string().optional(),
  notes: z.string().optional(),
})

// StudioUpdate type inferred from schema - used implicitly in payload validation

/**
 * Companion sync payload for timecode operations.
 * Validates the specific fields used in TC-IN/TC-OUT operations.
 */
const CompanionPayloadSchema = z.object({
  action: z.enum(['tc_in', 'tc_out'], {
    errorMap: () => ({ message: "Action must be 'tc_in' or 'tc_out'" }),
  }),
  post_id: z.string().min(1, 'Post ID is required'),
  tc_in: TimecodeSchema.optional(),
  tc_out: TimecodeSchema.optional(),
  clip_nr: z.number().int().positive().optional(),
  operator: z.string().optional(),
})

// CompanionPayload type inferred from schema - used implicitly in payload validation

/**
 * Discriminated union for Sheets sync payloads.
 * Each action type has its own specific data schema ensuring type safety.
 */
const SheetsSyncPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    source: z.literal('sheets'),
    action: z.literal('create'),
    entity_type: z.literal('post'),
    data: PostSchema,
    version: z.number().optional(),
    timestamp: z.string().optional(),
  }),
  z.object({
    source: z.literal('sheets'),
    action: z.literal('update'),
    entity_type: z.literal('post'),
    data: PostUpdateSchema,
    version: z.number().optional(),
    timestamp: z.string().optional(),
  }),
  z.object({
    source: z.literal('sheets'),
    action: z.literal('delete'),
    entity_type: z.literal('post'),
    data: DeletePayloadSchema,
    version: z.number().optional(),
    timestamp: z.string().optional(),
  }),
  z.object({
    source: z.literal('sheets'),
    action: z.literal('batch_sync'),
    entity_type: z.literal('post'),
    data: BatchSyncPayloadSchema,
    version: z.number().optional(),
    timestamp: z.string().optional(),
  }),
])

// SheetsSyncPayload type inferred from schema - used implicitly in payload validation

/**
 * Studio sync payload - more restricted than Sheets.
 */
const StudioSyncPayloadSchema = z.object({
  source: z.literal('studio'),
  action: z.literal('update'),
  entity_type: z.literal('post'),
  data: StudioUpdateSchema,
  version: z.number().optional(),
  timestamp: z.string().optional(),
})

// StudioSyncPayload type inferred from schema - used implicitly in payload validation

// ============================================================================
// TYPE GUARDS - Proper error handling without type assertions
// ============================================================================

/**
 * Type guard for Supabase query results with version field.
 */
interface VersionedRecord {
  version: number
}

function hasVersion(data: unknown): data is VersionedRecord {
  return (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    typeof (data as VersionedRecord).version === 'number'
  )
}

/**
 * Type guard for Supabase query results with extended version info.
 */
interface VersionedRecordWithMeta extends VersionedRecord {
  last_modified_by: string
  updated_at: string
}

function hasVersionWithMeta(data: unknown): data is VersionedRecordWithMeta {
  return (
    hasVersion(data) &&
    'last_modified_by' in data &&
    'updated_at' in data &&
    typeof (data as VersionedRecordWithMeta).last_modified_by === 'string' &&
    typeof (data as VersionedRecordWithMeta).updated_at === 'string'
  )
}

/**
 * Type guard for TC log entries.
 */
interface TcLogEntry {
  id: number
  tc_in: string
}

function isTcLogEntry(data: unknown): data is TcLogEntry {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'tc_in' in data &&
    typeof (data as TcLogEntry).id === 'number' &&
    typeof (data as TcLogEntry).tc_in === 'string'
  )
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Format Zod validation errors into a human-readable string.
 */
function formatZodErrors(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
}

/**
 * Validate payload against schema and throw ValidationError on failure.
 */
function validatePayload<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    throw new ValidationError(`${context} validation failed: ${formatZodErrors(result.error)}`, {
      issues: result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      })),
    })
  }

  return result.data
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

interface SuccessResponse {
  success: true
  status?: string
  environment?: string
  data?: unknown
  post?: unknown
  posts?: unknown[]
  schedule?: unknown[]
  stats?: unknown[]
  results?: BatchSyncResults
  action?: string
}

interface BatchSyncResults {
  created: number
  updated: number
  conflicts: string[]
  errors: Array<{ post_id: string; code: string; reference: string }>
}

type ApiResponse = SuccessResponse

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Extract and validate request origin for CORS
    const requestOrigin = request.headers.get('Origin')
    const corsHeaders = buildCorsHeaders(requestOrigin, env)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

      // Route handling
      switch (path) {
        case '/health':
          return jsonResponse(
            { success: true, status: 'ok', environment: env.ENVIRONMENT },
            corsHeaders,
          )

        case '/sync/from-sheets':
          return handleSheetsSync(request, supabase, env, corsHeaders)

        case '/sync/from-studio':
          return handleStudioSync(request, supabase, corsHeaders)

        case '/sync/from-companion':
          return handleCompanionSync(request, supabase, corsHeaders)

        case '/api/posts':
          return handleGetPosts(request, supabase, corsHeaders)

        case '/api/post':
          return handlePostOperation(request, supabase, corsHeaders)

        case '/api/schedule':
          return handleGetSchedule(request, supabase, corsHeaders)

        case '/api/stats':
          return handleGetStats(supabase, corsHeaders)

        default:
          throw new NotFoundError('Endpoint', path)
      }
    } catch (error: unknown) {
      // Convert to AppError if not already
      const appError = wrapError(error, 'Worker request handler')
      return errorResponse(appError, corsHeaders)
    }
  },
}

// ============================================================================
// SYNC HANDLERS
// ============================================================================

async function handleSheetsSync(
  request: Request,
  supabase: SupabaseClient,
  env: Env,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  // Verify webhook secret
  const secret = request.headers.get('X-Webhook-Secret')
  if (secret !== env.SHEETS_WEBHOOK_SECRET) {
    throw new UnauthorizedError('Invalid webhook secret')
  }

  // Parse and validate payload with Zod
  const rawPayload: unknown = await request.json()
  const payload = validatePayload(SheetsSyncPayloadSchema, rawPayload, 'Sheets sync payload')

  // Route to appropriate handler based on action
  // The discriminated union ensures type safety for each branch
  switch (payload.action) {
    case 'create':
      return syncCreatePost(payload.data, supabase, corsHeaders)

    case 'update':
      return syncUpdatePost(payload.data, supabase, corsHeaders)

    case 'delete':
      return syncDeletePost(payload.data.post_id, supabase, corsHeaders)

    case 'batch_sync':
      return syncBatchFromSheets(payload.data, supabase, corsHeaders)

    default: {
      // TypeScript exhaustiveness check - this should never be reached
      const _exhaustive: never = payload
      throw new InvalidActionError(String(_exhaustive), 'sheets sync')
    }
  }
}

async function handleStudioSync(
  request: Request,
  supabase: SupabaseClient,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  // Parse and validate payload with Zod
  const rawPayload: unknown = await request.json()
  const payload = validatePayload(StudioSyncPayloadSchema, rawPayload, 'Studio sync payload')

  const { post_id, status, notes } = payload.data

  // Fetch existing post for conflict detection
  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('version')
    .eq('post_id', post_id)
    .single()

  if (fetchError) {
    throw new NotFoundError('Post', post_id)
  }

  // Validate response structure using type guard
  if (!hasVersion(existing)) {
    throw new DatabaseError('Invalid post data structure returned from database')
  }

  // Optimistic locking check
  if (payload.version !== undefined && payload.version < existing.version) {
    throw new ConflictError('Post has been modified by another client', {
      serverVersion: existing.version,
      clientVersion: payload.version,
    })
  }

  // Apply the update - Studio can only modify status and notes
  const { data, error } = await supabase
    .from('posts')
    .update({
      status,
      notes,
      last_modified_by: 'studio',
    })
    .eq('post_id', post_id)
    .select()
    .single()

  if (error) {
    throw new DatabaseError(error.message)
  }

  return jsonResponse({ success: true, data }, corsHeaders)
}

async function handleCompanionSync(
  request: Request,
  supabase: SupabaseClient,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  // Parse and validate payload with Zod
  const rawPayload: unknown = await request.json()
  const payload = validatePayload(CompanionPayloadSchema, rawPayload, 'Companion sync payload')

  const { action, post_id, tc_in, tc_out, clip_nr, operator } = payload

  if (action === 'tc_in') {
    // Log TC-IN event
    const { error: insertError } = await supabase.from('tc_log').insert({
      post_id,
      operator,
      tc_in,
      clip_nr,
    })

    if (insertError) {
      throw new DatabaseError(insertError.message)
    }

    // Update post status to indicate recording in progress
    const { error: updateError } = await supabase
      .from('posts')
      .update({ status: 'recording', last_modified_by: 'companion' })
      .eq('post_id', post_id)

    if (updateError) {
      throw new DatabaseError(updateError.message)
    }

    return jsonResponse({ success: true, action: 'tc_in' }, corsHeaders)
  }

  if (action === 'tc_out') {
    // Find the most recent TC-log entry without a tc_out
    const { data: lastEntry, error: fetchError } = await supabase
      .from('tc_log')
      .select('id, tc_in')
      .eq('post_id', post_id)
      .is('tc_out', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError) {
      // Log but continue - tc_out without matching tc_in is recoverable
      logError(wrapError(fetchError, 'TC-OUT without matching TC-IN'), { post_id })
    }

    // Update the entry if found and valid using type guard
    if (isTcLogEntry(lastEntry) && tc_out !== undefined) {
      // Calculate duration using the timecode values
      const durationSec = calculateTcDuration(lastEntry.tc_in, tc_out)

      const { error: updateLogError } = await supabase
        .from('tc_log')
        .update({ tc_out, duration_sec: durationSec })
        .eq('id', lastEntry.id)

      if (updateLogError) {
        throw new DatabaseError(updateLogError.message)
      }
    }

    // Update post status to indicate recording complete
    const { error: updateError } = await supabase
      .from('posts')
      .update({ status: 'inspelad', last_modified_by: 'companion' })
      .eq('post_id', post_id)

    if (updateError) {
      throw new DatabaseError(updateError.message)
    }

    return jsonResponse({ success: true, action: 'tc_out' }, corsHeaders)
  }

  // This should never be reached due to Zod validation
  throw new InvalidActionError(action, 'companion sync')
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

async function syncCreatePost(
  data: Post,
  supabase: SupabaseClient,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  const { data: newPost, error } = await supabase
    .from('posts')
    .insert({
      ...data,
      last_modified_by: 'sheets',
    })
    .select()
    .single()

  if (error) {
    throw new DatabaseError(error.message)
  }

  // Update sync status for cross-system tracking
  await updateSyncStatus(supabase, 'post', data.post_id, 'sheets')

  return jsonResponse({ success: true, data: newPost }, corsHeaders)
}

async function syncUpdatePost(
  data: PostUpdate,
  supabase: SupabaseClient,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  const { post_id, version, ...updates } = data

  // Fetch current version for conflict detection
  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('version, last_modified_by, updated_at')
    .eq('post_id', post_id)
    .single()

  if (fetchError) {
    throw new NotFoundError('Post', post_id)
  }

  // Validate response structure using type guard
  if (!hasVersionWithMeta(existing)) {
    throw new DatabaseError('Invalid post data structure returned from database')
  }

  // Conflict detection: if incoming version is older, reject the update
  // This implements optimistic locking for concurrent edit prevention
  if (version !== undefined && version < existing.version) {
    throw new ConflictError('Post has been modified since your last read', {
      serverVersion: existing.version,
      clientVersion: version,
      lastModifiedBy: existing.last_modified_by,
      lastModifiedAt: existing.updated_at,
    })
  }

  // Apply update
  const { data: updated, error: updateError } = await supabase
    .from('posts')
    .update({
      ...updates,
      last_modified_by: 'sheets',
    })
    .eq('post_id', post_id)
    .select()
    .single()

  if (updateError) {
    throw new DatabaseError(updateError.message)
  }

  await updateSyncStatus(supabase, 'post', post_id, 'sheets')

  return jsonResponse({ success: true, data: updated }, corsHeaders)
}

async function syncDeletePost(
  postId: string,
  supabase: SupabaseClient,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  // Soft delete - preserves data for audit trail and recovery
  const { error } = await supabase
    .from('posts')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: 'sheets',
      last_modified_by: 'sheets',
    })
    .eq('post_id', postId)

  if (error) {
    throw new DatabaseError(error.message)
  }

  return jsonResponse({ success: true }, corsHeaders)
}

async function syncBatchFromSheets(
  posts: Post[],
  supabase: SupabaseClient,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  const results: BatchSyncResults = {
    created: 0,
    updated: 0,
    conflicts: [],
    errors: [],
  }

  for (const post of posts) {
    try {
      // Check if post already exists
      const { data: existing } = await supabase
        .from('posts')
        .select('id, version')
        .eq('post_id', post.post_id)
        .single()

      if (existing !== null && hasVersion(existing)) {
        // Update with conflict check
        if (post.version < existing.version) {
          results.conflicts.push(post.post_id)
          continue
        }

        const { error: updateError } = await supabase
          .from('posts')
          .update({ ...post, last_modified_by: 'sheets' })
          .eq('post_id', post.post_id)

        if (updateError) {
          const dbError = new DatabaseError(updateError.message)
          logError(dbError, { post_id: post.post_id, operation: 'batch_update' })
          results.errors.push({
            post_id: post.post_id,
            code: dbError.code,
            reference: dbError.reference,
          })
          continue
        }

        results.updated++
      } else {
        // Create new post
        const { error: insertError } = await supabase
          .from('posts')
          .insert({ ...post, last_modified_by: 'sheets' })

        if (insertError) {
          const dbError = new DatabaseError(insertError.message)
          logError(dbError, { post_id: post.post_id, operation: 'batch_insert' })
          results.errors.push({
            post_id: post.post_id,
            code: dbError.code,
            reference: dbError.reference,
          })
          continue
        }

        results.created++
      }
    } catch (err: unknown) {
      const appError = wrapError(err, `Batch sync for post ${post.post_id}`)
      logError(appError, { post_id: post.post_id })
      results.errors.push({
        post_id: post.post_id,
        code: appError.code,
        reference: appError.reference,
      })
    }
  }

  return jsonResponse({ success: true, results }, corsHeaders)
}

// ============================================================================
// API HANDLERS
// ============================================================================

async function handleGetPosts(
  request: Request,
  supabase: SupabaseClient,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  const url = new URL(request.url)
  const programNr = url.searchParams.get('program')
  const status = url.searchParams.get('status')

  let query = supabase.from('posts_active').select('*').order('sort_order')

  if (programNr !== null) {
    const parsed = parseInt(programNr, 10)
    if (Number.isNaN(parsed)) {
      throw new ValidationError('Invalid program number', { field: 'program', value: programNr })
    }
    query = query.eq('program_nr', parsed)
  }

  if (status !== null) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    throw new DatabaseError(error.message)
  }

  return jsonResponse({ success: true, posts: data }, corsHeaders)
}

async function handlePostOperation(
  request: Request,
  supabase: SupabaseClient,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  if (request.method === 'GET') {
    const url = new URL(request.url)
    const postId = url.searchParams.get('id')

    if (postId === null) {
      throw new MissingFieldError('id')
    }

    const { data, error } = await supabase
      .from('posts_active')
      .select('*')
      .eq('post_id', postId)
      .single()

    if (error) {
      throw new NotFoundError('Post', postId)
    }

    return jsonResponse({ success: true, post: data }, corsHeaders)
  }

  if (request.method === 'PUT') {
    // Parse and validate payload with Zod
    const rawPayload: unknown = await request.json()
    const payload = validatePayload(PostUpdateSchema, rawPayload, 'Post update payload')
    return syncUpdatePost(payload, supabase, corsHeaders)
  }

  throw new MethodNotAllowedError(request.method, ['GET', 'PUT'])
}

async function handleGetSchedule(
  request: Request,
  supabase: SupabaseClient,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  const url = new URL(request.url)
  const day = url.searchParams.get('day') ?? 'dag1'

  const { data, error } = await supabase
    .from('recording_schedule')
    .select('*')
    .eq('recording_day', day)

  if (error) {
    throw new DatabaseError(error.message)
  }

  return jsonResponse({ success: true, schedule: data }, corsHeaders)
}

async function handleGetStats(
  supabase: SupabaseClient,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  const { data, error } = await supabase.from('program_stats').select('*')

  if (error) {
    throw new DatabaseError(error.message)
  }

  return jsonResponse({ success: true, stats: data }, corsHeaders)
}

// ============================================================================
// HELPERS
// ============================================================================

function jsonResponse(data: ApiResponse, corsHeaders: CorsHeaders, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

async function updateSyncStatus(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  source: string,
): Promise<void> {
  const now = new Date().toISOString()

  const { error } = await supabase.from('sync_status').upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      [`last_${source}_sync`]: now,
      [`${source}_version`]: supabase.rpc('increment', { row_id: entityId }),
      updated_at: now,
    },
    { onConflict: 'entity_type,entity_id' },
  )

  if (error) {
    // Log but don't throw - sync status is auxiliary
    const dbError = new DatabaseError(error.message)
    logError(dbError, { entityType, entityId, source, operation: 'updateSyncStatus' })
  }
}

/**
 * Calculate duration between two timecodes in seconds.
 * Timecode format: HH:MM:SS:FF where FF is frame number.
 * Assumes 25 fps (EBU standard for PAL regions).
 */
function calculateTcDuration(tcIn: string, tcOut: string): number {
  const parseTC = (tc: string): number => {
    const parts = tc.split(':').map(Number)
    if (parts.length !== 4 || parts.some(Number.isNaN)) {
      return 0 // Invalid timecode format
    }
    // HH:MM:SS:FF - convert to seconds
    // Frame rate is 25 fps per EBU standards
    return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 25
  }

  const duration = parseTC(tcOut) - parseTC(tcIn)
  return Math.max(0, Math.round(duration))
}
