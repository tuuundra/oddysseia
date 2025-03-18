import React, { useRef, Suspense, useEffect, useState, useMemo } from 'react';
import { useLoader, useThree, useFrame } from '@react-three/fiber';
import { FBXLoader } from 'three-stdlib';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';

// Define types for fragment data
interface FragmentParams {
  speed: number;
  amplitude: number;
  offset: number;
  rotationSpeed: number;
  expansionFactor: number;
}

interface FragmentData {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  rotation: THREE.Euler;
  thickness: number;
  floatParams: FragmentParams;
}

// Create data for rock fragments
const createFragmentData = (count = 12) => {
  const fragments = [];
  
  // Create a few central fragments
  const centerPieces = [
    { position: [0, 0, 0], scale: [1, 1, 1], rotation: [0, 0, 0], thickness: 0.4 },
    { position: [0.05, 0.02, -0.02], scale: [0.9, 0.8, 0.7], rotation: [0.1, 0.2, 0.05], thickness: 0.5 },
    { position: [-0.05, -0.02, 0.02], scale: [0.85, 0.9, 0.8], rotation: [-0.1, -0.1, 0.1], thickness: 0.6 },
  ];
  
  // Add center pieces
  centerPieces.forEach(piece => {
    fragments.push({
      position: new THREE.Vector3(...piece.position),
      scale: new THREE.Vector3(...piece.scale),
      rotation: new THREE.Euler(...piece.rotation),
      thickness: piece.thickness,
      floatParams: {
        speed: 0.2 + Math.random() * 0.1,
        amplitude: 0.005 + Math.random() * 0.005,
        offset: Math.random() * Math.PI * 2,
        rotationSpeed: 0.05 + Math.random() * 0.05,
        expansionFactor: 0.2 + Math.random() * 0.1
      }
    });
  });
  
  // Add outer fragments in a spherical pattern
  const outerCount = count - centerPieces.length;
  for (let i = 0; i < outerCount; i++) {
    // Calculate position in a spherical arrangement
    const theta = Math.PI * 2 * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 0.05 + Math.random() * 0.07;
    
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    fragments.push({
      position: new THREE.Vector3(x, y, z),
      scale: new THREE.Vector3(
        0.4 + Math.random() * 0.3,
        0.4 + Math.random() * 0.3,
        0.4 + Math.random() * 0.3
      ),
      rotation: new THREE.Euler(
        Math.random() * Math.PI, 
        Math.random() * Math.PI, 
        Math.random() * Math.PI
      ),
      thickness: 0.3 + Math.random() * 0.2,
      floatParams: {
        speed: 0.3 + Math.random() * 0.2,
        amplitude: 0.01 + Math.random() * 0.005,
        offset: Math.random() * Math.PI * 2,
        rotationSpeed: 0.1 + Math.random() * 0.1,
        expansionFactor: 0.5 + Math.random() * 0.3
      }
    });
  }
  
  return fragments;
};

