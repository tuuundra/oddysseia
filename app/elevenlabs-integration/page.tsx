"use client";

import { Conversation } from './conversation';
import Link from 'next/link';
import { useState } from 'react';

// A styled back button component
const BackButton = () => {
  const [isHovering, setIsHovering] = useState(false);
  
  return (
    <Link 
      href="/"
      className="absolute top-8 left-8 z-50"
    >
      <div 
        className={`
          px-4 py-2 bg-transparent 
          border border-gray-400 
          ${isHovering ? 'text-white border-white' : 'text-gray-300'} 
          transition-all duration-300 rounded-md
          flex items-center gap-2
          ${isHovering ? 'shadow-glow-blue' : ''}
        `}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <span className="font-mono text-sm">BACK TO SCENE</span>
      </div>
    </Link>
  );
};

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-slate-900">
      <BackButton />
      
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm flex flex-col">
        <h1 className="text-4xl font-bold mb-2 text-center text-blue-300">
          ElevenLabs AI
        </h1>
        <p className="text-gray-400 mb-8">Talk to our AI assistant using your voice</p>
        
        <div className="bg-slate-800 p-8 rounded-lg shadow-lg w-full max-w-md border border-blue-900">
          <Conversation />
        </div>
        
        <div className="mt-10 text-gray-500 text-xs max-w-md text-center">
          <p>Using ElevenLabs&apos; API to enable voice conversations with an AI agent.</p>
          <p className="mt-2">Click &quot;Start Conversation&quot; and allow microphone access to begin.</p>
        </div>
      </div>
    </main>
  );
} 