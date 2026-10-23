/**
 * Plat → vins de MA cave, en local : appariement DÉTERMINISTE (sans IA,
 * gratuit, hors-ligne, instantané). Il complète — sans le remplacer — le
 * sommelier IA de l'Edge Function `cellar-pairing`.
 *
 * Principe :
 *  1. le plat est ramené à des CATÉGORIES par mots-clés (poisson, agneau,
 *     chèvre, épicé, dessert…) ; chaque catégorie pondère des FAMILLES de vins
 *     (blanc vif, rouge structuré, liquoreux…) ;
 *  2. chaque vin de la cave est classé dans ces familles d'après sa couleur,
 *     son appellation, ses cépages et son libellé ;
 *  3. score = adéquation famille (70 %) + recoupement avec les accords ZAPPA
 *     de sa fiche (25 %) + ajustement d'apogée, plafonné à 0,95 : des règles
 *     ne valent jamais une dégustation.
 * Si rien ne convient vraiment, on propose des styles / appellations à acheter.
 */
import type {
  CellarWineEntry,
  DishCategory,
  DrinkWindowPhase,
  LocalPairingResult,
  LocalPairingSuggestion,
  WineFamily,
} from '@velum/core';
import { peakStatus } from './peak.ts';

/** Seuil en dessous duquel un vin n'est pas présenté comme « convenable ». */
export const LOCAL_PAIRING_THRESHOLD = 0.5;
/** Plafond de confiance d'un appariement par règles. */
export const LOCAL_PAIRING_MAX_SCORE = 0.95;

type FamilyWeights = Partial<Record<WineFamily, number>>;

const FAMILIES: readonly WineFamily[] = [
  'white_crisp',
  'white_rich',
  'white_aromatic',
  'rose',
  'red_light',
  'red_medium',
  'red_structured',
  'sparkling',
  'sweet',
  'fortified',
];

/** Libellés français des familles (raisons courtes). */
export const WINE_FAMILY_LABELS_FR: Record<WineFamily, string> = {
  white_crisp: 'Blanc sec et vif',
  white_rich: 'Blanc ample',
  white_aromatic: 'Blanc aromatique',
  rose: 'Rosé',
  red_light: 'Rouge léger et fruité',
  red_medium: 'Rouge souple',
  red_structured: 'Rouge structuré',
  sparkling: 'Effervescent',
  sweet: 'Vin moelleux ou liquoreux',
  fortified: 'Vin doux naturel',
};

/** Libellés français des catégories de plats (« accord classique avec … »). */
export const DISH_CATEGORY_LABELS_FR: Record<DishCategory, string> = {
  shellfish: 'les fruits de mer',
  fish: 'le poisson',
  poultry: 'la volaille',
  duck: 'le canard',
  pork: 'le porc',
  charcuterie: 'la charcuterie',
  veal: 'le veau',
  red_meat: 'le bœuf',
  lamb: 'l’agneau',
  game: 'le gibier',
  goat_cheese: 'le chèvre',
  blue_cheese: 'les bleus',
  hard_cheese: 'les pâtes dures',
  soft_cheese: 'les pâtes molles',
  alpine_cheese: 'les plats savoyards',
  cheese: 'les fromages',
  foie_gras: 'le foie gras',
  spicy_asian: 'les plats épicés ou asiatiques',
  north_african: 'les tajines et couscous',
  alsatian: 'la cuisine alsacienne',
  pasta_pizza: 'les pâtes et pizzas',
  risotto: 'le risotto',
  mushroom: 'les champignons',
  grill: 'les grillades',
  vegetable: 'les légumes',
  aperitif: 'l’apéritif',
  fruit_dessert: 'les desserts aux fruits',
  chocolate: 'le chocolat',
};

/**
 * Niveau d'une règle :
 *  - 'main'    : ingrédient salé principal (viande, poisson, fromage…) ;
 *  - 'dessert' : dessert affirmé — ignoré si un ingrédient salé est présent
 *                (« canard glacé au miel » reste un plat de canard) ;
 *  - 'style'   : cuisine / préparation — se combine avec l'ingrédient ;
 *  - 'garnish' : garniture — retenue seulement à défaut de tout autre indice
 *                (« magret aux figues » reste un plat de canard).
 */
type RuleLevel = 'main' | 'dessert' | 'style' | 'garnish';

interface DishRule {
  category: DishCategory;
  level: RuleLevel;
  /** Mots-clés normalisés ; suffixe `*` = préfixe (« epice* » → épicé, épices). */
  keywords: readonly string[];
  families: FamilyWeights;
  purchaseIdeas: readonly string[];
}

