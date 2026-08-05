import { cn } from '@/lib/utils';

interface LogoProps {
  /** Size of the square mark in pixels */
  size?: number;
  className?: string;
  /** Render the wordmark next to the icon */
  withWordmark?: boolean;
  /** Tailwind text color class for the wordmark */
  wordmarkClassName?: string;
  /** Optional tagline under the wordmark */
  tagline?: string;
}

/**
 * Nura brand mark: a rounded gradient tile holding an abstract "n" formed by a
 * wellness pulse line with a leaf sprout — health + growth + calm.
 */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const gradientId = `nura-grad-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Nura logo"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${gradientId})`} />
      {/* pulse / heartbeat line */}
      <path
        d="M9 27h6l3-7 5 13 4-9 2.5 3H39"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      {/* leaf sprout */}
      <path
        d="M33 16c-4 0-7 2.6-7 6.4 3.9 0 7-2.4 7-6.4Z"
        fill="white"
        opacity="0.9"
      />
    </svg>
  );
}

export function Logo({
  size = 36,
  className,
  withWordmark = true,
  wordmarkClassName,
  tagline,
}: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      {withWordmark && (
        <div className="leading-tight">
          <span className={cn('block text-xl font-bold tracking-tight', wordmarkClassName)}>
            Nura
          </span>
          {tagline && <span className="block text-xs text-[var(--muted)]">{tagline}</span>}
        </div>
      )}
    </div>
  );
}
