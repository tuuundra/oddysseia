import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const Stumpington = ({ 
  position = [0, 0, 0], 
  rotation = [0, 0, 0], 
  scale = [1, 1, 1] 
}: { 
  position?: [number, number, number]; 
  rotation?: [number, number, number]; 
  scale?: [number, number, number];
}) => {
  console.log("Attempting to load stumpington.glb...");
  
  // NOTE: Using furtreelowres.glb as a base but we'll transform it to look like a stump
  const { scene } = useGLTF('/stumpington.glb');
  const stumpRef = useRef<THREE.Group>(null);
  
  // Clone the scene to prevent sharing issues
  const clonedScene = useRef(scene.clone());
  
  console.log("Stumpington model loaded successfully!");
  
  // Apply materials and shadows to the cloned scene
  useEffect(() => {
    if (clonedScene.current) {
      clonedScene.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Make the tree look like a stump by scaling down the top part
          // If the child is above a certain y position, scale it down or hide it
          const localPosition = new THREE.Vector3();
          child.getWorldPosition(localPosition);
          
          // Local Y position in the model
          const yPosition = child.position.y;
          
          // If this is part of the upper tree, make it invisible or very small
          if (yPosition > 0.4) {
            child.visible = false; // Hide upper parts of the tree
          } else if (yPosition > 0.2) {
            // Scale down the middle part to make it look cut
            child.scale.set(1, 0.5, 1);
          }
          
          // For the base/trunk, make it look like a stump
          if (yPosition <= 0.2) {
            // Enhance the stump texture
            if (child.material) {
              // Apply a darker, more bark-like material to make it look like a stump
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  if (mat) {
                    mat.color = new THREE.Color("#5e3f21"); // Brown color
                    mat.roughness = 1.0;
                    mat.metalness = 0.0;
                  }
                });
              } else {
                child.material.color = new THREE.Color("#5e3f21"); // Brown color
                child.material.roughness = 1.0;
                child.material.metalness = 0.0;
              }
            }
          }
          
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, []);
  
  // Add subtle animation
  useFrame(({ clock }) => {
    if (stumpRef.current) {
      const t = clock.getElapsedTime();
      
      // Very subtle movement to make it feel alive
      stumpRef.current.rotation.y = rotation[1] + Math.sin(t * 0.05) * 0.005;
      stumpRef.current.position.y = position[1] + Math.sin(t * 0.1) * 0.01;
    }
  });
  
  return (
    <group position={position} rotation={rotation} scale={scale} ref={stumpRef}>
      <primitive object={clonedScene.current} />
    </group>
  );
};

// Preload the model to improve performance
useGLTF.preload('/stumpington.glb');

export default Stumpington; 