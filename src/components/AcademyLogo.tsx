import React from 'react';

interface AcademyLogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  showText?: boolean;
}

export default function AcademyLogo({ 
  className = '', 
  width = 160, 
  height = 160,
  showText = true 
}: AcademyLogoProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <img
        src="/Logo.png"
        alt="Physics Cube Academy Logo"
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          objectFit: 'contain'
        }}
        className="select-none"
        referrerPolicy="no-referrer"
      />
      {showText && (
        <div className="mt-4 flex flex-col items-center">
          <span 
            className="text-[28px] font-black uppercase tracking-wider leading-none select-none"
            style={{ 
              color: '#1D1B63',
              letterSpacing: '0.12em',
              fontFamily: '"Outfit", "Inter", sans-serif'
            }}
          >
            PHYSICS
          </span>
          <span 
            className="text-[13px] font-bold uppercase tracking-[0.25em] mt-1.5 select-none"
            style={{ 
              color: '#1B70C8',
              letterSpacing: '0.28em',
              fontFamily: '"Outfit", "Inter", sans-serif'
            }}
          >
            CUBE ACADEMY
          </span>
        </div>
      )}
    </div>
  );
}
