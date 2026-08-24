import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      if (Notification.permission === 'granted') {
        setIsSubscribed(true);
      }
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }

    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === 'granted') {
        setIsSubscribed(true);
        const browserHint = navigator.userAgent.includes('Android')
          ? 'android'
          : navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')
          ? 'ios'
          : 'desktop';

        const deviceEndpoint = 'browser-' + Math.random().toString(36).substring(2, 10);

        await supabase.from('push_subscriptions').upsert(
          {
            user_id: 'admin',
            endpoint: deviceEndpoint,
            device_hint: browserHint,
          },
          { onConflict: 'user_id,endpoint' }
        );

        // Show welcome notification
        try {
          new Notification('💡 SCEAS Smart Energy Alert', {
            body: 'Notifikasi penjimatan tenaga dan kawalan lampu diaktifkan dengan jayanya!',
            icon: '/favicon.ico',
          });
        } catch (e) {
          console.log('Notification trigger info:', e);
        }
      }
      return res;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return 'denied';
    }
  }, []);

  const sendBrowserNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });
      } catch (e) {
        console.warn('Browser notification error:', e);
      }
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    requestPermission,
    sendBrowserNotification,
  };
}
