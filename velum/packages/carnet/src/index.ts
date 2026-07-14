/**
 * @velum/carnet — logique patrimoniale transversale (paris #8, #10, QW #4).
 * Provenance à hash chaîné, rapport assurance/succession, cartes & musée.
 * Pur, déterministe, portable (horodatages fournis, jamais Date.now()).
 */
export { sha256 } from './hash';

export {
  createPassport,
  appendEvent,
  verifyPassport,
  linkHash,
  provenanceSummary,
  type ProvenanceEvent,
  type ProvenanceEventType,
  type ProvenanceLink,
  type ProvenancePassport,
  type PassportVerification,
} from './provenance';

export {
  buildInsuranceReport,
  REPORT_DISCLAIMERS,
  type ReportItem,
  type InsuranceReport,
  type ReportDomainLine,
} from './report';

export {
  buildShareCard,
  buildMuseumGallery,
  confidenceBadge,
  BADGE_THRESHOLDS,
  type ShareCard,
  type ShareCardInput,
  type ConfidenceBadge,
  type MuseumExhibit,
  type MuseumGalleryInput,
} from './card';
