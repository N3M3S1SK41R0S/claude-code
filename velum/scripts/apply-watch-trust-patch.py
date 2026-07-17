from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: motif attendu {expected} fois, trouvé {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


plugin = "velum/packages/domains/watch/src/plugin.ts"
replace_exact(plugin, "  type SourceRef,\n", "")
replace_exact(
    plugin,
    """/** Références éditoriales par défaut si le moteur n'en cite aucune. */
const DEFAULT_ANALYSIS_SOURCES: readonly SourceRef[] = [
  { name: 'WatchCharts — cotes de marché', kind: 'official_quote', url: 'https://watchcharts.com' },
  { name: 'Archives constructeurs (Rolex, Omega…)', kind: 'official_quote' },
];

""",
    "",
)
replace_exact(
    plugin,
    """function toSourceRefs(v: unknown): SourceRef[] {
  if (!Array.isArray(v)) return [];
  const out: SourceRef[] = [];
  for (const entry of v) {
    if (typeof entry === 'string' && entry.trim() !== '') {
      out.push({ name: entry.trim(), kind: 'official_quote' });
      continue;
    }
    if (isRecord(entry) && typeof entry['name'] === 'string' && entry['name'].trim() !== '') {
      const ref: SourceRef = { name: entry['name'].trim(), kind: 'official_quote' };
      if (typeof entry['url'] === 'string') ref.url = entry['url'];
      out.push(ref);
    }
  }
  return out;
}

""",
    "",
)
replace_exact(
    plugin,
    '  "sources"?: [{"name":string, "url"?:string}]\n',
    "",
)
replace_exact(plugin, "    const cited = toSourceRefs(parsed['sources']);\n\n", "")
replace_exact(
    plugin,
    "      sources: cited.length > 0 ? cited : [...DEFAULT_ANALYSIS_SOURCES],",
    "      // L'analyse LLM n'est pas une source de marché. Les références ne sont\n"
    "      // publiées que par les adaptateurs ayant réellement récupéré une donnée.\n"
    "      sources: [],",
)

plugin_test = "velum/packages/domains/watch/src/plugin.test.ts"
replace_exact(
    plugin_test,
    "    expect(result.sources.length).toBeGreaterThan(0);",
    "    expect(result.sources).toEqual([]);",
    expected=2,
)
replace_exact(
    plugin_test,
    "    // Aucune source citée → références éditoriales par défaut.\n",
    "    // Une réponse LLM ne devient jamais une provenance de marché.\n",
)

migration = "velum/supabase/migrations/20260716120000_calibration_cron.sql"
replace_exact(migration, "pour les 4 domaines", "pour les 5 domaines")
replace_exact(migration, "Fan-out sources + backtest 4 domaines", "Fan-out sources + backtest 5 domaines")

# Checklist de déploiement : les sources montres exigent clé ET agrément.
deployment = "velum/docs/DEPLOYMENT.md"
replace_exact(
    deployment,
    "- [ ] `supabase secrets set --env-file supabase/functions/.env` — d'après `supabase/functions/.env.example` : `LLM_VISION_API_KEY`, `LLM_VISION_PROVIDER`, `NUMISTA_API_KEY`, `ARTPRICE_API_KEY`, `EBAY_API_KEY`, `COLNECT_API_KEY`, `DELCAMPE_API_KEY`, `FX_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`. **Aucun de ces secrets côté client.**",
    "- [ ] `supabase secrets set --env-file supabase/functions/.env` — partir du modèle exhaustif. Pour les montres, une clé ne suffit pas : activer `WATCHCHARTS_APP_LICENSED`, `HERITAGE_WATCH_API_ENABLED`, `EBAY_MARKETPLACE_INSIGHTS_ENABLED`, `CATAWIKI_WATCH_API_ENABLED` ou `CHRONO24_WATCH_API_ENABLED` uniquement après confirmation contractuelle. **Aucun secret côté client.**",
)

# Le script est ponctuel et doit disparaître du commit produit.
Path(__file__).unlink()
