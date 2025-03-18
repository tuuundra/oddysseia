import React, { useRef, Suspense } from 'react';
import { useLoader } from '@react-three/fiber';
import { FBXLoader } from 'three-stdlib';
import * as THREE from 'three';

// The main rock component that loads the FBX
const RockModel = () => {
  const meshRef = useRef<THREE.Group>(null);
  
  // Load the FBX model
  const fbx = useLoader(FBXLoader, '/models/rocks/SM_River_Rock_01.fbx');
  
  // Clone the model and apply materials
  const rockModel = fbx.clone();
  
  // Apply standard material to all meshes in the model
  rockModel.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      child.material = new THREE.MeshStandardMaterial({
        color: "#2a2a2a",
        roughness: 0.8,
        metalness: 0.2,
      });
      
      // Enable shadows
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  return (
    <primitive 
      ref={meshRef}
      object={rockModel} 
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