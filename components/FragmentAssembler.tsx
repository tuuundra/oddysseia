import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { FBXLoader } from 'three-stdlib';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';
import { OrbitControls, TransformControls, Html } from '@react-three/drei';

// Interface for fragment position data
interface FragmentPosition {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  loaded: boolean;
}

// Single fragment component with transform controls
const Fragment = ({ 
  id, 
  url, 
  position, 
  rotation, 
  scale, 
  onPositionChange,
  selected,
  onSelect,
  transformMode
}: { 
  id: string;
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  onPositionChange: (id: string, position: [number, number, number], rotation: [number, number, number], scale: [number, number, number]) => void;
  selected: boolean;
  onSelect: () => void;
  transformMode: 'translate' | 'rotate' | 'scale';
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [hovered, setHovered] = useState(false);
  
  // Load FBX model
  useEffect(() => {
    const loader = new FBXLoader();
    loader.load(
      url,
      (fbx) => {
        // Apply materials
        fbx.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: hovered || selected ? '#aaccff' : '#ffffff',
              roughness: 0.5,
              metalness: 0.2,
              emissive: selected ? '#4477ff' : '#000000',
              emissiveIntensity: selected ? 0.5 : 0
            });
          }
        });
        setModel(fbx);
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
      },
      (error) => {
        console.error('Error loading FBX:', error);
      }
    );
  }, [url]);
  
  // Update material when hovered or selected state changes
  useEffect(() => {
    if (model) {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            child.material.color.set(hovered || selected ? '#aaccff' : '#ffffff');
            child.material.emissive.set(selected ? '#4477ff' : '#000000');
            child.material.emissiveIntensity = selected ? 0.5 : 0;
          }
        }
      });
    }
  }, [hovered, selected, model]);
  
  // Use Transform controls if selected
  useEffect(() => {
    if (meshRef.current && selected) {
      // This is handled by the TransformControls component
    }
  }, [selected]);
  
  // Update position handler
  const handleTransform = () => {
    if (meshRef.current) {
      const newPosition: [number, number, number] = [
        meshRef.current.position.x,
        meshRef.current.position.y,
        meshRef.current.position.z
      ];
      
      const newRotation: [number, number, number] = [
        meshRef.current.rotation.x,
        meshRef.current.rotation.y,
        meshRef.current.rotation.z
      ];
      
      const newScale: [number, number, number] = [
        meshRef.current.scale.x,
        meshRef.current.scale.y,
        meshRef.current.scale.z
      ];
      
      onPositionChange(id, newPosition, newRotation, newScale);
    }
  };
  
  // Set initial position
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.set(...position);
      meshRef.current.rotation.set(...rotation);
      meshRef.current.scale.set(...scale);
    }
  }, []);
  
  // If no model, show placeholder
  if (!model) {
    return (
      <mesh 
        ref={meshRef as any}
        position={position}
        rotation={rotation}
        scale={scale}
        onClick={onSelect}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial 
          color={hovered || selected ? '#4477ff' : '#aaaaaa'} 
          wireframe 
        />
      </mesh>
    );
  }
  
  return (
    <>
      <animated.group
        ref={meshRef}
        onClick={onSelect}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        position={position}
        rotation={rotation}
        scale={scale}
      >
        <primitive object={model} />
      </animated.group>
      
      {selected && (
        <TransformControls
          object={meshRef as unknown as THREE.Object3D}
          mode={transformMode}
          size={0.5}
          onChange={handleTransform}
        />
      )}
    </>
  );
};

