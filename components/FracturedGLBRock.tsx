import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Create a utility function for glow effects
const createMaterialWithGlow = (originalMaterial: THREE.Material, glowStrength: number = 0) => {
  // Simply return a clone of the original material without any glow effects
  return originalMaterial.clone();
};

interface FracturedGLBRockProps {
  position?: [number, number, number];
  appearThreshold?: number;
  onHover?: () => void;
  onBlur?: () => void;
  onRockClick?: () => void;
}

const FracturedGLBRock = ({
  position = [0, 0, 0],
  appearThreshold = 0.45,
  onHover,
  onBlur,
  onRockClick
}: FracturedGLBRockProps) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Track rotation of the entire rock group
  const rockRotation = useRef({
    y: 0 // Only need Y-axis rotation now
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
  
  // For momentum effect
  const lastHoverTime = useRef(0);
  const hasMomentum = useRef(false);
  const momentumPhase = useRef(0); // 0-1 value for momentum curve
  const lastHoverPoint = useRef(new THREE.Vector3(0, 0, 0));
  
  // Add stable proximity state tracking to reduce jitter
  const isInProximity = useRef(false);
  const proximityStartTime = useRef(0);
  const proximityHoldTime = 300; // ms to hold expansion after entering proximity
  
  // Track all fragments for easy access during hover effects
  const fragmentsMap = useRef(new Map<string, {
    mesh: THREE.Mesh,
    distanceFromCenter: number,
    directionFromCenter: THREE.Vector3,
    originalPosition: THREE.Vector3,
    currentExpansion: number, // Track current expansion amount for smooth transitions
    originalMaterial: THREE.Material | THREE.Material[], // Store the original material
    currentGlow: number // Track current glow amount
  }>());
  
  // Track the glow map
  const glowMap = useRef(new Map<string, number>()); // Map fragment names to glow strength
  
  // Add fragment neighbors reference at the top with other refs
  const fragmentNeighborsRef = useRef(new Map<string, string[]>());
  
  const pivotOffsetX = 0; // Adjust to move pivot left/right
  const pivotOffsetY = 0; // Adjust to move pivot up/down
  const pivotOffsetZ = 0; // Adjust to move pivot forward/back
  
  const rockOffsetX = 0.2; // Adjust to move rock left/right relative to pivot
  const rockOffsetY = 0; // Adjust to move rock up/down relative to pivot
  const rockOffsetZ = 0.05; // Adjust to move rock forward/back relative to pivot
  
  // Add these at the top with other refs
  const hoverAreaRef = useRef<THREE.Mesh>(null);
  const textHoverRef = useRef(false);
  
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
          const maxExplosion = 0.001;  // REDUCED from 0.04 for tighter default spacing
          const minExplosion = 0.0005;  // REDUCED from 0.01 for center pieces
          
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
            currentExpansion: 0,
            originalMaterial: child.material,
            currentGlow: 0
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
          
          // Store the original material for later reference
          const originalMaterial = child.material;
          
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
            });
          }
          
          // Make sure the mesh has a name for the fragments map
          if (!child.name) {
            child.name = 'fragment_' + child.uuid.substring(0, 8);
          }
          
          // Add to glow map with initial value of 0
          glowMap.current.set(child.name, 0);
          
          // Update the fragments map with the original material
          const fragmentData = fragmentsMap.current.get(child.name);
          if (fragmentData) {
            fragmentData.originalMaterial = originalMaterial;
            fragmentData.currentGlow = 0;
          }
        }
      });
    }
  }, []);
  
  // Calculate fragment neighboring map on initialization
  useEffect(() => {
    if (scene.current) {
      // After setting up fragments, calculate which fragments are neighbors
      // A map to store each fragment's neighboring fragments
      const neighborMap = new Map<string, string[]>();
      
      // Function to check if two fragments are close enough to be neighbors
      const areFragmentsNeighboring = (pos1: THREE.Vector3, pos2: THREE.Vector3) => {
        // Use a smaller threshold to only consider fragments that nearly touch
        const neighboringThreshold = 0.1; // Reduced from typical values to only get very close neighbors
        return pos1.distanceTo(pos2) < neighboringThreshold;
      };
      
      // Get all fragment meshes
      const fragmentMeshes: {name: string, position: THREE.Vector3}[] = [];
      
      scene.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.visible && child.userData.isFragment) {
          fragmentMeshes.push({
            name: child.name,
            position: child.position.clone()
          });
        }
      });
      
      // Calculate neighboring relationships
      fragmentMeshes.forEach(fragment => {
        const neighbors: string[] = [];
        
        fragmentMeshes.forEach(otherFragment => {
          if (fragment.name !== otherFragment.name) {
            if (areFragmentsNeighboring(fragment.position, otherFragment.position)) {
              neighbors.push(otherFragment.name);
            }
          }
        });
        
        neighborMap.set(fragment.name, neighbors);
      });
      
      // Store the neighbor map as a ref
      fragmentNeighborsRef.current = neighborMap;
      
      // Log for debugging
      console.log('Fragment neighbors map created:', neighborMap);
    }
  }, []);
  
  // Animate the rock fragments with subtle floating motion and handle mouse interaction
  useFrame(({ clock }) => {
    if (!groupRef.current || !hoverAreaRef.current) return;
    
    const t = clock.getElapsedTime();
    
    // Update the overall rotation of the entire rock group
    // Using very slow rotation speed for a subtle effect
    rockRotation.current.y -= -0.0015; // Negative value for counter-clockwise rotation
    
    // Apply the rotation to the entire group
    groupRef.current.rotation.y = rockRotation.current.y;
    
    // Add a slight tilt to make the rotation more horizontal
    const tiltAngle = Math.PI / 20; // ~90 degrees tilt
    groupRef.current.rotation.x = tiltAngle; // Tilt forward around X-axis
    
    // Add a slight roll to make the rotation more dynamic
    const rollAngle = Math.sin(t * 0.1) * 0.01; // Subtle oscillating roll
    groupRef.current.rotation.z = rollAngle;
    
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
    
    // Track if mouse is in proximity to any fragment
    let mouseInProximity = false;
    
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
          mouseInProximity = true;
          break;
        }
      }
    }
    
    // Check if mouse is in general proximity to the rock (even without direct hover)
    // This prevents retraction when mouse is still near the rock
    if (!mouseInProximity) {
      // Calculate distance from mouse ray to rock center
      const rockCenterWorld = new THREE.Vector3();
      if (groupRef.current) {
        groupRef.current.getWorldPosition(rockCenterWorld);
      }
      
      // Project mouse position into 3D space at the rock's distance from camera
      const mouseRay = raycaster.current.ray.clone();
      const distanceToRock = rockCenterWorld.distanceTo(camera.position);
      const mousePoint = mouseRay.at(distanceToRock, new THREE.Vector3());
      
      // Check if mouse is within proximity radius
      const proximityThreshold = 5.0; // Adjust based on your scene scale
      mouseInProximity = mousePoint.distanceTo(rockCenterWorld) < proximityThreshold;
    }
    
    // Update stable proximity state with hysteresis to prevent rapid toggling
    if (mouseInProximity && !isInProximity.current) {
      // Just entered proximity
      isInProximity.current = true;
      proximityStartTime.current = performance.now();
    } else if (!mouseInProximity && isInProximity.current) {
      // Only exit proximity state if we've been out of proximity for a short time
      // This prevents flickering in/out of proximity state
      if (performance.now() - lastHoverTime.current > 150) {
        isInProximity.current = false;
      }
    }
    
    // Use the stable proximity state for expansion logic to prevent jitter
    const stableProximity = isInProximity.current;
    
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
    
    // Store the mouse point in 3D space for proximity-based expansion
    const mouseWorldPoint = new THREE.Vector3();
    
    // If mouse is in proximity but not hovering, we need a position for distance calculations
    if (!hoverPoint && stableProximity) {
      // Calculate a 3D point for the mouse position at the rock's distance from camera
      const rockCenterWorld = new THREE.Vector3();
      if (groupRef.current) {
        groupRef.current.getWorldPosition(rockCenterWorld);
      }
      const mouseRay = raycaster.current.ray.clone();
      const distanceToRock = rockCenterWorld.distanceTo(camera.position);
      mouseWorldPoint.copy(mouseRay.at(distanceToRock, new THREE.Vector3()));
    }
    
    // If we have a hover point, update the last hover time and position
    if (hoverPoint) {
      lastHoverTime.current = performance.now();
      lastHoverPoint.current.copy(hoverPoint);
      hasMomentum.current = true;
      momentumPhase.current = 0; // Reset momentum phase during active hover
    } else if (stableProximity) {
      // If mouse is still in proximity, keep updating the hover time to prevent retraction
      lastHoverTime.current = performance.now();
      lastHoverPoint.current.copy(mouseWorldPoint); // Use the calculated mouse world point
      hasMomentum.current = true;
    }
    
    // Calculate time since last hover/proximity
    const timeSinceHover = performance.now() - lastHoverTime.current;
    
    // Check if we're in momentum phase (recently hovered but not currently hovering)
    // Only enter momentum phase if we're actually leaving proximity completely
    const inMomentumPhase = hasMomentum.current && !hoverPoint && !stableProximity && timeSinceHover < 200;
    
    // Handle momentum phase - continuation of expansion after mouse leaves
    if (inMomentumPhase) {
      // Progress from 0 to 1 over the momentum duration
      momentumPhase.current = Math.min(timeSinceHover / 200, 1); // UPDATED to match new duration
    } else if (!hoverPoint && hasMomentum.current) {
      // We've passed the momentum phase, reset
      hasMomentum.current = false;
    }
    
    // Max expansion amount when hovering
    const maxExpansion = .30; // INCREASED from .22 to .30 for more dramatic outward movement
    
    // Max distance for influence spreading to nearby fragments
    const influenceRadius = 1.2;
    
    // Animation speed for expansion/contraction
    const animSpeed = isMouseMoving.current ? 0.20 : 0.15; // INCREASED for more responsive expansion
    
    // Smooth interpolation of the hover point with momentum
    if (hoverPoint) {
      // Regular hover behavior
      if (!isMouseMoving.current) {
        if (performance.now() - lastMouseMoveTime.current > 300) {
          // After 300ms of no movement, just maintain the current position
        } else {
          targetHoverPoint.current.copy(hoverPoint);
          lastMousePos.current.lerp(targetHoverPoint.current, 0.5);
        }
      } else {
        targetHoverPoint.current.copy(hoverPoint);
        lastMousePos.current.lerp(targetHoverPoint.current, 0.4);
      }
    } else if (stableProximity) {
      // If just in proximity, use the mouse world point
      targetHoverPoint.current.copy(mouseWorldPoint);
      lastMousePos.current.lerp(targetHoverPoint.current, 0.4);
    } else if (inMomentumPhase) {
      // During momentum phase - keep the last hover point, but apply momentum curve
      if (momentumPhase.current <= 0.25) {
        // Continue stronger movement in direction of last movement
        targetHoverPoint.current.copy(lastHoverPoint.current);
        lastMousePos.current.lerp(targetHoverPoint.current, 0.3);
      }
    } else {
      // No hover and no momentum, rapidly reset
      targetHoverPoint.current.set(0, 0, 0);
      lastMousePos.current.lerp(targetHoverPoint.current, 0.3);
    }
    
    // Reset all glow strengths first for re-calculation
    fragmentsMap.current.forEach((fragmentData, name) => {
      // Always set glow to 0 instead of calculating glow values
      fragmentData.currentGlow = 0;
    });
    
    // Removed glow setting for hovered fragment - no longer needed since glow is disabled
    
    // Update all fragments positions based on hover state
    fragmentsMap.current.forEach((fragmentData, name) => {
      const { mesh, directionFromCenter, originalPosition, currentGlow } = fragmentData;
      let targetExpansion = 0;
      
      // Get world position of this fragment
      const fragWorldPos = new THREE.Vector3();
      mesh.getWorldPosition(fragWorldPos);
      
      // If we have a hovered fragment or mouse is in proximity, calculate influence
      if (hoverPoint || stableProximity) {
        // The point to use for distance calculations (either direct hover or mouse position)
        const referencePoint = hoverPoint || mouseWorldPoint;
        
        // Distance from this fragment to the interpolated hover/mouse point
        const distToRef = fragWorldPos.distanceTo(lastMousePos.current);
        
        // Is this the hovered fragment?
        const isHovered = name === hoveredFragmentRef.current;
        
        if (isHovered) {
          // Direct hover = maximum expansion
          targetExpansion = maxExpansion;
        } else if (distToRef < influenceRadius) {
          // Enhanced influence curve with steeper falloff
          const normDist = distToRef / influenceRadius;
          // Steeper falloff curve for sharper transition
          const influence = Math.pow(1 - normDist, 4.0);
          
          // Scale expansion based on mouse proximity
          if (hoverPoint) {
            // Full effect when directly hovering over a fragment
            targetExpansion = maxExpansion * influence * 0.8;
          } else if (stableProximity) {
            // Calculate a distance-based scaling factor for proximity
            const rockCenterWorld = new THREE.Vector3();
            if (groupRef.current) {
              groupRef.current.getWorldPosition(rockCenterWorld);
            }
            const distToCenter = mouseWorldPoint.distanceTo(rockCenterWorld);
            const proximityThreshold = 5.0;
            const proximityFactor = 1.0 - Math.min(distToCenter / proximityThreshold, 1.0);
            
            // Apply scaled expansion based on proximity to rock center
            targetExpansion = maxExpansion * influence * 0.8 * proximityFactor;
          }
        }
      } else if (inMomentumPhase) {
        // In momentum phase, calculate based on last hover position
        // Distance from this fragment to the last hover point
        const distToLastHover = fragWorldPos.distanceTo(lastMousePos.current);
        
        if (distToLastHover < influenceRadius) {
          // During momentum phase, adjust expansion based on phase
          const normDist = distToLastHover / influenceRadius;
          const influence = Math.pow(1 - normDist, 4.0);
          
          if (momentumPhase.current <= 0.25) {
            // First 25% of momentum - INCREASE to 125% of max expansion for extra dramatic effect
            targetExpansion = maxExpansion * influence * 1.25;
          } else {
            // Remaining 75% - rapidly cool off with a steep curve
            const cooldownFactor = 1 - ((momentumPhase.current - 0.25) / 0.75);
            const steepCurve = Math.pow(cooldownFactor, 3);
            targetExpansion = maxExpansion * influence * steepCurve;
          }
        }
      }
      
      // For moving mouse - implement a staged approach for smoother transitions
      let dampingFactor;
      
      // Adjust damping based on whether we're expanding or retracting
      // Use a softer damping when in proximity to prevent jitter
      if (targetExpansion < fragmentData.currentExpansion) {
        // Only allow retraction when not in proximity or actively hovering
        if (!stableProximity && !hoverPoint) {
          // Returning to rest state - use a faster factor based on how expanded it is
          // More expanded = faster initial return
          const expansionRatio = fragmentData.currentExpansion / maxExpansion;
          dampingFactor = animSpeed * (0.7 + expansionRatio * 0.8);
        } else {
          // When in proximity but expansion is decreasing, use very gentle damping
          // This prevents jitter during small mouse movements
          dampingFactor = animSpeed * 0.2;
        }
      } else {
        // Expanding - slightly faster for hovering, slower for proximity
        dampingFactor = hoverPoint ? animSpeed * 0.9 : animSpeed * 0.6;
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
      
      // Apply glow effect with outline appearance
      if (currentGlow > 0) {
        // This condition will never be true now since currentGlow is always 0
        // The code inside is kept for reference but will never execute
        
        // ... existing code ...
        
      } else {
        // Reset material when no glow
        if (Array.isArray(fragmentData.originalMaterial)) {
          // Clone the original materials to avoid modifying them
          mesh.material = (fragmentData.originalMaterial as THREE.Material[]).map(mat => mat.clone());
        } else {
          mesh.material = (fragmentData.originalMaterial as THREE.Material).clone();
        }
        
        // Keep scale at 1 (normal size)
        mesh.scale.set(1, 1, 1);
      }
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

    // Check intersections with invisible hover area
    const hoverAreaIntersects = raycaster.current.intersectObject(hoverAreaRef.current);
    const isTextHover = hoverAreaIntersects.length > 0;

    // Update text hover state only
    if (textHoverRef.current !== isTextHover) {
      textHoverRef.current = isTextHover;
      if (isTextHover) {
        if (onHover) onHover();
      } else {
        if (onBlur) onBlur();
      }
    }
  });
  
  // Add a click handler for the hover area
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      // Only process clicks if we have the callback
      if (!onRockClick) return;
      
      // Check if click is on hover area
      raycaster.current.setFromCamera(mouse.current, camera);
      if (hoverAreaRef.current) {
        const intersects = raycaster.current.intersectObject(hoverAreaRef.current);
        if (intersects.length > 0) {
          // Call the click handler
          console.log("%c 🪨 ROCK CLICKED! 🪨 ", "background: #ff0000; color: white; font-size: 20px; padding: 10px;");
          onRockClick();
        }
      }
    };
    
    // Add click event listener
    window.addEventListener('click', handleClick);
    
    // Clean up
    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, [camera, onRockClick]);
  
  return (
    <group ref={groupRef} position={[0, 0.2, 0]}>
      {/* Invisible hover area for text */}
      <mesh
        ref={hoverAreaRef}
        position={[rockOffsetX, rockOffsetY, rockOffsetZ]} // Use exact same offsets as the rock
        visible={true}
        renderOrder={1} // Render before other objects
      >
        <sphereGeometry args={[0.33, 16, 8]} /> {/* Increased size for better click detection */}
        <meshBasicMaterial 
          color="#ffffff" 
          transparent={true} 
          opacity={0} // Very slight opacity to ensure clicks register
          wireframe={process.env.NODE_ENV === 'development'} // Show wireframe in dev mode
        />
      </mesh>

      {/* The actual fractured rock model - position relative to pivot */}
      <group position={[rockOffsetX, rockOffsetY, rockOffsetZ]}>
        <primitive 
          object={scene.current} 
          position={[0.1, -0.1, -0.1]}  // Keep rock at origin relative to its parent group
        />
      </group>
    </group>
  );
};

// Preload the model with the correct path
useGLTF.preload('fractured_rock.glb', true);

export default FracturedGLBRock; 