from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: motif attendu une fois, trouvé {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


carnet_path = Path("velum/apps/mobile/app/carnet.tsx")
carnet = carnet_path.read_text(encoding="utf-8")

wine_groups = """  const wineGroups = useMemo(
    () => (domain === 'wine' ? groupByLocation(domainItems) : []),
    [domain, domainItems],
  );
"""
watch_groups = wine_groups + """  const watchGroups = useMemo(
    () => (domain === 'watch' ? groupByLocation(domainItems) : []),
    [domain, domainItems],
  );
"""
if "const watchGroups = useMemo" not in carnet:
    if carnet.count(wine_groups) != 1:
        raise SystemExit("carnet.tsx: bloc wineGroups introuvable")
    carnet = carnet.replace(wine_groups, watch_groups, 1)

carnet = carnet.replace(
    "{/* Sélecteur de module (chips des 4 domaines actifs) */}",
    "{/* Sélecteur de module (chips des 5 domaines actifs) */}",
    1,
)

watch_block = """
      {/* ÉCRIN — montres groupées par emplacement physique. */}
      {domain === 'watch'
        ? watchGroups.map((group) => {
            const groupTotals = bookTotals(group.items, latestByItem);
            const groupValuationFailures = countFailedValuations(
              group.items,
              failedValuationItemIds,
            );
            return (
              <View key={`watch:${group.location ?? '__no_location__'}`} style={styles.group}>
                <View style={styles.groupHeader}>
                  <VText variant="heading" tone="gold">
                    {group.location ?? t('carnet.noLocation')}
                  </VText>
                  <VText variant="caption" tone="dim">
                    {`${t('carnet.itemsCount', { count: group.items.length })}${
                      groupTotals.valuedCount > 0 && groupValuationFailures === 0
                        ? ` · ${formatEUR(groupTotals.totalEUR)}`
                        : ''
                    }`}
                  </VText>
                </View>
                {group.items.map((item) => {
                  const latest = latestByItem[item.id] ?? null;
                  const reference = attributeString(item, 'reference');
                  const year = attributeNumber(item, 'year');
                  const parts: string[] = [];
                  if (reference) parts.push(reference);
                  if (year !== null) parts.push(String(year));
                  parts.push(
                    failedValuationIds.has(item.id)
                      ? t('errors.SOURCE_UNAVAILABLE')
                      : latest
                        ? formatEUR(latest.central)
                        : t('item.noValuation'),
                  );
                  return (
                    <View key={item.id} style={styles.caveRow}>
                      <Pressable
                        style={({ pressed }) => [styles.caveInfo, pressed && styles.pressed]}
                        onPress={() => openItem(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.title ?? t('common.unknown')}, ${parts.join(' · ')}`}
                      >
                        <VText variant="body">{item.title ?? t('common.unknown')}</VText>
                        <VText variant="caption" tone="dim">
                          {parts.join(' · ')}
                        </VText>
                      </Pressable>
                      {moveAction(item)}
                    </View>
                  );
                })}
              </View>
            );
          })
        : null}

"""
footer_marker = "      <View style={styles.footer}>"
if "{/* ÉCRIN — montres groupées" not in carnet:
    if carnet.count(footer_marker) != 1:
        raise SystemExit("carnet.tsx: footer attendu une fois")
    carnet = carnet.replace(footer_marker, watch_block + footer_marker, 1)

carnet_path.write_text(carnet, encoding="utf-8")

replace_once(
    "velum/e2e/auth-screens.mjs",
    "await screen('07-carnet', '/carnet', 'Bandol Domaine Tempier 2016');",
    """await screen('07-carnet', '/carnet', 'Bandol Domaine Tempier 2016');
// 07b. Écrin — le cinquième carnet doit rendre ses montres, pas un panneau vide.
await screen('07b-carnet-montres', '/carnet', 'Omega Speedmaster Professional 3570.50', async () => {
  await page.getByText('Écrin', { exact: true }).first().click();
  await page.waitForTimeout(300);
});""",
)

replacements = {
    "velum/apps/mobile/locales/fr.json": [
        (
            '"collectionHint": "Cave, cabinet, galerie, album"',
            '"collectionHint": "Cave, cabinet, galerie, album, écrin"',
        ),
        (
            '"features": "5 scans par semaine pour CHAQUE module (Vin, Pièces, Tableaux, Timbres) · fiche d\'analyse et estimation"',
            '"features": "5 scans par semaine pour CHAQUE module (Vin, Pièces, Tableaux, Timbres, Montres) · fiche d\'analyse et estimation"',
        ),
        (
            '"features": "Scans illimités sur les 4 modules · exports PDF/CSV · alertes de cote — sans carnet virtuel"',
            '"features": "Scans illimités sur les 5 modules · exports PDF/CSV · alertes de cote — sans carnet virtuel"',
        ),
        (
            '"features": "Tout Premium + carnet virtuel : cave à vin avec emplacements, table de pièces, galerie, album philatélique · sommelier de cave (quel vin de MA cave pour ce plat ?)"',
            '"features": "Tout Premium + carnet virtuel : cave à vin avec emplacements, table de pièces, galerie, album philatélique, écrin à montres · sommelier de cave (quel vin de MA cave pour ce plat ?)"',
        ),
    ],
    "velum/apps/mobile/locales/en.json": [
        (
            '"collectionHint": "Cellar, cabinet, gallery, album"',
            '"collectionHint": "Cellar, cabinet, gallery, album, watch box"',
        ),
        (
            '"features": "5 scans per week for EACH module (Wine, Coins, Paintings, Stamps) · analysis sheet and estimate"',
            '"features": "5 scans per week for EACH module (Wine, Coins, Paintings, Stamps, Watches) · analysis sheet and estimate"',
        ),
        (
            '"features": "Unlimited scans across all 4 modules · PDF/CSV exports · price alerts — without the virtual book"',
            '"features": "Unlimited scans across all 5 modules · PDF/CSV exports · price alerts — without the virtual book"',
        ),
        (
            '"features": "Everything in Premium + virtual book: wine cellar with slot locations, coin table, gallery, stamp album · cellar sommelier (which wine from MY cellar for tonight\'s dish?)"',
            '"features": "Everything in Premium + virtual book: wine cellar with slot locations, coin table, gallery, stamp album, watch box · cellar sommelier (which wine from MY cellar for tonight\'s dish?)"',
        ),
    ],
}
for path, pairs in replacements.items():
    for old, new in pairs:
        replace_once(path, old, new)
