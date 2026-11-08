import { cn } from '@/lib/cn';

export function PkBadge({ className }: { className?: string }) {
  return (
    <span
      title="Partner"
      className={cn(
        'inline-flex shrink-0 items-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold leading-none tracking-wide text-slate-900 shadow-sm',
        className
      )}
    >
      PK
    </span>
  );
}
