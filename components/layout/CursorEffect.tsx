'use client';
// components/layout/CursorEffect.tsx
// Premium global cursor with smooth trailing and hover effects

import { useEffect } from 'react';

export default function CursorEffect() {
  useEffect(() => {
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    
    if (!dot || !ring) return;

    let mouseX = 0;
    let mouseY = 0;
    let dotX = 0;
    let dotY = 0;
    let ringX = 0;
    let ringY = 0;
    let isHovering = false;

    // Instant dot movement
    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      // Update dot position immediately
      dot.style.left = `${mouseX}px`;
      dot.style.top = `${mouseY}px`;
    };

    // Smooth ring animation with trailing effect
    let animId: number;
    const animate = () => {
      // Smooth lerp for ring
      const lerpFactor = 0.15;
      ringX += (mouseX - ringX) * lerpFactor;
      ringY += (mouseY - ringY) * lerpFactor;
      
      ring.style.left = `${ringX}px`;
      ring.style.top = `${ringY}px`;
      
      // Add active class when moving
      const distance = Math.hypot(mouseX - ringX, mouseY - ringY);
      if (distance > 1) {
        ring.classList.add('active');
      } else {
        ring.classList.remove('active');
      }
      
      animId = requestAnimationFrame(animate);
    };
    animate();

    // Enhanced hover effects
    const onEnter = (e: Event) => {
      const target = e.target as HTMLElement;
      isHovering = true;
      document.body.classList.add('cursor-hover');
      
      // Extra scale for buttons
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        ring.style.transform = 'translate(-50%, -50%) scale(1.1)';
      }
    };

    const onLeave = () => {
      isHovering = false;
      document.body.classList.remove('cursor-hover');
      ring.style.transform = 'translate(-50%, -50%) scale(1)';
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
      ring.style.opacity = '0';
    };

    const onMouseEnter = () => {
      dot.style.opacity = '1';
      ring.style.opacity = '1';
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
