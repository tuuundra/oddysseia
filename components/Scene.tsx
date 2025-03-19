import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls, useTexture, PerspectiveCamera, Environment, Float, Text, useGLTF } from '@react-three/drei';
import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import SimpleSnow from './SimpleSnow';
import FracturedRock from './FracturedRock';
import FracturedRealRock from './FracturedRealRock';
import SimpleRock from './SimpleRock';
import FracturedSimpleRock from './FracturedSimpleRock';
import FracturedGLBRock from './FracturedGLBRock';
import PineTree from './PineTree';
import { FBXLoader } from 'three-stdlib';


// Custom shader for the fluid effect
const fluidShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#00ffcc') },
    uNoiseFreq: { value: 1.5 },
    uNoiseAmp: { value: 0.4 },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uNoiseFreq;
    uniform float uNoiseAmp;
    
    varying vec2 vUv;
    varying float vDisplacement;
    
    // Simplex 3D Noise
    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      
      // First corner
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      
      // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      
      // Permutations
      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
              
      // Gradients
      float n_ = 1.0/7.0;
      vec3 ns = n_ * D.wyz - D.xzx;
      
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      
      // Normalise gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      
      // Mix final noise value
      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }
    
    void main() {
      vUv = uv;
      
      // Calculate displacement
      float noise = snoise(vec3(position.x * uNoiseFreq, position.y * uNoiseFreq, uTime * 0.1));
      vDisplacement = noise * uNoiseAmp;
      
      // Apply displacement to vertex
      vec3 newPosition = position + normal * vDisplacement;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uTime;
    
    varying vec2 vUv;
    varying float vDisplacement;
    
    void main() {
      // Create a gradient based on displacement and position
      float intensity = vDisplacement * 2.0 + 0.4;
      vec3 color = mix(uColor, vec3(1.0), vDisplacement * 0.5 + sin(vUv.x * 10.0 + uTime) * 0.1);
      
      // Add glow effect
      float glow = sin(uTime * 0.5) * 0.1 + 0.3;
      color += glow;
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

// Background shader for a subtle animated gradient
const backgroundShader = {
  uniforms: {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color('#050505') },
    uColorB: { value: new THREE.Color('#101020') },
  },
  vertexShader: `
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    
    varying vec2 vUv;
    
    void main() {
      vec2 center = vec2(0.5, 0.5);
      float dist = distance(vUv, center);
      
      // Create a subtle pulsing effect
      float pulse = sin(uTime * 0.2) * 0.05 + 0.95;
      dist *= pulse;
      
      // Create a smooth gradient from center
      vec3 color = mix(uColorB, uColorA, smoothstep(0.0, 0.8, dist));
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

const BackgroundPlane = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });
  
  return (
    <mesh position={[0, 0, -10]}>
      <planeGeometry args={[100, 100]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={backgroundShader.vertexShader}
        fragmentShader={backgroundShader.fragmentShader}
        uniforms={backgroundShader.uniforms}
      />
    </mesh>
  );
};

const FluidObject = () => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });
  
  useEffect(() => {
    if (meshRef.current) {
      // Initial animation
      gsap.from(meshRef.current.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 2,
        ease: 'elastic.out(1, 0.3)'
      });
    }
  }, []);

  return (
    <Float
      speed={3} // Animation speed
      rotationIntensity={0.5} // Rotation intensity
      floatIntensity={0.5} // Float intensity
    >
      <mesh ref={meshRef} scale={1.5}>
        <torusKnotGeometry args={[1, 0.4, 128, 32]} />
        <shaderMaterial 
          ref={materialRef}
          vertexShader={fluidShader.vertexShader}
          fragmentShader={fluidShader.fragmentShader}
          uniforms={fluidShader.uniforms}
          wireframe={false}
          transparent={true}
        />
      </mesh>
    </Float>
  );
};

const FloatingParticles = () => {
  const count = 100; // Increased particle count
  const particleRefs = useRef<THREE.Mesh[]>([]);
  
  useEffect(() => {
    particleRefs.current.forEach((particle, i) => {
      const delay = i * 0.01;
      
      gsap.from(particle.scale, {
        x: 0,
        y: 0,
        z: 0,
        delay,
        duration: 1.5,
        ease: 'elastic.out(1, 0.3)'
      });
      
      gsap.from(particle.position, {
        y: -5,
        delay: delay + 0.2,
        duration: 2,
        ease: 'power3.out'
      });
    });
  }, []);
  
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const x = (Math.random() - 0.5) * 15;
        const y = (Math.random() - 0.5) * 15;
        const z = (Math.random() - 0.5) * 15;
        const scale = Math.random() * 0.1 + 0.05;
        
        return (
          <mesh 
            key={i}
            position={[x, y, z]}
            ref={(el) => { 
              if (el) particleRefs.current[i] = el;
            }}
          >
            <sphereGeometry args={[scale, 8, 8]} />
            <meshStandardMaterial 
              color="#00ffcc"
              emissive="#00ffcc"
              emissiveIntensity={1}
              transparent={true}
              opacity={0.7}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// Shaders for the terrain
const terrainShader = {
  uniforms: {
    uTime: { value: 0 },
    uElevation: { value: 3.5 }, // Increased elevation for higher mountains
    uNoiseFreq: { value: 0.08 }, // Lower frequency for broader mountains
    uNoiseAmp: { value: 1.5 }, // Increased amplitude for more dramatic terrain
    fogColor: { value: new THREE.Color('#b8c6db') },
    fogNear: { value: 10 },
    fogFar: { value: 30 },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uElevation;
    uniform float uNoiseFreq;
    uniform float uNoiseAmp;
    
    varying float vElevation;
    varying vec2 vUv;
    varying vec3 vNormal;
    
    // Simplex 3D Noise
    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      
      // First corner
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      
      // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      
      // Permutations
      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
              
      // Gradients
      float n_ = 1.0/7.0;
      vec3 ns = n_ * D.wyz - D.xzx;
      
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      
      // Normalise gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      
      // Mix final noise value
      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }
    
    void main() {
      vUv = uv;
      
      // Base terrain noise
      float elevation = snoise(vec3(position.x * uNoiseFreq, position.z * uNoiseFreq, 0.0)) * uNoiseAmp;
      
      // Add detail to terrain with different frequencies
      elevation += snoise(vec3(position.x * uNoiseFreq * 2.0, position.z * uNoiseFreq * 2.0, 0.0)) * uNoiseAmp * 0.5;
      elevation += snoise(vec3(position.x * uNoiseFreq * 4.0, position.z * uNoiseFreq * 4.0, 0.0)) * uNoiseAmp * 0.25;
      
      // Make terrain more mountain-like with steeper peaks
      elevation = pow(elevation * 0.5 + 0.5, 3.0) * uElevation;
      
      // Create plateaus for snow accumulation
      float flattenFactor = 0.4;
      if (elevation > uElevation * 0.7) {
        elevation = mix(elevation, uElevation * 0.85, flattenFactor);
      }
      
      // Apply elevation to Y position
      vec3 newPosition = position;
      newPosition.y += elevation;
      
      // Save elevation for fragment shader
      vElevation = elevation;
      
      // Calculate normals for lighting
      vec3 transformedNormal = normalize(normalMatrix * normal);
      vNormal = transformedNormal;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform float uTime;
    uniform float uElevation;
    
    varying float vElevation;
    varying vec2 vUv;
    varying vec3 vNormal;
    
    void main() {
      // Calculate base color based on height
      vec3 snowColor = vec3(0.98, 0.98, 0.98); // Pure white snow
      vec3 rockColor = vec3(0.6, 0.6, 0.65); // Gray for rock
      vec3 baseColor = mix(
        rockColor,
        snowColor,
        smoothstep(uElevation * 0.3, uElevation * 0.5, vElevation) // Snow line
      );
      
      // Add some variation based on normals (shadowing)
      float lightIntensity = dot(vNormal, normalize(vec3(0.5, 1.0, 0.8)));
      baseColor = mix(baseColor * 0.7, baseColor, smoothstep(0.0, 1.0, lightIntensity));
      
      // Apply subtle noise pattern for snow texture
      float snowNoise = sin(vUv.x * 100.0) * sin(vUv.y * 100.0) * 0.03;
      baseColor += snowNoise;
      
      // Apply fog
      float depth = gl_FragCoord.z / gl_FragCoord.w;
      float fogFactor = smoothstep(fogNear, fogFar, depth);
      vec3 color = mix(baseColor, fogColor, fogFactor);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

// Snow shader
const snowShader = {
  uniforms: {
    uTime: { value: 0 },
    uSize: { value: 0.2 },
    uSpeed: { value: 0.5 },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uSize;
    uniform float uSpeed;
    
    attribute float size;
    attribute float speed;
    attribute float offset;
    
    varying vec3 vColor;
    varying float vAlpha;
    
    void main() {
      // Create motion with different speeds for each particle
      vec3 pos = position;
      
      // Snow falling with wind effect
      float time = uTime * speed * uSpeed;
      pos.y = mod(pos.y - time, 30.0) - 10.0;
      
      // Add some wind motion - more realistic swaying
      pos.x += sin(time * 0.1 + offset) * 1.0;
      pos.z += cos(time * 0.15 + offset) * 1.0;
      
      // Add subtle spin to some flakes
      pos.x += sin(time * 0.5 + offset * 10.0) * 0.1;
      pos.z += cos(time * 0.5 + offset * 10.0) * 0.1;
      
      // Calculate view distance for size and alpha adjustments
      vec4 modelViewPosition = modelViewMatrix * vec4(pos, 1.0);
      float dist = length(modelViewPosition.xyz);
      
      // Adjust alpha based on distance - closer particles are more visible
      vAlpha = smoothstep(60.0, 10.0, dist) * 0.8 + 0.2;
      
      // Color variation with subtle blue tint and sparkle
      float brightness = 0.95 + sin(offset) * 0.05;
      vColor = vec3(brightness, brightness + 0.02, brightness + 0.05);
      
      // Adjust size based on distance - closer particles appear larger
      float sizeAdjust = mix(1.0, 2.0, smoothstep(30.0, 5.0, dist));
      gl_PointSize = size * uSize * sizeAdjust * (100.0 / -modelViewPosition.z);
      
      gl_Position = projectionMatrix * modelViewPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vAlpha;
    
    void main() {
      // Create realistic snowflake particles with soft edges
      float r = distance(gl_PointCoord, vec2(0.5));
      if (r > 0.5) discard;
      
      // Soften edges and add internal texture
      float center = smoothstep(0.5, 0.1, r);
      float alpha = (0.5 * center + 0.5) * vAlpha;
      
      // Add sparkle effect
      float sparkle = center * center * 0.9;
      vec3 finalColor = vColor * (1.0 + sparkle * 0.2);
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
};

// GLTF Mountain Landscape component
const MountainLandscape = () => {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene } = useGLTF('/models/mountains/mountanous_landscape.gltf');
  
  useEffect(() => {
    if (scene) {
      // Make sure materials and textures are properly set up
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Enable shadows
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Make sure materials look good
          if (child.material) {
            child.material.roughness = 0.8;
            child.material.metalness = 0.1;
          }
        }
      });
    }
  }, [scene]);
  
  return (
    <primitive 
      ref={groupRef} 
      object={scene} 
      scale={[0.2, 0.2, 0.2]} 
      position={[0, -6, 0]} 
      rotation={[0, Math.PI / 6, 0]} 
    />
  );
};

// Snow particles
const Snow = () => {
  const { camera } = useThree();
  const ref = useRef<THREE.Points>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  
  // Generate snow particles
  const particleCount = 5000; // Increased particle count for more snow
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const speeds = new Float32Array(particleCount);
  const offsets = new Float32Array(particleCount);
  
  useEffect(() => {
    // Initialize particles in a reasonable area around the camera's view
    for (let i = 0; i < particleCount; i++) {
      // Position particles in a large area, but concentrated more where the camera is looking
      // Based on camera position at (32.19, -1.37, -31.22) looking toward (0, 0, 0)
      positions[i * 3] = (Math.random() - 0.5) * 80 + 15; // x - shifted toward camera x position
      positions[i * 3 + 1] = Math.random() * 30 - 5; // y - higher up for longer falling effect
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 15; // z - shifted toward camera z position
      
      // Size variation - some larger flakes
      sizes[i] = Math.random() * 1.0 + 0.2;
      
      // Speed variation - slower descent for a gentle snowfall
      speeds[i] = Math.random() * 0.5 + 0.2;
      
      // Random offset for variation
      offsets[i] = Math.random() * Math.PI * 2;
    }
  }, []);
  
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime() * 0.5; // Slowed down for gentler effect
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={particleCount}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          array={sizes}
          count={particleCount}
          itemSize={1}
          args={[sizes, 1]}
        />
        <bufferAttribute
          attach="attributes-speed"
          array={speeds}
          count={particleCount}
          itemSize={1}
          args={[speeds, 1]}
        />
        <bufferAttribute
          attach="attributes-offset"
          array={offsets}
          count={particleCount}
          itemSize={1}
          args={[offsets, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
          uSize: { value: 0.3 }, // Increased size for better visibility
          uSpeed: { value: 0.3 }, // Decreased speed for softer fall
        }}
        vertexShader={snowShader.vertexShader}
        fragmentShader={snowShader.fragmentShader}
        transparent={true}
        depthWrite={false}
      />
    </points>
  );
};

// Igloo component with more detail
const Igloo = () => {
  const groupRef = useRef<THREE.Group>(null!);
  
  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Main dome */}
      <mesh position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[1.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e0e0e8" roughness={0.9} metalness={0.1} />
      </mesh>
      
      {/* Entrance */}
      <mesh position={[0, -0.5, 1.5]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 1, 16, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color="#d0d0d8" roughness={0.9} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Entrance top */}
      <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.7, 0.2, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#c8c8d0" roughness={0.9} metalness={0.1} />
      </mesh>
      
      {/* Snow blocks - row by row construction */}
      {Array.from({ length: 5 }).map((_, row) => (
        Array.from({ length: Math.floor(20 - row * 3) }).map((_, i) => {
          const blockCount = Math.floor(20 - row * 3);
          const angle = (i / blockCount) * Math.PI * 2;
          const radius = 1.5 - row * 0.2;
          const height = 0.2 + Math.sin(i * 5) * 0.02;
          const width = 0.4 + Math.cos(i * 3) * 0.02;
          
          return (
            <mesh 
              key={`${row}-${i}`} 
              position={[
                Math.cos(angle) * radius,
                -0.7 + row * 0.25 + Math.sin(i * 8) * 0.02,
                Math.sin(angle) * radius
              ]}
              rotation={[0, angle, 0]}
              castShadow
            >
              <boxGeometry args={[width, height, 0.3]} />
              <meshStandardMaterial color="#f0f0f8" roughness={0.8} metalness={0.1} />
            </mesh>
          );
        })
      ))}
      
      {/* Igloo floor */}
      <mesh position={[0, -0.99, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshStandardMaterial color="#e8e8f0" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
};

// Camera with more dramatic floating motion
const FloatingCamera = () => {
  const { camera } = useThree();
  
  // Store the initial camera position for reference
  const initialPosition = useRef(new THREE.Vector3());
  
  useEffect(() => {
    // Set initial camera position
    camera.position.set(32.19, -1.37, -31.22);
    initialPosition.current.copy(camera.position);
  }, [camera]);
  
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    // Much faster and more dramatic camera movement
    const xMovement = Math.sin(time * 0.8) * 0.15;   // Fast side-to-side
    const yMovement = Math.sin(time * 0.7) * 0.12;   // Fast up-down
    const zMovement = Math.cos(time * 0.5) * 0.13;   // Fast forward-back
    
    // Apply the movement relative to the initial position
    camera.position.x = initialPosition.current.x + xMovement;
    camera.position.y = initialPosition.current.y + yMovement;
    camera.position.z = initialPosition.current.z + zMovement;
    
    // More dramatic rotation movement
    const lookXOffset = Math.sin(time * 0.5) * 0.5;   // Wider angle shifts
    const lookYOffset = Math.cos(time * 0.6) * 0.4;   // Wider angle shifts
    
    // Create a look target with more dramatic motion
    const lookTarget = new THREE.Vector3(
      lookXOffset,
      lookYOffset,
      0
    );
    
    camera.lookAt(lookTarget);
  });
  
  return null;
};

// Environment fog
const Fog = () => {
  useEffect(() => {
    // Create an evening fog effect
    const scene = document.querySelector('canvas')?.parentElement;
    if (scene) {
      scene.style.background = 'linear-gradient(to bottom, #111830 0%, #2a3045 100%)';
    }
  }, []);
  
  return null;
};

// Debug component for orbit controls
const OrbitDebugger = () => {
  const { camera } = useThree();
  
  return (
    <OrbitControls 
      enableDamping={true}
      dampingFactor={0.05}
      onChange={() => {
        // Log camera position whenever it changes
        console.log('Camera position:', {
          x: camera.position.x.toFixed(2),
          y: camera.position.y.toFixed(2),
          z: camera.position.z.toFixed(2)
        });
      }}
    />
  );
};

// Preload GLTF model
useGLTF.preload('/models/mountains/mountanous_landscape.gltf');

// Import the rock fragments assembler logic
const RockFragmentModel = ({
  id,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [0.1, 0.1, 0.1]
}: {
  id: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  
  // Generate a unique seed for this fragment for varied animation
  const seed = useMemo(() => Math.random() * 1000, []);
  
  // Load the FBX model
  useEffect(() => {
    const loader = new FBXLoader();
    const url = `/fracturedrockfragments/Game/BlankDefault/${id}.FBX`;
    
    loader.load(
      url,
      (fbx) => {
        fbx.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: '#616161',
              roughness: 0.8,
              metalness: 0.2,
              // Green moss-like color map
              emissive: "#193319",
              emissiveIntensity: 0.05
            });
            
            // Enable shadows
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        setModel(fbx);
      },
      (xhr) => {
        console.log(`Loading ${id}: ${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (error) => {
        console.error('Error loading FBX:', error);
      }
    );
  }, [id]);
  
  // Animate the fragment with a very subtle float
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime() + seed;
      
      // Almost imperceptible movement - just enough to hint at not being solid
      const floatSpeed = 0.1 + (seed % 0.1);
      const floatAmplitude = 0.0015 + (seed % 0.001); // 10x smaller animation
      
      meshRef.current.position.x = position[0] + Math.sin(t * floatSpeed) * floatAmplitude;
      meshRef.current.position.y = position[1] + Math.cos(t * floatSpeed * 0.8) * floatAmplitude;
      meshRef.current.position.z = position[2] + Math.sin(t * floatSpeed * 0.6 + 0.3) * floatAmplitude;
      
      // Extremely subtle rotation - barely visible
      const rotSpeed = 0.05 + (seed % 0.05);
      meshRef.current.rotation.x = rotation[0] + Math.sin(t * rotSpeed) * 0.001;
      meshRef.current.rotation.y = rotation[1] + Math.cos(t * rotSpeed * 0.7) * 0.001;
      meshRef.current.rotation.z = rotation[2] + Math.sin(t * rotSpeed * 0.5) * 0.001;
    }
  });
  
  // If no model is loaded yet, return null
  if (!model) return null;
  
  return (
    <group 
      ref={meshRef}
      position={position as any}
      rotation={rotation as any}
      scale={scale as any}
    >
      <primitive object={model} />
    </group>
  );
};

