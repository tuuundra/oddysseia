import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import RockLineScene from './RockLineScene';

interface SceneTransitionProps {
  children: React.ReactNode;
}

const SceneTransition = ({ children }: SceneTransitionProps) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showSecondScene, setShowSecondScene] = useState(false);
  
  // Function to trigger the transition
  const handleTransition = () => {
    if (isTransitioning || showSecondScene) return;
    
    // Start transition
    setIsTransitioning(true);
    
    // After a delay, show the second scene
    setTimeout(() => {
      setShowSecondScene(true);
      setIsTransitioning(false);
    }, 1000); // 1 second transition
  };
  
  // If showing second scene, render that instead
  if (showSecondScene) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}>
        <Canvas
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
          <RockLineScene />
        </Canvas>
      </div>
    );
  }
  
  // Instead of cloning children with props, just render them directly
  // The onTransitionTrigger will be passed down from parent components
  return (
    <div style={{ position: 'relative' }}>
      {children}
      
      {/* Transition overlay */}
      {isTransitioning && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'black',
            opacity: 0,
            transition: 'opacity 1s ease-in-out',
            zIndex: 9999,
            animation: 'fadeIn 1s forwards'
          }}
        />
      )}
      
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SceneTransition; 