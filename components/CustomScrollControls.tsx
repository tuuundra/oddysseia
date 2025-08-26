import { ReactNode, useState, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { ScrollControls, useScroll } from '@react-three/drei';

// A wrapper for ScrollControls that prevents multiple React roots
interface CustomScrollControlsProps {
  children: ReactNode;
  pages: number;
  damping?: number;
  distance?: number;
}

// Use this component as a direct replacement for ScrollControls, it provides stable lifecycle
export function CustomScrollControls({ children, pages, damping = 0.25, distance = 1 }: CustomScrollControlsProps) {
  // Generate a stable ID that won't change during hot reloading
  const stableId = useMemo(() => `scroll-controls-${Math.random().toString(36).substring(2, 9)}`, []);
  
  // Add flags to control first mount
  const firstMount = useMemo(() => true, []);
  
  // We need to wrap in useMemo to prevent recreation during hot module reloading
  const scrollControls = useMemo(() => (
    <ScrollControls 
      pages={pages} 
      damping={damping} 
      distance={distance}
      eps={0.00001}
      enabled={true}
      infinite={false}
    >
      {children}
    </ScrollControls>
  ), [pages, damping, distance, children, stableId]);
  
  return scrollControls;
} 