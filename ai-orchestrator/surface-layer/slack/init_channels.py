"""
NEMESIS Surface Layer — Slack Channel Initializer
Crée la structure de channels Slack pour les projets + configure les webhooks.

Usage:
    python init_channels.py --token xoxb-xxx --project projet-gachet
"""

import os
import json
import logging
import argparse
import requests
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# =============================================================================
# Structure de channels recommandée
# =============================================================================

CHANNEL_STRUCTURE = {
    "operational": [
        {
            "name": "nemesis-general",
            "topic": "Coordination générale NEMESIS OMEGA",
            "purpose": "Channel principal pour la coordination inter-agents et annonces système.",
            "is_private": False,
        },
        {
            "name": "nemesis-dev",
            "topic": "Développement & Infrastructure NEMESIS",
            "purpose": "Channel technique pour @DAEDALUS. Code, déploiements, bugs, MCP.",
            "is_private": False,
        },
        {
            "name": "nemesis-veille",
            "topic": "Veille marché & Recherche",
            "purpose": "Channel pour @ZAPPA. Recherches Perplexity, tendances, données macro.",
            "is_private": False,
        },
        {
            "name": "nemesis-alerts",
            "topic": "Alertes système & Budget",
            "purpose": "Alertes automatiques: budget token, erreurs, blocages agents.",
            "is_private": False,
        },
    ],
    "project_template": {
        "name_template": "projet-{project_id}",
        "topic_template": "Projet: {project_name}",
        "purpose_template": "Channel projet pour {project_name}. Agents: @ZAPPA @DAEDALUS @KYRON @SYNCORIA",
        "is_private": True,
    },
    "cgp_channels": [
        {
            "name": "clients-cgp",
            "topic": "Gestion Clientèle CGP",
            "purpose": "Channel pour @KYRON. Dossiers clients, rédaction, communication.",
            "is_private": True,
        },
        {
            "name": "cgp-reglementaire",
            "topic": "Veille réglementaire CGP",
            "purpose": "Veille juridique et fiscale pour le métier de CGP.",
            "is_private": True,
        },
    ],
}


