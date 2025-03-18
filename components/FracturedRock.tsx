import { useEffect, useRef, useState, Suspense } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { useGLTF, MeshDistortMaterial, Icosahedron, Box, Octahedron, Dodecahedron } from '@react-three/drei';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';

// Higher quality rock chunk designs with more natural shapes
const rockTypes = [
  // Type 1: Jagged crystal-like chunk
  ({ size = 1, roughness = 0.4, metalness = 0.3, color = "#222", emissive = "#000", ...props }) => (
    <mesh {...props}>
      <dodecahedronGeometry args={[size, 1]} />
      <meshStandardMaterial 
        roughness={roughness} 
        metalness={metalness} 
        color={color} 
        emissive={emissive}
        flatShading 
      />
    </mesh>
  ),
  
  // Type 2: Smoother rounded chunk
  ({ size = 1, roughness = 0.5, metalness = 0.2, color = "#222", emissive = "#000", ...props }) => (
    <mesh {...props}>
      <icosahedronGeometry args={[size, 1]} />
      <meshStandardMaterial 
        roughness={roughness} 
        metalness={metalness} 
        color={color} 
        emissive={emissive}
        flatShading 
      />
    </mesh>
  ),
  
  // Type 3: Angular shard
  ({ size = 1, roughness = 0.6, metalness = 0.1, color = "#222", emissive = "#000", ...props }) => (
    <mesh {...props}>
      <octahedronGeometry args={[size, 1]} />
      <meshStandardMaterial 
        roughness={roughness} 
        metalness={metalness} 
        color={color} 
        emissive={emissive}
        flatShading 
      />
    </mesh>
  ),
  
  // Type 4: Distorted chunk with more organic look
  ({ size = 1, roughness = 0.5, metalness = 0.3, color = "#222", emissive = "#000", ...props }) => (
    <Dodecahedron args={[size, 1]} {...props}>
      <MeshDistortMaterial
        roughness={roughness}
        metalness={metalness}
        color={color}
        emissive={emissive}
        distort={0.3}
        speed={0.5}
        flatShading
      />
    </Dodecahedron>
  ),
];

// Generate 12 higher quality precomputed rock fragments
const createRockPieces = () => {
  const rockData = [];
  
  // Central piece configurations
  const centerConfigs = [
    { pos: [0, 0, 0], scale: 0.8, type: 1 },
    { pos: [0.05, 0.1, -0.05], scale: 0.7, type: 0 },
    { pos: [-0.02, -0.08, 0.03], scale: 0.75, type: 2 },
  ];
  
  // Add center pieces
  centerConfigs.forEach(config => {
    rockData.push({
      position: new THREE.Vector3(...config.pos),
      rotation: new THREE.Euler(
        Math.random() * Math.PI, 
        Math.random() * Math.PI, 
        Math.random() * Math.PI
      ),
      scale: config.scale,
      rockType: config.type,
      floatParams: {
        speed: 0.2 + Math.random() * 0.1,
        amplitude: 0.02 + Math.random() * 0.01,
        offset: Math.random() * Math.PI * 2,
        rotationSpeed: 0.05 + Math.random() * 0.05,
        expansionFactor: 0.2 + Math.random() * 0.1
      }
    });
  });
  
  // Add outer fragment pieces in a balanced arrangement
  const numOuterPieces = 9;
  const angleStep = (Math.PI * 2) / numOuterPieces;
  
  for (let i = 0; i < numOuterPieces; i++) {
    const angle = i * angleStep;
    const radius = 0.4 + Math.random() * 0.3;
    const height = (Math.random() - 0.5) * 0.5;
    
    rockData.push({
      position: new THREE.Vector3(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      ),
      rotation: new THREE.Euler(
        Math.random() * Math.PI, 
        Math.random() * Math.PI, 
        Math.random() * Math.PI
      ),
      scale: 0.3 + Math.random() * 0.3,
      rockType: Math.floor(Math.random() * rockTypes.length),
      floatParams: {
        speed: 0.3 + Math.random() * 0.2,
        amplitude: 0.03 + Math.random() * 0.02,
        offset: Math.random() * Math.PI * 2,
        rotationSpeed: 0.1 + Math.random() * 0.1,
        expansionFactor: 0.3 + Math.random() * 0.2
      }
    });
  }
  
  return rockData;
};

