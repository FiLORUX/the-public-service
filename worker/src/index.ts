/**
 * Church Service Sync Worker
 *
 * Cloudflare Worker handling bi-directional synchronisation between:
 * - Google Sheets (UI and sharing)
 * - Supabase (source of truth)
 * - Studio PWA (iPad)
 * - Companion/vMix (timecode control)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  SHEETS_WEBHOOK_SECRET: string;
  ENVIRONMENT: string;
}

interface SyncPayload {
  source: 'sheets' | 'studio' | 'companion';
  action: 'create' | 'update' | 'delete' | 'batch_sync';
  entity_type: 'post' | 'person' | 'program';
  data: any;
  version?: number;
  timestamp?: string;
}

interface Post {
  post_id: string;
  program_nr: number;
  sort_order: number;
  type_key?: string;
  title?: string;
  duration_sec?: number;
  people_ids?: string[];
  location?: string;
  recording_day?: string;
  status?: string;
  notes?: string;
  version: number;
  last_modified_by: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

      // Route handling
      switch (path) {
        case '/health':
          return jsonResponse({ status: 'ok', environment: env.ENVIRONMENT }, corsHeaders);

        case '/sync/from-sheets':
          return handleSheetsSync(request, supabase, env, corsHeaders);

        case '/sync/from-studio':
          return handleStudioSync(request, supabase, corsHeaders);

        case '/sync/from-companion':
          return handleCompanionSync(request, supabase, corsHeaders);

        case '/api/posts':
          return handleGetPosts(request, supabase, corsHeaders);

        case '/api/post':
          return handlePostOperation(request, supabase, corsHeaders);

        case '/api/schedule':
          return handleGetSchedule(request, supabase, corsHeaders);

        case '/api/stats':
          return handleGetStats(supabase, corsHeaders);

        default:
          return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
      }
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse(
        { error: 'Internal server error', message: (error as Error).message },
        corsHeaders,
        500
      );
    }
  },
};

// ============================================================================
// SYNC HANDLERS
// ============================================================================

async function handleSheetsSync(
  request: Request,
  supabase: SupabaseClient,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Verify webhook secret
  const secret = request.headers.get('X-Webhook-Secret');
  if (secret !== env.SHEETS_WEBHOOK_SECRET) {
    return jsonResponse({ error: 'Unauthorized' }, corsHeaders, 401);
  }

  const payload: SyncPayload = await request.json();

  switch (payload.action) {
    case 'create':
      return syncCreatePost(payload.data, supabase, corsHeaders);

    case 'update':
      return syncUpdatePost(payload.data, supabase, corsHeaders);

    case 'delete':
      return syncDeletePost(payload.data.post_id, supabase, corsHeaders);

    case 'batch_sync':
      return syncBatchFromSheets(payload.data, supabase, corsHeaders);

    default:
      return jsonResponse({ error: 'Unknown action' }, corsHeaders, 400);
  }
}

async function handleStudioSync(
  request: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const payload: SyncPayload = await request.json();

  // Studio kan bara uppdatera status och notes
  if (payload.action === 'update') {
    const { post_id, status, notes } = payload.data;

    const { data: existing, error: fetchError } = await supabase
      .from('posts')
      .select('version')
      .eq('post_id', post_id)
      .single();

    if (fetchError) {
      return jsonResponse({ error: 'Post not found' }, corsHeaders, 404);
    }

    // Optimistic locking check
    if (payload.version && payload.version < existing.version) {
      return jsonResponse(
        {
          error: 'Conflict',
          message: 'Post has been modified by another client',
          server_version: existing.version,
          your_version: payload.version,
        },
        corsHeaders,
        409
      );
    }

    const { data, error } = await supabase
      .from('posts')
      .update({
        status,
        notes,
        last_modified_by: 'studio',
      })
      .eq('post_id', post_id)
      .select()
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, corsHeaders, 500);
    }

    return jsonResponse({ success: true, data }, corsHeaders);
  }

  return jsonResponse({ error: 'Invalid action for studio' }, corsHeaders, 400);
}

async function handleCompanionSync(
  request: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const payload = await request.json();
  const { action, post_id, tc_in, tc_out, clip_nr, operator } = payload;

  if (action === 'tc_in') {
    // Logga TC-IN
    await supabase.from('tc_log').insert({
      post_id,
      operator,
      tc_in,
      clip_nr,
    });

    // Uppdatera post status
    await supabase
      .from('posts')
      .update({ status: 'recording', last_modified_by: 'companion' })
      .eq('post_id', post_id);

    return jsonResponse({ success: true, action: 'tc_in' }, corsHeaders);
  }

  if (action === 'tc_out') {
    // Uppdatera senaste TC-log entry
    const { data: lastEntry } = await supabase
      .from('tc_log')
      .select('id, tc_in')
      .eq('post_id', post_id)
      .is('tc_out', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastEntry) {
      // Beräkna duration
      const durationSec = calculateTcDuration(lastEntry.tc_in, tc_out);

      await supabase
        .from('tc_log')
        .update({ tc_out, duration_sec: durationSec })
        .eq('id', lastEntry.id);
    }

    // Uppdatera post status
    await supabase
      .from('posts')
      .update({ status: 'inspelad', last_modified_by: 'companion' })
      .eq('post_id', post_id);

    return jsonResponse({ success: true, action: 'tc_out' }, corsHeaders);
  }

  return jsonResponse({ error: 'Invalid action' }, corsHeaders, 400);
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

async function syncCreatePost(
  data: Post,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { data: newPost, error } = await supabase
    .from('posts')
    .insert({
      ...data,
      last_modified_by: 'sheets',
    })
    .select()
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, corsHeaders, 500);
  }

  // Update sync status
  await updateSyncStatus(supabase, 'post', data.post_id, 'sheets');

  return jsonResponse({ success: true, data: newPost }, corsHeaders);
}

async function syncUpdatePost(
  data: Partial<Post> & { post_id: string; version?: number },
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { post_id, version, ...updates } = data;

  // Fetch current version for conflict detection
  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('version, last_modified_by, updated_at')
    .eq('post_id', post_id)
    .single();

  if (fetchError) {
    return jsonResponse({ error: 'Post not found' }, corsHeaders, 404);
  }

  // Conflict detection: if incoming version is older, reject
  if (version !== undefined && version < existing.version) {
    return jsonResponse(
      {
        error: 'Conflict',
        message: 'Post has been modified since your last read',
        server_version: existing.version,
        your_version: version,
        last_modified_by: existing.last_modified_by,
        last_modified_at: existing.updated_at,
      },
      corsHeaders,
      409
    );
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
    .single();

  if (updateError) {
    return jsonResponse({ error: updateError.message }, corsHeaders, 500);
  }

  await updateSyncStatus(supabase, 'post', post_id, 'sheets');

  return jsonResponse({ success: true, data: updated }, corsHeaders);
}

async function syncDeletePost(
  postId: string,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Soft delete
  const { error } = await supabase
    .from('posts')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: 'sheets',
      last_modified_by: 'sheets',
    })
    .eq('post_id', postId);

  if (error) {
    return jsonResponse({ error: error.message }, corsHeaders, 500);
  }

  return jsonResponse({ success: true }, corsHeaders);
}

async function syncBatchFromSheets(
  posts: Post[],
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const results = {
    created: 0,
    updated: 0,
    conflicts: [] as string[],
    errors: [] as string[],
  };

  for (const post of posts) {
    try {
      // Check if exists
      const { data: existing } = await supabase
        .from('posts')
        .select('id, version')
        .eq('post_id', post.post_id)
        .single();

      if (existing) {
        // Update with conflict check
        if (post.version && post.version < existing.version) {
          results.conflicts.push(post.post_id);
          continue;
        }

        await supabase
          .from('posts')
          .update({ ...post, last_modified_by: 'sheets' })
          .eq('post_id', post.post_id);

        results.updated++;
      } else {
        // Create new
        await supabase.from('posts').insert({ ...post, last_modified_by: 'sheets' });
        results.created++;
      }
    } catch (err) {
      results.errors.push(`${post.post_id}: ${(err as Error).message}`);
    }
  }

  return jsonResponse({ success: true, results }, corsHeaders);
}

// ============================================================================
// API HANDLERS
// ============================================================================

async function handleGetPosts(
  request: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const programNr = url.searchParams.get('program');
  const status = url.searchParams.get('status');

  let query = supabase
    .from('posts_active')
    .select('*')
    .order('sort_order');

  if (programNr) {
    query = query.eq('program_nr', parseInt(programNr));
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return jsonResponse({ error: error.message }, corsHeaders, 500);
  }

  return jsonResponse({ success: true, posts: data }, corsHeaders);
}

async function handlePostOperation(
  request: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const postId = url.searchParams.get('id');

    if (!postId) {
      return jsonResponse({ error: 'Missing post id' }, corsHeaders, 400);
    }

    const { data, error } = await supabase
      .from('posts_active')
      .select('*')
      .eq('post_id', postId)
      .single();

    if (error) {
      return jsonResponse({ error: 'Post not found' }, corsHeaders, 404);
    }

    return jsonResponse({ success: true, post: data }, corsHeaders);
  }

  if (request.method === 'PUT') {
    const payload = await request.json();
    return syncUpdatePost(payload, supabase, corsHeaders);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

async function handleGetSchedule(
  request: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const day = url.searchParams.get('day') || 'dag1';

  const { data, error } = await supabase
    .from('recording_schedule')
    .select('*')
    .eq('recording_day', day);

  if (error) {
    return jsonResponse({ error: error.message }, corsHeaders, 500);
  }

  return jsonResponse({ success: true, schedule: data }, corsHeaders);
}

async function handleGetStats(
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { data, error } = await supabase
    .from('program_stats')
    .select('*');

  if (error) {
    return jsonResponse({ error: error.message }, corsHeaders, 500);
  }

  return jsonResponse({ success: true, stats: data }, corsHeaders);
}

// ============================================================================
// HELPERS
// ============================================================================

function jsonResponse(
  data: object,
  corsHeaders: Record<string, string>,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

async function updateSyncStatus(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  source: string
): Promise<void> {
  const now = new Date().toISOString();

  await supabase.from('sync_status').upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      [`last_${source}_sync`]: now,
      [`${source}_version`]: supabase.rpc('increment', { row_id: entityId }),
      updated_at: now,
    },
    { onConflict: 'entity_type,entity_id' }
  );
}

function calculateTcDuration(tcIn: string, tcOut: string): number {
  // Parse HH:MM:SS:FF format
  const parseTC = (tc: string) => {
    const parts = tc.split(':').map(Number);
    return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 25; // 25 fps
  };

  const duration = parseTC(tcOut) - parseTC(tcIn);
  return Math.max(0, Math.round(duration));
}
