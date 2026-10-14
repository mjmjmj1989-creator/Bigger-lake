import React from 'react';

interface BigLakeLogoProps {
  className?: string;
  textColor?: 'white' | 'dark' | 'auto';
  variant?: 'full' | 'compact' | 'icon';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Big Lake Brewing Official Logo Component
 * Replicates the authentic Lake Michigan silhouette and industrial stencil typography.
 */
export const BigLakeLogo: React.FC<BigLakeLogoProps> = ({
  className = '',
  textColor = 'white',
  variant = 'full',
  size = 'md',
}) => {
  const lakeBlue = '#2583d8'; // Authentic Great Lakes Blue
  const textFill = textColor === 'dark' ? '#111827' : '#ffffff';

  const heightClass =
    size === 'sm' ? 'h-8' : size === 'lg' ? 'h-14 sm:h-16' : 'h-10 sm:h-11';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Lake Michigan Silhouette & Brand Vector */}
      <svg
        viewBox="0 0 400 400"
        className={`${heightClass} w-auto shrink-0 drop-shadow-md`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Lake Michigan Silhouette path */}
        <path
          d="M 175,92 
             C 178,94 184,98 188,103 
             C 193,109 203,106 208,112 
             C 212,118 206,126 203,132 
             C 197,137 194,147 186,151 
             C 181,154 186,160 183,165 
             C 179,169 175,170 174,176 
             C 172,185 168,193 167,202 
             C 165,215 166,229 167,243 
             C 168,255 163,267 161,279 
             C 159,292 161,304 152,315 
             C 145,324 135,327 125,327 
             C 114,327 106,319 104,309 
             C 102,298 103,285 103,274 
             C 104,262 108,249 110,237 
             C 113,222 114,206 117,191 
             C 120,180 126,171 131,162 
             C 134,154 133,143 138,136 
             C 142,130 148,124 153,117 
             C 156,110 159,103 166,97 
             Z
             M 132,152
             C 127,157 122,163 118,170
             C 112,178 105,189 101,194
             C 99,197 103,200 106,197
             C 112,190 121,177 128,168
             Z
             M 163,142
             C 167,146 172,149 175,154
             C 174,158 169,158 167,154
             Z"
          fill={lakeBlue}
          filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.3))"
        />

        {/* Textured / Stencil Distressed Lake Accent Ribs */}
        <path
          d="M 148,120 L 152,125 M 138,175 L 144,180 M 130,220 L 138,223 M 125,260 L 135,263 M 122,295 L 132,297"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Typography in SVG for standalone rendering */}
        <g fill={textFill} className="font-black tracking-tighter" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
          {/* BIG */}
          <text x="215" y="172" fontSize="76" letterSpacing="2" fontWeight="900">
            BIG
          </text>
          {/* LAKE */}
          <text x="214" y="246" fontSize="76" letterSpacing="1" fontWeight="900">
            LAKE
          </text>
          {/* BREWING */}
          <text x="202" y="304" fontSize="47" letterSpacing="3" fontWeight="900">
            BREWING
          </text>

          {/* Stencil cutout slots for authentic industrial craft brewery stamp feel */}
          <rect x="212" y="132" width="5" height="12" fill={textColor === 'dark' ? '#f8fafc' : '#0a192f'} />
          <rect x="252" y="135" width="5" height="10" fill={textColor === 'dark' ? '#f8fafc' : '#0a192f'} />
          <rect x="212" y="202" width="5" height="12" fill={textColor === 'dark' ? '#f8fafc' : '#0a192f'} />
          <rect x="264" y="202" width="5" height="12" fill={textColor === 'dark' ? '#f8fafc' : '#0a192f'} />
          <rect x="200" y="278" width="4" height="10" fill={textColor === 'dark' ? '#f8fafc' : '#0a192f'} />
          <rect x="248" y="278" width="4" height="10" fill={textColor === 'dark' ? '#f8fafc' : '#0a192f'} />
          <rect x="298" y="278" width="4" height="10" fill={textColor === 'dark' ? '#f8fafc' : '#0a192f'} />
          <rect x="350" y="278" width="4" height="10" fill={textColor === 'dark' ? '#f8fafc' : '#0a192f'} />
        </g>
      </svg>

      {/* Optional HTML Label when rendered in headers/footers */}
      {variant === 'full' && (
        <div className="flex flex-col justify-center text-left">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-black tracking-tight text-white uppercase font-sans leading-none">
              Big Lake Brewing
            </span>
            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
              Taproom OS
            </span>
          </div>
          <span className="text-[11px] text-blue-200/70 font-medium tracking-wide">
            Holland, Michigan • Great Lakes Craft
          </span>
        </div>
      )}
    </div>
  );
};
