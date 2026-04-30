import { useEffect } from "react";
import { SlideToStop } from "./SlideToStop";
import { playAlarm, stopAlarm } from "@/lib/alarm-sound";

export function AlarmOverlay({
  reminder,
  onDismiss,
}: {
  reminder: { title: string; body: string | null; thumbnail_url: string | null };
  onDismiss: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    playAlarm();
    return () => {
      document.body.style.overflow = "";
      stopAlarm();
    };
  }, []);

  const dismiss = () => {
    stopAlarm();
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-[100] animate-slide-in">
      {/* Background — thumbnail covers ENTIRE screen with no other color showing */}
      {reminder.thumbnail_url ? (
        <img
          src={reminder.thumbnail_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-hero" />
      )}

      {/* Dark gradient overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      {/* Content */}
      <div className="relative z-10 h-full w-full flex flex-col items-center justify-between p-6 sm:p-8">
        <div className="w-full text-center text-white/95 text-sm font-bold tracking-widest uppercase mt-4 drop-shadow-lg">
          🔔 Reminder
        </div>

        <div className="flex flex-col items-center gap-4 max-w-2xl text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-2xl animate-pulse-glow">
            {reminder.title}
          </h1>
          {reminder.body && (
            <p className="text-lg md:text-2xl text-white/95 leading-relaxed drop-shadow-lg">{reminder.body}</p>
          )}
        </div>

        <div className="w-full flex justify-center pb-4">
          <SlideToStop onConfirm={dismiss} />
        </div>
      </div>
    </div>
  );
}
