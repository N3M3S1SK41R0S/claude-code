---
title: "Techniques de Prompting"
date: 2025-01-23
category: Knowledge/Methodologies
tags: [prompting, techniques, ai, optimization]
version: 1.0
status: active
---

# Techniques de Prompting

## 📋 Vue d'ensemble

Guide des techniques de prompting avancées pour maximiser l'efficacité des interactions avec les IA.

## 🎯 Principes fondamentaux NEMESIS

### 1. Contexte complet d'entrée
Toujours fournir le contexte nécessaire dès le départ:
```
Contexte NEMESIS: [description situation]
Objectif: [ce que je veux accomplir]
Contraintes: [limitations, préférences]
Format attendu: [structure de la réponse]
```

### 2. Spécificité maximale
**Mauvais**: "Aide-moi avec mon code"
**Bon**: "Review ce code TypeScript pour un composant React. Identifie: bugs potentiels, problèmes de performance, violations des best practices. Format: tableau avec severity, issue, fix."

### 3. Structure de sortie définie
Toujours spécifier le format attendu:
```
Format de réponse:
1. Executive summary (2-3 phrases)
2. Analyse détaillée (bullet points)
3. Recommandations (priorisées)
4. Code/Implementation (si applicable)
5. Extensions possibles
```

## 🛠️ Techniques avancées

### Chain of Thought (CoT)
Force l'IA à détailler son raisonnement.

```
Problème: [description]

Résous step-by-step en montrant ton raisonnement:
1. Analyse du problème
2. Identification des approches possibles
3. Évaluation de chaque approche
4. Sélection et justification
5. Implémentation détaillée
```

### Few-Shot Learning
Fournir des exemples du format attendu.

```
Génère des tests unitaires pour ce code.

Exemple de test attendu:
```typescript
describe('functionName', () => {
  it('should handle normal case', () => {
    expect(functionName(input)).toBe(expected);
  });

  it('should handle edge case', () => {
    expect(functionName(edgeInput)).toBe(edgeExpected);
  });
});
```

Maintenant, génère les tests pour:
[code à tester]
```

### Role Prompting
Définir un rôle spécifique pour l'IA.

```
Tu es un architecte logiciel senior spécialisé en systèmes distribués avec 15 ans d'expérience.

Analyse cette architecture et propose des améliorations en termes de:
- Scalabilité
- Résilience
- Maintenabilité
- Coûts opérationnels

[description de l'architecture]
```

### Structured Output
Demander une structure spécifique.

```
Analyse cette situation et réponds au format JSON suivant:

{
  "summary": "résumé en une phrase",
  "analysis": {
    "strengths": ["point fort 1", "point fort 2"],
    "weaknesses": ["faiblesse 1", "faiblesse 2"],
    "opportunities": ["opportunité 1"],
    "threats": ["menace 1"]
  },
  "recommendations": [
    {
      "priority": "high|medium|low",
      "action": "description de l'action",
      "rationale": "justification"
    }
  ]
}
```

### Constraint Prompting
Définir explicitement les contraintes.

```
Développe cette fonctionnalité avec les contraintes suivantes:
- Langage: TypeScript strict
- Framework: React 18+ avec hooks
- Pas de bibliothèques externes sauf celles déjà dans le projet
- Performance: rendu < 16ms
- Accessibilité: WCAG 2.1 AA
- Tests: coverage > 80%
```

### Iterative Refinement
Structurer pour permettre l'amélioration.

```
Phase 1: Draft initial
[premier prompt]

Phase 2: Critique
Analyse ta propre réponse et identifie:
- Points faibles
- Améliorations possibles
- Éléments manquants

Phase 3: Version améliorée
Produis une version finale intégrant les améliorations.
```

## 📊 Patterns NEMESIS

### Pattern "Exhaustive Options"
```
Pour [problème], propose TOUTES les solutions possibles:

Pour chaque solution:
| Solution | Avantages | Inconvénients | Complexité | Recommandé si... |

Inclus:
- Solutions évidentes
- Solutions non-conventionnelles
- Combinaisons possibles

Termine par ta recommandation argumentée.
```

