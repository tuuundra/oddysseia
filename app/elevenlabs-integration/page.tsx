"use client";

import { useState } from 'react';
import Link from 'next/link';
import SimpleVolumeIndicator from './SimpleVolumeIndicator';
import DirectVolumeIndicator from './DirectVolumeIndicator';

// A styled back button component
function BackButton() {
  return (
    <div className="z-10 w-full max-w-5xl">
      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
        ← Back to home
      </Link>
    </div>
  );
}

// Basic diagnostic component
function ConversationDiagnostic() {
  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h3 className="text-lg font-medium mb-2">Conversation Object Diagnostics</h3>
      <p className="text-gray-400">This is a placeholder for conversation diagnostics</p>
    </div>
  );
}

// Main conversation component from ElevenLabs React SDK
function Conversation() {
  const [started, setStarted] = useState(false);
  
  return (
    <div className="w-full">
      {!started ? (
        <button 
          onClick={() => setStarted(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors"
        >
          Start Conversation
        </button>
      ) : (
        <div className="p-4 bg-slate-700 rounded-lg min-h-[300px] flex items-center justify-center">
          {/* ElevenLabs conversation component would go here */}
          <p className="text-gray-400">Conversation interface placeholder</p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex flex-col items-center p-24 gap-10">
      <BackButton />
      
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-2xl font-bold mb-4">ElevenLabs Integration</h1>
        <Conversation />
      </div>

      <div className="border-t border-gray-300 pt-10 w-full max-w-5xl">
        <h2 className="text-xl font-bold mb-4">Audio Diagnostics</h2>
        
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <ConversationDiagnostic />
        </div>
        
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <SimpleVolumeIndicator />
        </div>
        
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Direct Audio Stream Visualization (new)</h2>
          <DirectVolumeIndicator />
        </div>
      </div>
    </main>
  )
} 