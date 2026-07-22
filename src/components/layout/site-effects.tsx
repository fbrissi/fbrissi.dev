'use client';

import { useEffect } from 'react';

export function SiteEffects() {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function activateAt(clientX: number, clientY: number) {
      const x = (clientX / window.innerWidth) * 100;
      const y = (clientY / window.innerHeight) * 100;
      document.body.style.setProperty('--mouse-x', `${x}%`);
      document.body.style.setProperty('--mouse-y', `${y}%`);
      document.body.classList.add('mouse-active');
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => document.body.classList.remove('mouse-active'), 3000);
    }

    const handleMouseMove = (event: MouseEvent) => activateAt(event.clientX, event.clientY);
    const handleTouch = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) activateAt(touch.clientX, touch.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
      clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
