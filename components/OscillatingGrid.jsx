"use client";

import { useRef, useEffect, useState } from 'react';
import { useSimpleScroll } from './SimpleScrollyControls';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

// Component for the oscillating gradient background with dots
export function OscillatingGrid() {
  const { offset } = useSimpleScroll();
  const { viewport } = useThree();
  const groupRef = useRef();
  const materialRef = useRef();
  const gradientPlaneRef = useRef();
  const dotsRef = useRef([]);
  const timeRef = useRef(0);
  
  // State for the background color
  const [bgColor, setBgColor] = useState(new THREE.Color('#d5dce8'));
  
  // Create dots grid on mount
  useEffect(() => {
    if (!groupRef.current) return;
    
    // Clear any existing dots
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }
    
    dotsRef.current = [];
    
    // Create the background plane - make it much larger to ensure full coverage
    const planeGeometry = new THREE.PlaneGeometry(1, 1);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: bgColor,
      transparent: true,
      opacity: 0.98, // Almost fully opaque to completely cover the scene
      depthTest: false, // Ensure it renders on top of other objects
      depthWrite: false // Don't write to depth buffer
    });
    
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.scale.set(viewport.width * 5, viewport.height * 5, 1); // Even larger to ensure complete coverage
    plane.position.set(0, 0, -0.5); // Position it very close to the dots
    plane.renderOrder = 1000; // Force it to render after other objects in the scene
    groupRef.current.add(plane);
    gradientPlaneRef.current = plane;
    
    // Create a grid of dots
    const rows = 30; // More rows
    const cols = 30; // More columns
    const dotSize = 0.04; // Slightly smaller dots for more precision
    const gridWidth = viewport.width * 1.2; // Wider grid
    const gridHeight = viewport.height * 1.2; // Taller grid
    const xStep = gridWidth / cols;
    const yStep = gridHeight / rows;
    
    const geometry = new THREE.CircleGeometry(dotSize, 32);
    const material = new THREE.MeshBasicMaterial({ 
      color: new THREE.Color(1, 1, 1),
      transparent: true,
      opacity: 0.8 // Higher base opacity for better visibility
    });
    
    materialRef.current = material;
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const dot = new THREE.Mesh(geometry, material.clone());
        const x = (j * xStep) - (gridWidth / 2) + (xStep / 2);
        const y = (i * yStep) - (gridHeight / 2) + (yStep / 2);
        
        dot.position.set(x, y, 0);
        dot.userData = {
          originalOpacity: 0.2 + Math.random() * 0.6, // Higher opacity range for better visibility
          pulseSpeed: 0.2 + Math.random() * 0.4,      // Gentler pulse speed
          pulsePhase: Math.random() * Math.PI * 2
        };
        
        groupRef.current.add(dot);
        dotsRef.current.push(dot);
      }
    }
  }, [viewport, bgColor]);
  
  // Animate the dots
  useFrame((state, delta) => {
    timeRef.current += delta;
    
    if (groupRef.current) {
      // Create different visibility ranges for the gradient screen
      let visibilityFactor = 0;
      
      // Start appearing almost immediately (at 2% scroll)
      if (offset <= 0.02) {
        visibilityFactor = 0;
      } 
      // Transition in faster (0.02-0.15)
      else if (offset <= 0.15) {
        visibilityFactor = (offset - 0.02) / 0.13; // 0 to 1 over 0.13 scroll distance
      }
      // Fully visible (0.15+)
      else {
        visibilityFactor = 1;
      }
      
      // Apply visibility - always leave the group visible but control opacity
      groupRef.current.visible = true;
      
      // Calculate position - slide in from bottom
      // Start below screen and move up as we scroll
      const startY = -viewport.height;  // Start below the viewport
      const endY = 0;                   // End centered in viewport
      const positionY = startY + (endY - startY) * visibilityFactor;
      
      // Position the grid
      // Keep grid in front of camera but allow it to slide up from bottom
      if (state.camera) {
        // Get camera direction to place the grid in front of where camera is looking
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(state.camera.quaternion);
        
        // Position the grid much closer to camera to be in front of everything
        const distanceInFront = 10; // Closer to camera
        
        // Calculate position in front of camera
        const baseX = state.camera.position.x + cameraDirection.x * distanceInFront * 0.8;
        const baseZ = state.camera.position.z + cameraDirection.z * distanceInFront;
        
        // Apply the vertical slide-in animation while maintaining horizontal follow
        groupRef.current.position.x = baseX;
        groupRef.current.position.y = state.camera.position.y + positionY; // Add position offset for slide-in
        groupRef.current.position.z = baseZ;
        
        // Scale up the grid to fill more of the viewport
        const scaleUp = 1.8 + visibilityFactor * 0.7; // Larger scale to cover more area
        groupRef.current.scale.set(scaleUp, scaleUp, 1);
        
        // Always face the camera
        groupRef.current.lookAt(state.camera.position);
      }
      
      // Oscillate background color
      if (gradientPlaneRef.current && gradientPlaneRef.current.material) {
        const r = 0.88 + Math.sin(timeRef.current * 0.3) * 0.02;
        const g = 0.9 + Math.sin(timeRef.current * 0.4 + 1) * 0.02;
        const b = 0.95 + Math.sin(timeRef.current * 0.5 + 2) * 0.02;
        
        gradientPlaneRef.current.material.color.setRGB(r, g, b);
        // Higher opacity to better cover everything
        gradientPlaneRef.current.material.opacity = 0.98 * visibilityFactor;
      }
      
      // Oscillate the dots' opacity
      dotsRef.current.forEach(dot => {
        const { pulseSpeed, pulsePhase, originalOpacity } = dot.userData;
        const pulse = Math.sin(timeRef.current * pulseSpeed + pulsePhase) * 0.5 + 0.5;
        dot.material.opacity = originalOpacity * pulse * visibilityFactor;
      });
    }
  });
  
  return (
    <group 
      ref={groupRef} 
      visible={true}
      renderOrder={9999} // Ensure it renders after everything else
    />
  );
}

export default OscillatingGrid; 