const DISH_RULES: readonly DishRule[] = [
  {
    category: 'shellfish',
    level: 'main',
    keywords: ['huitre', 'fruits de mer', 'fruit de mer', 'crustace*', 'langoustine', 'homard', 'langouste', 'crevette', 'gambas', 'moule', 'saint jacques', 'st jacques', 'coquille', 'bulot', 'palourde', 'crabe', 'tourteau', 'oursin', 'calamar', 'seiche', 'poulpe', 'encornet', 'bigorneau', 'plateau de mer'],
    families: { white_crisp: 1, sparkling: 0.85, white_aromatic: 0.5, white_rich: 0.45, rose: 0.3 },
    purchaseIdeas: ['Muscadet sur lie', 'Chablis', 'Picpoul de Pinet', 'Champagne brut'],
  },
  {
    category: 'fish',
    level: 'main',
    keywords: ['poisson', 'sole', 'bar', 'loup', 'cabillaud', 'saumon', 'thon', 'truite', 'dorade', 'daurade', 'turbot', 'merlu', 'colin', 'lotte', 'sardine', 'maquereau', 'rouget', 'bouillabaisse', 'brandade', 'morue', 'raie', 'sandre', 'brochet', 'eglefin', 'haddock', 'fletan', 'espadon', 'anchois', 'sushi', 'sashimi', 'maki', 'ceviche', 'poke', 'saint pierre', 'merlan', 'lieu', 'perche', 'friture'],
    families: { white_crisp: 1, white_rich: 0.8, sparkling: 0.6, rose: 0.5, white_aromatic: 0.4, red_light: 0.25 },
    purchaseIdeas: ['Sancerre', 'Pouilly-Fumé', 'Chablis premier cru', 'Bourgogne blanc'],
  },
  {
    category: 'poultry',
    level: 'main',
    keywords: ['poulet', 'volaille', 'dinde', 'chapon', 'pintade', 'caille', 'coquelet', 'poularde', 'poule', 'lapin', 'blanc de poulet', 'coq au vin'],
    families: { red_light: 1, white_rich: 0.9, red_medium: 0.65, rose: 0.5, white_crisp: 0.45 },
    purchaseIdeas: ['Bourgogne rouge (pinot noir)', 'Beaujolais cru (Morgon, Fleurie)', 'Mâcon-Villages'],
  },
  {
    category: 'duck',
    level: 'main',
    keywords: ['canard', 'magret', 'oie', 'cassoulet', 'aiguillette'],
    families: { red_medium: 1, red_structured: 0.85, red_light: 0.6 },
    purchaseIdeas: ['Madiran', 'Cahors', 'Saint-Émilion'],
  },
  {
    category: 'pork',
    level: 'main',
    keywords: ['porc', 'cochon', 'travers', 'filet mignon', 'echine', 'saucisse', 'andouillette', 'roti de porc', 'jambon braise', 'cotelette', 'porcelet', 'boudin'],
    families: { red_light: 1, red_medium: 0.75, rose: 0.7, white_rich: 0.6, white_aromatic: 0.45 },
    purchaseIdeas: ['Beaujolais', 'Côtes-du-Rhône', 'Saumur-Champigny'],
  },
  {
    category: 'charcuterie',
    level: 'main',
    keywords: ['charcuterie', 'saucisson', 'jambon', 'jambon cru', 'rillette', 'terrine', 'pate en croute', 'pate de campagne', 'coppa', 'chorizo', 'planche'],
    families: { red_light: 1, rose: 0.75, red_medium: 0.6, white_crisp: 0.45 },
    purchaseIdeas: ['Beaujolais', 'Morgon', 'Côtes-du-Rhône'],
  },
  {
    category: 'veal',
    level: 'main',
    keywords: ['veau', 'blanquette', 'ris de veau', 'escalope', 'osso buco', 'vitello', 'tete de veau', 'paupiette'],
    families: { white_rich: 1, red_light: 0.9, red_medium: 0.6 },
    purchaseIdeas: ['Meursault', 'Chinon', 'Mercurey'],
  },
  {
    category: 'red_meat',
    level: 'main',
    keywords: ['boeuf', 'entrecote', 'cote de boeuf', 'steak', 'faux filet', 'rumsteck', 'bavette', 'onglet', 'hampe', 'tournedos', 'chateaubriand', 'rosbif', 'bourguignon', 'daube', 'pot au feu', 'burger', 'hamburger', 'viande rouge', 'carpaccio', 'tartare de boeuf', 'paleron', 'joue de boeuf', 'chili con carne', 'hachis parmentier'],
    families: { red_structured: 1, red_medium: 0.85, red_light: 0.35 },
    purchaseIdeas: ['Pauillac', 'Saint-Julien', 'Cornas', 'Madiran'],
  },
  {
    category: 'lamb',
    level: 'main',
    keywords: ['agneau', 'gigot', 'souris', 'carre d agneau', 'mechoui', 'navarin', 'epaule d agneau', 'mouton'],
    families: { red_structured: 1, red_medium: 0.9, rose: 0.3 },
    purchaseIdeas: ['Bandol rouge', 'Pauillac', 'Saint-Joseph'],
  },
  {
    category: 'game',
    level: 'main',
    keywords: ['gibier', 'chevreuil', 'sanglier', 'lievre', 'faisan', 'perdreau', 'perdrix', 'pigeon', 'biche', 'cerf', 'civet', 'becasse', 'palombe', 'grouse', 'colvert'],
    families: { red_structured: 1, red_medium: 0.75 },
    purchaseIdeas: ['Côte-Rôtie', 'Hermitage', 'Pomerol', 'Gevrey-Chambertin'],
  },
  {
    category: 'goat_cheese',
    level: 'main',
    keywords: ['chevre', 'crottin', 'sainte maure', 'valencay', 'selles sur cher', 'chabichou', 'picodon', 'rocamadour', 'pouligny'],
    families: { white_crisp: 1, white_aromatic: 0.55, rose: 0.4, red_light: 0.4 },
    purchaseIdeas: ['Sancerre', 'Menetou-Salon', 'Quincy'],
  },
  {
    category: 'blue_cheese',
    level: 'main',
    keywords: ['roquefort', 'fourme', 'gorgonzola', 'stilton', 'persille', 'fromage bleu', 'bleu d auvergne', 'bleu de gex', 'bleu des causses', 'bleu du vercors'],
    families: { sweet: 1, fortified: 0.85, white_aromatic: 0.35 },
    purchaseIdeas: ['Sauternes', 'Banyuls', 'Porto vintage'],
  },
  {
    category: 'hard_cheese',
    level: 'main',
    keywords: ['comte', 'beaufort', 'gruyere', 'parmesan', 'parmigiano', 'mimolette', 'cantal', 'abondance', 'salers', 'emmental', 'tomme', 'ossau iraty', 'manchego', 'gouda', 'pecorino'],
    families: { white_rich: 1, red_medium: 0.65, white_crisp: 0.5, fortified: 0.4 },
    purchaseIdeas: ['Vin jaune du Jura', 'Côtes du Jura chardonnay', 'Meursault'],
  },
  {
    category: 'soft_cheese',
    level: 'main',
    keywords: ['brie', 'camembert', 'coulommiers', 'livarot', 'pont l eveque', 'maroilles', 'epoisses', 'langres', 'vacherin', 'mont d or', 'chaource', 'saint marcellin', 'brillat savarin'],
    families: { red_light: 0.9, white_rich: 0.9, sparkling: 0.75, red_medium: 0.5 },
    purchaseIdeas: ['Champagne', 'Bourgogne rouge', 'Saint-Véran'],
  },
  {
    category: 'alpine_cheese',
    level: 'main',
    keywords: ['raclette', 'fondue', 'tartiflette', 'reblochon', 'croziflette', 'diots'],
    families: { white_crisp: 1, white_rich: 0.6, red_light: 0.55 },
    purchaseIdeas: ['Apremont (Savoie)', 'Chignin-Bergeron', 'Roussette de Savoie'],
  },
  {
    category: 'cheese',
    level: 'main',
    keywords: ['fromage', 'plateau de fromage'],
    families: { white_rich: 0.85, red_medium: 0.8, red_light: 0.7, white_crisp: 0.6, sweet: 0.5 },
    purchaseIdeas: ['Côtes du Jura', 'Bourgogne rouge', 'Saint-Joseph'],
  },
  {
    category: 'foie_gras',
    level: 'main',
    keywords: ['foie gras'],
    families: { sweet: 1, white_aromatic: 0.65, sparkling: 0.5, fortified: 0.4 },
    purchaseIdeas: ['Sauternes', 'Jurançon moelleux', 'Gewurztraminer vendanges tardives'],
  },
  {
    category: 'aperitif',
    level: 'main',
    keywords: ['aperitif', 'apero', 'amuse bouche', 'gougere', 'tapas', 'canape', 'blinis', 'toast', 'verrine', 'mise en bouche'],
    families: { sparkling: 1, white_crisp: 0.8, rose: 0.7, white_aromatic: 0.5 },
    purchaseIdeas: ['Champagne brut', 'Crémant de Bourgogne', 'Muscadet'],
  },
  {
    category: 'chocolate',
    level: 'dessert',
    keywords: ['chocolat*', 'brownie', 'foret noire', 'cacao', 'truffe au chocolat'],
    families: { fortified: 1, sweet: 0.6, red_structured: 0.25 },
    purchaseIdeas: ['Banyuls', 'Maury', 'Porto tawny'],
  },
  {
    category: 'fruit_dessert',
    level: 'dessert',
    keywords: ['dessert', 'salade de fruits', 'gateau', 'tatin', 'clafoutis', 'crumble', 'sorbet', 'patisserie', 'macaron', 'creme brulee', 'millefeuille', 'mille feuille', 'eclair', 'crepe', 'tiramisu', 'panna cotta', 'baba', 'savarin', 'charlotte', 'entremets', 'glace', 'ile flottante', 'galette des rois', 'meringue', 'pavlova', 'financier', 'madeleine', 'cheesecake', 'flan', 'creme caramel', 'riz au lait'],
    families: { sweet: 1, sparkling: 0.75, fortified: 0.4, white_aromatic: 0.3 },
    purchaseIdeas: ['Coteaux du Layon', 'Crémant demi-sec', 'Muscat de Beaumes-de-Venise'],
  },
  {
    category: 'spicy_asian',
    level: 'style',
    keywords: ['epice*', 'curry', 'piment*', 'thai', 'thailandais*', 'indien*', 'tandoori', 'tikka', 'masala', 'massala', 'asiatique', 'chinois*', 'vietnamien*', 'japonais*', 'pad thai', 'nem', 'wok', 'sichuan', 'szechuan', 'kimchi', 'ramen', 'bo bun', 'dim sum', 'laque*', 'gingembre', 'cajun', 'mexicain*', 'teriyaki', 'tom yum'],
    families: { white_aromatic: 1, rose: 0.7, sparkling: 0.55, red_light: 0.5, white_crisp: 0.45 },
    purchaseIdeas: ['Gewurztraminer', 'Riesling d’Alsace', 'Tavel rosé'],
  },
  {
    category: 'north_african',
    level: 'style',
    keywords: ['tajine', 'tagine', 'couscous', 'merguez', 'pastilla', 'harissa', 'kefta', 'chorba'],
    families: { rose: 1, red_medium: 0.9, red_light: 0.6 },
    purchaseIdeas: ['Tavel rosé', 'Côtes-du-Rhône Villages', 'Languedoc rouge (grenache)'],
  },
  {
    category: 'alsatian',
    level: 'style',
    keywords: ['choucroute', 'baeckeoffe', 'flammekueche', 'tarte flambee', 'munster', 'spaetzle', 'kouglof'],
    families: { white_aromatic: 1, white_crisp: 0.8, red_light: 0.4 },
    purchaseIdeas: ['Riesling d’Alsace', 'Sylvaner', 'Pinot gris'],
  },
  {
    category: 'pasta_pizza',
    level: 'style',
    keywords: ['pizza', 'pates', 'pasta', 'spaghetti', 'lasagne', 'bolognaise', 'carbonara', 'tagliatelle', 'penne', 'ravioli', 'gnocchi', 'linguine', 'cannelloni', 'macaroni'],
    families: { red_medium: 1, red_light: 0.85, rose: 0.6 },
    purchaseIdeas: ['Chianti Classico', 'Côtes-du-Rhône', 'Montepulciano d’Abruzzo'],
  },
  {
    category: 'risotto',
    level: 'style',
    keywords: ['risotto', 'paella'],
    families: { white_rich: 1, white_crisp: 0.6, red_light: 0.55 },
    purchaseIdeas: ['Mâcon-Villages', 'Soave', 'Bourgogne blanc'],
  },
  {
    category: 'mushroom',
    level: 'style',
    keywords: ['champignon', 'cepe', 'girolle', 'morille', 'truffe', 'trompette', 'chanterelle', 'forestiere', 'shiitake', 'pleurote'],
    families: { red_light: 1, white_rich: 0.85, red_medium: 0.7 },
    purchaseIdeas: ['Bourgogne rouge (pinot noir)', 'Volnay', 'Meursault'],
  },
  {
    category: 'grill',
    level: 'style',
    keywords: ['barbecue', 'bbq', 'grillade', 'plancha', 'brochette', 'grille*'],
    families: { red_medium: 1, rose: 0.8, red_structured: 0.75, red_light: 0.6 },
    purchaseIdeas: ['Côtes-du-Rhône Villages', 'Languedoc', 'Bandol rosé'],
  },
  {
    category: 'vegetable',
    level: 'garnish',
    keywords: ['salade', 'legume*', 'vegetarien*', 'vegan*', 'ratatouille', 'tian', 'crudite*', 'tomate', 'aubergine', 'courgette', 'poivron', 'asperge', 'artichaut', 'taboule', 'soupe', 'veloute', 'quiche', 'gaspacho', 'houmous', 'falafel', 'epinard', 'poireau'],
    families: { rose: 1, white_crisp: 0.9, white_aromatic: 0.5, red_light: 0.45 },
    purchaseIdeas: ['Côtes de Provence rosé', 'Sauvignon de Touraine', 'Bandol rosé'],
  },
  {
    category: 'fruit_dessert',
    level: 'garnish',
    keywords: ['pomme', 'poire', 'abricot', 'peche', 'fraise', 'framboise', 'fruits rouges', 'citron', 'figue', 'orange', 'cerise', 'mirabelle', 'ananas', 'mangue', 'myrtille', 'prune', 'agrume*', 'caramel', 'vanille', 'praline', 'miel'],
    families: { sweet: 1, sparkling: 0.75, fortified: 0.4, white_aromatic: 0.3 },
    purchaseIdeas: ['Coteaux du Layon', 'Crémant demi-sec', 'Muscat de Beaumes-de-Venise'],
  },
];

