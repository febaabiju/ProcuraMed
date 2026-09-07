import React from 'react';

/**
 * ProcuraMed Logo — Shield with Medical Cross
 * Works on light and dark backgrounds.
 * Prop `variant`: 'color' | 'white' | 'dark'
 */
const ProcuraMedLogo = ({ size = 36, variant = 'color', className = '' }) => {
  const gradId = `pm-grad-${Math.random().toString(36).slice(2, 7)}`;

  const shieldFill =
    variant === 'color'
      ? `url(#${gradId})`
      : variant === 'white'
      ? 'rgba(255,255,255,0.2)'
      : '#8B7CF8';

  const crossFill =
    variant === 'color' ? 'white' : variant === 'white' ? 'white' : 'white';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ProcuraMed Logo"
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="2" x2="36" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#7C5FF0" />
        </linearGradient>
      </defs>

      {/* Shield shape */}
      <path
        d="M20 2L4 9v12c0 10.5 6.8 18.2 16 20.8C30.2 39.2 37 31.5 37 21V9L20 2z"
        fill={shieldFill}
        style={variant !== 'color' ? { fill: shieldFill } : undefined}
      />

      {/* Outer shield border highlight */}
      <path
        d="M20 2L4 9v12c0 10.5 6.8 18.2 16 20.8C30.2 39.2 37 31.5 37 21V9L20 2z"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1"
        fill="none"
      />

      {/* Medical Cross — vertical bar */}
      <rect x="17.5" y="13.5" width="5" height="15" rx="2" fill={crossFill} />

      {/* Medical Cross — horizontal bar */}
      <rect x="13" y="18" width="14" height="5" rx="2" fill={crossFill} />
    </svg>
  );
};

export default ProcuraMedLogo;
