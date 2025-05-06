document.addEventListener('DOMContentLoaded', function() {
    const fetchBtn = document.getElementById('fetch-btn');
    const downloadBtn = document.getElementById('download-btn');
    const copyBtn = document.getElementById('copy-btn');
    const saveAllBtn = document.getElementById('save-all-btn');
    const youtubeUrlInput = document.getElementById('youtube-url');
    const transcriptOutput = document.getElementById('transcript-output');
    const formatSelect = document.getElementById('format-select');
    const modeSelect = document.getElementById('mode-select');
    const statusMessage = document.getElementById('status-message');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    // We'll use a backend proxy to yt-dlp (you would need to implement this on your server)
    const BACKEND_API_URL = 'https://your-backend-api.com/transcript'; // Replace with your actual backend URL
    
    fetchBtn.addEventListener('click', fetchTranscript);
    downloadBtn.addEventListener('click', downloadTranscript);
    copyBtn.addEventListener('click', copyToClipboard);
    saveAllBtn.addEventListener('click', saveAllPlaylistTranscripts);
    
    async function fetchTranscript() {
        const youtubeUrl = youtubeUrlInput.value.trim();
        
        if (!youtubeUrl) {
            showStatus('Please enter a YouTube URL', 'error');
            return;
        }
        
        const isPlaylist = youtubeUrl.includes('list=') || youtubeUrl.includes('playlist');
        const processingMode = modeSelect.value;
        
        if (isPlaylist && processingMode === 'playlist') {
            await processPlaylist(youtubeUrl);
        } else {
            await processSingleVideo(youtubeUrl);
        }
    }
    
    async function processSingleVideo(url) {
        const videoId = extractVideoId(url);
        if (!videoId) {
            showStatus('Invalid YouTube URL', 'error');
            return;
        }
        
        try {
            showStatus('Fetching transcript...', 'info');
            fetchBtn.disabled = true;
            
            // Use our backend API to fetch transcripts
            const response = await fetch(`${BACKEND_API_URL}?video_id=${videoId}`);
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.transcript || data.transcript.length === 0) {
                throw new Error('No captions available for this video');
            }
            
            const format = formatSelect.value;
            const formattedTranscript = formatTranscript(data.transcript, format);
            
            transcriptOutput.value = formattedTranscript;
            downloadBtn.disabled = false;
            copyBtn.disabled = false;
            saveAllBtn.style.display = 'none';
            
            showStatus('Transcript fetched successfully!', 'success');
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            fetchBtn.disabled = false;
        }
    }
    
    async function processPlaylist(url) {
        const playlistId = extractPlaylistId(url);
        if (!playlistId) {
            showStatus('Invalid YouTube Playlist URL', 'error');
            return;
        }
        
        try {
            showStatus('Fetching playlist information...', 'info');
            fetchBtn.disabled = true;
            
            // First get the playlist information
            const playlistResponse = await fetch(`${BACKEND_API_URL}/playlist?playlist_id=${playlistId}`);
            
            if (!playlistResponse.ok) {
                throw new Error(`Server error: ${playlistResponse.status}`);
            }
            
            const playlistData = await playlistResponse.json();
            
            if (!playlistData.videos || playlistData.videos.length === 0) {
                throw new Error('No videos found in this playlist');
            }
            
            // Store the playlist data for later use
            window.currentPlaylist = {
                id: playlistId,
                videos: playlistData.videos,
                transcripts: []
            };
            
            // Show the first video's transcript by default
            if (playlistData.videos.length > 0) {
                const firstVideo = playlistData.videos[0];
                const format = formatSelect.value;
                const formattedTranscript = formatTranscript(firstVideo.transcript, format);
                transcriptOutput.value = formattedTranscript;
                
                // Enable download and copy for the first video
                downloadBtn.disabled = false;
                copyBtn.disabled = false;
                
                // Show the "Save All" button
                saveAllBtn.style.display = 'inline-block';
                saveAllBtn.disabled = false;
            }
            
            showStatus(`Playlist loaded with ${playlistData.videos.length} videos.`, 'success');
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            fetchBtn.disabled = false;
        }
    }
    
    async function saveAllPlaylistTranscripts() {
        if (!window.currentPlaylist || !window.currentPlaylist.videos) {
            showStatus('No playlist loaded', 'error');
            return;
        }
        
        try {
            saveAllBtn.disabled = true;
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
            
            const format = formatSelect.value;
            const zip = new JSZip();
            const playlistFolder = zip.folder(`playlist_${window.currentPlaylist.id}`);
            
            let processedCount = 0;
            const totalVideos = window.currentPlaylist.videos.length;
            
            for (const video of window.currentPlaylist.videos) {
                try {
                    // Update progress
                    processedCount++;
                    const progress = Math.round((processedCount / totalVideos) * 100);
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `Processing: ${processedCount}/${totalVideos} - ${video.title}`;
                    
                    // Format the transcript
                    const formattedTranscript = formatTranscript(video.transcript, format);
                    
                    // Add to ZIP
                    const extension = format === 'json' ? 'json' : format;
                    const filename = `${video.title.replace(/[^\w\s]/gi, '')}.${extension}`;
                    playlistFolder.file(filename, formattedTranscript);
                    
                    // Small delay to prevent UI freezing
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`Error processing video ${video.title}:`, error);
                }
            }
            
            // Generate the ZIP file
            const content = await zip.generateAsync({ type: 'blob' });
            
            // Download the ZIP
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `playlist_${window.currentPlaylist.id}_transcripts.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showStatus(`All ${totalVideos} transcripts saved successfully!`, 'success');
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            saveAllBtn.disabled = false;
            progressContainer.style.display = 'none';
        }
    }
    
    function extractVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
    
    function extractPlaylistId(url) {
        const regExp = /[&?]list=([^&]+)/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    }
    
    function formatTranscript(transcript, format) {
        if (!transcript) return '';
        
        switch (format) {
            case 'vtt':
                return convertToVTT(transcript);
            case 'srt':
                return convertToSRT(transcript);
            case 'json':
                return JSON.stringify(transcript, null, 2);
            default: // txt
                return convertToTXT(transcript);
        }
    }
    
    function convertToTXT(transcript) {
        if (Array.isArray(transcript)) {
            return transcript.map(entry => entry.text).join('\n\n');
        }
        return transcript;
    }
    
    function convertToVTT(transcript) {
        if (!Array.isArray(transcript)) return transcript;
        
        let vtt = "WEBVTT\n\n";
        transcript.forEach((entry, index) => {
            vtt += `${index + 1}\n`;
            vtt += `${formatTime(entry.start)} --> ${formatTime(entry.end)}\n`;
            vtt += `${entry.text}\n\n`;
        });
        return vtt;
    }
    
    function convertToSRT(transcript) {
        if (!Array.isArray(transcript)) return transcript;
        
        let srt = "";
        transcript.forEach((entry, index) => {
            srt += `${index + 1}\n`;
            srt += `${formatTime(entry.start, ',')} --> ${formatTime(entry.end, ',')}\n`;
            srt += `${entry.text}\n\n`;
        });
        return srt;
    }
    
    function formatTime(seconds, msSeparator = '.') {
        const date = new Date(0);
        date.setSeconds(seconds);
        const timeString = date.toISOString().substr(11, 12);
        return timeString.replace('.', msSeparator);
    }
    
    function downloadTranscript() {
        const format = formatSelect.value;
        const extension = format === 'json' ? 'json' : format;
        const content = transcriptOutput.value;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        let filename = 'transcript';
        if (window.currentPlaylist && window.currentPlaylist.videos) {
            // If we're in playlist mode, use the current video title
            const currentVideo = window.currentPlaylist.videos.find(v => v.transcript === transcriptOutput.value);
            if (currentVideo) {
                filename = currentVideo.title.replace(/[^\w\s]/gi, '');
            }
        }
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    function copyToClipboard() {
        transcriptOutput.select();
        document.execCommand('copy');
        showStatus('Copied to clipboard!', 'success');
    }
    
    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = 'status';
        if (type === 'success' || type === 'error' || type === 'info') {
            statusMessage.classList.add(type);
        }
    }
    
    // Dynamically load JSZip for ZIP functionality when needed
    function loadJSZip() {
        return new Promise((resolve, reject) => {
            if (typeof JSZip !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    // Preload JSZip when Save All button is hovered
    saveAllBtn.addEventListener('mouseover', () => {
        loadJSZip().catch(err => {
            console.error('Failed to load JSZip:', err);
        });
    });
});