/**
 * Locutions qui provoqueraient de faux indices : « pommes de terre » n'est
 * pas un dessert, le « foie gras de canard » n'est pas un plat de canard, un
 * « carpaccio de saumon » ou un « steak de thon » n'est pas du bœuf.
 */
const NEUTRALIZED_PHRASES: readonly [RegExp, string][] = [
  [/\bpommes? (de terre|frites|sautees|dauphines?|vapeur|puree|allumettes|duchesses?|anna|boulangeres?|fondantes?)\b/g, 'patates'],
  [/\bfeuilles? de chene\b/g, 'salade'],
  [/\bfoie gras (de canard|d oie)\b/g, 'foie gras'],
  [
    /\b(carpaccio|steak|tartare|pave)s? de (saumon|thon|truite|cabillaud|lotte|merlu|saint jacques|st jacques|dorade|daurade|bar|poisson|espadon)\b/g,
    '$2',
  ],
];

/**
 * « pâté(s) » (charcuterie) ≠ « pâtes » : la distinction ne tient qu'à
 * l'accent, perdu à la normalisation — on la fait AVANT. Garde explicite
 * plutôt que `\b`, qui ne voit pas de frontière après « é » sans drapeau u.
 */
const PATE_CHARCUTERIE = /(^|[^a-zà-ÿ])p[âa]tés?(?![a-zà-ÿ])/g;

