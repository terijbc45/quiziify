import { useEffect } from "react";
import { SlideToStop } from "./SlideToStop";

export function AlarmOverlay({
  reminder,
  onDismiss,
}: {
  reminder: { title: string; body: string | null; thumbnail_url: string | null };
  onDismiss: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-hero flex flex-col items-center justify-between p-8 animate-slide-in">
      <div className="w-full text-center text-white/90 text-sm font-medium tracking-widest uppercase mt-4">
        Reminder
      </div>

      <div className="flex flex-col items-center gap-6 max-w-lg text-center">
        {reminder.thumbnail_url && (
          <img
            src={reminder.thumbnail_url}
            alt=""
            className="w-48 h-48 rounded-3xl object-cover shadow-glow animate-pulse-glow"
          />
        )}
        <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg">
          {reminder.title}
        </h1>
        {reminder.body && (
          <p className="text-xl text-white/90 leading-relaxed">{reminder.body}</p>
        )}
      </div>

      <div className="w-full flex justify-center pb-8">
        <SlideToStop onConfirm={onDismiss} />
      </div>
    </div>
  );
}
