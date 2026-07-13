/**
 * Courbe d'évolution de la valeur — react-native-svg Polyline sur les
 * points normalisés de lib/valueHistory.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { VText, velumColors, velumSpacing } from '@velum/ui';
import type { ValuationRecord } from '@velum/core';
import { toChartPoints } from '../lib/valueHistory';
import { formatEUR } from '../lib/i18n';

export interface ValueChartProps {
  records: ValuationRecord[];
  /** Message affiché quand l'historique est trop court. */
  emptyLabel: string;
}

const WIDTH = 320;
const HEIGHT = 140;
const PAD = 12;

export function ValueChart({ records, emptyLabel }: ValueChartProps) {
  const points = toChartPoints(records);

  if (points.length < 2) {
    return (
      <View style={styles.empty}>
        <VText variant="caption" tone="dim" center>
          {emptyLabel}
        </VText>
      </View>
    );
  }

  const toSvg = (x: number, y: number) =>
    `${PAD + x * (WIDTH - 2 * PAD)},${HEIGHT - PAD - y * (HEIGHT - 2 * PAD)}`;
  const polyline = points.map((p) => toSvg(p.x, p.y)).join(' ');
  const last = points[points.length - 1];
  const first = points[0];

  return (
    <View
      accessible
      accessibilityLabel={`${points.length} points, ${formatEUR(first?.central ?? 0)} → ${formatEUR(last?.central ?? 0)}`}
      style={styles.container}
    >
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Line
          x1={PAD}
          y1={HEIGHT - PAD}
          x2={WIDTH - PAD}
          y2={HEIGHT - PAD}
          stroke={velumColors.ink.border}
          strokeWidth={1}
        />
        <Polyline
          points={polyline}
          fill="none"
          stroke={velumColors.gold.DEFAULT}
          strokeWidth={2}
        />
        {points.map((p) => {
          const [cx, cy] = toSvg(p.x, p.y).split(',');
          return (
            <Circle
              key={p.valuedAt}
              cx={cx}
              cy={cy}
              r={3}
              fill={velumColors.gold.soft}
            />
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <VText variant="caption" tone="dim">
          {formatEUR(first?.central ?? 0)}
        </VText>
        <VText variant="caption" tone="gold">
          {formatEUR(last?.central ?? 0)}
        </VText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: velumSpacing.xs },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  empty: {
    padding: velumSpacing.lg,
    alignItems: 'center',
  },
});