const STOPWORDS: ReadonlySet<string> = new Set([
  'avec', 'sans', 'sauce', 'plat', 'plats', 'maison', 'facon', 'recette', 'petit', 'petits',
  'petite', 'grand', 'grande', 'cuit', 'cuite', 'fait', 'leger', 'legere', 'base', 'notre',
  'votre', 'pour', 'dans', 'aux', 'des', 'les', 'une', 'son', 'ses', 'puis', 'tres', 'bien',
]);

/** Minuscules, sans accents ni ligatures, ponctuation → espaces. */
export function normalizeDishText(value: string): string {
  let text = value
    .toLowerCase()
    .replace(PATE_CHARCUTERIE, '$1terrine')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [pattern, replacement] of NEUTRALIZED_PHRASES) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const keywordPatternCache = new Map<string, RegExp>();

/** Expression d'un mot-clé : mot entier (pluriel s/x/es toléré) ou préfixe `*`. */
function keywordPattern(keyword: string): RegExp {
  const cached = keywordPatternCache.get(keyword);
  if (cached) return cached;
  const prefix = keyword.endsWith('*');
  const core = escapeRegExp(prefix ? keyword.slice(0, -1) : keyword);
  const pattern = new RegExp(`(?:^| )${core}${prefix ? '[a-z]*' : '(?:s|x|es)?'}(?= |$)`);
  keywordPatternCache.set(keyword, pattern);
  return pattern;
}

function hasKeyword(text: string, keyword: string): boolean {
  return keywordPattern(keyword).test(text);
}

/**
 * Règles retenues pour un texte de plat déjà normalisé : ingrédient salé
 * (+ styles), sinon dessert, sinon styles seuls, sinon garnitures.
 */
function activeRules(normalizedDish: string): DishRule[] {
  if (normalizedDish.length === 0) return [];
  const matched = DISH_RULES.filter((rule) => rule.keywords.some((kw) => hasKeyword(normalizedDish, kw)));
  const byLevel = (level: RuleLevel) => matched.filter((rule) => rule.level === level);
  const main = byLevel('main');
  const style = byLevel('style');
  if (main.length > 0) return [...main, ...style];
  const dessert = byLevel('dessert');
  if (dessert.length > 0) return dessert;
  if (style.length > 0) return style;
  return byLevel('garnish');
}

function uniqueCategories(rules: readonly DishRule[]): DishCategory[] {
  const out: DishCategory[] = [];
  for (const rule of rules) if (!out.includes(rule.category)) out.push(rule.category);
  return out;
}

/** Catégories reconnues pour un plat (ordre : ingrédient principal d'abord). */
export function dishCategories(dish: string): DishCategory[] {
  return uniqueCategories(activeRules(normalizeDishText(dish)));
}

/**
 * Familles qu'un mode de cuisson ou une cuisine (règle 'style') ne peut PAS
 * imposer face à l'ingrédient principal : « dorade grillée » ou « brochettes
 * de Saint-Jacques » ne réclament pas un rouge parce que c'est grillé.
 */
const STYLE_CLASHES: Partial<Record<DishCategory, readonly WineFamily[]>> = {
  fish: ['red_medium', 'red_structured'],
  shellfish: ['red_light', 'red_medium', 'red_structured'],
  foie_gras: ['red_light', 'red_medium', 'red_structured'],
};

