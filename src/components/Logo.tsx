// ABOUTME: Reusable logo component with SVG variants for navbar, favicon, and branding
// ABOUTME: Easily swappable by updating the SVG paths in one central location

interface LogoProps {
  className?: string;
}

interface LogoFullProps extends LogoProps {
  showText?: boolean;
}

// Icon-only version for favicon and compact spaces
export function LogoIcon({ className = "w-6 h-6" }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path
        d="M8 6L4 10L8 14M16 6L20 10L16 14M14 4L10 20"
        stroke="url(#logo-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Full logo with icon and text for navbar
export function LogoFull({ showText = true, className }: LogoFullProps) {
  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
        <LogoIcon className="w-6 h-6 text-white" />
      </div>
      {showText && (
        <span className="text-2xl font-bold gradient-text">Code Vision</span>
      )}
    </div>
  );
}

// Large mark for loading states and hero sections
export function LogoMark({ className = "w-20 h-20" }: LogoProps) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center shadow-2xl shadow-purple-500/30 ${className}`}>
      <LogoIcon className="w-1/2 h-1/2 text-white" />
    </div>
  );
}
