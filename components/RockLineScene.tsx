import React, { useRef, useEffect, useState, Suspense, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, Html, MeshDistortMaterial } from '@react-three/drei';

// Interface for RockSpotlight component props
interface RockSpotlightProps {
  position: [number, number, number] | THREE.Vector3;
  isVisible: boolean;
  color?: string;
}

// Enhanced lighting effect when a rock is hovered
const RockSpotlight = ({ position, isVisible, color = "#80EEFF" }: RockSpotlightProps) => {
  const lightRef = useRef<THREE.PointLight>(null!);
  
  // Animate the light
  useFrame(({ clock }) => {
    if (lightRef.current && isVisible) {
      const t = clock.getElapsedTime();
      // Pulsating intensity
      lightRef.current.intensity = 5 + Math.sin(t * 5) * 2;
    }
  });
  
  if (!isVisible) return null;
  
  return (
    <group position={position as [number, number, number]}>
      {/* Visible light source for debugging */}
      <mesh position={[0, -1.5, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* Point light with high intensity */}
      <pointLight 
        ref={lightRef}
        position={[0, -1.5, 0]} 
        color={color}
        intensity={7}
        distance={10}
        decay={2}
        castShadow
      />
      
      {/* Another point light for extra illumination */}
      <pointLight 
        position={[0, -1, 0.5]} 
        color={color}
        intensity={3}
        distance={5}
        decay={2}
      />
    </group>
  );
};

// Liquid glow effect component - only renders when a rock is hovered
interface LiquidGlowProps {
  isVisible: boolean;
  position: [number, number, number];
  color?: string;
}

const LiquidGlow = ({ isVisible, position, color = "#44EEFF" }: LiquidGlowProps) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [time, setTime] = useState(0);
  
  // Animate the glow when visible
  useFrame(({ clock }) => {
    if (isVisible && meshRef.current) {
      const t = clock.getElapsedTime();
      setTime(t);
      
      // Pulse the scale for breathing effect
      const pulseScale = 1 + Math.sin(t * 2.5) * 0.2;
      meshRef.current.scale.set(2.5 * pulseScale, 2.5 * pulseScale, 0.5 * pulseScale);
    }
  });
  
  // Skip rendering if not visible
  if (!isVisible) return null;
  
  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1], position[2] - 0.5]} // Position behind the rock
      scale={[2.5, 2.5, 0.5]} // Larger and flattened for backdrop effect
    >
      <sphereGeometry args={[1, 32, 32]} />
      <MeshDistortMaterial
        color={color}
        speed={3}
        distort={0.5}
        radius={1}
        transparent
        opacity={0.8}
        emissive={color}
        emissiveIntensity={2.0}
      />
    </mesh>
  );
};

// A clickable rock with hover effect
interface InteractiveRockProps {
  position: [number, number, number];
  model: THREE.Group;
  index: number;
  onRockClick: (index: number) => void;
  setHoveredIndex: (index: number | null) => void;
  isHovered: boolean;
  rotation: [number, number, number];
  scale: number;
  isAnyHovered: boolean;
}