/** Familles en conflit avec les ingrédients principaux actifs. */
function clashedFamilies(rules: readonly DishRule[]): ReadonlySet<WineFamily> {
  const clashed = new Set<WineFamily>();
  for (const rule of rules) {
    if (rule.level !== 'main') continue;
    for (const family of STYLE_CLASHES[rule.category] ?? []) clashed.add(family);
  }
  return clashed;
}

/** Poids d'une famille pour une règle (0 : style en conflit avec l'ingrédient). */
function ruleWeight(rule: DishRule, family: WineFamily, clashed: ReadonlySet<WineFamily>): number {
  if (rule.level === 'style' && clashed.has(family)) return 0;
  return rule.families[family] ?? 0;
}

/** Poids voulu de chaque famille : maximum sur les règles actives (hors conflits). */
function wantedWeights(rules: readonly DishRule[], clashed: ReadonlySet<WineFamily>): FamilyWeights {
  const weights: FamilyWeights = {};
  for (const rule of rules) {
    for (const family of FAMILIES) {
      const w = ruleWeight(rule, family, clashed);
      if (w > 0 && w > (weights[family] ?? 0)) weights[family] = w;
    }
  }
  return weights;
}

/* ------------------------------------------------------------------ */
/* Classement d'un vin de la cave en familles                          */
/* ------------------------------------------------------------------ */

type WineColor = 'red' | 'white' | 'rose' | 'sparkling' | 'orange';

interface KeywordGroup {
  keywords: readonly string[];
  weights: FamilyWeights;
}

const FORTIFIED: KeywordGroup = {
  keywords: ['banyuls', 'maury', 'rivesaltes', 'porto', 'port', 'madere', 'madeira', 'xeres', 'jerez', 'sherry', 'marsala', 'pineau des charentes', 'vin doux naturel', 'vdn', 'muscat de beaumes de venise', 'muscat de rivesaltes', 'muscat de frontignan', 'muscat de lunel', 'muscat de mireval'],
  weights: { fortified: 1, sweet: 0.7 },
};

const SWEET: KeywordGroup = {
  keywords: ['sauternes', 'barsac', 'loupiac', 'cadillac', 'sainte croix du mont', 'monbazillac', 'coteaux du layon', 'quarts de chaume', 'bonnezeaux', 'moelleux', 'liquoreux', 'vendanges tardives', 'vendange tardive', 'selection de grains nobles', 'sgn', 'tokaji', 'tokay', 'passito', 'eiswein', 'icewine', 'ice wine', 'beerenauslese', 'trockenbeerenauslese', 'vin de paille', 'jurancon'],
  weights: { sweet: 1, white_aromatic: 0.45 },
};

const SPARKLING: KeywordGroup = {
  keywords: ['champagne', 'cremant', 'prosecco', 'cava', 'petillant', 'pet nat', 'petnat', 'blanquette de limoux', 'clairette de die', 'franciacorta', 'mousseux', 'spumante', 'sekt', 'brut', 'brut nature', 'extra brut', 'effervescent'],
  weights: { sparkling: 1, white_crisp: 0.5 },
};

const WHITE_GROUPS: readonly KeywordGroup[] = [
  {
    keywords: ['sancerre', 'pouilly fume', 'menetou salon', 'quincy', 'reuilly', 'muscadet', 'gros plant', 'chablis', 'petit chablis', 'picpoul', 'entre deux mers', 'sauvignon', 'albarino', 'alvarinho', 'vinho verde', 'aligote', 'sylvaner', 'apremont', 'chignin', 'jacquere', 'savoie', 'cheverny', 'touraine', 'cotes de gascogne', 'vouvray', 'montlouis', 'assyrtiko', 'gruner veltliner', 'soave', 'vermentino', 'rolle', 'saint bris', 'txakoli', 'cassis'],
    weights: { white_crisp: 1, white_aromatic: 0.35, white_rich: 0.35 },
  },
  {
    keywords: ['meursault', 'puligny montrachet', 'chassagne montrachet', 'montrachet', 'corton charlemagne', 'pouilly fuisse', 'saint aubin', 'saint veran', 'macon', 'vire clesse', 'rully', 'montagny', 'hermitage', 'crozes hermitage', 'saint joseph', 'chateauneuf du pape', 'chateauneuf', 'marsanne', 'roussanne', 'chardonnay', 'semillon', 'pessac leognan', 'graves', 'savagnin', 'arbois', 'cotes du jura', 'chateau chalon', 'vin jaune', 'chenin', 'savennieres', 'bourgogne', 'limoux'],
    weights: { white_rich: 1, white_crisp: 0.45 },
  },
  {
    keywords: ['gewurztraminer', 'gewurz', 'riesling', 'muscat', 'pinot gris', 'torrontes', 'jurancon sec', 'viognier', 'condrieu', 'alsace', 'chateau grillet'],
    weights: { white_aromatic: 1, white_crisp: 0.45, white_rich: 0.5 },
  },
];

