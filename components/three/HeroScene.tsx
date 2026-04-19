'use client';
// components/three/HeroScene.tsx
// Dynamic Earth/Moon scene based on theme - Earth for dark mode, Moon for light mode

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useTheme } from '@/components/theme/ThemeProvider';

interface HeroSceneProps {
  isCompressing?: boolean;
  progress?: number; // 0-100
}

export default function HeroScene({ isCompressing = false, progress = 0 }: HeroSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    animId: number;
  } | null>(null);

  const { theme, mounted } = useTheme();
  const isCompressingRef = useRef(isCompressing);
  const progressRef = useRef(progress);
  const isMountedRef = useRef(true);
  const currentThemeRef = useRef(theme);

  useEffect(() => {
    isCompressingRef.current = isCompressing;
    progressRef.current = progress;
  }, [isCompressing, progress]);

  useEffect(() => {
    currentThemeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    if (!mountRef.current || !mounted) return;
    const el = mountRef.current;
    isMountedRef.current = true;

    // Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.z = 8;

    // ─── Lighting (Dynamic based on theme) ────────────────────────────────────
    const isDarkMode = currentThemeRef.current === 'dark';
    
    const ambientLight = new THREE.AmbientLight(0xffffff, isDarkMode ? 0.3 : 0.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, isDarkMode ? 1.2 : 0.8);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    const rimLight = new THREE.DirectionalLight(
      isDarkMode ? 0x00ffb3 : 0x4a90e2, 
      isDarkMode ? 0.6 : 0.4
    );
    rimLight.position.set(-5, 0, -5);
    scene.add(rimLight);

    // ─── Celestial Body (Earth or Moon based on theme) ────────────────────────
    const celestialGeometry = new THREE.SphereGeometry(2, 64, 64);
    
    // Create Earth texture (for dark mode)
    const createEarthTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;

      // Base ocean color
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#1a4d6d');
      gradient.addColorStop(0.5, '#0d3a52');
      gradient.addColorStop(1, '#1a4d6d');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add continents (simplified procedural)
      ctx.fillStyle = '#2d5a3d';
      ctx.globalAlpha = 0.9;

      // North America
      ctx.beginPath();
      ctx.ellipse(300, 300, 180, 220, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // South America
      ctx.beginPath();
      ctx.ellipse(400, 650, 120, 200, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Europe/Africa
      ctx.beginPath();
      ctx.ellipse(1050, 400, 200, 280, 0, 0, Math.PI * 2);
      ctx.fill();

      // Asia
      ctx.beginPath();
      ctx.ellipse(1500, 350, 280, 240, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Australia
      ctx.beginPath();
      ctx.ellipse(1650, 700, 140, 100, 0, 0, Math.PI * 2);
      ctx.fill();

      // Add texture detail
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 8000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 3;
        ctx.fillStyle = Math.random() > 0.5 ? '#4a7c59' : '#1a3d4d';
        ctx.fillRect(x, y, size, size);
      }

      // Ice caps
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#e8f4f8';
      ctx.fillRect(0, 0, canvas.width, 80);
      ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

      return new THREE.CanvasTexture(canvas);
    };

    // Create Moon texture (for light mode) - PREMIUM PHOTOREALISTIC VERSION
    const createMoonTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 4096; // Higher resolution for detail
      canvas.height = 2048;
      const ctx = canvas.getContext('2d')!;

      // Base moon surface with realistic gradient
      const baseGradient = ctx.createRadialGradient(
        canvas.width * 0.5, canvas.height * 0.5, 0,
        canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.6
      );
      baseGradient.addColorStop(0, '#f5f5f5'); // Bright center
      baseGradient.addColorStop(0.4, '#e8e8e8');
      baseGradient.addColorStop(0.7, '#d0d0d0');
      baseGradient.addColorStop(1, '#a8a8a8'); // Darker edges
      ctx.fillStyle = baseGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add realistic maria (dark seas) - based on actual lunar features
      const maria = [
        // Mare Imbrium (Sea of Rains) - large, upper left
        { x: 0.25, y: 0.3, w: 0.22, h: 0.18, rotation: -0.2, darkness: 0.45 },
        // Mare Serenitatis (Sea of Serenity) - upper right of center
        { x: 0.48, y: 0.28, w: 0.15, h: 0.14, rotation: 0.1, darkness: 0.42 },
        // Mare Tranquillitatis (Sea of Tranquility) - center right
        { x: 0.52, y: 0.42, w: 0.18, h: 0.16, rotation: 0.15, darkness: 0.40 },
        // Mare Crisium (Sea of Crises) - far right
        { x: 0.75, y: 0.35, w: 0.12, h: 0.10, rotation: 0.3, darkness: 0.48 },
        // Mare Nectaris (Sea of Nectar) - lower center-right
        { x: 0.55, y: 0.58, w: 0.10, h: 0.12, rotation: -0.1, darkness: 0.38 },
        // Mare Fecunditatis (Sea of Fertility) - right side
        { x: 0.68, y: 0.50, w: 0.14, h: 0.13, rotation: 0.2, darkness: 0.40 },
        // Oceanus Procellarum (Ocean of Storms) - large left side
        { x: 0.18, y: 0.50, w: 0.28, h: 0.35, rotation: -0.15, darkness: 0.43 },
        // Mare Nubium (Sea of Clouds) - lower left
        { x: 0.32, y: 0.62, w: 0.13, h: 0.12, rotation: 0, darkness: 0.41 },
        // Mare Humorum (Sea of Moisture) - lower left
        { x: 0.22, y: 0.68, w: 0.10, h: 0.10, rotation: 0, darkness: 0.39 }
      ];

      maria.forEach(mare => {
        ctx.save();
        const centerX = canvas.width * mare.x;
        const centerY = canvas.height * mare.y;
        const radiusX = canvas.width * mare.w;
        const radiusY = canvas.height * mare.h;

        ctx.translate(centerX, centerY);
        ctx.rotate(mare.rotation);

        // Create irregular mare shape with multiple overlapping ellipses
        for (let i = 0; i < 5; i++) {
          const offsetX = (Math.random() - 0.5) * radiusX * 0.3;
          const offsetY = (Math.random() - 0.5) * radiusY * 0.3;
          const scaleX = 0.8 + Math.random() * 0.4;
          const scaleY = 0.8 + Math.random() * 0.4;

          const mareGradient = ctx.createRadialGradient(
            offsetX, offsetY, 0,
            offsetX, offsetY, radiusX * scaleX
          );
          mareGradient.addColorStop(0, `rgba(60, 60, 60, ${mare.darkness})`);
          mareGradient.addColorStop(0.7, `rgba(80, 80, 80, ${mare.darkness * 0.7})`);
          mareGradient.addColorStop(1, `rgba(100, 100, 100, 0)`);

          ctx.fillStyle = mareGradient;
          ctx.beginPath();
          ctx.ellipse(offsetX, offsetY, radiusX * scaleX, radiusY * scaleY, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // Add thousands of realistic craters with proper physics
      const addCrater = (x: number, y: number, radius: number, depth: number) => {
        // Crater floor (dark)
        const floorGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.8);
        floorGradient.addColorStop(0, `rgba(40, 40, 40, ${depth * 0.6})`);
        floorGradient.addColorStop(0.5, `rgba(60, 60, 60, ${depth * 0.5})`);
        floorGradient.addColorStop(1, `rgba(80, 80, 80, ${depth * 0.3})`);
        ctx.fillStyle = floorGradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Crater walls (shadow on one side, highlight on other)
        const shadowGradient = ctx.createRadialGradient(
          x + radius * 0.2, y + radius * 0.2, 0,
          x + radius * 0.2, y + radius * 0.2, radius
        );
        shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        shadowGradient.addColorStop(0.6, `rgba(0, 0, 0, ${depth * 0.4})`);
        shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadowGradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Crater rim highlight
        ctx.strokeStyle = `rgba(255, 255, 255, ${depth * 0.3})`;
        ctx.lineWidth = Math.max(1, radius * 0.08);
        ctx.beginPath();
        ctx.arc(x - radius * 0.15, y - radius * 0.15, radius * 0.95, 0, Math.PI * 2);
        ctx.stroke();

        // Central peak for larger craters
        if (radius > 30) {
          const peakGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.2);
          peakGradient.addColorStop(0, `rgba(255, 255, 255, ${depth * 0.4})`);
          peakGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = peakGradient;
          ctx.beginPath();
          ctx.arc(x, y, radius * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      // Major craters (Tycho, Copernicus, etc.)
      const majorCraters = [
        { x: 0.35, y: 0.72, radius: 85, depth: 0.9, name: 'Tycho' },
        { x: 0.28, y: 0.42, radius: 95, depth: 0.85, name: 'Copernicus' },
        { x: 0.42, y: 0.35, radius: 75, depth: 0.8, name: 'Plato' },
        { x: 0.58, y: 0.28, radius: 70, depth: 0.75, name: 'Aristoteles' },
        { x: 0.48, y: 0.52, radius: 65, depth: 0.8, name: 'Ptolemaeus' },
        { x: 0.38, y: 0.58, radius: 60, depth: 0.78, name: 'Alphonsus' },
        { x: 0.62, y: 0.45, radius: 68, depth: 0.82, name: 'Theophilus' },
        { x: 0.72, y: 0.38, radius: 55, depth: 0.76, name: 'Langrenus' }
      ];

      majorCraters.forEach(crater => {
        addCrater(
          canvas.width * crater.x,
          canvas.height * crater.y,
          crater.radius,
          crater.depth
        );

        // Add ray system for Tycho
        if (crater.name === 'Tycho') {
          ctx.globalAlpha = 0.15;
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const rayLength = 400 + Math.random() * 200;
            const rayWidth = 8 + Math.random() * 6;
            
            ctx.strokeStyle = '#f0f0f0';
            ctx.lineWidth = rayWidth;
            ctx.beginPath();
            ctx.moveTo(canvas.width * crater.x, canvas.height * crater.y);
            ctx.lineTo(
              canvas.width * crater.x + Math.cos(angle) * rayLength,
              canvas.height * crater.y + Math.sin(angle) * rayLength
            );
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      });

      // Medium craters (hundreds)
      for (let i = 0; i < 300; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = 15 + Math.random() * 40;
        const depth = 0.5 + Math.random() * 0.4;
        addCrater(x, y, radius, depth);
      }

      // Small craters (thousands for realism)
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 3000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = 2 + Math.random() * 12;
        const depth = 0.3 + Math.random() * 0.3;
        addCrater(x, y, radius, depth);
      }
      ctx.globalAlpha = 1;

      // Micro-craters and surface texture (ultra-fine detail)
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 25000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 3;
        const brightness = Math.random();
        ctx.fillStyle = brightness > 0.5 ? '#ffffff' : '#808080';
        ctx.fillRect(x, y, size, size);
      }
      ctx.globalAlpha = 1;

      // Add subtle color variations (lunar highlands vs lowlands)
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = 50 + Math.random() * 150;
        const hue = Math.random() > 0.5 ? 30 : 200; // Warm or cool tones
        
        const colorGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        colorGradient.addColorStop(0, `hsla(${hue}, 10%, 70%, 0.3)`);
        colorGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = colorGradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Earthshine effect (subtle blue glow on left edge)
      ctx.globalAlpha = 0.06;
      const earthshineGradient = ctx.createLinearGradient(0, 0, canvas.width * 0.25, 0);
      earthshineGradient.addColorStop(0, '#6ba3d4');
      earthshineGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = earthshineGradient;
      ctx.fillRect(0, 0, canvas.width * 0.25, canvas.height);
      ctx.globalAlpha = 1;

      return new THREE.CanvasTexture(canvas);
    };

    const celestialTexture = isDarkMode ? createEarthTexture() : createMoonTexture();
    celestialTexture.needsUpdate = true;

    const celestialMaterial = new THREE.MeshPhongMaterial({
      map: celestialTexture,
      bumpMap: celestialTexture, // Use same texture for bump mapping
      bumpScale: isDarkMode ? 0.05 : 0.25, // Much more pronounced bumps for photorealistic moon
      specular: new THREE.Color(isDarkMode ? 0x333333 : 0x050505),
      shininess: isDarkMode ? 8 : 1, // Very matte moon surface
      emissive: new THREE.Color(isDarkMode ? 0x000000 : 0x0a0a0a), // Slight self-illumination for moon
      emissiveIntensity: isDarkMode ? 0 : 0.05,
    });

    const celestialBody = new THREE.Mesh(celestialGeometry, celestialMaterial);
    scene.add(celestialBody);

    // ─── Atmosphere/Glow (Different for Earth vs Moon) ────────────────────────
    let atmosphere: THREE.Mesh | null = null;
    
    if (isDarkMode) {
      // Earth atmosphere glow
      const atmosphereGeometry = new THREE.SphereGeometry(2.15, 64, 64);
      const atmosphereMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            gl_FragColor = vec4(0.0, 1.0, 0.7, 1.0) * intensity;
          }
        `,
      });
      atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
      scene.add(atmosphere);
    } else {
      // Moon photorealistic glow (bright atmospheric halo)
      const moonGlowGeometry = new THREE.SphereGeometry(2.12, 64, 64);
      const moonGlowMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
            // Bright white-blue glow for photorealistic moon
            gl_FragColor = vec4(0.95, 0.97, 1.0, 0.6) * intensity;
          }
        `,
      });
      atmosphere = new THREE.Mesh(moonGlowGeometry, moonGlowMaterial);
      scene.add(atmosphere);
      
      // Add secondary outer glow for depth
      const outerGlowGeometry = new THREE.SphereGeometry(2.25, 64, 64);
      const outerGlowMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.5 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
            // Softer outer glow
            gl_FragColor = vec4(0.85, 0.88, 0.95, 0.25) * intensity;
          }
        `,
      });
      const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
      scene.add(outerGlow);
    }

    // ─── Stars (More prominent in light mode for night sky effect) ─────────────
    const starCount = isDarkMode ? 1500 : 2500; // More stars for moon scene
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 30;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
      
      const color = new THREE.Color();
      if (isDarkMode) {
        // Colorful stars for Earth scene
        color.setHSL(Math.random() * 0.2 + 0.5, 0.3, 0.8);
      } else {
        // Brighter, more white/blue stars for night sky
        const temp = Math.random();
        if (temp < 0.7) {
          color.setHSL(0.6, 0.1, 0.9); // White stars
        } else if (temp < 0.9) {
          color.setHSL(0.65, 0.3, 0.85); // Blue-white stars
        } else {
          color.setHSL(0.1, 0.4, 0.8); // Warm stars
        }
      }
      starColors[i * 3] = color.r;
      starColors[i * 3 + 1] = color.g;
      starColors[i * 3 + 2] = color.b;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: isDarkMode ? 0.05 : 0.08, // Larger stars for night sky
      vertexColors: true,
      transparent: true,
      opacity: isDarkMode ? 0.7 : 0.9, // Brighter stars for moon scene
      sizeAttenuation: true,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // ─── Orbital Ring (Progress Indicator - themed) ───────────────────────────
    const ringGeometry = new THREE.TorusGeometry(3.2, 0.02, 16, 100);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: isDarkMode ? 0x00ffb3 : 0x4a90e2, // Cyan for Earth, Blue for Moon
      transparent: true,
      opacity: 0.3,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2.2;
    scene.add(ring);

    // ─── Mouse Parallax ────────────────────────────────────────────────────────
    let mouseX = 0, mouseY = 0;
    const handleMouse = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouse);

    // ─── Resize ────────────────────────────────────────────────────────────────
    const handleResize = () => {
      if (!el || !isMountedRef.current) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ─── Animation ─────────────────────────────────────────────────────────────
    let t = 0;
    let animId = 0;

    function animate() {
      if (!isMountedRef.current || !sceneRef.current) return;

      animId = requestAnimationFrame(animate);
      if (sceneRef.current) {
        sceneRef.current.animId = animId;
      }

      t += 0.005;

      const compressing = isCompressingRef.current;
      const currentTheme = currentThemeRef.current;
      const isDark = currentTheme === 'dark';
      const speed = compressing ? 2.0 : 1.0;

      // Celestial body rotation (slower for moon to show surface detail)
      const rotationSpeed = isDark ? 0.002 : 0.001; // Moon rotates slower
      celestialBody.rotation.y += rotationSpeed * speed;
      celestialBody.rotation.x = Math.sin(t * 0.3) * 0.05;

      // Atmosphere/glow effects
      if (atmosphere) {
        atmosphere.rotation.y = celestialBody.rotation.y;
        if (isDark) {
          // Earth atmosphere pulse
          const atmosphereScale = 1 + Math.sin(t * 2) * 0.01;
          atmosphere.scale.setScalar(atmosphereScale);
        } else {
          // Moon glow subtle variation
          const moonGlowScale = 1 + Math.sin(t * 1.5) * 0.005;
          atmosphere.scale.setScalar(moonGlowScale);
        }
      }

      // Ring rotation and effects
      ring.rotation.z += 0.003 * speed;
      if (compressing) {
        ringMaterial.opacity = 0.5 + Math.sin(t * 8) * 0.2;
      } else {
        ringMaterial.opacity = 0.3;
      }

      // Stars animation (more dynamic for night sky)
      if (isDark) {
        // Gentle drift for Earth scene
        stars.rotation.y = t * 0.01;
        stars.rotation.x = Math.sin(t * 0.2) * 0.02;
      } else {
        // More prominent twinkling for night sky
        stars.rotation.y = t * 0.008;
        stars.rotation.x = Math.sin(t * 0.15) * 0.03;
        // Add subtle twinkling effect
        starMaterial.opacity = 0.9 + Math.sin(t * 3) * 0.1;
      }

      // Camera parallax
      camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.05;
      camera.position.y += (mouseY * 0.4 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      // Lighting effects when compressing
      if (compressing) {
        rimLight.intensity = (isDark ? 0.6 : 0.4) + Math.sin(t * 6) * 0.3;
      } else {
        rimLight.intensity = isDark ? 0.6 : 0.4;
      }

      renderer.render(scene, camera);
    }

    // Initialize sceneRef BEFORE starting animation
    sceneRef.current = { renderer, scene, camera, animId: 0 };
    animate();

    return () => {
      isMountedRef.current = false;

      // Cancel animation frame
      if (sceneRef.current?.animId) {
        cancelAnimationFrame(sceneRef.current.animId);
      }
      if (animId) {
        cancelAnimationFrame(animId);
      }

      // Remove event listeners
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('resize', handleResize);

      // Dispose geometries
      celestialGeometry.dispose();
      if (atmosphere) {
        atmosphere.geometry.dispose();
        (atmosphere.material as THREE.Material).dispose();
      }
      starGeometry.dispose();
      ringGeometry.dispose();

      // Dispose materials
      celestialMaterial.dispose();
      starMaterial.dispose();
      ringMaterial.dispose();

      // Dispose textures
      celestialTexture.dispose();

      // Dispose renderer
      renderer.dispose();
      renderer.forceContextLoss();

      // Remove DOM element
      if (el && renderer.domElement && el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }

      // Clear scene ref
      sceneRef.current = null;
    };
  }, [theme, mounted]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
    />
  );
}
