import { useEffect, useState } from 'react';

type Orientation = 'portrait' | 'landscape';

function getOrientation(): Orientation {
  if (typeof window === 'undefined') {
    return 'landscape';
  }

  if (window.screen?.orientation?.type) {
    return window.screen.orientation.type.startsWith('landscape') ? 'landscape' : 'portrait';
  }

  const mediaQuery = window.matchMedia?.('(orientation: landscape)');
  if (mediaQuery) {
    return mediaQuery.matches ? 'landscape' : 'portrait';
  }

  return window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
}

export function useOrientation() {
  const [orientation, setOrientation] = useState<Orientation>(getOrientation);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleChange = () => setOrientation(getOrientation());

    const mediaQuery = window.matchMedia?.('(orientation: landscape)');

    if (mediaQuery) {
      const listener = (event: MediaQueryListEvent) => setOrientation(event.matches ? 'landscape' : 'portrait');
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
      } else {
        // Safari < 14 fallback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mediaQuery as any).addListener(listener);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', listener);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mediaQuery as any).removeListener(listener);
        }
      };
    }

    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);

    return () => {
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
  }, []);

  return {
    isLandscape: orientation === 'landscape',
    orientation,
  };
}
