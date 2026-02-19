// Dental SVG illustrations — filled silhouettes for orthodontic photo grid
// Layout: 3×3 grid matching standard orthodontic photo series

const fill = "#CBD5E1";       // slate-300 — main silhouette
const fillLight = "#E2E8F0";  // slate-200 — secondary
const white = "#FFFFFF";       // details inside silhouettes

// ─── Row 1: Extraoral Faces ────────────────────────────────────────────────

export function RightProfileSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 140" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Head profile silhouette facing right */}
      <path
        d="M75 8 C85 8 95 15 98 25 L100 35 C102 42 100 48 96 52 L92 56
           C90 60 90 65 92 70 L94 75 C92 82 86 90 78 95
           L72 98 C68 100 65 105 65 110 L65 130 L40 130 L40 110
           C40 100 38 90 35 82 L33 75 C30 68 30 60 32 52
           L34 45 C35 38 38 30 42 24 C48 14 60 8 75 8 Z"
        fill={fill}
      />
      {/* Ear */}
      <path
        d="M36 48 C30 48 28 55 30 62 C32 66 35 65 36 60"
        fill={fillLight}
        stroke={fill}
        strokeWidth="1"
      />
      {/* Eye (cutout) */}
      <ellipse cx="80" cy="42" rx="5" ry="3" fill={white} />
      {/* Neck */}
      <rect x="50" y="100" width="20" height="30" fill={fill} rx="2" />
    </svg>
  );
}

export function FrontalFaceSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 140" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Front face silhouette */}
      <path
        d="M60 5 C80 5 95 18 98 35 L99 50 C99 58 97 65 93 72
           L88 80 C84 86 78 92 72 96 L65 100 C62 102 60 105 60 108
           L60 108 C60 105 58 102 55 100 L48 96 C42 92 36 86 32 80
           L27 72 C23 65 21 58 21 50 L22 35 C25 18 40 5 60 5 Z"
        fill={fill}
      />
      {/* Ears */}
      <ellipse cx="19" cy="52" rx="6" ry="10" fill={fillLight} />
      <ellipse cx="101" cy="52" rx="6" ry="10" fill={fillLight} />
      {/* Eyes (cutouts) */}
      <ellipse cx="44" cy="45" rx="6" ry="3.5" fill={white} />
      <ellipse cx="76" cy="45" rx="6" ry="3.5" fill={white} />
      {/* Nose */}
      <path d="M56 55 L60 65 L64 55" fill="none" stroke={fillLight} strokeWidth="1.5" />
      {/* Neck */}
      <rect x="50" y="100" width="20" height="30" fill={fill} rx="2" />
    </svg>
  );
}

export function SmileFaceSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 140" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Front face silhouette - same as frontal */}
      <path
        d="M60 5 C80 5 95 18 98 35 L99 50 C99 58 97 65 93 72
           L88 80 C84 86 78 92 72 96 L65 100 C62 102 60 105 60 108
           L60 108 C60 105 58 102 55 100 L48 96 C42 92 36 86 32 80
           L27 72 C23 65 21 58 21 50 L22 35 C25 18 40 5 60 5 Z"
        fill={fill}
      />
      {/* Ears */}
      <ellipse cx="19" cy="52" rx="6" ry="10" fill={fillLight} />
      <ellipse cx="101" cy="52" rx="6" ry="10" fill={fillLight} />
      {/* Eyes */}
      <ellipse cx="44" cy="45" rx="6" ry="3.5" fill={white} />
      <ellipse cx="76" cy="45" rx="6" ry="3.5" fill={white} />
      {/* Nose */}
      <path d="M56 55 L60 65 L64 55" fill="none" stroke={fillLight} strokeWidth="1.5" />
      {/* Smile with teeth showing */}
      <path d="M42 75 Q60 90 78 75" fill={white} stroke={fill} strokeWidth="1" />
      <line x1="48" y1="78" x2="48" y2="74" stroke={fillLight} strokeWidth="0.5" />
      <line x1="54" y1="80" x2="54" y2="75" stroke={fillLight} strokeWidth="0.5" />
      <line x1="60" y1="80" x2="60" y2="75" stroke={fillLight} strokeWidth="0.5" />
      <line x1="66" y1="80" x2="66" y2="75" stroke={fillLight} strokeWidth="0.5" />
      <line x1="72" y1="78" x2="72" y2="74" stroke={fillLight} strokeWidth="0.5" />
      {/* Neck */}
      <rect x="50" y="100" width="20" height="30" fill={fill} rx="2" />
    </svg>
  );
}

