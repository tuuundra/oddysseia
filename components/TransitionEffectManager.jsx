"use client";

import { useEffect, useState, useRef } from 'react';
import { Canvas, createPortal, useThree } from '@react-three/fiber';
import PixelTransition, { useSceneCapture, useVideoFrameTexture } from './PixelTransition';
import * as THREE from 'three';

// Preload and cache video frames
const cachedFrames = {
  start: null,
  end: null
};

// Preload function to be called once
export const preloadVideoFrames = async (videoSrc) => {
  if (cachedFrames.start && cachedFrames.end) {
    console.log("Video frames already preloaded");
    return;
  }
  
  console.log("Preloading video frames from", videoSrc);
  
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoSrc;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    
    video.addEventListener('loadedmetadata', async () => {
      console.log("Video metadata loaded, duration:", video.duration);
      
      // Function to capture a frame
      const captureFrame = (time) => {
        return new Promise((resolveFrame) => {
          video.currentTime = time;
          
          video.addEventListener('seeked', () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            resolveFrame(texture);
          }, { once: true });
        });
      };
      
      try {
        // Capture first frame
        cachedFrames.start = await captureFrame(0);
        console.log("Start frame captured");
        
        // Capture last frame
        cachedFrames.end = await captureFrame(video.duration - 0.1);
        console.log("End frame captured");
        
        resolve(cachedFrames);
      } catch (error) {
        console.error("Error capturing frames:", error);
        reject(error);
      }
    });
    
    video.addEventListener('error', (e) => {
      console.error("Video loading error:", e);
      reject(e);
    });
    
    video.load();
  });
};

