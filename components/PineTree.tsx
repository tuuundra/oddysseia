import { useGLTF } from '@react-three/drei';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTF } from 'three-stdlib';

type PineTreeProps = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

// Define our simple placeholder component
const PlaceholderTree = ({ position, rotation, scale }: PineTreeProps) => (
  <mesh scale={scale} position={position} rotation={rotation}>
    <coneGeometry args={[1, 3, 8]} />
    <meshStandardMaterial color="#006600" />
  </mesh>
);

const PineTree = ({
  position = [7, -1.1, -8],
  rotation = [0, 0, 0],
  scale = [8, 8, 8],
}: PineTreeProps) => {
  const [loadingStatus, setLoadingStatus] = useState<string>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Load the GLB model - using furtreelowres.glb
  const { scene } = useGLTF('/furtreelowres.glb');
  
  // Clone the scene to avoid reference issues
  const treeModel = scene?.clone();
  
  // Monitor loading state
  useEffect(() => {
    if (scene) {
      console.log('Tree model loaded successfully');
      setLoadingStatus('loaded');
    }
  }, [scene]);
  
  // Handle errors with window error event
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('furtreelowres.glb')) {
        console.error('Failed to load tree model:', event);
        setLoadingStatus('error');
        setErrorMessage(event.message);
      }
    };
    
    window.addEventListener('error', handleError);
    
    // Check if model loaded after a timeout
    const timer = setTimeout(() => {
      if (loadingStatus === 'loading' && !treeModel) {
        console.warn('Tree model loading timeout');
        setLoadingStatus('error');
        setErrorMessage('Loading timeout');
      }
    }, 5000);
    
    return () => {
      window.removeEventListener('error', handleError);
      clearTimeout(timer);
    };
  }, [loadingStatus, treeModel]);
  
  // Apply shadows and debug logging to the tree
  useEffect(() => {
    if (treeModel) {
      console.log('Applying settings to tree model');
      treeModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Make the tree more visible with emissive properties
          if (child.material) {
            const mat = child.material as THREE.MeshStandardMaterial;
            mat.emissive = new THREE.Color('#203020');
            mat.emissiveIntensity = 0.3;
            mat.needsUpdate = true;
            console.log('Enhanced material for mesh:', child.name);
          }
          
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    } else {
      console.warn('treeModel is null or undefined');
    }
  }, [treeModel]);
  
  // If model failed to load, show a placeholder
  if (loadingStatus === 'error') {
    console.error('Using placeholder tree due to loading error:', errorMessage);
    return <PlaceholderTree position={position} rotation={rotation} scale={scale} />;
  }
  
  return (
    <>
      {/* Loading indicator or placeholder while loading */}
      {loadingStatus === 'loading' && (
        <mesh scale={scale} position={position} rotation={rotation}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#aaaaaa" wireframe />
        </mesh>
      )}
      
      {/* The actual tree model */}
      {treeModel && loadingStatus === 'loaded' && (
        <primitive 
          object={treeModel} 
          position={position} 
          rotation={rotation} 
          scale={scale} 
        />
      )}
    </>
  );
};

// Preload the model to avoid loading delays
try {
  useGLTF.preload('/furtreelowres.glb');
  console.log('Preloading furtreelowres.glb');
} catch (error) {
  console.error('Error preloading tree model:', error);
}

export default PineTree; 