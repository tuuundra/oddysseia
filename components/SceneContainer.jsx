"use client";

import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import SimpleScrollySceneWrapper from './SimpleScrollySceneWrapper';
import { ScrollContext } from './SimpleScrollyControls';
import SceneContent from './SceneContent';
import ScrollPositionIndicator from './ScrollPositionIndicator';
import GradientScene from './GradientScene';
import MistTransition from './MistTransition';
import RockLineScene from './RockLineScene';

// Container that provides scroll context to the 3D scene
export default function SceneContainer() {
  const [scrollData, setScrollData] = useState({ offset: 0 });
  // Add state for scene transition
  const [showSecondScene, setShowSecondScene] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Function to handle transition trigger
  const handleTransitionTrigger = () => {
    console.log("%c 🚀 TRANSITION TRIGGERED! 🚀", "background: #4CAF50; color: white; font-size: 20px; padding: 10px;");
    
    // First set the transitioning state to show the overlay
    setIsTransitioning(true);
    
    // After a short delay, switch scenes
    setTimeout(() => {
      setShowSecondScene(true);
      console.log("%c ✨ SECOND SCENE ACTIVATED! ✨", "background: #2196F3; color: white; font-size: 20px; padding: 10px;");
      
      // After another short delay to ensure the new scene is ready, hide the overlay
      setTimeout(() => {
        setIsTransitioning(false);
      }, 500);
    }, 1000);
  };
  
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
  const transitionStartPoint = 0.10;
  const transitionEndPoint = 0.15;
  const mistTransitionDuration = transitionEndPoint - transitionStartPoint;
  
  // Calculate transition progress
  const transitionProgress = (() => {
    if (scrollData.offset <= transitionStartPoint) return 0;
    if (scrollData.offset >= transitionEndPoint) return 1;
    
    // Linear interpolation between start and end points
    return (scrollData.offset - transitionStartPoint) / (transitionEndPoint - transitionStartPoint);
  })();
  
  // Calculate opacity for both scenes to ensure smooth crossfade with mist effect
  const originalSceneOpacity = scrollData.offset < transitionStartPoint ? 1 : 
                              scrollData.offset > transitionEndPoint ? 0 : 
                              1 - transitionProgress;
                              
  const gradientSceneOpacity = scrollData.offset < transitionStartPoint ? 0 : 
                              scrollData.offset > transitionEndPoint ? 1 : 
                              transitionProgress;
  
  return (
    <>
      {/* Second scene - shown when transition is triggered */}
      {showSecondScene && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}>
          {/* Transition overlay - fades out when the scene is fully loaded */}
          {isTransitioning && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'black',
                zIndex: 9999,
                opacity: 1,
                transition: 'opacity 0.5s ease-out'
              }}
            />
          )}
          
          <Canvas
            style={{ width: '100%', height: '100%' }}
            camera={{ position: [0, 0, 6], fov: 45 }}
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
            <color attach="background" args={['#000000']} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <directionalLight position={[-5, 3, -5]} intensity={0.4} />
            <RockLineScene />
          </Canvas>
        </div>
      )}

      {/* Original scene - hidden when second scene is shown */}
      {!showSecondScene && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1
        }}>
          {/* Transition overlay - shows when transitioning */}
          {isTransitioning && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'black',
                zIndex: 9999,
                opacity: 0,
                animation: 'fadeIn 1s forwards'
              }}
            />
          )}
          
          {/* Add keyframes for fade animation */}
          <style jsx global>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
          
          {/* Provide scroll data via context */}
          <ScrollContext.Provider value={scrollData}>
            {/* Original scene canvas - fades out during transition */}
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
                  rotation: [0, Math.PI * 0.75, 0] 
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
                  <SceneContent 
                    isVisible={true}
                    isSpotlightActive={scrollData.offset > 0.2} 
                    onTransitionTrigger={handleTransitionTrigger} 
                  />
                </SimpleScrollySceneWrapper>
              </Canvas>
            </div>
            
            {/* Gradient scene canvas - fades in during transition */}
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

            {/* Mist transition as a separate canvas layer on top */}
            <div style={{ 
              position: 'absolute',
              width: '100%',
              height: '100%',
              pointerEvents: 'none', // Allow clicking through to scenes
              opacity: scrollData.offset >= transitionStartPoint - 0.01 && scrollData.offset <= transitionEndPoint + 0.01 ? 1 : 0,
              transition: 'opacity 0.15s ease'
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
                <SimpleScrollySceneWrapper>
                  <MistTransition 
                    transitionPoint={transitionStartPoint} 
                    duration={mistTransitionDuration}
                  />
                </SimpleScrollySceneWrapper>
              </Canvas>
            </div>
            
            {/* Scroll position indicator for development */}
            <ScrollPositionIndicator />
          </ScrollContext.Provider>
        </div>
      )}
    </>
  );
} 