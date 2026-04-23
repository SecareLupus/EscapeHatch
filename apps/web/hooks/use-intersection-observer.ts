"use client";

import { useEffect, useState, useRef, RefObject } from "react";

interface UseIntersectionObserverProps {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

export function useIntersectionObserver<T extends HTMLElement>(
  options: UseIntersectionObserverProps = {}
): [RefObject<T>, boolean] {
  const { threshold = 0, rootMargin = "1000px", enabled = true } = options;
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    // Try to find the closest scrollable parent to use as root
    // This is often needed in complex chat layouts
    let root: HTMLElement | null = null;
    let parent = ref.current.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        root = parent;
        break;
      }
      parent = parent.parentElement;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // More robust check: intersectRatio > 0 OR isIntersecting
        const visible = (entry?.isIntersecting || (entry?.intersectionRatio ?? 0) > 0);
        setIsVisible(visible);
      },
      { 
        root, // Pass the detected scroll container
        threshold: [0, 0.01], 
        rootMargin 
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, enabled]);

  return [ref, isVisible];
}
