import { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';

// Create fragment positions that look like a fractured rock
const createFragmentData = () => {
  const fragments = [];
  
  // Create central pieces
  const centerPieces = [
    { position: [0, 0, 0], scale: 0.6, rotation: [0, 0, 0] },
    { position: [0.1, 0.05, -0.05], scale: 0.55, rotation: [0.3, 0.5, 0.1] },
    { position: [-0.05, 0.08, 0.08], scale: 0.5, rotation: [-0.2, 0.3, 0.4] },
  ];
  
  // Add central fragments
  centerPieces.forEach(piece => {
    fragments.push({
      position: new THREE.Vector3(...piece.position),
      rotation: new THREE.Euler(...piece.rotation),
      scale: piece.scale,
      floatParams: {
        speed: 0.2 + Math.random() * 0.1,
        amplitude: 0.01 + Math.random() * 0.01,
        offset: Math.random() * Math.PI * 2,
        rotationSpeed: 0.05 + Math.random() * 0.05,
        expansionFactor: 0.2 + Math.random() * 0.1
      }
    });
  });
  
  // Create outer fragments in a spherical pattern
  const numOuterFragments = 9;
  for (let i = 0; i < numOuterFragments; i++) {
    // Calculate position in a spherical arrangement
    const phi = Math.acos(-1 + (2 * i) / numOuterFragments);
    const theta = Math.sqrt(numOuterFragments * Math.PI) * phi;
    
    const x = Math.sin(phi) * Math.cos(theta) * 0.4;
    const y = Math.sin(phi) * Math.sin(theta) * 0.4;
    const z = Math.cos(phi) * 0.4;
    
    fragments.push({
      position: new THREE.Vector3(x, y, z),
      rotation: new THREE.Euler(
        Math.random() * Math.PI, 
        Math.random() * Math.PI, 
        Math.random() * Math.PI
      ),
      scale: 0.3 + Math.random() * 0.2,
      floatParams: {
        speed: 0.3 + Math.random() * 0.2,
        amplitude: 0.02 + Math.random() * 0.01,
        offset: Math.random() * Math.PI * 2,
        rotationSpeed: 0.1 + Math.random() * 0.1,
        expansionFactor: 0.3 + Math.random() * 0.2
      }
    });
  }
  
  return fragments;
};

const FracturedRealRock = () => {
  const { viewport, mouse } = useThree();
  const [hovered, setHovered] = useState(false);
  const [hoveredPiece, setHoveredPiece] = useState<number | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const fragmentsRef = useRef<THREE.Object3D[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);
  const innerLightRef = useRef<THREE.PointLight>(null);
  
  // Create fragments data
  const fragments = useMemo(() => createFragmentData(), []);
  
  // Springs for smooth animation
  const { expansion } = useSpring({
    expansion: hovered ? 1 : 0,
    config: { mass: 1.5, tension: 80, friction: 20 }
  });
  
  const glowSpring = useSpring({
    glow: hovered ? 1 : 0,
    config: { mass: 2, tension: 60, friction: 25 }
  });

  // Handle animations and interactions
  useFrame(({ clock }) => {
    if (!groupRef.current || fragmentsRef.current.length === 0) return;
    
    const t = clock.getElapsedTime();
    const currentExpansion = expansion.get();
    
    // Update fragment positions
    fragmentsRef.current.forEach((fragment, i) => {
      if (!fragment) return;
      
      const data = fragments[i];
      const params = data.floatParams;
      
      // Floating animation
      fragment.position.x = data.position.x + Math.sin(t * params.speed + params.offset) * params.amplitude;
      fragment.position.y = data.position.y + Math.cos(t * params.speed * 1.2 + params.offset) * params.amplitude;
      fragment.position.z = data.position.z + Math.sin(t * params.speed * 0.8 + params.offset * 1.1) * params.amplitude;
      
      // Gentle rotation
      fragment.rotation.x = data.rotation.x + Math.sin(t * params.rotationSpeed) * 0.05;
      fragment.rotation.y = data.rotation.y + Math.cos(t * params.rotationSpeed * 0.7) * 0.05;
      fragment.rotation.z = data.rotation.z + Math.sin(t * params.rotationSpeed * 0.5 + 0.3) * 0.05;
      
      // Expansion on hover
      if (currentExpansion > 0) {
        // Direction from center
        const dir = new THREE.Vector3().copy(data.position).normalize();
        if (dir.length() === 0) {
          dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        }
        
        // Mouse influence
        const mouseX = (mouse.x * viewport.width) / 2;
        const mouseY = (mouse.y * viewport.height) / 2;
        const mouseInfluence = Math.max(0, 1 - (
          Math.abs(fragment.position.x - mouseX) + 
          Math.abs(fragment.position.y - mouseY)
        ) / 2);
        
        // Apply expansion force
        const expandAmount = currentExpansion * params.expansionFactor * (1 + mouseInfluence * 2);
        fragment.position.x += dir.x * expandAmount;
        fragment.position.y += dir.y * expandAmount;
        fragment.position.z += dir.z * expandAmount;
        
        // Subtle attraction to mouse for pieces near cursor
        if (mouseInfluence > 0.3) {
          const attraction = mouseInfluence * 0.02 * currentExpansion;
          fragment.position.x += (mouseX - fragment.position.x) * attraction;
          fragment.position.y += (mouseY - fragment.position.y) * attraction;
        }
      }
    });
    
    // Update lights
    if (lightRef.current) {
      const glowIntensity = glowSpring.glow.get();
      lightRef.current.intensity = 0.5 + glowIntensity * 2.5 + Math.sin(t * 2) * 0.5 * glowIntensity;
      
      const lightRadius = 0.1 + expansion.get() * 0.3;
      lightRef.current.position.x = Math.sin(t * 0.7) * lightRadius;
      lightRef.current.position.y = Math.cos(t * 0.5) * lightRadius;
      lightRef.current.position.z = Math.sin(t * 0.3) * lightRadius;
    }
    
    if (innerLightRef.current) {
      innerLightRef.current.intensity = glowSpring.glow.get() * 3;
    }
  });

  return (
    <group 
      ref={groupRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Render rock fragments */}
      {fragments.map((fragment, i) => {
        // Create a random rock shape for each fragment
        const RockMesh = () => {
          // Choose a random geometry type for each fragment
          const geometryType = Math.floor(Math.random() * 4);
          
          let geometry;
          switch(geometryType) {
            case 0:
              return (
                <mesh>
                  <dodecahedronGeometry args={[0.5, 1]} />
                  <meshStandardMaterial 
                    color="#333333" 
                    roughness={0.75} 
                    metalness={0.2}
                    emissive={hoveredPiece === i ? "#ff6a00" : "#000000"}
                    emissiveIntensity={hoveredPiece === i ? 0.5 : 0}
                  />
                </mesh>
              );
            case 1:
              return (
                <mesh>
                  <octahedronGeometry args={[0.5, 1]} />
                  <meshStandardMaterial 
                    color="#3a3a3a" 
                    roughness={0.8} 
                    metalness={0.15}
                    emissive={hoveredPiece === i ? "#ff6a00" : "#000000"}
                    emissiveIntensity={hoveredPiece === i ? 0.5 : 0}
                  />
                </mesh>
              );
            case 2:
              return (
                <mesh>
                  <icosahedronGeometry args={[0.5, 1]} />
                  <meshStandardMaterial 
                    color="#2a2a2a" 
                    roughness={0.7} 
                    metalness={0.25}
                    emissive={hoveredPiece === i ? "#ff6a00" : "#000000"}
                    emissiveIntensity={hoveredPiece === i ? 0.5 : 0}
                  />
                </mesh>
              );
            default:
              return (
                <mesh>
                  <tetrahedronGeometry args={[0.5, 1]} />
                  <meshStandardMaterial 
                    color="#404040" 
                    roughness={0.85} 
                    metalness={0.1}
                    emissive={hoveredPiece === i ? "#ff6a00" : "#000000"}
                    emissiveIntensity={hoveredPiece === i ? 0.5 : 0}
                  />
                </mesh>
              );
          }
        };
        
        return (
          <animated.group
            key={i}
            ref={(el: THREE.Object3D | null) => el && (fragmentsRef.current[i] = el)}
            position={[fragment.position.x, fragment.position.y, fragment.position.z]}
            rotation={[fragment.rotation.x, fragment.rotation.y, fragment.rotation.z]}
            scale={fragment.scale}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              setHoveredPiece(i);
            }}
            onPointerOut={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              setHoveredPiece(null);
            }}
          >
            <RockMesh />
          </animated.group>
        );
      })}
      
      {/* Light effects */}
      <pointLight
        ref={lightRef}
        color="#ff6a00"
        intensity={0}
        distance={8}
        position={[0, 0, 0]}
        castShadow={false}
      />
      
      <pointLight
        ref={innerLightRef}
        color="#ff6a00"
        intensity={0}
        distance={3}
        position={[0, 0, 0]}
        castShadow={false}
      />
      
      {/* Central glow sphere - only visible when expanded */}
      <animated.mesh scale={expansion.to(e => e * 0.6)}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#ff6a00" transparent opacity={0.3} />
      </animated.mesh>
    </group>
  );
};

export default FracturedRealRock; 