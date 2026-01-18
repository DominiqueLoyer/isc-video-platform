import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DBPATH = path.join(__dirname, 'db.json');

let allVideos = [];

async function initDb() {
  try {
    const data = await fs.readFile(DBPATH, 'utf-8');
    allVideos = JSON.parse(data);
    console.log('Database loaded: ' + allVideos.length + ' videos');
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('Creating new database...');
      allVideos = [];
      await saveDb();
    } else {
      console.error('Database error:', err.message);
    }
  }
}

async function saveDb() {
  try {
    await fs.writeFile(DBPATH, JSON.stringify(allVideos, null, 2));
    console.log('Database saved');
  } catch (err) {
    console.error('Save error:', err.message);
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/videos', (req, res) => {
  res.json(allVideos);
});

app.post('/api/add-video', async (req, res) => {
  const { youtubeUrl, adminAnnotation } = req.body;

  if (!youtubeUrl) {
    return res.status(400).json({ error: 'URL required' });
  }

  try {
    console.log('Adding video: ' + youtubeUrl);

    let videoId = null;
    
    if (youtubeUrl.includes('youtube.com/watch?v=')) {
      videoId = new URL(youtubeUrl).searchParams.get('v');
    } else if (youtubeUrl.includes('youtu.be/')) {
      videoId = youtubeUrl.split('youtu.be/')[1].split('?')[0];
    }

    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const newVideo = {
      id: Date.now().toString(),
      youtubeVideoId: videoId,
      title: 'Video imported',
      uploader: 'Unknown',
      thumbnail: 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg',
      views: 0,
      keywords: ['video'],
      aiSummary: 'Pending analysis...',
      adminAnnotation: adminAnnotation || '',
      addedAt: new Date().toISOString(),
    };

    allVideos.unshift(newVideo);
    await saveDb();

    console.log('Video added successfully');
    res.status(201).json({ success: true, video: newVideo });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/videos/:id', async (req, res) => {
  const { id } = req.params;
  allVideos = allVideos.filter((v) => v.id !== id);
  await saveDb();
  res.json({ success: true });
});

app.get('/api/search', (req, res) => {
  const query = req.query.q?.toLowerCase() || '';
  const results = allVideos.filter(
    (v) =>
      v.title.toLowerCase().includes(query) ||
      v.aiSummary.toLowerCase().includes(query) ||
      (Array.isArray(v.keywords) && 
       v.keywords.some((k) => k.toLowerCase().includes(query)))
  );
  res.json(results);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', videos: allVideos.length });
});

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      const altPath = path.join(__dirname, 'index.html');
      res.sendFile(altPath);
    }
  });
});

async function start() {
  await initDb();
  app.listen(port, () => {
    console.log('Server running on port ' + port);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
```