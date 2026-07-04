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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 500 500"
        width={width}
        height={height}
        className="select-none overflow-visible"
        referrerPolicy="no-referrer"
      >
        <defs>
          {/* Custom logo gradients for ultra-realistic 3D look */}
          <linearGradient id="navyShadow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#252475" />
            <stop offset="100%" stopColor="#121045" />
          </linearGradient>
          <linearGradient id="royalBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E65B5" />
            <stop offset="50%" stopColor="#1B70C8" />
            <stop offset="100%" stopColor="#104A8B" />
          </linearGradient>
          <linearGradient id="cyanTop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4ADCFF" />
            <stop offset="100%" stopColor="#00B0FF" />
          </linearGradient>
          <linearGradient id="cyanLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00B2FE" />
            <stop offset="100%" stopColor="#007CB5" />
          </linearGradient>
          <linearGradient id="cyanRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0092D1" />
            <stop offset="100%" stopColor="#005B85" />
          </linearGradient>
          <linearGradient id="penGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1D1B63" />
            <stop offset="100%" stopColor="#2A287B" />
          </linearGradient>
        </defs>

        {/* --- 1. OUTER HEXAGONAL FRAME (Blue curve) --- */}
        {/* The open hexagonal path starting from top and wrapping around right and bottom */}
        <path
          d="M 252 148 
             L 362 201 
             C 370 205, 375 211, 375 220 
             L 375 340 
             C 375 349, 370 355, 362 359 
             L 252 412 
             C 244 416, 236 412, 230 408
             L 216 398 
             C 207 392, 206 380, 212 371
             C 218 362, 230 361, 239 367
             L 252 376 
             L 335 328
             L 335 232
             L 252 184
             L 165 232
             C 156 237, 144 234, 139 225
             C 134 216, 137 204, 146 199
             L 252 148 Z"
          fill="url(#royalBlueGrad)"
        />

        {/* Secondary shadow strip for outer hex depth */}
        <path
          d="M 252 184 L 165 232 C 158 236, 149 235, 144 229 C 147 222, 154 218, 161 214 L 250 162 L 340 214 C 347 218, 351 224, 351 232 L 351 328 C 351 334, 347 340, 340 344 L 252 396 L 240 388 C 244 384, 248 380, 252 376 L 335 328 L 335 232 L 252 184 Z"
          fill="#134780"
          opacity="0.3"
        />

        {/* --- 2. FOUNTAIN PEN NIB (Left Side) --- */}
        <g id="pen-nib" transform="translate(-10, 10)">
          {/* Pen Neck Base */}
          <path
            d="M 125 264 L 165 264 C 168 264, 171 267, 171 270 L 171 274 C 171 277, 168 280, 165 280 L 125 280 C 122 280, 119 277, 119 274 L 119 270 C 119 267, 122 264, 125 264 Z"
            fill="url(#penGradient)"
          />
          {/* Nib main body */}
          <path
            d="M 122 282 
               L 168 282 
               C 168 295, 163 310, 158 322 
               L 148 358 
               L 145 358 
               L 132 322
               C 127 310, 122 295, 122 282 Z"
            fill="url(#penGradient)"
          />
          {/* Nib shiny metal side edge */}
          <path
            d="M 122 282 L 140 282 L 145 352 L 145 358 L 132 322 C 127 310, 122 295, 122 282 Z"
            fill="#121045"
            opacity="0.4"
          />
          {/* Central Nib Breathing Hole and Split slit line */}
          <circle cx="145" cy="308" r="4.5" fill="#FFF" />
          <line x1="145" y1="312.5" x2="145" y2="352" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" />
          {/* Tiny nib tip highlight */}
          <circle cx="145" cy="356" r="1.5" fill="#FFF" />
        </g>

        {/* --- 3. THE ISOMETRIC 3D 'P' / CUBE (Center) --- */}
        {/* Isometric projection center is at (252, 280) */}
        {/* We have several cuboid faces to form the 'P-Cube' of Physics Cube */}
        <g id="isometric-cube" transform="translate(0, 5)">
          {/* --- CUBE BACK/INNER DEPTH WALLS (Inside hole) --- */}
          {/* Inner bottom shadow */}
          <polygon points="252,280 285,261 285,300 252,320" fill="#004D70" />
          <polygon points="219,261 252,280 252,320 219,300" fill="#006391" />

          {/* --- LEFT HAND BLOCK PILLAR (Part of P) --- */}
          {/* Top Face */}
          <polygon points="186,242 219,223 219,242 186,261" fill="url(#cyanTop)" />
          {/* Front Left Face */}
          <polygon points="186,242 186,322 219,341 219,261" fill="url(#cyanLeft)" />
          {/* Bottom slant face */}
          <polygon points="186,322 219,341 219,350 186,331" fill="#005B85" />

          {/* --- TOP ARCH OF 'P' (Spans left to center-right) --- */}
          {/* Top Face */}
          <polygon points="219,204 252,185 285,204 252,223" fill="url(#cyanTop)" />
          {/* Front left face of top arch */}
          <polygon points="219,204 219,223 252,242 252,223" fill="url(#cyanLeft)" />
          {/* Front right face of top arch */}
          <polygon points="252,223 252,242 285,223 285,204" fill="url(#cyanRight)" />

          {/* --- RIGHT SIDE PILLAR (Completing the outer cube hexagon outline) --- */}
          {/* Top Face */}
          <polygon points="285,223 318,242 285,261 252,242" fill="url(#cyanTop)" />
          {/* Front Right Face */}
          <polygon points="285,204 318,223 318,303 285,284" fill="url(#cyanRight)" />
          {/* Outer connecting facet */}
          <polygon points="318,242 318,322 285,341 285,261" fill="url(#cyanRight)" />

          {/* --- MIDDLE SEGMENT OF THE 'P' (horizontal stroke of P, connects left pillar to central block) --- */}
          {/* Top Face */}
          <polygon points="219,261 252,242 285,261 252,280" fill="url(#cyanTop)" />
          {/* Front Left Face */}
          <polygon points="219,261 219,300 252,320 252,280" fill="url(#cyanLeft)" />

          {/* --- MIDDLE EMBOSSED INNER CUBE (forms the center cube structure) --- */}
          {/* Top Face of inner block */}
          <polygon points="228,268 252,254 276,268 252,282" fill="#E0F7FF" />
          {/* Left Face of inner block */}
          <polygon points="228,268 228,305 252,319 252,282" fill="#00E5FF" />
          {/* Right Face of inner block */}
          <polygon points="252,282 252,319 276,305 276,268" fill="#00B0FF" />

          {/* --- BOTTOM OUTLINE ANCHOR OF P (The bottom hook) --- */}
          {/* Top Face */}
          <polygon points="252,339 285,320 318,339 285,358" fill="url(#cyanTop)" />
          {/* Font Left Face */}
          <polygon points="252,339 252,358 285,377 285,358" fill="url(#cyanLeft)" />
          {/* Front Right Face */}
          <polygon points="285,358 285,377 318,358 318,339" fill="url(#cyanRight)" />
        </g>

        {/* --- 4. THE GRADUATION CAP (Mortarboard) AT THE TOP --- */}
        <g id="graduation-cap" transform="translate(0, -6)">
          {/* Mortarboard Diamond Top */}
          <polygon
            points="252,86 372,126 252,166 132,126"
            fill="url(#navyShadow)"
            stroke="#1D1B63"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Golden/White subtle inner diamond border */}
          <polygon
            points="252,94 354,126 252,158 150,126"
            fill="none"
            stroke="#FFF"
            strokeWidth="0.75"
            strokeDasharray="4 2"
            opacity="0.45"
          />

          {/* Under cap band (skull cap structure) */}
          <path
            d="M 172,140 
               L 172,152 
               C 172,165, 208,172, 252,172 
               C 296,172, 332,165, 332,152 
               L 332,140"
            fill="#121045"
            stroke="#1D1B63"
            strokeWidth="1.5"
          />

          {/* Open Book Vector drawing inside the Diamond (Y=96 to Y=146) */}
          <g id="book-drawing" transform="translate(192, 108)">
            {/* Sunburst background rays */}
            <g opacity="0.35">
              <line x1="60" y1="20" x2="60" y2="2" stroke="#FFF" strokeWidth="1.5" />
              <line x1="60" y1="20" x2="40" y2="4" stroke="#FFF" strokeWidth="1.2" />
              <line x1="60" y1="20" x2="80" y2="4" stroke="#FFF" strokeWidth="1.2" />
              <line x1="60" y1="20" x2="22" y2="10" stroke="#FFF" strokeWidth="1" />
              <line x1="60" y1="20" x2="98" y2="10" stroke="#FFF" strokeWidth="1" />
              <line x1="60" y1="20" x2="10" y2="22" stroke="#FFF" strokeWidth="1" />
              <line x1="60" y1="20" x2="110" y2="22" stroke="#FFF" strokeWidth="1" />
            </g>

            {/* Glowing Sun Core */}
            <circle cx="60" cy="20" r="7" fill="#FFF" opacity="0.8" />
            <circle cx="60" cy="20" r="14" fill="none" stroke="#FFF" strokeWidth="1" opacity="0.4" />

            {/* Book Pages */}
            {/* Left Page */}
            <path
              d="M 60,35 
                 C 50,31, 35,32, 26,34 
                 L 26,24 
                 C 35,22, 50,21, 60,25 
                 Z"
              fill="#FFF"
              stroke="#1D1B63"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {/* Right Page */}
            <path
              d="M 60,35 
                 C 70,31, 85,32, 94,34 
                 L 94,24 
                 C 85,22, 70,21, 60,25 
                 Z"
              fill="#FFF"
              stroke="#1D1B63"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {/* Center spine marker */}
            <line x1="60" y1="24" x2="60" y2="35" stroke="#1D1B63" strokeWidth="1.2" />
          </g>

          {/* Golden/White Tassel Hanging */}
          {/* Tassel string */}
          <path
            d="M 252,126 L 350,126 L 360,154"
            fill="none"
            stroke="#FFF"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Small tassel handle/grommet */}
          <circle cx="360" cy="154" r="2" fill="#D3D9E9" />
          {/* Tassel fringe */}
          <polygon
            points="357,156 363,156 364,178 356,178"
            fill="#FFF"
            stroke="#1D1B63"
            strokeWidth="0.5"
            opacity="0.95"
          />
        </g>
      </svg>

      {/* --- 5. LOGO TEXT SECTION --- */}
      {showText && (
        <div className="mt-4 flex flex-col items-center">
          <span 
            className="text-[28px] font-black uppercase tracking-wider text-teal-700 leading-none select-none font-sans"
            style={{ 
              color: '#1D1B63',
              letterSpacing: '0.12em',
              fontFamily: '"Outfit", "Inter", sans-serif'
            }}
          >
            PHYSICS
          </span>
          <span 
            className="text-[13px] font-bold uppercase tracking-[0.25em] text-teal-600 mt-1.5 select-none"
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
