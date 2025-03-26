"use client";

import Scene from "@/components/Scene";
import { useState, useEffect, useRef, useMemo } from "react";
import SceneContainer from "@/components/SceneContainer";
import ElevenLabsButton from "@/components/ElevenLabsButton";
import LoadingScreen from "@/components/LoadingScreen";

// Logo component with glitch effect
const GlitchLogo = () => {
  const [isHovering, setIsHovering] = useState(false);
  
  return (
    <div 
      className="font-bold text-[3.5rem] tracking-tighter"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{ display: 'none' }}
    >
      <h1 className={`text-white ${isHovering ? 'glitch-text' : ''} text-glow-strong`} data-text="ODDYSSEIA">
        ODDYSSEIA
      </h1>
    </div>
  );
};

// Component to hide the Next.js button
const ButtonHider = () => {
  useEffect(() => {
    // Try to find and hide the Next.js button
    const hideButton = () => {
      const buttons = document.querySelectorAll('button');
      buttons.forEach(button => {
        if (button.textContent === 'N' || 
            button.innerHTML.includes('svg') || 
            button.parentElement?.getAttribute('data-testid')?.includes('dev')) {
          button.style.display = 'none';
          button.style.visibility = 'hidden';
          button.style.opacity = '0';
          button.style.pointerEvents = 'none';
          
          // Also try to hide parent elements
          if (button.parentElement) {
            button.parentElement.style.display = 'none';
            button.parentElement.style.visibility = 'hidden';
          }
        }
      });
    };

    // Run multiple times to catch the button when it appears
    hideButton();
    const interval = setInterval(hideButton, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 w-16 h-16 bg-transparent z-[9999]" 
         style={{ pointerEvents: 'none' }}>
      {/* This div covers the area where the Next.js button appears */}
    </div>
  );
};

// Custom HTML content component for scrollytelling
const HtmlContent = () => {
  return (
    <div style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '500vh', // 5x viewport height for 5 scroll sections
      pointerEvents: 'none',
      zIndex: 100
    }}>
      {/* Empty container for future content if needed */}
    </div>
  );
};