const RED_GROUPS: readonly KeywordGroup[] = [
  {
    keywords: ['beaujolais', 'morgon', 'fleurie', 'brouilly', 'cote de brouilly', 'chiroubles', 'julienas', 'saint amour', 'regnie', 'chenas', 'gamay', 'pinot noir', 'bourgogne', 'volnay', 'beaune', 'savigny les beaune', 'chambolle musigny', 'santenay', 'mercurey', 'givry', 'marsannay', 'irancy', 'sancerre', 'menetou salon', 'alsace', 'trousseau', 'poulsard', 'grolleau', 'valpolicella', 'dolcetto', 'bardolino', 'mondeuse', 'anjou', 'touraine', 'maranges', 'monthelie', 'chorey les beaune', 'fixin', 'cote de nuits', 'hautes cotes'],
    weights: { red_light: 1, red_medium: 0.55 },
  },
  {
    keywords: ['cotes du rhone', 'cotes du rhone villages', 'vacqueyras', 'rasteau', 'cairanne', 'vinsobres', 'lirac', 'saint joseph', 'crozes hermitage', 'chinon', 'bourgueil', 'saint nicolas de bourgueil', 'saumur champigny', 'saumur', 'languedoc', 'minervois', 'corbieres', 'fitou', 'faugeres', 'saint chinian', 'pic saint loup', 'terrasses du larzac', 'costieres de nimes', 'ventoux', 'luberon', 'merlot', 'grenache', 'rioja', 'chianti', 'montepulciano', 'cotes de bourg', 'cotes de blaye', 'cotes de castillon', 'bordeaux superieur', 'bordeaux', 'haut medoc', 'medoc', 'listrac', 'moulis', 'fronsac', 'lalande de pomerol', 'cotes de provence', 'coteaux d aix', 'cabernet franc', 'zinfandel', 'pinotage', 'carmenere', 'sangiovese', 'tempranillo', 'nuits saint georges', 'pommard', 'gevrey chambertin', 'vosne romanee', 'clos de vougeot', 'morey saint denis', 'aloxe corton', 'corton', 'moulin a vent', 'marcillac', 'gaillac', 'fronton', 'buzet', 'bergerac'],
    weights: { red_medium: 1, red_light: 0.5, red_structured: 0.55 },
  },
  {
    keywords: ['pauillac', 'margaux', 'saint julien', 'saint estephe', 'pessac leognan', 'graves', 'saint emilion', 'pomerol', 'bandol', 'madiran', 'cahors', 'irouleguy', 'hermitage', 'cote rotie', 'cornas', 'chateauneuf du pape', 'chateauneuf', 'gigondas', 'barolo', 'barbaresco', 'brunello', 'amarone', 'ribera del duero', 'priorat', 'toro', 'taurasi', 'aglianico', 'cabernet sauvignon', 'cabernet', 'syrah', 'shiraz', 'mourvedre', 'tannat', 'malbec', 'nebbiolo', 'napa', 'bolgheri', 'collioure', 'pecharmant', 'maury sec'],
    weights: { red_structured: 1, red_medium: 0.65 },
  },
];

const ROSE_DEFAULT: FamilyWeights = { rose: 1, red_light: 0.3, white_crisp: 0.3 };
const ORANGE_DEFAULT: FamilyWeights = { white_rich: 0.7, white_aromatic: 0.6 };
const WHITE_DEFAULT: FamilyWeights = { white_crisp: 0.75, white_rich: 0.65, white_aromatic: 0.4 };
const RED_DEFAULT: FamilyWeights = { red_medium: 0.75, red_structured: 0.5, red_light: 0.5 };

function colorOf(raw: string | undefined, text: string): WineColor | null {
  const color = raw ? normalizeDishText(raw) : '';
  if (/^(rouge|red|tinto|rosso)/.test(color)) return 'red';
  if (/^(blanc|white|blanco|bianco)/.test(color)) return 'white';
  if (/^(rose|rosado|rosato)/.test(color)) return 'rose';
  if (/^(effervescent|sparkling|petillant|mousseux)/.test(color)) return 'sparkling';
  if (color.startsWith('orange')) return 'orange';
  // Couleur absente : indice explicite dans le libellé seulement (« rose »
  // seul est ignoré : trop de châteaux portent ce nom).
  if (hasKeyword(text, 'rouge')) return 'red';
  if (hasKeyword(text, 'blanc')) return 'white';
  return null;
}

/**
 * Poids des familles pour les mots-clés trouvés : les mots-clés LES PLUS
 * LONGS sont consommés d'abord (« crozes hermitage » ne déclenche pas aussi
 * « hermitage »).
 */
const sortedGroupCache = new WeakMap<readonly KeywordGroup[], { keyword: string; weights: FamilyWeights }[]>();

function sortedKeywords(groups: readonly KeywordGroup[]): { keyword: string; weights: FamilyWeights }[] {
  const cached = sortedGroupCache.get(groups);
  if (cached) return cached;
  const entries = groups
    .flatMap((group) => group.keywords.map((keyword) => ({ keyword, weights: group.weights })))
    .sort((a, b) => b.keyword.length - a.keyword.length);
  sortedGroupCache.set(groups, entries);
  return entries;
}

const FORTIFIED_GROUPS: readonly KeywordGroup[] = [FORTIFIED];
const SWEET_GROUPS: readonly KeywordGroup[] = [SWEET];
const SPARKLING_GROUPS: readonly KeywordGroup[] = [SPARKLING];

function groupWeights(text: string, groups: readonly KeywordGroup[]): FamilyWeights | null {
  let remaining = ` ${text} `;
  const weights: FamilyWeights = {};
  let matched = false;
  for (const { keyword, weights: w } of sortedKeywords(groups)) {
    const needle = ` ${keyword} `;
    const at = remaining.indexOf(needle);
    if (at === -1) continue;
    matched = true;
    // Consomme le mot-clé (les espaces de bord restent pour les voisins).
    remaining = `${remaining.slice(0, at + 1)}${'#'.repeat(keyword.length)}${remaining.slice(at + 1 + keyword.length)}`;
    for (const family of FAMILIES) {
      const value = w[family];
      if (value !== undefined && value > (weights[family] ?? 0)) weights[family] = value;
    }
  }
  return matched ? weights : null;
}

function mergeMax(a: FamilyWeights, b: FamilyWeights, factor = 1): FamilyWeights {
  const out: FamilyWeights = { ...a };
  for (const family of FAMILIES) {
    const value = b[family];
    if (value === undefined) continue;
    const scaled = value * factor;
    if (scaled > (out[family] ?? 0)) out[family] = scaled;
  }
  return out;
}

function primaryFamily(weights: FamilyWeights): WineFamily | null {
  let best: WineFamily | null = null;
  let bestWeight = 0;
  for (const family of FAMILIES) {
    const w = weights[family] ?? 0;
    if (w > bestWeight) {
      best = family;
      bestWeight = w;
    }
  }
  return best;
}

export interface WineClassification {
  /** Appartenance 0..1 à chaque famille (vide si le style est inconnu). Lecture seule (mémorisé). */
  weights: Readonly<FamilyWeights>;
  /** Famille dominante, ou null. */
  family: WineFamily | null;
}

/**
 * Classe un vin de la cave. L'appellation, le libellé et les cépages priment ;
 * la région ne sert qu'à défaut. Sans couleur fiable, les poids sont minorés
 * (incertitude assumée).
 */
