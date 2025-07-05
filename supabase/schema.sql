-- ============================================================================
-- CHURCH SERVICE PRODUCTION - SUPABASE SCHEMA
-- Modern PostgreSQL backend with full ACID, history and realtime
-- Developed for Swedish public service broadcast production
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE post_status AS ENUM ('planerad', 'recording', 'inspelad', 'godkand');
CREATE TYPE recording_day AS ENUM ('dag1', 'dag2', 'dag3');
CREATE TYPE person_type AS ENUM ('medverkande', 'team', 'komponist', 'textforfattare');
CREATE TYPE change_source AS ENUM ('sheets', 'api', 'studio', 'companion', 'system');

-- ============================================================================
-- PROGRAMS TABLE
-- ============================================================================

CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_nr INT NOT NULL UNIQUE CHECK (program_nr BETWEEN 1 AND 4),
  location TEXT DEFAULT 'MARIAKYRKAN VÄXJÖ',
  start_date DATE,
  broadcast_date DATE,
  church_year TEXT,  -- "2 i fastan", "Påskdagen" etc
  prod_nr TEXT,
  target_duration_sec INT DEFAULT 2610,  -- 43:30
  start_time TIME DEFAULT '09:00:00',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INT DEFAULT 1
);

-- Seed 4 programs
INSERT INTO programs (program_nr) VALUES (1), (2), (3), (4);

-- ============================================================================
-- PEOPLE TABLE
-- ============================================================================

CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id TEXT UNIQUE NOT NULL,  -- "P001", "P002" etc (för Sheets-kompatibilitet)
  name TEXT NOT NULL,
  roles TEXT[],  -- Array: ['liturg', 'predikant']
  contact TEXT,
  type person_type DEFAULT 'medverkande',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- POST TYPES TABLE
-- ============================================================================

CREATE TABLE post_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_key TEXT UNIQUE NOT NULL,  -- 'predikan', 'sang_kor' etc
  display_name TEXT NOT NULL,
  default_duration_sec INT DEFAULT 60,
  icon TEXT,
  requires_people BOOLEAN DEFAULT false,
  requires_text_author BOOLEAN DEFAULT false,
  requires_composer BOOLEAN DEFAULT false,
  category TEXT,  -- 'liturgisk', 'musik', 'presentation', 'teknisk'
  bg_colour TEXT,
  row_height INT DEFAULT 35,
  description TEXT
);

-- Seed default post types
INSERT INTO post_types (type_key, display_name, default_duration_sec, icon, requires_people, category, bg_colour) VALUES
  ('predikan', 'Predikan', 420, '🎤', true, 'liturgisk', '#FFE5CC'),
  ('lasning', 'Textläsning', 90, '📖', true, 'liturgisk', '#E3F2FD'),
  ('sang_kor', 'Sång (kör)', 180, '🎼', true, 'musik', '#F3E5F5'),
  ('sang_solo', 'Sång (solo)', 150, '🎵', true, 'musik', '#FCE4EC'),
  ('orgelspel', 'Orgelspel', 120, '🎹', true, 'musik', '#FFF9C4'),
  ('liturgi', 'Liturgiskt element', 45, '✝️', true, 'liturgisk', '#E8F5E9'),
  ('forbon', 'Förbön', 120, '🙏', true, 'liturgisk', '#E0F2F1'),
  ('punktinfo', 'Punktinfo', 60, '🎥', false, 'presentation', '#FFF3E0'),
  ('tema_presentation', 'Temapresentation', 150, '📺', true, 'presentation', '#E1F5FE'),
  ('mellan_paa', 'Mellan-påa', 30, '⏸️', false, 'teknisk', '#ECEFF1'),
  ('valsignelse', 'Välsignelse', 45, '🙌', true, 'liturgisk', '#C8E6C9');

-- ============================================================================
-- POSTS TABLE (huvudtabellen)
-- ============================================================================

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Sheets-kompatibelt ID (P1:5 = Program 1, Post 5)
  post_id TEXT UNIQUE NOT NULL,

  -- Relationer
  program_nr INT NOT NULL REFERENCES programs(program_nr),
  type_key TEXT REFERENCES post_types(type_key),

  -- Innehåll
  sort_order INT NOT NULL,
  title TEXT,
  duration_sec INT DEFAULT 60,
  location TEXT,  -- talarplats, altare, etc

  -- Medverkande (array av person_ids för enkel hantering)
  people_ids TEXT[],

  -- Musik-specifikt
  text_author TEXT,
  composer TEXT,
  arranger TEXT,

  -- Inspelning
  recording_day recording_day DEFAULT 'dag1',
  recording_time TIME,
  status post_status DEFAULT 'planerad',

  -- Övrigt
  info_pos TEXT,
  graphics TEXT,
  notes TEXT,
  open_text BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optimistic locking - KRITISKT för sync
  version INT DEFAULT 1,
  last_modified_by change_source DEFAULT 'system',

  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT
);