const FracturedRock = () => {
  const { viewport, mouse, camera } = useThree();
  const [hovered, setHovered] = useState(false);
  const [hoveredPiece, setHoveredPiece] = useState<number | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const rockPieces = useRef(createRockPieces());
  const pieceRefs = useRef<THREE.Mesh[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);
  const innerLightRef = useRef<THREE.PointLight>(null);
  
  // Spring for smooth overall expansion
  const { expansion } = useSpring({
    expansion: hovered ? 1 : 0,
    config: { mass: 1.5, tension: 80, friction: 20 }
  });
  
  // Create individual springs for each piece for smoother independent movement
  const pieceSprings = useSpring({
    glowIntensity: hovered ? 1 : 0,
    config: { mass: 2, tension: 60, friction: 25 }
  });

  // Handle mouse interactions and floating animation
  useFrame(({ clock }) => {
    if (!groupRef.current || pieceRefs.current.length === 0) return;
    
    const t = clock.getElapsedTime();
    
    // Calculate normalized mouse position for hover effects
    const mouseX = (mouse.x * viewport.width) / 2;
    const mouseY = (mouse.y * viewport.height) / 2;
    
    // Get camera-relative position
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    
    // Update each piece position with more natural movement
    pieceRefs.current.forEach((piece, i) => {
      if (!piece) return;
      
      const rockData = rockPieces.current[i];
      const params = rockData.floatParams;
      const originalPos = rockData.position;
      
      // Calculate eased expansion factor
      const currentExpansion = expansion.get();
      
      // Base floating animation - more gentle and natural
      piece.position.x = originalPos.x + Math.sin(t * params.speed + params.offset) * params.amplitude;
      piece.position.y = originalPos.y + Math.cos(t * params.speed * 1.2 + params.offset) * params.amplitude;
      piece.position.z = originalPos.z + Math.sin(t * params.speed * 0.8 + params.offset * 1.1) * params.amplitude;
      
      // Smooth rotation
      piece.rotation.x = rockData.rotation.x + Math.sin(t * params.rotationSpeed) * 0.05;
      piece.rotation.y = rockData.rotation.y + Math.cos(t * params.rotationSpeed * 0.7) * 0.05;
      piece.rotation.z = rockData.rotation.z + Math.sin(t * params.rotationSpeed * 0.5 + 0.3) * 0.05;
      
      // Expansion direction should be from center of rock group
      const dirVector = new THREE.Vector3().copy(originalPos).normalize();
      if (dirVector.length() === 0) {
        dirVector.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      }
      
      // Mouse-influenced expansion
      if (currentExpansion > 0) {
        // Calculate 3D distance of piece center to mouse ray
        const mouseInfluence = Math.max(0, 1 - (Math.abs(piece.position.x - mouseX) + Math.abs(piece.position.y - mouseY)) / 2);
        
        // Apply expansion force - stronger near mouse
        const expansionAmount = currentExpansion * params.expansionFactor * (1 + mouseInfluence * 2);
        
        piece.position.x += dirVector.x * expansionAmount;
        piece.position.y += dirVector.y * expansionAmount;
        piece.position.z += dirVector.z * expansionAmount;
        
        // Add subtle attraction to mouse for pieces near the cursor
        if (mouseInfluence > 0.3) {
          const mouseAttractionStrength = mouseInfluence * 0.02 * currentExpansion;
          piece.position.x += (mouseX - piece.position.x) * mouseAttractionStrength;
          piece.position.y += (mouseY - piece.position.y) * mouseAttractionStrength;
        }
        
        // Update material
        if (piece.material) {
          // Increase emissive property for the hovered piece
          if (hoveredPiece === i) {
            (piece.material as THREE.MeshStandardMaterial).emissive.set('#ff6a00');
            (piece.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + currentExpansion * 0.3;
          } else {
            // Subtle glow for all other pieces
            (piece.material as THREE.MeshStandardMaterial).emissive.set('#ff6a00');
            (piece.material as THREE.MeshStandardMaterial).emissiveIntensity = currentExpansion * 0.1;
          }
        }
      } else {
        // Reset emissive
        if (piece.material) {
          (piece.material as THREE.MeshStandardMaterial).emissive.set('#000000');
          (piece.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        }
      }
    });
    
    // Update fracture glow light
    if (lightRef.current) {
      // Dynamic light intensity
      const glowIntensity = pieceSprings.glowIntensity.get();
      lightRef.current.intensity = 0.5 + glowIntensity * 2.5 + Math.sin(t * 2) * 0.5 * glowIntensity;
      
      // Animate light position slightly
      const lightRadius = 0.1 + expansion.get() * 0.3;
      lightRef.current.position.x = Math.sin(t * 0.7) * lightRadius;
      lightRef.current.position.y = Math.cos(t * 0.5) * lightRadius;
      lightRef.current.position.z = Math.sin(t * 0.3) * lightRadius;
    }
    
    // Update inner light
    if (innerLightRef.current) {
      innerLightRef.current.intensity = pieceSprings.glowIntensity.get() * 3;
    }
  });

  return (
    <group
      ref={groupRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Render all rock pieces */}
      {rockPieces.current.map((rockData, i) => {
        const RockComponent = rockTypes[rockData.rockType];
        return (
          <animated.group
            key={i}
            position={[rockData.position.x, rockData.position.y, rockData.position.z]}
            rotation={[rockData.rotation.x, rockData.rotation.y, rockData.rotation.z]}
            scale={rockData.scale}
          >
            <RockComponent
              ref={(el: THREE.Mesh | null) => {
                if (el) pieceRefs.current[i] = el;
              }}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                setHoveredPiece(i);
              }}
              onPointerOut={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                setHoveredPiece(null);
              }}
              size={1}
              roughness={0.75}
              metalness={0.2}
              color="#222222"
              emissive={hoveredPiece === i ? "#ff6a00" : "#000000"}
              castShadow
              receiveShadow
            />
          </animated.group>
        );
      })}
      
      {/* Outer glow light */}
      <pointLight
        ref={lightRef}
        color="#ff6a00"
        intensity={0}
        distance={8}
        position={[0, 0, 0]}
        castShadow={false}
      />
      
      {/* Inner more concentrated light */}
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

export default FracturedRock; 