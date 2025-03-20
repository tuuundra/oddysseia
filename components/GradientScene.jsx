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
        // Colors updated from the reference image
        colorA: { value: new THREE.Color('#808692') }, // Oslo Gray
        colorB: { value: new THREE.Color('#D9DBE0') }, // Iron
        colorC: { value: new THREE.Color('#B7BCCC') }, // Heather
        colorD: { value: new THREE.Color('#BBC4CB') }  // Loblolly
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

// Fluid, organic diffusing color layer that creates liquid-like transitions
function DiffusingColorLayer() {
  const meshRef = useRef();
  const materialRef = useRef();
  const { viewport } = useThree();
  
  // Create shader material for the fluid effect
  useEffect(() => {
    if (!meshRef.current) return;
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(viewport.width, viewport.height) },
        lightColor: { value: new THREE.Color('#C6CAD1') }, // Light color
        darkColor: { value: new THREE.Color('#A9ADB7') }   // Even less contrast (was #848D9F)
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
        uniform vec2 resolution;
        uniform vec3 lightColor;
        uniform vec3 darkColor;
        varying vec2 vUv;
        
        // Simplex-like 2D noise
        float noise(vec2 st) {
          vec2 i = floor(st);
          vec2 f = fract(st);
          
          // Cubic Hermite interpolation for smoother gradients
          vec2 u = f * f * (3.0 - 2.0 * f);
          
          float a = sin(dot(i, vec2(127.1, 311.7))) * 43758.5453123;
          float b = sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453123;
          float c = sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453123;
          float d = sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453123;
          
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        
        // Fractional Brownian Motion (fBm) for layered noise
        float fbm(vec2 st) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          
          // Add several octaves of noise with different scales
          // Use fewer octaves for smoother, more subtle effect
          for (int i = 0; i < 3; i++) {
            value += amplitude * (noise(st * frequency) * 0.5 + 0.5);
            frequency *= 1.6; // Even gentler frequency change (was 1.8)
            amplitude *= 0.35; // Reduced amplitude for less intensity
            
            // Use a different rotation angle for each octave to break up patterns
            float angle = 0.3 + float(i) * 0.2;
            st = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * st;
          }
          
          return value;
        }
        
        // Additional disruption noise to break up any visible patterns
        float disruptionNoise(vec2 st, float time) {
          // Use a very large scale noise that moves independently
          float n1 = noise(st * 0.15 + vec2(time * 0.011, time * 0.017));
          float n2 = noise(st * 0.07 - vec2(time * 0.019, time * 0.013));
          
          // Combine with a very subtle contribution
          return n1 * 0.6 + n2 * 0.4;
        }
        
        void main() {
          // Get aspect-corrected UV coordinates
          vec2 uv = vUv;
          float aspect = resolution.x / resolution.y;
          
          // Apply a subtle rotation to the UVs to avoid diagonal patterns aligned with the screen
          float rotationAngle = 0.2; // Subtle rotation
          mat2 rotationMatrix = mat2(cos(rotationAngle), sin(rotationAngle), -sin(rotationAngle), cos(rotationAngle));
          uv = rotationMatrix * (uv - 0.5) + 0.5;
          
          // Apply aspect correction after rotation
          uv.x *= aspect;
          
          // Create extremely slow moving, organic fluid effect
          float slowTime = time * 0.015; // Even slower movement (was 0.02)
          
          // Create multiple layers of moving noise with much larger scale for gentler transitions
          // Use prime-number-based scales and speeds to reduce repeating patterns
          float n1 = fbm(uv * 0.17 + vec2(slowTime * 0.023, slowTime * 0.031)); // Prime-based values
          float n2 = fbm(uv * 0.23 - vec2(slowTime * 0.037, slowTime * 0.029)); // Prime-based values
          float n3 = fbm(uv * 0.41 + vec2(-slowTime * 0.019, slowTime * 0.013)); // Prime-based values
          
          // Combine noise layers with more weight on the smoothest, largest scale noise
          float combinedNoise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
          
          // Add the disruption noise to break up any visible patterns
          float disruption = disruptionNoise(uv, slowTime);
          combinedNoise = mix(combinedNoise, disruption, 0.2); // Subtle influence
          
          // Create much more gradual fluid-like contours with extremely wide transitions
          // Use smoothstep with very wide range for extremely soft edges
          float fluidPattern = smoothstep(0.2, 0.8, combinedNoise); // Even wider range (was 0.25-0.75)
          
          // Add extremely gentle pulsing effect
          float pulse = sin(slowTime * 0.029) * 0.5 + 0.5; // Prime-based frequency
          fluidPattern = mix(fluidPattern, combinedNoise, pulse * 0.06); // Even less blend (was 0.08)
          
          // Create a radial gradient to ensure edges fade away from center
          vec2 centeredUV = uv / aspect - vec2(0.5 / aspect, 0.5);
          float distFromCenter = length(centeredUV) * 1.5; // Scaled to reach corners
          float radialFade = 1.0 - smoothstep(0.5, 1.0, distFromCenter);
          
          // Mix between colors based on the fluid pattern
          // Use more subtle power curves for extremely gentle gradients
          vec3 color;
          
          // Significantly reduce strength of dark areas
          float darkFactor = pow(smoothstep(0.0, 1.0, fluidPattern), 2.0) * 0.08; // Even more subtle (was 0.12)
          darkFactor *= radialFade; // Fade out near edges
          
          color = mix(lightColor, darkColor, darkFactor);
          
          // Final alpha controls overall effect intensity
          // Use extremely low opacity for just a hint of effect
          gl_FragColor = vec4(color, 0.08); // Even lower opacity (was 0.12)
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending
    });
    
    materialRef.current = material;
    meshRef.current.material = material;
  }, [viewport]);
  
  // Update the time uniform
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
    }
  });
  
  return (
    <mesh ref={meshRef} position={[0, 0, -0.95]} renderOrder={-1050}>
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
  
  // Appearance threshold - changed to appear earlier
  const dotAppearancePoint = 0.125;
  
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
      <DiffusingColorLayer />
      <GlowingDotGrid />
    </>
  );
} 