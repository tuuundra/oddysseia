"use client";

import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useSimpleScroll } from './SimpleScrollyControls';
import * as THREE from 'three';

export default function EnchantedCrystal() {
  const { offset } = useSimpleScroll();
  const { viewport } = useThree();
  const groupRef = useRef();
  const timeRef = useRef(0);
  
  // Mouse position state
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Create refs for smooth movement
  const targetPositionRef = useRef(new THREE.Vector3(0, 6.0, 0));
  const targetRotationRef = useRef(new THREE.Euler(0, 0, 0));
  const targetScaleRef = useRef(20.8);
  
  // Load the crystal model
  const { scene } = useGLTF('/enchanted_crystal.glb');
  
  // Setup mouse move listener
  useEffect(() => {
    const handleMouseMove = (event) => {
      // Convert mouse position to normalized coordinates (-1 to 1)
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      setMousePosition({ x, y });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  // Set initial material properties and renderOrder
  useEffect(() => {
    if (scene) {
      // Set high renderOrder for the entire scene to ensure it's rendered on top
      scene.renderOrder = 1000;
      
      scene.traverse((node) => {
        if (node.isMesh) {
          // Set high renderOrder for each mesh
          node.renderOrder = 1000;
          
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
            
            // Ensure proper depth test settings
            newMaterial.depthTest = true;
            newMaterial.depthWrite = true;
            
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
    const targetY = 6.0 - (scrollProgress * 6.0);
    
    // Apply floating animation
    const floatAmplitude = 0.1; // How much it floats up and down
    const floatFrequency = 1.0; // Speed of floating motion
    const floatY = Math.sin(time * floatFrequency) * floatAmplitude;
    
    // Apply rotation - REDUCED values for slower rotation
    // Smooth continuous rotation that speeds up slightly with scroll
    const baseRotationSpeed = 0.07; // Base rotation speed (REDUCED from 0.2)
    const additionalRotationSpeed = 0.1 * scrollProgress; // Additional rotation (REDUCED from 0.3)
    
    // Calculate how many full rotations to complete during the fall
    // This gives more control over exact rotation amount during the fall
    const totalRotationsWanted = 1.0; // Only rotate once during the entire descent
    const rotationY = (scrollProgress * totalRotationsWanted * Math.PI * 2) + (time * baseRotationSpeed);
    
    const rotationX = Math.sin(time * 0.5) * 0.1; // Slight tilt back and forth
    
    // Apply mouse-based rotation influence
    // Mouse X controls Y rotation (left-right affects the same spinning rotation)
    // Mouse Y controls X rotation (up-down tilt)
    const mouseInfluenceStrength = 0.3; // How much the mouse affects rotation
    const upDownReduceFactor = 0.4; // Reduce the up/down tilt effect
    const mouseRotationX = mousePosition.y * mouseInfluenceStrength * upDownReduceFactor; // Reduced up-down tilt
    const mouseRotationY = -mousePosition.x * mouseInfluenceStrength * 1.5; // Left-right affects Y rotation
    
    // Update target values (smooth transitions will be applied below)
    targetPositionRef.current.set(0, targetY + floatY, 2); // Set z=2 to position in front
    targetRotationRef.current.set(
      rotationX + mouseRotationX,             // Add mouse Y influence to X rotation
      rotationY + mouseRotationY,             // Add mouse X influence to Y rotation (spin)
      0                                       // No Z rotation
    );
    
    // Scale based on scroll progress
    const startScale = 30.8;
    const endScale = 38.2;
    targetScaleRef.current = startScale + (scrollProgress * (endScale - startScale));
    
    // Apply smooth transitions for more fluid movement
    // Position smoothing
    const positionLerpFactor = 0.05; // Lower value = smoother but slower transitions
    groupRef.current.position.lerp(targetPositionRef.current, positionLerpFactor);
    
    // Rotation smoothing
    const currentRotation = groupRef.current.rotation;
    currentRotation.x += (targetRotationRef.current.x - currentRotation.x) * 0.05;
    
    // Special handling for Y rotation to avoid discontinuities
    const rotationLerpFactor = 0.05;
    const shortestAngle = ((((targetRotationRef.current.y - currentRotation.y) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    currentRotation.y += shortestAngle * rotationLerpFactor;
    
    // Add Z rotation smoothing for mouse X movement
    currentRotation.z += (targetRotationRef.current.z - currentRotation.z) * 0.05;
    
    // Scale smoothing
    const currentScale = groupRef.current.scale.x;
    const newScale = currentScale + (targetScaleRef.current - currentScale) * 0.08;
    groupRef.current.scale.set(newScale, newScale, newScale);
  });
  
  return (
    <group ref={groupRef} position={[0, 6.0, 2]} renderOrder={1000}>
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