"use client";

import { useRef, useEffect, ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScrollEffectProps {
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  duration?: number;
  delay?: number;
  scrub?: boolean;
  className?: string;
}

const ScrollEffect: React.FC<ScrollEffectProps> = ({
  children,
  direction = 'up',
  distance = 50,
  duration = 1,
  delay = 0,
  scrub = false,
  className = '',
}) => {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const element = elementRef.current;
    if (!element) return;

    // Determine starting position based on direction
    const startPosition = () => {
      switch (direction) {
        case 'up': return { y: distance };
        case 'down': return { y: -distance };
        case 'left': return { x: distance };
        case 'right': return { x: -distance };
        default: return { y: distance };
      }
    };

    // Determine ending position based on direction
    const endPosition = () => {
      switch (direction) {
        case 'up': return { y: 0 };
        case 'down': return { y: 0 };
        case 'left': return { x: 0 };
        case 'right': return { x: 0 };
        default: return { y: 0 };
      }
    };

    // Create the animation
    const animation = gsap.fromTo(
      element,
      {
        ...startPosition(),
        opacity: 0,
      },
      {
        ...endPosition(),
        opacity: 1,
        duration: scrub ? 1 : duration, // If scrubbing, duration is controlled by scroll
        delay,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: element,
          start: 'top 80%', // Start when the top of the element hits 80% from the top of the viewport
          end: scrub ? 'top 30%' : 'top 80%', // Only needed for scrub effect
          scrub: scrub ? 1 : false, // Smooth scrubbing effect with 1 second delay
          markers: false, // For debugging: Set to true to see the trigger points
          toggleActions: scrub ? undefined : 'play none none none', // Default behavior if not scrubbing
        },
      }
    );

    // Clean up
    return () => {
      animation.kill();
      if (animation.scrollTrigger) {
        animation.scrollTrigger.kill();
      }
    };
  }, [direction, distance, duration, delay, scrub]);

  return (
    <div ref={elementRef} className={className}>
      {children}
    </div>
  );
};

export default ScrollEffect; 