export function classifyWine(
  wine: Pick<CellarWineEntry, 'label' | 'color' | 'appellation' | 'region' | 'grapes'>,
): WineClassification {
  // Mémorisé : la cave ne change pas entre deux frappes du plat.
  const key = JSON.stringify([wine.label, wine.color, wine.appellation, wine.region, wine.grapes]);
  const cached = classificationCache.get(key);
  if (cached) return cached;
  const result = computeClassification(wine);
  if (classificationCache.size >= CLASSIFICATION_CACHE_MAX) classificationCache.clear();
  classificationCache.set(key, result);
  return result;
}

const classificationCache = new Map<string, WineClassification>();
const CLASSIFICATION_CACHE_MAX = 2000;

function computeClassification(
  wine: Pick<CellarWineEntry, 'label' | 'color' | 'appellation' | 'region' | 'grapes'>,
): WineClassification {
  const primaryText = normalizeDishText(
    [wine.label, wine.appellation, ...(Array.isArray(wine.grapes) ? wine.grapes : [])]
      .filter((part): part is string => typeof part === 'string')
      .join(' '),
  );
  const regionText = normalizeDishText(typeof wine.region === 'string' ? wine.region : '');
  const color = colorOf(wine.color, primaryText);

  let weights: FamilyWeights = {};
  // Appellations de rouges SECS homonymes d'un liquoreux ou d'un VDN
  // (« Cadillac Côtes de Bordeaux », « Maury sec ») : neutralisées pour les
  // groupes spéciaux, elles restent lues par les groupes rouges.
  const specialText =
    color === 'red' || color === null
      ? primaryText.replace(/\bcadillac cotes de bordeaux\b/g, 'cotes de bordeaux').replace(/\bmaury sec\b/g, 'roussillon')
      : primaryText;
  const special =
    groupWeights(specialText, FORTIFIED_GROUPS) ??
    groupWeights(specialText, SWEET_GROUPS) ??
    // Un Champagne déclaré « blanc » ou « rosé » reste un effervescent.
    (color !== 'red' && color !== 'orange' ? groupWeights(specialText, SPARKLING_GROUPS) : null);

  if (hasKeyword(primaryText, 'jurancon sec')) {
    weights = { white_aromatic: 1, white_crisp: 0.5 };
  } else if (special) {
    weights = special;
    if (color === 'rose') weights = mergeMax(weights, { rose: 0.5 });
  } else if (color === 'sparkling') {
    weights = { sparkling: 1, white_crisp: 0.5 };
  } else if (color === 'rose') {
    weights = { ...ROSE_DEFAULT };
  } else if (color === 'orange') {
    weights = { ...ORANGE_DEFAULT };
  } else if (color === 'white') {
    weights =
      groupWeights(primaryText, WHITE_GROUPS) ?? groupWeights(regionText, WHITE_GROUPS) ?? { ...WHITE_DEFAULT };
  } else if (color === 'red') {
    weights = groupWeights(primaryText, RED_GROUPS) ?? groupWeights(regionText, RED_GROUPS) ?? { ...RED_DEFAULT };
  } else {
    // Couleur inconnue : on cumule les deux lectures, minorées.
    const red = groupWeights(primaryText, RED_GROUPS);
    const white = groupWeights(primaryText, WHITE_GROUPS);
    weights = mergeMax(mergeMax({}, red ?? {}, 0.75), white ?? {}, 0.75);
  }
  return { weights, family: primaryFamily(weights) };
}

/* ------------------------------------------------------------------ */
/* Recoupement avec les accords ZAPPA de la fiche                      */
/* ------------------------------------------------------------------ */

function stem(token: string): string {
  return token.length > 4 ? token.replace(/(es|s|x)$/, '') : token;
}

function meaningfulTokens(normalized: string): string[] {
  return normalized
    .split(' ')
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
    .map(stem);
}

interface ZappaMatch {
  score: number;
  pairing?: string;
}

/**
 * Catégories d'un accord ZAPPA, mémorisées : la suggestion se recalcule à
 * chaque frappe alors que les accords de la cave ne changent pas.
 */
const pairingCategoryCache = new Map<string, DishCategory[]>();
const PAIRING_CACHE_MAX = 2000;

function pairingCategories(normalizedPairing: string): DishCategory[] {
  const cached = pairingCategoryCache.get(normalizedPairing);
  if (cached) return cached;
  const categories = uniqueCategories(activeRules(normalizedPairing));
  if (pairingCategoryCache.size >= PAIRING_CACHE_MAX) pairingCategoryCache.clear();
  pairingCategoryCache.set(normalizedPairing, categories);
  return categories;
}

