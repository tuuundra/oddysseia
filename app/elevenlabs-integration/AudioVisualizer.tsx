'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { useConversation } from '@11labs/react';
import { useEffect, useState, useRef } from 'react';
import AudioReactiveSphere from './AudioReactiveSphere';

const AudioVisualizer = () => {
  // Get the conversation state here at a higher level
  const conversation = useConversation();
  
  // Audio analysis state
  const [audioAmplitude, setAudioAmplitude] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Debug info
  const [audioFound, setAudioFound] = useState(false);
  const [analysisActive, setAnalysisActive] = useState(false);

  // Initialize audio analysis
  useEffect(() => {
    console.log("Setting up audio analysis");
    
    const setupAudioAnalysis = () => {
      try {
        // Create audio context
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        // Create analyzer node with small FFT for better performance
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        // Setup data array for analysis
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        dataArrayRef.current = dataArray;
        
        // Function to analyze audio in real-time
        const analyzeAudio = () => {
          if (!analyserRef.current || !dataArrayRef.current) return;
          
          // Get frequency data
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          
          // Calculate average amplitude (0-1)
          let sum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            sum += dataArrayRef.current[i];
          }
          const average = sum / dataArrayRef.current.length / 255;
          
          // Apply a threshold to filter out background noise
          const thresholdedAverage = average > 0.05 ? average : 0;
          
          // Update state with current amplitude
          setAudioAmplitude(thresholdedAverage);
          
          // Schedule next frame
          animationFrameRef.current = requestAnimationFrame(analyzeAudio);
        };
        
        // Find all audio elements on the page that might be playing speech
        const findAndConnectToAudio = () => {
          const audioElements = document.querySelectorAll('audio');
          console.log(`Found ${audioElements.length} audio elements`, audioElements);
          
          if (audioElements.length > 0) {
            // Use the first audio element we find
            const audioElement = audioElements[0];
            audioElementRef.current = audioElement;
            setAudioFound(true);
            
            // Create audio source from the element
            const source = audioContext.createMediaElementSource(audioElement);
            audioSourceRef.current = source;
            
            // Connect the audio through our analyzer and to the destination
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            
            // Start analysis loop
            analyzeAudio();
            setAnalysisActive(true);
            console.log("Audio analysis started!");
          }
        };
        
        // Check for existing audio elements
        findAndConnectToAudio();
        
        // If no audio elements found, watch for when they are added to the DOM
        if (!audioFound) {
          console.log("No audio elements found initially, setting up observer");
          
          const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (mutation.addedNodes.length) {
                // Check if any of the added nodes are audio elements or contain audio elements
                mutation.addedNodes.forEach((node) => {
                  // Check if the node itself is an audio element
                  if (node.nodeName === 'AUDIO') {
                    console.log("Audio element found via mutation observer!");
                    findAndConnectToAudio();
                    observer.disconnect();
                  } 
                  // Check if the node contains any audio elements
                  else if (node instanceof Element) {
                    const audioInNode = node.querySelectorAll('audio');
                    if (audioInNode.length > 0) {
                      console.log("Audio element found inside added node!");
                      findAndConnectToAudio();
                      observer.disconnect();
                    }
                  }
                });
              }
            }
          });
          
          // Observe the entire document for changes
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        }
      } catch (err) {
        console.error("Error setting up audio analysis:", err);
      }
    };
    
    setupAudioAnalysis();
    
    // Cleanup function
    return () => {
      console.log("Cleaning up audio analysis");
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
      }
      
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // Debug data
  useEffect(() => {
    // Log amplitude changes when they're significant
    if (audioAmplitude > 0.1) {
      console.log(`Audio amplitude: ${audioAmplitude.toFixed(2)}`);
    }
  }, [audioAmplitude]);
  
  return (
    <div className="w-full h-80 rounded-lg overflow-hidden border border-blue-900 relative">
      {/* Debug info panel */}
      <div className="absolute top-3 left-3 z-10 bg-black bg-opacity-70 p-2 rounded text-xs font-mono text-white">
        <div>conversation status: {conversation.status || 'unknown'}</div>
        <div>audio found: {audioFound ? 'yes' : 'no'}</div>
        <div>analysis active: {analysisActive ? 'yes' : 'no'}</div>
        <div>amplitude: {audioAmplitude.toFixed(2)}</div>
      </div>
      
      {/* Audio amplitude display */}
      <div className="absolute bottom-3 left-3 right-3 z-10 bg-black bg-opacity-50 rounded p-1">
        <div className="h-4 bg-gray-700 rounded overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${audioAmplitude * 100}%` }}
          ></div>
        </div>
      </div>
      
      <Canvas camera={{ position: [0, 0, 3], fov: 40 }}>
        <color attach="background" args={['#131825']} />
        <ambientLight intensity={0.2} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={0.5} />
        <pointLight position={[-10, -10, -10]} color="#4b6dff" intensity={0.2} />
        
        {/* Audio-reactive sphere using actual audio amplitude */}
        <AudioReactiveSphere amplitude={audioAmplitude} isSpeaking={audioAmplitude > 0.1} />
        
        {/* Environment and controls */}
        <Environment preset="night" />
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI/3} maxPolarAngle={Math.PI/2} />
      </Canvas>
    </div>
  );
};

export default AudioVisualizer; 