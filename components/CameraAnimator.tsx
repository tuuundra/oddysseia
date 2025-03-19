import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';

// Enhanced camera animator with more dramatic motion
export function CameraAnimator() {
  const { camera } = useThree();
  const initialPosition = useRef(new THREE.Vector3().copy(camera.position));
  const initialQuaternion = useRef(new THREE.Quaternion().copy(camera.quaternion));
  const scroll = useScroll();
  
  // Store initial camera values on mount
  useEffect(() => {
    initialPosition.current.copy(camera.position);
    initialQuaternion.current.copy(camera.quaternion);
    
    console.log('Initial camera position:', {
      x: camera.position.x.toFixed(2),
      y: camera.position.y.toFixed(2),
      z: camera.position.z.toFixed(2)
    });
    
    return () => {
      // Reset camera when unmounting
      camera.position.copy(initialPosition.current);
      camera.quaternion.copy(initialQuaternion.current);
    };
  }, [camera]);
  
  useFrame(() => {
    // Get scroll progress (0 to 1)
    const scrollProgress = scroll.offset;
    
    // Log scroll progress for debugging
    if (scrollProgress > 0) {
      console.log(`Scroll progress: ${scrollProgress.toFixed(2)}`);
    }
    
    // AMPLIFIED camera movement for more dramatic effect
    // Move significantly towards the rock while looking directly at it
    const targetPosition = new THREE.Vector3(
      initialPosition.current.x - scrollProgress * 18, // More dramatic leftward movement
      initialPosition.current.y + scrollProgress * 1,  // Slight upward movement
      initialPosition.current.z + scrollProgress * 15  // More dramatic movement toward rock
    );
    
    // Always look at the rock area - fixed target for smooth rotation
    const targetLookAt = new THREE.Vector3(
      23, // Rock X position
      0,  // Rock Y position
      -22 // Rock Z position
    );
    
    // Smoothly interpolate camera position with increased responsiveness
    camera.position.lerp(targetPosition, 0.1); // Increased from 0.05 for more immediate response
    
    // Calculate and apply rotation to look at target
    const lookAtMatrix = new THREE.Matrix4();
    lookAtMatrix.lookAt(camera.position, targetLookAt, camera.up);
    const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix);
    camera.quaternion.slerp(targetQuaternion, 0.1); // Increased from 0.05
  });
  
  return null;
} 