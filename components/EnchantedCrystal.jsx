"use client";

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useSimpleScroll } from './SimpleScrollyControls';
import * as THREE from 'three';

export default function EnchantedCrystal() {
  const { offset } = useSimpleScroll();
  const groupRef = useRef();
  const timeRef = useRef(0);
  
  // Load the crystal model
  const { scene } = useGLTF('/enchanted_crystal.glb');
  
  // Set initial material properties
  useEffect(() => {
    if (scene) {
      scene.traverse((node) => {
        if (node.isMesh) {
          // Enhance the material for a more magical look
          if (node.material) {
            // Clone material to avoid modifying the original
            const newMaterial = node.material.clone();
            
            // Make the crystal slightly translucent but fully visible
            newMaterial.transparent = true;
            newMaterial.opacity = 1;
            
            // Add some glow/emission
            newMaterial.emissive = new THREE.Color('#80c0ff');
            newMaterial.emissiveIntensity = 0.2;
            
            // Increase reflectivity
            if (newMaterial.metalness !== undefined) {
              newMaterial.metalness = 0.3;
              newMaterial.roughness = 0.2;
            }
            
            node.material = newMaterial;
          }
        }
      });
    }
  }, [scene]);
  
  // Animation based on scroll position
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    
    // Store time for animation
    const time = clock.getElapsedTime();
    timeRef.current = time;
    
    // Crystal appears at .16 offset from the top of the screen
    const appearThreshold = 0.16;
    
    // Calculate crystal position based on scroll
    // Start offscreen (6.0) and move to center (0) as user scrolls
    const scrollRange = 0.3; // Amount of scroll to complete the movement
    const scrollProgress = Math.max(0, Math.min(1, (offset - appearThreshold) / scrollRange));
    
    // Y position: start way above viewport (6.0), move to center (0)
    const yPosition = 6.0 - (scrollProgress * 6.0);
    
    // Apply floating animation
    const floatAmplitude = 0.1; // How much it floats up and down
    const floatFrequency = 1.0; // Speed of floating motion
    const floatY = Math.sin(time * floatFrequency) * floatAmplitude;
    
    // Apply rotation
    // Smooth continuous rotation that speeds up slightly with scroll
    const baseRotationSpeed = 0.2; // Base rotation speed (slower)
    const additionalRotationSpeed = 0.3 * scrollProgress; // Additional rotation as we scroll
    const rotationY = time * (baseRotationSpeed + additionalRotationSpeed);
    const rotationX = Math.sin(time * 0.5) * 0.1; // Slight tilt back and forth
    
    // Set position and rotation
    groupRef.current.position.y = yPosition + floatY;
    groupRef.current.rotation.y = rotationY;
    groupRef.current.rotation.x = rotationX;
    
    // Scale based on scroll progress
    const startScale = 20.8;
    const endScale = 30.2;
    const scale = startScale + (scrollProgress * (endScale - startScale));
    groupRef.current.scale.set(scale, scale, scale);
  });
  
  return (
    <group ref={groupRef} position={[0, 6.0, 0]}>
      <primitive object={scene} />
      
      {/* Add a point light inside the crystal for glow effect */}
      <pointLight 
        color="#80c0ff" 
        intensity={1.5} 
        distance={2} 
        decay={2} 
      />
    </group>
  );
}

// Preload the model
useGLTF.preload('/enchanted_crystal.glb'); 