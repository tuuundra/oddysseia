import React, { useRef, Suspense, useEffect } from 'react';
import { useLoader, useThree, useFrame } from '@react-three/fiber';
import { FBXLoader } from 'three-stdlib';
import * as THREE from 'three';

// The rock component with a procedural material approach
const RockModel = () => {
  const meshRef = useRef<THREE.Group>(null);
  const { scene } = useThree();
  
  // Load the FBX model
  const fbx = useLoader(FBXLoader, '/models/rocks/SM_River_Rock_01.fbx');
  
  // Add subtle floating animation
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const time = clock.getElapsedTime();
      
      // Gentle floating movement
      meshRef.current.position.y = -1 + Math.sin(time * 0.3) * 0.05;
      
      // Very subtle rotation
      meshRef.current.rotation.y = Math.PI * 0.25 + Math.sin(time * 0.15) * 0.03;
      meshRef.current.rotation.x = Math.sin(time * 0.2) * 0.01;
      
      // Pulse effect for cracks
      meshRef.current.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          // Subtle pulsing emissive intensity for the cracks
          child.material.emissiveIntensity = 0.05 + Math.sin(time * 0.5) * 0.05;
        }
      });
    }
  });
  
  // Add environment lighting for better PBR
  useEffect(() => {
    if (!scene.environment) {
      const pmremGenerator = new THREE.PMREMGenerator(new THREE.WebGLRenderer());
      pmremGenerator.compileEquirectangularShader();
      const envMap = pmremGenerator.fromScene(new THREE.Scene()).texture;
      scene.environment = envMap;
    }
  }, [scene]);
  
  useEffect(() => {
    if (fbx) {
      // Apply custom material to each mesh in the model
      fbx.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          // Create a procedural material for the rock
          const material = new THREE.MeshStandardMaterial({
            // Base color - a stone-like gray
            color: new THREE.Color(0x888888),
            
            // Material properties
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true,
            
            // Environment reflection
            envMapIntensity: 0.5,
            
            // Shadows
            shadowSide: THREE.FrontSide,
            
            // Create black crevices
            emissive: new THREE.Color(0x000000),
            emissiveIntensity: 0.1,
            
            // Enable dithering for smoother appearance
            dithering: true,
          });
          
          // Apply the material
          child.material = material;
          
          // Enable shadows
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Add some vertex colors for visual interest
          if (child.geometry) {
            // Generate procedural vertex colors for a rock-like appearance
            const positions = child.geometry.attributes.position;
            const count = positions.count;
            const colors = new Float32Array(count * 3);
            
            for (let i = 0; i < count; i++) {
              const x = positions.getX(i);
              const y = positions.getY(i);
              const z = positions.getZ(i);
              
              // Normalize position for consistent mapping
              const length = Math.sqrt(x * x + y * y + z * z);
              const nx = x / length;
              const ny = y / length;
              const nz = z / length;
              
              // Create marble-like pattern
              const noise = 
                Math.sin(nx * 12) * Math.cos(ny * 12) * Math.sin(nz * 12) * 0.5 + 
                Math.sin(nx * 26 + ny * 12) * 0.1 +
                Math.cos(nz * 14 - nx * 12) * 0.1;
              
              // Mix between light gray and dark gray
              const baseColor = 0.7 + noise * 0.2; // Range from 0.5 to 0.9
              
              // Add a subtle color variation
              colors[i * 3] = baseColor; // R
              colors[i * 3 + 1] = baseColor * 0.95; // G slightly lower
              colors[i * 3 + 2] = baseColor * 0.9; // B even lower for a slight warm tone
              
              // Make crevices darker
              if (noise < -0.3) {
                colors[i * 3] *= 0.5;
                colors[i * 3 + 1] *= 0.5;
                colors[i * 3 + 2] *= 0.5;
              }
            }
            
            // Add vertex colors to the geometry
            child.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            // Update material to use vertex colors
            material.vertexColors = true;
          }
        }
      });
    }
  }, [fbx]);
  
  return (
    <primitive 
      ref={meshRef}
      object={fbx} 
      scale={[0.015, 0.015, 0.015]} 
      position={[0, -1, 0]}
      rotation={[0, Math.PI * 0.25, 0]}
    />
  );
};

// Fallback component to display while loading
const RockFallback = () => {
  return (
    <mesh position={[0, -1, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#333333" />
    </mesh>
  );
};

// Wrapper component with Suspense
const SimpleRock = () => {
  return (
    <Suspense fallback={<RockFallback />}>
      <RockModel />
    </Suspense>
  );
};

export default SimpleRock; 