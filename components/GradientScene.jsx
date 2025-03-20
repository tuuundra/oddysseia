"use client";

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useSimpleScroll } from './SimpleScrollyControls';

// Camera controller for the gradient scene
function GradientCameraController() {
  const { camera } = useThree();
  
  useEffect(() => {
    // Position camera for a good view of the gradient and dots
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  return null;
}

// Subtle mist particles in the background
function MistParticles() {
  const pointsRef = useRef();
  const { viewport } = useThree();
  
  // Number of particles
  const count = 300;
  
  // Particle positions and sizes
  const [positions, sizes] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      // Positions - spread across the viewport
      positions[i * 3] = (Math.random() - 0.5) * viewport.width * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * viewport.height * 2;
      positions[i * 3 + 2] = Math.random() * 20 - 10;
      
      // Sizes - slight variation for depth
      sizes[i] = Math.random() * 0.3 + 0.05; // Smaller sizes to ensure they're circular
    }
    
    return [positions, sizes];
  }, [viewport]);
  
  // Store initial positions for animation
  const initialPositions = useMemo(() => {
    // Create a separate copy of initial positions to animate from
    const initialPos = new Float32Array(positions.length);
    initialPos.set(positions);
    return initialPos;
  }, [positions]);
  
  // Animate particles
  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    
    const time = clock.getElapsedTime();
    const positionAttribute = pointsRef.current.geometry.getAttribute('position');
    
    // Update positions for animation - using initial positions as base
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // Get the original position from our saved initial positions
      const baseX = initialPositions[i3];
      const baseY = initialPositions[i3 + 1];
      
      // Apply the animation offset to the position attribute
      positionAttribute.array[i3] = baseX + Math.cos(time * 0.05 + i * 0.05) * 0.2;
      positionAttribute.array[i3 + 1] = baseY + Math.sin(time * 0.1 + i * 0.1) * 0.2;
      // Z position stays unchanged
    }
    
    positionAttribute.needsUpdate = true;
  });
  
  // Create a circular texture for the particles to ensure they're round
  const circleTexture = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Draw a circle
    context.beginPath();
    context.arc(size/2, size/2, size/2, 0, 2 * Math.PI);
    context.fillStyle = 'white';
    context.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
  
  return (
    <points ref={pointsRef} renderOrder={-1100}>
      <bufferGeometry>
        <bufferAttribute 
          attach="attributes-position"
          array={positions} 
          count={count}
          itemSize={3}
        />
        <bufferAttribute 
          attach="attributes-size"
          array={sizes} 
          count={count}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.2} 
        sizeAttenuation={true} 
        color="#ffffff" 
        transparent 
        opacity={0.4} 
        fog={true}
        map={circleTexture} // Ensure circular shape
        alphaTest={0.01} // Remove square edges
      />
    </points>
  );
}

// Oscillating gradient background with time-based color animation
function OscillatingGradient() {
  const meshRef = useRef();
  const materialRef = useRef();
  
  // Create shader material for the gradient
  useEffect(() => {
    if (!meshRef.current) return;
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        // Colors updated to match first reference image - more gray-blue tones
        colorA: { value: new THREE.Color('#9DA3BE') }, // Gray-blue
        colorB: { value: new THREE.Color('#B0B5C8') }, // Light gray-blue
        colorC: { value: new THREE.Color('#AEB3CA') }, // Mid gray-blue
        colorD: { value: new THREE.Color('#959BB5') }  // Slightly darker gray-blue
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 colorA;
        uniform vec3 colorB;
        uniform vec3 colorC;
        uniform vec3 colorD;
        varying vec2 vUv;
        
        // Smooth oscillation function with much slower speeds
        float oscillate(float min, float max, float speed) {
          return min + (max - min) * (0.5 * sin(time * speed) + 0.5);
        }
        
        void main() {
          // Significantly slower oscillation for the subtle wash effect seen in reference
          float t1 = oscillate(0.0, 1.0, 0.04); // Very slow oscillation
          float t2 = oscillate(0.0, 1.0, 0.03); // Even slower for second color pair
          
          // First mix between color pairs
          vec3 color1 = mix(colorA, colorB, t1);
          vec3 color2 = mix(colorC, colorD, t2);
          
          // Create a very gradual gradient based on position
          float gradientFactor = vUv.y * 0.3 + 0.35; // 0.35 to 0.65 range - subtle
          
          // Then mix between the resulting colors based on position and time
          float mixFactor = oscillate(0.3, 0.7, 0.02) + gradientFactor;
          mixFactor = clamp(mixFactor, 0.0, 1.0);
          
          vec3 finalColor = mix(color1, color2, mixFactor);
          
          // Add very subtle noise
          float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233)) * 500.0) * 43758.5453);
          finalColor = mix(finalColor, vec3(noise), 0.01); // Almost imperceptible noise
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      transparent: false,
      depthWrite: false,
      depthTest: false
    });
    
    materialRef.current = material;
    meshRef.current.material = material;
  }, []);
  
  // Update the time uniform
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
    }
  });
  
  return (
    <mesh ref={meshRef} position={[0, 0, -1]} renderOrder={-1000}>
      <planeGeometry args={[40, 40]} />
    </mesh>
  );
}

