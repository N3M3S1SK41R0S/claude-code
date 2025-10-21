#!/bin/bash

################################################################################
#           NEMESIS OMEGA - INSTALLATEUR RAPIDE TOUT-EN-UN                    #
#           Copier-coller ce script dans votre terminal                       #
################################################################################

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
cat << "EOF"
    ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
    ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
    ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
    ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
    ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
    ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝

    🚀 INSTALLATEUR RAPIDE TOUT-EN-UN V3.1

EOF
echo -e "${NC}"

echo -e "${BLUE}📦 Téléchargement du script d'installation...${NC}"

# URL du script sur GitHub
SCRIPT_URL="https://raw.githubusercontent.com/N3M3S1SK41R0S/claude-code/claude/nemesis-ultimate-setup-011CULPeU8m8D8qYiqbCw8ce/nemesis_ultimate_setup_v2.sh"
TEMP_SCRIPT="/tmp/nemesis_ultimate_setup_v2.sh"

# Télécharger le script
if command -v wget &> /dev/null; then
    wget -q -O "$TEMP_SCRIPT" "$SCRIPT_URL"
elif command -v curl &> /dev/null; then
    curl -fsSL -o "$TEMP_SCRIPT" "$SCRIPT_URL"
else
    echo -e "${RED}❌ Erreur: wget ou curl est requis${NC}"
    exit 1
fi

if [[ ! -f "$TEMP_SCRIPT" ]]; then
    echo -e "${RED}❌ Échec du téléchargement${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Script téléchargé${NC}"

# Rendre exécutable
chmod +x "$TEMP_SCRIPT"

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🎯 Choisissez le mode d'installation :${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}1)${NC} Installation complète (recommandé)"
echo -e "   └─ Installe tout: Edge, Node.js, Python, MCP, etc."
echo ""
echo -e "${BLUE}2)${NC} Installation sans Edge (si déjà installé)"
echo -e "   └─ Saute l'installation de Microsoft Edge"
echo ""
echo -e "${YELLOW}3)${NC} Test en dry-run (simulation sans changements)"
echo -e "   └─ Montre ce qui serait installé"
echo ""
echo -e "${CYAN}4)${NC} Installation verbose (mode debug)"
echo -e "   └─ Affiche tous les détails"
echo ""

read -p "Votre choix (1-4): " choice

case $choice in
    1)
        echo -e "${GREEN}🚀 Lancement de l'installation complète...${NC}"
        bash "$TEMP_SCRIPT"
        ;;
    2)
        echo -e "${BLUE}🚀 Lancement sans Edge...${NC}"
        bash "$TEMP_SCRIPT" --skip-edge
        ;;
    3)
        echo -e "${YELLOW}🔍 Lancement en mode dry-run...${NC}"
        bash "$TEMP_SCRIPT" --dry-run --verbose
        ;;
    4)
        echo -e "${CYAN}🐛 Lancement en mode verbose...${NC}"
        bash "$TEMP_SCRIPT" --verbose
        ;;
    *)
        echo -e "${RED}❌ Choix invalide. Installation complète par défaut.${NC}"
        sleep 2
        bash "$TEMP_SCRIPT"
        ;;
esac

# Récupérer le code de sortie
EXIT_CODE=$?

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}✅ Installation terminée avec succès !${NC}"
    echo ""
    echo -e "${CYAN}📝 Prochaines étapes :${NC}"
    echo ""
    echo -e "${YELLOW}1.${NC} Configurez vos clés API :"
    echo -e "   ${BLUE}nano ~/.nemesis/.env${NC}"
    echo ""
    echo -e "${YELLOW}2.${NC} Démarrez NEMESIS :"
    echo -e "   ${BLUE}~/.nemesis/scripts/start_nemesis.sh${NC}"
    echo ""
    echo -e "${YELLOW}3.${NC} Accédez au dashboard :"
    echo -e "   ${BLUE}http://localhost:10000${NC}"
    echo ""
    echo -e "${CYAN}📚 Documentation complète :${NC}"
    echo -e "   ${BLUE}cat ~/.nemesis/README.md${NC}"
    echo ""
    echo -e "${CYAN}🆘 Aide et support :${NC}"
    echo -e "   ${BLUE}~/.nemesis/scripts/status_nemesis.sh${NC}  - Vérifier le status"
    echo -e "   ${BLUE}~/.nemesis/scripts/stop_nemesis.sh${NC}   - Arrêter NEMESIS"
    echo -e "   ${BLUE}~/.nemesis/scripts/backup_nemesis.sh${NC} - Créer un backup"
    echo ""
else
    echo -e "${RED}❌ L'installation a échoué${NC}"
    echo ""
    echo -e "${YELLOW}Consultez les logs :${NC}"
    echo -e "   ${BLUE}cat ~/nemesis_logs/errors_*.log${NC}"
    echo ""
fi

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Nettoyer
rm -f "$TEMP_SCRIPT"

exit $EXIT_CODE