// ─── Row 2: Occlusal Arches ────────────────────────────────────────────────

export function UpperOcclusalSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 130" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* U-shaped upper arch outline */}
      <path
        d="M20 120 C18 50 25 20 60 10 C95 20 102 50 100 120"
        fill="none" stroke={fill} strokeWidth="2"
      />
      <path
        d="M35 115 C34 55 38 32 60 25 C82 32 86 55 85 115"
        fill="none" stroke={fill} strokeWidth="2"
      />
      {/* Individual teeth — outer ring (left side) */}
      {/* Molars */}
      <rect x="19" y="105" width="16" height="12" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="19" y="90" width="15" height="13" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="20" y="77" width="14" height="11" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      {/* Premolars */}
      <rect x="21" y="65" width="12" height="10" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="23" y="54" width="11" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      {/* Canine */}
      <rect x="26" y="43" width="10" height="9" rx="4" fill={fillLight} stroke={fill} strokeWidth="1" />
      {/* Incisors */}
      <rect x="32" y="33" width="9" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="42" y="27" width="8" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" transform="rotate(-5 46 31)" />
      {/* Center incisors */}
      <rect x="52" y="25" width="7" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="61" y="25" width="7" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      {/* Right side incisors */}
      <rect x="70" y="27" width="8" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" transform="rotate(5 74 31)" />
      <rect x="79" y="33" width="9" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      {/* Right canine */}
      <rect x="84" y="43" width="10" height="9" rx="4" fill={fillLight} stroke={fill} strokeWidth="1" />
      {/* Right premolars */}
      <rect x="86" y="54" width="11" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="87" y="65" width="12" height="10" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      {/* Right molars */}
      <rect x="86" y="77" width="14" height="11" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="86" y="90" width="15" height="13" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="85" y="105" width="16" height="12" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
    </svg>
  );
}

export function LowerOcclusalSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 130" className={className} xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(180deg)" }}>
      {/* Re-use upper arch shape, rotated 180° */}
      <path d="M20 120 C18 50 25 20 60 10 C95 20 102 50 100 120" fill="none" stroke={fill} strokeWidth="2" />
      <path d="M35 115 C34 55 38 32 60 25 C82 32 86 55 85 115" fill="none" stroke={fill} strokeWidth="2" />
      <rect x="19" y="105" width="16" height="12" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="19" y="90" width="15" height="13" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="20" y="77" width="14" height="11" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="21" y="65" width="12" height="10" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="23" y="54" width="11" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="26" y="43" width="10" height="9" rx="4" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="32" y="33" width="9" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="42" y="27" width="8" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" transform="rotate(-5 46 31)" />
      <rect x="52" y="25" width="7" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="61" y="25" width="7" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="70" y="27" width="8" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" transform="rotate(5 74 31)" />
      <rect x="79" y="33" width="9" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="84" y="43" width="10" height="9" rx="4" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="86" y="54" width="11" height="9" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="87" y="65" width="12" height="10" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="86" y="77" width="14" height="11" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="86" y="90" width="15" height="13" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="85" y="105" width="16" height="12" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
    </svg>
  );
}

// ─── Row 3: Intraoral Views ────────────────────────────────────────────────

export function IntraoralRightSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 100" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Upper jaw line */}
      <path d="M10 35 Q40 30 70 30 Q100 30 130 35" fill="none" stroke={fill} strokeWidth="2" />
      {/* Lower jaw line */}
      <path d="M10 65 Q40 70 70 70 Q100 70 130 65" fill="none" stroke={fill} strokeWidth="2" />
      {/* Upper teeth */}
      <rect x="15" y="34" width="14" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="31" y="33" width="14" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="47" y="32" width="13" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="62" y="31" width="11" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="75" y="31" width="11" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="88" y="30" width="10" height="18" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="100" y="30" width="10" height="18" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="112" y="31" width="10" height="16" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      {/* Lower teeth */}
      <rect x="15" y="52" width="14" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="31" y="53" width="14" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="47" y="53" width="13" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="62" y="54" width="11" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="75" y="54" width="11" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="88" y="54" width="10" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="100" y="54" width="10" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="112" y="54" width="10" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
    </svg>
  );
}

