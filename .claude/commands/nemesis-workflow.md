# NEMESIS Workflow Architect

Lance le mode NEMESIS-WORKFLOW-ARCHITECT pour construire, tester et debugger des workflows n8n/Zapier/Make.

## Usage

Décris le workflow que tu veux construire. L'agent va :
1. Vérifier l'infrastructure n8n
2. Analyser le brief et rechercher les patterns experts
3. Construire le workflow node par node
4. Tester chaque node puis end-to-end
5. Debugger automatiquement si erreur
6. Livrer avec documentation et rapport

## Protocole

Charge et exécute le prompt système depuis `prompts/NEMESIS_WORKFLOW_ARCHITECT_PROMPT.md`

$ARGUMENTS
