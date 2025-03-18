import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import FragmentAssembler from '../components/FragmentAssembler';
import Head from 'next/head';
import Link from 'next/link';

export default function RockAssemblerPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check if the directory exists on mount
    fetch('/fracturedrockfragments/Game/BlankDefault/NewGeometryCollection_SM_285_.FBX')
      .then(response => {
        if (!response.ok) {
          setErrorMessage("Fragment files not found. Make sure to copy your rock fragment files to the public/fracturedrockfragments directory.");
        }
      })
      .catch(() => {
        setErrorMessage("Unable to load rock fragment files. Please ensure they are copied to the public/fracturedrockfragments directory.");
      });
  }, []);

  return (
    <>
      <Head>
        <title>Rock Fragment Assembler - Oddysseia</title>
        <meta name="description" content="Assemble and position rock fragments to create a complete model" />
      </Head>
      
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        background: 'linear-gradient(to bottom, #0f2027, #203a43, #2c5364)'
      }}>
        {errorMessage ? (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <h2>Error Loading Fragments</h2>
            <p>{errorMessage}</p>
            <div style={{ marginTop: '20px' }}>
              <p>To resolve this issue:</p>
              <ol style={{ textAlign: 'left' }}>
                <li>Copy all your fragment FBX files to the <code>/public/fracturedrockfragments/Game/BlankDefault/</code> directory</li>
                <li>Make sure the file paths match the expected pattern: <code>NewGeometryCollection_SM_XXX_.FBX</code></li>
                <li>Refresh this page after copying the files</li>
              </ol>
            </div>
          </div>
        ) : (
          <Canvas
            camera={{ position: [0, 5, 10], fov: 50 }}
            style={{ width: '100%', height: '100%' }}
          >
            <FragmentAssembler />
          </Canvas>
        )}
        
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 1000,
        }}>
          <Link href="/" style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            borderRadius: '5px',
            textDecoration: 'none',
            fontFamily: 'Arial, sans-serif',
            display: 'inline-block'
          }}>
            Back to Home
          </Link>
        </div>
        
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          zIndex: 1000,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          maxWidth: '400px',
          fontFamily: 'Arial, sans-serif'
        }}>
          <h2 style={{ margin: '0 0 10px 0' }}>Rock Fragment Assembler</h2>
          <p>Instructions:</p>
          <ol style={{ paddingLeft: '20px', margin: '5px 0' }}>
            <li>Click on a fragment to select it</li>
            <li>Use the transform controls to position it</li>
            <li>Export your configuration when finished</li>
            <li>Import previous configurations to continue working</li>
          </ol>
          <p style={{ marginTop: '10px', fontSize: '0.9em' }}>
            This tool helps you reconstruct the fractured rock model by arranging individual fragments.
          </p>
        </div>
      </div>
    </>
  );
} 