// Generate all rock fragments with positions in a cohesive boulder formation
const generateRockFragments = () => {
  // Get all available fragment IDs from the directory listing
  const fragmentFiles = [
    "NewGeometryCollection_SM_140_", "NewGeometryCollection_SM_156_", "NewGeometryCollection_SM_204_",
    "NewGeometryCollection_SM_228_", "NewGeometryCollection_SM_269_", "NewGeometryCollection_SM_286_",
    "NewGeometryCollection_SM_290_", "NewGeometryCollection_SM_382_", "NewGeometryCollection_SM_183_",
    "NewGeometryCollection_SM_195_", "NewGeometryCollection_SM_245_", "NewGeometryCollection_SM_253_",
    "NewGeometryCollection_SM_300_", "NewGeometryCollection_SM_316_", "NewGeometryCollection_SM_341_",
    "NewGeometryCollection_SM_212_", "NewGeometryCollection_SM_357_", "NewGeometryCollection_SM_224_",
    "NewGeometryCollection_SM_232_", "NewGeometryCollection_SM_265_", "NewGeometryCollection_SM_320_",
    "NewGeometryCollection_SM_336_", "NewGeometryCollection_SM_361_", "NewGeometryCollection_SM_377_",
    "NewGeometryCollection_SM_121_", "NewGeometryCollection_SM_137_", "NewGeometryCollection_SM_160_",
    "NewGeometryCollection_SM_176_", "NewGeometryCollection_SM_199_", "NewGeometryCollection_SM_208_",
    "NewGeometryCollection_SM_249_", "NewGeometryCollection_SM_273_", "NewGeometryCollection_SM_136_",
    "NewGeometryCollection_SM_161_", "NewGeometryCollection_SM_177_", "NewGeometryCollection_SM_198_",
    "NewGeometryCollection_SM_209_", "NewGeometryCollection_SM_248_", "NewGeometryCollection_SM_337_",
    "NewGeometryCollection_SM_225_", "NewGeometryCollection_SM_233_", "NewGeometryCollection_SM_272_",
    "NewGeometryCollection_SM_360_", "NewGeometryCollection_SM_376_", "NewGeometryCollection_SM_182_",
    "NewGeometryCollection_SM_194_", "NewGeometryCollection_SM_213_", "NewGeometryCollection_SM_244_",
    "NewGeometryCollection_SM_264_", "NewGeometryCollection_SM_301_", "NewGeometryCollection_SM_321_",
    "NewGeometryCollection_SM_356_", "NewGeometryCollection_SM_157_", "NewGeometryCollection_SM_205_",
    "NewGeometryCollection_SM_229_", "NewGeometryCollection_SM_252_", "NewGeometryCollection_SM_291_",
    "NewGeometryCollection_SM_317_", "NewGeometryCollection_SM_340_", "NewGeometryCollection_SM_141_",
    "NewGeometryCollection_SM_234_", "NewGeometryCollection_SM_263_", "NewGeometryCollection_SM_268_",
    "NewGeometryCollection_SM_287_", "NewGeometryCollection_SM_326_", "NewGeometryCollection_SM_371_",
    "NewGeometryCollection_SM_383_", "NewGeometryCollection_SM_127_", "NewGeometryCollection_SM_170_",
    "NewGeometryCollection_SM_189_", "NewGeometryCollection_SM_222_", "NewGeometryCollection_SM_259_",
    "NewGeometryCollection_SM_275_", "NewGeometryCollection_SM_330_", "NewGeometryCollection_SM_367_",
    "NewGeometryCollection_SM_131_", "NewGeometryCollection_SM_146_", "NewGeometryCollection_SM_166_",
    "NewGeometryCollection_SM_218_", "NewGeometryCollection_SM_238_", "NewGeometryCollection_SM_280_",
    "NewGeometryCollection_SM_384_", "NewGeometryCollection_SM_150_", "NewGeometryCollection_SM_202_",
    "NewGeometryCollection_SM_255_", "NewGeometryCollection_SM_279_", "NewGeometryCollection_SM_296_",
    "NewGeometryCollection_SM_347_", "NewGeometryCollection_SM_185_", "NewGeometryCollection_SM_193_",
    "NewGeometryCollection_SM_214_", "NewGeometryCollection_SM_243_", "NewGeometryCollection_SM_306_",
    "NewGeometryCollection_SM_310_", "NewGeometryCollection_SM_351_", "NewGeometryCollection_SM_184_",
    "NewGeometryCollection_SM_192_", "NewGeometryCollection_SM_215_", "NewGeometryCollection_SM_242_",
    "NewGeometryCollection_SM_254_"
  ];
  
  const fragments = [];
  const totalFragments = fragmentFiles.length;
  
  // Set the center position for our rock
  const center = [20, 1, -20];
  const scale = [0.07, 0.07, 0.07] as [number, number, number]; // Smaller scale for tighter fit
  
  // Very small offset to create tiny gaps between fragments
  const gapSize = 0.002;
  
  // Function to generate a 3D position on the surface of a boulder
  const getBoulderPoint = (theta: number, phi: number, radius: number, index: number) => {
    // Convert spherical coordinates to cartesian
    const x = center[0] + radius * Math.sin(phi) * Math.cos(theta);
    const y = center[1] + radius * Math.sin(phi) * Math.sin(theta);
    const z = center[2] + radius * Math.cos(phi);
    
    // Apply a slight distortion to make the shape more rock-like and less perfectly spherical
    const noise = Math.sin(theta * 5 + phi * 3) * 0.05 +   // Surface variation
                 Math.cos(theta * 7 - phi * 2) * 0.03 +    // More subtle variation
                 (index % 3 === 0 ? 0.03 : 0);             // Occasional bumps
    
    return {
      position: [x + noise, y + noise * 0.8, z + noise] as [number, number, number],
      // Rotation should follow the surface normal for tight fit
      rotation: [
        phi + Math.PI/2 + (Math.random() - 0.5) * 0.1,  // Align with surface + small random
        theta + (Math.random() - 0.5) * 0.1,            // Align with surface + small random
        Math.random() * Math.PI * 2                     // Random rotation around normal
      ] as [number, number, number]
    };
  };
  
  // Distribute fragments evenly across the boulder
  for (let i = 0; i < totalFragments; i++) {
    // Use fibonacci sphere distribution for even spacing
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const theta = 2 * Math.PI * i / goldenRatio;
    const phi = Math.acos(1 - 2 * (i + 0.5) / totalFragments);
    
    // Base radius and scale - larger pieces in middle of the boulder
    const normalizedIndex = i / totalFragments;
    let radius = 0.9;
    
    // Adjust radius slightly to create a more non-uniform boulder shape
    if (normalizedIndex < 0.3) {
      // Bottom pieces slightly compressed
      radius *= 0.9;
    } else if (normalizedIndex > 0.7) {
      // Top pieces slightly extended
      radius *= 1.1;
    }
    
    // Get the position and rotation
    const { position, rotation } = getBoulderPoint(theta, phi, radius, i);
    
    // Add slight gap between fragments (very small random offset)
    const gapOffset = [
      (Math.random() - 0.5) * gapSize,
      (Math.random() - 0.5) * gapSize,
      (Math.random() - 0.5) * gapSize
    ] as [number, number, number];
    
    fragments.push({
      id: fragmentFiles[i],
      position: [
        position[0] + gapOffset[0],
        position[1] + gapOffset[1],
        position[2] + gapOffset[2]
      ] as [number, number, number],
      rotation: rotation,
      scale: scale
    });
  }
  
  return fragments;
};

