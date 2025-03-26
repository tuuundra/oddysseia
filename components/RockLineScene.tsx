import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

// Component for displaying the rock line scene
const RockLineScene = () => {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Load the rock model
  const { scene: originalScene } = useGLTF('/fractured_rock.glb', true);
  
  // Create fragments for the line
  const fragments = useRef<THREE.Group[]>([]);
  
  // Initialize the scene - ensure this only runs once when all resources are ready
  useEffect(() => {
    if (!isInitialized && groupRef.current && originalScene) {
      console.log("Initializing rock line scene");
      
      // Position camera to view the line
      camera.position.set(0, 0, 6);
      camera.lookAt(0, 0, 0);
      
      // Create 5 fragments in a row
      const spacing = 1.5; // Distance between fragments
      const totalWidth = spacing * 4; // For 5 fragments
      const startX = -totalWidth / 2;
      
      // Clear any existing fragments
      fragments.current = [];
      
      // Create clone of the rock fragments for each position
      for (let i = 0; i < 5; i++) {
        // Clone the model
        const clone = originalScene.clone();
        
        // Position in line
        const x = startX + i * spacing;
        clone.position.set(x, 0, 0);
        
        // Scale the fragments
        const scale = 0.4 + Math.random() * 0.2; // Random scale between 0.4 and 0.6
        clone.scale.set(scale, scale, scale);
        
        // Add rotation
        clone.rotation.set(
          Math.random() * Math.PI * 2, 
          Math.random() * Math.PI * 2, 
          Math.random() * Math.PI * 2
        );
        
        // Add to scene and store reference
        groupRef.current.add(clone);
        fragments.current.push(clone);
      }
      
      setIsInitialized(true);
      console.log("Rock line scene initialized with", fragments.current.length, "fragments");
    }
  }, [camera, originalScene, isInitialized]);
  
  // Animate the fragments with subtle floating
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Safely animate fragments if they exist
    if (fragments.current.length > 0) {
      fragments.current.forEach((fragment, index) => {
        if (fragment) {
          // Unique animation parameters for each fragment
          const floatSpeed = 0.3 + index * 0.05;
          const rotateSpeed = 0.1 + index * 0.02;
          
          // Floating movement
          fragment.position.y = Math.sin(t * floatSpeed) * 0.1;
          
          // Slow rotation
          fragment.rotation.x += 0.001 * Math.sin(t * rotateSpeed);
          fragment.rotation.y += 0.001 * Math.sin(t * rotateSpeed * 0.7);
          fragment.rotation.z += 0.001 * Math.sin(t * rotateSpeed * 0.5);
        }
      });
    }
  });
  
  return (
    <>
      {/* Black background */}
      <color attach="background" args={['#000000']} />
      
      {/* Container for fragments */}
      <group ref={groupRef} position={[0, 0, 0]}>
        {/* Fragments will be added dynamically */}
      </group>
      
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} />
    </>
  );
};

// Preload the model
useGLTF.preload('/fractured_rock.glb', true);

export default RockLineScene; 