export function IntraoralFrontalSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 110" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Upper lip curve */}
      <path d="M10 40 Q60 25 110 40" fill="none" stroke={fill} strokeWidth="2" />
      {/* Upper teeth row */}
      <rect x="16" y="36" width="11" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="28" y="34" width="11" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="40" y="32" width="10" height="18" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="51" y="30" width="9" height="20" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="61" y="30" width="9" height="20" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="71" y="32" width="10" height="18" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="82" y="34" width="11" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="94" y="36" width="11" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      {/* Gap line between upper and lower */}
      <line x1="15" y1="52" x2="106" y2="52" stroke={fill} strokeWidth="0.5" strokeDasharray="2,2" />
      {/* Lower teeth row */}
      <rect x="20" y="54" width="10" height="12" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="31" y="54" width="10" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="42" y="53" width="9" height="15" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="52" y="53" width="8" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="61" y="53" width="8" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="70" y="53" width="9" height="15" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="80" y="54" width="10" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="91" y="54" width="10" height="12" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      {/* Lower lip curve */}
      <path d="M10 72 Q60 88 110 72" fill="none" stroke={fill} strokeWidth="2" />
    </svg>
  );
}

export function IntraoralLeftSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 100" className={className} xmlns="http://www.w3.org/2000/svg" style={{ transform: "scaleX(-1)" }}>
      {/* Mirror of IntraoralRight */}
      <path d="M10 35 Q40 30 70 30 Q100 30 130 35" fill="none" stroke={fill} strokeWidth="2" />
      <path d="M10 65 Q40 70 70 70 Q100 70 130 65" fill="none" stroke={fill} strokeWidth="2" />
      <rect x="15" y="34" width="14" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="31" y="33" width="14" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="47" y="32" width="13" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="62" y="31" width="11" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="75" y="31" width="11" height="16" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="88" y="30" width="10" height="18" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="100" y="30" width="10" height="18" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="112" y="31" width="10" height="16" rx="3" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="15" y="52" width="14" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="31" y="53" width="14" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="47" y="53" width="13" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="62" y="54" width="11" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="75" y="54" width="11" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="88" y="54" width="10" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="100" y="54" width="10" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
      <rect x="112" y="54" width="10" height="14" rx="2" fill={fillLight} stroke={fill} strokeWidth="1" />
    </svg>
  );
}

// ─── X-Ray illustrations ──────────────────────────────────────────────────

export function PanoramicXraySvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 80" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 30 Q14 10 35 8 L55 5 Q70 4 85 5 L105 8 Q126 10 130 30
           L128 42 Q124 55 105 60 L85 62 Q70 64 55 62 L35 60
           Q16 55 12 42 Z"
        fill={fillLight} stroke={fill} strokeWidth="2"
      />
      {/* Teeth suggestions */}
      <rect x="30" y="22" width="6" height="18" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      <rect x="38" y="20" width="6" height="20" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      <rect x="46" y="18" width="6" height="22" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      <rect x="54" y="16" width="5" height="24" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      <rect x="61" y="15" width="5" height="25" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      <rect x="68" y="15" width="5" height="25" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      <rect x="75" y="16" width="5" height="24" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      <rect x="82" y="18" width="6" height="22" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      <rect x="90" y="20" width="6" height="20" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      <rect x="98" y="22" width="6" height="18" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      {/* Jaw curve */}
      <path d="M25 42 Q70 58 115 42" fill="none" stroke={fill} strokeWidth="1" strokeDasharray="3,2" />
    </svg>
  );
}

export function LateralXraySvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 120" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Skull profile */}
      <path
        d="M60 8 C78 8 88 18 90 32 L92 42 C94 50 90 56 84 60
           L78 64 C76 68 78 72 76 78 L72 82 C66 90 56 94 48 92
           L42 88 C36 84 32 76 30 66 L28 52 C26 36 32 18 48 8 Z"
        fill={fillLight} stroke={fill} strokeWidth="2"
      />
      {/* Jaw */}
      <path d="M48 78 L68 76 Q76 76 78 80" fill="none" stroke={fill} strokeWidth="2" />
      {/* Teeth in jaw */}
      <rect x="50" y="68" width="24" height="4" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      <rect x="50" y="74" width="24" height="4" rx="1" fill={white} stroke={fill} strokeWidth="0.8" />
      {/* Spine */}
      <path d="M32 94 L28 115" stroke={fill} strokeWidth="3" strokeLinecap="round" />
      <path d="M36 94 L32 115" stroke={fill} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