// Generate all rock fragments
const rockFragments = generateRockFragments();

function Scene() {
  return (
    <div style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      margin: 0, 
      padding: 0,
      zIndex: 0,
      pointerEvents: 'auto'
    }}>
      <Canvas
        style={{ 
          display: 'block', 
          width: '100%', 
          height: '100%',
          position: 'relative',
          zIndex: 0
        }}
        camera={{ position: [32.19, -1.37, -31.22], fov: 45 }}
        dpr={[1, 2]}
        gl={{ 
          antialias: true,
          alpha: true,
          stencil: false,
          depth: true,
          powerPreference: 'high-performance'
        }}
        shadows
      >
        <color attach="background" args={['#1a2435']} />
        <fog attach="fog" args={['#1a2435', 10, 30]} />
        
        {/* Main scene content - reduced intensity for evening */}
        <ambientLight intensity={0.2} color="#3a4a6a" />
        <directionalLight 
          intensity={1.0} 
          position={[15, 20, 10]} 
          color="#8090c0" 
          castShadow 
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <directionalLight intensity={0.2} position={[-10, -5, 5]} color="#4a5a8a" />
        
        {/* Add a spotlight to highlight the rock - warmer color for evening light */}
        <spotLight
          position={[15, 10, -5]}
          angle={0.3}
          penumbra={0.8}
          intensity={0.8}
          color="#d0a070"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        
        {/* Use FloatingCamera instead of OrbitDebugger */}
        <FloatingCamera />
        {/* Comment out the orbit debugger */}
        {/* <OrbitDebugger /> */}
        
        {/* Mountain landscape from GLTF */}
        <MountainLandscape />
        
        {/* Igloo structure positioned on the mountain */}
        <group position={[0, 1, 0]}>
          <Igloo />
        </group>
        
        {/* Floating fractured rock model */}
        <group position={[23, 0, -22]} scale={[8, 8, 8]} rotation={[1, Math.PI / 3, 0.03]}>
          {/* Evening lighting for the rock */}
          <spotLight
            position={[3, 5, 3]}
            angle={0.6}
            penumbra={0.7}
            intensity={1.5}
            color="#e08060"
            castShadow
            distance={30}
          />
          <spotLight
            position={[-2, -3, 5]}
            angle={0.7}
            penumbra={0.8}
            intensity={0.8}
            color="#6070b0"
            castShadow={false}
            distance={25}
          />
          
          {/* Center light source radiating through cracks */}
          <pointLight 
            position={[0, 0.25, 0.15]} 
            intensity={20} 
            color="#c8ecec" 
            distance={100.5}
            decay={0.2}
          />
          
          <FracturedGLBRock />
        </group>
        
        {/* Pine Tree to the right of the floating rock - close to camera for visibility */}
        <group position={[27, -3, -19]} rotation={[0, Math.PI / 5, 0]}>
         
          
          {/* Try different scale */}
          <PineTree scale={[2, 2, 2]} />
          
          {/* Add spotlight to illuminate the tree */}
          <spotLight
            position={[0, 8, 0]}
            angle={0.6}
            penumbra={0.8}
            intensity={2.0}
            color="#c0d0ff"
            castShadow
            distance={20}
          />
        </group>
        
        {/* Pine Tree */}
        <PineTree 
          position={[7, -1.1, -8]} 
          scale={[8, 8, 8]} 
          rotation={[0, 0, 0]} 
        />
        
        {/* Second Pine Tree - positioned right next to the first one */}
        <PineTree 
          position={[15, -1.5, -10]} 
          scale={[7, 7.5, 7]} 
          rotation={[0, Math.PI / 6, 0]} 
        />
        
        {/* Environment map for better PBR materials */}
        <Environment preset="night" background={false} />
        
        {/* Snow effects */}
        <SimpleSnow />
        
        {/* Environment settings */}
        <Fog />
    </Canvas>
    </div>
  );
}

export default Scene;