const InteractiveRock = ({ 
  position, 
  model, 
  index, 
  onRockClick, 
  setHoveredIndex, 
  isHovered, 
  rotation,
  scale,
  isAnyHovered
}: InteractiveRockProps) => {
  // Reference to the interactive hitbox and the model
  const hitboxRef = useRef<THREE.Mesh>(null!);
  const modelRef = useRef<THREE.Group>(null!);
  
  // Handle animation
  useFrame(({ clock }) => {
    if (modelRef.current) {
      const t = clock.getElapsedTime();
      
      // Animation parameters
      const floatSpeed = 0.4 + index * 0.05;
      const rotateSpeed = 1 + index * 0.02;
      
      // Floating movement
      modelRef.current.position.y = Math.sin(t * floatSpeed) * 0.1;
      
      // Rotation
      modelRef.current.rotation.x += 0.011 * Math.sin(t * rotateSpeed);
      modelRef.current.rotation.y += 0.011 * Math.sin(t * rotateSpeed * 0.7);
      modelRef.current.rotation.z += 0.01 * Math.sin(t * rotateSpeed * 0.5);
      
      // Brightness effect - dim all rocks except the hovered one
      modelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          // If this rock is hovered, make it bright
          if (isHovered) {
            child.material.emissive = new THREE.Color('#ffffff');
            child.material.emissiveIntensity = 0.7;
          } 
          // If any rock is hovered but not this one, dim this rock
          else if (isAnyHovered) {
            child.material.emissive = new THREE.Color('#000000');
            child.material.emissiveIntensity = 0;
            // Add reduced opacity effect
            if (child.material.opacity !== undefined) {
              child.material.transparent = true;
              child.material.opacity = 0.6;
            }
          } 
          // Normal state - no rock is hovered
          else {
            child.material.emissive = new THREE.Color('#000000');
            child.material.emissiveIntensity = 0;
            // Reset opacity
            if (child.material.opacity !== undefined) {
              child.material.opacity = 1;
            }
          }
        }
      });
      
      // Scale effect when hovered
      if (isHovered) {
        modelRef.current.scale.x = Math.min(modelRef.current.scale.x * 1.005, scale * 1.2);
        modelRef.current.scale.y = Math.min(modelRef.current.scale.y * 1.005, scale * 1.2);
        modelRef.current.scale.z = Math.min(modelRef.current.scale.z * 1.005, scale * 1.2);
      } else {
        modelRef.current.scale.x = Math.max(modelRef.current.scale.x * 0.995, scale);
        modelRef.current.scale.y = Math.max(modelRef.current.scale.y * 0.995, scale);
        modelRef.current.scale.z = Math.max(modelRef.current.scale.z * 0.995, scale);
      }
    }
  });
  
  return (
    <group position={position}>
      {/* The color glow effect behind the rock */}
      <LiquidGlow 
        isVisible={isHovered} 
        position={[0, 0, 0]} 
        color={["#44EEFF", "#44AAFF", "#4488FF", "#5599FF", "#66AAFF"][index % 5]} 
      />
      
      {/* Spotlight effect coming from below */}
      <RockSpotlight 
        position={[0, 0, 0]} 
        isVisible={isHovered} 
        color={["#80EEFF", "#80AAFF", "#8088FF", "#9099FF", "#99AAFF"][index % 5]} 
      />
      
      {/* Invisible hitbox for easier clicking and hover detection */}
      <mesh
        ref={hitboxRef}
        scale={[1.5, 1.5, 1.5]}
        onClick={(e) => {
          e.stopPropagation();
          onRockClick(index);
          console.log(`Rock ${index} clicked!`);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredIndex(index);
          document.body.style.cursor = 'pointer';
          console.log(`Rock ${index} hover start!`);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHoveredIndex(null);
          document.body.style.cursor = 'default';
          console.log(`Rock ${index} hover end!`);
        }}
      >
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial transparent opacity={0.001} />
      </mesh>
      
      {/* The actual rock model */}
      <primitive 
        ref={modelRef} 
        object={model.clone()} 
        rotation={rotation}
        scale={scale}
      />
    </group>
  );
};

// Simplified rock geometry as a fallback
interface SimplifiedRockProps {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  onClick: () => void;
  isAnyHovered?: boolean;
  index?: number;
}

const SimplifiedRock = ({ position, scale, rotation, onClick, isAnyHovered = false, index = 0 }: SimplifiedRockProps) => {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null!);
  
  return (
    <>
      {/* Glow effect */}
      <LiquidGlow 
        isVisible={hovered} 
        position={position} 
        color="#44EEFF" 
      />
      
      {/* Direct spotlight for simplified rock */}
      <RockSpotlight 
        position={position} 
        isVisible={hovered} 
        color={["#80EEFF", "#80AAFF", "#8088FF", "#9099FF", "#99AAFF"][index % 5]} 
      />
      
      <mesh 
        ref={meshRef}
        position={position} 
        scale={hovered ? [scale[0]*1.2, scale[1]*1.2, scale[2]*1.2] : scale} 
        rotation={rotation}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial 
          color={hovered ? "#707070" : "#505050"} 
          roughness={0.8} 
          emissive={hovered ? "#303030" : "#000000"}
          emissiveIntensity={hovered ? 1 : 0}
          transparent={isAnyHovered && !hovered}
          opacity={isAnyHovered && !hovered ? 0.6 : 1}
        />
      </mesh>
    </>
  );
};

// Interface for component props
interface RockLineSceneProps {
  onRockClick?: () => void;
  showConnectingLines?: boolean; // New prop to control connecting lines visibility
}

