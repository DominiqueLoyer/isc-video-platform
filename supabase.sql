-- ============================================
-- SCHÉMA SUPABASE POUR PLATEFORME ISC
-- Version 2.0 - Avec thématiques et données initiales
-- ============================================

-- Supprimer les tables existantes si nécessaire (pour réinitialisation)
DROP TABLE IF EXISTS videos CASCADE;
DROP TABLE IF EXISTS admin_settings CASCADE;
DROP TABLE IF EXISTS themes CASCADE;

-- Table des thématiques
CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7) DEFAULT '#337ab7',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des vidéos
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  uploader VARCHAR(255),
  views INTEGER DEFAULT 0,
  duration VARCHAR(20),
  ai_summary TEXT,
  original_description TEXT,
  admin_annotation TEXT,
  keywords TEXT[],
  theme_id UUID REFERENCES themes(id),
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des paramètres admin
CREATE TABLE admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  password_hash VARCHAR(255) NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;

-- Politiques pour videos (lecture publique, écriture via service_role)
CREATE POLICY "allow_public_read_videos" ON videos FOR SELECT USING (is_published = true);
CREATE POLICY "allow_service_insert_videos" ON videos FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_service_update_videos" ON videos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "allow_service_delete_videos" ON videos FOR DELETE USING (true);

-- Politiques pour themes (lecture publique)
CREATE POLICY "allow_public_read_themes" ON themes FOR SELECT USING (true);
CREATE POLICY "allow_service_manage_themes" ON themes FOR ALL USING (true);

-- Politiques pour admin_settings (aucune lecture publique)
CREATE POLICY "deny_public_read_admin" ON admin_settings FOR SELECT USING (false);
CREATE POLICY "allow_service_manage_admin" ON admin_settings FOR ALL USING (true);

-- ============================================
-- INDEX POUR PERFORMANCE
-- ============================================

CREATE INDEX idx_videos_youtube_id ON videos(youtube_video_id);
CREATE INDEX idx_videos_keywords ON videos USING GIN(keywords);
CREATE INDEX idx_videos_title ON videos(title);
CREATE INDEX idx_videos_theme ON videos(theme_id);
CREATE INDEX idx_videos_created ON videos(created_at DESC);

-- ============================================
-- DONNÉES INITIALES
-- ============================================

-- Thématiques prédéfinies pour l'ISC
INSERT INTO themes (name, description, color) VALUES
  ('Intelligence Artificielle', 'IA, apprentissage automatique, modèles de langage', '#E74C3C'),
  ('Neurosciences', 'Cerveau, imagerie cérébrale, neurones', '#3498DB'),
  ('Philosophie de l''esprit', 'Conscience, cognition, problème difficile', '#9B59B6'),
  ('Linguistique', 'Langage, grammaire, acquisition', '#2ECC71'),
  ('Psychologie Cognitive', 'Mémoire, attention, perception', '#F39C12'),
  ('Sciences Cognitives', 'Interdisciplinaire, introduction, vulgarisation', '#1ABC9C'),
  ('Éthique & Société', 'Impact sociétal, régulation, futur', '#E67E22'),
  ('Autre', 'Vidéos sans catégorie spécifique', '#95A5A6');

-- Mot de passe admin: isc2025 (hashé avec bcrypt, 10 rounds)
-- Généré avec: bcrypt.hashSync('isc2025', 10)
INSERT INTO admin_settings (password_hash) 
VALUES ('$2b$10$rOvHPxfzO8rPMpSKEQXJH.VL0TAx1q7zq5KqYQbHjZJ4VPKFnWLDm');

