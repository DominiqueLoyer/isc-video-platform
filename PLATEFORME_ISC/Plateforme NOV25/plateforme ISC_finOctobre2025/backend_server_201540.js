/*
* =================================================================
* LE SERVEUR BACKEND (LE "MOTEUR")
* Fichier: backend_server.js
* =================================================================
* Ce script est le "moteur" qui tournera sur Render.
* Il attend les requêtes du frontend (votre index.html).
* Quand il reçoit une URL, il la traite (simulation)
* et renvoie le résumé et les mots-clés.
* =================================================================
*/

// --- Importation des modules nécessaires ---
// 'express' est le framework pour construire le serveur web
import express from 'express';
// 'cors' permet à votre frontend (sur github.io) de parler à ce backend (sur render.com)
import cors from 'cors';
// 'https' est nécessaire pour appeler l'API Gemini
import https from 'https';

// --- Initialisation du serveur ---
const app = express();
const port = process.env.PORT || 3000; // Render fournira sa propre variable PORT

// --- Configuration des "Middlewares" ---
// Active CORS pour toutes les requêtes (accepte les appels depuis n'importe quel domaine)
app.use(cors());
// Permet au serveur de comprendre le JSON envoyé par le frontend
app.use(express.json());

// --- Simulation de la base de données ---
// Dans un vrai projet, ces données seraient dans une base (Firestore, MongoDB, etc.)
// Ici, on les garde en mémoire pour la simulation.
let videoDatabase = [
    // Données d'exemple (celles de votre index.html)
    { 
        id: 'yt001', 
        youtubeVideoId: 'f-m4q_v2v2c',
        title: 'Où va l\'IA ? (Feu de Bengale)', 
        uploader: 'Feu de Bengale', 
        views: '215K', 
        aiSummary: 'Analyse approfondie de la trajectoire actuelle de l\'intelligence artificielle, de ses capacités émergentes (modèles de langage) aux risques sociétaux et existentiels. Discussion sur l\'alignement et la régulation.',
        keywords: ['IA', 'Modèles de Langage', 'Éthique', 'Alignement', 'Régulation'],
        adminAnnotation: 'Excellent point de départ pour le cours d\'introduction. Couvre bien les enjeux actuels de l\'IA générative.',
        transcription: 'L\'intelligence artificielle est à un tournant. Les modèles de langage comme GPT-4 montrent des capacités... (transcription simulée)...'
    },
    // ... (les autres vidéos d'exemple)
];

// --- Fonction d'appel à l'IA Gemini (Simulation) ---
// C'est ici que vous feriez le VRAI appel à yt-dlp et à l'API Gemini.
// Pour ce projet, nous simulons une réponse de l'IA.
async function getAiAnalysis(videoUrl, adminAnnotation) {
    console.log(`[Backend] Simulation de l'analyse IA pour: ${videoUrl}`);
    
    // 1. SIMULATION de yt-dlp (extraction d'infos)
    // Dans la vraie vie: execSync('yt-dlp --dump-json ' + videoUrl);
    const simulatedVideoInfo = {
        title: "Titre simulé depuis le backend",
        uploader: "Chaîne YouTube simulée",
        // ... autres infos
    };

    // 2. SIMULATION de la transcription (en français, comme demandé)
    const simulatedTranscription = `Ceci est une transcription simulée en français. Le conférencier parle de l'importance des sciences cognitives et de la manière dont les modèles d'IA peuvent nous aider à comprendre l'esprit humain. Il mentionne également les défis éthiques.`;

    // 3. SIMULATION de l'appel à l'API Gemini (Req #2, #3)
    // C'est ici que vous enverriez `simulatedTranscription` à l'API.
    // L'API Gemini vous renverrait un objet JSON comme celui-ci :
    const simulatedGeminiResponse = {
        summary: "Le conférencier discute de l'intersection entre les sciences cognitives et l'IA, en soulignant à la fois le potentiel de compréhension de l'esprit et les défis éthiques associés.",
        keywords: ["IA", "Sciences Cognitives", "Esprit Humain", "Éthique", "Modèles"]
    };

    // Simule un délai réseau (pour que le loader s'affiche)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 4. Retourne l'objet vidéo complet
    return {
        id: 'temp_' + Date.now(),
        youtubeVideoId: getYouTubeVideoId(videoUrl) || 'dQw4w9WgXcQ', // Fallback
        title: simulatedVideoInfo.title,
        uploader: simulatedVideoInfo.uploader,
        views: "0",
        aiSummary: simulatedGeminiResponse.summary,
        keywords: simulatedGeminiResponse.keywords,
        adminAnnotation: adminAnnotation, // On sauvegarde l'annotation de l'admin
        transcription: simulatedTranscription
    };
}

// Fonction utilitaire (copiée de votre HTML)
function getYouTubeVideoId(url) {
    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

// --- Définition des "Routes" API ---

// Route 1: (GET /api/videos) - Récupérer toutes les vidéos
// (Non utilisé dans votre HTML actuel, mais c'est une bonne pratique)
app.get('/api/videos', (req, res) => {
    console.log("[Backend] Requête GET reçue pour /api/videos");
    res.json(videoDatabase);
});

// Route 2: (POST /api/add-video) - Ajouter et analyser une nouvelle vidéo
// C'est la route la plus importante, appelée par votre bouton "Récupérer et Analyser"
app.post('/api/add-video', async (req, res) => {
    const { videoUrl, adminAnnotation } = req.body;
    console.log(`[Backend] Requête POST reçue pour /api/add-video avec URL: ${videoUrl}`);

    if (!videoUrl) {
        return res.status(400).json({ error: 'URL de la vidéo manquante' });
    }

    try {
        // Appelle la fonction (simulée) de traitement
        const newVideoData = await getAiAnalysis(videoUrl, adminAnnotation);
        
        // Ajoute la nouvelle vidéo à notre "base de données" en mémoire
        // (Dans un vrai projet, vous feriez un INSERT SQL ou NoSQL ici)
        // videoDatabase.unshift(newVideoData); // Note: le frontend gère l'ajout
        
        console.log("[Backend] Analyse IA terminée. Envoi de la réponse.");
        // Renvoie les données traitées au frontend
        res.status(201).json(newVideoData);

    } catch (error) {
        console.error("[Backend] Erreur durant l'analyse:", error);
        res.status(500).json({ error: "Erreur lors de l'analyse de la vidéo" });
    }
});

// Route 3: (GET /) - Route de "santé"
// Permet de vérifier que le serveur est bien en ligne
app.get('/', (req, res) => {
    res.send('Serveur Backend ISC - En ligne et opérationnel!');
});

// --- Démarrage du serveur ---
app.listen(port, () => {
    console.log(`[Backend] Serveur démarré sur http://localhost:${port}`);
    console.log('Ce serveur est le "moteur" (backend).');
    console.log('Le fichier index.html est la "vitrine" (frontend).');
});

