"use client";

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, useTexture } from '@react-three/drei';
import { useSimpleScroll } from './SimpleScrollyControls';

export default function EnchantedCrystal() {
  const { offset } = useSimpleScroll();
  const { viewport, camera, gl, scene, size } = useThree();
  const groupRef = useRef();
  const meshRef = useRef();
  const timeRef = useRef(0);
  const crystalRef = useRef();
  
  // Only keep mouse position for rotation effect
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Setup mouse move listener (keep this for crystal rotation)
  useEffect(() => {
    const handleMouseMove = (event) => {
      // Convert mouse position to normalized coordinates (-1 to 1)
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      setMousePosition({ x, y });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  // Create refs for smooth movement
  const targetPositionRef = useRef(new THREE.Vector3(0, 6.0, 0));
  const targetRotationRef = useRef(new THREE.Euler(0, 0, 0));
  const targetScaleRef = useRef(20.8);
  
  // Load the crystal model
  const { scene: crystalScene } = useGLTF('/enchanted_crystal.glb');
  
  // Create render targets for environment map and backface rendering
  const backfaceRenderTarget = useMemo(() => {
    return new THREE.WebGLRenderTarget(
      size.width * 0.5, 
      size.height * 0.5, 
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        stencilBuffer: false
      }
    );
  }, [size]);
  
  // Create a simple environment cubemap for reflections
  const envMap = useMemo(() => {
    const envMapRenderer = new THREE.WebGLCubeRenderTarget(256);
    const envMapCamera = new THREE.CubeCamera(0.1, 1000, envMapRenderer);
    
    // Create a simple scene with gradient background for env map
    const envScene = new THREE.Scene();
    const envColor1 = new THREE.Color('#556677'); // Lighter blue-gray top color (closer to original)
    const envColor2 = new THREE.Color('#222233'); // Dark bottom color
    
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      varying vec3 vWorldPosition;
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      void main() {
        float h = normalize(vWorldPosition).y * 0.5 + 0.5;
        gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
      }
    `;
    
    const uniforms = {
      topColor: { value: envColor1 },
      bottomColor: { value: envColor2 }
    };
    
    const skyMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      side: THREE.BackSide
    });
    
    const sky = new THREE.Mesh(new THREE.SphereGeometry(100), skyMaterial);
    envScene.add(sky);
    
    // Add subtle lighting
    const light1 = new THREE.DirectionalLight(0xcccccc, 0.5);
    light1.position.set(1, 1, 1);
    envScene.add(light1);
    
    const light2 = new THREE.DirectionalLight(0x445566, 0.2);
    light2.position.set(-1, -1, -1);
    envScene.add(light2);
    
    // Add ambient light for base illumination
    const ambient = new THREE.AmbientLight(0x334455, 0.3);
    envScene.add(ambient);
    
    envScene.background = new THREE.Color('#444455');
    
    // Update the environment map once
    envMapCamera.position.set(0, 0, 0);
    envMapCamera.update(gl, envScene);
    
    return envMapRenderer.texture;
  }, [gl]);
  
  // Store camera and crystal positions to avoid buffer conflicts
  const cameraPositionRef = useRef(new THREE.Vector3());
  const crystalPositionRef = useRef(new THREE.Vector3());
  
  // Update positions safety in main render loop
  useFrame(({ camera }) => {
    // Safely update position references
    if (groupRef.current) {
      crystalPositionRef.current.setFromMatrixPosition(groupRef.current.matrixWorld);
    }
    cameraPositionRef.current.copy(camera.position);
  });
  
  // Handle rendering of backfaces for refraction
  useFrame(({ gl, scene, camera }) => {
    if (!crystalRef.current) return;
    
    // First render the backfaces for refraction
    if (crystalRef.current) {
      // Camera-related uniforms are built-in, no need to update them
      
      // First render scene to the backface render target to use for refraction
      const currentAutoClear = gl.autoClear;
      
      // Setup for first pass
      gl.autoClear = true;
      
      // Hide all crystal meshes
      let visibilityStates = [];
      crystalRef.current.traverse((node) => {
        if (node.isMesh) {
          visibilityStates.push({ node, visible: node.visible });
          node.visible = false;
        }
      });
      
      // Render the scene without crystal to backface texture
      gl.setRenderTarget(backfaceRenderTarget);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);
      
      // Restore crystal visibility
      visibilityStates.forEach(({ node, visible }) => {
        node.visible = visible;
      });
      
      // Restore autoClear
      gl.autoClear = currentAutoClear;
    }
  });
  
  // Handle crystal animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    
    const time = clock.getElapsedTime();
    
    // Lower the appear threshold to make the crystal appear sooner
    const appearThreshold = 0.10; // Changed from 0.1317
    
    // Calculate visibility and position based on scroll offset
    const visibility = Math.max(0, offset - appearThreshold);
    
    // Modify position calculation for earlier appearance and faster initial movement
    // Start at a higher position (-4.0 instead of -6.0) and use a higher multiplier (25.0 instead of 20.0)
    const baseYPosition = -5.0 + Math.max(0, (offset - appearThreshold) * 25.0); // Faster upward movement
    
    // Continuous rotation that never stops
    const rotationY = time * 0.2 + Math.max(0, offset - appearThreshold) * Math.PI * 4; // Time-based + scroll-based rotation
    
    // Floating animation remains
    const floatAmplitude = 0.1;
    const floatFrequency = 1.0;
    const floatY = Math.sin(time * floatFrequency) * floatAmplitude;

    // Mouse influence remains
    const mouseRotationX = mousePosition.y * 0.3 * 0.4;
    const mouseRotationY = -mousePosition.x * 0.3 * 1.5;

    // Update target values
    targetPositionRef.current.set(0, baseYPosition + floatY, 2);
    targetRotationRef.current.set(
      mouseRotationX, // Keep mouse influence on X rotation
      rotationY + mouseRotationY, // Combined auto-rotation and mouse influence
      0
    );

    // Continuous scaling - also affected by the appear threshold
    const startScale = 20.8;
    const endScale = 45.2;
    targetScaleRef.current = startScale + Math.max(0, (offset - appearThreshold)) * (endScale - startScale);

    // Increase the position lerp factor for faster response to scroll changes
    const positionLerpFactor = 0.08; // Changed from 0.05 for faster movement
    groupRef.current.position.lerp(targetPositionRef.current, positionLerpFactor);

    const currentRotation = groupRef.current.rotation;
    currentRotation.x += (targetRotationRef.current.x - currentRotation.x) * 0.05;
    
    const rotationLerpFactor = 0.05;
    const shortestAngle = ((((targetRotationRef.current.y - currentRotation.y) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    currentRotation.y += shortestAngle * rotationLerpFactor;
    
    const currentScale = groupRef.current.scale.x;
    const newScale = currentScale + (targetScaleRef.current - currentScale) * 0.08;
    groupRef.current.scale.set(newScale, newScale, newScale);
    
    groupRef.current.updateMatrixWorld();
  });
  
  return (
    <group ref={groupRef} position={[0, -4.0, 2]} renderOrder={1000}>
      <primitive object={crystalRef.current || crystalScene} />
      
      {/* Add a point light inside the crystal for glow effect */}
      <pointLight 
        color="#222233" 
        intensity={0.4} 
        distance={1.8} 
        decay={2.8} 
      />
      
      {/* Add a subtle ambient light to illuminate the texture */}
      <ambientLight color="#334455" intensity={0.15} />
    </group>
  );
}

// Preload the model
useGLTF.preload('/enchanted_crystal.glb'); 