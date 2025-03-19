import { useRef, useEffect, useMemo, ReactNode, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Scroll, useScroll } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, ChromaticAberration, Noise, Glitch } from '@react-three/postprocessing';
import { CameraAnimator } from './CameraAnimator';
import { CustomScrollControls } from './CustomScrollControls';

// Main scrollytelling container that wraps the scene content
interface ScrollytellingSceneProps {
  children: ReactNode;
}

// Use React.memo to prevent unnecessary re-renders
export const ScrollytellingScene = memo(function ScrollytellingScene({ children }: ScrollytellingSceneProps) {
  // Use a stable reference for the key to prevent component recreation
  const stableKey = useMemo(() => "scrollytelling-" + Math.random().toString(36).substring(2, 11), []);
  
  // Wrap content in a useMemo to prevent recreation during hot reloading
  const content = useMemo(() => (
    <CustomScrollControls pages={3}>
      {/* 3D content that will be affected by scroll */}
      <Scroll>
        <SceneContent />
        {children}
        <ScrollPostProcessing />
      </Scroll>
      
      {/* Optional HTML content */}
      <Scroll html style={{ pointerEvents: 'none' }}>
        {/* First scroll section */}
        <div className="scroll-section" style={{ 
          position: 'absolute', 
          top: '0vh', 
          left: '0', 
          width: '100%',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white', 
          fontSize: '2rem',
          pointerEvents: 'none'
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.5)',
            padding: '1rem 2rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h2>Welcome to Odysseia</h2>
            <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>Scroll down to explore</p>
            <div style={{ 
              marginTop: '2rem', 
              fontSize: '1.5rem',
              animation: 'bounce 2s infinite'
            }}>
              ↓
            </div>
          </div>
        </div>
        
        {/* Second scroll section */}
        <div className="scroll-section" style={{ 
          position: 'absolute', 
          top: '100vh', 
          left: '0', 
          width: '100%',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white', 
          fontSize: '2rem',
          pointerEvents: 'none'
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.5)',
            padding: '1rem 2rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h2>Discover the Mystery</h2>
            <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>The floating rock reveals its secrets</p>
          </div>
        </div>
        
        {/* Third scroll section */}
        <div className="scroll-section" style={{ 
          position: 'absolute', 
          top: '200vh', 
          left: '0', 
          width: '100%',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white', 
          fontSize: '2rem',
          pointerEvents: 'none'
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.5)',
            padding: '1rem 2rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h2>Journey's End</h2>
            <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>A new beginning awaits</p>
          </div>
        </div>
      </Scroll>
    </CustomScrollControls>
  ), [children, stableKey]);
  
  return content;
});

// Post processing effects based on scroll position
function ScrollPostProcessing() {
  const scroll = useScroll();
  const offsetRef = useRef(new THREE.Vector2(0, 0));
  
  useFrame(() => {
    // Update the offset vector based on scroll
    offsetRef.current.set(scroll.offset * 0.005, scroll.offset * 0.005);
  });
  
  return (
    <EffectComposer>
      <ChromaticAberration offset={offsetRef.current} />
      <Glitch 
        delay={new THREE.Vector2(1.5, 3.5)}
        duration={new THREE.Vector2(0.1, 0.3)}
        strength={new THREE.Vector2(0.01, 0.03)}
        active={scroll.offset > 0.2}
      />
      <Noise opacity={0.05} />
    </EffectComposer>
  );
}

// Content that responds to scroll position
function SceneContent() {
  return (
    <>
      <CameraAnimator />
      <CloudOverlay />
      <AnimatedRock />
    </>
  );
}

// Cloud overlay effect with rippled edges
function CloudOverlay() {
  const cloudRef = useRef<THREE.Mesh>(null);
  const scroll = useScroll();
  
  // Basic shader material for the cloud effect
  const cloudMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        scrollProgress: { value: 0 },
        color: { value: new THREE.Color('#bbbbbb') }
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
        uniform float scrollProgress;
        uniform vec3 color;
        varying vec2 vUv;
        
        // Simple noise function (simplified for example)
        float noise(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        void main() {
          // Generate noise for edge
          float n = noise(vUv * 10.0 + time * 0.1);
          
          // Create rippled edge effect with noise
          float edgeBottom = smoothstep(0.3, 0.7, vUv.y + n * 0.2);
          float edgeTop = smoothstep(0.0, 0.3, 1.0 - vUv.y + n * 0.1);
          
          // Edge effect gets stronger with scroll
          float edge = mix(1.0, edgeBottom * edgeTop, scrollProgress);
          
          // Fade in based on scroll (starts invisible, becomes visible)
          float opacity = scrollProgress * edge * 0.8;
          
          gl_FragColor = vec4(color, opacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cloudMaterial) {
        cloudMaterial.dispose();
      }
    };
  }, [cloudMaterial]);
  
  useFrame(() => {
    if (cloudRef.current) {
      // Update shader uniforms
      cloudMaterial.uniforms.time.value += 0.01;
      cloudMaterial.uniforms.scrollProgress.value = scroll.offset;
      
      // Position the cloud plane based on scroll
      cloudRef.current.position.z = -10 + scroll.offset * 5;
      cloudRef.current.position.y = -1 + scroll.offset * 2;
      cloudRef.current.rotation.x = scroll.offset * 0.1;
    }
  });
  
  return (
    <mesh ref={cloudRef} position={[0, 0, -10]} rotation={[0, 0, 0]}>
      <planeGeometry args={[80, 60, 1, 1]} />
      <primitive object={cloudMaterial} attach="material" />
    </mesh>
  );
}

// Animated rock that comes from bottom
function AnimatedRock() {
  const rockRef = useRef<THREE.Group>(null);
  const scroll = useScroll();
  
  useFrame(() => {
    if (rockRef.current) {
      // Start rock off-screen at bottom
      const startY = -15;
      // End position slightly above bottom
      const endY = -2;
      
      // Only start animating at 40% scroll
      const scrollThreshold = 0.4;
      const animatableScroll = Math.max(0, (scroll.offset - scrollThreshold) / (1 - scrollThreshold));
      
      // Animation curve - eased entrance when scrolling
      const easedProgress = Math.pow(animatableScroll, 2); // Quadratic easing
      
      // Calculate y position
      const yPos = startY + (endY - startY) * easedProgress;
      
      // Apply position with slight variance based on scroll
      rockRef.current.position.y = yPos;
      
      // Add slight rotation for dynamic feel
      rockRef.current.rotation.x = animatableScroll * 0.2;
      rockRef.current.rotation.z = animatableScroll * 0.15;
      
      // Scale up slightly as it rises
      const scale = 1 + easedProgress * 0.3;
      rockRef.current.scale.set(scale, scale, scale);
    }
  });
  
  return (
    <group ref={rockRef} position={[5, -15, -5]}>
      {/* Simple rock mesh - can be replaced with your existing rock component */}
      <mesh>
        <icosahedronGeometry args={[5, 1]} />
        <meshStandardMaterial 
          color="#666666" 
          roughness={0.9} 
          metalness={0.1}
          flatShading={true}
        />
      </mesh>
    </group>
  );
}