// Component for displaying the rock line scene
const RockLineScene = ({ onRockClick, showConnectingLines = false }: RockLineSceneProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [rockData, setRockData] = useState<Array<{
    position: [number, number, number];
    scale: number;
    rotation: [number, number, number];
  }>>([]);
  
  // Connecting lines reference
  const connectingLinesRef = useRef<THREE.Group>(null);
  
  // Load the rock model with error handling
  const { scene: originalScene } = useGLTF('/fractured_rock.glb', true, undefined, 
    (error) => {
      console.error("Error loading rock model:", error);
      setLoadError(true);
    }
  );
  
  // Handle rock click
  const handleRockClick = (index: number) => {
    console.log(`Rock ${index} clicked - triggering transition`);
    if (onRockClick) {
      onRockClick();
    }
  };
  
  // Initialize the scene - ensure this only runs once when all resources are ready
  useEffect(() => {
    if (!isInitialized && originalScene && !loadError) {
      console.log("Initializing rock line scene");
      
      try {
        // Position camera to view the line
        camera.position.set(0, 0, 6);
        camera.lookAt(0, 0, 0);
        
        // Create 5 fragments in a row
        const spacing = 1.5; // Distance between fragments
        const totalWidth = spacing * 4; // For 5 fragments
        const startX = -totalWidth / 2;
        
        // Prepare rock data
        const rocks: Array<{
          position: [number, number, number];
          scale: number;
          rotation: [number, number, number];
        }> = [];
        
        // Create data for each rock position
        for (let i = 0; i < 5; i++) {
          try {
            // Position in line
            const x = startX + i * spacing;
            
            // Random scale and rotation
            const scale = 0.4 + Math.random() * 0.2; // Random scale between 0.4 and 0.6
            const rotation: [number, number, number] = [
              Math.random() * Math.PI * 2, 
              Math.random() * Math.PI * 2, 
              Math.random() * Math.PI * 2
            ];
            
            // Store data for this rock
            rocks.push({
              position: [x, 0, 0] as [number, number, number],
              scale: scale,
              rotation: rotation
            });
          } catch (err) {
            console.error(`Error creating rock data ${i}:`, err);
          }
        }
        
        setRockData(rocks);
        setIsInitialized(true);
        console.log("Rock line scene initialized with", rocks.length, "rocks");
      } catch (error) {
        console.error("Error setting up rock line scene:", error);
        setLoadError(true);
      }
    }
  }, [camera, originalScene, isInitialized, loadError]);
  
  // Animate the connecting lines when visible
  useFrame(({ clock }) => {
    if (connectingLinesRef.current && showConnectingLines) {
      const t = clock.getElapsedTime();
      
      // Gently pulse the opacity of the lines
      connectingLinesRef.current.children.forEach((child, i) => {
        if (child instanceof THREE.Line) {
          // @ts-ignore - material opacity exists on LineBasicMaterial
          child.material.opacity = 0.3 + Math.sin(t * 2 + i * 0.5) * 0.2;
          
          // Make line grow from top to bottom
          const progress = Math.min(1, (t % 3) / 1.5); // Repeat every 3 seconds
          // @ts-ignore - geometry is a BufferGeometry
          const positions = child.geometry.attributes.position.array;
          const originalY = 5; // Starting Y position above the scene
          
          // Update the Y position of the starting point (top of the line)
          // This creates an effect of the line growing down from the top
          positions[1] = originalY - progress * (originalY - positions[4]); // Top point Y moves toward bottom point Y
          // @ts-ignore - geometry is a BufferGeometry
          child.geometry.attributes.position.needsUpdate = true;
        }
      });
    }
  });
  
  // Create connecting lines component
  const ConnectingLines = () => {
    const lines = useMemo(() => {
      const linesGroup = new THREE.Group();
      
      if (rockData.length === 0) return linesGroup;
      
      // Create a line for each rock
      rockData.forEach((rock, i) => {
        // Create line geometry from above to rock position
        const lineGeometry = new THREE.BufferGeometry();
        
        // Start from above the scene, end at rock position
        const positions = new Float32Array([
          rock.position[0], 5, rock.position[2], // Top point
          rock.position[0], rock.position[1], rock.position[2] // Rock position
        ]);
        
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // White, minimal line material with slight opacity
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: 0xffffff, 
          opacity: 0.5, 
          transparent: true,
          depthTest: false, // Ensure lines are always visible
        });
        
        // Create the line
        const line = new THREE.Line(lineGeometry, lineMaterial);
        linesGroup.add(line);
      });
      
      return linesGroup;
    }, [rockData]);
    
    return <primitive object={lines} ref={connectingLinesRef} />;
  };
  
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
              scale={scale as [number, number, number]} 
              rotation={rotation as [number, number, number]}
              onClick={() => handleRockClick(i)}
              isAnyHovered={hoveredIndex !== null}
              index={i}
            />
          );
        })}
        
        {/* Connecting lines */}
        {showConnectingLines && <ConnectingLines />}
        
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
        
        {/* Dimmer ambient lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.5} />
        <directionalLight position={[-5, 3, -5]} intensity={0.3} />
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
      
      {/* Interactive rocks with hover effects */}
      {isInitialized && rockData.map((rock, i) => (
        <InteractiveRock
          key={i}
          position={rock.position}
          model={originalScene}
          index={i}
          onRockClick={handleRockClick}
          setHoveredIndex={setHoveredIndex}
          isHovered={hoveredIndex === i}
          isAnyHovered={hoveredIndex !== null}
          rotation={rock.rotation}
          scale={rock.scale}
        />
      ))}
      
      {/* Connecting lines for transition */}
      {showConnectingLines && isInitialized && <ConnectingLines />}
      
      {/* Very dim ambient lighting to make spotlights more visible */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 5, 5]} intensity={0.2} />
      
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