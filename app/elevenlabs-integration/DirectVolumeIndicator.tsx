'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Conversation } from '@11labs/client';

interface DirectVolumeIndicatorProps {
  apiKey?: string; // API key for ElevenLabs
  voiceId?: string; // Voice ID to use
  active?: boolean; // Whether the component should be active
  text?: string; // Text to speak (if manually triggering speech)
}

const DirectVolumeIndicator: React.FC<DirectVolumeIndicatorProps> = ({
  apiKey,
  voiceId = 'pNInz6obpgDQGcFmaJgB', // Example default voice ID
  active = false,
  text = ''
}) => {
  // State for volume data
  const [outputVolume, setOutputVolume] = useState(0);
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Audio processing refs
  const clientRef = useRef<Conversation | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const initialized = useRef(false);

  // Add a debug log function
  const addDebugLog = (message: string) => {
    console.log(`[DirectVolumeIndicator] ${message}`);
    setDebugInfo(prev => {
      const newLogs = [message, ...prev];
      return newLogs.slice(0, 5);
    });
  };

  // Initialize audio context and analyzer
  useEffect(() => {
    if (initialized.current) return;

    try {
      // Initialize AudioContext only
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create analyzer node
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 1024;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      analyserRef.current.smoothingTimeConstant = 0.85;
      
      // Connect analyzer to destination
      analyserRef.current.connect(audioContextRef.current.destination);
      
      initialized.current = true;
      addDebugLog('Audio context and analyzer initialized');
    } catch (err) {
      setError(`Initialization error: ${(err as Error).message}`);
      console.error('Initialization error:', err);
    }
  }, [apiKey]);

  // Function to stream audio from ElevenLabs
  const streamAudio = async (textToSpeak: string) => {
    if (!audioContextRef.current || !analyserRef.current) {
      setError('Audio system not initialized');
      return;
    }

    try {
      setIsPlaying(true);
      addDebugLog(`Preparing to stream audio: "${textToSpeak.substring(0, 30)}..."`);

      // Resume AudioContext if suspended (browser policy requires user interaction)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Close previous conversation if exists
      if (clientRef.current) {
        await clientRef.current.endSession().catch(e => {
          console.warn('Error ending previous session:', e);
        });
        clientRef.current = null;
      }

      // Check for API key
      const apiKeyToUse = apiKey || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
      if (!apiKeyToUse) {
        setError('ElevenLabs API key is required');
        setIsPlaying(false);
        return;
      }

      addDebugLog('Connecting to ElevenLabs API...');

      // Log configuration info for debugging
      console.log('Elevenlabs Direct Volume Indicator - Configuration:', {
        hasApiKey: !!apiKeyToUse,
        keyPrefix: apiKeyToUse ? apiKeyToUse.substring(0, 3) + '...' : 'none',
        agentId: process.env.NEXT_PUBLIC_AGENT_ID || 'default',
        voiceId
      });

      try {
        // Initialize the ElevenLabs session with proper configuration
        addDebugLog(`Attempting connection with API key: ${apiKeyToUse.substring(0, 5)}...`);
        
        // Debug the configuration
        const sessionConfig = {
          // ElevenLabs expects either a signedUrl OR an agentId
          // Using a valid ElevenLabs agent ID
          agentId: process.env.NEXT_PUBLIC_AGENT_ID || 'E4EJnfAw4hldXtrZ9LJE',
          
          // Add authorization using API key
          authorization: apiKeyToUse,
          
          // Config overrides
          overrides: {
            tts: {
              voiceId: voiceId || 'pNInz6obpgDQGcFmaJgB' // Default voice if not provided
            },
            agent: {
              firstMessage: textToSpeak // Set the initial message directly
            }
          }
        };
        
        addDebugLog(`Using config: ${JSON.stringify({
          agentId: sessionConfig.agentId,
          hasAuth: !!sessionConfig.authorization,
          voiceId: sessionConfig.overrides.tts.voiceId,
          msgLength: textToSpeak.length
        })}`);

        clientRef.current = await Conversation.startSession({
          ...sessionConfig,
          
          // Callbacks
          onConnect: ({ conversationId }) => {
            setConversationId(conversationId);
            addDebugLog(`ElevenLabs session connected (ID: ${conversationId})`);
          },
          onDisconnect: (details) => {
            addDebugLog(`ElevenLabs session disconnected: ${JSON.stringify(details)}`);
            setIsPlaying(false);
          },
          onError: (message, context) => {
            const errorMsg = `ElevenLabs error: ${message}`;
            setError(errorMsg);
            addDebugLog(errorMsg);
            console.error('ElevenLabs error context:', context || 'No context provided');
            setIsPlaying(false);
          },
          onMessage: (props) => {
            if (props.source === 'ai') {
              addDebugLog(`AI response received: "${props.message.substring(0, 30)}..."`);
            }
          },
          onStatusChange: ({status}) => {
            addDebugLog(`Status changed: ${status}`);
          },
          onDebug: (props) => {
            addDebugLog(`Debug event: ${JSON.stringify(props).substring(0, 100)}`);
            console.log('ElevenLabs debug:', props);
          },
          // Empty client tools implementation
          clientTools: {}
        });

        addDebugLog('Session started successfully');
        
        // Set up an animation frame to monitor audio data
        const monitorAudio = () => {
          if (clientRef.current) {
            try {
              // Get volume and frequency data directly from the conversation object
              const volume = clientRef.current.getOutputVolume();
              const freqData = clientRef.current.getOutputByteFrequencyData();
              
              setOutputVolume(volume);
              if (freqData && freqData.length > 0) {
                setFrequencyData(new Uint8Array(freqData));
              }
              
              if (volume > 0.1 && Math.random() < 0.05) {
                addDebugLog(`Live volume: ${volume.toFixed(2)}`);
              }
            } catch (err) {
              console.error('Error monitoring audio:', err);
            }
          }
          
          if (isPlaying && clientRef.current) {
            animationFrameRef.current = requestAnimationFrame(monitorAudio);
          }
        };
        
        animationFrameRef.current = requestAnimationFrame(monitorAudio);
      } catch (err) {
        // Improved error handling
        let errorMessage = 'Unknown error connecting to ElevenLabs';
        let errorDetails = 'No details available';
        
        if (err instanceof Error) {
          errorMessage = err.message || 'Error without message';
          errorDetails = JSON.stringify({
            name: err.name,
            message: err.message,
            stack: err.stack?.split('\n').slice(0, 3).join('\n')
          });
        } else if (typeof err === 'string') {
          errorMessage = err;
          errorDetails = err;
        } else if (err && typeof err === 'object') {
          try {
            errorMessage = JSON.stringify(err);
            errorDetails = JSON.stringify(Object.getOwnPropertyNames(err).reduce((acc, key) => {
              acc[key] = String(err[key as keyof typeof err]).substring(0, 100);
              return acc;
            }, {} as Record<string, string>));
          } catch (e) {
            errorDetails = 'Error while stringifying error object';
          }
        }
        
        setError(`Connection error: ${errorMessage}`);
        addDebugLog(`Connection failed: ${errorMessage}`);
        addDebugLog(`Error details: ${errorDetails}`);
        console.error('Connection error details:', err);
        setIsPlaying(false);
      }
    } catch (err) {
      // Improved outer error handling
      let errorMessage = 'Unknown audio streaming error';
      let errorDetails = 'No details available';
      
      if (err instanceof Error) {
        errorMessage = err.message || 'Error without message';
        errorDetails = JSON.stringify({
          name: err.name,
          message: err.message,
          stack: err.stack?.split('\n').slice(0, 3).join('\n')
        });
      } else if (typeof err === 'string') {
        errorMessage = err;
        errorDetails = err;
      } else if (err && typeof err === 'object') {
        try {
          errorMessage = JSON.stringify(err);
          errorDetails = JSON.stringify(Object.getOwnPropertyNames(err).reduce((acc, key) => {
            acc[key] = String(err[key as keyof typeof err]).substring(0, 100);
            return acc;
          }, {} as Record<string, string>));
        } catch (e) {
          errorDetails = 'Error while stringifying error object';
        }
      }
      
      setError(`Audio streaming error: ${errorMessage}`);
      addDebugLog(`Streaming failed: ${errorMessage}`);
      addDebugLog(`Error details: ${errorDetails}`);
      console.error('Audio streaming error details:', err);
      setIsPlaying(false);
    }
  };

  // Set up cleanup for the ElevenLabs session
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.endSession().catch(e => 
          console.warn('Error ending ElevenLabs session:', e)
        );
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => 
          console.warn('Error closing audio context:', e)
        );
      }
    };
  }, []);

  // Effect to stream audio when active prop changes
  useEffect(() => {
    if (active && text && !isPlaying) {
      streamAudio(text);
    }
  }, [active, text]);

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
      {/* API Key Notice */}
      {(!apiKey && !process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) ? (
        <div style={{
          backgroundColor: 'rgba(255, 100, 100, 0.2)',
          border: '1px solid rgba(255, 100, 100, 0.5)',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          color: 'white',
          fontSize: '14px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            ⚠️ Configuration Required
          </div>
          <p>
            To use this component, you need to add your ElevenLabs API key in the <code>.env.local</code> file:
          </p>
          <pre style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: '8px',
            borderRadius: '4px',
            overflowX: 'auto',
            margin: '8px 0'
          }}>
            NEXT_PUBLIC_ELEVENLABS_API_KEY=your_actual_api_key
          </pre>
          <p>
            Get your API key from the <a href="https://elevenlabs.io/app/account" target="_blank" rel="noopener noreferrer" style={{ color: '#90cdf4', textDecoration: 'underline' }}>ElevenLabs Dashboard</a>.
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'rgba(74, 222, 128, 0.1)',
          border: '1px solid rgba(74, 222, 128, 0.3)',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          color: 'white',
          fontSize: '14px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#4ade80' }}>
            ✓ API Key Found
          </div>
          <p>
            ElevenLabs API key is configured. Using agent ID: {process.env.NEXT_PUBLIC_AGENT_ID || 'E4EJnfAw4hldXtrZ9LJE'}
          </p>
          <p>
            Click "Test Audio Stream" to try the ElevenLabs streaming audio visualization.
          </p>
        </div>
      )}

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
          Status: <span style={{ color: initialized.current ? '#4ade80' : '#f87171' }}>
            {initialized.current ? 'Initialized' : 'Not Initialized'}
          </span>
        </div>
        <div style={{ marginBottom: '4px' }}>
          Playing: <span style={{ color: isPlaying ? '#facc15' : '#6b7280' }}>
            {isPlaying ? 'yes' : 'no'}
          </span>
          {isPlaying && <span style={{ color: '#ef4444', marginLeft: '8px' }}>●</span>}
        </div>
        <div style={{ marginBottom: '4px' }}>
          Volume: <span style={{ color: '#f87171' }}>{outputVolume.toFixed(3)}</span>
        </div>
        <div style={{ marginBottom: '4px' }}>
          ConversationID: <span style={{ color: '#4ade80' }}>{conversationId || 'N/A'}</span>
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
      
      {/* Manual trigger button */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => {
            if (!isPlaying && initialized.current) {
              streamAudio('Hello! This is a test of the ElevenLabs streaming audio visualization. Can you hear me clearly?');
            }
          }}
          disabled={isPlaying || !initialized.current}
          style={{
            padding: '12px 24px',
            backgroundColor: isPlaying ? '#6b7280' : '#3b82f6',
            color: 'white',
            fontWeight: 'bold',
            borderRadius: '4px',
            border: 'none',
            cursor: isPlaying ? 'not-allowed' : 'pointer',
            opacity: isPlaying || !initialized.current ? 0.7 : 1
          }}
        >
          {isPlaying ? 'Playing...' : 'Test Audio Stream'}
        </button>
      </div>
    </div>
  );
};

export default DirectVolumeIndicator; 