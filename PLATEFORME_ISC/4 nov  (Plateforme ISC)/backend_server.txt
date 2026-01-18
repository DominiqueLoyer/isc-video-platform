/*
* ===============================================
* SERVEUR BACKEND POUR LA PLATEFORME VIDÉO ISC
* VRAIE BASE DE DONNÉES (Fichier JSON persistant)
* ===============================================
*/

import express from 'express';
import cors from 'cors';
import https from 'https';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises'; // Importe le système de fichiers

const app = express();
const port = process.env.PORT || 3000;

// --- Chemin vers notre base de données JSON ---
// Render monte le disque persistant sur '/var/data'
// Nous allons y stocker notre base de données.
const DATA_DIR = process.env.RENDER_DISK_MOUNT_PATH || '.';
const DB_PATH = path.join(DATA_DIR, 'db.json');

// --- Initialisation de la base de données ---
let allVideos = []; // Cache en mémoire

const initDb = async () => {
    try {
        // Essaye de lire le fichier de la base de données
        const data = await fs.readFile(DB_PATH, 'utf-8');
        allVideos = JSON.parse(data);
        console.log(`Base de données chargée depuis ${DB_PATH}. ${allVideos.length} vidéos trouvées.`);
    } catch (err) {
        // Si le fichier n'existe pas (premier démarrage), on le crée
        if (err.code === 'ENOENT') {
            console.log("Base de données non trouvée. Création d'un nouveau fichier db.json...");
            await fs.writeFile(DB_PATH, JSON.stringify([]), 'utf-8');
            allVideos = [];
        } else {
            console.error("ERREUR lors de la lecture de la DB:", err.stack);
        }
    }
};

// --- Fonction pour sauvegarder la DB ---
const saveDb = async () => {
    try {
        await fs.writeFile(DB_PATH, JSON.stringify(allVideos, null, 2), 'utf-8');
        console.log(`Base de données sauvegardée sur ${DB_PATH}.`);
    } catch (err) {
        console.error("ERREUR lors de la sauvegarde de la DB:", err.stack);
    }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Sers le frontend

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ===============================================
// ROUTES DE L'API (Le "Moteur")
// ===============================================

// Route 1 : Obtenir toutes les vidéos
app.get('/api/videos', (req, res) => {
    // Renvoie simplement le cache en mémoire, trié
    const sortedVideos = [...allVideos].sort((a, b) => b.id.localeCompare(a.id));
    res.json(sortedVideos);
});

// Route 2 : Ajouter une nouvelle vidéo
app.post('/api/add-video', async (req, res) => {
    const { videoUrl, adminAnnotation } = req.body;
    
    let videoId = null;
    try {
        const url = new URL(videoUrl);
        if (url.hostname === 'youtu.be') videoId = url.pathname.slice(1);
        else if (url.hostname.includes('youtube.com')) videoId = url.searchParams.get('v');
    } catch (error) {
        return res.status(400).json({ message: "URL YouTube invalide." });
    }
    if (!videoId) return res.status(400).json({ message: "ID vidéo non trouvé." });

    // Simulation de l'analyse IA
    const simulatedData = {
        title: "Titre Simulé (en attente de l'API YT)",
        uploader: "Chaîne Simulée",
        keywords: ["Simulé", "IA", "Keyword 3", "Keyword 4", "Keyword 5"],
        summary: `Ceci est un résumé simulé généré par IA pour la vidéo ${videoId}.`,
        viewCount: 0
    };

    if (YOUTUBE_API_KEY) {
        try {
            const ytApiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${YOUTUBE_API_KEY}`;
            const response = await axios.get(ytApiUrl);
            const item = response.data.items[0];
            
            simulatedData.title = item.snippet.title;
            simulatedData.uploader = item.snippet.channelTitle;
            simulatedData.viewCount = parseInt(item.statistics.viewCount, 10);
        } catch (error) {
            console.error("Erreur API YouTube:", error.message);
        }
    }

    const newVideo = {
        id: 'vid_' + Date.now(), // ID unique basé sur le temps
        youtubevideoid: videoId,
        title: simulatedData.title,
        uploader: `${simulatedData.uploader} • ${simulatedData.viewCount ? (simulatedData.viewCount / 1000).toFixed(0) + 'K' : 'N/A'} vues`,
        keywords: simulatedData.keywords,
        summary: simulatedData.summary,
        adminannotation: adminAnnotation,
        viewcount: simulatedData.viewCount
    };

    // Sauvegarde dans la "DB" (le cache et le fichier)
    allVideos.unshift(newVideo); // Ajoute au cache
    await saveDb(); // Sauvegarde sur le disque
    
    res.status(201).json(newVideo); 
});

// Route 3 : Proxy pour les miniatures
app.get('/api/thumbnail', (req, res) => {
    const videoId = req.query.v;
    if (!videoId) return res.status(400).send('ID vidéo manquant');
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    https.get(thumbnailUrl, (proxyRes) => {
        proxyRes.pipe(res, { end: true });
    }).on('error', (e) => res.status(500).send('Erreur proxy'));
});

// Route 4 : Servir la "Vitrine" (index.html)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Démarrage du serveur ---
initDb().then(() => {
    app.listen(port, () => {
        console.log(`Serveur démarré sur http://localhost:${port}`);
    });
}).catch(err => {
    console.error("ÉCHEC du démarrage du serveur:", err);
});