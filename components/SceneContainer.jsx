"use client";

import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import SimpleScrollySceneWrapper from './SimpleScrollySceneWrapper';
import { ScrollContext } from './SimpleScrollyControls';
import SceneContent from './SceneContent';

// Container that provides scroll context to the 3D scene
export default function SceneContainer() {
  const [scrollData, setScrollData] = useState({ offset: 0 });
  
  // Window scroll handler
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPos = window.scrollY;
      const progress = Math.min(Math.max(scrollPos / scrollHeight, 0), 1);
      
      setScrollData({
        offset: progress,
        scroll: {
          current: scrollPos,
          max: scrollHeight
        }
      });
    };
    
    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial calculation
    handleScroll();
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  return (
    <div style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 1
    }}>
      {/* Provide scroll data via context */}
      <ScrollContext.Provider value={scrollData}>
        {/* Single Canvas instance */}
        <Canvas
          style={{ width: '100%', height: '100%' }}
          camera={{ 
            position: [32.19, -1.37, -31.22], 
            fov: 45,
            rotation: [0, Math.PI * 0.75, 0] // Rotate 45 degrees to the left (π/4)
          }}
          gl={{ 
            antialias: true,
            alpha: true,
            stencil: false,
            depth: true,
            powerPreference: 'high-performance' 
          }}
          shadows
          dpr={[1, 2]}
        >
          {/* Wrap scene content with scroll context */}
          <SimpleScrollySceneWrapper>
            {/* The complete scene with all effects */}
            <SceneContent />
          </SimpleScrollySceneWrapper>
        </Canvas>
      </ScrollContext.Provider>
    </div>
  );
} 