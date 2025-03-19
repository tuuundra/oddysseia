"use client";

import { createContext, useContext, useRef } from 'react';
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
  
  // Store initial camera position on first render
  if (initialCameraRef.current === null) {
    initialCameraRef.current = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone()
    };
  }
  
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
    } 
    // Second phase of movement (0.1-0.2)
    else if (offset <= 0.2) {
      const normalizedOffset = (offset - 0.1) / 0.1;
      targetPosition.set(
        initial.position.x - 5 + normalizedOffset * -8,  // Continue moving right
        initial.position.y - 4 + normalizedOffset * 6,   // Move up for new view
        initial.position.z - 10 + normalizedOffset * -20 // Move back further to make room for grid
      );
    }
    // Final phase (0.2-0.3) - completes by 30% scroll
    else {
      const normalizedOffset = Math.min((offset - 0.2) / 0.1, 1); // Cap at 1 for scroll > 30%
      targetPosition.set(
        initial.position.x - 13 + normalizedOffset * -5, // Slight final movement
        initial.position.y + 2 + normalizedOffset * 2,   // Slight upward drift
        initial.position.z - 25 + normalizedOffset * -5  // Final depth movement
      );
    }
    
    // Calculate rotation that looks slightly left as we scroll
    // Extract the current forward direction from the camera
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(initial.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(initial.quaternion);
    
    // Calculate a look target with different behavior based on scroll phase
    const targetLookAt = new THREE.Vector3();
    targetLookAt.copy(camera.position);
    
    if (offset <= 0.1) {
      // First phase - look increasingly left
      targetLookAt.add(forward.clone().multiplyScalar(10))
                 .sub(right.clone().multiplyScalar(offset * 10 * 5)); // 5x faster look movement
    } else if (offset <= 0.2) {
      // Second phase - transition to new orientation
      const normalizedOffset = (offset - 0.1) / 0.1;
      targetLookAt.add(forward.clone().multiplyScalar(10 - normalizedOffset * 2))
                 .sub(right.clone().multiplyScalar(5 + normalizedOffset * 3));
    } else {
      // Final phase - settled into new view (maxes out at 30%)
      const normalizedOffset = Math.min((offset - 0.2) / 0.1, 1); // Cap at 1 for scroll > 30%
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