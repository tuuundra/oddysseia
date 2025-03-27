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

// Container that provides scroll context to the 3D scene
export default function SceneContainer() {
  const [scrollData, setScrollData] = useState({ offset: 0 });
  // Add state for scene transition
  const [showSecondScene, setShowSecondScene] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [videoFinished, setVideoFinished] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState(0); // 0: not started, 1: blur/fade first scene, 2: video playing, 3: fade out
  const [isReverseTransition, setIsReverseTransition] = useState(false); // Track if the transition is forwards or backwards
  const videoRef = useRef(null);
  const firstSceneRef = useRef(null);
  
  // Function to handle transition trigger
  const handleTransitionTrigger = () => {
    console.log("%c 🚀 TRANSITION TRIGGERED! 🚀", "background: #4CAF50; color: white; font-size: 20px; padding: 10px;");
    
    // Start the transition sequence
    setIsTransitioning(true);
    setTransitionPhase(1);
    setIsReverseTransition(false); // This is a forward transition
    
    // Prepare video for playback
    if (videoRef.current) {
      videoRef.current.currentTime = 0; // Start from beginning
      videoRef.current.playbackRate = 1.0; // Normal speed (forward)
    }
    
    // Start fading out the first scene and fading in the video after a small delay
    setTimeout(() => {
      setTransitionPhase(2); // Move to phase 2 where video is visible
    }, 100);
    
    // Start video playback with a slight delay to ensure DOM is ready
    setTimeout(() => {
      if (videoRef.current) {
        const playPromise = videoRef.current.play();
        
        // Handle autoplay restrictions
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Video play was prevented:", error);
            // Fall back to showing the second scene directly
            handleVideoEnded();
          });
        }
      }
    }, 200);
  };
  
  // New function to handle reverse transition (from rock line back to original scene)
  const handleReverseTransition = () => {
    console.log("%c 🔄 REVERSE TRANSITION TRIGGERED! 🔄", "background: #FF5722; color: white; font-size: 20px; padding: 10px;");
    
    // Flag that we're doing a reverse transition
    setIsReverseTransition(true);
    setIsTransitioning(true);
    setTransitionPhase(2); // Start immediately at phase 2 for reverse transition
    
    // Start video playback in reverse
    setTimeout(() => {
      if (videoRef.current) {
        // Set video to the end and play in reverse
        try {
          videoRef.current.currentTime = videoRef.current.duration;
          videoRef.current.playbackRate = -1.0; // Reverse speed
          const playPromise = videoRef.current.play();
          
          // Handle autoplay restrictions
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.error("Reverse video play was prevented:", error);
              // Fall back to direct scene switch
              handleReverseVideoEnded();
            });
          }
        } catch (error) {
          console.error("Error setting up reverse video:", error);
          handleReverseVideoEnded();
        }
      } else {
        console.error("Video reference not available");
        handleReverseVideoEnded();
      }
    }, 100);
  };
  
  // Handle video ended event
  const handleVideoEnded = () => {
    console.log("%c 🎬 VIDEO ENDED! 🎬", "background: #FF9800; color: white; font-size: 20px; padding: 10px;");
    setVideoFinished(true);
    
    // Check if this is a reverse transition
    if (isReverseTransition) {
      handleReverseVideoEnded();
      return;
    }
    
    // Switch to second scene after video ends
    setShowSecondScene(true);
    console.log("%c ✨ SECOND SCENE ACTIVATED! ✨", "background: #2196F3; color: white; font-size: 20px; padding: 10px;");
    
    // After a short delay, hide the video overlay
    setTimeout(() => {
      setIsTransitioning(false);
      setVideoFinished(false);
      setTransitionPhase(0);
    }, 300);
  };
  
  // New function to handle when reverse video ends
  const handleReverseVideoEnded = () => {
    console.log("%c 🔙 REVERSE VIDEO ENDED - RETURNING TO ORIGINAL SCENE! 🔙", "background: #9C27B0; color: white; font-size: 20px; padding: 10px;");
    
    // Switch back to the original scene
    setShowSecondScene(false);
    
    // After a short delay, hide the video overlay and reset transition state
    setTimeout(() => {
      setIsTransitioning(false);
      setVideoFinished(false);
      setTransitionPhase(0);
      setIsReverseTransition(false);
    }, 300);
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
      {/* Video transition overlay */}
      {isTransitioning && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 9999,
            backgroundColor: 'transparent', // Transparent background to allow scene to show through
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none', // Allow interaction with scenes below
          }}
        >
          <video
            ref={videoRef}
            src="/rockanimation.mp4"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover', // Cover the entire screen
              opacity: transitionPhase === 1 ? 0 : (videoFinished ? 0 : 1),
              transition: 'opacity 1s ease-in-out',
            }}
            onEnded={handleVideoEnded}
            autoPlay={false} // We'll manually play it
            playsInline
            muted
            controls={false}
            preload="auto"
          />
        </div>
      )}

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
            opacity: isTransitioning 
              ? (transitionPhase === 1 ? 1 : (isReverseTransition && videoFinished ? 1 : 0))
              : 1,
            transition: 'opacity 1s ease-in-out',
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