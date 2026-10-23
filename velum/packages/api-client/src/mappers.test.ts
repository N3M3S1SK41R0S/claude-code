import { describe, expect, it } from 'vitest';
import type { VelumItem } from '@velum/core';
import {
  alertToRow,
  catalogueQueryToArgs,
  catalogueRowToListing,
  itemPatchToRow,
  itemPayloadToRow,
  itemToRow,
  jsonToCommissionSummary,
  newItemToRow,
  profilePatchToRow,
  rowToAlert,
  rowToCatalogueListing,
  rowToCertificationRequest,
  rowToExchangeProposal,
  rowToItem,
  rowToListing,
  rowToMarketMessage,
  rowToOrder,
  rowToProfile,
  rowToValuation,
  type AlertRow,
  type CatalogueRow,
  type CertificationRow,
  type ExchangeRow,
  type ItemRow,
  type ListingRow,
  type MarketMessageRow,
  type OrderRow,
  type ProfileRow,
  type ValuationRow,
} from './mappers';

const itemRow: ItemRow = {
  id: 'itm-1',
  owner_id: 'usr-1',
  domain: 'wine',
  title: 'Château Margaux 2015',
  attributes: { vintage: 2015, appellation: 'Margaux' },
  confidence: 0.92,
  acquired_at: '2020-06-15',
  acquired_price: 450,
  condition: 'excellent',
  notes: 'Cave enterrée',
  storage_location: 'Cave A3',
  created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-05T09:30:00Z',
};

describe('mappers items', () => {
  it('rowToItem convertit snake_case → camelCase', () => {
    const item = rowToItem(itemRow);
    expect(item).toEqual({
      id: 'itm-1',
      ownerId: 'usr-1',
      domain: 'wine',
      title: 'Château Margaux 2015',
      attributes: { vintage: 2015, appellation: 'Margaux' },
      confidence: 0.92,
      acquiredAt: '2020-06-15',
      acquiredPrice: 450,
      condition: 'excellent',
      notes: 'Cave enterrée',
      storageLocation: 'Cave A3',
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-05T09:30:00Z',
    } satisfies VelumItem);
  });

  it('itemToRow est l’inverse exact de rowToItem', () => {
    expect(itemToRow(rowToItem(itemRow))).toEqual(itemRow);
  });

  it('rowToItem coerce les numeric sérialisés en chaîne', () => {
    const item = rowToItem({ ...itemRow, acquired_price: '450.50' });
    expect(item.acquiredPrice).toBe(450.5);
  });

  it('rowToItem préserve les null', () => {
    const item = rowToItem({
      ...itemRow,
      title: null,
      confidence: null,
      acquired_at: null,
      acquired_price: null,
      condition: null,
      notes: null,
      storage_location: null,
    });
    expect(item.title).toBeNull();
    expect(item.confidence).toBeNull();
    expect(item.acquiredPrice).toBeNull();
    expect(item.storageLocation).toBeNull();
  });

  it('itemPatchToRow ne mappe que les clés fournies', () => {
    expect(itemPatchToRow({ title: 'Nouveau titre', updatedAt: '2026-07-06T00:00:00Z' })).toEqual({
      title: 'Nouveau titre',
      updated_at: '2026-07-06T00:00:00Z',
    });
  });

  it('itemPayloadToRow ignore les clés inconnues et les undefined', () => {
    expect(
      itemPayloadToRow({ title: 'T', foo: 'bar', notes: undefined, acquiredPrice: 12 }),
    ).toEqual({ title: 'T', acquired_price: 12 });
  });

  it('newItemToRow mappe une entrée de création (id client optionnel)', () => {
    expect(
      newItemToRow({ ownerId: 'usr-1', domain: 'coin', title: '5 Francs Semeuse 1960' }),
    ).toEqual({ owner_id: 'usr-1', domain: 'coin', title: '5 Francs Semeuse 1960' });
    expect(newItemToRow({ id: 'local-1', ownerId: 'usr-1', domain: 'stamp' })).toEqual({
      id: 'local-1',
      owner_id: 'usr-1',
      domain: 'stamp',
    });
  });
});

describe('mappers valuations', () => {
  it('rowToValuation convertit les bornes d’IC et coerce les numeric', () => {
    const row: ValuationRow = {
      id: 'val-1',
      item_id: 'itm-1',
      central: '520.00',
      ci80_low: 480,
      ci80_high: 560,
      ci95_low: '450.00',
      ci95_high: 600,
      reliability: 74,
      sources: [
        {
          price: 510,
          currency: 'EUR',
          ageDays: 12,
          sourceWeight: 0.7,
          source: { name: 'eBay sold', kind: 'marketplace_sold' },
        },
      ],
      valued_at: '2026-07-08T12:00:00Z',
    };
    const record = rowToValuation(row);
    expect(record).toEqual({
      id: 'val-1',
      itemId: 'itm-1',
      central: 520,
      ci80Low: 480,
      ci80High: 560,
      ci95Low: 450,
      ci95High: 600,
      reliability: 74,
      sources: row.sources,
      valuedAt: '2026-07-08T12:00:00Z',
    });
  });
});