/** Meilleur recoupement 0..1 entre le plat et les accords ZAPPA du vin. */
function zappaOverlap(
  dishTokens: readonly string[],
  dishCategories: readonly DishCategory[],
  pairings: readonly unknown[] | undefined,
): ZappaMatch {
  if (!Array.isArray(pairings)) return { score: 0 };
  let best: ZappaMatch = { score: 0 };
  for (const raw of pairings) {
    if (typeof raw !== 'string' || raw.trim().length === 0) continue;
    const normalized = normalizeDishText(raw);
    const tokens = new Set(meaningfulTokens(normalized));
    let score = 0;
    if (dishTokens.length > 0) {
      const shared = dishTokens.filter((token) => tokens.has(token)).length;
      score = shared / dishTokens.length;
    }
    if (pairingCategories(normalized).some((category) => dishCategories.includes(category))) {
      score = Math.max(score, 0.75);
    }
    if (score > best.score) best = { score: Math.min(1, score), pairing: raw.trim() };
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Appariement                                                          */
/* ------------------------------------------------------------------ */

const PEAK_ADJUSTMENT: Record<DrinkWindowPhase, number> = {
  past: 0.04,
  closing: 0.08,
  peak: 0.06,
  soon: -0.04,
  young: -0.12,
  unknown: 0,
};

const PEAK_REASON_FR: Partial<Record<DrinkWindowPhase, string>> = {
  past: 'à boire sans tarder (apogée dépassée)',
  closing: 'dernière année d’apogée',
  peak: 'à son apogée',
  soon: 'apogée l’an prochain',
  young: 'encore jeune',
};

/** Ordre de départage à score égal : les vins à boire en premier. */
const PEAK_TIEBREAK: Record<DrinkWindowPhase, number> = {
  past: 1,
  closing: 0,
  peak: 2,
  soon: 3,
  unknown: 4,
  young: 5,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Raison courte, en français, d'une suggestion locale. */
export function localPairingReason(parts: {
  family: WineFamily | null;
  dishCategory: DishCategory | null;
  matchedPairing?: string;
  peakStatus: DrinkWindowPhase;
}): string {
  const segments: string[] = [];
  if (parts.family && parts.dishCategory) {
    segments.push(
      `${WINE_FAMILY_LABELS_FR[parts.family]}, accord classique avec ${DISH_CATEGORY_LABELS_FR[parts.dishCategory]}`,
    );
  } else if (parts.family) {
    segments.push(WINE_FAMILY_LABELS_FR[parts.family]);
  } else {
    segments.push('Style du vin non déterminé');
  }
  if (parts.matchedPairing) segments.push(`sa fiche cite « ${parts.matchedPairing} »`);
  const peak = PEAK_REASON_FR[parts.peakStatus];
  if (peak) segments.push(peak);
  return `${segments.join(' ; ')}.`;
}

export interface LocalPairingOptions {
  /** Nombre maximal de suggestions (défaut : 3). */
  limit?: number;
  /** Score minimal d'une suggestion (défaut : LOCAL_PAIRING_THRESHOLD). */
  threshold?: number;
}

/**
 * Plat → top 3 des vins de la cave, instantanément et sans réseau. `year`
 * est injecté (statut d'apogée) : aucune dépendance à l'horloge réelle.
 */
export function localPairing(
  dish: string,
  cellar: readonly CellarWineEntry[],
  year: number,
  options: LocalPairingOptions = {},
): LocalPairingResult {
  const limit = Math.max(0, options.limit ?? 3);
  const threshold = options.threshold ?? LOCAL_PAIRING_THRESHOLD;
  const trimmedDish = dish.trim();
  const normalized = normalizeDishText(trimmedDish);
  const rules = activeRules(normalized);
  const categories = uniqueCategories(rules);
  const clashed = clashedFamilies(rules);
  const wanted = wantedWeights(rules, clashed);
  // Recoupement ZAPPA d'un vin de famille en conflit : par l'ingrédient seul
  // (un rouge « grillades » ne s'impose pas sur une dorade grillée).
  const ingredientCategories = uniqueCategories(rules.filter((rule) => rule.level !== 'style'));
  const wantedFamilies = FAMILIES.filter((family) => (wanted[family] ?? 0) >= 0.5).sort(
    (a, b) => (wanted[b] ?? 0) - (wanted[a] ?? 0) || FAMILIES.indexOf(a) - FAMILIES.indexOf(b),
  );
  const dishTokens = [...new Set(meaningfulTokens(normalized))];

  const scored: LocalPairingSuggestion[] = [];
  if (normalized.length > 0) {
    for (const wine of cellar) {
      const classification = classifyWine(wine);
      let fit = 0;
      let family: WineFamily | null = classification.family;
      for (const candidate of FAMILIES) {
        const value = (wanted[candidate] ?? 0) * (classification.weights[candidate] ?? 0);
        if (value > fit) {
          fit = value;
          family = candidate;
        }
      }
      let dishCategory: DishCategory | null = null;
      if (family !== null && fit > 0) {
        let bestRuleWeight = 0;
        for (const rule of rules) {
          const w = ruleWeight(rule, family, clashed);
          if (w > bestRuleWeight) {
            bestRuleWeight = w;
            dishCategory = rule.category;
          }
        }
      }
      const retained = fit > 0 ? family : classification.family;
      const zappa = zappaOverlap(
        dishTokens,
        retained !== null && clashed.has(retained) ? ingredientCategories : categories,
        wine.foodPairings,
      );
      const phase = peakStatus(wine.drinkWindow, year);
      const raw =
        categories.length > 0
          ? 0.7 * fit + 0.25 * zappa.score + PEAK_ADJUSTMENT[phase]
          : Math.min(0.7, 0.6 * zappa.score + PEAK_ADJUSTMENT[phase]);
      const score = round2(Math.min(LOCAL_PAIRING_MAX_SCORE, Math.max(0, raw)));
      const hasEvidence = fit >= 0.6 || zappa.score >= 0.5;
      if (score < threshold || !hasEvidence) continue;
      const location = wine.storageLocation?.trim();
      scored.push({
        itemId: wine.itemId,
        label: wine.label,
        ...(wine.vintage !== undefined ? { vintage: wine.vintage } : {}),
        ...(location ? { storageLocation: location } : {}),
        ...(typeof wine.quantity === 'number' && Number.isFinite(wine.quantity) && wine.quantity > 0
          ? { quantity: wine.quantity }
          : {}),
        score,
        family: retained,
        dishCategory,
        ...(zappa.pairing && zappa.score >= 0.5 ? { matchedPairing: zappa.pairing } : {}),
        peakStatus: phase,
        reason: localPairingReason({
          family: retained,
          dishCategory,
          ...(zappa.pairing && zappa.score >= 0.5 ? { matchedPairing: zappa.pairing } : {}),
          peakStatus: phase,
        }),
      });
    }
  }

  const suggestions = scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        PEAK_TIEBREAK[a.peakStatus] - PEAK_TIEBREAK[b.peakStatus] ||
        a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }) ||
        a.itemId.localeCompare(b.itemId),
    )
    .slice(0, limit);

  const purchaseIdeas: string[] = [];
  for (const rule of rules.slice(0, 2)) {
    for (const idea of rule.purchaseIdeas) {
      if (!purchaseIdeas.includes(idea) && purchaseIdeas.length < 4) purchaseIdeas.push(idea);
    }
  }

  return { dish: trimmedDish, categories, wantedFamilies, suggestions, purchaseIdeas };
}
