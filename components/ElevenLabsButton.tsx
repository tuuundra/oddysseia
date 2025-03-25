"use client";

import { useState } from 'react';
import Link from 'next/link';

const ElevenLabsButton = () => {
  const [isHovering, setIsHovering] = useState(false);
  
  return (
    <Link 
      href="/elevenlabs-integration"
      className="pointer-events-auto"
    >
      <div 
        className="flex flex-col items-center justify-center"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className={`
          relative px-5 py-3 bg-transparent 
          border border-blue-400 
          ${isHovering ? 'text-white border-white' : 'text-blue-300'} 
          transition-all duration-300 rounded-md
          ${isHovering ? 'shadow-glow-blue' : ''}
        `}>
          <span className="font-mono text-sm tracking-wide">
            TALK TO AGENT
          </span>
          {isHovering && (
            <div className="absolute inset-0 bg-blue-900 bg-opacity-20 blur-sm -z-10"></div>
          )}
        </div>
        
        <div className="mt-2 font-mono text-xs text-gray-400">
          
        </div>
      </div>
    </Link>
  );
};

export default ElevenLabsButton; 