// Component to toggle debug info visibility
const DebugToggle = () => {
  const [isVisible, setIsVisible] = useState(true);
  
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
    
    // Find and toggle any debug elements at bottom left
    const debugElements = document.querySelectorAll('[style*="bottom"][style*="left"]');
    debugElements.forEach(el => {
      if (el instanceof HTMLElement && 
          (el.textContent?.includes('Scroll') || 
           el.textContent?.includes('Position') || 
           el.textContent?.includes('Scene') ||
           el.textContent?.includes('Percentage'))) {
        el.style.display = isVisible ? 'none' : 'block';
      }
    });
  };
  
  return (
    <div 
      onClick={toggleVisibility}
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        zIndex: 9999,
        pointerEvents: 'auto'
      }}
    >
      {isVisible ? 'Hide Debug' : 'Show Debug'}
    </div>
  );
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Track loading progress for assets - simpler version without model preloading
  useEffect(() => {
    // Only track simple assets that won't trigger WebAssembly loading
    const assets = [
      // Removed 3D models that cause WebAssembly memory issues
      '/rockanimation.mp4' // Only preload the video
    ];
    
    let loadedCount = 0;
    let failedCount = 0;
    
    // Safer progress tracker with timeout
    const updateProgress = () => {
      loadedCount++;
      const progress = loadedCount / Math.max(1, assets.length);
      setLoadingProgress(progress);
      
      if ((loadedCount + failedCount) >= assets.length || assets.length === 0) {
        console.log(`Loading completed: ${loadedCount} loaded, ${failedCount} failed`);
        // Add artificial delay before removing loading screen
        setTimeout(() => {
          setIsLoading(false);
        }, 2000); // Give time to see the loading animation
      }
    };

    const handleFailure = (url: string) => {
      console.warn(`Failed to load asset: ${url}`);
      failedCount++;
      
      if ((loadedCount + failedCount) >= assets.length || assets.length === 0) {
        console.log(`Loading completed with errors: ${loadedCount} loaded, ${failedCount} failed`);
        setTimeout(() => {
          setIsLoading(false);
        }, 2000);
      }
    };
    
    // Video loader (only load video, not 3D models)
    const loadVideo = (url: string) => {
      return new Promise<void>((resolve) => {
        try {
          const video = document.createElement('video');
          video.preload = 'metadata'; // Only load metadata, not full video
          video.muted = true;
          video.src = url;
          
          // Just check if metadata is available
          video.onloadedmetadata = () => {
            console.log(`Video metadata loaded: ${url}`);
            updateProgress();
            resolve();
          };
          
          // Handle errors
          video.onerror = () => {
            console.error(`Failed to load video: ${url}`);
            handleFailure(url);
            resolve();
          };
          
          // Safety timeout - assume loaded after 3 seconds
          setTimeout(() => {
            if (loadedCount + failedCount < assets.length) {
              console.log(`Video loader timed out: ${url}`);
              updateProgress();
              resolve();
            }
          }, 3000);
        } catch (error) {
          console.error(`Error setting up video loader: ${url}`, error);
          handleFailure(url);
          resolve();
        }
      });
    };
    
    // Start loading process if there are assets to load
    if (assets.length > 0) {
      try {
        assets.forEach((asset) => {
          if (asset.endsWith('.mp4')) {
            loadVideo(asset);
          } else {
            // For any other type, just mark as loaded
            console.log(`Skipping preload for: ${asset}`);
            updateProgress();
          }
        });
      } catch (error) {
        console.error("Error in asset loading process:", error);
        setIsLoading(false);
      }
    } else {
      // If no assets to load, show loading screen briefly then fade out
      const minLoadingTime = setTimeout(() => {
        setIsLoading(false);
      }, 2000);
      
      return () => clearTimeout(minLoadingTime);
    }
    
    // Simulate gradual progress in case of stalls
    const progressInterval = setInterval(() => {
      if (loadingProgress < 0.95 && isLoading) {
        setLoadingProgress((prev) => Math.min(prev + 0.05, 0.95));
      }
    }, 1000);
    
    // Always hide loading screen after maximum time
    const maxLoadingTime = setTimeout(() => {
      setIsLoading(false);
    }, 6000);
    
    return () => {
      clearInterval(progressInterval);
      clearTimeout(maxLoadingTime);
    };
  }, [isLoading, loadingProgress]);
  
  // Force render after component mount to ensure overlay is visible
  useEffect(() => {
    // Set mounted after a brief delay to allow React to settle
    const timer = setTimeout(() => setMounted(true), 50);
    
    // Force the overlay to be visible
    const forceVisibility = () => {
      if (overlayRef.current) {
        overlayRef.current.style.display = 'block';
        overlayRef.current.style.opacity = '1';
        overlayRef.current.style.visibility = 'visible';
        overlayRef.current.style.zIndex = '9000';
      }
      
      // Also try to hide any Next.js watermark
      const watermarks = document.querySelectorAll('[id*="__nextjs"], [data-nextjs], [class*="nextjs"]');
      watermarks.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
        }
      });
    };
    
    // Run multiple times to ensure visibility
    forceVisibility();
    const visibilityInterval = setInterval(forceVisibility, 500);
    
    return () => {
      clearTimeout(timer);
      clearInterval(visibilityInterval);
    };
  }, []);

  return (
    <>
      {/* Loading screen - shown until all assets are loaded */}
      <LoadingScreen isLoading={isLoading} progress={loadingProgress} />
      
      <div className="relative">
        {/* Scrollable content - height determines how much scrolling is available */}
        <div className="h-[500vh] w-full">
          {/* This creates the scroll height but is invisible */}
        </div>
        
        {/* Only mount 3D content after initial render to prevent hydration issues */}
        {mounted && !isLoading && <SceneContainer />}
        
        {/* Content Overlay - with higher z-index and ref for forced visibility */}
        <div 
          ref={overlayRef}
          data-overlay="true"
          className="absolute inset-0 pointer-events-none" 
          style={{ 
            zIndex: 9000,
            display: 'block',
            visibility: 'visible',
            opacity: 1,
            pointerEvents: 'none'
          }}
        >
          {/* Logo and Copyright - Direct inline positioning */}
          <div id="logo-container" style={{
              position: 'fixed',
              top: '40px',
              left: '120px',
              pointerEvents: 'auto',
              zIndex: 9500
            }}>
            <GlitchLogo />
            <div style={{ 
                color: '#555555',
                marginTop: '8px',
                marginBottom: '24px',
                textShadow: 'none',
                fontFamily: "var(--font-courier-prime), 'Courier', monospace",
                fontWeight: 500,
                fontSize: '15px',
                letterSpacing: '0.02em',
                display: 'none'
              }} 
              className="font-mono leading-relaxed pl-1"
            >
              // Copyright © 2024
            </div>
            <div style={{ 
                color: 'white', 
                textShadow: 'none',
                fontFamily: "var(--font-courier-prime), 'Courier', monospace",
                fontWeight: 500,
                fontSize: '15px',
                letterSpacing: '0.02em',
                display: 'none'
              }} 
              className="font-mono leading-relaxed pl-1"
            >
              Nordweg, Inc.
            </div>
            <div style={{ 
                color: 'white', 
                textShadow: 'none',
                fontFamily: "var(--font-courier-prime), 'Courier', monospace",
                fontWeight: 500,
                fontSize: '15px',
                letterSpacing: '0.02em',
                display: 'none'
              }} 
              className="font-mono leading-relaxed pl-1"
            >
              All Rights Reserved.
            </div>
          </div>
          
          {/* Manifesto - Direct control with inline positioning */}
          <div id="manifesto-container" style={{
              position: 'fixed',
              top: '65px',
              right: '140px',
              width: '320px',
              display: 'none',
              flexDirection: 'column',
              alignItems: 'flex-end',
              pointerEvents: 'auto',
              zIndex: 9500
            }}>
            <div style={{ 
                color: '#555555',
                marginBottom: '18px',
                textShadow: 'none',
                fontFamily: "var(--font-courier-prime), 'Courier', monospace",
                fontWeight: 500,
                fontSize: '15px',
                letterSpacing: '0.03em'
              }} 
              className="font-mono leading-relaxed"
            >
              ////// Manifesto
            </div>
            <div style={{ 
                color: 'white', 
                textShadow: '0 0 4px rgba(255, 255, 255, 0.3)',
                fontFamily: "var(--font-courier-prime), 'Courier', monospace",
                fontWeight: 500,
                fontSize: '16px',
                letterSpacing: '0.02em',
                lineHeight: '1.25',
                textTransform: 'lowercase',
                maxWidth: '280px',
                textAlign: 'right'
              }} 
              className="font-mono"
            >
              backpacks of classic luxury <br/>
              with a rugged foundation.<br/>
              embrace the elements,<br/>
              explore a cleaner<br/>
              state of <br/>
              mind.
            </div>
          </div>
          
          {/* ElevenLabs Button - positioned near the floating rock */}
          <div id="elevenlabs-button-container" style={{
              position: 'fixed',
              bottom: '120px',
              right: '140px',
              pointerEvents: 'auto',
              zIndex: 9500,
              display: 'none'
            }}>
            <ElevenLabsButton />
          </div>
          
          {/* Debug toggle button */}
          <DebugToggle />
          
          {/* HTML content for scrollytelling */}
          <HtmlContent />
        </div>
      </div>
    </>
  );
}
