/* backend_server.js - Plateforme vidéo ISC - Node.js avec AUTH admin, catégorisation, recherche, sauvegarde fichier (100% sans base PostgreSQL si non configuré)
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware config
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Config auth admin et clef API
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'isc2025';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

// Charge la BD locale ou crée une vide
function loadVideos() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveVideos(videos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(videos, null, 2));
}

let videos = loadVideos();

// Utilitaires pour traiter les requêtes
function isAdmin(req) {
  const headerPw = req.headers ? req.headers['x-admin-password'] : null;
  const bodyPw = req.body ? req.body.adminPassword : null;
  return (headerPw === ADMIN_PASSWORD || bodyPw === ADMIN_PASSWORD);
}

// API PUBLIQUE
app.get('/api/videos', (req, res) => {
  // tri par date ajout desc + possibilité de filtrer plus tard côté client
  res.json(videos.sort((a,b) => new Date(b.dateAdded)-new Date(a.dateAdded)));
});

app.get('/api/themes', (req, res) => {
  const uniqueThemes = [...new Set(videos.map(v => v.theme || 'Autre'))];
  res.json({ themes: uniqueThemes });
});

app.get('/api/thumbnail', (req,res) => {
  const vid = req.query.v;
  res.redirect(`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`);
});

// API ADMIN
app.post('/api/add-video', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({message:'Mot de passe admin requis.'});
  const { videoUrl, adminAnnotation, theme } = req.body;
  let videoId = null;

  try {
    const url = new URL(videoUrl);
    if (url.hostname === 'youtu.be') videoId = url.pathname.substring(1);
    else if (url.hostname.includes('youtube.com')) videoId = url.searchParams.get('v');
  } catch {
    return res.status(400).json({message:'URL YouTube invalide'});
  }

  if (!videoId) return res.status(400).json({message:'Impossible de trouver ID vidéo'});
  if (videos.find(v=>v.youtubevideoid === videoId)) return res.status(400).json({message:'Vidéo déjà enregistrée'});

  (async()=>{
    // Essai métadonnées Google (si clef présente)
    let meta = {
      title:'Vidéo YouTube', uploader:'?', keywords:[], description:'', viewCount:0, duration:'', uploadedAt:'', thumbnail:''
    };
    if (YOUTUBE_API_KEY) {
      try {
        const apiurl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics,contentDetails&key=${YOUTUBE_API_KEY}`;
        const {data} = await axios.get(apiurl);
        if(data.items && data.items.length>0) {
          const item = data.items[0];
          meta = {
            title:item.snippet.title,
            uploader:item.snippet.channelTitle,
            keywords:item.snippet.tags||[],
            description:item.snippet.description||'',
            viewCount:parseInt(item.statistics.viewCount||0),
            duration:item.contentDetails.duration||'',
            uploadedAt:item.snippet.publishedAt||'',
            thumbnail:item.snippet.thumbnails.high.url||''
          };
        }
      } catch {}
    }

    const newVid = {
      id: 'vid_' + Date.now(),
      youtubevideoid: videoId,
      title: meta.title,
      uploader: meta.uploader,
      keywords: meta.keywords,
      description: meta.description,
      viewcount: meta.viewCount,
      duration: meta.duration,
      uploadedAt: meta.uploadedAt,
      thumbnail: meta.thumbnail,
      adminannotation: adminAnnotation || '',
      theme: theme || 'Autre',
      dateAdded: new Date().toISOString(),
      addedBy: 'admin'
    };
    videos.unshift(newVid);
    saveVideos(videos);
    res.status(201).json({message:'Vidéo ajoutée', video: newVid});
  })();
});

app.delete('/api/video/:id', (req,res)=>{
  if (!isAdmin(req)) return res.status(403).json({message:'Mot de passe admin requis.'});
  const idx = videos.findIndex(v=>v.id===req.params.id);
  if(idx<0) return res.status(404).json({message:'Vidéo non trouvée'});
  videos.splice(idx,1);
  saveVideos(videos);
  res.json({message:'Vidéo supprimée'});
});

app.put('/api/video/:id/annotation', (req,res)=>{
  if (!isAdmin(req)) return res.status(403).json({message:'Mot de passe admin requis.'});
  const v = videos.find(v=>v.id===req.params.id);
  if (!v) return res.status(404).json({message:'Non trouvé'});
  v.adminannotation = req.body.annotation||'';
  saveVideos(videos);
  res.json({message:'Annotation sauvegardée'});
});

app.post('/api/verify-admin', (req,res)=>{
  if(isAdmin(req)) res.json({authenticated:true});
  else res.json({authenticated:false});
});

app.get('/',(req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT,()=>{
  console.log('🎬 Plateforme vidéo ISC démarrée sur http://localhost:'+PORT);
});
