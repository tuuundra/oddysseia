"use client";

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { 
  EffectComposer, 
  ChromaticAberration, 
  Noise, 
  Vignette, 
  Bloom,
  BrightnessContrast
} from '@react-three/postprocessing';
import { BlendFunction, Effect } from 'postprocessing';
import { useSimpleScroll } from './SimpleScrollyControls';

// Custom rectangle displacement shader
class RectangleDisplacementEffect extends Effect {
  constructor({ intensity = 0.5 }) {
    super(
      'RectangleDisplacementEffect',
      /* glsl */`
        uniform float uIntensity;
        uniform float uTime;
        uniform float uScroll;
        
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }
        
        float random2(vec2 st) {
          return fract(sin(dot(st.xy, vec2(42.8765, 35.179))) * 34721.8965);
        }
        
        float random3(vec2 st) {
          return fract(sin(dot(st.xy, vec2(53.6872, 16.947))) * 85237.5429);
        }
        
        float random4(vec2 st) {
          return fract(sin(dot(st.xy, vec2(96.2357, 28.764))) * 73156.2486);
        }
        
        void mainUv(inout vec2 uv) {
          // Removed threshold check so effect starts immediately
          // Less extreme exponential intensity curve so effect is more visible at low scroll
          float strength = pow(uScroll, 1.5) * uIntensity; // Changed from 2.0 to 1.5 for better low-scroll visibility
          
          // Create much more varied grid sizes for more rectangles of different scales
          float cellSize1 = 10.0 + random(vec2(123.45, 678.9)) * 8.0;  // Small blocks
          float cellSize2 = 5.0 + random(vec2(876.12, 345.6)) * 5.0;   // Medium blocks
          float cellSize3 = 15.0 + random(vec2(234.56, 789.0)) * 10.0; // Larger blocks
          float cellSize4 = 3.0 + random(vec2(987.65, 123.4)) * 3.0;   // Very small blocks
          float cellSize5 = 20.0 + random(vec2(456.78, 901.2)) * 15.0; // Extra large blocks
          
          // Stagger the grids with different offsets for more varied placement
          vec2 cell1 = floor(uv * cellSize1);
          vec2 cell2 = floor((uv + vec2(0.31, 0.57)) * cellSize2);
          vec2 cell3 = floor((uv + vec2(0.12, 0.84)) * cellSize3);
          vec2 cell4 = floor((uv + vec2(0.43, 0.21)) * cellSize4);
          vec2 cell5 = floor((uv + vec2(0.76, 0.34)) * cellSize5);
          
          // Get stable random values for each rect with different seeds
          float r1 = random(cell1 * 1.23);
          float r2 = random2(cell2 * 0.78);
          float r3 = random3(cell3 * 1.65);
          float r4 = random4(cell4 * 0.92);
          float r5 = random(cell5 * 1.37);
          
          // Use lower thresholds to get more rectangles
          // And only use orthogonal (right-angle) displacements
          
          // Small blocks - high density
          if (r1 > 0.5) { // 50% of cells show displacement 
            float dispX = (r1 > 0.75) ? (r1 - 0.75) * 4.0 * strength * 0.06 : 0.0; // Only X movement 
            float dispY = (r1 <= 0.75) ? (r1 - 0.5) * 4.0 * strength * 0.04 : 0.0; // Only Y movement
            uv.x += dispX;
            uv.y += dispY;
          }
          
          // Medium blocks
          if (r2 > 0.6) {
            float dispX = (r2 > 0.8) ? (r2 - 0.8) * 5.0 * strength * 0.08 : 0.0;
            float dispY = (r2 <= 0.8 && r2 > 0.6) ? (r2 - 0.6) * 5.0 * strength * 0.06 : 0.0;
            uv.x += dispX;
            uv.y += dispY;
          }
          
          // Larger blocks - lower density but more impactful
          if (r3 > 0.7) {
            float dispX = (r3 > 0.85) ? (r3 - 0.85) * 6.67 * strength * 0.12 : 0.0;
            float dispY = (r3 <= 0.85 && r3 > 0.7) ? (r3 - 0.7) * 6.67 * strength * 0.09 : 0.0;
            uv.x += dispX;
            uv.y += dispY;
          }
          
          // Very small blocks - very high density for subtle texture
          if (r4 > 0.4) {
            float dispX = (r4 > 0.7) ? (r4 - 0.7) * 3.33 * strength * 0.03 : 0.0;
            float dispY = (r4 <= 0.7 && r4 > 0.4) ? (r4 - 0.4) * 3.33 * strength * 0.02 : 0.0;
            uv.x += dispX;
            uv.y += dispY;
          }
          
          // Extra large blocks - very low density but dramatic
          if (r5 > 0.85) {
            float dispX = (r5 > 0.925) ? (r5 - 0.925) * 13.33 * strength * 0.15 : 0.0;
            float dispY = (r5 <= 0.925 && r5 > 0.85) ? (r5 - 0.85) * 13.33 * strength * 0.12 : 0.0;
            uv.x += dispX;
            uv.y += dispY;
          }
        }
      `,
      {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map([
          ['uIntensity', new THREE.Uniform(intensity)],
          ['uTime', new THREE.Uniform(0)],
          ['uScroll', new THREE.Uniform(0)]
        ])
      }
    );
  }
  