### Pattern "Production-Ready"
```
Développe [fonctionnalité] de manière production-ready:

Requis:
1. Code complet et fonctionnel
2. Gestion d'erreurs exhaustive
3. Validation des inputs
4. Types TypeScript stricts
5. Tests unitaires
6. Documentation JSDoc
7. Exemple d'utilisation
8. Guide de déploiement

Pas de placeholders ou TODO.
```

### Pattern "Anticipation"
```
Pour [tâche], réponds en anticipant:

1. Les questions que je pourrais poser ensuite
2. Les problèmes que je pourrais rencontrer
3. Les variations de mon besoin initial
4. Les optimisations futures possibles

Adresse chaque point proactivement.
```

### Pattern "Decision Matrix"
```
Aide-moi à choisir entre [options].

Crée une matrice de décision avec:
| Critère | Poids | Option A | Option B | Option C |
|---------|-------|----------|----------|----------|
| [critère 1] | x% | score | score | score |
...

Score total pondéré et recommandation finale.
```

### Pattern "Gradual Depth"
```
Explique [sujet] en 3 niveaux:

Niveau 1 (Executive Summary):
[2-3 phrases]

Niveau 2 (Professionnel):
[Paragraphe détaillé avec termes techniques]

Niveau 3 (Expert):
[Analyse approfondie avec nuances et edge cases]
```

## 🔧 Templates par use case

### Développement
```
Contexte: [techno, projet, contraintes]

Tâche: Développe [fonctionnalité]

Requirements:
- [req 1]
- [req 2]

Output attendu:
1. Architecture/Design (si complexe)
2. Code complet avec types
3. Tests
4. Documentation
5. Instructions de déploiement
```

### Debug
```
Problème: [description du bug]

Environnement:
- OS: [...]
- Version: [...]
- Configuration: [...]

Symptômes:
- [symptôme 1]
- [symptôme 2]

Déjà essayé:
- [tentative 1] → [résultat]

Logs/Erreurs:
```
[logs pertinents]
```

Aide-moi à:
1. Identifier la root cause
2. Proposer une solution
3. Éviter la récurrence
```

### Architecture
```
Contexte: [type de projet, échelle, contraintes]

Besoin: [description fonctionnelle]

Contraintes techniques:
- [contrainte 1]
- [contrainte 2]

Conçois l'architecture incluant:
1. Diagramme de haut niveau
2. Composants et responsabilités
3. Flux de données
4. Choix technologiques justifiés
5. Points d'attention (scalabilité, sécurité)
6. Plan de déploiement
```

### Analyse/Research
```
Sujet: [sujet à analyser]

Objectif: [ce que je cherche à comprendre/décider]

Sources à considérer:
- Documentation officielle
- Best practices industrie
- Retours d'expérience

Produis:
1. Synthèse des informations clés
2. Comparatif si pertinent
3. Recommandations argumentées
4. Ressources pour approfondir
```

## ⚠️ Anti-patterns à éviter

### ❌ Prompts vagues
```
"Aide-moi avec mon projet"
→ Spécifier: quoi, pourquoi, comment, contraintes
```

### ❌ Contexte insuffisant
```
"Corrige ce bug"
→ Ajouter: environnement, symptômes, logs, tentatives
```

### ❌ Attentes implicites
```
"Écris du code"
→ Préciser: langage, style, tests, docs, format
```

### ❌ Questions multiples non structurées
```
"Explique X et aussi Y et que penses-tu de Z?"
→ Numéroter et structurer les questions
```

### ❌ Pas de format de sortie
```
"Analyse cette situation"
→ Définir: structure attendue, niveau de détail, focus
```

## 📈 Optimisation continue

### Mesurer l'efficacité
- Nombre d'itérations pour obtenir le résultat
- Qualité de la première réponse
- Couverture des besoins implicites
- Temps total passé

### Itérer sur les prompts
1. Tester le prompt initial
2. Identifier les lacunes
3. Ajuster le prompt
4. Re-tester
5. Documenter le prompt optimisé

### Créer une bibliothèque
- Sauvegarder les prompts efficaces
- Catégoriser par use case
- Mettre à jour régulièrement
- Partager entre plateformes IA

---

**Dernière mise à jour**: 2025-01-23
**Prochaine révision**: 2025-02-23
