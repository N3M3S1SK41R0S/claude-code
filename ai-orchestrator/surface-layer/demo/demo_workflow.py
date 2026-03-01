"""
NEMESIS Surface Layer — Demo End-to-End Workflow
Scénario complet : Document client → Reformulation → Slack → Agent → Rapport → YAML sync

Usage:
    python demo_workflow.py --input document.pdf --project gachet
    python demo_workflow.py --simulate  # Mode simulation sans APIs

Ce script démontre le fonctionnement complet de l'écosystème en 7 étapes.
"""

import os
import json
import time
import yaml
import asyncio
import logging
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

# Local imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from routing.decision_tree import SurfaceRouter, RoutingResult
from escalation.cascade import CascadeEngine, QualityEvaluator

logger = logging.getLogger(__name__)


class DemoWorkflow:
    """
    Démonstration end-to-end de NEMESIS Surface Layer.

    7 étapes:
    1. Pierre soumet un document client (PDF) via le formulaire Chrome
    2. Claude Sonnet reformule + extrait les points clés
    3. Le résumé est posté dans #projet-cgp sur Slack
    4. @KYRON est tagué → rédige une note de synthèse client
    5. @DAEDALUS génère le rapport PDF final via Claude Code
    6. Le fichier project.yaml est mis à jour automatiquement
    7. Pierre reçoit le rapport final dans Slack + Google Drive
    """

    def __init__(
        self,
        project_id: str = "demo-cgp",
        project_dir: Optional[str] = None,
        simulate: bool = True,
    ):
        self.project_id = project_id
        self.project_dir = project_dir or f"/data/nemesis/projects/{project_id}"
        self.simulate = simulate
        self.router = SurfaceRouter()
        self.results: Dict[str, Any] = {}

    async def run(self, input_text: str):
        """Exécute le workflow complet."""
        logger.info("=" * 70)
        logger.info("NEMESIS SURFACE LAYER — DEMO END-TO-END")
        logger.info("=" * 70)

        # Étape 1: Capture input via Chrome
        step1 = await self._step1_chrome_capture(input_text)
        self.results["step1_capture"] = step1

        # Étape 2: Reformulation via Sonnet
        step2 = await self._step2_sonnet_reformulation(input_text)
        self.results["step2_reformulation"] = step2

        # Étape 3: Post dans Slack
        step3 = await self._step3_slack_post(step2)
        self.results["step3_slack"] = step3

        # Étape 4: KYRON rédige la synthèse
        step4 = await self._step4_kyron_synthesis(step2)
        self.results["step4_kyron"] = step4

        # Étape 5: DAEDALUS génère le rapport
        step5 = await self._step5_daedalus_report(step4)
        self.results["step5_rapport"] = step5

        # Étape 6: Mise à jour project.yaml
        step6 = await self._step6_yaml_update()
        self.results["step6_yaml"] = step6

        # Étape 7: Livraison finale
        step7 = await self._step7_delivery()
        self.results["step7_delivery"] = step7

        logger.info("=" * 70)
        logger.info("DEMO TERMINÉE — Tous les étapes complétées")
        logger.info("=" * 70)

        return self.results

    async def _step1_chrome_capture(self, input_text: str) -> Dict[str, Any]:
        """Étape 1: Capture input via Chrome form."""
        logger.info("\n--- ÉTAPE 1: Capture via Claude in Chrome ---")

        # Route the input
        routing = self.router.route(input_text)
        logger.info(f"Routing: {routing.target_surface.value} (score={routing.complexity_score})")
        logger.info(f"Raison: {routing.reason}")

        return {
            "timestamp": datetime.now().isoformat(),
            "input_length": len(input_text),
            "routing": routing.to_dict(),
            "status": "captured",
        }

    async def _step2_sonnet_reformulation(self, input_text: str) -> Dict[str, Any]:
        """Étape 2: Sonnet reformule et extrait les points clés."""
        logger.info("\n--- ÉTAPE 2: Reformulation via Claude Sonnet 4.6 ---")

        if self.simulate:
            reformulated = {
                "resume": (
                    f"Synthèse du document client ({len(input_text)} caractères):\n\n"
                    f"1. Situation patrimoniale: Le client présente un patrimoine "
                    f"diversifié nécessitant une restructuration\n"
                    f"2. Objectifs: Optimisation fiscale et préparation succession\n"
                    f"3. Contraintes: Liquidité limitée, horizon 8 ans\n"
                    f"4. Recommandations préliminaires: PEA, assurance-vie, SCPI"
                ),
                "points_cles": [
                    "Patrimoine brut estimé à restructurer",
                    "Objectif principal: optimisation fiscale",
                    "Horizon d'investissement: 8 ans",
                    "Contrainte de liquidité identifiée",
                    "Enveloppes recommandées: PEA, AV, SCPI",
                ],
                "model": "claude-sonnet-4-6",
                "tokens_used": 1250,
            }
        else:
            # Real API call would go here
            reformulated = {"status": "requires_api_key"}

        logger.info(f"Points clés extraits: {len(reformulated.get('points_cles', []))}")
        return reformulated

    async def _step3_slack_post(self, reformulation: Dict[str, Any]) -> Dict[str, Any]:
        """Étape 3: Post le résumé dans #projet-cgp."""
        logger.info("\n--- ÉTAPE 3: Post dans Slack #projet-cgp ---")

        message = (
            f":page_facing_up: *Nouveau document client analysé*\n\n"
            f"{reformulation.get('resume', 'N/A')}\n\n"
            f"*Points clés:*\n"
        )
        for point in reformulation.get("points_cles", []):
            message += f"  - {point}\n"

        message += f"\n@KYRON Merci de rédiger la note de synthèse client."

        if self.simulate:
            logger.info(f"[SIMULATION] Message Slack ({len(message)} chars):")
            logger.info(message[:200] + "...")
            return {"channel": "#projet-cgp", "message_length": len(message), "status": "simulated"}
        else:
            # Real Slack post via webhook
            return {"status": "requires_slack_token"}

    async def _step4_kyron_synthesis(self, reformulation: Dict[str, Any]) -> Dict[str, Any]:
        """Étape 4: @KYRON rédige la note de synthèse client."""
        logger.info("\n--- ÉTAPE 4: @KYRON — Note de synthèse client ---")

        if self.simulate:
            synthesis = {
                "title": "Note de Synthèse — Analyse Patrimoniale Client",
                "content": (
                    "## Note de Synthèse\n\n"
                    "### 1. Situation Actuelle\n"
                    "Le client présente un patrimoine nécessitant une restructuration "
                    "afin d'optimiser sa fiscalité et préparer la transmission.\n\n"
                    "### 2. Objectifs Identifiés\n"
                    "- **Court terme**: Réduction de la pression fiscale\n"
                    "- **Moyen terme**: Constitution d'un capital diversifié (horizon 8 ans)\n"
                    "- **Long terme**: Préparation de la transmission patrimoniale\n\n"
                    "### 3. Stratégie Recommandée\n"
                    "- Ouverture PEA pour l'exposition actions européennes\n"
                    "- Contrat d'assurance-vie multisupport (fonds euros + UC)\n"
                    "- Parts de SCPI pour diversification immobilière indirecte\n\n"
                    "### 4. Points d'Attention\n"
                    "- Contrainte de liquidité à surveiller\n"
                    "- Clause bénéficiaire AV à optimiser\n"
                    "- Revue annuelle recommandée\n\n"
                    "*Document rédigé par @KYRON — Agent CGP NEMESIS*"
                ),
                "agent": "kyron",
                "model": "claude-sonnet-4-6",
                "tokens_used": 2100,
            }
        else:
            synthesis = {"status": "requires_api_key"}

        logger.info(f"Synthèse rédigée: {synthesis.get('title', 'N/A')}")
        return synthesis

    async def _step5_daedalus_report(self, synthesis: Dict[str, Any]) -> Dict[str, Any]:
        """Étape 5: @DAEDALUS génère le rapport PDF final."""
        logger.info("\n--- ÉTAPE 5: @DAEDALUS — Génération rapport PDF ---")

        if self.simulate:
            report_path = f"{self.project_dir}/output/rapport_{self.project_id}_{datetime.now().strftime('%Y%m%d')}.md"
            report = {
                "title": synthesis.get("title", "Rapport"),
                "format": "markdown",
                "path": report_path,
                "pages_estimated": 3,
                "agent": "daedalus",
                "model": "claude-code",
                "status": "generated",
            }
            logger.info(f"Rapport généré: {report_path}")
        else:
            report = {"status": "requires_claude_code"}

        return report

    async def _step6_yaml_update(self) -> Dict[str, Any]:
        """Étape 6: Mise à jour automatique du project.yaml."""
        logger.info("\n--- ÉTAPE 6: Mise à jour project.yaml ---")

        project_yaml = {
            "project": {
                "id": self.project_id,
                "name": f"Projet {self.project_id.upper()}",
                "status": "active",
                "updated_at": datetime.now().isoformat(),
            },
            "agents": {
                "zappa": {"status": "idle", "last_active": ""},
                "daedalus": {
                    "status": "completed",
                    "current_task": "Génération rapport PDF",
                    "last_active": datetime.now().isoformat(),
                },
                "kyron": {
                    "status": "completed",
                    "current_task": "Note de synthèse client",
                    "last_active": datetime.now().isoformat(),
                },
                "syncoria": {"status": "idle", "last_active": ""},
            },
            "tasks": [
                {
                    "id": "T001",
                    "title": "Analyse document client",
                    "assigned_to": "kyron",
                    "status": "completed",
                    "created_at": datetime.now().isoformat(),
                },
                {
                    "id": "T002",
                    "title": "Génération rapport PDF",
                    "assigned_to": "daedalus",
                    "status": "completed",
                    "created_at": datetime.now().isoformat(),
                },
            ],
            "metrics": {
                "tokens_consumed": {
                    "total": 3350,
                    "by_agent": {
                        "zappa": 0,
                        "daedalus": 1200,
                        "kyron": 2100,
                        "syncoria": 50,
                    },
                },
                "budget": {
                    "spent_today_usd": 0.15,
                    "daily_limit_usd": 10.0,
                },
            },
        }

        if self.simulate:
            yaml_output = yaml.dump(project_yaml, default_flow_style=False, allow_unicode=True)
            logger.info(f"project.yaml mis à jour ({len(yaml_output)} bytes)")
        else:
            # Write actual file
            os.makedirs(self.project_dir, exist_ok=True)
            yaml_path = os.path.join(self.project_dir, "project.yaml")
            with open(yaml_path, "w") as f:
                yaml.dump(project_yaml, f, default_flow_style=False, allow_unicode=True)

        return {"status": "updated", "project_id": self.project_id}

    async def _step7_delivery(self) -> Dict[str, Any]:
        """Étape 7: Livraison finale via Slack + Google Drive."""
        logger.info("\n--- ÉTAPE 7: Livraison finale ---")

        delivery = {
            "slack_notification": {
                "channel": "#projet-cgp",
                "message": (
                    f":white_check_mark: *Rapport finalisé — {self.project_id}*\n\n"
                    f"Le rapport a été généré et déposé sur Google Drive.\n"
                    f"Budget consommé: 0.15$\n"
                    f"Agents: @KYRON (synthèse) + @DAEDALUS (rapport)"
                ),
            },
            "google_drive": {
                "folder": f"NEMESIS/Projets/{self.project_id}/",
                "file": f"rapport_{self.project_id}_{datetime.now().strftime('%Y%m%d')}.pdf",
                "status": "simulated" if self.simulate else "uploaded",
            },
            "total_cost_usd": 0.15,
            "total_latency_ms": 12500,
        }

        logger.info(f"Livré dans: {delivery['google_drive']['folder']}")
        logger.info(f"Coût total: {delivery['total_cost_usd']}$")

        return delivery