  update(renderer, inputBuffer, deltaTime) {
    // No animation - static rectangles
  }
}

// Custom rectangle displacement effect component 
function RectDisplacement({ intensity }) {
  const { offset } = useSimpleScroll();
  const effectRef = useRef(null);
  
  useFrame(() => {
    if (effectRef.current) {
      // Add a small threshold before effect begins (5% scroll)
      // Then scale between 5% and 30% for full effect
      // Freeze the effect at 0.17 offset if scrolled past that point
      const threshold = 0.05;
      const maxOffset = 0.17; // Lock effects at this offset value
      const clampedOffset = Math.min(offset, maxOffset); // Never exceed 0.17
      const normalizedOffset = Math.max(0, (clampedOffset - threshold) / (0.3 - threshold));
      const scaledOffset = Math.min(normalizedOffset, 1);
      effectRef.current.uniforms.get('uScroll').value = scaledOffset;
    }
  });
  
  return <primitive ref={effectRef} object={new RectangleDisplacementEffect({ intensity })} />;
}

// Custom directional gradient chromatic aberration effect
class GradientChromaticEffect extends Effect {
  constructor({ intensity = 0.5 }) {
    super(
      'GradientChromaticEffect',
      /* glsl */`
        uniform float uIntensity;
        uniform float uTime;
        uniform float uScroll;
        
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          vec2 center = vec2(0.5);
          
          // Direction vectors pointing outward from edges
          vec2 dir = normalize(uv - center);
          float distFromCenter = length(uv - center);
          
          // Create different displacement intensities based on scroll
          float strength = uScroll * uIntensity; // Linear scale for immediate visibility
          
          // Sample original image
          vec4 original = inputColor;
          
          // Only apply effect to edges - stronger edge bias
          float edgeBias = smoothstep(0.5, 0.95, distFromCenter); // Changed from 0.65 to 0.5 for wider effect
          
          // Apply effect everywhere at low strength, stronger near edges
          // Removed check that would skip processing for center areas
          
          // Create multiple offset samples with different displacements
          vec3 finalColor = vec3(0.0);
          int samples = 12; // Good balance for visible streaks without excess
          
          // Vibrant color palette
          vec3 colors[9];
          colors[0] = vec3(1.0, 0.2, 0.5);  // Hot pink
          colors[1] = vec3(0.2, 0.8, 1.0);  // Bright cyan
          colors[2] = vec3(1.0, 0.8, 0.1);  // Bright yellow
          colors[3] = vec3(0.3, 0.9, 1.0);  // Electric cyan
          colors[4] = vec3(1.0, 0.3, 0.8);  // Magenta
          colors[5] = vec3(1.0, 0.7, 0.3);  // Gold
          colors[6] = vec3(0.5, 0.9, 0.2);  // Lime
          colors[7] = vec3(0.6, 0.4, 1.0);  // Purple
          colors[8] = vec3(1.0, 0.5, 0.2);  // Orange
          
          // Accumulate samples with different displacements and colors
          for (int i = 0; i < samples; i++) {
            // Create varied offset for each sample
            float factor = float(i) / float(samples - 1);
            float waveOffset = sin(uTime * 0.3 + factor * 6.28) * 0.5 + 0.5;
            
            // Exponential displacement for strong edge streaks
            float scale = 0.01 + pow(factor, 1.2) * 0.12; // Non-linear scaling for longer streaks
            
            // Create more directional streaks
            vec2 offset = dir * strength * scale * (1.0 + waveOffset * 0.5);
            if (i % 2 == 1) offset = -offset * 0.8;
            
            // Color index cycling
            int colorIndex = i % 9;
            
            // Sample the texture with this offset
            vec3 sampleColor = texture2D(inputBuffer, uv + offset).rgb;
            
            // Apply color tint from our palette - only at edges
            float colorStrength = strength * edgeBias * 0.9;
            sampleColor = mix(sampleColor, sampleColor * colors[colorIndex], colorStrength);
            
            // Add to the accumulation with distance-based weighting
            finalColor += sampleColor * (0.4 + factor * 0.8); // Higher weights for farther streaks
          }
          
          // Normalize the final color
          finalColor /= float(samples) * 0.7;
          
          // Reduce the base effect to nearly zero so it doesn't show at start
          // Then strengthen at edges as scroll increases
          float mixFactor = min(1.0, strength * edgeBias * 2.0);
          
          // Mix original with streaks
          outputColor.rgb = mix(original.rgb, finalColor, mixFactor);
          outputColor.a = original.a;
        }
      `,
      {
        blendFunction: BlendFunction.NORMAL, // Back to NORMAL to avoid brightening
        uniforms: new Map([
          ['uIntensity', new THREE.Uniform(intensity)],
          ['uTime', new THREE.Uniform(0)],
          ['uScroll', new THREE.Uniform(0)]
        ])
      }
    );
  }
  
