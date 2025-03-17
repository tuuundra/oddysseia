"use client";

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface AnimatedContentProps {
  children: React.ReactNode;
}

const AnimatedContent: React.FC<AnimatedContentProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Skip animation on server
    if (typeof window === 'undefined') return;

    const container = containerRef.current;
    if (!container) return;

    // Initial page load animation
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    
    // Header animation
    tl.fromTo(
      'header',
      { y: -50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      0
    );
    
    // Main content animation
    tl.fromTo(
      'main > div',
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      0.2
    );
    
    // Footer animation
    tl.fromTo(
      'footer',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      0.4
    );
    
    // Button animation
    tl.fromTo(
      'button',
      { scale: 0.8, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' },
      0.5
    );

    // Setup scroll animations
    const elements = container.querySelectorAll('.animate-on-scroll');
    
    elements.forEach(element => {
      gsap.fromTo(
        element,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          scrollTrigger: {
            trigger: element,
            start: 'top 80%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // Clean up
    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return (
    <div ref={containerRef}>
      {children}
    </div>
  );
};

export default AnimatedContent; 