import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [hasShownPrompt, setHasShownPrompt] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isServiceHealthy, setIsServiceHealthy] = useState(true);

  // Check if app is already installed
  useEffect(() => {
    const checkInstalled = () => {
      // Check if running as PWA
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkInstalled();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleBeforeInstallPrompt = useCallback((e: Event) => {
    e.preventDefault();
    const event = e as BeforeInstallPromptEvent;
    setDeferredPrompt(event);
    console.log('[PWA] beforeinstallprompt event captured');
  }, []);

  const handleAppInstalled = useCallback(() => {
    console.log('[PWA] App installed successfully');
    setIsInstalled(true);
    setShowInstallPrompt(false);
    setDeferredPrompt(null);
  }, []);

  // Show install prompt after 15 seconds or on user interaction
  const triggerInstallPrompt = useCallback(() => {
    if (!hasShownPrompt && deferredPrompt && isServiceHealthy) {
      setShowInstallPrompt(true);
      setHasShownPrompt(true);
      // Clear timeout if it exists
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, [deferredPrompt, hasShownPrompt, timeoutId, isServiceHealthy]);

  // Set up 15-second timer (but delay if service is unhealthy)
  useEffect(() => {
    if (!hasShownPrompt && deferredPrompt) {
      // If service is unhealthy, delay the timer
      const delay = isServiceHealthy ? 15000 : 30000; // 30 seconds if unhealthy
      
      const id = setTimeout(() => {
        triggerInstallPrompt();
      }, delay);

      setTimeoutId(id);

      return () => clearTimeout(id);
    }
  }, [deferredPrompt, hasShownPrompt, triggerInstallPrompt, isServiceHealthy]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] User response: ${outcome}`);

      if (outcome === 'accepted') {
        setIsInstalled(true);
      }

      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    } catch (error) {
      console.error('[PWA] Install error:', error);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowInstallPrompt(false);
  }, []);

  // Report service health status
  const reportServiceHealth = useCallback((isHealthy: boolean) => {
    setIsServiceHealthy(isHealthy);
    if (!isHealthy) {
      console.warn('[PWA] Service health degraded - delaying install prompt');
    }
  }, []);

  return {
    showInstallPrompt,
    isInstalled,
    canInstall: !!deferredPrompt && !isInstalled,
    handleInstall,
    handleDismiss,
    triggerInstallPrompt,
    reportServiceHealth,
    isServiceHealthy,
  };
}
