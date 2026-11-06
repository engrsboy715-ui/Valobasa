// Brand-style SVG logos for payment gateways and platforms.

export function BkashLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="bKash">
      <rect width="48" height="48" rx="10" fill="#E2136E" />
      <path fill="#fff" d="M14 14h6.2c3 0 5 1.5 5 4.3 0 1.9-1 3.1-2.5 3.7 1.9.5 3.1 1.9 3.1 4.1 0 3-2.2 4.6-5.4 4.6H14V14zm3 6.9h2.6c1.3 0 2-.6 2-1.7s-.7-1.7-2-1.7H17v3.4zm0 7.2h2.9c1.5 0 2.3-.7 2.3-1.9s-.8-1.9-2.3-1.9H17v3.8z" />
      <path fill="#fff" d="M27 14h5.6c4.5 0 7.4 3 7.4 8.3s-2.9 8.4-7.4 8.4H27V14zm3.2 2.8v11.1h2.2c2.6 0 4.2-2 4.2-5.5s-1.6-5.6-4.2-5.6h-2.2z" />
    </svg>
  );
}

export function NagadLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Nagad">
      <rect width="48" height="48" rx="10" fill="#F48021" />
      <path fill="#fff" d="M24 12c-1.2 3.2-3.8 5.3-7 6.1 1 5.7 3.6 11.2 7 15.9 3.4-4.7 6-10.2 7-15.9-3.2-.8-5.8-2.9-7-6.1z" />
      <path fill="#fff" d="M14 28.5c.8 1.6 1.8 3.1 3 4.5-1.2 1.4-2.2 2.9-3 4.5v-9zm20 0v9c-.8-1.6-1.8-3.1-3-4.5 1.2-1.4 2.2-2.9 3-4.5z" />
    </svg>
  );
}

export function RocketLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Rocket">
      <rect width="48" height="48" rx="10" fill="#8B2994" />
      <path fill="#fff" d="M24 10c-4 2.5-6 6.5-6 11v6l-2 3h4v4h4v-4h4v4h4v-4h4l-2-3v-6c0-4.5-2-8.5-6-11z" />
      <circle cx="24" cy="22" r="3" fill="#8B2994" />
    </svg>
  );
}

export function UpayLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Upay">
      <rect width="48" height="48" rx="10" fill="#E2231A" />
      <path fill="#fff" d="M24 11l-9 4.5v8c0 5.5 3.8 10.5 9 12.5 5.2-2 9-7 9-12.5v-8L24 11z" />
      <path fill="#E2231A" d="M20 22h8v2h-8v-2zm0 4h8v2h-8v-2z" />
    </svg>
  );
}

// Official-ish brand mark logos for platforms
export function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Facebook">
      <rect width="48" height="48" rx="10" fill="#1877F2" />
      <path fill="#fff" d="M26.5 38v-12h4l.6-4.7h-4.6v-3c0-1.4.4-2.3 2.4-2.3h2.5V11.8c-.4-.1-1.9-.2-3.6-.2-3.6 0-6 2.2-6 6.2v3.5h-4V26h4v12h6.7z" />
    </svg>
  );
}

export function YouTubeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="YouTube">
      <rect width="48" height="48" rx="10" fill="#FF0000" />
      <path fill="#fff" d="M19 17v14l12-7-12-7z" />
    </svg>
  );
}

export function TikTokLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="TikTok">
      <rect width="48" height="48" rx="10" fill="#000" />
      <path fill="#25F4EE" d="M20 12h4.2c.3 3 1.8 5 4.8 5.6v4.2c-1.8-.1-3.4-.6-4.8-1.6v7.2c0 4-2.6 6.6-6.2 6.6s-6-2.6-6-6.2c0-3.4 2.6-5.8 6.2-5.6v4.4c-1.2-.3-2.2.4-2.2 1.6 0 1.1.9 1.8 2 1.8 1.3 0 2-.9 2-2.4V12z" />
      <path fill="#FE2C55" d="M22 12h4.2c.3 3 1.8 5 4.8 5.6v4.2c-1.8-.1-3.4-.6-4.8-1.6v7.2c0 4-2.6 6.6-6.2 6.6v-4.2c1.3 0 2-.9 2-2.4V12z" opacity="0.85" />
    </svg>
  );
}

export function InstagramLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Instagram">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#FFD776" />
          <stop offset="30%" stopColor="#F58529" />
          <stop offset="60%" stopColor="#DD2A7B" />
          <stop offset="100%" stopColor="#515BD4" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="10" fill="url(#ig-grad)" />
      <rect x="14" y="14" width="20" height="20" rx="6" fill="none" stroke="#fff" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="5" fill="none" stroke="#fff" strokeWidth="2.5" />
      <circle cx="31" cy="17" r="1.5" fill="#fff" />
    </svg>
  );
}

export function FeederAppLogo({ className }: { className?: string }) {
  return (
    <div
      className={className}
      role="img"
      aria-label="Feeder App"
    >
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-md">
        <span className="text-lg font-bold tracking-wider text-white">F</span>
      </div>
    </div>
  );
}
