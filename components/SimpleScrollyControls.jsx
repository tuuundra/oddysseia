"use client";

import { createContext, useContext, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

// Create a context for scroll data
export const ScrollContext = createContext({ offset: 0 });

// Hook to consume scroll data (replacement for useScroll)
export const useSimpleScroll = () => useContext(ScrollContext);

// Component to animate camera based on scroll
export function CameraScrollAnimation({ children }) {
  const { offset } = useSimpleScroll();
  const initialCameraRef = useRef(null);
  const { camera } = useThree();
  
  // Add mouse position tracking
  const mousePosition = useRef({ x: 0, y: 0 });
  
  // Rock position (world space position of the floating rock)
  const rockPosition = useRef(new THREE.Vector3(23, 0, -22));
  
  // Store initial camera position on first render
  if (initialCameraRef.current === null) {
    initialCameraRef.current = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone()
    };
  }
  
  // Set up mouse event listener
  useEffect(() => {
    const handleMouseMove = (event) => {
      // Convert mouse position to normalized coords (-1 to 1)
      mousePosition.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1
      };
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  useFrame(() => {
    const initial = initialCameraRef.current;
    if (!initial) return;
    
    // Enhanced camera movement that completes by 30% scroll
    const targetPosition = new THREE.Vector3();
    
    // First phase of movement (0-0.1) 
    if (offset <= 0.1) {
      const normalizedOffset = offset / 0.1;
      targetPosition.set(
        initial.position.x + normalizedOffset * -5,      // Move right
        initial.position.y - normalizedOffset * 4,        // Move down
        initial.position.z + normalizedOffset * -10       // Move backward
      );
      
      // Apply mouse influence only in the first phase (rock scene)
      // Scale down mouse influence as we scroll further
      const mouseInfluence = 1.0 - normalizedOffset * 0.8;
      targetPosition.x -= mousePosition.current.x * 1.0 * mouseInfluence;
      targetPosition.y += mousePosition.current.y * 0.8 * mouseInfluence;
    } 
    // Second phase of movement (0.1-0.2)
    else if (offset <= 0.2) {
      const normalizedOffset = (offset - 0.1) / 0.1;
      targetPosition.set(
        initial.position.x - 5 + normalizedOffset * -8,  // Continue moving right
        initial.position.y - 4 + normalizedOffset * 6,   // Move up for new view
        initial.position.z - 10 + normalizedOffset * -20 // Move back further to make room for grid
      );
      
      // Apply reduced mouse influence during transition
      const mouseInfluence = 0.2 - normalizedOffset * 0.2; // Fades from 0.2 to 0
      targetPosition.x -= mousePosition.current.x * 1.0 * mouseInfluence;
      targetPosition.y += mousePosition.current.y * 0.8 * mouseInfluence;
    }
    // Final phase (0.2-0.3) - completes by 30% scroll
    else {
      const normalizedOffset = Math.min((offset - 0.2) / 0.1, 1); // Cap at 1 for scroll > 30%
      targetPosition.set(
        initial.position.x - 13 + normalizedOffset * -5, // Slight final movement
        initial.position.y + 2 + normalizedOffset * 2,   // Slight upward drift
        initial.position.z - 25 + normalizedOffset * -5  // Final depth movement
      );
      
      // No mouse influence in the final phase
    }
    
    // Calculate rotation that looks at the rock during first phase
    // and transitions to the original behavior for later phases
    const targetLookAt = new THREE.Vector3();
    
    if (offset <= 0.1) {
      // First phase - look at the floating rock
      targetLookAt.copy(rockPosition.current);
      
      // Add subtle animation to the camera target to avoid a perfectly static view
      const time = performance.now() * 0.0005;
      targetLookAt.x += Math.sin(time * 0.5) * 0.2;
      targetLookAt.y += Math.cos(time * 0.3) * 0.1;
    } else if (offset <= 0.2) {
      // Second phase - transition to new orientation
      // Extract the current forward direction from the camera
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(initial.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(initial.quaternion);
      
      const normalizedOffset = (offset - 0.1) / 0.1;
      
      // Blend between looking at rock and looking forward with offset
      if (normalizedOffset < 0.5) {
        // First half of transition: still look at rock
        targetLookAt.copy(rockPosition.current);
      } else {
        // Second half: transition to normal look
        const transitionFactor = (normalizedOffset - 0.5) * 2; // 0 to 1
        
        targetLookAt.copy(camera.position);
        targetLookAt.add(forward.clone().multiplyScalar(10 - transitionFactor * 2))
                   .sub(right.clone().multiplyScalar(5 + transitionFactor * 3));
      }
    } else {
      // Final phase - settled into new view (maxes out at 30%)
      // Extract the current forward direction from the camera
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(initial.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(initial.quaternion);
      
      const normalizedOffset = Math.min((offset - 0.2) / 0.1, 1); // Cap at 1 for scroll > 30%
      targetLookAt.copy(camera.position);
      targetLookAt.add(forward.clone().multiplyScalar(8))
                 .sub(right.clone().multiplyScalar(8 + normalizedOffset * 2));
    }
    
    // Apply smooth camera movements
    camera.position.lerp(targetPosition, 0.1);
    
    // Update camera look-at rotation
    const lookMatrix = new THREE.Matrix4();
    lookMatrix.lookAt(camera.position, targetLookAt, camera.up);
    const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
    camera.quaternion.slerp(targetQuaternion, 0.1);
  });
  
  return children;
}

// Visual HTML overlay that shows at different scroll positions
export function HtmlContent() {
  return (
    <div style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '500vh', // 5x viewport height for 5 scroll sections
      pointerEvents: 'none',
      zIndex: 100
    }}>
      {/* Empty container for future content if needed */}
    </div>
  );
} 