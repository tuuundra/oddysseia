"use client";

import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

// A simple scroll-based 3D scene wrapper that doesn't use ScrollControls
// Instead, directly listens to window scroll events and passes the scroll position to children
const SimpleScrollySceneWrapper = ({ children }) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollContainerRef = useRef(null);
  
  // Set up scroll listener
  useEffect(() => {
    // Function to handle scroll events
    const handleScroll = () => {
      // Calculate scroll progress as a value between 0 and 1
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY;
      const progress = Math.min(Math.max(currentScroll / scrollHeight, 0), 1);
      
      // Update state
      setScrollProgress(progress);
    };
    
    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Trigger initial calculation
    handleScroll();
    
    // Clean up
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // Object to pass to children with scroll information
  const scrollData = {
    offset: scrollProgress,
    scroll: {
      current: window.scrollY,
      max: document.documentElement.scrollHeight - window.innerHeight,
      progress: scrollProgress,
    }
  };
  
  // Pass scroll data to children function or just render children
  return (
    <>
      {children instanceof Function 
        ? children(scrollData) 
        : children}
    </>
  );
};

export default SimpleScrollySceneWrapper; 