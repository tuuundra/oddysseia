"use client";

import { CameraScrollAnimation } from './SimpleScrollyControls';
import { CloudOverlay, ScrollPostEffects } from './ScrollEffects';
import dynamic from 'next/dynamic';
import OscillatingGrid from './OscillatingGrid';

// Dynamically import Scene to prevent hydration errors
const Scene = dynamic(() => import('./Scene'), { ssr: false });

// The main scene content with scrollytelling effects
export default function SceneContent() {
  return (
    <>
      {/* Camera animations controlled by scroll */}
      <CameraScrollAnimation>
        {/* The core scene content */}
        <Scene scrollytellingMode={true} />
        
        {/* Cloud overlay that fades in with scroll */}
        <CloudOverlay />
        
        {/* Post-processing effects that respond to scroll */}
        <ScrollPostEffects />
        
        {/* Add the oscillating grid background that appears with scroll - MUST BE LAST */}
        <OscillatingGrid />
      </CameraScrollAnimation>
    </>
  );
} 