  update(renderer, inputBuffer, deltaTime) {
    this.uniforms.get('uTime').value += deltaTime;
  }
}

// Update the component
function GradientChromatic({ intensity }) {
  const { offset } = useSimpleScroll();
  const effectRef = useRef(null);
  
  useFrame(({ clock }) => {
    if (effectRef.current) {
      effectRef.current.uniforms.get('uTime').value = clock.getElapsedTime();
      
      // Adjusted to start later and ramp up more gradually
      // Start at 0.07 instead of 0.05, and stretch transition over a longer range
      const threshold = 0.07;
      const maxOffset = 0.17; // Lock effects at this offset value
      const clampedOffset = Math.min(offset, maxOffset); // Never exceed 0.17
      
      // Use a wider range for more gradual appearance
      const normalizedOffset = Math.max(0, (clampedOffset - threshold) / (0.25 - threshold));
      
      // Apply easing for more gradual start - use quadratic easing
      const easedOffset = Math.pow(normalizedOffset, 2) * Math.min(normalizedOffset, 1);
      
      effectRef.current.uniforms.get('uScroll').value = easedOffset;
    }
  });
  
  return <primitive ref={effectRef} object={new GradientChromaticEffect({ intensity })} />;
}

// Effects that intensify with scroll
export function ScrollPostEffects() {
  const { offset } = useSimpleScroll();
  
  // Add a small threshold before effects begin (5% scroll)
  // Then scale between 5% and 30% for full effect
  // Freeze the effect at 0.17 offset if scrolled past that point
  const threshold = 0.05;
  const maxOffset = 0.17; // Lock effects at this offset value
  const clampedOffset = Math.min(offset, maxOffset); // Never exceed 0.17
  const normalizedOffset = Math.max(0, (clampedOffset - threshold) / (0.3 - threshold));
  const scaledOffset = Math.min(normalizedOffset, 1);
  
  return (
    <EffectComposer>
      {/* In EffectComposer, lower effects are rendered first (behind) and upper effects are rendered last (in front) */}
      {/* Vignette */}
      <Vignette
        offset={0.1 + scaledOffset * 0.2} 
        darkness={0.45 + scaledOffset * 0.45} // Start lower, increase with scroll
      />
      
      {/* Keep contrast */}
      <BrightnessContrast 
        brightness={0} 
        contrast={0.08 + scaledOffset * 0.32} // Start lower, increase with scroll
      />
      
      {/* Film grain/noise that intensifies with scroll */}
      <Noise opacity={0.05 + scaledOffset * 0.15} /> 
      
      {/* Bloom effect for the glowing edges */}
      <Bloom 
        intensity={0.3 + scaledOffset * 1.1} // Start at lower value, increase with scroll
        luminanceThreshold={0.2} 
        luminanceSmoothing={0.9}
        height={300}
      />
      
      {/* Edge-based gradient chromatic aberration is now behind displacement */}
      <GradientChromatic intensity={2.2} />
      
      {/* Rectangle displacement is now applied last (on top) */}
      <RectDisplacement intensity={1.0} />
    </EffectComposer>
  );
}

