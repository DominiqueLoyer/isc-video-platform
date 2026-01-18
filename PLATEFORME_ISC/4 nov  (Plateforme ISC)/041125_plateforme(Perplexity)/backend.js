/*
 * ===============================================
 * SERVEUR BACKEND POUR LA PLATEFORME VIDÉO ISC
 * Simplifié pour Render
 * ===============================================
 */

import express from 'express';
import cors from 'cors';
import https from 'https';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const app = express();
const port = process.env.PORT || 3000;

// --- Configuration pour Render ---
// Render monte le disque persistant sur '/var/data'
const DATA_DIR = process.env.RENDER_DISK_MOUNT_PATH || './data';
const DB_PATH = path.join(DATA_DIR, 'db.json');

// Créer le dossier data s'il n'existe pas
await fs.mkdir(DATA_DIR, { recursive: true }).catch(err => console.log('Dossier data existe déjà'));

// --- Initialisation base de données ---
let allVideos = [];

const initDb = async () => {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    allVideos = JSON.parse(data);
    console.log(`✅ Base de données chargée: ${allVideos.length} vidéos trouvées`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('📝 Création d\'une nouvelle base de données...');
      await fs.writeFile(DB_PATH, JSON.stringify([], null, 2), 'utf-8');
      allVideos = [];
    } else {
      console.error('❌ Erreur DB:', err.message);
    }
  }
};

// Sauvegarder la base de données
const saveDb = async () => {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(allVideos, null, 2), 'utf-8');
    console.log('💾 Base de données sauvegardée');
  } catch (err) {
    console.error('❌ Erreur sauvegarde:', err.message);
  }
};

// --- Configuration Express ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Sers les fichiers HTML/CSS/JS

// --- Variables d'environnement ---
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ===============================================
// ROUTES API
// ===============================================

// 1️⃣ Obtenir toutes les vidéos
app.get('/api/videos', (req, res) => {
  const sortedVideos = [...allVideos].sort((a, b) => 
    new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0)
  );
  res.json(sortedVideos);
});

// 2️⃣ Ajouter une nouvelle vidéo
app.post('/api/add-video', async (req, res) => {
  try {
    const { videoUrl, adminAnnotation } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ message: 'URL vidéo requise' });
    }

    // Extraire l'ID YouTube
    let videoId = null;
    try {
      const url = new URL(videoUrl);
      if (url.hostname === 'youtu.be') {
        videoId = url.pathname.slice(1);
      } else if (url.hostname.includes('youtube.com')) {
        videoId = url.searchParams.get('v');
      }
    } catch (error) {
      return res.status(400).json({ message: 'URL YouTube invalide' });
    }

    if (!videoId) {
      return res.status(400).json({ message: 'ID vidéo non trouvé' });
    }

    // Initialiser les données de la vidéo
    let videoData = {
      title: 'Titre en attente...',
      uploader: 'Canal inconnu',
      keywords: ['youtube'],
      summary: 'En attente de récupération des données...',
      viewCount: 0
    };

    // Récupérer les données YouTube si clé API disponible
    if (YOUTUBE_API_KEY) {
      try {
        const ytApiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${YOUTUBE_API_KEY}`;
        const response = await axios.get(ytApiUrl);
        
        if (response.data.items && response.data.items.length > 0) {
          const item = response.data.items[0];
          videoData.title = item.snippet.title;
          videoData.uploader = item.snippet.channelTitle;
          videoData.viewCount = parseInt(item.statistics.viewCount || 0, 10);
          videoData.keywords = item.snippet.tags || ['youtube'];
        }
      } catch (error) {
        console.error('⚠️ Erreur API YouTube:', error.message);
      }
    }

    // Créer l'objet vidéo
    const newVideo = {
      id: 'vid_' + Date.now(),
      youtubevideoid: videoId,
      title: videoData.title,
      uploader: videoData.uploader,
      keywords: videoData.keywords,
      summary: videoData.summary,
      adminannotation: adminAnnotation || '',
      viewcount: videoData.viewCount,
      dateAdded: new Date().toISOString()
    };

    // Ajouter à la base de données
    allVideos.unshift(newVideo);
    await saveDb();

    res.status(201).json(newVideo);
  } catch (error) {
    console.error('❌ Erreur add-video:', error.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// 3️⃣ Supprimer une vidéo
app.delete('/api/video/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    allVideos = allVideos.filter(v => v.id !== videoId);
    await saveDb();
    res.json({ message: 'Vidéo supprimée' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur suppression' });
  }
});

// 4️⃣ Mettre à jour l'annotation admin
app.put('/api/video/:id/annotation', async (req, res) => {
  try {
    const videoId = req.params.id;
    const { annotation } = req.body;
    
    const video = allVideos.find(v => v.id === videoId);
    if (!video) {
      return res.status(404).json({ message: 'Vidéo non trouvée' });
    }
    
    video.adminannotation = annotation || '';
    await saveDb();
    res.json(video);
  } catch (error) {
    res.status(500).json({ message: 'Erreur mise à jour' });
  }
});

// 5️⃣ Proxy pour les miniatures YouTube
app.get('/api/thumbnail', (req, res) => {
  const videoId = req.query.v;
  if (!videoId) {
    return res.status(400).send('ID vidéo manquant');
  }
  
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  https.get(thumbnailUrl, (proxyRes) => {
    proxyRes.pipe(res, { end: true });
  }).on('error', () => {
    res.status(500).send('Erreur proxy miniature');
  });
});

// 6️⃣ Servir la page principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Démarrage du serveur ---
await initDb();
app.listen(port, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
  console.log(`📊 Base de données: ${DB_PATH}`);
});
