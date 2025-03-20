"use client";

import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import SimpleScrollySceneWrapper from './SimpleScrollySceneWrapper';
import { ScrollContext } from './SimpleScrollyControls';
import SceneContent from './SceneContent';
import ScrollPositionIndicator from './ScrollPositionIndicator';
import GradientScene from './GradientScene';

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
  
  // Scene transition points
  const transitionStartPoint = 0.155;
  const transitionEndPoint = 0.165;
  
  // Calculate transition progress
  const transitionProgress = (() => {
    if (scrollData.offset <= transitionStartPoint) return 0;
    if (scrollData.offset >= transitionEndPoint) return 1;
    
    // Linear interpolation between start and end points
    return (scrollData.offset - transitionStartPoint) / (transitionEndPoint - transitionStartPoint);
  })();
  
  // Calculate opacity for each scene
  const originalSceneOpacity = 1 - transitionProgress;
  const gradientSceneOpacity = transitionProgress;
  
  // Determine if scenes should be in the DOM
  const showOriginalScene = originalSceneOpacity > 0;
  const showGradientScene = gradientSceneOpacity > 0;
  
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
        {/* Original scene canvas with fade out transition */}
        <div style={{ 
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: originalSceneOpacity,
          visibility: showOriginalScene ? 'visible' : 'hidden',
          transition: 'opacity 0.1s ease-out'
        }}>
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
            {/* Wrap original scene content with scroll context */}
            <SimpleScrollySceneWrapper>
              {/* The complete original scene with all its original effects */}
              <SceneContent />
            </SimpleScrollySceneWrapper>
          </Canvas>
        </div>
        
        {/* Gradient scene canvas with fade in transition */}
        <div style={{ 
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: gradientSceneOpacity,
          visibility: showGradientScene ? 'visible' : 'hidden',
          transition: 'opacity 0.1s ease-in'
        }}>
          <Canvas
            style={{ width: '100%', height: '100%' }}
            camera={{ 
              position: [0, 0, 10], 
              fov: 45
            }}
            gl={{ 
              antialias: true,
              alpha: true,
              stencil: false,
              depth: true,
              powerPreference: 'high-performance' 
            }}
            dpr={[1, 2]}
          >
            {/* The gradient scene */}
            <SimpleScrollySceneWrapper>
              <GradientScene />
            </SimpleScrollySceneWrapper>
          </Canvas>
        </div>
        
        {/* Scroll position indicator for development */}
        <ScrollPositionIndicator />
      </ScrollContext.Provider>
    </div>
  );
} 