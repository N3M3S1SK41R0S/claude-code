---
title: "Development Tools"
date: 2025-01-23
category: Knowledge/Technical
tags: [development, tools, environment, setup]
version: 1.0
status: active
---

# Development Tools - Guide Technique

## 📋 Vue d'ensemble

Configuration et utilisation des outils de développement dans l'environnement NEMESIS.

## 🐳 Docker

### Installation
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Démarrer le service
sudo systemctl start docker
sudo systemctl enable docker

# Ajouter user au groupe docker
sudo usermod -aG docker $USER
```

### Commandes essentielles
```bash
# Images
docker images                    # Lister images
docker pull image:tag           # Télécharger image
docker rmi image                # Supprimer image

# Containers
docker ps                       # Containers actifs
docker ps -a                    # Tous les containers
docker run -d --name name image # Lancer container
docker stop container           # Arrêter
docker rm container             # Supprimer
docker logs container           # Voir logs

# Docker Compose
docker-compose up -d            # Lancer services
docker-compose down             # Arrêter services
docker-compose logs -f          # Suivre logs
```

### Docker Compose NEMESIS Stack
```yaml
# docker-compose.yml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - GENERIC_TIMEZONE=Europe/Paris
    volumes:
      - n8n_data:/home/node/.n8n

  postgres:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_USER: nemesis
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: nemesis
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data

volumes:
  n8n_data:
  postgres_data:
  redis_data:
```

## 📝 Git & GitHub

### Configuration initiale
```bash
git config --global user.name "Pierre TAGNARD"
git config --global user.email "pierre@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase false
```

### Workflow Git standard
```bash
# Nouveau feature
git checkout -b feature/nom-feature
git add .
git commit -m "feat: description"
git push -u origin feature/nom-feature

# Merge
git checkout main
git pull origin main
git merge feature/nom-feature
git push origin main

# Cleanup
git branch -d feature/nom-feature
git push origin --delete feature/nom-feature
```

### Conventional Commits
```
feat: nouvelle fonctionnalité
fix: correction de bug
docs: documentation
style: formatage, pas de changement de code
refactor: refactoring, pas de nouvelle feature
test: ajout de tests
chore: maintenance, dépendances
```

### Git Aliases utiles
```bash
# ~/.gitconfig
[alias]
  st = status
  co = checkout
  br = branch
  ci = commit
  lg = log --oneline --graph --decorate
  last = log -1 HEAD
  unstage = reset HEAD --
```

## 💻 VSCode

### Extensions recommandées
```json
// .vscode/extensions.json
{
  "recommendations": [
    "github.copilot",
    "ms-python.python",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-azuretools.vscode-docker",
    "eamodio.gitlens",
    "yzhang.markdown-all-in-one",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma"
  ]
}
```

### Settings recommandés
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "editor.rulers": [80, 120],
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "python.formatting.provider": "black",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true
}
```

### Keybindings utiles
```json
// keybindings.json
[
  { "key": "cmd+shift+d", "command": "editor.action.copyLinesDownAction" },
  { "key": "cmd+shift+k", "command": "editor.action.deleteLines" },
  { "key": "cmd+/", "command": "editor.action.commentLine" }
]
```

## 🐍 Python Environment

### Setup avec pyenv
```bash
# Installation pyenv
curl https://pyenv.run | bash

# Ajouter au .bashrc/.zshrc
export PATH="$HOME/.pyenv/bin:$PATH"
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"

# Installer Python
pyenv install 3.11.0
pyenv global 3.11.0
```

### Virtual environments
```bash
# Créer venv
python -m venv .venv

# Activer
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows

# Installer dépendances
pip install -r requirements.txt

# Exporter dépendances
pip freeze > requirements.txt
```

### Poetry (alternative)
```bash
# Installation
curl -sSL https://install.python-poetry.org | python3 -

# Nouveau projet
poetry new project-name
poetry init  # Dans projet existant

# Dépendances
poetry add package
poetry add --dev package
poetry install

# Exécuter
poetry run python script.py
poetry shell  # Activer env
```

## 📦 Node.js Environment

### Setup avec nvm
```bash
# Installation nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Installer Node
nvm install 20
nvm use 20
nvm alias default 20
```

### Package managers
```bash
# npm
npm init -y
npm install package
npm install --save-dev package
npm run script

# yarn
yarn init -y
yarn add package
yarn add --dev package
yarn script

# pnpm (recommandé)
pnpm init
pnpm add package
pnpm add -D package
pnpm script
```

### TypeScript setup
```bash
# Installation
npm install -D typescript ts-node @types/node

# tsconfig.json
npx tsc --init

# Configuration recommandée
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## 🔧 Outils CLI utiles

### jq (JSON processing)
```bash
# Installation
sudo apt-get install jq

# Usage
cat file.json | jq '.field'
cat file.json | jq '.array[] | select(.key == "value")'
curl api | jq -r '.data[].name'
```

### httpie (HTTP client)
```bash
# Installation
pip install httpie

# Usage
http GET api.example.com/endpoint
http POST api.example.com/endpoint field=value
http -A bearer -a token123 GET api.example.com
```

### fzf (Fuzzy finder)
```bash
# Installation
sudo apt-get install fzf

# Usage
vim $(fzf)
git checkout $(git branch | fzf)
```

### ripgrep (Fast grep)
```bash
# Installation
sudo apt-get install ripgrep

# Usage
rg "pattern" ./src
rg -i "pattern"  # Case insensitive
rg -t py "def"   # File type filter
```

## 📊 Monitoring & Debug

### htop
```bash
sudo apt-get install htop
htop
```

### Docker stats
```bash
docker stats
docker stats container_name
```

### Logs
```bash
# Docker logs
docker logs -f container_name

# System logs
journalctl -u service_name -f
tail -f /var/log/syslog
```

## 🔐 Security Tools

### SSH Keys
```bash
# Générer clé
ssh-keygen -t ed25519 -C "email@example.com"

# Ajouter à agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Copier clé publique
cat ~/.ssh/id_ed25519.pub
```

### GPG pour Git commits
```bash
# Générer clé
gpg --full-generate-key

# Lister clés
gpg --list-secret-keys --keyid-format=long

# Configurer Git
git config --global user.signingkey KEY_ID
git config --global commit.gpgsign true
```

---

**Dernière mise à jour**: 2025-01-23
**Prochaine révision**: 2025-02-23
