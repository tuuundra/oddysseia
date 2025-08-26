import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

type Vector3Array = [number, number, number];

interface FloatingTextProps {
  position: Vector3Array;
  rockPosition: Vector3Array;
  isHovered: boolean;
  scale?: number; // Add scale property with optional flag
  enabled?: boolean; // Toggle overlay on/off
}

export default function FloatingText({ position, rockPosition, isHovered, scale = 1.0, enabled = false }: FloatingTextProps) {
  const groupRef = useRef<THREE.Group>(null);
  const textMaterialRef = useRef<THREE.MeshBasicMaterial>(new THREE.MeshBasicMaterial({
    color: '#ffffff',
    depthTest: false,
    transparent: true,
    opacity: 0 // Start invisible
  }));
  const lineMaterialRef = useRef<THREE.LineBasicMaterial>(null!);
  const targetOpacity = useRef(0);
  
  // Calculate positions for the line segments
  const textPosition = new THREE.Vector3(0, 0, 0); // Relative to group
  
  // Start of the line - directly below the text
  const lineStart = textPosition.clone().add(new THREE.Vector3(1.3, -0.3, 0));
  
  // First straight segment end (before the bend)
  const lineBendStart = lineStart.clone().add(new THREE.Vector3(-2.6, 0, 0));
  
  // End of the bend - adjust these values to change the angle
  const bendAngle = -140; // Degrees (90 = right angle, 120 = obtuse, 60 = acute)
  const bendLength = 0.7; // Length of the bent segment
  
  // Convert degrees to radians
  const angleRad = THREE.MathUtils.degToRad(bendAngle);
  
  // Calculate bend end position based on angle
  const lineBendEnd = new THREE.Vector3(
    lineBendStart.x + bendLength * Math.cos(angleRad),
    lineBendStart.y + bendLength * Math.sin(angleRad),
    lineBendStart.z
  );

  // Create line geometry with straight segments and a sharp bend
  const linePoints = [
    lineStart, // Start below text
    lineBendStart, // First straight segment
    lineBendEnd // Sharp bend to rock
  ];
  
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);

  // Rotation angles in radians (adjust these values)
  const xRotation = -0.15; // Tilt forward/back
  const yRotation = -0.4; // Rotate left/right
  const zRotation = -0.12; // Tilt side to side

  // Animate opacity changes
  useFrame(() => {
    // Flip the logic to show on hover
    targetOpacity.current = isHovered ? 1 : 0;
    
    // Increase lerp speed from 0.1 to 0.3 for faster transitions
    if (textMaterialRef.current) {
      textMaterialRef.current.opacity = THREE.MathUtils.lerp(
        textMaterialRef.current.opacity,
        targetOpacity.current,
        0.3 // Increased from 0.1
      );
    }
    if (lineMaterialRef.current) {
      lineMaterialRef.current.opacity = THREE.MathUtils.lerp(
        lineMaterialRef.current.opacity,
        targetOpacity.current,
        0.3 // Increased from 0.1
      );
    }
  });

  // If not enabled, render nothing
  if (!enabled) return null;

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1], position[2] + 1]} // Move forward in Z-axis
      rotation={[xRotation, yRotation, zRotation]} // Apply 3D rotation
      renderOrder={1} // Ensure this group renders last
      scale={scale} // Apply unified scale
    >
      {/* Underline with sharp bend */}
      <line>
        <bufferGeometry attach="geometry" {...lineGeometry} />
        <lineBasicMaterial 
          ref={lineMaterialRef}
          color="#ffffff"
          linewidth={2}
          depthTest={false}
          transparent={true}
          opacity={0} // Initial invisible state
        />
      </line>
      
      {/* Text */}
      <Text
        position={[0, 0.05, 0]}
        fontSize={0.4}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
        rotation={[0, Math.PI, 0]}
        material={textMaterialRef.current}
      >
        click to explore
      </Text>
    </group>
  );
} 