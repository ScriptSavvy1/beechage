type Tone = "error" | "success";

const tones: Record<Tone, string> = {
  error: "border-red-200 bg-red-50 text-red-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export function AlertBanner({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}
    >
      {children}
    </div>
  );
}
