"use client";

import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';

// Main loading screen component with pure CSS animations
const LoadingScreen = ({ progress = 0, isLoading = true }) => {
  const [localProgress, setLocalProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const containerRef = useRef();
  
  // Update local progress with a smooth animation
  useEffect(() => {
    if (!containerRef.current) return;
    
    gsap.to(containerRef.current, {
      opacity: isLoading ? 1 : 0,
      duration: 0.8,
      onComplete: () => {
        if (!isLoading) {
          setFadeOut(true);
        }
      }
    });
    
    // Animate progress bar
    gsap.to({ value: localProgress }, {
      value: progress,
      duration: 0.5,
      onUpdate: function() {
        setLocalProgress(this.targets()[0].value);
      }
    });
  }, [progress, isLoading, localProgress]);
  
  // Early return if component should be hidden
  if (fadeOut) return null;
  
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
      style={{
        opacity: isLoading ? 1 : 0,
        transition: 'opacity 0.8s ease'
      }}
    >
      {/* Pure CSS loading animation */}
      <div className="w-40 h-40 mb-8 relative">
        {/* Rotating outer circle */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            border: '2px solid rgba(100, 100, 100, 0.2)',
            borderTopColor: '#88ccff',
            animation: 'spin 2s linear infinite',
            boxShadow: '0 0 20px rgba(136, 204, 255, 0.3)'
          }}
        />
        
        {/* Inner circle with pulsing effect */}
        <div 
          className="absolute inset-4 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(25,25,25,1) 0%, rgba(10,10,10,1) 100%)',
            boxShadow: 'inset 0 0 15px rgba(0, 0, 0, 0.8)',
            animation: 'pulse 2s ease-in-out infinite alternate'
          }}
        >
          {/* Center logo */}
          <div 
            className="text-white text-2xl font-bold"
            style={{ 
              fontFamily: "var(--font-courier-prime), 'Courier', monospace",
              animation: 'glow 2s ease-in-out infinite alternate',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.7)'
            }}
          >
            O
          </div>
        </div>
        
        {/* Multiple small rotating particles */}
        {[...Array(8)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-2 h-2 rounded-full bg-cyan-500"
            style={{
              top: '50%',
              left: '50%',
              marginLeft: '-4px',
              marginTop: '-4px',
              transformOrigin: '50% 50%',
              animation: `orbit ${3 + i * 0.4}s linear infinite`,
              opacity: 0.7,
              transform: `rotate(${i * 45}deg) translateX(${60 + i * 5}px)`
            }}
          />
        ))}
      </div>
      
      {/* Loading text with glow effect */}
      <h2 
        className="text-2xl font-bold text-white mb-4"
        style={{ 
          fontFamily: "var(--font-courier-prime), 'Courier', monospace",
          letterSpacing: '0.1em',
          textShadow: '0 0 15px rgba(255, 255, 255, 0.7)',
          animation: 'textGlow 2s ease-in-out infinite alternate'
        }}
      >
        ODDYSSEIA
      </h2>
      
      {/* Progress bar */}
      <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className="h-full"
          style={{ 
            width: `${localProgress * 100}%`,
            transition: 'width 0.3s ease',
            background: 'linear-gradient(to right, #3498db, #2ecc71)'
          }}
        />
      </div>
      
      {/* Progress percentage */}
      <div 
        className="mt-2 text-xs text-white opacity-70"
        style={{ 
          fontFamily: "var(--font-courier-prime), 'Courier', monospace"
        }}
      >
        {Math.round(localProgress * 100)}%
      </div>
      
      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% { transform: scale(0.95); }
          100% { transform: scale(1.05); }
        }
        
        @keyframes glow {
          0% { opacity: 0.7; text-shadow: 0 0 5px rgba(255,255,255,0.5); }
          100% { opacity: 1; text-shadow: 0 0 20px rgba(255,255,255,0.9), 0 0 30px rgba(100,200,255,0.6); }
        }
        
        @keyframes textGlow {
          0% { text-shadow: 0 0 5px rgba(255,255,255,0.5); }
          100% { text-shadow: 0 0 15px rgba(255,255,255,0.9), 0 0 25px rgba(100,200,255,0.6); }
        }
        
        @keyframes orbit {
          0% { transform: rotate(0deg) translateX(60px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(60px) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen; 