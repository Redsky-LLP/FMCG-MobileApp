// PATH: src/components/SessionWarningToast.tsx
// Optional - Shows a warning 1 minute before session expires

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

export function SessionWarningToast() {
  const [show, setShow] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    const handleWarning = () => {
      setShow(true);
      setSecondsLeft(60);
      
      // Countdown
      const interval = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setShow(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    };

    // Listen for session warning event
    window.addEventListener('session-warning', handleWarning);
    
    return () => {
      window.removeEventListener('session-warning', handleWarning);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        right: 16,
        zIndex: 9999,
        background: '#1e293b',
        border: '1px solid #ea580c',
        borderRadius: 12,
        padding: '14px 18px',
        maxWidth: 340,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slide-up 0.3s ease',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(234,88,12,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={16} color="#ea580c" />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
          Session expiring soon
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
          <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
          {secondsLeft} second{secondsLeft > 1 ? 's' : ''} left
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
          Move mouse or tap screen to stay logged in
        </p>
      </div>
    </div>
  );
}