// A single rock fragment
const RockFragment = ({ 
  fragment, 
  hovered, 
  index, 
  model, 
  onHover, 
  onUnhover,
  expansion
}: {
  fragment: FragmentData;
  hovered: boolean;
  index: number;
  model: THREE.Group;
  onHover: (index: number) => void;
  onUnhover: () => void;
  expansion: { get: () => number };
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { clock } = useThree();
  
  // Generate a unique seed for this fragment
  const seed = useMemo(() => Math.random() * 1000, []);
  
  // Animation spring for this fragment
  const { fragmentPosition, fragmentRotation } = useSpring({
    fragmentPosition: hovered 
      ? [
          fragment.position.x * (1 + fragment.floatParams.expansionFactor * expansion.get()),
          fragment.position.y * (1 + fragment.floatParams.expansionFactor * expansion.get()),
          fragment.position.z * (1 + fragment.floatParams.expansionFactor * expansion.get())
        ] 
      : [fragment.position.x, fragment.position.y, fragment.position.z],
    fragmentRotation: hovered 
      ? [
          fragment.rotation.x + 0.1 * expansion.get(),
          fragment.rotation.y + 0.1 * expansion.get(),
          fragment.rotation.z + 0.1 * expansion.get()
        ]
      : [fragment.rotation.x, fragment.rotation.y, fragment.rotation.z],
    config: { mass: 1, tension: 180, friction: 30 }
  });
  
  // Animated floating and rotation
  useFrame(() => {
    if (!meshRef.current) return;
    
    const t = clock.getElapsedTime() + seed;
    const params = fragment.floatParams;
    
    // Apply floating movement
    meshRef.current.position.x = fragmentPosition.get()[0] + Math.sin(t * params.speed + params.offset) * params.amplitude;
    meshRef.current.position.y = fragmentPosition.get()[1] + Math.cos(t * params.speed * 1.2 + params.offset) * params.amplitude;
    meshRef.current.position.z = fragmentPosition.get()[2] + Math.sin(t * params.speed * 0.8 + params.offset * 1.1) * params.amplitude;
    
    // Apply subtle rotation
    meshRef.current.rotation.x = fragmentRotation.get()[0] + Math.sin(t * params.rotationSpeed) * 0.01;
    meshRef.current.rotation.y = fragmentRotation.get()[1] + Math.cos(t * params.rotationSpeed * 0.7) * 0.01;
    meshRef.current.rotation.z = fragmentRotation.get()[2] + Math.sin(t * params.rotationSpeed * 0.5 + 0.3) * 0.01;
  });
  
  // Clone the model for this fragment
  const clonedGeometry = useMemo(() => {
    if (!model) return null;
    
    // Find first mesh in the model
    let sourceMesh: THREE.Mesh | null = null;
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && !sourceMesh) {
        sourceMesh = child;
      }
    });
    
    if (!sourceMesh || !sourceMesh.geometry) return null;
    
    // Clone the geometry
    const geometry = sourceMesh.geometry.clone();
    
    // Create a bounding box
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return geometry;
    
    // Calculate center and size
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // Create slice planes for each fragment
    const planeNormals = [
      // Create several slice planes with different orientations
      new THREE.Vector3(1, 0.2, 0.1).normalize(),
      new THREE.Vector3(-0.2, 1, 0.3).normalize(),
      new THREE.Vector3(0.1, -0.3, 1).normalize(),
      new THREE.Vector3(-1, -0.2, 0.2).normalize(),
      new THREE.Vector3(0.2, -1, 0.1).normalize(),
      new THREE.Vector3(0.3, 0.1, -1).normalize()
    ];
    
    // Each fragment keeps a different portion of the model
    // determined by its index and parameters
    const slicePlaneIndex = index % planeNormals.length;
    const slicePlaneNormal = planeNormals[slicePlaneIndex];
    
    // Create a cutting plane offset from center in direction of this fragment
    const planeOffset = fragment.thickness - 0.5; // -0.5 to 0.5 range
    const planeConstant = slicePlaneNormal.dot(center) + planeOffset * size.length();
    
    // Find verticess that should be part of this fragment
    const positions = geometry.attributes.position;
    const vertexCount = positions.count;
    const indicesToKeep = [];
    
    for (let i = 0; i < vertexCount; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const vertex = new THREE.Vector3(x, y, z);
      
      // Check if the vertex is on our side of the cutting plane
      if (slicePlaneNormal.dot(vertex) >= planeConstant) {
        indicesToKeep.push(i);
      }
    }
    
    // Create a new geometry with only the kept vertices
    const newPositions = new Float32Array(indicesToKeep.length * 3);
    const newColors = new Float32Array(indicesToKeep.length * 3);
    
    // Get colors from original geometry if available
    const originalColors = geometry.attributes.color;
    
    indicesToKeep.forEach((oldIndex, newIndex) => {
      // Copy position
      newPositions[newIndex * 3] = positions.getX(oldIndex);
      newPositions[newIndex * 3 + 1] = positions.getY(oldIndex);
      newPositions[newIndex * 3 + 2] = positions.getZ(oldIndex);
      
      // Either copy colors or generate new ones
      if (originalColors) {
        newColors[newIndex * 3] = originalColors.getX(oldIndex);
        newColors[newIndex * 3 + 1] = originalColors.getY(oldIndex);
        newColors[newIndex * 3 + 2] = originalColors.getZ(oldIndex);
      } else {
        // Generate procedural marble-like colors
        const x = positions.getX(oldIndex);
        const y = positions.getY(oldIndex);
        const z = positions.getZ(oldIndex);
        
        // Normalize for consistent mapping
        const len = Math.sqrt(x*x + y*y + z*z);
        const nx = x / len;
        const ny = y / len;
        const nz = z / len;
        
        // Create marble-like pattern
        const noise = 
          Math.sin(nx * 12) * Math.cos(ny * 12) * Math.sin(nz * 12) * 0.5 + 
          Math.sin(nx * 26 + ny * 12) * 0.1 +
          Math.cos(nz * 14 - nx * 12) * 0.1;
        
        // Vary color based on fragment index for visual distinction
        const hue = (index * 0.05) % 0.2 + 0.05; // Slight hue variation
        
        // Base color with marble pattern
        const baseColor = 0.7 + noise * 0.2;
        
        newColors[newIndex * 3] = baseColor - hue * 0.1; // R
        newColors[newIndex * 3 + 1] = baseColor - hue * 0.05; // G 
        newColors[newIndex * 3 + 2] = baseColor; // B - coolest for rocks
        
        // Make crevices darker
        if (noise < -0.3) {
          newColors[newIndex * 3] *= 0.5;
          newColors[newIndex * 3 + 1] *= 0.5;
          newColors[newIndex * 3 + 2] *= 0.5;
        }
      }
    });
    
    // Create new geometry with the sliced vertices
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    newGeometry.setAttribute('color', new THREE.BufferAttribute(newColors, 3));
    
    // Compute vertex normals for proper lighting
    newGeometry.computeVertexNormals();
    
    return newGeometry;
  }, [model, fragment, index]);
  
  // Skip rendering if we couldn't create geometry
  if (!clonedGeometry) return null;
  
  return (
    <mesh
      ref={meshRef}
      geometry={clonedGeometry}
      position={[fragment.position.x, fragment.position.y, fragment.position.z]}
      rotation={[fragment.rotation.x, fragment.rotation.y, fragment.rotation.z]}
      scale={[fragment.scale.x, fragment.scale.y, fragment.scale.z]}
      onPointerOver={() => onHover(index)}
      onPointerOut={() => onUnhover()}
    >
      <meshStandardMaterial 
        vertexColors 
        roughness={0.8}
        metalness={0.1}
        emissive="#000000"
        emissiveIntensity={hovered ? 0.2 : 0.0}
        dithering
      />
    </mesh>
  );
};

