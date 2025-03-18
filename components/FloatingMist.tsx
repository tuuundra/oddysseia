import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type FloatingMistProps = {
  count?: number;
  color?: string;
  size?: number;
  opacity?: number;
  speed?: number;
  area?: number;
  height?: number;
};

// Define the type for particle speed data
interface ParticleSpeed {
  x: number;
  y: number;
  z: number;
  rotation: number;
}

const FloatingMist = ({
  count = 200,
  color = '#a5b4c9',
  size = 0.15,
  opacity = 0.2,
  speed = 0.03,
  area = 100,
  height = 15,
}: FloatingMistProps) => {
  // Initialize refs with proper types and initial values
  const pointsRef = useRef<THREE.Points>(null);
  const particlePositions = useRef<Float32Array | null>(null);
  const particleSpeeds = useRef<ParticleSpeed[]>([]);

  // Create particles with random positions
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds: ParticleSpeed[] = [];
    const halfArea = area / 2;
    
    for (let i = 0; i < count; i++) {
      // Random position in a defined area
      const x = Math.random() * area - halfArea;
      const y = Math.random() * height;
      const z = Math.random() * area - halfArea;
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      // Random speed factor for each particle
      speeds.push({
        x: (Math.random() - 0.5) * 0.01,
        y: Math.random() * speed * 0.5 + speed * 0.2,
        z: (Math.random() - 0.5) * 0.01,
        rotation: Math.random() * 0.02 - 0.01,
      });
    }
    
    particlePositions.current = positions;
    particleSpeeds.current = speeds;
    
    return positions;
  }, [count, area, height, speed]);
  
  // Create a soft, misty texture for particles
  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    
    if (context) {
      const gradient = context.createRadialGradient(
        16, 16, 0,
        16, 16, 16
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      context.fillStyle = gradient;
      context.fillRect(0, 0, 32, 32);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
  
  // Animate particles
  useFrame(({ clock }) => {
    if (!pointsRef.current || !particlePositions.current || !particleSpeeds.current) return;
    
    const time = clock.getElapsedTime();
    const positions = particlePositions.current;
    const speeds = particleSpeeds.current;
    const halfHeight = height / 2;
    const halfArea = area / 2;
    
    for (let i = 0; i < count; i++) {
      // Update positions with sinusoidal movement for a floating effect
      positions[i * 3] += Math.sin(time * 0.1 + i) * speeds[i].x;
      positions[i * 3 + 1] += speeds[i].y;
      positions[i * 3 + 2] += Math.sin(time * 0.1 + i * 0.5) * speeds[i].z;
      
      // Rotate around origin very slowly
      const x = positions[i * 3];
      const z = positions[i * 3 + 2];
      const rotationSpeed = speeds[i].rotation;
      
      const cosR = Math.cos(rotationSpeed);
      const sinR = Math.sin(rotationSpeed);
      
      positions[i * 3] = x * cosR - z * sinR;
      positions[i * 3 + 2] = z * cosR + x * sinR;
      
      // Reset particles that go out of bounds
      if (positions[i * 3 + 1] > height) {
        positions[i * 3] = Math.random() * area - halfArea;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = Math.random() * area - halfArea;
      }
      
      // Keep particles within horizontal bounds with some wiggle room
      if (positions[i * 3] < -halfArea * 1.2 || positions[i * 3] > halfArea * 1.2 ||
          positions[i * 3 + 2] < -halfArea * 1.2 || positions[i * 3 + 2] > halfArea * 1.2) {
        positions[i * 3] = Math.random() * area - halfArea;
        positions[i * 3 + 2] = Math.random() * area - halfArea;
      }
    }
    
    // Update the geometry
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    
    // Subtle rotation of the entire system
    pointsRef.current.rotation.y += 0.0005;
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length / 3}
          array={particles}
          itemSize={3}
          args={[particles, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        map={particleTexture}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default FloatingMist;