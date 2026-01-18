/**
 * Plateforme Vidéo ISC - Backend API
 * Version 2.0 - Supabase Integration
 * 
 * Endpoints:
 * - GET  /api/videos          - Liste toutes les vidéos (avec filtres)
 * - GET  /api/videos/:id      - Détail d'une vidéo
 * - GET  /api/themes          - Liste des thématiques
 * - GET  /api/youtube-info/:videoId - Métadonnées YouTube
 * - POST /api/auth/login      - Connexion admin
 * - POST /api/admin/videos    - Ajouter une vidéo (admin)
 * - PUT  /api/admin/videos/:id - Modifier une vidéo (admin)
 * - DELETE /api/admin/videos/:id - Supprimer une vidéo (admin)
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET || process.env.SUPABASE_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Vérification des variables d'environnement
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ ERREUR: SUPABASE_URL et SUPABASE_KEY sont requis!');
  console.error('Créez un fichier .env avec ces variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET);

// Configuration CORS étendue
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500',
  'https://isc-video-platform.onrender.com',
  'https://plateforme-isc.uqam.ca',
  'https://isc-2025.github.io'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permet les requêtes sans origin (comme curl ou Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Permet aussi les sous-domaines de uqam.ca
    if (origin.endsWith('.uqam.ca')) {
      return callback(null, true);
    }
    return callback(null, true); // Temporairement ouvert pour debug
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// MIDDLEWARE D'AUTHENTIFICATION
// ============================================

const verifyAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou mal formaté' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SUPABASE_SECRET);
    req.adminId = decoded.sub;
    next();
  } catch (err) {
    console.error('Token invalide:', err.message);
    return res.status(403).json({ error: 'Token invalide ou expiré' });
  }
};

// ============================================
// ROUTES PUBLIQUES
// ============================================

/**
 * GET /api/videos
 * Liste toutes les vidéos avec filtres optionnels
 * Query params: keyword, search, theme
 */
