import React, { useRef, useEffect, useState, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, Html } from '@react-three/drei';

// Simplified rock geometry as a fallback
const SimplifiedRock = ({ position, scale, rotation, onClick }: any) => {
  return (
    <mesh 
      position={position} 
      scale={scale} 
      rotation={rotation}
      onClick={onClick}
      onPointerOver={() => document.body.style.cursor = 'pointer'}
      onPointerOut={() => document.body.style.cursor = 'default'}
    >
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#505050" roughness={0.8} />
    </mesh>
  );
};

// Interface for component props
interface RockLineSceneProps {
  onRockClick?: () => void;
}

// Component for displaying the rock line scene
const RockLineScene = ({ onRockClick }: RockLineSceneProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Load the rock model with error handling
  const { scene: originalScene } = useGLTF('/fractured_rock.glb', true, undefined, 
    (error) => {
      console.error("Error loading rock model:", error);
      setLoadError(true);
    }
  );
  
  // Create fragments for the line
  const fragments = useRef<THREE.Group[]>([]);
  
  // Handle rock click
  const handleRockClick = (index: number) => {
    console.log(`Rock ${index} clicked`);
    if (onRockClick) {
      onRockClick();
    }
  };
  
  // Initialize the scene - ensure this only runs once when all resources are ready
  useEffect(() => {
    if (!isInitialized && groupRef.current && originalScene && !loadError) {
      console.log("Initializing rock line scene");
      
      try {
        // Position camera to view the line
        camera.position.set(0, 0, 6);
        camera.lookAt(0, 0, 0);
        
        // Create 5 fragments in a row
        const spacing = 1.5; // Distance between fragments
        const totalWidth = spacing * 4; // For 5 fragments
        const startX = -totalWidth / 2;
        
        // Clear any existing fragments
        fragments.current = [];
        
        // Create clone of the rock fragments for each position
        for (let i = 0; i < 5; i++) {
          try {
            // Clone the model
            const clone = originalScene.clone();
            
            // Position in line
            const x = startX + i * spacing;
            clone.position.set(x, 0, 0);
            
            // Scale the fragments
            const scale = 0.4 + Math.random() * 0.2; // Random scale between 0.4 and 0.6
            clone.scale.set(scale, scale, scale);
            
            // Add rotation
            clone.rotation.set(
              Math.random() * Math.PI * 2, 
              Math.random() * Math.PI * 2, 
              Math.random() * Math.PI * 2
            );
            
            // Add to scene and store reference
            groupRef.current.add(clone);
            fragments.current.push(clone);
            
            // Add click handler to each fragment
            clone.userData.index = i;
            clone.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                // Add the child to interactive objects
                child.userData.index = i;
                
                // Make the mesh clickable
                // @ts-ignore - we're adding properties safely here
                child.onClick = (event) => {
                  event.stopPropagation();
                  handleRockClick(i);
                };
                
                // Add hover effects
                // @ts-ignore
                child.onPointerOver = () => {
                  setHoveredIndex(i);
                  document.body.style.cursor = 'pointer';
                };
                
                // @ts-ignore
                child.onPointerOut = () => {
                  setHoveredIndex(null);
                  document.body.style.cursor = 'default';
                };
              }
            });
          } catch (err) {
            console.error(`Error creating fragment ${i}:`, err);
          }
        }
        
        setIsInitialized(true);
        console.log("Rock line scene initialized with", fragments.current.length, "fragments");
      } catch (error) {
        console.error("Error setting up rock line scene:", error);
        setLoadError(true);
      }
    }
  }, [camera, originalScene, isInitialized, loadError, onRockClick]);
  
  // Animate the fragments with subtle floating
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Safely animate fragments if they exist
    if (fragments.current.length > 0) {
      fragments.current.forEach((fragment, index) => {
        if (fragment) {
          try {
            // Unique animation parameters for each fragment
            const floatSpeed = 0.3 + index * 0.05;
            const rotateSpeed = 0.1 + index * 0.02;
            
            // Floating movement
            fragment.position.y = Math.sin(t * floatSpeed) * 0.1;
            
            // Slow rotation
            fragment.rotation.x += 0.001 * Math.sin(t * rotateSpeed);
            fragment.rotation.y += 0.001 * Math.sin(t * rotateSpeed * 0.7);
            fragment.rotation.z += 0.001 * Math.sin(t * rotateSpeed * 0.5);
            
            // Add slight scale effect when hovered
            if (hoveredIndex === index) {
              fragment.scale.multiplyScalar(1.005);
            } else if (fragment.scale.x > 0.6) {
              fragment.scale.multiplyScalar(0.995);
            }
          } catch (err) {
            // Silently ignore animation errors
          }
        }
      });
    }
  });
  
  // Render fallback rocks if there was an error loading the model
  if (loadError) {
    return (
      <>
        <color attach="background" args={['#000000']} />
        
        {/* Fallback rocks */}
        {Array.from({ length: 5 }).map((_, i) => {
          const spacing = 1.5;
          const totalWidth = spacing * 4;
          const startX = -totalWidth / 2;
          const x = startX + i * spacing;
          const scale = [0.4 + Math.random() * 0.2, 0.4 + Math.random() * 0.2, 0.4 + Math.random() * 0.2];
          const rotation = [
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
          ];
          
          return (
            <SimplifiedRock 
              key={i} 
              position={[x, 0, 0]} 
              scale={scale} 
              rotation={rotation}
              onClick={() => handleRockClick(i)}
            />
          );
        })}
        
        {/* Click instruction text */}
        <Html center position={[0, 1.5, 0]}>
          <div style={{ 
            color: 'white', 
            fontSize: '16px',
            fontFamily: 'var(--font-courier-prime), monospace',
            textAlign: 'center',
            padding: '10px',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: '5px',
            pointerEvents: 'none'
          }}>
            Click a rock to return
          </div>
        </Html>
        
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-5, 3, -5]} intensity={0.4} />
      </>
    );
  }
  
  return (
    <Suspense fallback={
      <Html center>
        <div style={{ color: 'white', background: 'rgba(0,0,0,0.7)', padding: '20px', borderRadius: '5px' }}>
          Loading scene...
        </div>
      </Html>
    }>
      {/* Black background */}
      <color attach="background" args={['#000000']} />
      
      {/* Container for fragments */}
      <group ref={groupRef} position={[0, 0, 0]}>
        {/* Fragments will be added dynamically */}
      </group>
      
      {/* Click instruction text */}
      <Html center position={[0, 1.5, 0]}>
        <div style={{ 
          color: 'white', 
          fontSize: '16px',
          fontFamily: 'var(--font-courier-prime), monospace',
          textAlign: 'center',
          padding: '10px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '5px',
          pointerEvents: 'none'
        }}>
          Click a rock to return
        </div>
      </Html>
      
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} />
    </Suspense>
  );
};

// Attempt to preload the model with error handling
try {
  useGLTF.preload('/fractured_rock.glb', true);
} catch (err) {
  console.error("Error preloading rock model:", err);
}

export default RockLineScene; 