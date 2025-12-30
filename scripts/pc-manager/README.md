# ☣️ BIOHAZARD PC MANAGER

Système complet de gestion du démarrage, arrêt et diagnostic de votre PC Windows.

```
    ░░░░░░░░░░░▄▄▄▄▄▄▄▄▄▄▄░░░░░░░░░░░
    ░░░░░░▄▄█▀▀░░░░░░░░░░░▀▀█▄▄░░░░░░
    ░░░░▄█▀░░░░▄▄▄█████▄▄▄░░░░▀█▄░░░░
    ░░▄█▀░░░▄██▀▀░░░░░░░▀▀██▄░░░▀█▄░░
    ░█▀░░░██▀░░░▄▄███▄▄░░░░▀██░░░▀█░░
    █▀░░▄█▀░░░▄█▀░░░░░▀█▄░░░▀█▄░░▀█░
    █░░██░░░▄█▀░░░███░░░▀█▄░░░██░░█░
    █░██░░░██░░░▄█▀▀▀█▄░░░██░░░██░█░
    █░██░░░██░░░█ ☣️ █░░░██░░░██░█░
    █░██░░░██░░░▀█▄▄▄█▀░░░██░░░██░█░
    █░░██░░░▀█▄░░░███░░░▄█▀░░░██░░█░
    █▄░░▀█▄░░░▀█▄░░░░░▄█▀░░░▄█▀░░▄█░
    ░█▄░░░▀█▄░░░▀██▄▄██▀░░░▄█▀░░░█▀░
    ░░▀█▄░░░▀██▄░░░░░░░░▄██▀░░░▄█▀░░
    ░░░░▀█▄░░░░▀▀██████▀▀░░░░▄█▀░░░░
    ░░░░░░▀▀█▄▄░░░░░░░░░░▄▄█▀▀░░░░░░
    ░░░░░░░░░░░▀▀▀▀▀▀▀▀▀▀▀░░░░░░░░░░
```

## 📁 Contenu du Package

| Fichier | Description |
|---------|-------------|
| `BiohazardLauncher.ps1` | Interface graphique principale avec icône Biohazard |
| `CleanShutdownRestart.ps1` | Script d'arrêt/redémarrage propre |
| `StartupManager.ps1` | Gestionnaire de démarrage des applications |
| `SystemDiagnostic.ps1` | Diagnostic complet du système |
| `Install.ps1` | Script d'installation |

## 🚀 Installation Rapide

1. **Ouvrir PowerShell en Administrateur**
2. **Exécuter le script d'installation:**

```powershell
cd "chemin\vers\pc-manager"
.\Install.ps1
```

Ou installation manuelle:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 💻 Utilisation

### Interface Graphique (Recommandé)
```powershell
.\BiohazardLauncher.ps1
```

### Ligne de Commande

#### Redémarrage Propre
```powershell
# Redémarrage standard (30 secondes de délai)
.\CleanShutdownRestart.ps1 -Action Restart

# Redémarrage forcé immédiat
.\CleanShutdownRestart.ps1 -Action Restart -Force -DelaySeconds 5

# Arrêt complet
.\CleanShutdownRestart.ps1 -Action Shutdown

# Veille prolongée
.\CleanShutdownRestart.ps1 -Action Hibernate

# Mise en veille
.\CleanShutdownRestart.ps1 -Action Sleep
```

#### Gestionnaire de Démarrage
```powershell
# Démarrage interactif
.\StartupManager.ps1

# Démarrage silencieux
.\StartupManager.ps1 -Silent

# Avec vérification des ressources
.\StartupManager.ps1 -CheckResources
```

#### Diagnostic Système
```powershell
# Diagnostic interactif
.\SystemDiagnostic.ps1

# Avec export du rapport
.\SystemDiagnostic.ps1 -ExportReport
```

## ⚙️ Configuration

### Configuration du Démarrage

Éditez le fichier de configuration:
```
%USERPROFILE%\Documents\PCManager\startup_config.json
```

Structure:
```json
{
  "Groups": [
    {
      "Name": "Communication",
      "Priority": 1,
      "WaitSeconds": 5,
      "Apps": [
        {
          "Name": "Microsoft Teams",
          "Path": "...",
          "Type": "Exe",
          "Enabled": true
        }
      ]
    }
  ],
  "Settings": {
    "CheckSystemResources": true,
    "MinFreeRAMPercent": 20,
    "MinFreeDiskGB": 5,
    "WaitForNetworkSeconds": 30
  }
}
```

### Types d'Applications

| Type | Description | Exemple |
|------|-------------|---------|
| `Exe` | Exécutable direct | `C:\Program Files\App\app.exe` |
| `AppName` | Nom d'application Windows | `chrome`, `notepad++` |
| `Command` | Commande shell | `code` |
| `URI` | URI Windows | `windowsdefender:` |

## 📊 Fonctionnalités

### Arrêt/Redémarrage Propre
- ✅ Sauvegarde automatique des documents Office (Word, Excel, PowerPoint)
- ✅ Fermeture gracieuse de toutes les applications
- ✅ Détection des erreurs système
- ✅ Vérification des mises à jour en attente
- ✅ Nettoyage des fichiers temporaires
- ✅ Journal des opérations

### Gestionnaire de Démarrage
- ✅ Démarrage par groupes ordonnés
- ✅ Vérification des ressources système
- ✅ Attente de la connexion réseau
- ✅ Interface visuelle avec barre de progression
- ✅ Rapport de démarrage

### Diagnostic Système
- ✅ Informations système complètes
- ✅ État de la mémoire et CPU
- ✅ Santé des disques
- ✅ Connectivité réseau
- ✅ Services critiques
- ✅ Erreurs système (24h)
- ✅ Mises à jour Windows
- ✅ Statut de sécurité (Defender, Pare-feu)
- ✅ Score de santé global

## 📂 Emplacement des Fichiers

```
%USERPROFILE%\Documents\PCManager\
├── Logs\
│   ├── shutdown_YYYYMMDD_HHmmss.log
│   ├── startup_YYYYMMDD_HHmmss.log
│   ├── last_shutdown_report.json
│   └── last_startup_report.json
├── Reports\
│   └── diagnostic_YYYYMMDD_HHmmss.json
└── startup_config.json
```

## ⚠️ Prérequis

- Windows 10/11
- PowerShell 5.1+
- Droits administrateur (pour certaines fonctions)

## 🔧 Dépannage

### "L'exécution de scripts est désactivée"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Accès refusé"
Exécutez PowerShell en tant qu'administrateur.

### Les applications ne se ferment pas
Utilisez l'option `-Force`:
```powershell
.\CleanShutdownRestart.ps1 -Action Restart -Force
```

## 📝 Logs

Tous les logs sont disponibles dans:
```
%USERPROFILE%\Documents\PCManager\Logs\
```

---

**☣️ BIOHAZARD PC MANAGER** - Créé par Claude Code Assistant

*Version 1.0.0 - Décembre 2025*
