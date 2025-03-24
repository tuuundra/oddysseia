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
    const size = 0.5 + amplitude * 2.5;
    sphereRef.current.scale.set(size, size, size);
    
    // Change color based on amplitude
    const color = isSpeaking ? 
      new THREE.Color(0, 1, 0) : // Green when speaking
      new THREE.Color(0, 0, 1);  // Blue when silent
    
    materialRef.current.color.copy(color);
    materialRef.current.emissive.copy(color.clone().multiplyScalar(0.5));
    
    // Set emissive intensity based on amplitude
    materialRef.current.emissiveIntensity = amplitude * 2;
  });
  
  return (
    <Sphere args={[1, 32, 32]} ref={sphereRef}>
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