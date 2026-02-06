"""
Credential Manager
Secure handling of API keys and credentials.
"""

import base64
import hashlib
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional
import getpass

logger = logging.getLogger('Credential-Manager')


@dataclass
class Credential:
    """Represents a stored credential."""
    service: str
    key: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used: Optional[datetime] = None
    usage_count: int = 0


class CredentialManager:
    """
    Secure credential management for AI API keys.

    Features:
    - Encrypted storage (basic obfuscation - use proper encryption in production)
    - Environment variable fallback
    - Expiration tracking
    - Usage statistics
    """

    # Environment variable names for each service
    ENV_VARS = {
        'anthropic': 'ANTHROPIC_API_KEY',
        'openai': 'OPENAI_API_KEY',
        'google': 'GOOGLE_API_KEY',
        'mistral': 'MISTRAL_API_KEY',
        'perplexity': 'PERPLEXITY_API_KEY',
        'github': 'GITHUB_TOKEN',
    }

    def __init__(self, config_dir: str = "~/.ai-orchestrator"):
        self.config_dir = Path(config_dir).expanduser()
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.credentials_file = self.config_dir / "credentials.json"
        self._credentials: Dict[str, Credential] = {}
        self._load_credentials()

    def _get_machine_key(self) -> bytes:
        """Generate a machine-specific key for basic obfuscation."""
        # Note: This is NOT secure encryption - use a proper encryption
        # library like cryptography.fernet in production
        machine_id = f"{os.getlogin()}:{os.name}:{Path.home()}"
        return hashlib.sha256(machine_id.encode()).digest()

    def _obfuscate(self, text: str) -> str:
        """Basic obfuscation (NOT encryption - for demo purposes)."""
        key = self._get_machine_key()
        result = []
        for i, char in enumerate(text):
            result.append(chr(ord(char) ^ key[i % len(key)]))
        return base64.b64encode(''.join(result).encode('latin-1')).decode()

    def _deobfuscate(self, text: str) -> str:
        """Reverse basic obfuscation."""
        try:
            key = self._get_machine_key()
            decoded = base64.b64decode(text.encode()).decode('latin-1')
            result = []
            for i, char in enumerate(decoded):
                result.append(chr(ord(char) ^ key[i % len(key)]))
            return ''.join(result)
        except Exception:
            return text

    def _load_credentials(self):
        """Load credentials from file."""
        if self.credentials_file.exists():
            try:
                with open(self.credentials_file) as f:
                    data = json.load(f)
                    for service, cred_data in data.items():
                        self._credentials[service] = Credential(
                            service=service,
                            key=self._deobfuscate(cred_data['key']),
                            created_at=datetime.fromisoformat(cred_data['created_at']),
                            expires_at=datetime.fromisoformat(cred_data['expires_at'])
                                      if cred_data.get('expires_at') else None,
                            last_used=datetime.fromisoformat(cred_data['last_used'])
                                     if cred_data.get('last_used') else None,
                            usage_count=cred_data.get('usage_count', 0)
                        )
            except Exception as e:
                logger.error(f"Failed to load credentials: {e}")

    def _save_credentials(self):
        """Save credentials to file."""
        data = {}
        for service, cred in self._credentials.items():
            data[service] = {
                'key': self._obfuscate(cred.key),
                'created_at': cred.created_at.isoformat(),
                'expires_at': cred.expires_at.isoformat() if cred.expires_at else None,
                'last_used': cred.last_used.isoformat() if cred.last_used else None,
                'usage_count': cred.usage_count
            }

        with open(self.credentials_file, 'w') as f:
            json.dump(data, f, indent=2)

        # Set restrictive permissions
        self.credentials_file.chmod(0o600)

    def get_key(self, service: str) -> Optional[str]:
        """
        Get API key for a service.
        Priority: Environment variable > Stored credential
        """
        # Check environment first
        env_var = self.ENV_VARS.get(service)
        if env_var:
            env_key = os.environ.get(env_var)
            if env_key:
                logger.debug(f"Using {service} key from environment")
                return env_key

        # Check stored credentials
        if service in self._credentials:
            cred = self._credentials[service]

            # Check expiration
            if cred.expires_at and datetime.now() > cred.expires_at:
                logger.warning(f"{service} credential has expired")
                return None

            # Update usage stats
            cred.last_used = datetime.now()
            cred.usage_count += 1
            self._save_credentials()

            return cred.key

        logger.warning(f"No credential found for {service}")
        return None

    def set_key(self, service: str, key: str,
                expires_in_days: int = None) -> bool:
        """
        Store an API key for a service.

        Args:
            service: Service name
            key: API key
            expires_in_days: Optional expiration in days
        """
        try:
            expires_at = None
            if expires_in_days:
                expires_at = datetime.now() + timedelta(days=expires_in_days)

            self._credentials[service] = Credential(
                service=service,
                key=key,
                created_at=datetime.now(),
                expires_at=expires_at
            )
            self._save_credentials()
            logger.info(f"Stored credential for {service}")
            return True
        except Exception as e:
            logger.error(f"Failed to store credential for {service}: {e}")
            return False

    def remove_key(self, service: str) -> bool:
        """Remove stored credential for a service."""
        if service in self._credentials:
            del self._credentials[service]
            self._save_credentials()
            logger.info(f"Removed credential for {service}")
            return True
        return False

    def list_services(self) -> Dict[str, Dict]:
        """List all configured services and their status."""
        result = {}
        for service in self.ENV_VARS:
            has_env = bool(os.environ.get(self.ENV_VARS[service]))
            has_stored = service in self._credentials

            cred = self._credentials.get(service)
            result[service] = {
                'configured': has_env or has_stored,
                'source': 'environment' if has_env else ('stored' if has_stored else 'none'),
                'expires_at': cred.expires_at.isoformat() if cred and cred.expires_at else None,
                'usage_count': cred.usage_count if cred else 0,
                'last_used': cred.last_used.isoformat() if cred and cred.last_used else None
            }
        return result

    def interactive_setup(self):
        """Interactive setup for credentials."""
        print("\n" + "="*50)
        print("   API Credential Setup")
        print("="*50)
        print("\nCurrent status:")

        services = self.list_services()
        for service, info in services.items():
            status = "✓" if info['configured'] else "✗"
            source = f"({info['source']})" if info['configured'] else ""
            print(f"  {status} {service}: {source}")

        print("\nEnter credentials for services (leave blank to skip):")
        print("Note: Keys are stored with basic obfuscation locally.\n")

        for service, env_var in self.ENV_VARS.items():
            if services[service]['configured']:
                update = input(f"{service} already configured. Update? (y/N): ")
                if update.lower() != 'y':
                    continue

            key = getpass.getpass(f"{service} API key: ")
            if key.strip():
                expires = input("Expires in days (leave blank for no expiration): ")
                expires_days = int(expires) if expires.strip() else None
                self.set_key(service, key.strip(), expires_days)
                print(f"  ✓ {service} configured")

        print("\nSetup complete!")

    def rotate_key(self, service: str) -> bool:
        """Prompt for key rotation (manual process)."""
        print(f"\n--- Rotating key for {service} ---")
        new_key = getpass.getpass(f"Enter new {service} API key: ")
        if new_key.strip():
            return self.set_key(service, new_key.strip())
        return False

    def check_health(self) -> Dict[str, str]:
        """Check health/validity of stored credentials."""
        health = {}
        for service in self._credentials:
            cred = self._credentials[service]
            if cred.expires_at:
                if datetime.now() > cred.expires_at:
                    health[service] = "expired"
                elif datetime.now() + timedelta(days=7) > cred.expires_at:
                    health[service] = "expiring_soon"
                else:
                    health[service] = "valid"
            else:
                health[service] = "valid"
        return health
