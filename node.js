const express = require('express');
const ytdl = require('yt-dlp-exec');
const cors = require('cors');
const app = express();

app.use(cors());

// Get transcript for a single video
app.get('/transcript', async (req, res) => {
    try {
        const videoId = req.query.video_id;
        if (!videoId) {
            return res.status(400).json({ error: 'Missing video_id parameter' });
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        // Get available subtitles
        const subtitles = await ytdl(url, {
            dumpSingleJson: true,
            skipDownload: true,
            noWarnings: true,
            preferFreeFormats: true,
        }).then(data => data.subtitles || data.automatic_captions);
        
        // Try to get English subtitles first
        let transcript = subtitles?.en || subtitles?.['en-US'] || subtitles?.['en-GB'];
        
        if (!transcript || transcript.length === 0) {
            // If no English, try any available language
            const firstLang = Object.keys(subtitles || {})[0];
            transcript = firstLang ? subtitles[firstLang] : null;
        }
        
        if (!transcript) {
            return res.status(404).json({ error: 'No captions available for this video' });
        }
        
        res.json({ transcript });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get playlist information
app.get('/playlist', async (req, res) => {
    try {
        const playlistId = req.query.playlist_id;
        if (!playlistId) {
            return res.status(400).json({ error: 'Missing playlist_id parameter' });
        }

        const url = `https://www.youtube.com/playlist?list=${playlistId}`;
        
        // Get playlist info
        const playlistInfo = await ytdl(url, {
            dumpSingleJson: true,
            skipDownload: true,
            noWarnings: true,
            flatPlaylist: false,
        });
        
        if (!playlistInfo.entries || playlistInfo.entries.length === 0) {
            return res.status(404).json({ error: 'No videos found in this playlist' });
        }
        
        // For each video in the playlist, get its transcript
        const videos = [];
        for (const entry of playlistInfo.entries) {
            try {
                const videoUrl = `https://www.youtube.com/watch?v=${entry.id}`;
                const subtitles = await ytdl(videoUrl, {
                    dumpSingleJson: true,
                    skipDownload: true,
                    noWarnings: true,
                    preferFreeFormats: true,
                }).then(data => data.subtitles || data.automatic_captions);
                
                let transcript = subtitles?.en || subtitles?.['en-US'] || subtitles?.['en-GB'];
                
                if (!transcript || transcript.length === 0) {
                    const firstLang = Object.keys(subtitles || {})[0];
                    transcript = firstLang ? subtitles[firstLang] : null;
                }
                
                videos.push({
                    id: entry.id,
                    title: entry.title,
                    url: videoUrl,
                    transcript: transcript || []
                });
            } catch (error) {
                console.error(`Error processing video ${entry.id}:`, error);
                videos.push({
                    id: entry.id,
                    title: entry.title,
                    url: `https://www.youtube.com/watch?v=${entry.id}`,
                    transcript: [],
                    error: error.message
                });
            }
        }
        
        res.json({ videos });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2", // Downgraded from 5.x to stable 4.x version
    "yt-dlp-exec": "^1.0.2"
  },
// ... existing code ...
    // We'll use a backend proxy to yt-dlp (you would need to implement this on your server)
    const BACKEND_API_URL = 'http://localhost:3000'; // Changed from placeholder URL to local server
// ... existing code ...
