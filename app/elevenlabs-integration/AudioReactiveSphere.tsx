'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

interface AudioReactiveSphereProps {
  amplitude: number;
  isSpeaking: boolean;
}

// A simple sphere that reacts to audio
const AudioReactiveSphere: React.FC<AudioReactiveSphereProps> = ({ amplitude, isSpeaking }) => {
  const sphereRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  // Very visible debugging in the console
  useEffect(() => {
    console.log('🔊 AMPLITUDE:', amplitude.toFixed(2), isSpeaking ? '🗣️ SPEAKING' : '🔇 SILENT');
  }, [amplitude, isSpeaking]);
  
  // Animation loop
  useFrame((state, delta) => {
    if (!sphereRef.current || !materialRef.current) return;
    
    // DRAMATIC size change based on amplitude
    // Start small (0.5) and grow up to 3x with amplitude
    const targetSize = isSpeaking ? 
      (0.7 + amplitude * 2.5) : // Larger range when speaking
      (0.5 + amplitude * 1.5);  // Smaller range when not speaking
    
    // Smoothly animate to target size
    const currentScale = sphereRef.current.scale.x;
    const newScale = THREE.MathUtils.lerp(currentScale, targetSize, delta * 5);
    sphereRef.current.scale.set(newScale, newScale, newScale);
    
    // Change color based on amplitude and speaking state
    const speakingColor = new THREE.Color(0, 1, 0.5); // Cyan-green when speaking
    const silentColor = new THREE.Color(0.2, 0.2, 0.8);  // Deep blue when silent
    
    // Blend between colors based on whether it's speaking
    const targetColor = isSpeaking ? speakingColor : silentColor;
    
    // Add pulsing to the color based on amplitude
    if (isSpeaking) {
      // Pulse between the target color and a brighter version
      const pulseAmount = Math.sin(state.clock.elapsedTime * 5) * 0.2 + 0.8;
      targetColor.multiplyScalar(pulseAmount);
    }
    
    // Smoothly transition to the target color
    materialRef.current.color.lerp(targetColor, delta * 5);
    
    // Set emissive color to match main color
    materialRef.current.emissive.copy(materialRef.current.color.clone().multiplyScalar(0.5));
    
    // Set emissive intensity based on amplitude
    materialRef.current.emissiveIntensity = isSpeaking ? 
      (0.8 + amplitude * 3) : // More glow when speaking
      (0.3 + amplitude * 1);  // Less glow when not speaking
  });
  
  return (
    <Sphere args={[1, 64, 64]} ref={sphereRef}>
      <meshStandardMaterial 
        ref={materialRef}
        color="blue"
        emissive="blue"
        emissiveIntensity={0.5}
        roughness={0.2}
        metalness={0.8}
      />
    </Sphere>
  );
};

export default AudioReactiveSphere; 