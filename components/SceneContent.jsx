"use client";

import { useState } from 'react';
import { CameraScrollAnimation } from './SimpleScrollyControls';
import { CloudOverlay, ScrollPostEffects } from './ScrollEffects';
import dynamic from 'next/dynamic';
import OscillatingGrid from './OscillatingGrid';
import FracturedGLBRock from './FracturedGLBRock';
import { Html } from '@react-three/drei';

// Dynamically import Scene to prevent hydration errors
const Scene = dynamic(() => import('./Scene'), { ssr: false });

// The main scene content with scrollytelling effects
export default function SceneContent({ isVisible = true, isSpotlightActive = false, onTransitionTrigger }) {
  const [rockHovered, setRockHovered] = useState(false);
  
  const handleRockHover = () => {
    console.log("Rock hover detected");
    setRockHovered(true);
  };

  const handleRockBlur = () => {
    console.log("Rock hover ended");
    setRockHovered(false);
  };

  const handleRockClick = () => {
    console.log("Rock click detected in SceneContent");
    if (onTransitionTrigger) {
      console.log("Calling transition trigger from SceneContent");
      onTransitionTrigger();
    } else {
      console.error("onTransitionTrigger callback is not defined");
    }
  };

  return (
    <>
      {/* Camera animations controlled by scroll */}
      <CameraScrollAnimation>
        {/* The core scene content */}
        <Scene scrollytellingMode={true} onRockClick={handleRockClick} />
        
        {/* Cloud overlay that fades in with scroll */}
        <CloudOverlay />
        
        {/* Post-processing effects that respond to scroll */}
        <ScrollPostEffects />
        
        {/* Add the oscillating grid background that appears with scroll */}
        <OscillatingGrid />
      </CameraScrollAnimation>

      {/* Add the rock with hover and click detection */}
      <FracturedGLBRock 
        position={[0, -2.75, 1]} 
        appearThreshold={0.45}
        onHover={handleRockHover}
        onBlur={handleRockBlur}
        onRockClick={handleRockClick}
      />
      
      {/* Show "Click to explore" text when hovering over rock */}
      {rockHovered && (
        <Html
          position={[0, -1.7, 1]}
          center
          style={{
            color: 'white',
            fontSize: '18px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 300,
            letterSpacing: '0.15em',
            textShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
            pointerEvents: 'none',
            opacity: 0.8,
            transform: 'scale(1)',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          Click to explore
        </Html>
      )}
      
      {/* Animation keyframes */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 0.8; transform: scale(1); }
        }
      `}</style>
    </>
  );
} 