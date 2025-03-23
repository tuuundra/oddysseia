"use client";

import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import SimpleScrollySceneWrapper from './SimpleScrollySceneWrapper';
import { ScrollContext } from './SimpleScrollyControls';
import SceneContent from './SceneContent';
import ScrollPositionIndicator from './ScrollPositionIndicator';
import GradientScene from './GradientScene';
import MistTransition from './MistTransition';

// Container that provides scroll context to the 3D scene
export default function SceneContainer() {
  const [scrollData, setScrollData] = useState({ offset: 0 });
  const [isResetting, setIsResetting] = useState(false);
  
  // Window scroll handler
  useEffect(() => {
    // Track if we're in the process of resetting the scroll
    let resetInProgress = false;
    
    const handleScroll = () => {
      if (resetInProgress) return;
      
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPos = window.scrollY;
      let progress = Math.min(Math.max(scrollPos / scrollHeight, 0), 1);
      
      // Loop point - where we transition back to scene 1
      const loopPoint = 0.70;
      const loopTransitionDuration = 0.05;
      
      // If we've scrolled past the loop completion point
      if (progress > loopPoint + loopTransitionDuration && !isResetting) {
        // Mark that we're resetting to prevent additional scroll processing
        resetInProgress = true;
        setIsResetting(true);
        
        // Disable scroll temporarily
        document.body.style.overflow = 'hidden';
        
        // Small timeout to ensure the transition has visual time to complete
        setTimeout(() => {
          // Reset scroll position programmatically to just after the start
          window.scrollTo({ top: 1, behavior: 'auto' });
          
          // Re-enable scroll and reset flags after scrolling completes
          setTimeout(() => {
            document.body.style.overflow = '';
            resetInProgress = false;
            setIsResetting(false);
          }, 50);
        }, 100);
      }
      
      // Store both the raw progress and a normalized looped progress
      setScrollData({
        offset: progress,
        rawOffset: progress,
        isLooping: progress > loopPoint && progress <= loopPoint + loopTransitionDuration,
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
  }, [isResetting]);
  
  // First transition points (scene 1 to scene 2)
  const transitionStartPoint = 0.10;
  const transitionEndPoint = 0.15;
  const mistTransitionDuration = transitionEndPoint - transitionStartPoint;
  
  // Second transition points (scene 2 back to scene 1)
  const loopTransitionStartPoint = 0.70;
  const loopTransitionEndPoint = 0.75;
  const loopMistTransitionDuration = loopTransitionEndPoint - loopTransitionStartPoint;
  
  // Calculate first transition progress (scene 1 to scene 2)
  const transitionProgress = (() => {
    if (scrollData.offset <= transitionStartPoint) return 0;
    if (scrollData.offset >= transitionEndPoint) return 1;
    
    // Linear interpolation between start and end points
    return (scrollData.offset - transitionStartPoint) / (transitionEndPoint - transitionStartPoint);
  })();
  
  // Calculate second transition progress (scene 2 back to scene 1)
  const loopTransitionProgress = (() => {
    if (scrollData.offset <= loopTransitionStartPoint) return 0;
    if (scrollData.offset >= loopTransitionEndPoint) return 1;
    
    // Linear interpolation between start and end points
    return (scrollData.offset - loopTransitionStartPoint) / (loopTransitionEndPoint - loopTransitionStartPoint);
  })();
  
  // Calculate opacity for both scenes to handle both transitions
  const originalSceneOpacity = (() => {
    // Initial scene 1 visibility
    if (scrollData.offset < transitionStartPoint) return 1;
    
    // First transition (fade out scene 1)
    if (scrollData.offset >= transitionStartPoint && scrollData.offset <= transitionEndPoint) {
      return 1 - transitionProgress;
    }
    
    // Scene 1 hidden during middle section
    if (scrollData.offset > transitionEndPoint && scrollData.offset < loopTransitionStartPoint) {
      return 0;
    }
    
    // Second transition (fade in scene 1)
    if (scrollData.offset >= loopTransitionStartPoint && scrollData.offset <= loopTransitionEndPoint) {
      return loopTransitionProgress;
    }
    
    // Scene 1 fully visible after loop transition
    return 1;
  })();
  
  const gradientSceneOpacity = (() => {
    // Gradient scene initially hidden
    if (scrollData.offset < transitionStartPoint) return 0;
    
    // First transition (fade in gradient scene)
    if (scrollData.offset >= transitionStartPoint && scrollData.offset <= transitionEndPoint) {
      return transitionProgress;
    }
    
    // Gradient scene fully visible during middle section
    if (scrollData.offset > transitionEndPoint && scrollData.offset < loopTransitionStartPoint) {
      return 1;
    }
    
    // Second transition (fade out gradient scene)
    if (scrollData.offset >= loopTransitionStartPoint && scrollData.offset <= loopTransitionEndPoint) {
      return 1 - loopTransitionProgress;
    }
    
    // Gradient scene hidden after loop transition
    return 0;
  })();
  
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
        {/* Original scene canvas - fades out during first transition, fades in during second */}
        <div style={{ 
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: originalSceneOpacity,
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
        
        {/* Gradient scene canvas - fades in during first transition, fades out during second */}
        <div style={{ 
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: gradientSceneOpacity,
          transition: 'opacity 0.1s ease-out'
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

        {/* First transition layer (bottom to top) */}
        <div style={{ 
          position: 'absolute',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: scrollData.offset >= transitionStartPoint - 0.01 && scrollData.offset <= transitionEndPoint + 0.01 ? 1 : 0,
          transition: 'opacity 0.15s ease'
        }}>
          <Canvas
            style={{ width: '100%', height: '100%' }}
            camera={{ position: [0, 0, 10], fov: 45 }}
            gl={{ antialias: true, alpha: true, stencil: false, depth: true, powerPreference: 'high-performance' }}
            dpr={[1, 2]}
          >
            <SimpleScrollySceneWrapper>
              <MistTransition 
                transitionPoint={transitionStartPoint} 
                duration={mistTransitionDuration}
                direction="up"
              />
            </SimpleScrollySceneWrapper>
          </Canvas>
        </div>
        
        {/* Second transition layer (top to bottom) - for the loop back */}
        <div style={{ 
          position: 'absolute',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: scrollData.offset >= loopTransitionStartPoint - 0.01 && scrollData.offset <= loopTransitionEndPoint + 0.01 ? 1 : 0,
          transition: 'opacity 0.15s ease'
        }}>
          <Canvas
            style={{ width: '100%', height: '100%' }}
            camera={{ position: [0, 0, 10], fov: 45 }}
            gl={{ antialias: true, alpha: true, stencil: false, depth: true, powerPreference: 'high-performance' }}
            dpr={[1, 2]}
          >
            <SimpleScrollySceneWrapper>
              <MistTransition 
                transitionPoint={loopTransitionStartPoint} 
                duration={loopMistTransitionDuration}
                direction="down"
              />
            </SimpleScrollySceneWrapper>
          </Canvas>
        </div>
        
        {/* Scroll position indicator for development */}
        <ScrollPositionIndicator />
      </ScrollContext.Provider>
    </div>
  );
} 