// Main component for arranging fragments
const FragmentAssembler = () => {
  const [fragments, setFragments] = useState<FragmentPosition[]>([]);
  const [selectedFragmentId, setSelectedFragmentId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [loading, setLoading] = useState(true);
  const [configName, setConfigName] = useState('default_config');
  const [isAssembling, setIsAssembling] = useState(false);
  
  // Initialize fragment list from directory
  useEffect(() => {
    // List of fragment IDs from the directory - using the actual range from your files
    // From NewGeometryCollection_SM_285_ to NewGeometryCollection_SM_387_
    const fragmentNumbers = Array.from({ length: 103 }, (_, i) => 285 + i);
    
    // Create initial positions in a spherical arrangement (like an exploded view)
    const initialFragments = fragmentNumbers.map((num, index) => {
      // Calculate position in a spherical pattern
      const phi = Math.acos(-1 + (2 * index) / fragmentNumbers.length);
      const theta = Math.sqrt(fragmentNumbers.length * Math.PI) * phi;
      
      // Radius of the sphere
      const radius = 2.5;
      
      // Convert spherical to cartesian coordinates
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      return {
        id: `NewGeometryCollection_SM_${num}_`,
        position: [x, y, z] as [number, number, number],
        rotation: [
          Math.random() * Math.PI * 2, 
          Math.random() * Math.PI * 2, 
          Math.random() * Math.PI * 2
        ] as [number, number, number],
        scale: [0.1, 0.1, 0.1] as [number, number, number], // Smaller scale for better visibility
        loaded: false
      };
    });
    
    setFragments(initialFragments);
    setLoading(false);
  }, []);
  
  // Handle position change
  const handlePositionChange = (
    id: string, 
    position: [number, number, number], 
    rotation: [number, number, number], 
    scale: [number, number, number]
  ) => {
    setFragments(prev => 
      prev.map(frag => 
        frag.id === id 
          ? { ...frag, position, rotation, scale, loaded: true } 
          : frag
      )
    );
  };
  
  // Export configuration
  const exportConfig = () => {
    const config = {
      name: configName,
      fragments: fragments.map(({ id, position, rotation, scale }) => ({
        id,
        position,
        rotation,
        scale
      }))
    };
    
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${configName}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  // Import configuration
  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);
        setConfigName(config.name || 'imported_config');
        setFragments(config.fragments.map((frag: any) => ({
          ...frag,
          loaded: false
        })));
      } catch (error) {
        console.error('Error parsing configuration:', error);
      }
    };
    reader.readAsText(file);
  };

  // Animation to bring fragments together
  const assembleFragments = () => {
    setIsAssembling(true);
    
    // Create a tighter spherical arrangement for the assembled state
    const assembledFragments = [...fragments].map((frag, index) => {
      // Calculate position in a tighter spherical pattern
      const phi = Math.acos(-1 + (2 * index) / fragments.length);
      const theta = Math.sqrt(fragments.length * Math.PI) * phi;
      
      // Smaller radius for the assembled state
      const radius = 0.5;
      
      // Convert spherical to cartesian coordinates
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      return {
        ...frag,
        position: [x, y, z] as [number, number, number],
        scale: [0.1, 0.1, 0.1] as [number, number, number]
      };
    });
    
    // Update fragment positions with animation
    setTimeout(() => {
      setFragments(assembledFragments);
      setTimeout(() => {
        setIsAssembling(false);
      }, 2000);
    }, 100);
  };
  
  // Explode fragments back out
  const explodeFragments = () => {
    setIsAssembling(true);
    
    // Return to the original spherical arrangement
    const explodedFragments = [...fragments].map((frag, index) => {
      // Calculate position in the original spherical pattern
      const phi = Math.acos(-1 + (2 * index) / fragments.length);
      const theta = Math.sqrt(fragments.length * Math.PI) * phi;
      
      // Original radius
      const radius = 2.5;
      
      // Convert spherical to cartesian coordinates
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      return {
        ...frag,
        position: [x, y, z] as [number, number, number]
      };
    });
    
    // Update fragment positions with animation
    setTimeout(() => {
      setFragments(explodedFragments);
      setTimeout(() => {
        setIsAssembling(false);
      }, 2000);
    }, 100);
  };

  return (
    <group>
      {/* UI Controls */}
      <Html position={[0, 5, 0]} style={{ width: '300px' }}>
        <div style={{ backgroundColor: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '5px', color: 'white' }}>
          <h3>Fragment Assembler</h3>
          
          <div style={{ marginBottom: '10px' }}>
            <label>Transform Mode: </label>
            <select 
              value={transformMode} 
              onChange={(e) => setTransformMode(e.target.value as any)}
              style={{ margin: '0 10px' }}
            >
              <option value="translate">Translate</option>
              <option value="rotate">Rotate</option>
              <option value="scale">Scale</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button 
              onClick={assembleFragments} 
              disabled={isAssembling}
              style={{ 
                padding: '5px 10px', 
                backgroundColor: '#4CAF50',
                opacity: isAssembling ? 0.5 : 1
              }}
            >
              Assemble Fragments
            </button>
            
            <button 
              onClick={explodeFragments} 
              disabled={isAssembling}
              style={{ 
                padding: '5px 10px', 
                backgroundColor: '#f44336',
                opacity: isAssembling ? 0.5 : 1
              }}
            >
              Explode View
            </button>
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label>Config Name: </label>
            <input 
              type="text" 
              value={configName} 
              onChange={(e) => setConfigName(e.target.value)}
              style={{ margin: '0 10px', width: '150px' }}
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button onClick={exportConfig} style={{ padding: '5px 10px' }}>
              Export Configuration
            </button>
            
            <label style={{ padding: '5px 10px', backgroundColor: '#4477ff', borderRadius: '3px', cursor: 'pointer' }}>
              Import Config
              <input 
                type="file" 
                accept=".json" 
                onChange={importConfig} 
                style={{ display: 'none' }}
              />
            </label>
          </div>
          
          <p>Selected: {selectedFragmentId || 'None'}</p>
          <p>Fragments: {fragments.filter(f => f.loaded).length} loaded / {fragments.length} total</p>
          {isAssembling && <p style={{ color: '#ffcc00' }}>Animating fragments...</p>}
        </div>
      </Html>
      
      {/* Render fragments */}
      {fragments.map((fragment) => (
        <Fragment
          key={fragment.id}
          id={fragment.id}
          url={`/fracturedrockfragments/Game/BlankDefault/${fragment.id}.FBX`}
          position={fragment.position}
          rotation={fragment.rotation}
          scale={fragment.scale}
          onPositionChange={handlePositionChange}
          selected={selectedFragmentId === fragment.id}
          onSelect={() => setSelectedFragmentId(fragment.id)}
          transformMode={transformMode}
        />
      ))}
      
      {/* Camera controls */}
      <OrbitControls makeDefault enableRotate enableZoom enablePan />
      
      {/* Grid helper */}
      <gridHelper args={[20, 20, 0x888888, 0x444444]} />
      
      {/* Ambient light */}
      <ambientLight intensity={0.6} />
      
      {/* Directional lights */}
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, -10, -5]} intensity={0.5} />
    </group>
  );
};

export default FragmentAssembler; 