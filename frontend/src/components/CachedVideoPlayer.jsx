import React, { useState, useEffect, useRef } from 'react';

export default function CachedVideoPlayer({ src, mimeType, variants = [], processingStatus = 'completed' }) {
  // Default to 480p or 'original' if 480p not available
  const initialQuality = variants.find(v => v.quality === '480p')?.quality || 'original';
  
  const [selectedQuality, setSelectedQuality] = useState(initialQuality);
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const videoRef = useRef(null);

  // Derive the target stream URL
  const baseSrc = `${src}?quality=${selectedQuality}`;

  function getToken() {
    try {
      const raw = localStorage.getItem('vedalaya_auth');
      if (!raw) return '';
      return JSON.parse(raw).token || '';
    } catch {
      return '';
    }
  }

  useEffect(() => {
    let isMounted = true;
    
    // Save current playback time to seamlessly resume
    const currentTime = videoRef.current ? videoRef.current.currentTime : 0;
    const isPlaying = videoRef.current && !videoRef.current.paused;

    async function loadVideo() {
      const token = getToken();
      const streamSrc = `${baseSrc}&token=${token}`;
      
      // Native streaming is significantly faster and more reliable than blob caching
      // Especially for Cloudinary redirects which may block CORS fetches or exceed memory limits
      if (isMounted) {
        setVideoUrl(streamSrc);
        setLoading(false);
      }
    }

    setLoading(true);
    setError(null);
    loadVideo();

    return () => {
      isMounted = false;
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [baseSrc, src, selectedQuality]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black/80 rounded-xl min-h-[50vh] sm:min-h-0 sm:aspect-video text-white shadow-2xl ring-1 ring-white/10 group">
      
      {loading ? (
        <div className="w-full h-full flex flex-col items-center justify-center z-10 absolute inset-0 bg-black/50 backdrop-blur-sm">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-slate-700 rounded-full animate-pulse"></div>
            <div className="w-16 h-16 border-4 border-t-emerald-500 rounded-full animate-spin absolute top-0 left-0"></div>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-emerald-500">DL</div>
          </div>
          <h3 className="text-xl font-bold tracking-widest text-emerald-300">CACHING QUALITY</h3>
          <p className="text-sm font-medium text-slate-400 mt-2 max-w-xs text-center leading-relaxed">
            Downloading {selectedQuality} for seamless offline viewing...
          </p>
        </div>
      ) : null}

      {error && (
        <div className="absolute top-2 right-2 bg-rose-600/90 text-white px-3 py-1.5 rounded text-xs font-semibold backdrop-blur-md z-10 shadow-lg animate-pulse">
          Offline Mode Unavailable
        </div>
      )}

      {/* Quality Settings Dropdown */}
      {variants.length > 1 && (
        <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-black/60 text-white hover:bg-emerald-600 transition-colors backdrop-blur-md group-hover:opacity-100 opacity-60"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
          {showSettings && (
            <div className="absolute top-10 right-0 mt-2 w-32 bg-slate-900/95 backdrop-blur-lg border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden py-1">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-400 tracking-widest uppercase border-b border-slate-800">Quality</div>
              <ul className="py-1">
                {variants.map(v => (
                  <li key={v.quality}>
                    <button 
                      onClick={() => {
                        setSelectedQuality(v.quality);
                        setShowSettings(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm font-semibold transition-colors ${selectedQuality === v.quality ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                    >
                      {v.quality === 'original' ? 'High' : v.quality}
                      {selectedQuality === v.quality && <span className="float-right text-emerald-400">✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          controls
          className="w-full h-full shadow-2xl outline-none ring-1 ring-white/10 sm:rounded-xl bg-black"
          style={{ aspectRatio: '16/9' }}
        >
          Your browser does not support video playback.
        </video>
      )}
    </div>
  );
}
