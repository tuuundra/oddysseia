"use client";

import { useRef, useMemo } from 'react';
import { useSimpleScroll } from './SimpleScrollyControls';
import GradientScene from './GradientScene';
import { useFrame } from '@react-three/fiber';

export default function SceneTransitionWrapper({ children }) {
  const { offset } = useSimpleScroll();
  const originalSceneRef = useRef();
  const gradientSceneRef = useRef();
  
  // Calculate scene visibility based on scroll position
  const { showOriginalScene, showGradientScene } = useMemo(() => {
    // Scene transition happens at exactly 0.16
    const transitionPoint = 0.16;
    
    // Clean switch at the transition point
    if (offset < transitionPoint) {
      return {
        showOriginalScene: true,
        showGradientScene: false
      };
    } else {
      return {
        showOriginalScene: false,
        showGradientScene: true
      };
    }
  }, [offset]);
  
  // Update visibility of scenes
  useFrame(() => {
    if (originalSceneRef.current) {
      originalSceneRef.current.visible = showOriginalScene;
    }
    
    if (gradientSceneRef.current) {
      gradientSceneRef.current.visible = showGradientScene;
    }
  });
  
  return (
    <>
      {/* Original scene - completely untouched */}
      <group ref={originalSceneRef} visible={showOriginalScene}>
        {children}
      </group>
      
      {/* Gradient scene - completely separate */}
      <group ref={gradientSceneRef} visible={showGradientScene}>
        <GradientScene />
      </group>
    </>
  );
} 