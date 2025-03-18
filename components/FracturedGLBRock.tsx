import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const FracturedGLBRock = () => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Track rotation of the entire rock group
  const rockRotation = useRef({
    x: 0,
    y: 0,
    z: 0
  });
  
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
  const prevMouse = useRef(new THREE.Vector2(-1000, -1000)); // Track previous position
  const mouseVelocity = useRef(0); // Track mouse movement speed
  
  // Keep track of which fragment is currently hovered
  const [hoveredFragment, setHoveredFragment] = useState<string | null>(null);
  const hoveredFragmentRef = useRef<string | null>(null);
  
  // For smooth hover interpolation - move to component level
  const lastMousePos = useRef(new THREE.Vector3(0, 0, 0));
  const targetHoverPoint = useRef(new THREE.Vector3(0, 0, 0));
  const isMouseMoving = useRef(false);
  const lastMouseMoveTime = useRef(0);
  
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
      // Store previous mouse position
      prevMouse.current.copy(mouse.current);
      
      // Update current mouse position
      const newX = (event.clientX / window.innerWidth) * 2 - 1;
      const newY = -(event.clientY / window.innerHeight) * 2 + 1;
      
      // Calculate mouse velocity (squared distance, no need for sqrt)
      const dx = newX - prevMouse.current.x;
      const dy = newY - prevMouse.current.y;
      mouseVelocity.current = dx*dx + dy*dy;
      
      // Set the new mouse position
      mouse.current.set(newX, newY);
      
      // Flag that mouse is moving and update timestamp
      isMouseMoving.current = true;
      lastMouseMoveTime.current = performance.now();
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
    
    // Update the overall rotation of the entire rock group
    // Using very slow rotation speeds for a subtle effect
    rockRotation.current.y += 0.0005; // Slow rotation around Y axis
    rockRotation.current.x = Math.sin(t * 0.1) * 0.01; // Very subtle tilt on X axis
    rockRotation.current.z = Math.cos(t * 0.08) * 0.005; // Extremely subtle tilt on Z axis
    
    // Apply the rotation to the entire group
    if (groupRef.current) {
      groupRef.current.rotation.x = rockRotation.current.x;
      groupRef.current.rotation.y = rockRotation.current.y;
      groupRef.current.rotation.z = rockRotation.current.z;
    }
    
    // Check if mouse has been still for a while
    const MOUSE_STILL_THRESHOLD = 100; // ms
    if (isMouseMoving.current && performance.now() - lastMouseMoveTime.current > MOUSE_STILL_THRESHOLD) {
      isMouseMoving.current = false;
    }
    
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
    
    // Store the hovered fragment in a ref to avoid state updates on every frame
    const currentHovered = hoveredMesh ? hoveredMesh.name : null;
    
    // Only update state when it actually changes, and do it outside the frame loop
    if (hoveredFragmentRef.current !== currentHovered) {
      hoveredFragmentRef.current = currentHovered;
      // Use requestAnimationFrame to batch state updates outside the render loop
      requestAnimationFrame(() => {
        setHoveredFragment(currentHovered);
      });
    }
    
    // Calculate hover positions for all fragments
    const hoverPoint = hoveredMesh ? new THREE.Vector3().setFromMatrixPosition(hoveredMesh.matrixWorld) : null;
    
    // Max expansion amount when hovering
    const maxExpansion = 0.15;
    
    // Max distance for influence spreading to nearby fragments
    const influenceRadius = 1.8; // Increased radius for wider effect area
    
    // Animation speed for expansion/contraction - much slower overall
    const animSpeed = isMouseMoving.current ? 0.04 : 0.01; // Reduced by 50% for slower animation
    
    // Smooth interpolation of the hover point
    if (hoverPoint) {
      // If mouse has been still for a while, lock the target position completely
      // This prevents micromovements in the hover detection that can cause jitters
      if (!isMouseMoving.current) {
        if (performance.now() - lastMouseMoveTime.current > 500) { // Slightly longer threshold for complete position lock
          // After 500ms of no movement, just maintain the current position
          // Don't update targetHoverPoint at all
        } else {
          // During the initial stillness period, allow small adjustments
          targetHoverPoint.current.copy(hoverPoint);
          lastMousePos.current.lerp(targetHoverPoint.current, 0.15); // Slightly slower adjustment (reduced from 0.2)
        }
      } else {
        // Normal movement interpolation - smoother with slowed down lerp
        targetHoverPoint.current.copy(hoverPoint);
        lastMousePos.current.lerp(targetHoverPoint.current, 0.06); // Significantly slower interpolation (reduced from 0.1)
      }
    } else {
      // No hover, gradually move target away
      targetHoverPoint.current.set(0, 0, 0);
      lastMousePos.current.lerp(targetHoverPoint.current, 0.02); // Even slower transition back (reduced from 0.03)
    }
    
    // Update all fragments positions based on hover state
    fragmentsMap.current.forEach((fragmentData, name) => {
      const { mesh, directionFromCenter, originalPosition } = fragmentData;
      let targetExpansion = 0;
      
      // If we have a hovered fragment, calculate influence
      if (hoverPoint) {
        // Get world position of this fragment
        const fragWorldPos = new THREE.Vector3();
        mesh.getWorldPosition(fragWorldPos);
        
        // Distance from this fragment to the interpolated hover point
        const distToHover = fragWorldPos.distanceTo(lastMousePos.current);
        
        // Is this the hovered fragment?
        const isHovered = name === hoveredFragmentRef.current;
        
        if (isHovered) {
          // Direct hover = maximum expansion
          targetExpansion = maxExpansion;
        } else if (distToHover < influenceRadius) {
          // Enhanced influence curve with smoother falloff
          // Use a cubic falloff that gives more expansion to more fragments
          const normDist = distToHover / influenceRadius;
          // Softer, smoother falloff curve with more gradual transition
          const influence = Math.pow(1 - normDist, 3); 
          targetExpansion = maxExpansion * influence * 0.9; // Stronger effect for peripheral fragments
        }
      }
      
      // For moving mouse - implement a staged approach for smoother transitions
      let dampingFactor;
      
      if (targetExpansion < fragmentData.currentExpansion) {
        // Returning to rest state - use a slower factor based on how expanded it is
        // More expanded = faster initial return, slowing down as it approaches rest
        const expansionRatio = fragmentData.currentExpansion / maxExpansion;
        dampingFactor = animSpeed * (0.2 + expansionRatio * 0.2); // Progressive return speed
      } else {
        // Expanding - slightly slower expansion for smoothness
        dampingFactor = animSpeed * 0.7;
      }
      
      // Apply smoothing with added damping to prevent oscillation
      fragmentData.currentExpansion += (targetExpansion - fragmentData.currentExpansion) * dampingFactor;
      
      // Threshold to prevent micro-jitters when almost at rest position
      // Use an increased threshold to ensure fragments fully return to zero
      const restThreshold = 0.001; // Increased from 0.0008
      
      // Force fragments to truly reset when close to rest and target is zero
      if (Math.abs(fragmentData.currentExpansion) < restThreshold && targetExpansion === 0) {
        fragmentData.currentExpansion = 0;
      }
      
      // Apply expansion along direction from center
      const expansionOffset = directionFromCenter.clone().multiplyScalar(fragmentData.currentExpansion);
      
      // Generate a unique animation based on the child's uuid
      const uniqueValue = name.charCodeAt(0) / 255;
      const secondUniqueValue = name.charCodeAt(1) / 255;
      
      // Set very subtle floating animation parameters
      const floatSpeed = 0.1 + uniqueValue * 0.1;
      const floatAmplitude = 0.003 + uniqueValue * 0.002;
      
      // Make sure we're using the exact original position
      const originalPos = originalPosition.clone();
      
      // Apply floating animation + hover expansion
      mesh.position.x = originalPos.x + expansionOffset.x + Math.sin(t * floatSpeed) * floatAmplitude;
      mesh.position.y = originalPos.y + expansionOffset.y + Math.cos(t * floatSpeed * 0.8) * floatAmplitude;
      mesh.position.z = originalPos.z + expansionOffset.z + Math.sin(t * floatSpeed * 0.6 + 0.3) * floatAmplitude;
      
      // Add subtle rotation
      const rotSpeed = 0.05 + secondUniqueValue * 0.05;
      if (!mesh.userData.originalRotation) {
        mesh.userData.originalRotation = new THREE.Euler().copy(mesh.rotation);
      }
      const origRot = mesh.userData.originalRotation;
      
      mesh.rotation.x = origRot.x + Math.sin(t * rotSpeed) * 0.001;
      mesh.rotation.y = origRot.y + Math.cos(t * rotSpeed * 0.7) * 0.001;
      mesh.rotation.z = origRot.z + Math.sin(t * rotSpeed * 0.5) * 0.001;
    });
    
    // Handle any fragments not in the map
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && !fragmentsMap.current.has(child.name)) {
        // Fallback for any fragments not in our map - just apply basic animation
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
    <group ref={groupRef} rotation={[rockRotation.current.x, rockRotation.current.y, rockRotation.current.z]}>
      {/* The actual fractured rock model */}
      <primitive object={scene.current} />
    </group>
  );
};

// Preload the model with the correct path
useGLTF.preload('fractured_rock.glb', true);

export default FracturedGLBRock; 