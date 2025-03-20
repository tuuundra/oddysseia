"use client";

import { useSimpleScroll } from './SimpleScrollyControls';
import { useEffect, useState } from 'react';

export default function ScrollPositionIndicator() {
  const { offset, scroll } = useSimpleScroll();
  const [showRaw, setShowRaw] = useState(false);
  
  // Toggle between percentage and raw values
  const toggleView = () => {
    setShowRaw(prev => !prev);
  };
  
  // Key transition points
  const transitionStartPoint = 0.155;
  const transitionEndPoint = 0.165;
  const dotAppearancePoint = 0.167;
  
  // Calculate transition progress
  const transitionProgress = (() => {
    if (offset <= transitionStartPoint) return 0;
    if (offset >= transitionEndPoint) return 1;
    return (offset - transitionStartPoint) / (transitionEndPoint - transitionStartPoint);
  })();
  
  // Check if we're in transition or at dot appearance
  const isInTransition = offset > transitionStartPoint && offset < transitionEndPoint;
  const isAtDotAppearance = offset >= dotAppearancePoint && offset <= (dotAppearancePoint + 0.01);
  
  // Current scene status
  const currentScene = transitionProgress < 0.5 ? "Original" : "Gradient";
  const transitionPercentage = Math.round(transitionProgress * 100);
  const dotsVisible = offset >= dotAppearancePoint;
  
  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '14px',
        zIndex: 1000,
        userSelect: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}
      onClick={toggleView}
      title="Click to toggle between percentage and raw values"
    >
      <div>
        <strong>Scroll Position:</strong>
      </div>
      <div>
        {showRaw ? (
          <>
            <div>Current: {scroll?.current?.toFixed(0) || 0}px</div>
            <div>Max: {scroll?.max?.toFixed(0) || 0}px</div>
          </>
        ) : (
          <>
            <div>Percentage: {(offset * 100).toFixed(2)}%</div>
            <div>Offset: {offset.toFixed(4)}</div>
          </>
        )}
      </div>
      
      {/* Scene information */}
      <div style={{ marginTop: '4px', fontSize: '12px' }}>
        <div style={{ 
          color: isInTransition ? '#ffcc00' : '#00ff00',
          fontWeight: 'bold'
        }}>
          Active Scene: {currentScene} {isInTransition ? `(FADING ${transitionPercentage}%)` : ''}
        </div>
        <div style={{ 
          color: transitionProgress < 1 ? '#888888' : (isAtDotAppearance ? '#00ccff' : (dotsVisible ? '#00ff00' : '#888888')),
          fontStyle: transitionProgress < 1 ? 'italic' : 'normal'
        }}>
          Dot Grid: {dotsVisible ? (isAtDotAppearance ? 'APPEARING' : 'VISIBLE') : 'HIDDEN'}
        </div>
      </div>
      
      {/* Transition points */}
      <div style={{ marginTop: '4px', fontSize: '10px', color: '#aaaaaa' }}>
        <div>Fade Start: {transitionStartPoint}</div>
        <div>Fade End: {transitionEndPoint}</div>
        <div>Dots Appear: {dotAppearancePoint}</div>
      </div>
    </div>
  );
} 