-- Index för snabba queries
CREATE INDEX idx_posts_program ON posts(program_nr);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_recording_day ON posts(recording_day);
CREATE INDEX idx_posts_deleted ON posts(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- TIMECODE LOG (append-only för inspelningshistorik)
-- ============================================================================

CREATE TABLE tc_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id TEXT NOT NULL REFERENCES posts(post_id),
  operator TEXT,
  tc_in TEXT,  -- HH:MM:SS:FF
  tc_out TEXT,
  clip_nr INT,
  duration_sec INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tc_log_post ON tc_log(post_id);

-- ============================================================================
-- AUDIT LOG (automatisk historik för alla ändringar)
-- ============================================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID,
  post_id TEXT,  -- För enkel sökning
  action TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  source change_source DEFAULT 'system',
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_post ON audit_log(post_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- ============================================================================
-- SYNC STATUS (för att tracka Sheets-synkronisering)
-- ============================================================================

CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,  -- 'post', 'person', 'program'
  entity_id TEXT NOT NULL,
  sheets_version INT DEFAULT 0,
  db_version INT DEFAULT 0,
  last_sheets_sync TIMESTAMPTZ,
  last_db_sync TIMESTAMPTZ,
  conflict BOOLEAN DEFAULT false,
  conflict_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(entity_type, entity_id)
);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-increment version (optimistic locking)
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Audit logging trigger
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  changed TEXT[];
  col TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Find changed columns
    FOR col IN SELECT column_name FROM information_schema.columns
               WHERE table_name = TG_TABLE_NAME LOOP
      IF to_jsonb(OLD) -> col IS DISTINCT FROM to_jsonb(NEW) -> col THEN
        changed := array_append(changed, col);
      END IF;
    END LOOP;

    INSERT INTO audit_log (table_name, record_id, post_id, action, old_data, new_data, changed_fields, source)
    VALUES (
      TG_TABLE_NAME,
      NEW.id,
      CASE WHEN TG_TABLE_NAME = 'posts' THEN NEW.post_id ELSE NULL END,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      changed,
      NEW.last_modified_by
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, post_id, action, new_data, source)
    VALUES (
      TG_TABLE_NAME,
      NEW.id,
      CASE WHEN TG_TABLE_NAME = 'posts' THEN NEW.post_id ELSE NULL END,
      'INSERT',
      to_jsonb(NEW),
      NEW.last_modified_by
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, post_id, action, old_data)
    VALUES (
      TG_TABLE_NAME,
      OLD.id,
      CASE WHEN TG_TABLE_NAME = 'posts' THEN OLD.post_id ELSE NULL END,
      'DELETE',
      to_jsonb(OLD)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to posts
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER posts_version
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER posts_audit
  AFTER INSERT OR UPDATE OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Apply to programs
CREATE TRIGGER programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Apply to people
CREATE TRIGGER people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies (anon kan läsa allt, authenticated kan skriva)
CREATE POLICY "Public read access" ON posts FOR SELECT USING (true);
CREATE POLICY "Authenticated write access" ON posts FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read access" ON people FOR SELECT USING (true);
CREATE POLICY "Authenticated write access" ON people FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read access" ON programs FOR SELECT USING (true);
CREATE POLICY "Authenticated write access" ON programs FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read access" ON tc_log FOR SELECT USING (true);
CREATE POLICY "Authenticated write access" ON tc_log FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read access" ON audit_log FOR SELECT USING (true);

-- ============================================================================
-- VIEWS (för enkel access)
-- ============================================================================

-- Aktiva poster (ej raderade) med all info
CREATE VIEW posts_active AS
SELECT
  p.*,
  pt.display_name as type_display,
  pt.icon as type_icon,
  pt.bg_colour as type_bg_colour,
  pg.location as program_location,
  pg.broadcast_date
FROM posts p
LEFT JOIN post_types pt ON p.type_key = pt.type_key
LEFT JOIN programs pg ON p.program_nr = pg.program_nr
WHERE p.deleted_at IS NULL
ORDER BY p.program_nr, p.sort_order;

-- Schema för dagens inspelning
CREATE VIEW recording_schedule AS
SELECT
  p.post_id,
  p.program_nr,
  p.sort_order,
  p.title,
  p.duration_sec,
  p.status,
  p.recording_day,
  pt.display_name as type_name,
  pt.icon
FROM posts p
LEFT JOIN post_types pt ON p.type_key = pt.type_key
WHERE p.deleted_at IS NULL
ORDER BY
  CASE p.recording_day
    WHEN 'dag1' THEN 1
    WHEN 'dag2' THEN 2
    WHEN 'dag3' THEN 3
  END,
  p.program_nr,
  p.sort_order;

-- Statistik per program
CREATE VIEW program_stats AS
SELECT
  program_nr,
  COUNT(*) as total_posts,
  COUNT(*) FILTER (WHERE status = 'planerad') as planned,
  COUNT(*) FILTER (WHERE status = 'recording') as recording,
  COUNT(*) FILTER (WHERE status = 'inspelad') as recorded,
  COUNT(*) FILTER (WHERE status = 'godkand') as approved,
  SUM(duration_sec) as total_duration_sec,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('inspelad', 'godkand')) / NULLIF(COUNT(*), 0), 1) as progress_percent
FROM posts
WHERE deleted_at IS NULL
GROUP BY program_nr
ORDER BY program_nr;

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE tc_log;
ALTER PUBLICATION supabase_realtime ADD TABLE sync_status;