// Mixed grid of small glowing dots and squares like in the reference
function GlowingDotGrid() {
  const { offset } = useSimpleScroll();
  const { viewport } = useThree();
  const circlesRef = useRef();
  const timeRef = useRef(0);
  
  // Appearance threshold
  const dotAppearancePoint = 0.167;
  
  // Calculate grid visibility and opacity
  const gridOpacity = useMemo(() => {
    // Don't show dots until we reach the appearance point
    if (offset < dotAppearancePoint) return 0;
    
    // Fade in over a short period
    const fadeInDuration = 0.01;
    return Math.min((offset - dotAppearancePoint) / fadeInDuration, 1);
  }, [offset]);
  
  // Create points in a perfect grid layout
  const gridSpacing = 0.7; // Spacing between dots in grid (roughly 1 inch)
  const jitterAmount = 0.01; // Very minimal jitter to avoid perfect mechanical look
  
  // Calculate how many dots can fit in the viewport
  const gridWidth = Math.ceil(viewport.width / gridSpacing) + 4; // Add padding
  const gridHeight = Math.ceil(viewport.height / gridSpacing) + 4; // Add padding
  
  // Create grid-based positions with systematic assignment
  const [circlePositions, circleScales, circlePhases] = useMemo(() => {
    // Pre-calculate total positions
    const positions = [];
    
    // Create a perfect grid of positions
    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        // Center the grid
        const xPos = (x - gridWidth / 2) * gridSpacing;
        const yPos = (y - gridHeight / 2) * gridSpacing;
        
        // Add very minimal jitter if enabled
        const jitterX = Math.random() * jitterAmount * 2 - jitterAmount;
        const jitterY = Math.random() * jitterAmount * 2 - jitterAmount;
        
        positions.push({
          x: xPos + jitterX,
          y: yPos + jitterY,
          z: 0,
        });
      }
    }
    
    // Create position and attribute arrays
    const circleCount = positions.length;
    
    const circlePositionsArray = new Float32Array(circleCount * 3);
    const circleScalesArray = new Float32Array(circleCount);
    const circlePhasesArray = new Float32Array(circleCount);
    
    // Fill circle arrays
    for (let i = 0; i < circleCount; i++) {
      circlePositionsArray[i * 3] = positions[i].x;
      circlePositionsArray[i * 3 + 1] = positions[i].y;
      circlePositionsArray[i * 3 + 2] = positions[i].z;
      
      // Very small sizes for the subtle dots in reference
      circleScalesArray[i] = 0.02 + Math.random() * 0.01; // Less variation
      
      // Random phase offset for independent blinking
      circlePhasesArray[i] = Math.random() * Math.PI * 2;
    }
    
    return [
      circlePositionsArray, 
      circleScalesArray, 
      circlePhasesArray
    ];
  }, [viewport.width, viewport.height, gridWidth, gridHeight, gridSpacing, jitterAmount]);
  
  // Number of circles
  const circleCount = Math.floor(circlePositions.length / 3);
  
  // Update point sizes and positions for animation
  useFrame(({ clock }) => {
    if (!circlesRef.current) return;
    
    // Skip if grid not visible yet
    if (gridOpacity <= 0) return;
    
    const time = clock.getElapsedTime();
    timeRef.current = time;
    
    // Update circle opacity for wave effect
    const circleSizes = circlesRef.current.geometry.attributes.size;
    const circleColors = circlesRef.current.geometry.attributes.color;
    
    for (let i = 0; i < circleCount; i++) {
      // Get position to create a wave effect
      const xPos = circlePositions[i * 3];
      const yPos = circlePositions[i * 3 + 1];
      
      // Create a wave pattern based on position
      const distanceFromCenter = Math.sqrt(xPos * xPos + yPos * yPos);
      const waveSpeed = 0.8; // Slower oscillation speed (was 2.0)
      const waveDensity = 0.5; // Controls how tight the waves are
      
      // Coordinate the wave effect - dots oscillate based on distance from center
      const waveOffset = Math.sin(time * waveSpeed - distanceFromCenter * waveDensity);
      
      // Map wave to opacity with larger range (0.05 to 1.0)
      const fade = (waveOffset * 0.5 + 0.5) * 0.95 + 0.05;
      
      // Set size (barely changes for subtle effect)
      circleSizes.array[i] = circleScales[i] * (0.8 + fade * 0.2);
      
      // Set color with alpha for glow effect
      const baseIndex = i * 4;
      circleColors.array[baseIndex] = 1;     // R
      circleColors.array[baseIndex + 1] = 1; // G
      circleColors.array[baseIndex + 2] = 1; // B
      circleColors.array[baseIndex + 3] = fade * gridOpacity; // A - wider range
    }
    
    circleSizes.needsUpdate = true;
    circleColors.needsUpdate = true;
  });
  
  // Create colors array with alpha channel for each particle
  const circleColors = useMemo(() => {
    const colors = new Float32Array(circleCount * 4);
    for (let i = 0; i < circleCount; i++) {
      colors[i * 4] = 1;     // R
      colors[i * 4 + 1] = 1; // G
      colors[i * 4 + 2] = 1; // B
      colors[i * 4 + 3] = 0; // A - start transparent
    }
    return colors;
  }, [circleCount]);
  
  return (
    <group visible={gridOpacity > 0}>
      {/* Circular dots */}
      <points ref={circlesRef} renderOrder={-800}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={circlePositions}
            count={circleCount}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            array={circleScales}
            count={circleCount}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-color"
            array={circleColors}
            count={circleCount}
            itemSize={4}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          sizeAttenuation={true}
          vertexColors
          transparent
          opacity={1}
          fog={true}
          blending={THREE.AdditiveBlending} // Glow effect
        />
      </points>
    </group>
  );
}

// Main component that combines all elements
export default function GradientScene() {
  return (
    <>
      <GradientCameraController />
      <fog attach="fog" color="#959BB5" near={5} far={35} />
      <ambientLight intensity={1.5} />
      <OscillatingGradient />
      <GlowingDotGrid />
    </>
  );
} 