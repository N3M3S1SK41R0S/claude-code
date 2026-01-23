# NEMESIS Collective Memory System

## 📖 Vue d'ensemble

Système de mémoire collective pour l'orchestration multi-IA NEMESIS. Ce repository centralise toutes les connaissances, contextes, solutions et learnings pour maintenir la cohérence et l'efficacité à travers toutes les plateformes IA (Claude, ChatGPT, Mistral, Gemini, DeepSeek, Perplexity).

## 🎯 Objectifs

- **Continuité contextuelle** : Maintenir le contexte NEMESIS à travers toutes les interactions IA
- **Optimisation proactive** : Permettre aux IA de proposer des solutions complètes immédiatement
- **Zéro-itération** : Minimiser les allers-retours en fournissant toute l'information nécessaire
- **Mémoire partagée** : Créer une base de connaissances accessible par toutes les IA
- **Efficacité maximale** : Accélérer tous les workflows grâce à une documentation centralisée

## 📂 Structure
```
/Context/           → Profil utilisateur, objectifs, environnement technique
/Projects/          → Projets actifs, complétés, templates
/Knowledge/         → Connaissances plateformes IA, techniques, professionnelles, méthodologies
/Solutions/         → Code, configurations, workflows, architectures
/Learnings/         → Retours d'expérience, insights, métriques
```

## 🔧 Conventions

### Nommage des fichiers
- Format: `snake_case_descriptif.md`
- Longueur max: 30 caractères
- Extensions: `.md` pour documentation, `.json` pour configs, `.yaml` pour workflows

### Nommage des dossiers
- Format: `/PascalCase/` ou `/snake_case/`
- Toujours commencer par majuscule pour dossiers principaux
- Sous-dossiers en snake_case si nécessaire

### Metadata (frontmatter YAML)
```yaml
---
title: "Titre du document"
date: 2025-01-23
author: Pierre TAGNARD
category: [Context/Projects/Knowledge/Solutions/Learnings]
tags: [ai, optimization, nemesis]
version: 1.0
status: [draft/active/completed/archived]
---
```

### Versioning
- Ajouter date si versions multiples: `doc_name_20250123.md`
- Utiliser Git pour versioning automatique si possible
- Garder maximum 3 versions historiques

## 🚀 Utilisation

### Pour les IA
Référencer ce contexte au début des conversations importantes:
```
"Contexte NEMESIS: Consulte /NEMESIS_Collective_Memory/ pour le contexte complet du projet, mes préférences, et les solutions existantes."
```

### Pour nouveaux projets
1. Dupliquer `/Projects/Templates/project_init_template.md`
2. Remplir les sections
3. Ajouter dans `/Projects/Active/`
4. Mettre à jour `/Projects/Active/priorities.md`

### Pour nouvelles solutions
1. Documenter dans le dossier approprié `/Solutions/`
2. Ajouter référence dans `/Knowledge/` si réutilisable
3. Logger dans `/Learnings/lessons_learned.md`

## 📊 Maintenance

- **Daily**: Ajouter nouveaux learnings/insights
- **Weekly**: Mettre à jour priorities et progress
- **Monthly**: Archiver projets complétés, nettoyer obsolètes
- **Quarterly**: Révision complète de la structure

## 🔗 Liens rapides

- [Profil utilisateur](Context/user_profile.md)
- [Objectifs NEMESIS](Context/objectives.md)
- [Projets actifs](Projects/Active/)
- [Optimisations IA](Knowledge/AI_Platforms/)
- [Méthodologies](Knowledge/Methodologies/)

---

**Créé**: 2025-01-23
**Maintenu par**: Pierre TAGNARD
**Version**: 1.0
