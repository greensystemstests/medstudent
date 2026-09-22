import React from 'react';

interface StudyBgLogoProps {
  className?: string;
  variant?: 'full' | 'mark' | 'white';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * StudyBg Official Logo Component
 * Matches the uploaded brand design:
 * - Mortarboard hat (Navy #13293D) on top with tassel hanging down right side
 * - Red circle/sun (#D92534) rising in the center
 * - Green shield/mountain valley (#0F7651 / #0C5D40) with winding white road/pathway leading through it
 * - "Study" in dark slate navy (#13293D), "B" in dark forest green (#0F7651), "g" in Bulgarian ruby red (#D92534)
 */
export const StudyBgLogo: React.FC<StudyBgLogoProps> = ({ 
  className = '', 
  variant = 'full', 
  size = 'md' 
}) => {
  // Dimension presets
  const heightClasses = {
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-11',
    xl: 'h-14',
  }[size];

  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${heightClasses} aspect-square ${className}`}
        aria-label="StudyBg Logo Mark"
      >
        {/* Red Sun / Pupil in center */}
        <circle cx="50" cy="38" r="9" fill="#D92534" />

        {/* Green Mountain / Valley Shield base */}
        {/* Left mountain slope */}
        <path
          d="M20 48C20 48 34 42 42 49C48 55 49 61 41 68C33 74 34 85 49 93C32 87 20 74 20 54V48Z"
          fill="#0F7651"
        />
        {/* Right mountain slope */}
        <path
          d="M80 48C80 48 66 42 58 49C52 55 53 61 60 67C66 73 66 84 51 93C68 87 80 74 80 54V48Z"
          fill="#138B60"
        />
        {/* Central white winding pathway (The road to education) */}
        <path
          d="M48 48C46 56 42 61 36 67C30 73 31 82 48 93C40 85 41 76 46 71C52 65 54 59 51 48H48Z"
          fill="#FFFFFF"
        />

        {/* Mortarboard Academic Cap (Navy) */}
        {/* Cap Diamond */}
        <polygon points="50,14 88,32 50,47 12,32" fill="#13293D" />
        {/* Cap Under-Brim */}
        <path d="M26 39L50 50L74 39V43L50 54L26 43V39Z" fill="#0C1D2D" />
        {/* Cap Button */}
        <circle cx="50" cy="30.5" r="2.5" fill="#13293D" />
        {/* Tassel cord and bell */}
        <path d="M50 31Q72 34 76 42V56" stroke="#13293D" strokeWidth="2.5" strokeLinecap="round" />
        {/* Tassel fringe */}
        <path d="M73 56H79L78 68C78 69.5 74 69.5 74 68L73 56Z" fill="#13293D" />
        <circle cx="76" cy="56" r="2.5" fill="#0C1D2D" />
      </svg>
    );
  }

  // Full Logotype with Brand Emblem + StudyBg Wordmark
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Emblem SVG */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${heightClasses} aspect-square shrink-0`}
        aria-hidden="true"
      >
        {/* Red Sun */}
        <circle cx="50" cy="38" r="9" fill="#D92534" />

        {/* Green Mountain / Valley Shield base */}
        <path
          d="M20 48C20 48 34 42 42 49C48 55 49 61 41 68C33 74 34 85 49 93C32 87 20 74 20 54V48Z"
          fill="#0F7651"
        />
        <path
          d="M80 48C80 48 66 42 58 49C52 55 53 61 60 67C66 73 66 84 51 93C68 87 80 74 80 54V48Z"
          fill="#138B60"
        />
        {/* Winding white road through mountains */}
        <path
          d="M48 48C46 56 42 61 36 67C30 73 31 82 48 93C40 85 41 76 46 71C52 65 54 59 51 48H48Z"
          fill="#FFFFFF"
        />

        {/* Mortarboard Academic Cap */}
        <polygon points="50,14 88,32 50,47 12,32" fill="#13293D" />
        <path d="M26 39L50 50L74 39V43L50 54L26 43V39Z" fill="#0C1D2D" />
        <circle cx="50" cy="30.5" r="2.5" fill="#13293D" />
        <path d="M50 31Q72 34 76 42V56" stroke="#13293D" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M73 56H79L78 68C78 69.5 74 69.5 74 68L73 56Z" fill="#13293D" />
        <circle cx="76" cy="56" r="2.5" fill="#0C1D2D" />
      </svg>

      {/* Wordmark: Study (Navy) + B (Green) + g (Red) */}
      <span className="font-heading font-black tracking-tight text-2xl sm:text-3xl leading-none flex items-baseline">
        <span className={variant === 'white' ? 'text-white' : 'text-[#13293D]'}>
          Study
        </span>
        <span className="text-[#0F7651]">
          B
        </span>
        <span className="text-[#D92534]">
          g
        </span>
      </span>
    </div>
  );
};
