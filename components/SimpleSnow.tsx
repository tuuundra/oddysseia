import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Simple snow particles using basic Three.js points
const SimpleSnow = () => {
  const count = 10000; // Even more particles for a fuller effect
  
  // Create particle positions once on component mount
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    // Distribute particles in a wide area
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.8) * 100;     // x - skewed to the left for wind effect
      pos[i * 3 + 1] = Math.random() * 50;          // y - start above the scene
      pos[i * 3 + 2] = (Math.random() - 0.5) * 100; // z
    }
    return pos;
  }, []);

  // Store individual particle speeds and sizes
  const [speeds, sizes] = useMemo(() => {
    const spd = new Float32Array(count);
    const szs = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      // Power distribution - more slow particles than fast ones
      spd[i] = 0.2 + Math.pow(Math.random(), 2) * 0.8;
      
      // Size affects speed (physics - larger flakes fall faster)
      // But we want mostly smaller flakes, so use power distribution
      const sizeFactor = Math.pow(Math.random(), 3); // Mostly small particles
      szs[i] = 0.2 + sizeFactor * 0.6; // Size range: 0.2-0.8
    }
    return [spd, szs];
  }, []);

  // Reference to the points object
  const pointsRef = useRef<THREE.Points>(null);
  // Store time-offset for wind variation
  const windOffset = useRef(Math.random() * 100);
  
  // Update snow particles on each frame
  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    
    const positionArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const time = state.clock.elapsedTime;
    
    // Update each particle position
    for (let i = 0; i < count; i++) {
      // Move down based on speed
      positionArray[i * 3 + 1] -= speeds[i] * delta * 8;
      
      // Add wind effect blowing to the right with variation
      // Stronger wind at higher elevation for realism
      const heightFactor = (positionArray[i * 3 + 1] + 20) / 50; // 0-1 based on height
      
      // Wind varies over time and space - creates gusts and patterns
      const timeVariation = Math.sin(time * 0.1 + windOffset.current) * 0.5 + 0.5;
      const windStrength = (1.0 + timeVariation) * heightFactor;
      
      // Calculate wind direction with some variation
      const windAngle = Math.PI * 0.25 + Math.sin(time * 0.05 + i * 0.01) * 0.15;
      const windX = Math.cos(windAngle);
      const windZ = Math.sin(windAngle);
      
      // Apply wind force - smaller particles are affected more by wind
      const particleSize = sizes[i];
      const windEffect = windStrength * (1.2 - particleSize); // Smaller particles affected more
      
      positionArray[i * 3] += windX * windEffect * delta * speeds[i] * 10;
      positionArray[i * 3 + 2] += windZ * windEffect * delta * speeds[i] * 3;
      
      // Add swirling motion
      const swirl = 0.2;
      positionArray[i * 3] += Math.sin(time * 0.2 + i * 0.01) * delta * swirl;
      positionArray[i * 3 + 2] += Math.cos(time * 0.3 + i * 0.01) * delta * swirl;
      
      // Reset particles that fall below the scene or drift too far
      if (positionArray[i * 3 + 1] < -20 || 
          positionArray[i * 3] > 80 || 
          Math.abs(positionArray[i * 3 + 2]) > 80) {
        
        // Start more to the left (wind source)
        positionArray[i * 3] = (Math.random() - 1.2) * 100;
        // Reset to random height
        positionArray[i * 3 + 1] = 30 + Math.random() * 20;
        // Random z with slight bias against wind direction
        positionArray[i * 3 + 2] = (Math.random() - 0.6) * 100;
      }
    }
    
    // Mark the geometry as needing an update
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  // Pass sizes to the shaders
  const sizeAttrib = useMemo(() => {
    return sizes;
  }, [sizes]);

  // Create a simple texture for snow particles
  const snowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d')!;
    
    // Create a more natural snow particle shape
    const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.7)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(8, 8, 8, 0, Math.PI * 2);
    context.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute 
          attach="attributes-position" 
          count={count} 
          array={positions} 
          itemSize={3} 
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizeAttrib}
          itemSize={1}
          args={[sizeAttrib, 1]}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.3} // Base size (multiplied by the size attribute)
        color="white" 
        transparent
        opacity={0.7}
        map={snowTexture}
        alphaTest={0.05}
        sizeAttenuation
        depthWrite={false}
        vertexColors={false}
      />
    </points>
  );
};

export default SimpleSnow;