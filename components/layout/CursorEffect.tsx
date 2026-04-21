'use client';
// components/layout/CursorEffect.tsx
// Minimal premium cursor with single glowing dot

import { useEffect } from 'react';

export default function CursorEffect() {
  useEffect(() => {
    const dot = document.getElementById('cursor-dot');
    
    if (!dot) return;

    // Check if device supports hover (desktop)
    const hasHover = window.matchMedia('(hover: hover)').matches;
    if (!hasHover) {
      // Mobile device - hide custom cursor
      dot.style.display = 'none';
      document.body.style.cursor = 'auto';
      return;
    }

    let mouseX = 0;
    let mouseY = 0;
    let dotX = 0;
    let dotY = 0;

    // Smooth cursor movement with lerp
    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    // Smooth animation loop
    let animId: number;
    const animate = () => {
      // Smooth lerp for dot movement
      const lerpFactor = 0.2;
      dotX += (mouseX - dotX) * lerpFactor;
      dotY += (mouseY - dotY) * lerpFactor;
      
      // Use transform3d for better performance
      dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;
      
      animId = requestAnimationFrame(animate);
    };
    animate();

    // Enhanced hover effects
    const onEnter = (e: Event) => {
      const target = e.target as HTMLElement;
      document.body.classList.add('cursor-hover');
    };

    const onLeave = () => {
      document.body.classList.remove('cursor-hover');
    };

    // Comprehensive selector for all interactive elements
    const interactiveSelector = `
      a, button, input, select, textarea, 
      [role="button"], [role="link"], 
      [tabindex]:not([tabindex="-1"]),
      .drop-zone-area, .format-tag, .nav-pill, 
      .session-badge, .card-badge, .tech-item,
      [onclick], [data-clickable]
    `.trim().replace(/\s+/g, ' ');

    // Attach listeners to existing elements
    const attachListeners = () => {
      document.querySelectorAll(interactiveSelector).forEach(el => {
        el.addEventListener('mouseenter', onEnter);
        el.addEventListener('mouseleave', onLeave);
      });
    };

    // Initial attachment
    attachListeners();

    // Re-attach on DOM changes (for dynamic content)
    const observer = new MutationObserver(() => {
      attachListeners();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Hide cursor when leaving window
    const onMouseLeave = () => {
      dot.style.opacity = '0';
    };

    const onMouseEnter = () => {
      dot.style.opacity = '1';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
      cancelAnimationFrame(animId);
      observer.disconnect();
      
      // Cleanup listeners
      document.querySelectorAll(interactiveSelector).forEach(el => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
      });
    };
  }, []);

  return null;
}
