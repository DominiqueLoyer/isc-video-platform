/**
 * Plateforme Vidéo ISC - Backend API (Version Stable Restaurée)
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET || process.env.SUPABASE_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERREUR: SUPABASE_URL et SUPABASE_KEY requis.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware Auth
const verifyAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    jwt.verify(token, SUPABASE_SECRET);
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token invalide' });
  }
};

// --- ROUTES ---

// 1. Videos
app.get('/api/videos', async (req, res) => {
  try {
    let query = supabase.from('videos').select('*, themes(id, name, color)').eq('is_published', true).order('created_at', { ascending: false });

    if (req.query.keyword) query = query.contains('keywords', [req.query.keyword]);
    if (req.query.theme) query = query.eq('theme_id', req.query.theme);
    if (req.query.search) {
      const s = `%${req.query.search}%`;
      query = query.or(`title.ilike.${s},uploader.ilike.${s},ai_summary.ilike.${s}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const videos = data.map(v => ({
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
      theme: v.themes,
      thumbnailUrl: v.thumbnail_url,
      createdAt: v.created_at
    }));
    res.json(videos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Themes
app.get('/api/themes', async (req, res) => {
  const { data } = await supabase.from('themes').select('*').order('name');
  res.json(data || []);
});

// 3. Keywords
app.get('/api/keywords', async (req, res) => {
  const { data } = await supabase.from('videos').select('keywords');
  const all = new Set();
  (data || []).forEach(v => (v.keywords || []).forEach(k => all.add(k)));
  res.json(Array.from(all).sort());
});

// 4. YouTube Info
app.get('/api/youtube-info/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!YOUTUBE_API_KEY) return res.status(503).json({ error: 'YouTube API non configurée' });

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`;
    const { data } = await axios.get(url);
    if (!data.items?.length) return res.status(404).json({ error: 'Vidéo non trouvée' });

    const item = data.items[0];
    res.json({
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      description: item.snippet.description,
      viewCount: parseInt(item.statistics.viewCount) || 0,
      thumbnail: item.snippet.thumbnails?.high?.url
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur YouTube API' });
  }
});

// 5. Generate Summary (VERSION STABLE TEXTE)
app.post('/api/generate-summary', async (req, res) => {
  const { title, description } = req.body;
  if (!GEMINI_API_KEY) return res.json({ summary: "Résumé indisponible (Clé manquante)" });

  try {
    const prompt = `Résume cette vidéo de façon académique en Français (max 3 phrases) et donne 5 mots-clés séparés par des virgules à la fin (Format: Résumé... Mots-clés: A, B, C).
        Titre: ${title}
        Description: ${description}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await axios.post(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parsing basique du texte retourné
    let summary = text;
    let keywords = [];

    if (text.includes('Mots-clés:')) {
      const parts = text.split('Mots-clés:');
      summary = parts[0].trim();
      keywords = parts[1].split(',').map(k => k.trim());
    }

    res.json({ summary, keywords });
  } catch (err) {
    console.error("Gemini Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Erreur génération résumé" });
  }
});

// 6. Auth & Admin
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  const { data } = await supabase.from('admin_settings').select('password_hash').single();
  if (data && await bcrypt.compare(password, data.password_hash)) {
    const token = jwt.sign({ role: 'admin' }, SUPABASE_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Mot de passe incorrect' });
  }
});

app.post('/api/admin/videos', verifyAdmin, async (req, res) => {
  const { error } = await supabase.from('videos').insert([req.body]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/admin/videos/:id', verifyAdmin, async (req, res) => {
  const { error } = await supabase.from('videos').update(req.body).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/admin/videos/:id', verifyAdmin, async (req, res) => {
  const { error } = await supabase.from('videos').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Fallback
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html'))); // Corrigé: index.html

app.listen(PORT, () => console.log(`Serveur restauré sur port ${PORT}`));