describe('mappers alerts', () => {
  const alertRow: AlertRow = {
    id: 'alr-1',
    item_id: 'itm-1',
    type: 'price_threshold',
    config: { threshold: 600 },
    active: true,
  };

  it('rowToAlert convertit snake_case → camelCase', () => {
    expect(rowToAlert(alertRow)).toEqual({
      id: 'alr-1',
      itemId: 'itm-1',
      type: 'price_threshold',
      config: { threshold: 600 },
      active: true,
    });
  });

  it('alertToRow omet id quand absent (insertion) et le garde sinon', () => {
    expect(
      alertToRow({ itemId: 'itm-1', type: 'drink_window', config: {}, active: false }),
    ).toEqual({ item_id: 'itm-1', type: 'drink_window', config: {}, active: false });
    expect(
      alertToRow({ id: 'alr-2', itemId: 'itm-1', type: 'opportunity', config: {}, active: true }),
    ).toEqual({ id: 'alr-2', item_id: 'itm-1', type: 'opportunity', config: {}, active: true });
  });
});

describe('mappers profile', () => {
  it('rowToProfile convertit snake_case → camelCase', () => {
    const row: ProfileRow = {
      id: 'usr-1',
      display_name: 'Pierre',
      locale: 'fr',
      a11y_mode: true,
      plan: 'gold',
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(rowToProfile(row)).toEqual({
      id: 'usr-1',
      displayName: 'Pierre',
      locale: 'fr',
      a11yMode: true,
      plan: 'gold',
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('rowToProfile replie un plan inconnu sur free (prudence)', () => {
    const row: ProfileRow = {
      id: 'usr-1',
      display_name: null,
      locale: 'fr',
      a11y_mode: false,
      plan: 'diamant',
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(rowToProfile(row).plan).toBe('free');
  });

  it('profilePatchToRow mappe uniquement les champs fournis (dont expoPushToken)', () => {
    expect(profilePatchToRow({})).toEqual({});
    expect(
      profilePatchToRow({
        displayName: 'Pierre',
        a11yMode: false,
        expoPushToken: 'ExponentPushToken[xyz]',
      }),
    ).toEqual({
      display_name: 'Pierre',
      a11y_mode: false,
      expo_push_token: 'ExponentPushToken[xyz]',
    });
    expect(profilePatchToRow({ expoPushToken: null, locale: 'en' })).toEqual({
      expo_push_token: null,
      locale: 'en',
    });
  });
});

describe('mappers marketplace (vues anonymisées)', () => {
  const legacyOrder: OrderRow = {
    id: 'o1',
    listing_id: 'l1',
    buyer_id: 'usr-1',
    seller_id: 'usr-2',
    amount: '120.50',
    currency: 'EUR',
    commission_rate: '0.0400',
    escrow_state: 'funds_held',
    carrier: null,
    tracking_number: null,
    delivered_at: null,
    released_at: null,
    created_at: '2026-10-01T00:00:00Z',
  };

  it('rowToOrder : rôle déduit du lecteur sur une ligne brute (compatibilité)', () => {
    expect(rowToOrder(legacyOrder, 'usr-2')).toMatchObject({
      role: 'seller',
      amount: 120.5,
      commissionRate: 0.04,
      counterpartyAlias: 'Membre VELUM',
    });
    expect(rowToOrder(legacyOrder)).toMatchObject({ role: 'buyer', buyerId: 'usr-1', sellerId: 'usr-2' });
  });

  it('rowToOrder : le rôle serveur prime, l’identifiant masqué devient ""', () => {
    const view: OrderRow = {
      ...legacyOrder,
      buyer_id: null,
      seller_id: 'usr-2',
      role: 'seller',
      counterparty_alias: 'Collectionneur 7F3A',
      certification_required: true,
    };
    expect(rowToOrder(view, 'autre')).toMatchObject({
      role: 'seller',
      buyerId: '',
      sellerId: 'usr-2',
      counterpartyAlias: 'Collectionneur 7F3A',
      certificationRequired: true,
    });
  });

  it('rowToOrder / rowToExchangeProposal : listingCertified seulement s’il est fourni', () => {
    // Fourni par la vue : recopié tel quel (vrai comme faux).
    expect(rowToOrder({ ...legacyOrder, listing_certified: true }).listingCertified).toBe(true);
    expect(rowToOrder({ ...legacyOrder, listing_certified: false }).listingCertified).toBe(false);
    // Absent ou null (schéma antérieur) : propriété omise, jamais « non certifiée » présumé.
    expect('listingCertified' in rowToOrder(legacyOrder)).toBe(false);
    expect('listingCertified' in rowToOrder({ ...legacyOrder, listing_certified: null })).toBe(false);
    const exchange: ExchangeRow = {
      id: 'x1',
      listing_id: 'l1',
      role: 'proposer',
      counterparty_alias: 'Collectionneur 7F3A',
      listing_title: 'Bloc CITEX',
      listing_domain: 'stamp',
      listing_value: '780',
      offered_title: 'Pièce',
      offered_domain: 'coin',
      offered_value: '700',
      cash_adjustment: '0',
      currency: 'EUR',
      message: null,
      state: 'proposed',
      my_commission: null,
      certification_required: false,
      listing_certified: true,
      proposer_tracking: null,
      recipient_tracking: null,
      proposer_received: false,
      recipient_received: false,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    };
    expect(rowToExchangeProposal(exchange)).toMatchObject({ certificationRequired: false, listingCertified: true });
    const legacyExchange: ExchangeRow = { ...exchange };
    delete legacyExchange.listing_certified;
    expect('listingCertified' in rowToExchangeProposal(legacyExchange)).toBe(false);
  });

  it('rowToExchangeProposal : offeredItemId et offeredItemCertified seulement s’ils sont fournis', () => {
    const exchange: ExchangeRow = {
      id: 'x1',
      listing_id: 'l1',
      role: 'proposer',
      counterparty_alias: 'Collectionneur 7F3A',
      listing_title: 'Bloc CITEX',
      listing_domain: 'stamp',
      listing_value: '780',
      offered_title: 'Pièce',
      offered_domain: 'coin',
      offered_value: '700',
      cash_adjustment: '0',
      currency: 'EUR',
      message: null,
      state: 'proposed',
      my_commission: null,
      certification_required: false,
      listing_certified: false,
      offered_item_id: 'i5',
      offered_item_certified: true,
      proposer_tracking: null,
      recipient_tracking: null,
      proposer_received: false,
      recipient_received: false,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    };
    // Auteur : son objet offert, et sa certification.
    expect(rowToExchangeProposal(exchange)).toMatchObject({ offeredItemId: 'i5', offeredItemCertified: true });
    // Destinataire : identifiant masqué par le serveur (null conservé), booléen recopié.
    const recipient = rowToExchangeProposal({
      ...exchange,
      role: 'recipient',
      offered_item_id: null,
      offered_item_certified: false,
    });
    expect(recipient.offeredItemId).toBeNull();
    expect(recipient.offeredItemCertified).toBe(false);
    // Absents (serveur antérieur) ou booléen null : propriétés omises.
    const legacy: ExchangeRow = { ...exchange, offered_item_certified: null };
    delete legacy.offered_item_id;
    const mapped = rowToExchangeProposal(legacy);
    expect('offeredItemId' in mapped).toBe(false);
    expect('offeredItemCertified' in mapped).toBe(false);
  });

  it('rowToListing : nature, textes publics, certification', () => {
    const row: ListingRow = {
      id: 'l1',
      item_id: 'i1',
      seller_id: 'usr-1',
      ask_price: '780.00',
      currency: 'EUR',
      status: 'pending_certification',
      title: 'Bloc CITEX',
      domain: 'stamp',
      commission_rate: '0.0500',
      expert_appraisal_required: true,
      expert_appraisal_ref: null,
      created_at: '2026-10-01T00:00:00Z',
      kind: 'sale_or_exchange',
      description: 'Neuf',
      exchange_wishes: null,
    };
    expect(rowToListing(row)).toMatchObject({
      askPrice: 780,
      kind: 'sale_or_exchange',
      certificationRequired: true,
      certified: false,
      description: 'Neuf',
    });
    expect(rowToListing({ ...row, expert_appraisal_ref: 'expertises/x.pdf', kind: undefined })).toMatchObject({
      certified: true,
      kind: 'sale',
    });
    // Objet supprimé depuis : annonce détachée, historique conservé.
    expect(rowToListing({ ...row, item_id: null, status: 'sold' })).toMatchObject({ itemId: '', status: 'sold' });
  });

  it('catalogue : ligne anonymisée et projection dépréciée', () => {
    const row: CatalogueRow = {
      id: 'l1',
      kind: 'exchange',
      domain: 'coin',
      title: 'Écu',
      description: null,
      ask_price: '250',
      currency: null,
      exchange_wishes: 'Louis d’or',
      seller_alias: 'Collectionneur 7F3A',
      certified: null,
      is_mine: null,
      created_at: '2026-10-01T00:00:00Z',
    };
    expect(rowToCatalogueListing(row)).toEqual({
      id: 'l1',
      kind: 'exchange',
      domain: 'coin',
      title: 'Écu',
      description: null,
      askPrice: 250,
      currency: 'EUR',
      exchangeWishes: 'Louis d’or',
      sellerAlias: 'Collectionneur 7F3A',
      certified: false,
      isMine: false,
      createdAt: '2026-10-01T00:00:00Z',
    });
    expect(catalogueRowToListing(row)).toMatchObject({
      itemId: '',
      sellerId: '',
      status: 'active',
      commissionRate: 0,
      certificationRequired: false,
    });
  });

  it('catalogueQueryToArgs : filtres absents ⇒ null, nombres non finis ignorés', () => {
    expect(catalogueQueryToArgs()).toEqual({
      p_domain: null,
      p_mode: null,
      p_text: null,
      p_min_price: null,
      p_max_price: null,
      p_certified_only: false,
      p_include_mine: false,
      p_sort: 'recent',
      p_limit: null,
    });
    expect(
      catalogueQueryToArgs({ minPrice: Number.NaN, maxPrice: 10, includeMine: true, limit: 20 }),
    ).toMatchObject({ p_min_price: null, p_max_price: 10, p_include_mine: true, p_limit: 20 });
  });

  it('échange, certification, message : coercitions sûres', () => {
    const exchange: ExchangeRow = {
      id: 'x1',
      listing_id: 'l1',
      role: 'recipient',
      counterparty_alias: null,
      listing_title: null,
      listing_domain: null,
      listing_value: '320',
      offered_title: 'Pièce',
      offered_domain: 'coin',
      offered_value: 300,
      cash_adjustment: null,
      currency: null,
      message: null,
      state: 'accepted',
      my_commission: '16.00',
      certification_required: null,
      proposer_tracking: null,
      recipient_tracking: null,
      proposer_received: null,
      recipient_received: null,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-02T00:00:00Z',
    };
    expect(rowToExchangeProposal(exchange)).toMatchObject({
      role: 'recipient',
      counterpartyAlias: 'Membre VELUM',
      listingValue: 320,
      cashAdjustment: 0,
      currency: 'EUR',
      myCommission: 16,
      certificationRequired: false,
      proposerReceived: false,
      // Colonne absente (schéma antérieur) : échéance inconnue, jamais inventée.
      expiresAt: null,
    });
    expect(rowToExchangeProposal({ ...exchange, expires_at: '2026-10-08T00:00:00Z' }).expiresAt).toBe(
      '2026-10-08T00:00:00Z',
    );
    expect(rowToExchangeProposal({ ...exchange, expires_at: null }).expiresAt).toBeNull();
    const certification: CertificationRow = {
      id: 'c1',
      listing_id: null,
      order_id: null,
      exchange_id: 'x1',
      item_title: 'Montre',
      domain: 'watch',
      reason: 'threshold',
      status: 'in_review',
      fee_payer: 'seller',
      fee_amount: '60',
      requested_by_me: null,
      counterparty_agreed: true,
      report_ref: null,
      expert_note: null,
      created_at: '2026-10-01T00:00:00Z',
      decided_at: null,
    };
    expect(rowToCertificationRequest(certification)).toMatchObject({
      exchangeId: 'x1',
      feeAmount: 60,
      requestedByMe: false,
      counterpartyAgreed: true,
    });
    const message: MarketMessageRow = {
      id: 'm1',
      thread_kind: 'exchange',
      thread_id: 'x1',
      mine: null,
      author_alias: null,
      body: 'Bonjour',
      redacted: null,
      created_at: '2026-10-01T00:00:00Z',
    };
    expect(rowToMarketMessage(message)).toEqual({
      id: 'm1',
      threadKind: 'exchange',
      threadId: 'x1',
      mine: false,
      authorAlias: 'Membre VELUM',
      body: 'Bonjour',
      redacted: false,
      createdAt: '2026-10-01T00:00:00Z',
    });
  });

  it('jsonToCommissionSummary : jsonb inattendu ⇒ zéros, jamais NaN', () => {
    expect(jsonToCommissionSummary(null)).toEqual({
      currency: 'EUR',
      currentRate: 0,
      completedSales: 0,
      commissions: 0,
      certificationFees: 0,
      payouts: 0,
      entries: 0,
    });
    expect(jsonToCommissionSummary(['x'])).toMatchObject({ commissions: 0 });
    expect(jsonToCommissionSummary({ commissions: '12.5', payouts: 'abc', currency: 'EUR' })).toMatchObject({
      commissions: 12.5,
      payouts: 0,
    });
  });
});
