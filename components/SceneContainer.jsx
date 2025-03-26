"use client";

import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import SimpleScrollySceneWrapper from './SimpleScrollySceneWrapper';
import { ScrollContext } from './SimpleScrollyControls';
import SceneContent from './SceneContent';
import ScrollPositionIndicator from './ScrollPositionIndicator';
import GradientScene from './GradientScene';
import MistTransition from './MistTransition';
import RockLineScene from './RockLineScene';
import TransitionEffectManager from './TransitionEffectManager';

// Debug mode - set to true to enable manual transition trigger with 'T' key
const DEBUG_TRANSITIONS = true;

// Container that provides scroll context to the 3D scene
export default function SceneContainer() {
  const [scrollData, setScrollData] = useState({ offset: 0 });
  // Add state for scene transition
  const [showSecondScene, setShowSecondScene] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [videoFinished, setVideoFinished] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState(0); // 0: not started, 1: effect preparation, 2: transition active, 3: completed
  const [isReverseTransition, setIsReverseTransition] = useState(false); // Track if the transition is forwards or backwards
  const firstSceneRef = useRef(null);
  
  // Function to handle transition trigger
  const handleTransitionTrigger = () => {
    console.log("%c 🚀 TRANSITION TRIGGERED! 🚀", "background: #4CAF50; color: white; font-size: 20px; padding: 10px;");
    
    // Prevent multiple transitions
    if (isTransitioning) return;
    
    // Start the transition sequence
    setIsTransitioning(true);
    setTransitionPhase(1);
    setIsReverseTransition(false); // This is a forward transition
    
    // Phase 1: Prepare for the transition
    if (firstSceneRef.current) {
      firstSceneRef.current.style.transition = 'filter 0.5s ease-in-out, opacity 0.5s ease-in-out';
    }
    
    // Phase 2: Start the pixel transition effect - will happen in TransitionEffectManager
    setTimeout(() => {
      setTransitionPhase(2);
    }, 100);
  };
  
  // Handle transition completion
  const handleTransitionComplete = () => {
    console.log("%c ✨ TRANSITION COMPLETED! ✨", "background: #2196F3; color: white; font-size: 20px; padding: 10px;");
    
    // If this is a reverse transition, go back to the first scene
    if (isReverseTransition) {
      setShowSecondScene(false);
      
      // Restore original scene opacity
      if (firstSceneRef.current) {
        firstSceneRef.current.style.filter = 'blur(0px)';
        firstSceneRef.current.style.opacity = '1';
      }
    } else {
      // Forward transition - show the second scene
      setShowSecondScene(true);
    }
    
    // Reset transition state
    setTransitionPhase(0);
    setIsTransitioning(false);
    setVideoFinished(false);
  };
  
  // New function to handle reverse transition (from rock line back to original scene)
  const handleReverseTransition = () => {
    console.log("%c 🔄 REVERSE TRANSITION TRIGGERED! 🔄", "background: #FF5722; color: white; font-size: 20px; padding: 10px;");
    
    // Prevent multiple transitions
    if (isTransitioning) return;
    
    // Flag that we're doing a reverse transition
    setIsReverseTransition(true);
    setIsTransitioning(true);
    setTransitionPhase(2); // Start directly at transition phase
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
  
  // Debug keyboard controls for transition testing
  useEffect(() => {
    if (!DEBUG_TRANSITIONS) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 't' || e.key === 'T') {
        console.log("DEBUG: Manual transition trigger");
        if (showSecondScene) {
          handleReverseTransition();
        } else {
          handleTransitionTrigger();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSecondScene]);
  
  return (
    <>
      {/* Custom Pixel Transition Effect */}
      <TransitionEffectManager 
        isActive={transitionPhase === 2}
        videoSrc="/rockanimation.mp4"
        onTransitionComplete={handleTransitionComplete}
        intensity={0.7}
        pixelSize={15}
        duration={1800}
        isReverse={isReverseTransition}
      />

      {/* Second scene - shown when transition is triggered */}
      {showSecondScene && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}>
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
            <RockLineScene onRockClick={handleReverseTransition} />
          </Canvas>
        </div>
      )}

      {/* Original scene - hidden when second scene is shown */}
      {!showSecondScene && (
        <div 
          ref={firstSceneRef}
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
            filter: 'blur(0px)',
            transition: 'filter 0.5s ease-out',
            opacity: 1
          }}
        >
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