async def main():
    parser = argparse.ArgumentParser(description="Demo NEMESIS Surface Layer end-to-end")
    parser.add_argument("--input", help="Fichier document client (texte)")
    parser.add_argument("--project", default="demo-cgp", help="ID du projet")
    parser.add_argument(
        "--simulate", action="store_true", default=True,
        help="Mode simulation (pas d'appels API réels)",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    # Input text
    if args.input and os.path.exists(args.input):
        with open(args.input, "r") as f:
            input_text = f.read()
    else:
        # Sample client document for demo
        input_text = (
            "Monsieur et Madame Gachet, 52 et 48 ans, nous consultent pour "
            "une restructuration de leur patrimoine. Patrimoine immobilier: "
            "résidence principale estimée 450k€, investissement locatif 280k€. "
            "Épargne financière: Livret A 22k€, PEL 35k€, compte-titres 85k€. "
            "Revenus annuels: 95k€ combinés. TMI: 30%. "
            "Objectifs: optimisation fiscale, préparation succession, "
            "diversification du patrimoine financier. "
            "Horizon d'investissement: 8 ans minimum. "
            "Contraintes: besoin de liquidité de 30k€ accessible sous 48h."
        )

    workflow = DemoWorkflow(
        project_id=args.project,
        simulate=args.simulate,
    )

    results = await workflow.run(input_text)

    # Output summary
    print("\n" + "=" * 70)
    print("RÉSUMÉ EXÉCUTION")
    print("=" * 70)
    print(json.dumps(
        {k: v.get("status", "done") if isinstance(v, dict) else v for k, v in results.items()},
        indent=2,
        ensure_ascii=False,
    ))


if __name__ == "__main__":
    asyncio.run(main())
