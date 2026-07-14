/**
 * Carte d'origine du vin — localise le domaine sur une carte de France (vins
 * français) ou du monde (vins étrangers). Demande produit juillet 2026.
 *
 * Les silhouettes sont définies en coordonnées géographiques dans
 * `@velum/domain-wine` et projetées avec la même fonction que le marqueur : le
 * point tombe toujours au bon endroit. react-native-svg, aucun asset externe.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';
import { VText, velumColors, velumRadius, velumSpacing } from '@velum/ui';
import {
  FRANCE_BBOX,
  FRANCE_OUTLINE,
  CORSICA_OUTLINE,
  WORLD_BBOX,
  WORLD_OUTLINES,
  bboxAspect,
  projectNorm,
  resolveWineOrigin,
} from '@velum/domain-wine';

export interface WineOriginMapProps {
  appellation?: string;
  region?: string;
  country?: string;
  /** Légende de section (i18n) affichée au-dessus de la carte. */
  caption?: string;
}

const HEIGHT = 190;

export function WineOriginMap({ appellation, region, country, caption }: WineOriginMapProps) {
  const origin = resolveWineOrigin({ appellation, region, country });
  if (!origin) return null;

  const bbox = origin.scope === 'france' ? FRANCE_BBOX : WORLD_BBOX;
  const height = HEIGHT;
  const width = Math.round(height * bboxAspect(bbox));
  const outlines: [number, number][][] =
    origin.scope === 'france' ? [FRANCE_OUTLINE, CORSICA_OUTLINE] : WORLD_OUTLINES;

  const toXY = (lng: number, lat: number): { x: number; y: number } => {
    const { nx, ny } = projectNorm(lat, lng, bbox);
    return { x: nx * width, y: ny * height };
  };
  const ringPoints = (ring: [number, number][]): string =>
    ring.map(([lng, lat]) => {
      const p = toXY(lng, lat);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');

  const marker = toXY(origin.lng, origin.lat);

  return (
    <View style={styles.container} accessibilityRole="image" accessibilityLabel={`Origine : ${origin.label}`}>
      {caption ? (
        <VText variant="caption" style={styles.caption}>
          {caption}
        </VText>
      ) : null}
      <View style={styles.frame}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {outlines.map((ring, i) => (
            <Polygon
              key={i}
              points={ringPoints(ring)}
              fill={velumColors.ink.raised}
              stroke={velumColors.gold.soft}
              strokeWidth={1}
              strokeOpacity={0.7}
            />
          ))}
          {/* Halo pulsé (marqueur du domaine). */}
          <Circle cx={marker.x} cy={marker.y} r={11} fill={velumColors.gold.DEFAULT} opacity={0.2} />
          <Circle cx={marker.x} cy={marker.y} r={6} fill={velumColors.gold.DEFAULT} opacity={0.35} />
          <Circle
            cx={marker.x}
            cy={marker.y}
            r={3.5}
            fill={velumColors.bordeaux.DEFAULT}
            stroke={velumColors.parchment.DEFAULT}
            strokeWidth={1.2}
          />
        </Svg>
      </View>
      <VText variant="caption" style={styles.label}>
        📍 {origin.label}
      </VText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: velumSpacing.sm, alignItems: 'center' },
  caption: { alignSelf: 'flex-start', color: velumColors.gold.soft },
  frame: {
    padding: velumSpacing.md,
    borderRadius: velumRadius.card,
    backgroundColor: velumColors.ink.soft,
    borderWidth: 1,
    borderColor: velumColors.ink.border,
  },
  label: { color: velumColors.parchment.DEFAULT },
});
