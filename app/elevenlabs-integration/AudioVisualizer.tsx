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
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Debug info
  const [audioFound, setAudioFound] = useState(false);
  const [analysisActive, setAnalysisActive] = useState(false);

  // Initialize audio analysis
  useEffect(() => {
    // Only set up the audio analysis when the conversation is connected
    if (conversation.status !== 'connected') {
      setAudioFound(false);
      setAnalysisActive(false);
      setAudioAmplitude(0);
      return;
    }
    
    console.log("Setting up audio analysis with Web Audio API - conversation is connected!");
    
    const setupAudioAnalysis = () => {
      try {
        // Create audio context
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        // Resume the audio context (needed after user interaction)
        audioContext.resume().then(() => {
          console.log("AudioContext resumed successfully");
          
          // Create analyzer node with small FFT for better performance
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;
          
          // Setup data array for analysis
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          dataArrayRef.current = dataArray;
          
          // Create oscillator as audio source (since we can't access ElevenLabs audio directly)
          const oscillator = audioContext.createOscillator();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
          oscillatorRef.current = oscillator;
          
          // Create gain node to control oscillator volume
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 0; // Start with no volume
          gainNodeRef.current = gainNode;
          
          // Connect oscillator -> gain -> analyzer -> destination
          oscillator.connect(gainNode);
          gainNode.connect(analyser);
          analyser.connect(audioContext.destination);
          
          // Start the oscillator
          oscillator.start();
          
          setAudioFound(true);
          setAnalysisActive(true);
          
          // Function to analyze audio in real-time
          const analyzeAudio = () => {
            if (!analyserRef.current || !dataArrayRef.current || !gainNodeRef.current) return;
            
            // Update gain based on speaking state
            if (conversation.isSpeaking) {
              // Generate a pulsing effect when speaking (values between 0.1 and 0.3)
              const pulsingValue = 0.1 + Math.sin(Date.now() / 200) * 0.1;
              gainNodeRef.current.gain.value = pulsingValue;
            } else {
              gainNodeRef.current.gain.value = 0;
            }
            
            // Get frequency data
            analyserRef.current.getByteFrequencyData(dataArrayRef.current);
            
            // Calculate average amplitude (0-1)
            let sum = 0;
            for (let i = 0; i < dataArrayRef.current.length; i++) {
              sum += dataArrayRef.current[i];
            }
            const average = sum / dataArrayRef.current.length / 255;
            
            // Apply a threshold to filter out background noise and boost the signal
            // This gives better visual effect for the sphere
            let finalAmplitude = average;
            
            // If speaking, ensure minimum amplitude and add some variation
            if (conversation.isSpeaking) {
              // Add randomness to make it more lifelike when speaking
              const randomFactor = 1 + (Math.random() * 0.2 - 0.1); // +/- 10%
              finalAmplitude = Math.max(0.3, average * 1.5 * randomFactor);
            } else {
              // Lower when not speaking
              finalAmplitude = average * 0.2;
            }
            
            // Update state with current amplitude
            setAudioAmplitude(finalAmplitude);
            
            // Schedule next frame
            animationFrameRef.current = requestAnimationFrame(analyzeAudio);
          };
          
          // Start analysis loop
          analyzeAudio();
          console.log("Audio analysis started!");
        }).catch(error => {
          console.error("Failed to resume AudioContext:", error);
        });
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
      
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }
      
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
      }
      
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [conversation.status, conversation.isSpeaking]);
  
  // Debug data
  useEffect(() => {
    // Log amplitude changes when they're significant
    if (audioAmplitude > 0.3) {
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
        <AudioReactiveSphere amplitude={audioAmplitude} isSpeaking={conversation.isSpeaking} />
        
        {/* Environment and controls */}
        <Environment preset="night" />
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI/3} maxPolarAngle={Math.PI/2} />
      </Canvas>
    </div>
  );
};

export default AudioVisualizer; 