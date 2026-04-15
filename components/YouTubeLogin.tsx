import React from 'react';
import { GoogleIcon } from './Icons';

interface YouTubeLoginProps {
  onLogin: () => void;
}

export function YouTubeLogin({ onLogin }: YouTubeLoginProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-2xl p-8 md:p-12 bg-white border border-neutral-200 shadow-xl">
      <h2 className="text-3xl font-bold mb-2 text-neutral-900">Connect Your YouTube Channel</h2>
      <p className="mb-6 max-w-md text-neutral-600">
        Sign in with your Google account to securely access your YouTube videos and let Gemini help you create amazing content.
      </p>
      <button
        onClick={onLogin}
        className="inline-flex items-center justify-center gap-3 bg-red-600 text-white font-semibold py-3 px-6 rounded-full transition-transform duration-200 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-lg"
      >
        <GoogleIcon />
        Sign in with Google
      </button>
      <p className="text-xs mt-4 text-neutral-500">
        This application requests permission to manage your YouTube videos.
      </p>
    </div>
  );
}
