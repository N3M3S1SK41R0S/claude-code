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
 * quittée est tout de même enregistrée — sauf si l'objet a été supprimé
 * entre-temps (marqueur posé par la zone sensible).
 *
 * Une estimation ou une fiche demandée PENDANT l'enregistrement d'une
 * correction attend la fin de celle-ci : elle porte sur l'identité corrigée.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { VelumItem } from '@velum/core';

import { getVelumClient } from '../../lib/client';
import { errorMessage } from '../../lib/errors';
import {
  createCorrectionGate,
  generateFullSheet,
  itemQueryKey,
  latestCachedItem,
  refreshAfterValuation,
  revalueItem,
  saveIdentityCorrection,
  type CorrectionFlowResult,
  type ItemSheetFlowDeps,
  type PersistOutcome,
} from '../../lib/itemSheetFlows';
import { showToast } from '../../stores/toastStore';

export { itemQueryKey } from '../../lib/itemSheetFlows';

export interface CorrectionInput {
  title: string;
  values: Record<string, string>;
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
  /** Correction en cours d'enregistrement : estimation et fiche l'attendent. */
  const [gate] = useState(createCorrectionGate);

  /** Dernière version connue de l'objet ; lève s'il a été supprimé entre-temps. */
  const latest = (): VelumItem => latestCachedItem(queryClient, item);

  const applySaved = (saved: PersistOutcome) => {
    queryClient.setQueryData(key, saved.item);
    // En ligne : les listes (collection, carnet…) relisent l'objet modifié.
    if (!saved.queued) void queryClient.invalidateQueries({ queryKey: ['items'] });
  };

  const correct = useMutation({
    mutationFn: (input: CorrectionInput): Promise<CorrectionFlowResult> =>
      gate.run(async () => {
        const result = await saveIdentityCorrection(deps, latest(), input);
        if (result.changed) applySaved(result);
        return result;
      }),
    onSuccess: (result) => {
      if (!result.changed) showToast(t('item.identity.noChange'), 'info');
      else if (result.queued) showToast(t('item.identity.queued'), 'info');
      else showToast(t('item.identity.saved'), 'success');
    },
  });

  const analyze = useMutation({
    mutationFn: async (): Promise<PersistOutcome> => {
      await gate.settled();
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
    mutationFn: async () => {
      await gate.settled();
      return revalueItem(deps, latest());
    },
    onSuccess: () => {
      showToast(t('item.valuation.updated'), 'success');
      // Valorisations de la fiche ET listes (collection, carnet, recherche).
      refreshAfterValuation(queryClient, item.id);
    },
    // Visible même si le bloc valorisation n'est pas à l'écran.
    onError: (error) => showToast(errorMessage(error, t), 'danger'),
  });

  return { correct, analyze, valuate };
}

export type ItemSheetActions = ReturnType<typeof useItemSheetActions>;
