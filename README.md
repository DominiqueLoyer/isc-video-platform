# Plateforme de Diffusion Vidéo - Institut des Sciences Cognitives (ISC-UQAM)

[![Render](https://img.shields.io/badge/Deployed%20on-Render-46E3B7?logo=render)](https://isc-video-platform.onrender.com)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase)](https://supabase.com)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/Frontend-JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![TailwindCSS](https://img.shields.io/badge/CSS-TailwindCSS-06B6D4?logo=tailwindcss)](https://tailwindcss.com)

**Projet Client** - Institut des Sciences Cognitives, UQAM  
*Développé par Dominique S. Loyer*

> [!NOTE]
> **Version Février 2026**:
> - **YouTube Embed Optimisé**: Utilisation de `youtube-nocookie.com` pour éviter les redirections
> - **Filtres Thématiques**: Catégorisation par couleur des séminaires
> - **Résumés IA**: Intégration Gemini/Groq pour génération automatique
> - **Administration Sécurisée**: Interface admin avec authentification

---

## 📋 Présentation

Une **plateforme de diffusion vidéo** pour l'Institut des Sciences Cognitives de l'UQAM permettant :

- **Catalogue Vidéo**: Affichage des séminaires et conférences avec miniatures
- **Filtrage Avancé**: Par thématiques, mots-clés et recherche textuelle
- **Lecteur Intégré**: Vidéos YouTube en mode embed sans redirection
- **Administration**: Ajout, modification et suppression de vidéos
- **Métadonnées IA**: Résumés et mots-clés générés automatiquement

---

## 🚀 Accès Rapide

### 🌐 Plateforme en Production

**URL**: [https://isc-video-platform.onrender.com](https://isc-video-platform.onrender.com)

### 🔐 Accès Administrateur

1. Cliquez sur **"Accès Admin"** en haut à droite
2. Entrez le mot de passe administrateur
3. Les boutons "Modifier" et "Supprimer" apparaissent sur chaque vidéo

---

## 🛠️ Installation Locale

### Prérequis

- Node.js 18+ 
- Compte Supabase (base de données)
- Clés API (YouTube Data API v3, Gemini/Groq optionnel)

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/Isc-2025/isc-video-platform.git
cd isc-video-platform

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés

# Lancer le serveur
npm start
# Accéder à http://localhost:3000
```

### Variables d'Environnement

```bash
# Supabase (requis)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_SECRET=your_service_role_key

# YouTube Data API (optionnel - pour métadonnées automatiques)
YOUTUBE_API_KEY=your_youtube_api_key

# IA pour résumés (optionnel)
GROQ_API_KEY=your_groq_key
# ou
GEMINI_API_KEY=your_gemini_key

# Serveur
PORT=3000
```

---

## 📁 Structure du Projet

```
isc-video-platform/
├── README.md                    # Ce fichier
├── server.js                    # Backend Node.js/Express
├── package.json                 # Dépendances npm
├── .env.example                 # Template variables d'environnement
├── supabase.sql                 # Schéma de base de données
├── public/                      # Fichiers statiques
│   └── index.html               # ⭐ Application frontend
├── PLATEFORME_ISC/              # Anciennes versions et ressources
└── anciennes version plateformes/
```

---

## 📡 API REST

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/videos` | GET | Liste toutes les vidéos publiées |
| `/api/themes` | GET | Liste les thématiques disponibles |
| `/api/keywords` | GET | Liste tous les mots-clés |
| `/api/youtube-info/:id` | GET | Récupère métadonnées YouTube |
| `/api/generate-summary` | POST | Génère résumé IA (Gemini/Groq) |

### Exemple de Requête

```bash
curl https://isc-video-platform.onrender.com/api/videos
```

### Exemple de Réponse

```json
[
  {
    "id": "uuid-here",
    "youtubeVideoId": "VIDEO_ID",
    "title": "Séminaire DIC-ISC-CRIA - Conférencier",
    "uploader": "Institut des sciences cognitives - UQAM",
    "aiSummary": "Résumé généré par IA...",
    "keywords": ["IA", "Cognition", "Neurosciences"],
    "theme": { "id": "uuid", "name": "Intelligence Artificielle", "color": "#E74C3C" }
  }
]
```

---

## 🎨 Thématiques

Les vidéos sont catégorisées par thématiques avec des couleurs distinctives :

| Thématique | Couleur |
|------------|---------|
| Intelligence Artificielle | 🟣 Violet |
| Neurosciences | 🟢 Vert |
| Philosophie de l'esprit | 🔴 Rouge |
| Linguistique | 🟠 Orange |
| Psychologie Cognitive | 🔵 Bleu |
| Sciences Cognitives | 🟣 Indigo |
| Éthique & Société | 🌸 Rose |
| Autre | ⚫ Gris |

---

## 🗄️ Base de Données (Supabase)

### Tables Principales

- **`videos`**: Catalogue des vidéos avec métadonnées
- **`themes`**: Thématiques de classification
- **`admin_settings`**: Configuration admin (mot de passe hashé)

### Schéma SQL

Voir le fichier [`supabase.sql`](supabase.sql) pour le schéma complet avec :
- Row Level Security (RLS) activé
- Politiques de lecture publique
- Index pour performances

---

## 🔧 Configuration Render

Le projet est configuré pour déploiement automatique sur Render :

1. **Web Service**: Node.js
2. **Build Command**: `npm install`
3. **Start Command**: `npm start`
4. **Variables d'environnement**: Configurer dans le dashboard Render

---

## 📊 Technologies Utilisées

| Composant | Technologie |
|-----------|-------------|
| Frontend | HTML5, JavaScript ES6+, TailwindCSS |
| Backend | Node.js, Express.js |
| Base de données | Supabase (PostgreSQL) |
| Hébergement | Render.com |
| Vidéos | YouTube Embed API |
| IA (optionnel) | Gemini API / Groq API |

---

## 🔄 Historique des Versions

| Version | Date | Changements |
|---------|------|-------------|
| v2.1 | Fév 2026 | YouTube nocookie embed, filtres améliorés |
| v2.0 | Jan 2026 | Intégration Supabase, thématiques colorées |
| v1.0 | Nov 2025 | Version initiale avec backend Node.js |

---

## 👥 Contributeurs

- **Dominique S. Loyer** - Développeur principal
- **Institut des Sciences Cognitives** - Client

---

## 📜 Licence

MIT License - Voir [LICENSE](LICENSE) pour les détails.

---

## 🔗 Liens Utiles

- **Plateforme**: [https://isc-video-platform.onrender.com](https://isc-video-platform.onrender.com)
- **GitHub**: [https://github.com/Isc-2025/isc-video-platform](https://github.com/Isc-2025/isc-video-platform)
- **ISC-UQAM**: [https://isc.uqam.ca](https://isc.uqam.ca)
