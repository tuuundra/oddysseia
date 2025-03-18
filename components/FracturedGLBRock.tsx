import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
  
  // For mouse interaction
  const { camera } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2(-1000, -1000)); // Start off screen
  
  // Keep track of which fragment is currently hovered
  const [hoveredFragment, setHoveredFragment] = useState<string | null>(null);
  
  // Track all fragments for easy access during hover effects
  const fragmentsMap = useRef(new Map<string, {
    mesh: THREE.Mesh,
    distanceFromCenter: number,
    directionFromCenter: THREE.Vector3,
    originalPosition: THREE.Vector3,
    currentExpansion: number // Track current expansion amount for smooth transitions
  }>());
  
  // Mouse event handlers
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Convert mouse position to normalized device coordinates (-1 to +1)
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    
    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove);
    
    // Clean up
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
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
      
      // Find fragments very close to the center and remove the largest one
      scene.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Calculate fragment center
          child.geometry.computeBoundingBox();
          if (!child.geometry.boundingBox) return;
          
          const fragmentCenter = new THREE.Vector3();
          child.geometry.boundingBox.getCenter(fragmentCenter);
          
          // Get world position
          const worldCenter = fragmentCenter.clone().applyMatrix4(
            new THREE.Matrix4().compose(
              child.position, 
              child.quaternion, 
              child.scale
            )
          );
          
          // Check if it's very close to center and is a large fragment
          const distToCenter = worldCenter.distanceTo(centerPoint.current);
          
          // Calculate volume for size comparison
          const size = new THREE.Vector3();
          child.geometry.boundingBox.getSize(size);
          const volume = size.x * size.y * size.z;
          
          // Log details for debugging
          console.log(`Fragment ${child.uuid.slice(0,8)}: dist=${distToCenter.toFixed(3)}, volume=${volume.toFixed(3)}`);
          
          // If it's a central fragment, hide it
          if (distToCenter < 0.1) {
            console.log(`Hiding central fragment: ${child.uuid.slice(0,8)}`);
            child.visible = false;
          }
        }
      });
      
      // Second pass: Move each fragment away from the center
      scene.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Skip if this is the hidden central fragment
          if (child.visible === false) {
            return;
          }
          
          // Ensure the mesh has a unique name for identifying it later
          if (!child.name) {
            child.name = 'fragment_' + child.uuid.substring(0, 8);
          }
          
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
          
          // Store direction and distance for hover effect
          child.userData.directionFromCenter = direction.clone();
          child.userData.distanceFromCenter = distFromCenter;
          
          // Add to fragments map for easy access during hover
          fragmentsMap.current.set(child.name, {
            mesh: child,
            distanceFromCenter: distFromCenter,
            directionFromCenter: direction.clone(),
            originalPosition: child.position.clone(),
            currentExpansion: 0
          });
          
          // Make fragments interactive
          child.userData.isFragment = true;
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
  
  // Animate the rock fragments with subtle floating motion and handle mouse interaction
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    
    const t = clock.getElapsedTime();
    
    // Update raycaster with current mouse position
    raycaster.current.setFromCamera(mouse.current, camera);
    
    // Check for intersections with rock fragments
    const intersects = raycaster.current.intersectObjects(groupRef.current.children, true);
    
    // Find the closest intersected fragment
    let hoveredMesh: THREE.Mesh | null = null;
    
    if (intersects.length > 0) {
      // Find the first object that is a fragment
      for (const intersect of intersects) {
        // Traverse up to find the actual fragment mesh
        let object: THREE.Object3D | null = intersect.object;
        while (object && (!object.userData.isFragment)) {
          object = object.parent;
        }
        
        if (object && object instanceof THREE.Mesh) {
          hoveredMesh = object;
          break;
        }
      }
    }
    
    // Update hovered fragment state
    if (hoveredMesh) {
      setHoveredFragment(hoveredMesh.name);
    } else {
      setHoveredFragment(null);
    }
    
    // Calculate hover positions for all fragments
    const hoverPoint = hoveredMesh ? new THREE.Vector3().setFromMatrixPosition(hoveredMesh.matrixWorld) : null;
    
    // Max expansion amount when hovering
    const maxExpansion = 0.15;
    
    // Max distance for influence spreading to nearby fragments
    const influenceRadius = 0.7; 
    
    // Animation speed for expansion/contraction
    const animSpeed = 0.15;
    
    // Find all mesh children (fragments)
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Get fragment data from map
        const fragmentData = fragmentsMap.current.get(child.name);
        
        if (fragmentData) {
          // Calculate expansion based on hover
          let targetExpansion = 0;
          
          // If we have a hovered fragment, calculate influence
          if (hoverPoint) {
            // Get world position of this fragment
            const fragWorldPos = new THREE.Vector3();
            child.getWorldPosition(fragWorldPos);
            
            // Distance from this fragment to the hovered point
            const distToHover = fragWorldPos.distanceTo(hoverPoint);
            
            // Is this the hovered fragment?
            const isHovered = child.name === hoveredFragment;
            
            if (isHovered) {
              // Direct hover = maximum expansion
              targetExpansion = maxExpansion;
            } else if (distToHover < influenceRadius) {
              // Falloff based on distance - closer fragments expand more
              const influence = 1 - (distToHover / influenceRadius);
              targetExpansion = maxExpansion * influence * 0.6; // Surrounding fragments expand less
            }
          }
          
          // Smoothly animate between current expansion and target
          fragmentData.currentExpansion += (targetExpansion - fragmentData.currentExpansion) * animSpeed;
          
          // Apply expansion along direction from center
          const expansionOffset = fragmentData.directionFromCenter.clone().multiplyScalar(fragmentData.currentExpansion);
          
          // Generate a unique animation based on the child's uuid
          const uniqueValue = child.uuid.charCodeAt(0) / 255;
          const secondUniqueValue = child.uuid.charCodeAt(1) / 255;
          
          // Set very subtle floating animation parameters
          const floatSpeed = 0.1 + uniqueValue * 0.1;
          const floatAmplitude = 0.003 + uniqueValue * 0.002;
          
          // Original position includes the base explosion but not the hover expansion
          const originalPos = fragmentData.originalPosition;
          
          // Apply floating animation + hover expansion
          child.position.x = originalPos.x + expansionOffset.x + Math.sin(t * floatSpeed) * floatAmplitude;
          child.position.y = originalPos.y + expansionOffset.y + Math.cos(t * floatSpeed * 0.8) * floatAmplitude;
          child.position.z = originalPos.z + expansionOffset.z + Math.sin(t * floatSpeed * 0.6 + 0.3) * floatAmplitude;
        } else {
          // Fallback for any fragments not in our map - just apply basic animation
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
        }
        
        // Add subtle rotation
        const rotSpeed = 0.05 + (child.uuid.charCodeAt(1) / 255) * 0.05;
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