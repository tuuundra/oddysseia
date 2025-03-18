import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const FracturedGLBRock = () => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Use an absolute path to the GLB file
  const { scene: originalScene } = useGLTF('fractured_rock.glb', true);
  
  // Clone the scene to avoid modifying the cached original
  const scene = useRef<THREE.Group>(originalScene.clone());
  
  // Track the center point of the entire rock
  const centerPoint = useRef(new THREE.Vector3());
  
  // Calculate center and prepare for explosion
  useEffect(() => {
    if (scene.current) {
      // First pass: Calculate the actual center of the entire rock
      let totalVertices = 0;
      const rockCenter = new THREE.Vector3();
      
      // Go through all fragments and accumulate their vertices
      scene.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geometry = child.geometry;
          const positionAttribute = geometry.getAttribute('position');
          const vertexCount = positionAttribute.count;
          const vertex = new THREE.Vector3();
          
          // Transform matrix to convert from local to world space
          const matrix = new THREE.Matrix4();
          matrix.compose(
            child.position,
            child.quaternion,
            child.scale
          );
          
          // Add each vertex position to the total
          for (let i = 0; i < vertexCount; i++) {
            vertex.fromBufferAttribute(positionAttribute, i);
            vertex.applyMatrix4(matrix);  // Transform to world space
            rockCenter.add(vertex);
            totalVertices++;
          }
        }
      });
      
      // Calculate average position of all vertices
      if (totalVertices > 0) {
        rockCenter.divideScalar(totalVertices);
        centerPoint.current.copy(rockCenter);
        console.log('Rock center from all vertices:', rockCenter);
      }
      
      // Second pass: Move each fragment away from the center
      scene.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Save original position
          child.userData.originalPosition = child.position.clone();
          
          // Calculate the center of this fragment's geometry
          const geometry = child.geometry;
          const positionAttribute = geometry.getAttribute('position');
          const vertexCount = positionAttribute.count;
          
          // Calculate average position of all vertices in this fragment
          const fragmentCenter = new THREE.Vector3();
          const vertex = new THREE.Vector3();
          
          for (let i = 0; i < vertexCount; i++) {
            vertex.fromBufferAttribute(positionAttribute, i);
            fragmentCenter.add(vertex);
          }
          
          fragmentCenter.divideScalar(vertexCount);
          
          // Transform fragment center to world space
          const worldFragmentCenter = fragmentCenter.clone().applyMatrix4(
            new THREE.Matrix4().compose(
              child.position,
              child.quaternion,
              child.scale
            )
          );
          
          // Direction from rock center to fragment center
          const direction = new THREE.Vector3()
            .subVectors(worldFragmentCenter, centerPoint.current)
            .normalize();
          
          // Adjust explosion amount based on position - less explosion for fragments near center
          // This will help ensure the center light source is better hidden
          const distFromCenter = worldFragmentCenter.distanceTo(centerPoint.current);
          const maxExplosion = 0.04;  // Slightly larger overall explosion
          const minExplosion = 0.01;  // Much smaller explosion for center pieces
          
          // Calculate explosion amount - closer to center = less explosion
          const explosionFactor = Math.min(distFromCenter * 2, 1.0); // Scale factor
          const explosionAmount = minExplosion + (explosionFactor * (maxExplosion - minExplosion));
          
          console.log(`Fragment ${child.name}: Direction ${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)}`);
          
          // Apply the explosion - move in the calculated direction
          child.position.x += direction.x * explosionAmount;
          child.position.y += direction.y * explosionAmount;
          child.position.z += direction.z * explosionAmount;
          
          // Update original position to include explosion
          child.userData.originalPosition.copy(child.position);
        }
      });
    }
  }, []);
  
  // Set up materials and shadows but preserve original textures
  useEffect(() => {
    if (scene.current) {
      scene.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Enable shadows
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Log materials to see what's available
          console.log('Original material:', child.material);
          
          // Preserve original material but enhance it
          if (child.material) {
            // If it's already a material, just adjust some properties
            // but keep textures and colors
            if (child.material.map) {
              console.log('Material has texture map!');
            }
            
            // We can tune some properties while keeping the original textures
            if (Array.isArray(child.material)) {
              // Handle multi-materials
              child.material.forEach(mat => {
                if (mat) {
                  mat.roughness = mat.roughness || 0.8;
                  mat.metalness = mat.metalness || 0.1;
                  mat.envMapIntensity = 1.5; // Enhance reflections
                }
              });
            } else {
              // Single material
              child.material.roughness = child.material.roughness || 0.8;
              child.material.metalness = child.material.metalness || 0.1;
              child.material.envMapIntensity = 1.5;
            }
          } else {
            // Fallback if no material exists
            child.material = new THREE.MeshStandardMaterial({
              color: '#a2a2a2',
              roughness: 0.9,
              metalness: 0.1,
              emissive: "#193319",
              emissiveIntensity: 0.1,
            });
          }
        }
      });
    }
  }, []);
  
  // Animate the rock fragments with subtle floating motion
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    
    const t = clock.getElapsedTime();
    
    // Find all mesh children (fragments)
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Generate a unique animation based on the child's uuid
        const uniqueValue = child.uuid.charCodeAt(0) / 255;
        const secondUniqueValue = child.uuid.charCodeAt(1) / 255;
        
        // Set very subtle floating animation parameters
        const floatSpeed = 0.1 + uniqueValue * 0.1;
        const floatAmplitude = 0.003 + uniqueValue * 0.002;
        
        // Save original position if not already saved
        if (!child.userData.originalPosition) {
          child.userData.originalPosition = child.position.clone();
        }
        
        // Apply floating animation
        const originalPos = child.userData.originalPosition;
        child.position.x = originalPos.x + Math.sin(t * floatSpeed) * floatAmplitude;
        child.position.y = originalPos.y + Math.cos(t * floatSpeed * 0.8) * floatAmplitude;
        child.position.z = originalPos.z + Math.sin(t * floatSpeed * 0.6 + 0.3) * floatAmplitude;
        
        // Add subtle rotation
        const rotSpeed = 0.05 + secondUniqueValue * 0.05;
        if (!child.userData.originalRotation) {
          child.userData.originalRotation = new THREE.Euler().copy(child.rotation);
        }
        const origRot = child.userData.originalRotation;
        
        child.rotation.x = origRot.x + Math.sin(t * rotSpeed) * 0.001;
        child.rotation.y = origRot.y + Math.cos(t * rotSpeed * 0.7) * 0.001;
        child.rotation.z = origRot.z + Math.sin(t * rotSpeed * 0.5) * 0.001;
      }
    });
  });
  
  return (
    <group ref={groupRef}>
      {/* The actual fractured rock model */}
      <primitive object={scene.current} />
    </group>
  );
};

// Preload the model with the correct path
useGLTF.preload('fractured_rock.glb', true);

export default FracturedGLBRock; 