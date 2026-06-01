// Shared "preparing questions" loader — animated brain (no dice).
export function BrainLoader({ label = "Preparing Questions" }: { label?: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5">
      <div className="relative h-32 w-32 flex items-center justify-center">
        {/* Glow */}
        <span className="absolute inset-0 rounded-full bg-primary/30 blur-3xl animate-pulse" />
        {/* Orbiting synapse dots */}
        <span className="absolute inset-0 animate-spin [animation-duration:5s]">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-pink-500 shadow-glow" />
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-violet-500 shadow-glow" />
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-glow" />
          <span className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-amber-500 shadow-glow" />
        </span>
        {/* Brain SVG */}
        <svg
          viewBox="0 0 64 64"
          className="relative h-20 w-20 text-primary drop-shadow-lg animate-bounce [animation-duration:1.6s]"
          aria-hidden
        >
          <defs>
            <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(330 90% 60%)" />
              <stop offset="50%" stopColor="hsl(280 85% 60%)" />
              <stop offset="100%" stopColor="hsl(220 90% 60%)" />
            </linearGradient>
          </defs>
          <path
            fill="url(#brainGrad)"
            d="M22 8c-5 0-9 4-9 9 0 1 .1 2 .4 3-3 1.4-5.4 4.5-5.4 8.1 0 2.7 1.3 5.1 3.3 6.6-.2.7-.3 1.4-.3 2.2 0 4.4 3.6 8 8 8 .8 0 1.5-.1 2.2-.3C22.4 48.5 25 51 28.4 51c2.2 0 4-1 5.1-2.6 1.1 1.6 3 2.6 5.1 2.6 3.4 0 6-2.5 7.2-6.4.7.2 1.4.3 2.2.3 4.4 0 8-3.6 8-8 0-.8-.1-1.5-.3-2.2 2-1.5 3.3-3.9 3.3-6.6 0-3.6-2.4-6.7-5.4-8.1.3-1 .4-2 .4-3 0-5-4-9-9-9-2.6 0-5 1.1-6.6 3C36.5 9.3 34.3 8 32 8c-2.3 0-4.5 1.3-5.4 3C25 9.1 22.6 8 22 8z"
          />
          <path
            d="M32 14v36M22 20c2 2 4 3 6 3M42 20c-2 2-4 3-6 3M20 32h6M38 32h6M22 42c2-2 4-3 6-3M42 42c-2-2-4-3-6-3"
            stroke="white"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />
        </svg>
      </div>
      <div className="flex items-center gap-1 text-primary">
        <p className="font-bold text-lg">{label}</p>
        <span className="inline-flex gap-0.5 font-bold text-xl">
          <span className="animate-bounce [animation-delay:0ms]">.</span>
          <span className="animate-bounce [animation-delay:150ms]">.</span>
          <span className="animate-bounce [animation-delay:300ms]">.</span>
        </span>
      </div>
    </div>
  );
}