class SlackInitializer:
    """Initialise la structure Slack pour NEMESIS Surface Layer."""

    def __init__(self, bot_token: str, n8n_base_url: str = "http://localhost:5678"):
        self.token = bot_token
        self.n8n_base_url = n8n_base_url
        self.headers = {
            "Authorization": f"Bearer {bot_token}",
            "Content-Type": "application/json",
        }
        self.base_url = "https://slack.com/api"

    def _api_call(self, method: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Appel API Slack."""
        url = f"{self.base_url}/{method}"
        response = requests.post(url, headers=self.headers, json=data, timeout=10)
        result = response.json()
        if not result.get("ok"):
            logger.error(f"Slack API error ({method}): {result.get('error')}")
        return result

    def create_channel(
        self, name: str, topic: str, purpose: str, is_private: bool = False
    ) -> Optional[str]:
        """Crée un channel Slack. Retourne l'ID du channel."""
        method = "conversations.create"
        result = self._api_call(method, {
            "name": name,
            "is_private": is_private,
        })

        if result.get("ok"):
            channel_id = result["channel"]["id"]
            logger.info(f"Channel créé: #{name} ({channel_id})")

            # Set topic
            self._api_call("conversations.setTopic", {
                "channel": channel_id,
                "topic": topic,
            })

            # Set purpose
            self._api_call("conversations.setPurpose", {
                "channel": channel_id,
                "purpose": purpose,
            })

            return channel_id

        elif result.get("error") == "name_taken":
            logger.info(f"Channel #{name} existe déjà.")
            # Find existing channel
            channels = self._list_channels()
            for ch in channels:
                if ch["name"] == name:
                    return ch["id"]

        return None

    def _list_channels(self) -> List[Dict[str, Any]]:
        """Liste tous les channels."""
        result = self._api_call("conversations.list", {
            "types": "public_channel,private_channel",
            "limit": 200,
        })
        return result.get("channels", [])

    def post_welcome_message(self, channel_id: str, channel_name: str):
        """Poste un message de bienvenue dans le channel."""
        welcome = (
            f":robot_face: *NEMESIS Surface Layer — Initialisé*\n\n"
            f"Ce channel est configuré pour l'écosystème NEMESIS OMEGA.\n\n"
            f"*Agents disponibles:*\n"
            f"- `@ZAPPA` — Recherche & veille marché\n"
            f"- `@DAEDALUS` — Architecture technique & code\n"
            f"- `@KYRON` — Gestion client & rédaction CGP\n"
            f"- `@SYNCORIA` — Coordination & synthèse\n\n"
            f"Taguez un agent pour lui assigner une tâche. "
            f"Exemple: `@KYRON rédige une note de synthèse pour le client Gachet`\n\n"
            f"_Connecté à N8N pour orchestration automatique._"
        )
        self._api_call("chat.postMessage", {
            "channel": channel_id,
            "text": welcome,
        })

    def init_operational_channels(self) -> Dict[str, str]:
        """Crée tous les channels opérationnels."""
        channel_ids = {}
        for ch_config in CHANNEL_STRUCTURE["operational"]:
            ch_id = self.create_channel(
                name=ch_config["name"],
                topic=ch_config["topic"],
                purpose=ch_config["purpose"],
                is_private=ch_config["is_private"],
            )
            if ch_id:
                channel_ids[ch_config["name"]] = ch_id
                self.post_welcome_message(ch_id, ch_config["name"])

        for ch_config in CHANNEL_STRUCTURE["cgp_channels"]:
            ch_id = self.create_channel(
                name=ch_config["name"],
                topic=ch_config["topic"],
                purpose=ch_config["purpose"],
                is_private=ch_config["is_private"],
            )
            if ch_id:
                channel_ids[ch_config["name"]] = ch_id
                self.post_welcome_message(ch_id, ch_config["name"])

        return channel_ids

    def init_project_channel(
        self, project_id: str, project_name: str
    ) -> Optional[str]:
        """Crée un channel dédié à un projet."""
        template = CHANNEL_STRUCTURE["project_template"]
        name = template["name_template"].format(project_id=project_id)
        topic = template["topic_template"].format(project_name=project_name)
        purpose = template["purpose_template"].format(project_name=project_name)

        ch_id = self.create_channel(
            name=name, topic=topic, purpose=purpose,
            is_private=template["is_private"],
        )
        if ch_id:
            self.post_welcome_message(ch_id, name)
        return ch_id

    def generate_channel_map(self, channel_ids: Dict[str, str]) -> str:
        """Génère le NEMESIS_CHANNEL_MAP JSON pour les variables d'env N8N."""
        # Inverse: channel_id -> project_id
        channel_map = {v: k for k, v in channel_ids.items()}
        return json.dumps(channel_map, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="Initialise la structure Slack pour NEMESIS Surface Layer"
    )
    parser.add_argument("--token", required=True, help="Slack Bot Token (xoxb-...)")
    parser.add_argument("--n8n-url", default="http://localhost:5678", help="N8N base URL")
    parser.add_argument("--project", help="Créer un channel projet spécifique (ID)")
    parser.add_argument("--project-name", help="Nom du projet (pour le channel)")
    parser.add_argument("--all", action="store_true", help="Créer tous les channels opérationnels")

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    init = SlackInitializer(bot_token=args.token, n8n_base_url=args.n8n_url)

    channel_ids = {}

    if args.all:
        logger.info("Création des channels opérationnels NEMESIS...")
        channel_ids = init.init_operational_channels()
        logger.info(f"Channels créés: {len(channel_ids)}")

    if args.project:
        name = args.project_name or args.project
        logger.info(f"Création du channel projet: {args.project}")
        ch_id = init.init_project_channel(args.project, name)
        if ch_id:
            channel_ids[f"projet-{args.project}"] = ch_id

    if channel_ids:
        channel_map = init.generate_channel_map(channel_ids)
        logger.info(f"\nNEMESIS_CHANNEL_MAP (à ajouter dans .env N8N):\n{channel_map}")


if __name__ == "__main__":
    main()
