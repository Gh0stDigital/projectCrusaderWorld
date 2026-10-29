import { useLayoutEffect, useRef } from 'react';

interface FitTextProps {
  text: string;
  className?: string;
  /** Starting font size in canvas pixels; shrinks a pixel at a time until the text fits its box. */
  size: number;
  min?: number;
}

/** One line of text that shrinks to fit its box instead of overflowing. */
export function FitText({ text, className, size, min = 6 }: FitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let px = size;
    el.style.fontSize = `${px}px`;
    while (px > min && el.scrollWidth > el.clientWidth) {
      px -= 1;
      el.style.fontSize = `${px}px`;
    }
  }, [text, size, min]);
  return (
    <span ref={ref} className={className} style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {text}
    </span>
  );
}
