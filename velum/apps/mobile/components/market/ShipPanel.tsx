/**
 * Déclaration d'une expédition (vente ou échange) : numéro de suivi
 * (normalisé, texte libre refusé) et transporteur choisi dans une liste
 * fermée. Seules ces deux données partent au serveur (lib/marketForms
 * `shipmentInput`) : jamais de date de livraison, attestée par l'acheteur ou
 * le transporteur.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VButton, VText, VTextInput, velumSpacing } from '@velum/ui';

import { MARKET_CARRIERS, shipmentInput, type MarketCarrier } from '../../lib/marketForms';
import { ChoiceChips } from './controls';

type CarrierChoice = MarketCarrier | 'none';

export type Shipment = NonNullable<ReturnType<typeof shipmentInput>>;

export interface ShipPanelProps {
  onConfirm: (shipment: Shipment) => void;
  onCancel: () => void;
  loading: boolean;
  disabled?: boolean;
}

export function ShipPanel({ onConfirm, onCancel, loading, disabled = false }: ShipPanelProps) {
  const { t } = useTranslation();
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState<CarrierChoice>('none');
  const shipment = shipmentInput(tracking, carrier === 'none' ? null : carrier);
  const trackingError = tracking.trim().length > 0 && shipment === null ? t('community.trackingInvalid') : undefined;

  return (
    <View style={styles.panel}>
      <VTextInput
        label={t('community.trackingLabel')}
        value={tracking}
        onChangeText={setTracking}
        placeholder="XY123456789FR"
        autoCapitalize="characters"
        error={trackingError}
      />
      <VText variant="body">{t('community.carrierLabel')}</VText>
      <ChoiceChips<CarrierChoice>
        value={carrier}
        onChange={setCarrier}
        accessibilityLabel={t('community.carrierLabel')}
        options={[
          ...MARKET_CARRIERS.map((c) => ({ value: c, label: c })),
          { value: 'none', label: t('community.carrierNone') },
        ]}
      />
      <VButton
        label={t('community.confirmShip')}
        onPress={() => {
          if (shipment !== null) onConfirm(shipment);
        }}
        disabled={shipment === null || disabled}
        loading={loading}
      />
      <VButton label={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: velumSpacing.sm },
});