// Main fractured rock component
const FracturedRockModel = () => {
  const groupRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [hoveredFragment, setHoveredFragment] = useState<number | null>(null);
  const [fragments] = useState(() => createFragmentData(15)); // Create 15 fragments
  
  // Load the FBX model
  const fbx = useLoader(FBXLoader, '/models/rocks/SM_River_Rock_01.fbx');
  
  // Store the model after loading
  useEffect(() => {
    if (fbx) {
      const clone = fbx.clone();
      // Apply default material to the entire model
      clone.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          // Generate procedural vertex colors for consistent fragments
          if (child.geometry) {
            const positions = child.geometry.attributes.position;
            const count = positions.count;
            const colors = new Float32Array(count * 3);
            
            for (let i = 0; i < count; i++) {
              const x = positions.getX(i);
              const y = positions.getY(i);
              const z = positions.getZ(i);
              
              // Normalize position
              const length = Math.sqrt(x * x + y * y + z * z);
              const nx = x / length;
              const ny = y / length;
              const nz = z / length;
              
              // Generate marble pattern
              const noise = 
                Math.sin(nx * 12) * Math.cos(ny * 12) * Math.sin(nz * 12) * 0.5 + 
                Math.sin(nx * 26 + ny * 12) * 0.1 +
                Math.cos(nz * 14 - nx * 12) * 0.1;
              
              // Generate color
              const baseColor = 0.7 + noise * 0.2; 
              colors[i * 3] = baseColor; 
              colors[i * 3 + 1] = baseColor * 0.95;
              colors[i * 3 + 2] = baseColor * 0.9;
              
              // Darken crevices
              if (noise < -0.3) {
                colors[i * 3] *= 0.5;
                colors[i * 3 + 1] *= 0.5;
                colors[i * 3 + 2] *= 0.5;
              }
            }
            
            // Add to geometry
            child.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          }
        }
      });
      
      setModel(clone);
    }
  }, [fbx]);
  
  // Spring for overall expansion animation
  const { expansion } = useSpring({
    expansion: hoveredFragment !== null ? 1 : 0,
    config: { mass: 2, tension: 120, friction: 24 }
  });
  
  // Emissive glow animation
  const { glowIntensity } = useSpring({
    glowIntensity: hoveredFragment !== null ? 1 : 0,
    config: { mass: 2, tension: 80, friction: 20 }
  });
  
  // Light effect for when rock is hovered
  const [lightIntensity, setLightIntensity] = useState(0);
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    // Smooth animation for light intensity
    setLightIntensity(hoveredFragment !== null 
      ? 2 + Math.sin(time * 3) * 0.5 // Pulsating when hovered
      : 0); 
    
    // Gentle group rotation
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(time * 0.1) * 0.05;
    }
  });
  
  return (
    <group
      ref={groupRef}
      scale={[0.015, 0.015, 0.015]} 
      position={[0, -1, 0]}
      rotation={[0, Math.PI * 0.25, 0]}
    >
      {/* Rock fragments */}
      {model && fragments.map((fragment, i) => (
        <RockFragment
          key={i}
          fragment={fragment}
          index={i} 
          model={model}
          hovered={hoveredFragment === i || hoveredFragment !== null}
          onHover={setHoveredFragment}
          onUnhover={() => setHoveredFragment(null)}
          expansion={expansion}
        />
      ))}
      
      {/* Interior light effect */}
      <pointLight 
        color="#ff6a00" 
        intensity={lightIntensity} 
        distance={2}
        decay={2}
      />
      
      {/* Central glow sphere - only visible when expanded */}
      <animated.mesh visible={expansion.to(v => v > 0.05)}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <animated.meshBasicMaterial 
          color="#ff6a00" 
          transparent 
          opacity={glowIntensity.to(v => v * 0.4)}
        />
      </animated.mesh>
    </group>
  );
};

// Fallback component to display while loading
const RockFallback = () => {
  return (
    <mesh position={[0, -1, 0]}>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshStandardMaterial color="#333333" />
    </mesh>
  );
};

// Wrapper component with Suspense
const FracturedSimpleRock = () => {
  return (
    <Suspense fallback={<RockFallback />}>
      <FracturedRockModel />
    </Suspense>
  );
};

export default FracturedSimpleRock; 