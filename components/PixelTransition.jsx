"use client";

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';

// Shader for pixel displacement transition
const fragmentShader = `
  uniform sampler2D tDiffuse1; // First texture (source)
  uniform sampler2D tDiffuse2; // Second texture (destination)
  uniform float progress; // 0.0 to 1.0 transition progress
  uniform float intensity; // Displacement intensity
  uniform vec2 resolution; // Screen resolution
  uniform sampler2D displacementMap; // Optional: noise texture for displacement
  uniform float pixelSize; // Size of pixel blocks
  varying vec2 vUv;

  vec4 getFromColor(vec2 uv) {
    return texture2D(tDiffuse1, uv);
  }

  vec4 getToColor(vec2 uv) {
    return texture2D(tDiffuse2, uv);
  }

  // Apply pixel block effect
  vec2 pixelate(vec2 uv, float size) {
    return floor(uv * size) / size;
  }

  void main() {
    // Add noise displacement
    vec2 displacement = texture2D(displacementMap, vUv * 2.0).rg;
    displacement = (displacement - 0.5) * 2.0;
    
    // Stronger displacement effect at mid-transition
    float dispIntensity = intensity * progress * (1.0 - progress) * 4.0;
    
    // Pixelate effect that increases with progress
    float pixelAmount = pixelSize * progress;
    vec2 pixelatedUV = pixelate(vUv, 100.0 + pixelAmount * 300.0);
    
    // Apply displacement to both textures
    vec2 distortedUV1 = pixelatedUV + displacement * dispIntensity * (1.0 - progress);
    vec2 distortedUV2 = pixelatedUV - displacement * dispIntensity * progress;
    
    // Get colors from both textures
    vec4 color1 = getFromColor(distortedUV1);
    vec4 color2 = getToColor(distortedUV2);
    
    // Calculate the mix based on progress
    float mixRatio = smoothstep(0.0, 1.0, progress);
    
    // Adding a color shift effect during transition
    if (progress > 0.0 && progress < 1.0) {
      float blend = abs(sin(progress * 3.14159));
      color1.r += blend * 0.2;
      color2.b += blend * 0.2;
    }
    
    // Mix the colors
    gl_FragColor = mix(color1, color2, mixRatio);
  }
`;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The pixel transition component
const PixelTransition = ({ 
  sourceFBO, 
  targetTexture, 
  progress = 0, 
  intensity = 0.5, 
  pixelSize = 10 
}) => {
  const { gl, scene, camera, size } = useThree();
  const mesh = useRef();
  const material = useRef();
  
  // Create a noise texture for the displacement effect
  const noiseTexture = useMemo(() => {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    
    for (let i = 0; i < size * size * 4; i += 4) {
      data[i] = Math.random() * 255;
      data[i + 1] = Math.random() * 255;
      data[i + 2] = Math.random() * 255;
      data[i + 3] = 255;
    }
    
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  }, []);
  
  // Update shader uniforms
  useEffect(() => {
    if (!material.current) {
      console.log("PixelTransition: Material ref not ready yet");
      return;
    }
    
    try {
      console.log(`PixelTransition: Updating uniforms - progress: ${progress}, has sourceFBO: ${!!sourceFBO}, has targetTexture: ${!!targetTexture}`);
      
      material.current.uniforms.resolution.value.set(size.width, size.height);
      material.current.uniforms.progress.value = progress;
      material.current.uniforms.intensity.value = intensity;
      material.current.uniforms.pixelSize.value = pixelSize;
      
      if (sourceFBO && sourceFBO.texture) {
        console.log("PixelTransition: Setting source texture");
        material.current.uniforms.tDiffuse1.value = sourceFBO.texture;
      } else {
        console.warn("PixelTransition: Source texture not available");
      }
      
      if (targetTexture) {
        console.log("PixelTransition: Setting target texture");
        material.current.uniforms.tDiffuse2.value = targetTexture;
      } else {
        console.warn("PixelTransition: Target texture not available");
      }
    } catch (error) {
      console.error("PixelTransition: Error updating shader uniforms:", error);
    }
  }, [sourceFBO, targetTexture, progress, intensity, pixelSize, size]);
  
  return (
    <mesh ref={mesh}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          tDiffuse1: { value: null },
          tDiffuse2: { value: null },
          progress: { value: progress },
          intensity: { value: intensity },
          resolution: { value: new THREE.Vector2(size.width, size.height) },
          displacementMap: { value: noiseTexture },
          pixelSize: { value: pixelSize }
        }}
      />
    </mesh>
  );
};

// Helper to capture the current scene as a texture
export const useSceneCapture = () => {
  const { gl, scene, camera } = useThree();
  const renderTarget = useFBO({ stencilBuffer: false });
  
  const captureScene = () => {
    try {
      console.log("useSceneCapture: Starting scene capture");
      
      // Force a render update before capture
      scene.updateMatrixWorld();
      if (camera.updateMatrixWorld) camera.updateMatrixWorld();
      
      const prevAutoUpdate = scene.autoUpdate;
      scene.autoUpdate = false;
      
      // Clear the render target first
      gl.setRenderTarget(renderTarget);
      gl.clear();
      
      // Render the scene to the target
      gl.render(scene, camera);
      gl.setRenderTarget(null);
      scene.autoUpdate = prevAutoUpdate;
      
      console.log("useSceneCapture: Scene captured successfully");
      return renderTarget;
    } catch (error) {
      console.error("useSceneCapture: Error capturing scene:", error);
      throw error;
    }
  };
  
  return { captureScene, renderTarget };
};

// Helper to load a video frame as a texture
export const useVideoFrameTexture = (videoElement) => {
  const texture = useMemo(() => new THREE.VideoTexture(videoElement), [videoElement]);
  
  useEffect(() => {
    if (videoElement) {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.format = THREE.RGBFormat;
      texture.needsUpdate = true;
    }
  }, [videoElement, texture]);
  
  return texture;
};

export default PixelTransition; 