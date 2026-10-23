/**
 * Actions de la fiche objet partagées entre la barre d'actions rapides et les
 * sections (même état de progression partout) :
 *  - correction de l'identification (texte) ;
 *  - chargement / régénération de la fiche complète (edge.analyze) ;
 *  - estimation de marché à la demande (edge.valuate, persistée serveur).
 *
 * Les parcours eux-mêmes sont dans lib/itemSheetFlows.ts (testés, y compris
 * contre le client démo) ; ce hook les branche sur React Query : cache de la
 * fiche mis à jour immédiatement (même hors-ligne), listes invalidées en ligne.
 * Les mutations survivent à la sortie de l'écran : une fiche lancée puis
 * quittée est tout de même enregistrée.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { VelumItem } from '@velum/core';

import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import {
  generateFullSheet,
  revalueItem,
  saveIdentityCorrection,
  type CorrectionFlowResult,
  type ItemSheetFlowDeps,
  type PersistOutcome,
} from '../../lib/itemSheetFlows';
import { showToast } from '../../stores/toastStore';

export interface CorrectionInput {
  title: string;
  values: Record<string, string>;
}

/** Clé React Query de la fiche d'un objet (partagée avec l'écran). */
export function itemQueryKey(itemId: string): readonly unknown[] {
  return ['items', itemId];
}

export function useItemSheetActions(item: VelumItem) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = itemQueryKey(item.id);
  const deps: ItemSheetFlowDeps = {
    client: getVelumClient(),
    now: () => new Date(),
    mutationId: () => `mut-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };

  /** Dernière version connue de l'objet (une autre action a pu la modifier). */
  const latest = (): VelumItem => queryClient.getQueryData<VelumItem | null>(key) ?? item;

  const applySaved = (saved: PersistOutcome) => {
    queryClient.setQueryData(key, saved.item);
    // En ligne : les listes (collection, carnet…) relisent l'objet modifié.
    if (!saved.queued) void queryClient.invalidateQueries({ queryKey: ['items'] });
  };

  const correct = useMutation({
    mutationFn: async (input: CorrectionInput): Promise<CorrectionFlowResult> => {
      const result = await saveIdentityCorrection(deps, latest(), input);
      if (result.changed) applySaved(result);
      return result;
    },
    onSuccess: (result) => {
      if (!result.changed) showToast(t('item.identity.noChange'), 'info');
      else if (result.queued) showToast(t('item.identity.queued'), 'info');
      else showToast(t('item.identity.saved'), 'success');
    },
  });

  const analyze = useMutation({
    mutationFn: async (): Promise<PersistOutcome> => {
      const saved = await generateFullSheet(deps, latest);
      applySaved(saved);
      return saved;
    },
    onSuccess: (saved) =>
      saved.queued
        ? showToast(t('item.fullSheet.queued'), 'info')
        : showToast(t('item.fullSheet.loaded'), 'success'),
    // Le détail (et « Réessayer ») reste affiché dans la carte de la fiche.
    onError: () => showToast(t('item.fullSheet.error'), 'danger'),
  });

  const valuate = useMutation({
    mutationFn: () => revalueItem(deps, latest()),
    onSuccess: () => {
      showToast(t('item.valuation.updated'), 'success');
      // Toutes les valorisations : fiche (dernière + historique), collection…
      void queryClient.invalidateQueries({ queryKey: ['valuations'] });
    },
    // Visible même si le bloc valorisation n'est pas à l'écran.
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  return { correct, analyze, valuate };
}

export type ItemSheetActions = ReturnType<typeof useItemSheetActions>;
