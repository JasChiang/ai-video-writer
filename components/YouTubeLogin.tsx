import React from 'react';
import { GoogleIcon } from './Icons';

interface YouTubeLoginProps {
  onLogin: () => void;
}

export function YouTubeLogin({ onLogin }: YouTubeLoginProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-2xl p-8 md:p-12 shadow-2xl backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #00B4D8' }}>
      <h2 className="text-3xl font-bold mb-2" style={{ color: '#03045E' }}>Connect Your YouTube Channel</h2>
      <p className="mb-6 max-w-md" style={{ color: '#0077B6' }}>
        Sign in with your Google account to securely access your YouTube videos and let Gemini help you create amazing content.
      </p>
      <button
        onClick={onLogin}
        className="inline-flex items-center justify-center gap-3 bg-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:opacity-90"
        style={{ color: '#03045E', border: '2px solid #0077B6' }}
      >
        <GoogleIcon />
        Sign in with Google
      </button>
       <p className="text-xs mt-4" style={{ color: '#00B4D8' }}>
        This application requests permission to manage your YouTube videos.
      </p>
    </div>
  );
}
