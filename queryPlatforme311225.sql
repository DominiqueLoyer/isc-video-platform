-- Création de la table pour les vidéos
CREATE TABLE videos (
  id BIGSERIAL PRIMARY KEY,
  youtube_video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  uploader TEXT,
  view_count INTEGER DEFAULT 0,
  keywords TEXT[] DEFAULT '{}',
  summary TEXT,
  admin_annotation TEXT,
  themes TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les recherches rapides
CREATE INDEX idx_keywords ON videos USING GIN (keywords);
CREATE INDEX idx_themes ON videos USING GIN (themes);
CREATE INDEX idx_youtube_id ON videos (youtube_video_id);
