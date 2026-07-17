/**
 * Illustrations vectorielles des 5 modules — dessinées « maison » (or sur
 * velours) plutôt que des icônes génériques : bouteille de vin, pièce,
 * tableau encadré, timbre dentelé, montre de collection. Rendu via
 * react-native-svg (web + natif).
 */
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { VelumDomain } from '@velum/core';

export interface ModuleGlyphProps {
  domain: VelumDomain;
  size?: number;
  /** Teinte principale (traits). Défaut : or doux. */
  color?: string;
}

/** Bouteille de vin : capsule, épaule tombante, étiquette. */
function WineGlyph({ color, s }: { color: string; s: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      <Rect x="20" y="3.5" width="8" height="4.5" rx="1.2" fill={color} />
      <Path
        d="M21 8 V13 C21 15.4 17.8 16.6 17.8 20.4 V40 A3 3 0 0 0 20.8 43 H27.2 A3 3 0 0 0 30.2 40 V20.4 C30.2 16.6 27 15.4 27 13 V8 Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Rect x="17.6" y="27" width="12.8" height="9.5" rx="1" stroke={color} strokeWidth={1.4} />
      <Line x1="20.4" y1="30.6" x2="27.6" y2="30.6" stroke={color} strokeWidth={1.2} opacity={0.85} />
      <Line x1="20.4" y1="33.2" x2="25.6" y2="33.2" stroke={color} strokeWidth={1.2} opacity={0.6} />
    </Svg>
  );
}

/** Pièce : listel, grènetis, monogramme « V » et étoile. */
function CoinGlyph({ color, s }: { color: string; s: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="18" stroke={color} strokeWidth={1.9} />
      <Circle cx="24" cy="24" r="14" stroke={color} strokeWidth={1.1} opacity={0.7} />
      <Path d="M18.5 17 L24 30 L29.5 17" stroke={color} strokeWidth={1.9} strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M24 32.4 l0.9 1.9 2.1 0.3 -1.5 1.5 0.35 2.1 -1.85 -1 -1.85 1 0.35 -2.1 -1.5 -1.5 2.1 -0.3 z" fill={color} />
    </Svg>
  );
}

/** Tableau encadré : cadre, toile, soleil et colline. */
function ArtGlyph({ color, s }: { color: string; s: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      <Rect x="6.5" y="8.5" width="35" height="31" rx="1.5" stroke={color} strokeWidth={2.2} />
      <Rect x="10.5" y="12.5" width="27" height="23" rx="0.8" stroke={color} strokeWidth={1.1} opacity={0.75} />
      <Circle cx="30.5" cy="19.5" r="3" stroke={color} strokeWidth={1.4} />
      <Path d="M11.5 32.5 Q18 24.5 24 29.5 Q30 34 37 27.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="6.5" y1="8.5" x2="10.5" y2="12.5" stroke={color} strokeWidth={1} opacity={0.6} />
      <Line x1="41.5" y1="8.5" x2="37.5" y2="12.5" stroke={color} strokeWidth={1} opacity={0.6} />
    </Svg>
  );
}

/** Timbre : dentelure (pointillé), vignette, soleil rayonnant, faciale. */
function StampGlyph({ color, s }: { color: string; s: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      <Rect
        x="8"
        y="8.5"
        width="32"
        height="31"
        rx="2"
        stroke={color}
        strokeWidth={2}
        strokeDasharray="0.5 3.15"
        strokeLinecap="round"
      />
      <Rect x="12" y="12.5" width="24" height="19" rx="0.6" stroke={color} strokeWidth={1.1} opacity={0.8} />
      <Circle cx="24" cy="20.5" r="3.2" stroke={color} strokeWidth={1.3} />
      <Line x1="24" y1="14.5" x2="24" y2="12.8" stroke={color} strokeWidth={1} />
      <Line x1="24" y1="28.2" x2="24" y2="26.5" stroke={color} strokeWidth={1} />
      <Line x1="17.8" y1="20.5" x2="16.1" y2="20.5" stroke={color} strokeWidth={1} />
      <Line x1="31.9" y1="20.5" x2="30.2" y2="20.5" stroke={color} strokeWidth={1} />
      <SvgText x="24" y="37.2" fill={color} fontSize="6" fontWeight="700" textAnchor="middle">
        15c
      </SvgText>
    </Svg>
  );
}

/** Montre : bracelet, boîtier rond, lunette, couronne, aiguilles sur 10h10. */
function WatchGlyph({ color, s }: { color: string; s: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      <Path d="M17.5 12.5 L16 4.5 A1.5 1.5 0 0 1 17.5 3 H30.5 A1.5 1.5 0 0 1 32 4.5 L30.5 12.5" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M17.5 35.5 L16 43.5 A1.5 1.5 0 0 0 17.5 45 H30.5 A1.5 1.5 0 0 0 32 43.5 L30.5 35.5" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Circle cx="24" cy="24" r="12.5" stroke={color} strokeWidth={2} />
      <Circle cx="24" cy="24" r="9.6" stroke={color} strokeWidth={1.1} opacity={0.75} />
      <Rect x="37.4" y="22" width="3" height="4" rx="1" fill={color} />
      <Line x1="24" y1="16" x2="24" y2="17.8" stroke={color} strokeWidth={1.1} opacity={0.8} />
      <Line x1="24" y1="30.2" x2="24" y2="32" stroke={color} strokeWidth={1.1} opacity={0.8} />
      <Line x1="16" y1="24" x2="17.8" y2="24" stroke={color} strokeWidth={1.1} opacity={0.8} />
      <Line x1="30.2" y1="24" x2="32" y2="24" stroke={color} strokeWidth={1.1} opacity={0.8} />
      <Line x1="24" y1="24" x2="19.6" y2="20.4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Line x1="24" y1="24" x2="27.4" y2="19" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx="24" cy="24" r="1.1" fill={color} />
    </Svg>
  );
}

export function ModuleGlyph({ domain, size = 40, color = '#E4C878' }: ModuleGlyphProps) {
  switch (domain) {
    case 'wine':
      return <WineGlyph color={color} s={size} />;
    case 'coin':
      return <CoinGlyph color={color} s={size} />;
    case 'art':
      return <ArtGlyph color={color} s={size} />;
    case 'stamp':
      return <StampGlyph color={color} s={size} />;
    case 'watch':
      return <WatchGlyph color={color} s={size} />;
  }
}
