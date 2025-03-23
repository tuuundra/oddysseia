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
      },
      glowParams: {
        strength: 0,
        baseColor: new THREE.Color('#ff6a00'), // Orange glow color
        activeColor: new THREE.Color('#ff3300'), // Brighter color for direct hover
        diffusionSpeed: 0.1 + Math.random() * 0.05
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
      },
      glowParams: {
        strength: 0,
        baseColor: new THREE.Color('#ff6a00'), // Orange glow color
        activeColor: new THREE.Color('#ff3300'), // Brighter color for direct hover
        diffusionSpeed: 0.1 + Math.random() * 0.05
      }
    });
  }
  
  return fragments;
};

const FracturedRealRock = () => {
  const { viewport, mouse, camera } = useThree();
  const [hovered, setHovered] = useState(false);
  const [hoveredPiece, setHoveredPiece] = useState<number | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const fragmentsRef = useRef<THREE.Object3D[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);
  const innerLightRef = useRef<THREE.PointLight>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mousePos = useRef(new THREE.Vector2());
  
  // Create fragments data
  const fragments = useMemo(() => createFragmentData(), []);

  // Precalculate distances between fragments for diffusion
  const neighborMap = useMemo(() => {
    const map = new Map<number, {index: number, distance: number}[]>();
    
    fragments.forEach((fragment, i) => {
      const neighbors: {index: number, distance: number}[] = [];
      
      fragments.forEach((otherFragment, j) => {
        if (i !== j) {
          const distance = fragment.position.distanceTo(otherFragment.position);
          neighbors.push({ index: j, distance });
        }
      });
      
      // Sort by distance and keep nearest neighbors
      neighbors.sort((a, b) => a.distance - b.distance);
      map.set(i, neighbors.slice(0, 5)); // Keep top 5 nearest neighbors
    });
    
    return map;
  }, [fragments]);
  
  // Springs for smooth animation
  const { expansion } = useSpring({
    expansion: hovered ? 1 : 0,
    config: { mass: 1.5, tension: 80, friction: 20 }
  });
  
  const glowSpring = useSpring({
    glow: hovered ? 1 : 0,
    config: { mass: 2, tension: 60, friction: 25 }
  });

  // Update mouse position for raycaster
  useFrame(({ mouse }) => {
    mousePos.current.set(mouse.x, mouse.y);
  });

  // Handle ray casting for precise hover detection
  useEffect(() => {
    const checkIntersections = () => {
      if (!groupRef.current || fragmentsRef.current.length === 0) return;
      
      raycasterRef.current.setFromCamera(mousePos.current, camera);
      
      // Collect all meshes from fragments
      const meshes: THREE.Object3D[] = [];
      fragmentsRef.current.forEach((fragment, index) => {
        if (fragment) {
          fragment.traverse(child => {
            if (child instanceof THREE.Mesh) {
              // Store the fragment index on the mesh for identification
              (child as any).fragmentIndex = index;
              meshes.push(child);
            }
          });
        }
      });
      
      const intersects = raycasterRef.current.intersectObjects(meshes);
      
      if (intersects.length > 0) {
        const fragmentIndex = (intersects[0].object as any).fragmentIndex;
        setHoveredPiece(fragmentIndex);
        setHovered(true);
      } else {
        setHoveredPiece(null);
        setHovered(false);
      }
    };
    
    window.addEventListener('mousemove', checkIntersections);
    return () => window.removeEventListener('mousemove', checkIntersections);
  }, [camera]);

  // Handle animations and interactions
  useFrame(({ clock }) => {
    if (!groupRef.current || fragmentsRef.current.length === 0) return;
    
    const t = clock.getElapsedTime();
    const currentExpansion = expansion.get();
    
    // Reset all glow strengths first for re-calculation
    fragments.forEach(fragment => {
      // Decay existing glow
      fragment.glowParams.strength *= 0.95; // Gradual decay
    });
    
    // Set glow strength for hovered piece
    if (hoveredPiece !== null) {
      fragments[hoveredPiece].glowParams.strength = 1.0;
      
      // Diffuse glow to neighbors
      const neighbors = neighborMap.get(hoveredPiece) || [];
      neighbors.forEach(neighbor => {
        // Calculate diffusion strength based on distance
        const diffusionStrength = 0.8 * (1 - Math.min(1, neighbor.distance / 1.5));
        fragments[neighbor.index].glowParams.strength = 
          Math.max(fragments[neighbor.index].glowParams.strength, diffusionStrength);
          
        // Secondary diffusion to neighbors of neighbors (weaker)
        const secondaryNeighbors = neighborMap.get(neighbor.index) || [];
        secondaryNeighbors.forEach(secondaryNeighbor => {
          if (secondaryNeighbor.index !== hoveredPiece) {
            const secondaryStrength = diffusionStrength * 0.6 * (1 - Math.min(1, secondaryNeighbor.distance / 1.0));
            fragments[secondaryNeighbor.index].glowParams.strength = 
              Math.max(fragments[secondaryNeighbor.index].glowParams.strength, secondaryStrength);
          }
        });
      });
    }
    
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
      
      // Update materials based on glow strength
      fragment.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          const glowStrength = data.glowParams.strength;
          
          // Only update if there's meaningful glow
          if (glowStrength > 0.01) {
            const glowColor = new THREE.Color().copy(data.glowParams.baseColor);
            
            // Shift color toward active color if strongly glowing
            if (glowStrength > 0.7) {
              glowColor.lerp(data.glowParams.activeColor, (glowStrength - 0.7) * 3.3);
            }
            
            child.material.emissive.copy(glowColor);
            child.material.emissiveIntensity = glowStrength * 0.7;
            
            // Subtle adjustment to other material properties
            child.material.roughness = 0.75 - glowStrength * 0.2;
            
            // Apply subtle scale boost to glowing fragments
            const scaleBoost = 1.0 + glowStrength * 0.05;
            fragment.scale.set(
              data.scale * scaleBoost,
              data.scale * scaleBoost,
              data.scale * scaleBoost
            );
          } else {
            // Reset material properties
            child.material.emissive.set(0, 0, 0);
            child.material.emissiveIntensity = 0;
            child.material.roughness = 0.75;
            fragment.scale.set(data.scale, data.scale, data.scale);
          }
        }
      });
    });
    
    // Update lights
    if (lightRef.current) {
      const globalGlowIntensity = Math.max(glowSpring.glow.get(), 
        hoveredPiece !== null ? 0.7 : 0);
      
      lightRef.current.intensity = 0.5 + globalGlowIntensity * 2.5 + Math.sin(t * 2) * 0.5 * globalGlowIntensity;
      
      // If a piece is hovered, move light position toward it
      if (hoveredPiece !== null && fragmentsRef.current[hoveredPiece]) {
        const hoveredPos = new THREE.Vector3();
        fragmentsRef.current[hoveredPiece].getWorldPosition(hoveredPos);
        const localPos = hoveredPos.clone();
        if (groupRef.current) {
          groupRef.current.worldToLocal(localPos);
        }
        
        lightRef.current.position.lerp(localPos, 0.1);
      } else {
        const lightRadius = 0.1 + expansion.get() * 0.3;
        lightRef.current.position.x = Math.sin(t * 0.7) * lightRadius;
        lightRef.current.position.y = Math.cos(t * 0.5) * lightRadius;
        lightRef.current.position.z = Math.sin(t * 0.3) * lightRadius;
      }
    }
    
    if (innerLightRef.current) {
      innerLightRef.current.intensity = Math.max(
        glowSpring.glow.get() * 3,
        hoveredPiece !== null ? 2.0 : 0
      );
    }
  });

  return (
    <group 
      ref={groupRef}
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