-- Vidéos d'exemple (tirées de plate.html)
INSERT INTO videos (youtube_video_id, title, uploader, views, duration, ai_summary, original_description, admin_annotation, keywords, theme_id) VALUES
(
  'q0s-b2gq-T0',
  'Où va l''IA ? (Feu de Bengale)',
  'Feu de Bengale',
  215000,
  '20:10',
  'Analyse approfondie de la trajectoire actuelle de l''intelligence artificielle, de ses capacités émergentes (modèles de langage) à ses risques sociétaux et existentiels. Discussion sur l''alignement et la régulation.',
  'L''IA va-t-elle nous remplacer ? Va-t-elle nous détruire ? Ou juste piquer nos dessins ?',
  'Très bonne vidéo de vulgarisation sur les enjeux actuels. Pertinent pour l''introduction du séminaire sur le Léviathan algorithmique.',
  ARRAY['IA', 'Modèles de Langage', 'Éthique', 'Alignement', 'Régulation'],
  (SELECT id FROM themes WHERE name = 'Intelligence Artificielle')
),
(
  'si-t-0Lq1-c',
  'Le Problème Difficile de la Conscience (David Chalmers)',
  'David Chalmers (TED)',
  2500000,
  '17:35',
  'Le philosophe David Chalmers explore le "problème difficile" de la conscience : pourquoi et comment les processus physiques du cerveau donnent-ils lieu à une expérience subjective riche ? Il examine les limites des explications purement mécanistes.',
  'Le philosophe David Chalmers demande : "Pourquoi tout ce traitement ne se fait-il pas dans le noir, sans aucune expérience subjective ?"',
  'La référence classique sur le "Hard Problem". Indispensable pour tous les étudiants en cognition.',
  ARRAY['Conscience', 'Philosophie', 'Neurosciences', 'Problème Difficile', 'Subjectivité'],
  (SELECT id FROM themes WHERE name = 'Philosophie de l''esprit')
),
(
  'D5in5Nge-aE',
  'La Théorie du Langage de Chomsky',
  'The Brain Maze',
  320000,
  '8:15',
  'Cette vidéo résume les concepts clés de la théorie linguistique de Noam Chomsky, notamment la grammaire universelle, l''innéisme et le dispositif d''acquisition du langage (LAD). Elle oppose sa vision au behaviorisme.',
  'Explication des théories de Noam Chomsky sur l''acquisition du langage et la grammaire universelle.',
  'Bon résumé pour les étudiants de L1 en linguistique et sc. cognitives.',
  ARRAY['Langage', 'Linguistique', 'Chomsky', 'Grammaire Universelle', 'Cognition'],
  (SELECT id FROM themes WHERE name = 'Linguistique')
),
(
  'm3g2s8dFv2E',
  'Qu''est-ce que la Science Cognitive ?',
  'Ryan Rhodes',
  110000,
  '12:05',
  'Une introduction claire à ce qu''est la science cognitive. La vidéo la décrit comme un champ interdisciplinaire qui étudie l''esprit et ses processus, en s''appuyant sur la psychologie, l''informatique, les neurosciences, la linguistique et la philosophie.',
  'Un aperçu du champ interdisciplinaire des Sciences Cognitives.',
  'Parfait pour la journée portes ouvertes ou pour les nouveaux étudiants.',
  ARRAY['Sciences Cognitives', 'Interdisciplinaire', 'Esprit', 'Psychologie', 'Informatique'],
  (SELECT id FROM themes WHERE name = 'Sciences Cognitives')
),
(
  'K38nDFCRyS4',
  'La conscience, par Stanislas Dehaene',
  'Collège de France',
  190000,
  '14:30',
  'Stanislas Dehaene présente ses travaux sur les "signatures" neuronales de la conscience. Il explique comment l''accès conscient à l''information se manifeste dans le cerveau par une ignition globale et synchronisée de l''activité neuronale.',
  'Leçon inaugurale de Stanislas Dehaene au Collège de France (extrait).',
  'Extrait de sa leçon inaugurale. Excellent résumé de sa thèse sur l''espace de travail neuronal global.',
  ARRAY['Conscience', 'Neurosciences', 'Dehaene', 'Cerveau', 'Imagerie Cérébrale'],
  (SELECT id FROM themes WHERE name = 'Neurosciences')
),
(
  'SdatgLdfoiY',
  'Yuval Harari et Lex Fridman sur l''IA',
  'Lex Fridman',
  5200000,
  '58:10',
  'Une conversation profonde entre Yuval Noah Harari et Lex Fridman sur l''impact de l''IA sur l''humanité. Ils discutent de l''IA en tant que force narrative, de son potentiel de manipulation et de la redéfinition du pouvoir à l''ère numérique.',
  'Yuval Noah Harari est un historien, philosophe et auteur de Sapiens, Homo Deus, et 21 Leçons pour le 21e Siècle.',
  'La discussion sur "l''IA qui pirate le système d''exploitation humain" (le langage) est directement liée à ma thèse.',
  ARRAY['IA', 'Philosophie', 'Futur', 'Harari', 'Société'],
  (SELECT id FROM themes WHERE name = 'Éthique & Société')
),
(
  'M_SMqgHkS2E',
  'Émotions et Cognition Sociale',
  'ISC Channel',
  75000,
  '19:50',
  'Analyse de l''impact profond des émotions sur nos interactions sociales et notre capacité à comprendre les intentions des autres. Comment le cerveau traite-t-il les signaux émotionnels ?',
  'YouTube: Le rôle des émotions.',
  'La partie sur les neurones miroirs est un peu datée, mais le reste est solide.',
  ARRAY['Émotions', 'Cognition Sociale', 'Empathie', 'Théorie de l''esprit', 'Cerveau'],
  (SELECT id FROM themes WHERE name = 'Psychologie Cognitive')
);

-- ============================================
-- FIN DU SCHÉMA
-- ============================================
