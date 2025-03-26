"use client";

import { useEffect, useState, useRef } from 'react';
import { Canvas, createPortal, useThree } from '@react-three/fiber';
import PixelTransition, { useSceneCapture, useVideoFrameTexture } from './PixelTransition';
import * as THREE from 'three';

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
  
  // Prepare video element
  useEffect(() => {
    if (!videoSrc) return;
    
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
      if (isReverse) {
        video.currentTime = video.duration;
      } else {
        video.currentTime = 0;
      }
      
      // Wait for the specific frame to load
      video.addEventListener('seeked', () => {
        console.log(`Video seeked to ${isReverse ? 'end' : 'start'} frame`);
        
        // Create a canvas to capture the video frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        // Draw the video frame on the canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Create a texture from the canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        // Store as the target texture
        setTargetTexture(texture);
        
        // We're ready to capture the source scene
        setIsCapturingScene(true);
      }, { once: true });
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
    if (!isActive || !sourceTexture || !targetTexture) return;
    
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
          isCapturingScene={isCapturingScene}
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
      // Wait a frame to ensure the scene is fully rendered
      setTimeout(() => {
        const fbo = captureScene();
        setSourceTexture(fbo);
        setIsCapturingScene(false);
      }, 100);
    }
  }, [captureScene, isCapturingScene, setSourceTexture, setIsCapturingScene]);
  
  return null;
};

export default SceneTransitionManager; 