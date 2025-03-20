"use client";

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useSimpleScroll } from './SimpleScrollyControls';

export default function MistTransition({ transitionPoint = 0.1, duration = 0.05 }) {
  const { offset } = useSimpleScroll();
  const { viewport } = useThree();
  const materialRef = useRef();
  const meshRef = useRef();
  
  // Calculate transition progress
  const transitionProgress = useMemo(() => {
    // Start earlier for a more gradual transition 
    const startPoint = transitionPoint;
    const endPoint = transitionPoint + duration;
    
    if (offset <= startPoint) return 0;
    if (offset >= endPoint) return 1;
    
    // Use a more dramatic easing function for the pulling effect
    const progress = (offset - startPoint) / (endPoint - startPoint);
    
    // Stronger ease-in-out curve with extra acceleration at the beginning
    // This creates a "slow start, fast middle, slow end" effect
    return progress < 0.4 
      ? 9 * Math.pow(progress, 3) // Even stronger acceleration at start
      : progress > 0.7 
        ? 1 - Math.pow(-2 * progress + 2, 2) / 2 // Deceleration at end
        : 0.5 + (progress - 0.5) * 1.7; // Faster in the middle
  }, [offset, transitionPoint, duration]);
  
  // Create noise texture for the mist effect
  const noiseTexture = useMemo(() => {
    const size = 512; // Higher resolution for more detailed clouds
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fill with black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, size, size);
    
    // Add noise - this creates a fractal noise pattern that will form our mist
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    // Create multi-scale noise for a cloudy effect
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        
        // Generate fractal noise at different scales
        let value = 0;
        let scale = 1;
        let totalScale = 0;
        
        // Add several octaves of noise with more detail
        for (let octave = 0; octave < 8; octave++) { // More octaves for detail
          const frequency = Math.pow(2, octave) / size;
          const amplitude = Math.pow(0.5, octave);
          
          // Simple Perlin-like noise approximation
          const nx = x * frequency;
          const ny = y * frequency;
          const noise = simplex2D(nx, ny);
          
          value += noise * amplitude;
          totalScale += amplitude;
          scale *= 0.5;
        }
        
        // Normalize and apply
        value = (value / totalScale) * 0.5 + 0.5;
        
        // Add some vertical gradient to ensure bottom-up appearance
        // Stronger gradient effect weighted toward bottom of screen
        const verticalGradient = Math.pow(y / size, 1.2); // Less dramatic to show more cloud detail
        value = Math.max(value, verticalGradient * 0.8); // Allow more noise detail to show through
        
        // Add more varied shapes at the edges for frayed cloud look
        if (value > 0.3 && value < 0.7) {
          value += (Math.random() * 0.3 - 0.15); // More variation
        }
        
        // Convert to byte
        const byteValue = Math.floor(value * 255);
        
        // Set RGB to same value for grayscale
        data[i] = byteValue;     // R
        data[i + 1] = byteValue; // G
        data[i + 2] = byteValue; // B
        data[i + 3] = 255;       // A (fully opaque)
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }, []);
  
  // Simple pseudo-random noise function with more octaves
  function simplex2D(x, y) {
    // More complex noise function for better cloud detail
    return (Math.sin(x * 12.9898 + y * 78.233) * 
            Math.cos(x * 43.2341 + y * 22.569) * 
            Math.sin((x + y) * 31.9898) * 
            Math.cos(x * y * 0.5)) * 0.5;
  }
  
  // Create the transition shader
  useEffect(() => {
    if (!meshRef.current) return;
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        progress: { value: 0 },
        noiseTexture: { value: noiseTexture },
        resolution: { value: new THREE.Vector2(viewport.width, viewport.height) }
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
        uniform float progress;
        uniform sampler2D noiseTexture;
        uniform vec2 resolution;
        varying vec2 vUv;
        
        // Improved fractal noise function for more realistic clouds
        float fractalNoise(vec2 uv, float time) {
          // Sample noise at different frequencies, amplitudes, and time offsets for more natural look
          float noise1 = texture2D(noiseTexture, uv * 0.8 + vec2(time * 0.01, time * 0.02)).r;
          float noise2 = texture2D(noiseTexture, uv * 1.5 + vec2(time * 0.02, -time * 0.01)).r;
          float noise3 = texture2D(noiseTexture, uv * 3.0 + vec2(-time * 0.03, time * 0.01)).r;
          float noise4 = texture2D(noiseTexture, uv * 6.0 + vec2(time * 0.01, time * 0.02)).r;
          
          // Combine noises with varying weights for natural appearance
          return noise1 * 0.5 + noise2 * 0.25 + noise3 * 0.15 + noise4 * 0.1;
        }
        
        // Cubic ease-in function for acceleration
        float easeInCubic(float x) {
          return x * x * x;
        }
        
        // Cubic ease-out function for deceleration
        float easeOutCubic(float x) {
          return 1.0 - pow(1.0 - x, 3.0);
        }
        
        // Custom easing function for the dramatic pull effect
        float dramaticPull(float x) {
          // Start extremely slow, then accelerate rapidly for dramatic effect
          if (x < 0.3) {
            return easeInCubic(x / 0.3) * 0.2; // Very slow start
          } else if (x < 0.7) {
            return 0.2 + (x - 0.3) * 1.5; // Rapid acceleration in middle
          } else {
            return 0.8 + easeOutCubic((x - 0.7) / 0.3) * 0.2; // Smooth finish
          }
        }
        
        void main() {
          // Calculate aspect-corrected UV coordinates
          float aspect = resolution.x / resolution.y;
          vec2 uv = vUv;
          uv.x *= aspect;
          
          // Multi-layer cloud noise with more detail and movement
          float noise = fractalNoise(uv * 1.2, time * 0.2); // Base cloud layer
          float detailNoise = fractalNoise(uv * 3.0, time * 0.1); // Detailed fine cloud layer
          
          // More dramatic pull-up effect with custom easing
          float pullProgress = dramaticPull(progress);
          
          // Map to position with MUCH more dramatic sweep from well below
          // Start at -1.2 (well below viewport) and end at 1.8 (well above)
          float basePosition = mix(-1.2, 1.8, pullProgress);
          
          // Multiple layers of waves with different frequencies for a natural cloud edge
          // Increased amplitude for more dramatic waves
          float primaryWave = sin(uv.x * 3.0 + time * 0.2) * 0.25;
          float secondaryWave = cos(uv.x * 6.5 - time * 0.15) * 0.18;
          float tertiaryWave = sin(uv.x * 10.0 + time * 0.1) * 0.12;
          float quaternaryWave = cos(uv.x * 20.0 - time * 0.05) * 0.07;
          
          // Combine waves for a complex, natural edge with more extreme variation
          float edgeOffset = primaryWave + secondaryWave + tertiaryWave + quaternaryWave;
          
          // Apply cloud shape distortion that varies with noise
          // This creates more pronounced cloud tendrils at the edge
          float cloudHeight = basePosition;
          
          // First apply general cloud shape with noise
          cloudHeight += edgeOffset;
          
          // Then apply dynamic distortion based on noise values
          // More extreme distortion in mid noise values creates a "cauliflower" cloud look
          if (noise > 0.3 && noise < 0.7) {
            // Enhanced distortion for a natural, billowy look
            float noiseDistortion = (noise - 0.3) * 2.5; // Amplify the middle range
            cloudHeight -= noiseDistortion * 0.5; // More extreme distortion
          }
          
          // Apply detail noise for fine structure at the cloud edge
          if (detailNoise > 0.4 && detailNoise < 0.6) {
            cloudHeight -= (detailNoise - 0.4) * 0.25; // More noticeable fine details
          }
          
          // Calculate distance to cloud edge with more detail
          float distance = uv.y - cloudHeight;
          
          // Create a wider gradient zone for a more visible cloudy transition
          float cloudWidth = 0.5; // Even wider for a more billowy appearance
          
          // Calculate cloud opacity with a softer gradient for the dramatic transition zone
          float baseOpacity = 1.0 - smoothstep(-cloudWidth, cloudWidth * 0.7, distance);
          
          // Add additional cloudy details with varied time-based movement
          float cloudDetail = fractalNoise(uv * 2.5, time * 0.15);
          
          // Create more visible noise details in the cloud edge for a frayed look
          float transitionZone = smoothstep(-cloudWidth * 1.8, cloudWidth * 0.5, distance);
          float cloudOpacity = mix(baseOpacity, baseOpacity * (0.5 + cloudDetail * 1.0), transitionZone);
          
          // Add stronger vertical gradient to ensure bottom is more opaque
          // This helps with the pulling-up effect to always keep the bottom solid
          cloudOpacity = mix(cloudOpacity, 1.0, max(0.0, 0.6 - uv.y) * 2.0);
          
          // Output the final mask
          gl_FragColor = vec4(1.0, 1.0, 1.0, cloudOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false
    });
    
    materialRef.current = material;
    meshRef.current.material = material;
  }, [noiseTexture, viewport]);
  
  // Animate the transition
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
      materialRef.current.uniforms.progress.value = transitionProgress;
    }
  });
  
  return (
    <mesh 
      ref={meshRef} 
      position={[0, 0, 10]} // In front of everything
      renderOrder={1000} // Ensure it renders last
    >
      <planeGeometry args={[viewport.width * 1.5, viewport.height * 1.5]} />
    </mesh>
  );
} 