'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useConversation } from '@11labs/react';

const SimpleVolumeIndicator = () => {
  const conversation = useConversation();
  const [outputVolume, setOutputVolume] = useState(0);
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [isSpeakingState, setIsSpeakingState] = useState(false);
  
  // Audio analysis refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const lastSpeakingTime = useRef(Date.now());
  
  // Add a debug log function
  const addDebugLog = (message: string) => {
    console.log(`[VolumeIndicator] ${message}`);
    setDebugInfo(prev => {
      const newLogs = [message, ...prev];
      return newLogs.slice(0, 5);
    });
  };
  
  // Initialize microphone audio system after user interaction
  const initializeMicAudio = async () => {
    if (initializedRef.current) return;
    
    try {
      // Request microphone access
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false, // Disable echo cancellation to better pickup speaker sound
          noiseSuppression: false, // Disable noise suppression to better pickup speaker sound
          autoGainControl: false   // Disable auto gain control to maintain consistent levels
        } 
      });
      
      // Create audio context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create analyzer
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048; // Higher FFT for better resolution
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      analyserRef.current.smoothingTimeConstant = 0.85;
      
      // Create data array for analysis
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      // Create microphone source
      micSourceRef.current = audioContextRef.current.createMediaStreamSource(micStreamRef.current);
      
      // Connect mic to analyzer (but NOT to destination to avoid feedback loop)
      micSourceRef.current.connect(analyserRef.current);
      
      addDebugLog(`Microphone audio initialized, fftSize=${analyserRef.current.fftSize}`);
      initializedRef.current = true;
      setAudioInitialized(true);
    } catch (err) {
      setError(`Microphone initialization error: ${(err as Error).message}`);
      console.error('Microphone init error:', err);
    }
  };
  
  // Clean up audio resources on unmount
  useEffect(() => {
    return () => {
      // Stop microphone stream
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Disconnect source
      if (micSourceRef.current) {
        micSourceRef.current.disconnect();
      }
      
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => console.warn('Error closing audio context:', e));
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  // Track speaking state from conversation
  useEffect(() => {
    if (!conversation) return;
    
    const wasSpeaking = isSpeakingState;
    const nowSpeaking = !!conversation.isSpeaking;
    
    // Only update and log if there's an actual change
    if (wasSpeaking !== nowSpeaking) {
      setIsSpeakingState(nowSpeaking);
      
      if (nowSpeaking) {
        addDebugLog(`Agent started speaking`);
        lastSpeakingTime.current = Date.now();
      } else {
        const speakDuration = (Date.now() - lastSpeakingTime.current) / 1000;
        addDebugLog(`Agent stopped speaking (duration: ${speakDuration.toFixed(1)}s)`);
      }
    }
  }, [conversation?.isSpeaking]);
  
  // Set up continuous audio analysis
  useEffect(() => {
    if (!audioInitialized || !initializedRef.current || !analyserRef.current || !dataArrayRef.current) return;
    
    // Function to analyze audio data
    const analyzeAudio = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;
      
      try {
        // Get frequency data
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        
        // Calculate volume from frequency data
        let sum = 0;
        let nonZeroCount = 0;
        
        // Analyze a range of frequencies
        const data = dataArrayRef.current;
        
        for (let i = 0; i < data.length; i++) {
          const value = data[i];
          sum += value;
          if (value > 0) nonZeroCount++;
        }
        
        // Only consider it sound if multiple frequency bins have data
        const avgVolume = sum / (data.length * 255);
        
        // Apply boost when agent is speaking to make visualization more responsive
        const boostedVolume = isSpeakingState ? avgVolume * 1.5 : avgVolume;
        
        // Apply smoothing (slower rise, faster fall)
        const finalVolume = Math.min(1, boostedVolume > outputVolume 
          ? outputVolume + (boostedVolume - outputVolume) * 0.3 // Slow rise
          : outputVolume * 0.9); // Quick fall
        
        // Update volume state if significant change
        if (Math.abs(finalVolume - outputVolume) > 0.01) {
          setOutputVolume(finalVolume);
          
          // Update frequency visualization
          if (finalVolume > 0.05 || isSpeakingState) {
            setFrequencyData(new Uint8Array(dataArrayRef.current));
          }
          
          // Log on significant volume
          if (finalVolume > 0.1 && Math.random() < 0.01) {
            addDebugLog(`Volume: ${finalVolume.toFixed(2)}, nonZero: ${nonZeroCount}`);
          }
        }
      } catch (err) {
        console.error('Analysis error:', err);
      }
      
      // Schedule next frame
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    };
    
    // Start analysis loop
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    addDebugLog('Microphone monitoring started');
    
    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioInitialized, outputVolume]);
  
  // Calculate volume metrics for visualization
  const volumePercentage = Math.round(outputVolume * 100);
  const activeBars = Math.min(10, Math.floor(outputVolume * 12)); // Add some amplification for visualization
  
  // Bar colors
  const barColors = [
    '#22c55e', '#22c55e', '#22c55e', // Green (0-2)
    '#eab308', '#eab308', '#eab308', '#eab308', // Yellow (3-6)
    '#ef4444', '#ef4444', '#ef4444' // Red (7-9)
  ];
  
  return (
    <div style={{ 
      width: '100%', 
      padding: '24px', 
      backgroundColor: '#111827', 
      borderRadius: '8px', 
      border: '4px solid #3b82f6'
    }}>
      {/* Status information */}
      <div style={{ 
        marginBottom: '16px', 
        backgroundColor: '#000000', 
        padding: '12px', 
        borderRadius: '4px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '14px'
      }}>
        <div style={{ marginBottom: '4px' }}>
          Status: <span style={{ color: '#4ade80' }}>{conversation?.status || 'disconnected'}</span>
        </div>
        <div style={{ marginBottom: '4px' }}>
          Speaking: <span style={{ color: isSpeakingState ? '#facc15' : '#6b7280' }}>{isSpeakingState ? 'yes' : 'no'}</span>
          {isSpeakingState && <span style={{ color: '#ef4444', marginLeft: '8px' }}>●</span>}
        </div>
        <div style={{ marginBottom: '4px' }}>
          Volume: <span style={{ color: '#f87171' }}>{outputVolume.toFixed(3)}</span>
        </div>
        <div style={{ marginBottom: '4px' }}>
          Audio Monitoring: <span style={{ color: audioInitialized ? '#4ade80' : '#f87171' }}>
            {audioInitialized ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        
        {/* Debug logs */}
        <div style={{ marginTop: '8px', borderTop: '1px solid #333', paddingTop: '8px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Debug logs:</div>
          {debugInfo.map((log, i) => (
            <div key={i} style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>
              {log}
            </div>
          ))}
        </div>
        
        {error && (
          <div style={{ color: '#f87171', marginTop: '8px' }}>Error: {error}</div>
        )}
      </div>
      
      {/* Audio Initialization Button */}
      {!audioInitialized && (
        <div style={{
          marginBottom: '16px',
          backgroundColor: '#1f2937',
          padding: '16px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={{ color: 'white', marginBottom: '12px' }}>
            Audio monitoring requires microphone access to monitor sound levels. 
            This will allow detecting the agent's voice through your speakers.
          </p>
          <button
            onClick={initializeMicAudio}
            style={{
              padding: '10px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Enable Audio Monitoring
          </button>
        </div>
      )}
      
      {/* Volume meter display */}
      <div style={{ 
        marginBottom: '24px', 
        backgroundColor: '#000000', 
        padding: '16px', 
        borderRadius: '8px'
      }}>
        <div style={{ 
          color: 'white', 
          marginBottom: '12px', 
          textAlign: 'center', 
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          REAL-TIME VOLUME METER
        </div>
        
        {/* Volume visualization - bars */}
        <div style={{ 
          display: 'flex', 
          height: '48px',
          gap: '4px',
          marginBottom: '16px'
        }}>
          {[...Array(10)].map((_, i) => (
            <div 
              key={i} 
              style={{ 
                width: '100%',
                height: '100%',
                backgroundColor: i < activeBars ? barColors[i] : '#1f2937',
                borderRadius: '2px',
                transition: 'background-color 0.1s'
              }}
            />
          ))}
        </div>
        
        {/* Volume visualization - progress bar */}
        <div style={{ 
          height: '32px', 
          backgroundColor: '#1f2937', 
          borderRadius: '8px', 
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{ 
            height: '100%',
            width: `${volumePercentage}%`,
            background: 'linear-gradient(to right, #22c55e, #eab308, #ef4444)',
            transition: 'width 0.1s'
          }} />
          
          <div style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '16px',
            textShadow: '1px 1px 2px black'
          }}>
            {volumePercentage}%
          </div>
        </div>
      </div>
      
      {/* Frequency visualization */}
      {frequencyData && frequencyData.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            color: 'white', 
            marginBottom: '8px', 
            fontSize: '16px',
            fontWeight: 'bold'
          }}>
            FREQUENCY SPECTRUM
          </div>
          
          <div style={{ 
            height: '100px', 
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '1px'
          }}>
            {/* Only display a subset of frequency bins for visibility */}
            {Array.from(frequencyData).slice(0, 64).map((value, i) => (
              <div 
                key={i}
                style={{
                  height: `${(value / 255) * 100}%`,
                  backgroundColor: `hsl(${240 - (value / 255) * 240}, 100%, 50%)`,
                  width: '100%',
                  transition: 'height 0.05s'
                }}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Speaking status indicator */}
      <div style={{ 
        padding: '12px',
        textAlign: 'center', 
        color: 'white', 
        fontWeight: 'bold',
        fontSize: '16px',
        backgroundColor: isSpeakingState ? '#065f46' : '#1f2937',
        borderRadius: '8px',
        transition: 'background-color 0.3s'
      }}>
        {isSpeakingState ? 
          "🔊 AGENT IS SPEAKING NOW! 🔊" : 
          "🔇 Agent is silent... 🔇"}
      </div>
    </div>
  );
};

export default SimpleVolumeIndicator; 