app.get('/api/videos', async (req, res) => {
  try {
    let query = supabase
      .from('videos')
      .select(`
        *,
        themes (id, name, color)
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    // Filtre par mot-clé
    if (req.query.keyword) {
      query = query.contains('keywords', [req.query.keyword]);
    }

    // Filtre par thème
    if (req.query.theme) {
      query = query.eq('theme_id', req.query.theme);
    }

    // Recherche textuelle
    if (req.query.search) {
      const search = `%${req.query.search}%`;
      query = query.or(`title.ilike.${search},uploader.ilike.${search},ai_summary.ilike.${search},admin_annotation.ilike.${search}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transformer les données pour le frontend
    const videos = (data || []).map(v => ({
      id: v.id,
      youtubeVideoId: v.youtube_video_id,
      title: v.title,
      uploader: v.uploader,
      views: v.views,
      duration: v.duration,
      aiSummary: v.ai_summary,
      originalDescription: v.original_description,
      adminDescription: v.admin_annotation,
      keywords: v.keywords || [],
      theme: v.themes ? { id: v.themes.id, name: v.themes.name, color: v.themes.color } : null,
      thumbnailUrl: v.thumbnail_url,
      createdAt: v.created_at
    }));

    res.json(videos);
  } catch (err) {
    console.error('Erreur GET /api/videos:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/videos/:id
 * Détail d'une vidéo spécifique
 */
app.get('/api/videos/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        themes (id, name, color)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Vidéo non trouvée' });

    // Transformer pour le frontend
    const video = {
      id: data.id,
      youtubeVideoId: data.youtube_video_id,
      title: data.title,
      uploader: data.uploader,
      views: data.views,
      duration: data.duration,
      aiSummary: data.ai_summary,
      originalDescription: data.original_description,
      adminDescription: data.admin_annotation,
      keywords: data.keywords || [],
      theme: data.themes ? { id: data.themes.id, name: data.themes.name, color: data.themes.color } : null,
      thumbnailUrl: data.thumbnail_url,
      createdAt: data.created_at
    };

    res.json(video);
  } catch (err) {
    console.error('Erreur GET /api/videos/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/themes
 * Liste des thématiques disponibles
 */
app.get('/api/themes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('themes')
      .select('id, name, description, color')
      .order('name');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Erreur GET /api/themes:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/youtube-info/:videoId
 * Récupère les métadonnées YouTube d'une vidéo
 */
app.get('/api/youtube-info/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!YOUTUBE_API_KEY) {
    return res.status(503).json({
      error: 'YouTube API non configurée',
      simulated: true,
      data: {
        title: `Vidéo YouTube ${videoId}`,
        channelTitle: 'Chaîne YouTube',
        description: 'Description non disponible (API YouTube non configurée)',
        viewCount: 0,
        duration: 'N/A',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        tags: []
      }
    });
  }

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics,contentDetails&key=${YOUTUBE_API_KEY}`;
    const { data } = await axios.get(apiUrl);

    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ error: 'Vidéo YouTube non trouvée' });
    }

    const item = data.items[0];
    const snippet = item.snippet;
    const stats = item.statistics;
    const content = item.contentDetails;

    // Parser la durée ISO 8601 (PT1H2M3S -> 1:02:03)
    const duration = content.duration;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    let formattedDuration = 'N/A';
    if (match) {
      const hours = match[1] ? parseInt(match[1]) : 0;
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const seconds = match[3] ? parseInt(match[3]) : 0;
      if (hours > 0) {
        formattedDuration = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
    }

    res.json({
      title: snippet.title,
      channelTitle: snippet.channelTitle,
      description: snippet.description,
      viewCount: parseInt(stats.viewCount) || 0,
      likeCount: parseInt(stats.likeCount) || 0,
      duration: formattedDuration,
      publishedAt: snippet.publishedAt,
      thumbnail: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
      tags: snippet.tags || []
    });
  } catch (err) {
    console.error('Erreur YouTube API:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des données YouTube' });
  }
});

/**
 * GET /api/keywords
 * Liste de tous les mots-clés uniques
 */
app.get('/api/keywords', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('keywords')
      .eq('is_published', true);

    if (error) throw error;

    // Extraire tous les mots-clés uniques
    const allKeywords = new Set();
    (data || []).forEach(v => {
      (v.keywords || []).forEach(kw => allKeywords.add(kw));
    });

    res.json(Array.from(allKeywords).sort());
  } catch (err) {
    console.error('Erreur GET /api/keywords:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTES D'AUTHENTIFICATION
// ============================================

/**
 * POST /api/auth/login
 * Connexion administrateur
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }

    // Récupérer le hash du mot de passe admin
    const { data: settings, error: settingsError } = await supabase
      .from('admin_settings')
      .select('password_hash')
      .limit(1)
      .single();

    if (settingsError) {
      console.error('Erreur récupération admin_settings:', settingsError);
      return res.status(500).json({ error: 'Impossible de récupérer les paramètres admin' });
    }

    if (!settings) {
      return res.status(500).json({ error: 'Paramètres admin non configurés' });
    }

    // Vérifier le mot de passe
    const isValid = await bcrypt.compare(password, settings.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    // Générer un token JWT
    const token = jwt.sign(
      { sub: 'admin', role: 'admin' },
      SUPABASE_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, message: 'Connecté avec succès' });
  } catch (err) {
    console.error('Erreur POST /api/auth/login:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/verify
 * Vérifie si le token est valide
 */
app.get('/api/auth/verify', verifyAdmin, (req, res) => {
  res.json({ valid: true, adminId: req.adminId });
});

// ============================================
// ROUTES ADMIN (PROTÉGÉES)
// ============================================

/**
 * POST /api/admin/videos
 * Ajouter une nouvelle vidéo
 */
app.post('/api/admin/videos', verifyAdmin, async (req, res) => {
  try {
    const {
      youtubeVideoId,
      title,
      uploader,
      aiSummary,
      keywords,
      adminAnnotation,
      originalDescription,
      themeId
    } = req.body;

    if (!youtubeVideoId) {
      return res.status(400).json({ error: 'youtubeVideoId requis' });
    }

    // Vérifier si la vidéo existe déjà
    const { data: existing } = await supabase
      .from('videos')
      .select('id')
      .eq('youtube_video_id', youtubeVideoId)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Cette vidéo existe déjà dans la base de données' });
    }

    // Récupérer les vues YouTube si l'API est configurée
    let views = 0;
    let thumbnailUrl = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;

    if (YOUTUBE_API_KEY) {
      try {
        const ytResponse = await axios.get(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${youtubeVideoId}&key=${YOUTUBE_API_KEY}`
        );
        if (ytResponse.data.items?.[0]) {
          views = parseInt(ytResponse.data.items[0].statistics.viewCount) || 0;
          const thumbs = ytResponse.data.items[0].snippet.thumbnails;
          thumbnailUrl = thumbs.maxres?.url || thumbs.high?.url || thumbnailUrl;
        }
      } catch (err) {
        console.warn('Impossible de récupérer les données YouTube:', err.message);
      }
    }

    // Insérer la vidéo
    const { data, error } = await supabase
      .from('videos')
      .insert([{
        youtube_video_id: youtubeVideoId,
        title: title || `Vidéo ${youtubeVideoId}`,
        uploader: uploader || 'ISC Channel',
        views: views,
        ai_summary: aiSummary || '',
        keywords: keywords || [],
        admin_annotation: adminAnnotation || '',
        original_description: originalDescription || '',
        theme_id: themeId || null,
        thumbnail_url: thumbnailUrl,
        is_published: true
      }])
      .select(`
        *,
        themes (id, name, color)
      `);

    if (error) throw error;

    res.status(201).json({
      message: 'Vidéo ajoutée avec succès',
      video: data[0]
    });
  } catch (err) {
    console.error('Erreur POST /api/admin/videos:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/admin/videos/:id
 * Modifier une vidéo existante
 */
app.put('/api/admin/videos/:id', verifyAdmin, async (req, res) => {
  try {
    const { title, aiSummary, keywords, adminAnnotation, themeId, uploader } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (uploader !== undefined) updateData.uploader = uploader;
    if (aiSummary !== undefined) updateData.ai_summary = aiSummary;
    if (keywords !== undefined) updateData.keywords = keywords;
    if (adminAnnotation !== undefined) updateData.admin_annotation = adminAnnotation;
    if (themeId !== undefined) updateData.theme_id = themeId;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('videos')
      .update(updateData)
      .eq('id', req.params.id)
      .select(`
        *,
        themes (id, name, color)
      `);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }

    res.json({ message: 'Vidéo mise à jour avec succès', video: data[0] });
  } catch (err) {
    console.error('Erreur PUT /api/admin/videos/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/admin/videos/:id
 * Supprimer une vidéo
 */
app.delete('/api/admin/videos/:id', verifyAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Vidéo supprimée avec succès' });
  } catch (err) {
    console.error('Erreur DELETE /api/admin/videos/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTE FALLBACK
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gestion des 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎬 Plateforme Vidéo ISC - Backend API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
  console.log(`📊 Supabase: ${SUPABASE_URL}`);
  console.log(`🔑 YouTube API: ${YOUTUBE_API_KEY ? 'Configurée' : 'Non configurée'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
