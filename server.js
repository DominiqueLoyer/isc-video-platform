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
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Ne plus bloquer le démarrage si les clés sont hardcodées
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

// 5. Generate Summary (VERSION GROQ - LLAMA 3 - AVEC THÉMATIQUES)
app.post('/api/generate-summary', async (req, res) => {
  const { title, description } = req.body;
  if (!GROQ_API_KEY) return res.json({ summary: "Résumé indisponible (Clé manquante)", keywords: [], themeId: null });

  try {
    const themesList = `
      - Intelligence Artificielle (ID: 238e42e7-4d16-4a2b-b7b8-a1e06a07382e)
      - Neurosciences (ID: 915b4ece-6f8a-4bb2-897c-ce759cfc09af)
      - Philosophie de l'esprit (ID: 4dc2da59-8540-48e7-a68d-4a285af5ea2d)
      - Linguistique (ID: ea31575f-1752-40be-9ba6-1a181facf05a)
      - Psychologie Cognitive (ID: 1e820095-12ac-4ad3-b149-6560deb6367a)
      - Sciences Cognitives (ID: 8a47249a-9370-4817-b035-cfbb786422d1)
      - Éthique & Société (ID: 3b5c5746-058f-47a9-a5f4-cb72b414846b)
      - Autre (ID: 69287883-3c79-4624-8b2b-bb5bced474dd)
    `;

    const prompt = `Tu es une IA experte en indexation vidéo pour un institut de recherche académique.
    Tâche : Analyse le titre et la description et génère :
    1. Un résumé académique en Français concis (max 3 phrases).
    2. Une liste de 5 mots-clés pertinents (séparés par des virgules).
    3. Propose la thématique la plus appropriée (un seul nom court, ex: "Neurosciences", "Intelligence Artificielle", "Philosophie de l'esprit", "Linguistique", etc.).

    IMPORTANT : Ne donne AUCUNE introduction ni conclusion. Donne UNIQUEMENT le bloc suivant :

    Format de sortie strict :
    Résumé: [Ton résumé ici]
    Mots-clés: [Mot1, Mot2, Mot3, Mot4, Mot5]
    Thématique: [Nom de la thématique choisie]

    Titre: ${title}
    Description: ${description}`;

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const text = response.data?.choices?.[0]?.message?.content || "";
    console.log("Groq Raw Content:", text);

    // Parsing robuste
    let summary = "Résumé non généré.";
    let keywords = [];
    let proposedTheme = "Autre";

    const summaryMatch = text.match(/Résumé:\s*([\s\S]*?)(?=Mots-clés:|$)/i);
    const keywordsMatch = text.match(/Mots-clés:\s*([\s\S]*?)(?=Thématique:|$)/i);
    const themeMatch = text.match(/Thématique:\s*([\s\S]*?)$/i);

    if (summaryMatch) summary = summaryMatch[1].trim();
    if (keywordsMatch) {
      keywords = keywordsMatch[1].split(',')
        .map(k => k.trim().replace(/\.$/, ''))
        .filter(k => k.length > 0);
    }
    if (themeMatch) proposedTheme = themeMatch[1].trim();

    // Trouver ou créer la thématique dans Supabase
    let themeId = null;
    try {
      const { data: existingThemes } = await supabase.from('themes').select('id, name');
      const theme = existingThemes?.find(t => t.name.toLowerCase() === proposedTheme.toLowerCase());

      if (theme) {
        themeId = theme.id;
      } else {
        // Créer un nouveau thème si n'existe pas
        const { data: newTheme, error: createError } = await supabase.from('themes').insert([{ name: proposedTheme }]).select().single();
        if (!createError && newTheme) themeId = newTheme.id;
      }
    } catch (dbErr) {
      console.error("DB Theme Error:", dbErr);
    }

    res.json({ summary, keywords, themeId });
  } catch (err) {
    console.error("Groq Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Erreur génération résumé (Groq)" });
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
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Serveur restauré sur port ${PORT}`));
