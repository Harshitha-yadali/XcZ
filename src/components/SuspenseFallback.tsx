export function SuspenseFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-dark-900 via-surface-sunken to-surface-deepest flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    </div>
  );
}