// Component to manage the transition effect
const SceneTransitionManager = ({ 
  isActive,
  videoSrc,
  onTransitionComplete,
  initialDelay = 300,
  duration = 1500,
  intensity = 0.6,
  pixelSize = 15,
  isReverse = false
}) => {
  const [progress, setProgress] = useState(0);
  const [sourceTexture, setSourceTexture] = useState(null);
  const [targetTexture, setTargetTexture] = useState(null);
  const [isCapturingScene, setIsCapturingScene] = useState(false);
  const [transitionStarted, setTransitionStarted] = useState(false);
  const videoRef = useRef();
  const startTimeRef = useRef();
  const requestRef = useRef();
  
  // Debug active state changes
  useEffect(() => {
    console.log(`TransitionManager: isActive=${isActive}, isCapturingScene=${isCapturingScene}, hasSourceTexture=${!!sourceTexture}, hasTargetTexture=${!!targetTexture}`);
  }, [isActive, isCapturingScene, sourceTexture, targetTexture]);
  
  // When activated, start scene capture immediately
  useEffect(() => {
    if (isActive && !isCapturingScene && !sourceTexture) {
      console.log("TransitionManager: Activating scene capture");
      setIsCapturingScene(true);
    }
  }, [isActive, isCapturingScene, sourceTexture]);
  
  // Prepare video frame texture
  useEffect(() => {
    if (!videoSrc) {
      console.error("TransitionManager: No videoSrc provided");
      return;
    }
    
    console.log(`TransitionManager: Using video frames for ${isReverse ? 'reverse' : 'forward'} transition`);
    
    // Use cached frames if available
    if (cachedFrames.start && cachedFrames.end) {
      console.log("TransitionManager: Using cached video frames");
      setTargetTexture(isReverse ? cachedFrames.start : cachedFrames.end);
      return;
    }
    
    // If not cached, use the old method
    console.log(`TransitionManager: Loading video from ${videoSrc}`);
    
    // Create video element
    const video = document.createElement('video');
    video.src = videoSrc;
    video.crossOrigin = 'anonymous';
    video.loop = false;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = false;
    
    // Set as reference
    videoRef.current = video;
    
    // Load video metadata
    video.addEventListener('loadedmetadata', () => {
      console.log(`TransitionManager: Video metadata loaded, duration: ${video.duration}s`);
      
      if (isReverse) {
        video.currentTime = video.duration - 0.1; // Slightly before end to avoid issues
      } else {
        video.currentTime = 0;
      }
      
      // Wait for the specific frame to load
      video.addEventListener('seeked', () => {
        console.log(`TransitionManager: Video seeked to ${isReverse ? 'end' : 'start'} frame`);
        
        try {
          // Create a canvas to capture the video frame
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            console.error("TransitionManager: Could not get canvas context");
            return;
          }
          
          // Draw the video frame on the canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Create a texture from the canvas
          const texture = new THREE.CanvasTexture(canvas);
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          
          // Store as the target texture
          console.log("TransitionManager: Video frame captured to texture");
          setTargetTexture(texture);
        } catch (error) {
          console.error("TransitionManager: Error capturing video frame:", error);
        }
      }, { once: true });
    });
    
    // Handle errors
    video.addEventListener('error', (e) => {
      console.error("TransitionManager: Video loading error:", e);
    });
    
    // Load the video
    video.load();
    
    // Clean up
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
      }
    };
  }, [videoSrc, isReverse]);
  
  // Initialize and run the transition animation
  useEffect(() => {
    if (!isActive || !sourceTexture || !targetTexture) {
      return;
    }
    
    console.log("TransitionManager: All textures ready, starting animation");
    
    // If not already started, start the transition
    if (!transitionStarted) {
      setTransitionStarted(true);
      startTimeRef.current = Date.now() + initialDelay;
      
      const animate = () => {
        const now = Date.now();
        if (now >= startTimeRef.current) {
          const elapsed = now - startTimeRef.current;
          const newProgress = Math.min(elapsed / duration, 1);
          setProgress(newProgress);
          
          if (newProgress >= 1) {
            // Transition is complete
            console.log("TransitionManager: Animation complete");
            if (onTransitionComplete) {
              onTransitionComplete();
            }
            return;
          }
        }
        
        requestRef.current = requestAnimationFrame(animate);
      };
      
      requestRef.current = requestAnimationFrame(animate);
    }
    
    // Clean up animation
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isActive, sourceTexture, targetTexture, transitionStarted, onTransitionComplete, initialDelay, duration]);
  
  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      pointerEvents: 'none',
      zIndex: 1000,
      opacity: isActive ? 1 : 0,
      display: isActive ? 'block' : 'none'
    }}>
      <Canvas
        gl={{ 
          antialias: true,
          alpha: true,
          stencil: false,
          depth: false,
          powerPreference: 'high-performance' 
        }}
        dpr={[1, 2]}
        style={{ width: '100%', height: '100%' }}
      >
        <SceneCapturer 
          isCapturingScene={isCapturingScene || (isActive && !sourceTexture)}
          setSourceTexture={setSourceTexture}
          setIsCapturingScene={setIsCapturingScene}
        />
        
        {sourceTexture && targetTexture && (
          <PixelTransition 
            sourceFBO={sourceTexture}
            targetTexture={targetTexture}
            progress={progress}
            intensity={intensity}
            pixelSize={pixelSize}
          />
        )}
      </Canvas>
    </div>
  );
};

// Component to capture the current scene
const SceneCapturer = ({ isCapturingScene, setSourceTexture, setIsCapturingScene }) => {
  const { captureScene } = useSceneCapture();
  
  useEffect(() => {
    if (isCapturingScene) {
      console.log("SceneCapturer: Attempting to capture scene");
      // Wait a frame to ensure the scene is fully rendered
      setTimeout(() => {
        try {
          const fbo = captureScene();
          console.log("SceneCapturer: Scene captured successfully");
          setSourceTexture(fbo);
          setIsCapturingScene(false);
        } catch (error) {
          console.error("SceneCapturer: Error capturing scene:", error);
          setIsCapturingScene(false);
        }
      }, 200); // Increased timeout for more reliable capture
    }
  }, [captureScene, isCapturingScene, setSourceTexture, setIsCapturingScene]);
  
  return null;
};

export default SceneTransitionManager; 