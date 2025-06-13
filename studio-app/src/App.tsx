import React, { useState, useEffect, useCallback } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

interface Post {
  post_id: string;
  program_nr: number;
  sort_order: number;
  type_key: string;
  type_display?: string;
  type_icon?: string;
  title: string;
  duration_sec: number;
  people_ids: string[];
  location: string;
  status: 'planerad' | 'recording' | 'inspelad' | 'godkand';
  recording_day: string;
  notes: string;
}

interface ProgramStats {
  program_nr: number;
  total_posts: number;
  planned: number;
  recording: number;
  recorded: number;
  approved: number;
  total_duration_sec: number;
  progress_percent: number;
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const [programNr, setProgramNr] = useState(1);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<ProgramStats | null>(null);
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [clock, setClock] = useState(new Date());

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts_active')
        .select('*')
        .eq('program_nr', programNr)
        .order('sort_order');

      if (error) throw error;
      setPosts(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Kunde inte hämta poster');
    }
  }, [programNr]);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('program_stats')
        .select('*')
        .eq('program_nr', programNr)
        .single();

      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [programNr]);

  // ============================================================================
  // REALTIME SUBSCRIPTION
  // ============================================================================

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtime = async () => {
      setLoading(true);

      await fetchPosts();
      await fetchStats();

      // Subscribe to realtime changes
      channel = supabase
        .channel(`posts_program_${programNr}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'posts',
            filter: `program_nr=eq.${programNr}`
          },
          (payload) => {
            console.log('Realtime update:', payload);
            fetchPosts();
            fetchStats();
          }
        )
        .subscribe((status) => {
          setConnected(status === 'SUBSCRIBED');
          setLoading(false);
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [programNr, fetchPosts, fetchStats]);

  // ============================================================================
  // CLOCK & TIMER
  // ============================================================================

  useEffect(() => {
    const clockInterval = setInterval(() => {
      setClock(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    let timerInterval: number;

    if (isRecording && recordingStartTime) {
      timerInterval = window.setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - recordingStartTime) / 1000));
      }, 100);
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isRecording, recordingStartTime]);

  // ============================================================================
  // POST ACTIONS
  // ============================================================================

  const currentPost = posts.find(p => p.post_id === currentPostId) || posts.find(p => p.status === 'recording') || posts[0];
  const currentIndex = currentPost ? posts.findIndex(p => p.post_id === currentPost.post_id) : -1;
  const upcomingPosts = currentIndex >= 0 ? posts.slice(currentIndex, currentIndex + 6) : posts.slice(0, 6);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentPostId(posts[currentIndex - 1].post_id);
    }
  };

  const handleNext = () => {
    if (currentIndex < posts.length - 1) {
      setCurrentPostId(posts[currentIndex + 1].post_id);
    }
  };

  const handleStartRecording = async () => {
    if (!currentPost) return;

    setIsRecording(true);
    setRecordingStartTime(Date.now());
    setElapsedTime(0);

    try {
      await supabase
        .from('posts')
        .update({ status: 'recording', last_modified_by: 'studio' })
        .eq('post_id', currentPost.post_id);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  };

  const handleStopRecording = async () => {
    if (!currentPost) return;

    setIsRecording(false);

    try {
      await supabase
        .from('posts')
        .update({ status: 'inspelad', last_modified_by: 'studio' })
        .eq('post_id', currentPost.post_id);

      // Move to next post
      handleNext();
    } catch (err) {
      console.error('Error stopping recording:', err);
    }
  };

  const handleApprove = async () => {
    if (!currentPost) return;

    try {
      await supabase
        .from('posts')
        .update({ status: 'godkand', last_modified_by: 'studio' })
        .eq('post_id', currentPost.post_id);
    } catch (err) {
      console.error('Error approving:', err);
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatClock = (date: Date): string => {
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div className="error-container">
        <div className="error-icon">⚙️</div>
        <div className="error-message">
          Supabase inte konfigurerat.<br />
          Sätt VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY i .env
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <div>Ansluter till Supabase...</div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="error-container">
        <div className="error-icon">❌</div>
        <div className="error-message">{error}</div>
        <button className="retry-btn" onClick={fetchPosts}>
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <div className="studio-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">SVT Gudstjänst</div>
          <div className="program-selector">
            {[1, 2, 3, 4].map(num => (
              <button
                key={num}
                className={`program-btn ${programNr === num ? 'active' : ''}`}
                onClick={() => setProgramNr(num)}
              >
                P{num}
              </button>
            ))}
          </div>
        </div>

        <div className="header-right">
          <div className="connection-status">
            <div className={`status-dot ${connected ? '' : 'disconnected'}`} />
            {connected ? 'Live' : 'Ansluter...'}
          </div>
          <div className="clock">{formatClock(clock)}</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Current Post */}
        <div className="current-post">
          {currentPost ? (
            <>
              <div className="current-label">Aktiv post</div>

              <div className="current-type">
                <span className="type-icon">{currentPost.type_icon || '📄'}</span>
                <span className="type-name">{currentPost.type_display || currentPost.type_key}</span>
              </div>

              <div className="current-title">{currentPost.title || '(Ingen titel)'}</div>

              <div className="current-meta">
                <div className="meta-item">
                  <span className="meta-label">Plats</span>
                  <span className="meta-value">{currentPost.location || '-'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Dag</span>
                  <span className="meta-value">{currentPost.recording_day}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Status</span>
                  <span className="meta-value">{currentPost.status}</span>
                </div>
              </div>

              <div className="timer-container">
                <div className={`timer ${isRecording ? 'recording' : ''} ${elapsedTime > currentPost.duration_sec ? 'overtime' : ''}`}>
                  {formatTime(elapsedTime)}
                </div>
                <div className="timer-target">
                  / {formatTime(currentPost.duration_sec)}
                </div>
              </div>
            </>
          ) : (
            <div className="no-post">
              <div className="no-post-icon">📋</div>
              <div className="no-post-text">Inga poster i detta program</div>
            </div>
          )}
        </div>

        {/* Post Queue */}
        <div className="post-queue">
          <div className="queue-header">Kommande poster</div>
          <div className="queue-list">
            {upcomingPosts.map((post, idx) => (
              <div
                key={post.post_id}
                className="queue-item"
                onClick={() => setCurrentPostId(post.post_id)}
              >
                <div className="queue-number">{currentIndex + idx + 1}</div>
                <div className="queue-info">
                  <div className="queue-type">{post.type_display || post.type_key}</div>
                  <div className="queue-title">{post.title || '(Ingen titel)'}</div>
                </div>
                <div className="queue-duration">{formatTime(post.duration_sec)}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Control Bar */}
      <div className="control-bar">
        <button className="control-btn btn-prev" onClick={handlePrevious} disabled={currentIndex <= 0}>
          ← Föregående
        </button>

        {isRecording ? (
          <button className="control-btn btn-record recording" onClick={handleStopRecording}>
            ⏹ Stoppa inspelning
          </button>
        ) : (
          <button className="control-btn btn-record" onClick={handleStartRecording} disabled={!currentPost}>
            ⏺ Starta inspelning
          </button>
        )}

        <button className="control-btn btn-approve" onClick={handleApprove} disabled={!currentPost || currentPost.status !== 'inspelad'}>
          ✓ Godkänn
        </button>

        <button className="control-btn btn-next" onClick={handleNext} disabled={currentIndex >= posts.length - 1}>
          Nästa →
        </button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Planerade:</span>
            <span className="stat-value">{stats.planned}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Inspelade:</span>
            <span className="stat-value positive">{stats.recorded + stats.approved}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Framsteg:</span>
            <span className="stat-value positive">{stats.progress_percent}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total tid:</span>
            <span className="stat-value">{formatTime(stats.total_duration_sec)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