// Cloud overlay that fades in with scroll - enhanced for dreamier effect
export function CloudOverlay() {
  const { offset } = useSimpleScroll();
  const cloudRef = useRef();
  const materialRef = useRef();
  
  // Create and update shader material
  useEffect(() => {
    if (!cloudRef.current) return;
    
    // Create cloud material with edge fade effect
    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        time: { value: 0 },
        scroll: { value: 0 },
        color: { value: new THREE.Color('#a9c0e3') } // More blue-tinted fog color
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
        uniform float scroll;
        uniform vec3 color;
        varying vec2 vUv;
        
        // Simple noise function for edge randomization
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        // Improved noise function for dreamier effect
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f); // Smoothstep
          
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        
        void main() {
          // Generate more complex noise for dreamier effect
          float n1 = noise(vUv * 5.0 + time * 0.05);
          float n2 = noise(vUv * 15.0 - time * 0.1);
          float n = n1 * 0.7 + n2 * 0.3;
          
          // Create rippled edge effect with better noise
          float edgeBottom = smoothstep(0.2, 0.6, vUv.y + n * 0.3);
          float edgeTop = smoothstep(0.0, 0.4, 1.0 - vUv.y + n * 0.2);
          
          // Edge effect gets stronger with scroll
          float edge = mix(1.0, edgeBottom * edgeTop, scroll);
          
          // Add color variation for more atmosphere
          vec3 finalColor = color + vec3(n * 0.1, n * 0.05, n * 0.2); // Subtle purple/blue shifts
          
          // Fade in based on scroll - stronger effect
          float opacity = scroll * edge * 0.9;
          
          gl_FragColor = vec4(finalColor, opacity);
        }
      `
    });
    
    materialRef.current = material;
    cloudRef.current.material = material;
  }, []);
  
  // Update cloud position and shader uniforms
  useFrame(({ clock }) => {
    if (cloudRef.current && materialRef.current) {
      const time = clock.getElapsedTime();
      
      // Start cloud effect even earlier but fade out faster
      const threshold = 0.02;
      const fadeOutStart = 0.1; // Start fading out much earlier (was 0.15)
      
      // Freeze the effect at 0.17 offset if scrolled past that point
      const maxOffset = 0.17; // Lock effects at this offset value
      const clampedOffset = Math.min(offset, maxOffset); // Never exceed 0.17
      
      let scaledOffset = 0;
      if (clampedOffset <= threshold) {
        scaledOffset = 0;
      } else if (clampedOffset <= fadeOutStart) {
        // Ramp up quickly
        scaledOffset = (clampedOffset - threshold) / (fadeOutStart - threshold);
      } else {
        // Fade out quickly as oscillating grid takes over
        scaledOffset = Math.max(0, 1 - (clampedOffset - fadeOutStart) / 0.05); // Faster fadeout (was 0.1)
      }
      
      // Update material uniforms
      materialRef.current.uniforms.time.value = time;
      materialRef.current.uniforms.scroll.value = scaledOffset;
      
      // Position and rotation tied to scroll - more pronounced movement
      cloudRef.current.position.z = -10 + scaledOffset * 8;
      cloudRef.current.position.y = -1 + scaledOffset * 3;
      cloudRef.current.rotation.x = scaledOffset * 0.15;
      
      // Hide completely when fully faded out
      cloudRef.current.visible = scaledOffset > 0.01;
    }
  });
  
  return (
    <mesh 
      ref={cloudRef} 
      position={[0, 0, -10]} 
      rotation={[0, 0, 0]}
    >
      <planeGeometry args={[100, 70]} />
    </mesh>
  );
}

// Rock that appears when scrolling past a threshold
export function ScrollRock() {
  const { offset } = useSimpleScroll();
  const rockRef = useRef();
  
  useFrame(() => {
    if (!rockRef.current) return;
    
    // Start appearing immediately and complete by 30% scroll
    // Freeze the effect at 0.17 offset if scrolled past that point
    const threshold = 0.05; // Start just a bit after scroll begins
    const maxOffset = 0.17; // Lock effects at this offset value
    const clampedOffset = Math.min(offset, maxOffset); // Never exceed 0.17
    const progress = Math.max(0, (clampedOffset - threshold) / (0.25)); // Complete by 30% scroll
    const clampedProgress = Math.min(progress, 1); // Ensure it doesn't exceed 1
    
    // Quadratic easing for smoother motion
    const eased = Math.pow(clampedProgress, 2);
    
    // Animate from below to visible position
    const startY = -15;
    const endY = -2;
    rockRef.current.position.y = startY + (endY - startY) * eased;
    
    // Add rotation for visual interest
    rockRef.current.rotation.x = clampedProgress * 0.1;
    rockRef.current.rotation.z = clampedProgress * 0.15;
    
    // Scale up slightly as it rises
    const scale = 1 + eased * 0.3;
    rockRef.current.scale.set(scale, scale, scale);
  });
  
  return (
    <group ref={rockRef} position={[5, -15, -5]}>
      <mesh>
        <icosahedronGeometry args={[5, 1]} />
        <meshStandardMaterial 
          color="#666666" 
          roughness={0.7}
          metalness={0.2}
          flatShading
        />
      </mesh>
    </group>
  );
} 