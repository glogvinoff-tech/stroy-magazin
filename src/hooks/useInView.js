import { useEffect, useState } from 'react';

export function useInView(ref, options = {}) {
  const { root = null, rootMargin = '0px 0px -10% 0px', threshold = 0.12, once = true } = options;
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    if (inView && once) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) obs.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { root, rootMargin, threshold },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, once, ref, root, rootMargin, threshold]);

  return inView;
}

