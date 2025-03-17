import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls, useTexture, PerspectiveCamera, Environment, Float, Text, useGLTF } from '@react-three/drei';
import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

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
    
    void main() {
      // Create motion with different speeds for each particle
      vec3 pos = position;
      
      // Snow falling with wind effect
      float time = uTime * speed * uSpeed;
      pos.y = mod(pos.y - time, 20.0) - 10.0;
      
      // Add some wind motion
      pos.x += sin(time * 0.1 + offset) * 0.5;
      pos.z += cos(time * 0.15 + offset) * 0.5;
      
      // Add variation to snow color
      vColor = vec3(0.95 + sin(offset) * 0.05);
      
      // Perspective point size
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = size * uSize * (100.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    
    void main() {
      // Create circular snow particles
      float r = distance(gl_PointCoord, vec2(0.5));
      if (r > 0.5) discard;
      
      // Soften edges
      float opacity = 1.0 - smoothstep(0.3, 0.5, r);
      
      gl_FragColor = vec4(vColor, opacity);
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
      position={[0, -3, 0]} 
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
  const particleCount = 2000;
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const speeds = new Float32Array(particleCount);
  const offsets = new Float32Array(particleCount);
  
  useEffect(() => {
    // Initialize particles in a reasonable area around the camera
    for (let i = 0; i < particleCount; i++) {
      // Position
      positions[i * 3] = (Math.random() - 0.5) * 40; // x
      positions[i * 3 + 1] = Math.random() * 20 - 5; // y - higher up for more visible snow
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40; // z
      
      // Size variation
      sizes[i] = Math.random() * 0.8 + 0.2;
      
      // Speed variation
      speeds[i] = Math.random() * 0.8 + 0.2;
      
      // Random offset for variation
      offsets[i] = Math.random() * Math.PI * 2;
    }
  }, []);
  
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
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
        uniforms={snowShader.uniforms}
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

// Custom camera with gentle floating animation
const FloatingCamera = () => {
  const { camera } = useThree();
  const cameraRef = useRef(camera);
  
  // Set initial camera position
  useEffect(() => {
    // Adjust these values to change camera position
    camera.position.set(20, 8, 15); // Position camera at a different angle
    camera.lookAt(0, 0, 0); // Look at the center where the igloo is
  }, [camera]);
  
  // Gentle floating animation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Very subtle floating motion
    camera.position.y = 8 + Math.sin(t * 0.2) * 0.15;
    camera.position.x = 12 + Math.sin(t * 0.15) * 0.1;
    camera.position.z = 15 + Math.cos(t * 0.1) * 0.1;
    
    // Always look at the igloo
    camera.lookAt(0, 0, 0);
  });
  
  return null;
};

// Environment fog
const Fog = () => {
  useEffect(() => {
    // Create a subtle fog effect
    const scene = document.querySelector('canvas')?.parentElement;
    if (scene) {
      scene.style.background = 'linear-gradient(to bottom, #b4c5e4 0%, #d6e0f0 100%)';
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
        camera={{ position: [12, 8, 15], fov: 45 }}
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
        <color attach="background" args={['#b8c6db']} />
        <fog attach="fog" args={['#b8c6db', 15, 50]} />
        
        {/* Main scene content */}
        <ambientLight intensity={0.6} />
        <directionalLight 
          intensity={1.5} 
          position={[15, 20, 10]} 
          color="#f0f0ff" 
          castShadow 
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <directionalLight intensity={0.3} position={[-10, -5, 5]} color="#e0e0ff" />
        
        {/* Debug orbit controls */}
        <OrbitDebugger />
        
        {/* Comment out the FloatingCamera while testing with OrbitControls */}
        {/* <FloatingCamera /> */}
        
        {/* Mountain landscape from GLTF */}
        <MountainLandscape />
        
        {/* Igloo structure positioned on the mountain */}
        <group position={[0, 1, 0]}>
          <Igloo />
        </group>
        
        {/* Snow particles */}
        <Snow />
        
        {/* Environment settings */}
        <Fog />
    </Canvas>
    </div>
  );
}

export default Scene;