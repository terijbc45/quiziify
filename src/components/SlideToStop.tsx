import { useRef, useState, type PointerEvent } from "react";
import { ChevronRight } from "lucide-react";

export function SlideToStop({ onConfirm }: { onConfirm: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);

  const handleDown = (e: PointerEvent) => {
    setDragging(true);
    startX.current = e.clientX;
    startOffset.current = x;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handleMove = (e: PointerEvent) => {
    if (!dragging || !trackRef.current) return;
    const max = trackRef.current.clientWidth - 64;
    const next = Math.max(0, Math.min(max, startOffset.current + (e.clientX - startX.current)));
    setX(next);
    if (next >= max - 4) {
      setDragging(false);
      onConfirm();
    }
  };
  const handleUp = () => {
    setDragging(false);
    setX(0);
  };

  return (
    <div ref={trackRef} className="relative h-16 w-full max-w-sm rounded-full bg-white/15 backdrop-blur overflow-hidden select-none">
      <div className="absolute inset-0 flex items-center justify-center text-white/80 font-medium pointer-events-none">
        Slide to stop
      </div>
      <div
        className="absolute top-1 left-1 h-14 w-14 rounded-full bg-white shadow-glow flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        style={{ transform: `translateX(${x}px)`, transition: dragging ? "none" : "transform 0.2s" }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        <ChevronRight className="h-6 w-6 text-primary" />
      </div>
    </div>
  );
}
