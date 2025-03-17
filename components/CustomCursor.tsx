"use client";

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';

const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorCircleRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  
  // Check if device is desktop (has cursor)
  useEffect(() => {
    const checkIfDesktop = () => {
      // Simple check: desktop device typically has width > 768px and no touch capability
      const isDesktopDevice = window.innerWidth > 768 && !('ontouchstart' in window);
      setIsDesktop(isDesktopDevice);
    };
    
    checkIfDesktop();
    window.addEventListener('resize', checkIfDesktop);
    
    return () => {
      window.removeEventListener('resize', checkIfDesktop);
    };
  }, []);
  
  useEffect(() => {
    if (typeof window === 'undefined' || !isDesktop) return;
    
    const cursor = cursorRef.current;
    const cursorCircle = cursorCircleRef.current;
    
    if (!cursor || !cursorCircle) return;

    // Initial position and animation
    gsap.set(cursor, { 
      x: -100, 
      y: -100,
      opacity: 0
    });
    
    gsap.set(cursorCircle, { 
      x: -100, 
      y: -100,
      opacity: 0,
      scale: 0
    });
    
    // Animate cursor in
    gsap.to([cursor, cursorCircle], {
      opacity: isEnabled ? 1 : 0,
      scale: 1,
      duration: 0.5,
      delay: 0.3,
      ease: "power2.out"
    });
    
    // Mouse move animation
    const onMouseMove = (e: MouseEvent) => {
      // Animate main cursor to follow mouse instantly
      gsap.to(cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.1,
        ease: "power1.out"
      });
      
      // Animate the circle with a slight delay for trailing effect
      gsap.to(cursorCircle, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.5,
        ease: "power2.out"
      });
    };
    
    // Handle hover states
    const handleMouseEnter = () => {
      setIsHovering(true);
      if (isEnabled) {
        gsap.to(cursor, {
          scale: 1.5,
          backgroundColor: "#00ffcc",
          opacity: 0.8,
          duration: 0.3,
        });
        gsap.to(cursorCircle, {
          scale: 1.5,
          borderColor: "#00ffcc",
          opacity: 0.3,
          duration: 0.3,
        });
      }
    };
    
    const handleMouseLeave = () => {
      setIsHovering(false);
      if (isEnabled) {
        gsap.to(cursor, {
          scale: 1,
          backgroundColor: "#00ffcc",
          opacity: 1,
          duration: 0.3,
        });
        gsap.to(cursorCircle, {
          scale: 1,
          borderColor: "#00ffcc",
          opacity: 0.5,
          duration: 0.3,
        });
      }
    };
    
    // Add event listeners
    window.addEventListener('mousemove', onMouseMove);
    
    // CSS cursor hiding - ONLY if custom cursor is enabled
    if (isEnabled) {
      document.body.style.cursor = 'none';
    }
    
    // Find all clickable and hoverable elements
    const selectableElements = document.querySelectorAll('a, button, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    selectableElements.forEach(el => {
      el.addEventListener('mouseenter', handleMouseEnter);
      el.addEventListener('mouseleave', handleMouseLeave);
      // Hide the default cursor ONLY if custom cursor is enabled
      if (isEnabled) {
        (el as HTMLElement).style.cursor = 'none';
      }
    });
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.body.style.cursor = '';
      
      selectableElements.forEach(el => {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mouseleave', handleMouseLeave);
        (el as HTMLElement).style.cursor = '';
      });
    };
  }, [isDesktop, isEnabled]);
  
  // Don't render anything if not on desktop
  if (!isDesktop) return null;
  
  return (
    <>
      {/* Toggle button for custom cursor */}
      <button 
        onClick={() => setIsEnabled(!isEnabled)}
        className="fixed bottom-4 right-4 z-50 px-3 py-2 bg-black/50 backdrop-blur-sm text-white text-xs rounded-full border border-white/10 hover:border-[#00ffcc] transition-colors"
      >
        {isEnabled ? 'Disable' : 'Enable'} Custom Cursor
      </button>
      
      <div 
        ref={cursorRef} 
        className="fixed top-0 left-0 w-6 h-6 bg-[#00ffcc] rounded-full transform -translate-x-1/2 -translate-y-1/2 mix-blend-difference pointer-events-none z-50" 
        style={{ 
          opacity: 0,
          boxShadow: "0 0 10px rgba(0, 255, 204, 0.7)",
        }}
      />
      <div 
        ref={cursorCircleRef} 
        className="fixed top-0 left-0 border-2 border-[#00ffcc] rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50" 
        style={{ 
          opacity: 0,
          width: isHovering ? "60px" : "40px",
          height: isHovering ? "60px" : "40px",
          transition: "width 0.3s, height 0.3s",
        }}
      />
    </>
  );
};

export default CustomCursor; 