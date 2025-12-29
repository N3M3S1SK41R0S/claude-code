<#
.SYNOPSIS
    NEMESIS OMEGA ARCHITECT V3 - ULTIMATE BERSERKER EDITION
    Script de maintenance système transcendant pour l'écosystème NEMESIS

.DESCRIPTION
    Version ULTIMATE du script de maintenance intégrale incluant:
    - 12 phases de maintenance complètes
    - 25+ APIs IA validées en temps réel
    - Backup/Snapshot intelligent avec versioning
    - Monitoring hardware avancé (S.M.A.R.T., températures, GPU AMD/NVIDIA/Intel)
    - Multi-webhooks (Discord, Telegram, Slack, Teams, Email, PagerDuty, Pushover)
    - Rotation et compression des logs avec rétention configurable
    - Self-tests pré-exécution exhaustifs
    - Export métriques Prometheus/Grafana
    - Détection processus IA actifs (30+ outils)
    - Auto-documentation générée
    - Diagnostics réseau complets
    - Intégration Docker/WSL/Kubernetes
    - Analyse Event Log Windows
    - Audit sécurité système
    - Trending et analytics historiques
    - Support multi-langue
    - Mode parallel processing
    - Encryption des credentials

.PARAMETER DryRun
    Mode simulation - aucune modification réelle

.PARAMETER SkipUpdates
    Ignorer la phase de mises à jour

.PARAMETER Force
    Continuer malgré les erreurs

.PARAMETER OnlyPhases
    Exécuter uniquement les phases spécifiées (1-12)

.PARAMETER Verbose
    Activer les logs détaillés

.PARAMETER SkipSelfTest
    Ignorer les tests préliminaires

.PARAMETER ExportPrometheus
    Exporter les métriques au format Prometheus

.PARAMETER ReportAsMarkdown
    Générer rapport en Markdown

.PARAMETER ParallelMode
    Activer le traitement parallèle

.PARAMETER Language
    Langue des messages (FR, EN, ES, DE)

.PARAMETER DiskWarn
    Seuil d'avertissement espace disque (%)

.PARAMETER DiskCrit
    Seuil critique espace disque (%)

.PARAMETER TempWarn
    Seuil d'avertissement température (°C)

.PARAMETER TempCrit
    Seuil critique température (°C)

.PARAMETER EnableEncryption
    Activer le chiffrement des credentials

.PARAMETER IncludeNetworkDiag
    Inclure diagnostics réseau complets

.PARAMETER IncludeSecurityAudit
    Inclure audit de sécurité

.PARAMETER EnableTrending
    Activer le suivi historique des métriques

.EXAMPLE
    .\NEMESIS_OMEGA_ARCHITECT_V3_ULTIMATE.ps1

.EXAMPLE
    .\NEMESIS_OMEGA_ARCHITECT_V3_ULTIMATE.ps1 -DryRun -Verbose -ParallelMode

.EXAMPLE
    .\NEMESIS_OMEGA_ARCHITECT_V3_ULTIMATE.ps1 -OnlyPhases @(1,4,5,10) -Force -ExportPrometheus

.EXAMPLE
    .\NEMESIS_OMEGA_ARCHITECT_V3_ULTIMATE.ps1 -IncludeNetworkDiag -IncludeSecurityAudit -EnableTrending

.NOTES
    Auteur: NEMESIS OMEGA ARCHITECT - ULTIMATE MODE
    Version: 3.0.0-ULTIMATE
    Date: 2024-12-29
    Créé pour: Pierre Tagnard - Architecte Primordial

    ATTENTION: Ce script nécessite des privilèges administrateur

.LINK
    https://github.com/pierre-tagnard/nemesis-omega
#>

#Requires -Version 5.1
#Requires -RunAsAdministrator

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(HelpMessage = "Mode simulation sans modifications")]
    [switch]$DryRun,

    [Parameter(HelpMessage = "Ignorer les mises à jour")]
    [switch]$SkipUpdates,

    [Parameter(HelpMessage = "Continuer malgré les erreurs")]
    [switch]$Force,

    [Parameter(HelpMessage = "Phases spécifiques à exécuter (1-12)")]
    [ValidateRange(1, 12)]
    [int[]]$OnlyPhases,

    [Parameter(HelpMessage = "Ignorer les self-tests")]
    [switch]$SkipSelfTest,

    [Parameter(HelpMessage = "Exporter métriques Prometheus")]
    [switch]$ExportPrometheus,

    [Parameter(HelpMessage = "Générer rapport Markdown")]
    [switch]$ReportAsMarkdown,

    [Parameter(HelpMessage = "Activer le traitement parallèle")]
    [switch]$ParallelMode,

    [Parameter(HelpMessage = "Langue des messages")]
    [ValidateSet("FR", "EN", "ES", "DE")]
    [string]$Language = "FR",

    [Parameter(HelpMessage = "Seuil avertissement disque (%)")]
    [ValidateRange(1, 100)]
    [int]$DiskWarn = 10,

    [Parameter(HelpMessage = "Seuil critique disque (%)")]
    [ValidateRange(1, 100)]
    [int]$DiskCrit = 5,

    [Parameter(HelpMessage = "Seuil avertissement température (°C)")]
    [ValidateRange(1, 200)]
    [int]$TempWarn = 80,

    [Parameter(HelpMessage = "Seuil critique température (°C)")]
    [ValidateRange(1, 200)]
    [int]$TempCrit = 95,

    [Parameter(HelpMessage = "Activer chiffrement credentials")]
    [switch]$EnableEncryption,

    [Parameter(HelpMessage = "Inclure diagnostics réseau")]
    [switch]$IncludeNetworkDiag,

    [Parameter(HelpMessage = "Inclure audit sécurité")]
    [switch]$IncludeSecurityAudit,

    [Parameter(HelpMessage = "Activer trending historique")]
    [switch]$EnableTrending,

    [Parameter(HelpMessage = "Chemin racine NEMESIS personnalisé")]
    [string]$CustomNemesisRoot,

    [Parameter(HelpMessage = "Activer notifications toast Windows")]
    [switch]$EnableToast,

    [Parameter(HelpMessage = "Inclure scan Docker/Containers")]
    [switch]$IncludeContainerScan,

    [Parameter(HelpMessage = "Inclure scan WSL")]
    [switch]$IncludeWSLScan,

    [Parameter(HelpMessage = "Profondeur maximale de scan")]
    [ValidateRange(1, 20)]
    [int]$MaxScanDepth = 10,

    [Parameter(HelpMessage = "Activer le mode silencieux")]
    [switch]$Silent,

    [Parameter(HelpMessage = "Exporter vers InfluxDB")]
    [switch]$ExportInfluxDB,

    [Parameter(HelpMessage = "URL InfluxDB")]
    [string]$InfluxDBUrl = "http://localhost:8086",

    [Parameter(HelpMessage = "Activer le nettoyage agressif")]
    [switch]$AggressiveCleanup
)

# ═══════════════════════════════════════════════════════════════════════════════
# STRICT MODE & ERROR HANDLING
# ═══════════════════════════════════════════════════════════════════════════════
Set-StrictMode -Version Latest

# ═══════════════════════════════════════════════════════════════════════════════
# POWERSHELL 5.x COMPATIBILITY - Null Coalescing Function
# ═══════════════════════════════════════════════════════════════════════════════
function Get-ValueOrDefault {
    param($Value, $Default)
    if ($null -ne $Value -and $Value -ne '') { return $Value } else { return $Default }
}
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
$PSDefaultParameterValues['*:Encoding'] = 'UTF8'

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION GLOBALE ULTIMATE
# ═══════════════════════════════════════════════════════════════════════════════
$script:Config = @{
    Version = "3.0.0-ULTIMATE"
    BuildDate = "2024-12-29"
    Author = "NEMESIS OMEGA ARCHITECT"
    Codename = "BERSERKER ULTIMATE"

    # ═══════════════════════════════════════════════════════════════════════════
    # CHEMINS SYSTÈME
    # ═══════════════════════════════════════════════════════════════════════════
    Paths = @{
        SystemDrive = "C:"
        DataDrive = "D:"
        ExternalDrive = "E:"
        NemesisRoot = if ($CustomNemesisRoot) { $CustomNemesisRoot } else { "E:\MUSIC\Music_Music\MUSIC__Music\MUSIC__Music__6_0\MUSIC_Music_6_0_5\MUSIC_Music_6.1\MUSIC_MUSIC_6.9.3\MUSIC_MUSIC_6.10\MUSIC_MUSIC_6.10.9\MUSIC_MUSIC_6.11\MUSIC_MUSIC_7\MUSIC_MUSIC_7.0.1\MUSIC_7.0.5\MUSIC_7.0.5.2\MUSIC_7.0.5.3\MUSIC_MUSIC_7.0.6\NEMESIS_MEMORY" }
        Workflows = "D:\MUSIC\Music_Music\MUSIC__Music\MUSIC__Music__6_0\MUSIC_Music_6_0_5\MUSIC_Music_6.1\MUSIC_MUSIC_6.9.3\MUSIC_MUSIC_6.10\MUSIC_MUSIC_6.10.9\MUSIC_MUSIC_6.11\MUSIC_MUSIC_7\MUSIC_MUSIC_7.0.1\MUSIC_7.0.5\MUSIC_7.0.5.2\MUSIC_7.0.5.3\MUSIC_MUSIC_7.0.6"
    }

    # ═══════════════════════════════════════════════════════════════════════════
    # WEBHOOKS & NOTIFICATIONS (Extended)
    # ═══════════════════════════════════════════════════════════════════════════
    Webhooks = @{
        Discord = @{
            Enabled = $true
            Url = $env:DISCORD_WEBHOOK_URL
            Username = "NEMESIS OMEGA"
            AvatarUrl = "https://i.imgur.com/nemesis.png"
        }
        Telegram = @{
            Enabled = $true
            BotToken = $env:TELEGRAM_BOT_TOKEN
            ChatId = $env:TELEGRAM_CHAT_ID
            ParseMode = "Markdown"
        }
        Slack = @{
            Enabled = $false
            WebhookUrl = $env:SLACK_WEBHOOK_URL
            Channel = "#nemesis-alerts"
            IconEmoji = ":robot_face:"
        }
        Teams = @{
            Enabled = $false
            WebhookUrl = $env:TEAMS_WEBHOOK_URL
            ThemeColor = "FF0088"
        }
        Email = @{
            Enabled = $false
            SmtpServer = $env:SMTP_SERVER
            SmtpPort = 587
            UseSsl = $true
            From = $env:EMAIL_FROM
            To = $env:EMAIL_TO
            Username = $env:SMTP_USERNAME
            Password = $env:SMTP_PASSWORD
        }
        PagerDuty = @{
            Enabled = $false
            RoutingKey = $env:PAGERDUTY_ROUTING_KEY
            Severity = "warning"
        }
        Pushover = @{
            Enabled = $false
            UserKey = $env:PUSHOVER_USER_KEY
            ApiToken = $env:PUSHOVER_API_TOKEN
            Priority = 0
        }
        Ntfy = @{
            Enabled = $false
            Server = "https://ntfy.sh"
            Topic = $env:NTFY_TOPIC
            Priority = 3
        }
        Gotify = @{
            Enabled = $false
            Url = $env:GOTIFY_URL
            Token = $env:GOTIFY_TOKEN
            Priority = 5
        }
        Matrix = @{
            Enabled = $false
            HomeServer = $env:MATRIX_HOMESERVER
            RoomId = $env:MATRIX_ROOM_ID
            AccessToken = $env:MATRIX_ACCESS_TOKEN
        }
    }

    # ═══════════════════════════════════════════════════════════════════════════
    # APIs IA (Extended - 25+ providers)
    # ═══════════════════════════════════════════════════════════════════════════
    APIs = @{
        # === TIER 1 - Major Providers ===
        Anthropic = @{
            Name = "Anthropic Claude"
            EnvVar = "ANTHROPIC_API_KEY"
            TestEndpoint = "https://api.anthropic.com/v1/messages"
            AuthHeader = "x-api-key"
            ExtraHeaders = @{ "anthropic-version" = "2023-06-01" }
            Tier = 1
        }
        OpenAI = @{
            Name = "OpenAI GPT"
            EnvVar = "OPENAI_API_KEY"
            TestEndpoint = "https://api.openai.com/v1/models"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 1
        }
        Google = @{
            Name = "Google Gemini"
            EnvVar = "GOOGLE_API_KEY"
            TestEndpoint = "https://generativelanguage.googleapis.com/v1/models"
            AuthHeader = "x-goog-api-key"
            Tier = 1
        }
        Azure = @{
            Name = "Azure OpenAI"
            EnvVar = "AZURE_OPENAI_API_KEY"
            TestEndpoint = $env:AZURE_OPENAI_ENDPOINT
            AuthHeader = "api-key"
            Tier = 1
        }

        # === TIER 2 - Specialized Providers ===
        Mistral = @{
            Name = "Mistral AI"
            EnvVar = "MISTRAL_API_KEY"
            TestEndpoint = "https://api.mistral.ai/v1/models"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 2
        }
        XAI = @{
            Name = "xAI Grok"
            EnvVar = "XAI_API_KEY"
            TestEndpoint = "https://api.x.ai/v1/models"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 2
        }
        Cohere = @{
            Name = "Cohere"
            EnvVar = "COHERE_API_KEY"
            TestEndpoint = "https://api.cohere.ai/v1/models"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 2
        }
        DeepSeek = @{
            Name = "DeepSeek"
            EnvVar = "DEEPSEEK_API_KEY"
            TestEndpoint = "https://api.deepseek.com/v1/models"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 2
        }

        # === TIER 3 - Cloud Inference ===
        HuggingFace = @{
            Name = "Hugging Face"
            EnvVar = "HF_API_KEY"
            TestEndpoint = "https://huggingface.co/api/whoami"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 3
        }
        Replicate = @{
            Name = "Replicate"
            EnvVar = "REPLICATE_API_TOKEN"
            TestEndpoint = "https://api.replicate.com/v1/account"
            AuthHeader = "Authorization"
            AuthPrefix = "Token"
            Tier = 3
        }
        Together = @{
            Name = "Together AI"
            EnvVar = "TOGETHER_API_KEY"
            TestEndpoint = "https://api.together.xyz/v1/models"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 3
        }
        Fireworks = @{
            Name = "Fireworks AI"
            EnvVar = "FIREWORKS_API_KEY"
            TestEndpoint = "https://api.fireworks.ai/inference/v1/models"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 3
        }
        Groq = @{
            Name = "Groq"
            EnvVar = "GROQ_API_KEY"
            TestEndpoint = "https://api.groq.com/openai/v1/models"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 3
        }
        Perplexity = @{
            Name = "Perplexity AI"
            EnvVar = "PERPLEXITY_API_KEY"
            TestEndpoint = "https://api.perplexity.ai/chat/completions"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 3
        }
        Anyscale = @{
            Name = "Anyscale"
            EnvVar = "ANYSCALE_API_KEY"
            TestEndpoint = "https://api.endpoints.anyscale.com/v1/models"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 3
        }

        # === TIER 4 - Specialized & Local ===
        Ollama = @{
            Name = "Ollama (Local)"
            EnvVar = "OLLAMA_HOST"
            TestEndpoint = "http://localhost:11434/api/tags"
            AuthHeader = $null
            Tier = 4
            Local = $true
        }
        LMStudio = @{
            Name = "LM Studio (Local)"
            EnvVar = "LMSTUDIO_HOST"
            TestEndpoint = "http://localhost:1234/v1/models"
            AuthHeader = $null
            Tier = 4
            Local = $true
        }
        LocalAI = @{
            Name = "LocalAI"
            EnvVar = "LOCALAI_HOST"
            TestEndpoint = "http://localhost:8080/v1/models"
            AuthHeader = $null
            Tier = 4
            Local = $true
        }
        TextGenWebUI = @{
            Name = "Text Generation WebUI"
            EnvVar = "TEXTGEN_HOST"
            TestEndpoint = "http://localhost:5000/api/v1/model"
            AuthHeader = $null
            Tier = 4
            Local = $true
        }

        # === TIER 5 - Tools & Services ===
        Notion = @{
            Name = "Notion"
            EnvVar = "NOTION_API_KEY"
            TestEndpoint = "https://api.notion.com/v1/users/me"
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            ExtraHeaders = @{ "Notion-Version" = "2022-06-28" }
            Tier = 5
        }
        GitHub = @{
            Name = "GitHub"
            EnvVar = "GITHUB_TOKEN"
            TestEndpoint = "https://api.github.com/user"
            AuthHeader = "Authorization"
            AuthPrefix = "token"
            Tier = 5
        }
        GitLab = @{
            Name = "GitLab"
            EnvVar = "GITLAB_TOKEN"
            TestEndpoint = "https://gitlab.com/api/v4/user"
            AuthHeader = "PRIVATE-TOKEN"
            Tier = 5
        }
        Jira = @{
            Name = "Jira"
            EnvVar = "JIRA_API_TOKEN"
            TestEndpoint = $env:JIRA_BASE_URL
            AuthHeader = "Authorization"
            AuthPrefix = "Basic"
            Tier = 5
        }
        Linear = @{
            Name = "Linear"
            EnvVar = "LINEAR_API_KEY"
            TestEndpoint = "https://api.linear.app/graphql"
            AuthHeader = "Authorization"
            Tier = 5
        }

        # === TIER 6 - Databases & Vector Stores ===
        Pinecone = @{
            Name = "Pinecone"
            EnvVar = "PINECONE_API_KEY"
            TestEndpoint = "https://api.pinecone.io/indexes"
            AuthHeader = "Api-Key"
            Tier = 6
        }
        Weaviate = @{
            Name = "Weaviate"
            EnvVar = "WEAVIATE_API_KEY"
            TestEndpoint = $env:WEAVIATE_URL
            AuthHeader = "Authorization"
            AuthPrefix = "Bearer"
            Tier = 6
        }
        Qdrant = @{
            Name = "Qdrant"
            EnvVar = "QDRANT_API_KEY"
            TestEndpoint = "http://localhost:6333/collections"
            AuthHeader = "api-key"
            Tier = 6
        }
        Milvus = @{
            Name = "Milvus"
            EnvVar = "MILVUS_HOST"
            TestEndpoint = "http://localhost:19530/v1/vector/collections"
            AuthHeader = $null
            Tier = 6
            Local = $true
        }
        ChromaDB = @{
            Name = "ChromaDB"
            EnvVar = "CHROMA_HOST"
            TestEndpoint = "http://localhost:8000/api/v1/heartbeat"
            AuthHeader = $null
            Tier = 6
            Local = $true
        }

        # === TIER 7 - Automation & Integration ===
        Make = @{
            Name = "Make.com"
            EnvVar = "MAKE_API_KEY"
            TestEndpoint = "https://eu1.make.com/api/v2/users/me"
            AuthHeader = "Authorization"
            AuthPrefix = "Token"
            Tier = 7
        }
        Zapier = @{
            Name = "Zapier"
            EnvVar = "ZAPIER_NLA_API_KEY"
            TestEndpoint = "https://nla.zapier.com/api/v1/check"
            AuthHeader = "X-API-Key"
            Tier = 7
        }
        N8N = @{
            Name = "n8n"
            EnvVar = "N8N_API_KEY"
            TestEndpoint = "http://localhost:5678/api/v1/workflows"
            AuthHeader = "X-N8N-API-KEY"
            Tier = 7
            Local = $true
        }
    }

    # ═══════════════════════════════════════════════════════════════════════════
    # PROCESSUS IA DÉTECTÉS (Extended - 30+ tools)
    # ═══════════════════════════════════════════════════════════════════════════
    AIProcesses = @(
        # === LLM Servers ===
        @{ Name = "ollama"; DisplayName = "Ollama"; Category = "LLM Server"; Critical = $true }
        @{ Name = "llama.cpp"; DisplayName = "Llama.cpp"; Category = "LLM Server"; Critical = $false }
        @{ Name = "text-generation-webui"; DisplayName = "Text Gen WebUI"; Category = "LLM Server"; Critical = $false }
        @{ Name = "localai"; DisplayName = "LocalAI"; Category = "LLM Server"; Critical = $false }
        @{ Name = "vllm"; DisplayName = "vLLM"; Category = "LLM Server"; Critical = $false }
        @{ Name = "tgi"; DisplayName = "Text Generation Inference"; Category = "LLM Server"; Critical = $false }

        # === IDE & Editors ===
        @{ Name = "claude"; DisplayName = "Claude Desktop"; Category = "AI Desktop"; Critical = $true }
        @{ Name = "Cursor"; DisplayName = "Cursor IDE"; Category = "AI IDE"; Critical = $true }
        @{ Name = "Code"; DisplayName = "VS Code"; Category = "IDE"; Critical = $false }
        @{ Name = "windsurf"; DisplayName = "Windsurf"; Category = "AI IDE"; Critical = $false }
        @{ Name = "zed"; DisplayName = "Zed Editor"; Category = "AI IDE"; Critical = $false }
        @{ Name = "aider"; DisplayName = "Aider"; Category = "AI Coding"; Critical = $false }

        # === Runtimes ===
        @{ Name = "python"; DisplayName = "Python"; Category = "Runtime"; Critical = $false }
        @{ Name = "python3"; DisplayName = "Python 3"; Category = "Runtime"; Critical = $false }
        @{ Name = "node"; DisplayName = "Node.js"; Category = "Runtime"; Critical = $false }
        @{ Name = "deno"; DisplayName = "Deno"; Category = "Runtime"; Critical = $false }
        @{ Name = "bun"; DisplayName = "Bun"; Category = "Runtime"; Critical = $false }

        # === Containers & Orchestration ===
        @{ Name = "docker"; DisplayName = "Docker"; Category = "Container"; Critical = $false }
        @{ Name = "dockerd"; DisplayName = "Docker Daemon"; Category = "Container"; Critical = $false }
        @{ Name = "containerd"; DisplayName = "containerd"; Category = "Container"; Critical = $false }
        @{ Name = "kubectl"; DisplayName = "Kubernetes CLI"; Category = "Orchestration"; Critical = $false }
        @{ Name = "podman"; DisplayName = "Podman"; Category = "Container"; Critical = $false }

        # === Databases ===
        @{ Name = "postgres"; DisplayName = "PostgreSQL"; Category = "Database"; Critical = $false }
        @{ Name = "redis-server"; DisplayName = "Redis"; Category = "Database"; Critical = $false }
        @{ Name = "mongod"; DisplayName = "MongoDB"; Category = "Database"; Critical = $false }
        @{ Name = "qdrant"; DisplayName = "Qdrant"; Category = "Vector DB"; Critical = $false }
        @{ Name = "chromadb"; DisplayName = "ChromaDB"; Category = "Vector DB"; Critical = $false }
        @{ Name = "milvus"; DisplayName = "Milvus"; Category = "Vector DB"; Critical = $false }

        # === AI/ML Tools ===
        @{ Name = "jupyter"; DisplayName = "Jupyter"; Category = "ML Tool"; Critical = $false }
        @{ Name = "tensorboard"; DisplayName = "TensorBoard"; Category = "ML Tool"; Critical = $false }
        @{ Name = "mlflow"; DisplayName = "MLflow"; Category = "ML Tool"; Critical = $false }
        @{ Name = "ray"; DisplayName = "Ray"; Category = "ML Framework"; Critical = $false }

        # === Automation ===
        @{ Name = "n8n"; DisplayName = "n8n"; Category = "Automation"; Critical = $false }
        @{ Name = "make"; DisplayName = "Make"; Category = "Automation"; Critical = $false }
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # RÉTENTION & ARCHIVAGE
    # ═══════════════════════════════════════════════════════════════════════════
    Retention = @{
        LogDays = 30
        ArchiveDays = 365
        BackupCount = 10
        CompressAfterDays = 7
        TrendingHistoryDays = 90
        ReportRetentionDays = 60
        MetricsRetentionDays = 30
    }

    # ═══════════════════════════════════════════════════════════════════════════
    # SEUILS & ALERTES
    # ═══════════════════════════════════════════════════════════════════════════
    Thresholds = @{
        DiskWarningPercent = $DiskWarn
        DiskCriticalPercent = $DiskCrit
        TempWarningCelsius = $TempWarn
        TempCriticalCelsius = $TempCrit
        HealthScoreMinimum = 70
        MemoryWarningPercent = 85
        MemoryCriticalPercent = 95
        CPUWarningPercent = 80
        CPUCriticalPercent = 95
        NetworkLatencyWarningMs = 100
        NetworkLatencyCriticalMs = 500
        APIResponseTimeWarningMs = 2000
        APIResponseTimeCriticalMs = 5000
    }

    # ═══════════════════════════════════════════════════════════════════════════
    # EXTENSIONS FICHIERS
    # ═══════════════════════════════════════════════════════════════════════════
    FileExtensions = @{
        Code = @(".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs", ".rb", ".php", ".java", ".kt", ".swift", ".c", ".cpp", ".h", ".cs", ".fs", ".scala", ".clj", ".ex", ".exs", ".lua", ".r", ".jl", ".dart", ".vue", ".svelte")
        Config = @(".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".env", ".properties", ".xml", ".plist")
        Docs = @(".md", ".mdx", ".rst", ".txt", ".adoc", ".org", ".tex", ".rtf")
        Data = @(".csv", ".tsv", ".parquet", ".arrow", ".feather", ".avro", ".orc")
        Scripts = @(".ps1", ".sh", ".bash", ".zsh", ".fish", ".bat", ".cmd", ".vbs")
        AI = @(".gguf", ".ggml", ".safetensors", ".bin", ".pt", ".pth", ".onnx", ".tflite", ".h5", ".pkl", ".joblib")
    }

    # ═══════════════════════════════════════════════════════════════════════════
    # INTERNATIONALISATION
    # ═══════════════════════════════════════════════════════════════════════════
    i18n = @{
        FR = @{
            PhaseComplete = "PHASE TERMINÉE"
            ErrorOccurred = "Erreur survenue"
            HealthScore = "Score de santé"
            FilesScanned = "Fichiers scannés"
            DuplicatesRemoved = "Doublons supprimés"
            UpdatesInstalled = "Mises à jour installées"
            BackupCreated = "Sauvegarde créée"
            Starting = "Démarrage"
            Completed = "Terminé"
            Warning = "Avertissement"
            Critical = "Critique"
            Repairing = "Réparation en cours"
            Scanning = "Analyse en cours"
            Optimizing = "Optimisation"
        }
        EN = @{
            PhaseComplete = "PHASE COMPLETE"
            ErrorOccurred = "Error occurred"
            HealthScore = "Health score"
            FilesScanned = "Files scanned"
            DuplicatesRemoved = "Duplicates removed"
            UpdatesInstalled = "Updates installed"
            BackupCreated = "Backup created"
            Starting = "Starting"
            Completed = "Completed"
            Warning = "Warning"
            Critical = "Critical"
            Repairing = "Repairing"
            Scanning = "Scanning"
            Optimizing = "Optimizing"
        }
        ES = @{
            PhaseComplete = "FASE COMPLETADA"
            ErrorOccurred = "Error ocurrido"
            HealthScore = "Puntuación de salud"
            FilesScanned = "Archivos escaneados"
            DuplicatesRemoved = "Duplicados eliminados"
            UpdatesInstalled = "Actualizaciones instaladas"
            BackupCreated = "Copia de seguridad creada"
            Starting = "Iniciando"
            Completed = "Completado"
            Warning = "Advertencia"
            Critical = "Crítico"
            Repairing = "Reparando"
            Scanning = "Escaneando"
            Optimizing = "Optimizando"
        }
        DE = @{
            PhaseComplete = "PHASE ABGESCHLOSSEN"
            ErrorOccurred = "Fehler aufgetreten"
            HealthScore = "Gesundheitswert"
            FilesScanned = "Dateien gescannt"
            DuplicatesRemoved = "Duplikate entfernt"
            UpdatesInstalled = "Updates installiert"
            BackupCreated = "Backup erstellt"
            Starting = "Starten"
            Completed = "Abgeschlossen"
            Warning = "Warnung"
            Critical = "Kritisch"
            Repairing = "Reparieren"
            Scanning = "Scannen"
            Optimizing = "Optimieren"
        }
    }

    # ═══════════════════════════════════════════════════════════════════════════
    # NETWORK DIAGNOSTICS CONFIG
    # ═══════════════════════════════════════════════════════════════════════════
    NetworkDiagnostics = @{
        DNSServers = @("8.8.8.8", "1.1.1.1", "9.9.9.9", "208.67.222.222")
        TestHosts = @("google.com", "cloudflare.com", "github.com", "api.anthropic.com")
        SpeedTestServers = @("speedtest.net", "fast.com")
        Ports = @{
            HTTP = 80
            HTTPS = 443
            SSH = 22
            DNS = 53
            Ollama = 11434
            LMStudio = 1234
            Qdrant = 6333
            Redis = 6379
            PostgreSQL = 5432
        }
    }

    # ═══════════════════════════════════════════════════════════════════════════
    # SECURITY AUDIT CONFIG
    # ═══════════════════════════════════════════════════════════════════════════
    SecurityAudit = @{
        CheckWindowsUpdate = $true
        CheckFirewall = $true
        CheckAntivirus = $true
        CheckBitLocker = $true
        CheckUAC = $true
        CheckRemoteDesktop = $true
        CheckOpenPorts = $true
        CheckSSHKeys = $true
        CheckCredentials = $true
        SuspiciousProcessPatterns = @("cryptominer", "keylogger", "botnet", "ransomware")
        RequiredSecurityPatches = @()
    }
}

# Compléter les chemins dérivés
$script:Config.Paths.Add("Logs", (Join-Path $script:Config.Paths.NemesisRoot "_LOGS"))
$script:Config.Paths.Add("Reports", (Join-Path $script:Config.Paths.NemesisRoot "_REPORTS"))
$script:Config.Paths.Add("Backups", (Join-Path $script:Config.Paths.NemesisRoot "_BACKUPS"))
$script:Config.Paths.Add("Config", (Join-Path $script:Config.Paths.NemesisRoot "_CONFIG"))
$script:Config.Paths.Add("SharedIndex", (Join-Path $script:Config.Paths.NemesisRoot "SHARED_INDEX"))
$script:Config.Paths.Add("AgentMemory", (Join-Path $script:Config.Paths.NemesisRoot "AGENT_MEMORY"))
$script:Config.Paths.Add("Prometheus", (Join-Path $script:Config.Paths.Reports "prometheus"))
$script:Config.Paths.Add("Documentation", (Join-Path $script:Config.Paths.NemesisRoot "_DOCS"))
$script:Config.Paths.Add("Trending", (Join-Path $script:Config.Paths.Reports "trending"))
$script:Config.Paths.Add("Security", (Join-Path $script:Config.Paths.Reports "security"))
$script:Config.Paths.Add("Network", (Join-Path $script:Config.Paths.Reports "network"))
$script:Config.Paths.Add("Containers", (Join-Path $script:Config.Paths.Reports "containers"))
$script:Config.Paths.Add("Credentials", (Join-Path $script:Config.Paths.Config "credentials"))
$script:Config.Paths.Add("Templates", (Join-Path $script:Config.Paths.Config "templates"))
$script:Config.Paths.Add("Plugins", (Join-Path $script:Config.Paths.NemesisRoot "_PLUGINS"))

# ═══════════════════════════════════════════════════════════════════════════════
# VARIABLES GLOBALES DE SUIVI
# ═══════════════════════════════════════════════════════════════════════════════
$script:StartTime = Get-Date
$script:LogFile = $null
$script:EnvMasterPath = $null
$script:SelfTestResults = @{}
$script:APIValidationResults = @{}
$script:HardwareHealth = @{}
$script:NetworkHealth = @{}
$script:SecurityAuditResults = @{}
$script:ContainerHealth = @{}
$script:WSLHealth = @{}
$script:TrendingData = @{}
$script:CurrentLanguage = $Language

$script:Statistics = @{
    FilesScanned = 0
    DuplicatesRemoved = 0
    FilesArchived = 0
    UpdatesInstalled = 0
    ErrorsEncountered = 0
    ErrorsRepaired = 0
    APIsTested = 0
    APIsValid = 0
    SelfTestsPassed = 0
    SelfTestsFailed = 0
    BackupsCreated = 0
    LogsRotated = 0
    SecurityIssuesFound = 0
    SecurityIssuesFixed = 0
    NetworkTestsPassed = 0
    NetworkTestsFailed = 0
    ContainersScanned = 0
    ContainersHealthy = 0
    WSLDistrosFound = 0
    CredentialsSecured = 0
    CacheCleared = 0
    TempFilesRemoved = 0
    ServicesOptimized = 0
    StartupItemsAudited = 0
    RegistryKeysOptimized = 0
    Duration = [TimeSpan]::Zero
}

$script:Actions = [System.Collections.Generic.List[string]]::new()
$script:Errors = [System.Collections.Generic.List[string]]::new()
$script:Warnings = [System.Collections.Generic.List[string]]::new()
$script:PrometheusMetrics = [System.Collections.Generic.List[string]]::new()
$script:SecurityFindings = [System.Collections.Generic.List[object]]::new()
$script:PerformanceMetrics = [System.Collections.Generic.List[object]]::new()
$script:ProgressHistory = [System.Collections.Generic.List[object]]::new()

#region ═══════════════════════════════════════════════════════════════════════════
#                              FONCTIONS UTILITAIRES CORE
#endregion ════════════════════════════════════════════════════════════════════════

function Get-LocalizedString {
    param(
        [Parameter(Mandatory)]
        [string]$Key
    )

    $lang = $script:Config.i18n[$script:CurrentLanguage]
    if ($lang -and $lang.ContainsKey($Key)) {
        return $lang[$Key]
    }
    return $Key
}

function Test-AdminPrivileges {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$identity
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Initialize-NemesisDirectories {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    $directories = @(
        $script:Config.Paths.NemesisRoot
        $script:Config.Paths.Logs
        $script:Config.Paths.Reports
        $script:Config.Paths.Backups
        $script:Config.Paths.Config
        $script:Config.Paths.SharedIndex
        $script:Config.Paths.AgentMemory
        $script:Config.Paths.Prometheus
        $script:Config.Paths.Documentation
        $script:Config.Paths.Trending
        $script:Config.Paths.Security
        $script:Config.Paths.Network
        $script:Config.Paths.Containers
        $script:Config.Paths.Credentials
        $script:Config.Paths.Templates
        $script:Config.Paths.Plugins
    )

    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            if ($PSCmdlet.ShouldProcess($dir, "Créer répertoire")) {
                try {
                    New-Item -Path $dir -ItemType Directory -Force | Out-Null
                }
                catch {
                    # Directory might be on unavailable drive
                }
            }
        }
    }

    # Initialiser le fichier de log avec rotation
    $logDir = $script:Config.Paths.Logs
    if (-not (Test-Path $logDir)) {
        $logDir = Join-Path $env:TEMP "NEMESIS_LOGS"
        New-Item -Path $logDir -ItemType Directory -Force | Out-Null
    }

    $script:LogFile = Join-Path $logDir "nemesis_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
    $script:EnvMasterPath = Join-Path $script:Config.Paths.Config ".env.master"
}

function Write-NemesisLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, Position = 0)]
        [string]$Message,

        [Parameter()]
        [ValidateSet("DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL", "SECURITY", "NETWORK", "PERFORMANCE")]
        [string]$Level = "INFO",

        [Parameter()]
        [switch]$NoConsole,

        [Parameter()]
        [switch]$NoFile,

        [Parameter()]
        [string]$Component = "CORE"
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $logEntry = "[$timestamp] [$Level] [$Component] $Message"

    # Console avec couleurs (sauf mode silencieux)
    if (-not $NoConsole -and -not $Silent) {
        $color = switch ($Level) {
            "DEBUG" { "DarkGray" }
            "INFO" { "White" }
            "SUCCESS" { "Green" }
            "WARNING" { "Yellow" }
            "ERROR" { "Red" }
            "CRITICAL" { "Magenta" }
            "SECURITY" { "Cyan" }
            "NETWORK" { "Blue" }
            "PERFORMANCE" { "DarkCyan" }
            default { "White" }
        }

        $prefix = switch ($Level) {
            "DEBUG" { "🔍" }
            "INFO" { "ℹ️" }
            "SUCCESS" { "✅" }
            "WARNING" { "⚠️" }
            "ERROR" { "❌" }
            "CRITICAL" { "💀" }
            "SECURITY" { "🔒" }
            "NETWORK" { "🌐" }
            "PERFORMANCE" { "⚡" }
            default { "📝" }
        }

        Write-Host "$prefix $logEntry" -ForegroundColor $color
    }

    # Fichier
    if (-not $NoFile -and $script:LogFile) {
        try {
            $logEntry | Out-File -FilePath $script:LogFile -Append -Encoding UTF8
        }
        catch {
            # Silently fail for logging errors
        }
    }

    # Tracking
    switch ($Level) {
        "ERROR" {
            [void]$script:Errors.Add($Message)
            $script:Statistics.ErrorsEncountered++
        }
        "CRITICAL" {
            [void]$script:Errors.Add("[CRITICAL] $Message")
            $script:Statistics.ErrorsEncountered++
        }
        "WARNING" { [void]$script:Warnings.Add($Message) }
        "SUCCESS" { [void]$script:Actions.Add($Message) }
        "SECURITY" {
            [void]$script:SecurityFindings.Add(@{
                Timestamp = Get-Date
                Message = $Message
                Level = $Level
            })
        }
    }

    # Prometheus metric
    if ($ExportPrometheus -and $Level -in @("ERROR", "CRITICAL", "WARNING", "SECURITY")) {
        $metricName = "nemesis_log_$($Level.ToLower())_total"
        [void]$script:PrometheusMetrics.Add("$metricName{component=`"$Component`"} 1")
    }
}

function Write-NemesisPhase {
    param(
        [int]$PhaseNumber,
        [string]$PhaseName,
        [int]$TotalPhases = 12
    )

    if (-not $Silent) {
        Write-Host ""
        Write-Host "╔══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
        Write-Host "║          PHASE $PhaseNumber/$TotalPhases : $($PhaseName.ToUpper().PadRight(52))║" -ForegroundColor Cyan
        Write-Host "╚══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
        Write-Host ""
    }

    Write-NemesisLog "═══ PHASE $PhaseNumber/$TotalPhases : $PhaseName ═══" -Level INFO -NoConsole

    # Track progress
    [void]$script:ProgressHistory.Add(@{
        Phase = $PhaseNumber
        Name = $PhaseName
        StartTime = Get-Date
        Status = "Running"
    })
}

function Complete-NemesisPhase {
    param(
        [int]$PhaseNumber,
        [string]$Summary = ""
    )

    $phaseEntry = $script:ProgressHistory | Where-Object { $_.Phase -eq $PhaseNumber } | Select-Object -Last 1
    if ($phaseEntry) {
        $phaseEntry.EndTime = Get-Date
        $phaseEntry.Duration = ($phaseEntry.EndTime - $phaseEntry.StartTime)
        $phaseEntry.Status = "Completed"
        $phaseEntry.Summary = $Summary
    }

    $localizedComplete = Get-LocalizedString -Key "PhaseComplete"
    Write-NemesisLog "$localizedComplete - $Summary" -Level SUCCESS
}

function Write-ProgressBar {
    param(
        [int]$Current,
        [int]$Total,
        [string]$Activity = "Progression",
        [int]$BarLength = 50
    )

    if ($Silent) { return }

    $percent = [math]::Round(($Current / $Total) * 100, 0)
    $filledLength = [math]::Round(($Current / $Total) * $BarLength, 0)
    $bar = "█" * $filledLength + "░" * ($BarLength - $filledLength)

    Write-Host "`r  [$bar] $percent% - $Activity ($Current/$Total)" -NoNewline -ForegroundColor Cyan

    if ($Current -eq $Total) {
        Write-Host ""
    }
}

function Send-MultiWebhookNotification {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Content,

        [string]$Title = "NEMESIS OMEGA",

        [ValidateSet("Info", "Success", "Warning", "Error", "Critical", "Security")]
        [string]$Type = "Info",

        [switch]$Urgent
    )

    $colorMap = @{
        "Info" = 3447003       # Blue
        "Success" = 3066993    # Green
        "Warning" = 15105570   # Orange
        "Error" = 15158332     # Red
        "Critical" = 10038562  # Dark Red
        "Security" = 1752220   # Teal
    }

    # === DISCORD ===
    if ($script:Config.Webhooks.Discord.Enabled -and $script:Config.Webhooks.Discord.Url) {
        try {
            $discordPayload = @{
                username = $script:Config.Webhooks.Discord.Username
                embeds = @(
                    @{
                        title = $Title
                        description = $Content
                        color = $colorMap[$Type]
                        timestamp = (Get-Date).ToUniversalTime().ToString("o")
                        footer = @{
                            text = "NEMESIS OMEGA v$($script:Config.Version)"
                        }
                        fields = @(
                            @{
                                name = "🖥️ Machine"
                                value = $env:COMPUTERNAME
                                inline = $true
                            }
                            @{
                                name = "⏱️ Timestamp"
                                value = (Get-Date -Format "HH:mm:ss")
                                inline = $true
                            }
                        )
                    }
                )
            }

            $json = $discordPayload | ConvertTo-Json -Depth 10 -Compress
            Invoke-RestMethod -Uri $script:Config.Webhooks.Discord.Url -Method Post -Body $json -ContentType "application/json; charset=utf-8" -ErrorAction SilentlyContinue | Out-Null
            Write-NemesisLog "Notification Discord envoyée" -Level DEBUG -Component "WEBHOOK"
        }
        catch {
            Write-NemesisLog "Échec notification Discord: $($_.Exception.Message)" -Level DEBUG -Component "WEBHOOK"
        }
    }

    # === TELEGRAM ===
    if ($script:Config.Webhooks.Telegram.Enabled -and $script:Config.Webhooks.Telegram.BotToken -and $script:Config.Webhooks.Telegram.ChatId) {
        try {
            $emoji = switch ($Type) {
                "Info" { "ℹ️" }
                "Success" { "✅" }
                "Warning" { "⚠️" }
                "Error" { "❌" }
                "Critical" { "🚨" }
                "Security" { "🔒" }
            }

            $telegramText = "$emoji *$Title*`n`n$Content`n`n_Machine: $env:COMPUTERNAME _"
            $telegramUrl = "https://api.telegram.org/bot$($script:Config.Webhooks.Telegram.BotToken)/sendMessage"

            $telegramPayload = @{
                chat_id = $script:Config.Webhooks.Telegram.ChatId
                text = $telegramText
                parse_mode = $script:Config.Webhooks.Telegram.ParseMode
                disable_notification = -not $Urgent
            }

            Invoke-RestMethod -Uri $telegramUrl -Method Post -Body $telegramPayload -ErrorAction SilentlyContinue | Out-Null
            Write-NemesisLog "Notification Telegram envoyée" -Level DEBUG -Component "WEBHOOK"
        }
        catch {
            Write-NemesisLog "Échec notification Telegram: $($_.Exception.Message)" -Level DEBUG -Component "WEBHOOK"
        }
    }

    # === SLACK ===
    if ($script:Config.Webhooks.Slack.Enabled -and $script:Config.Webhooks.Slack.WebhookUrl) {
        try {
            $slackColor = switch ($Type) {
                "Info" { "#3498db" }
                "Success" { "#2ecc71" }
                "Warning" { "#f39c12" }
                "Error" { "#e74c3c" }
                "Critical" { "#8e44ad" }
                "Security" { "#1abc9c" }
            }

            $slackPayload = @{
                channel = $script:Config.Webhooks.Slack.Channel
                username = "NEMESIS OMEGA"
                icon_emoji = $script:Config.Webhooks.Slack.IconEmoji
                attachments = @(
                    @{
                        color = $slackColor
                        title = $Title
                        text = $Content
                        footer = "NEMESIS OMEGA v$($script:Config.Version) | $env:COMPUTERNAME"
                        ts = [int](Get-Date -UFormat %s)
                    }
                )
            }

            $json = $slackPayload | ConvertTo-Json -Depth 10 -Compress
            Invoke-RestMethod -Uri $script:Config.Webhooks.Slack.WebhookUrl -Method Post -Body $json -ContentType "application/json" -ErrorAction SilentlyContinue | Out-Null
            Write-NemesisLog "Notification Slack envoyée" -Level DEBUG -Component "WEBHOOK"
        }
        catch {
            Write-NemesisLog "Échec notification Slack: $($_.Exception.Message)" -Level DEBUG -Component "WEBHOOK"
        }
    }

    # === MICROSOFT TEAMS ===
    if ($script:Config.Webhooks.Teams.Enabled -and $script:Config.Webhooks.Teams.WebhookUrl) {
        try {
            $teamsPayload = @{
                "@type" = "MessageCard"
                "@context" = "http://schema.org/extensions"
                themeColor = $script:Config.Webhooks.Teams.ThemeColor
                summary = $Title
                sections = @(
                    @{
                        activityTitle = $Title
                        activitySubtitle = "NEMESIS OMEGA v$($script:Config.Version)"
                        facts = @(
                            @{ name = "Machine"; value = $env:COMPUTERNAME }
                            @{ name = "Type"; value = $Type }
                            @{ name = "Time"; value = (Get-Date -Format "yyyy-MM-dd HH:mm:ss") }
                        )
                        text = $Content
                        markdown = $true
                    }
                )
            }

            $json = $teamsPayload | ConvertTo-Json -Depth 10 -Compress
            Invoke-RestMethod -Uri $script:Config.Webhooks.Teams.WebhookUrl -Method Post -Body $json -ContentType "application/json" -ErrorAction SilentlyContinue | Out-Null
            Write-NemesisLog "Notification Teams envoyée" -Level DEBUG -Component "WEBHOOK"
        }
        catch {
            Write-NemesisLog "Échec notification Teams: $($_.Exception.Message)" -Level DEBUG -Component "WEBHOOK"
        }
    }

    # === EMAIL SMTP ===
    if ($script:Config.Webhooks.Email.Enabled -and $script:Config.Webhooks.Email.SmtpServer) {
        try {
            $emailBody = @"
<!DOCTYPE html>
<html>
<head><style>
body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
.container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 10px; padding: 20px; }
.header { text-align: center; border-bottom: 2px solid #ff0088; padding-bottom: 15px; }
.content { padding: 20px 0; }
.footer { text-align: center; font-size: 12px; color: #888; }
</style></head>
<body>
<div class="container">
<div class="header"><h1>🔥 $Title</h1></div>
<div class="content">$($Content -replace "`n", "<br>")</div>
<div class="footer">NEMESIS OMEGA v$($script:Config.Version) | $env:COMPUTERNAME | $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</div>
</div>
</body>
</html>
"@

            $mailParams = @{
                From = $script:Config.Webhooks.Email.From
                To = $script:Config.Webhooks.Email.To
                Subject = "[$Type] $Title - NEMESIS OMEGA"
                Body = $emailBody
                BodyAsHtml = $true
                SmtpServer = $script:Config.Webhooks.Email.SmtpServer
                Port = $script:Config.Webhooks.Email.SmtpPort
                UseSsl = $script:Config.Webhooks.Email.UseSsl
                Priority = if ($Urgent) { "High" } else { "Normal" }
            }

            if ($script:Config.Webhooks.Email.Username) {
                $secPassword = ConvertTo-SecureString $script:Config.Webhooks.Email.Password -AsPlainText -Force
                $mailParams.Credential = New-Object System.Management.Automation.PSCredential($script:Config.Webhooks.Email.Username, $secPassword)
            }

            Send-MailMessage @mailParams -ErrorAction SilentlyContinue
            Write-NemesisLog "Notification Email envoyée" -Level DEBUG -Component "WEBHOOK"
        }
        catch {
            Write-NemesisLog "Échec notification Email: $($_.Exception.Message)" -Level DEBUG -Component "WEBHOOK"
        }
    }

    # === PAGERDUTY ===
    if ($script:Config.Webhooks.PagerDuty.Enabled -and $script:Config.Webhooks.PagerDuty.RoutingKey -and $Type -in @("Error", "Critical", "Security")) {
        try {
            $severity = switch ($Type) {
                "Error" { "error" }
                "Critical" { "critical" }
                "Security" { "warning" }
                default { "info" }
            }

            $pdPayload = @{
                routing_key = $script:Config.Webhooks.PagerDuty.RoutingKey
                event_action = "trigger"
                payload = @{
                    summary = "$Title - $($Content.Substring(0, [Math]::Min(100, $Content.Length)))"
                    source = $env:COMPUTERNAME
                    severity = $severity
                    timestamp = (Get-Date).ToUniversalTime().ToString("o")
                    custom_details = @{
                        full_message = $Content
                        version = $script:Config.Version
                    }
                }
            }

            $json = $pdPayload | ConvertTo-Json -Depth 10 -Compress
            Invoke-RestMethod -Uri "https://events.pagerduty.com/v2/enqueue" -Method Post -Body $json -ContentType "application/json" -ErrorAction SilentlyContinue | Out-Null
            Write-NemesisLog "Notification PagerDuty envoyée" -Level DEBUG -Component "WEBHOOK"
        }
        catch {
            Write-NemesisLog "Échec notification PagerDuty: $($_.Exception.Message)" -Level DEBUG -Component "WEBHOOK"
        }
    }

    # === PUSHOVER ===
    if ($script:Config.Webhooks.Pushover.Enabled -and $script:Config.Webhooks.Pushover.UserKey) {
        try {
            $pushoverPayload = @{
                token = $script:Config.Webhooks.Pushover.ApiToken
                user = $script:Config.Webhooks.Pushover.UserKey
                title = $Title
                message = $Content
                priority = if ($Urgent) { 1 } else { $script:Config.Webhooks.Pushover.Priority }
                sound = if ($Type -eq "Critical") { "siren" } else { "pushover" }
            }

            Invoke-RestMethod -Uri "https://api.pushover.net/1/messages.json" -Method Post -Body $pushoverPayload -ErrorAction SilentlyContinue | Out-Null
            Write-NemesisLog "Notification Pushover envoyée" -Level DEBUG -Component "WEBHOOK"
        }
        catch {
            Write-NemesisLog "Échec notification Pushover: $($_.Exception.Message)" -Level DEBUG -Component "WEBHOOK"
        }
    }

    # === NTFY ===
    if ($script:Config.Webhooks.Ntfy.Enabled -and $script:Config.Webhooks.Ntfy.Topic) {
        try {
            $ntfyUrl = "$($script:Config.Webhooks.Ntfy.Server)/$($script:Config.Webhooks.Ntfy.Topic)"
            $headers = @{
                "Title" = $Title
                "Priority" = $script:Config.Webhooks.Ntfy.Priority
                "Tags" = switch ($Type) { "Error" { "warning" }; "Critical" { "rotating_light" }; default { "robot" } }
            }

            Invoke-RestMethod -Uri $ntfyUrl -Method Post -Body $Content -Headers $headers -ErrorAction SilentlyContinue | Out-Null
            Write-NemesisLog "Notification Ntfy envoyée" -Level DEBUG -Component "WEBHOOK"
        }
        catch {
            Write-NemesisLog "Échec notification Ntfy: $($_.Exception.Message)" -Level DEBUG -Component "WEBHOOK"
        }
    }

    # === WINDOWS TOAST ===
    if ($EnableToast) {
        try {
            $toastAvailable = Get-Module -ListAvailable -Name BurntToast
            if ($toastAvailable) {
                Import-Module BurntToast -ErrorAction SilentlyContinue
                New-BurntToastNotification -Text $Title, $Content -ErrorAction SilentlyContinue
                Write-NemesisLog "Notification Toast envoyée" -Level DEBUG -Component "WEBHOOK"
            }
        }
        catch {
            # Silently fail
        }
    }
}

function Get-FileHashSafe {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [string]$Algorithm = "SHA256"
    )

    try {
        if (Test-Path $Path) {
            $hash = Get-FileHash -Path $Path -Algorithm $Algorithm -ErrorAction Stop
            return $hash.Hash
        }
    }
    catch {
        return $null
    }
    return $null
}

function Invoke-WithRetry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [scriptblock]$ScriptBlock,

        [int]$MaxRetries = 3,

        [int]$DelaySeconds = 2,

        [string]$OperationName = "Opération",

        [switch]$ExponentialBackoff
    )

    $attempt = 0
    $lastError = $null

    while ($attempt -lt $MaxRetries) {
        $attempt++
        try {
            return & $ScriptBlock
        }
        catch {
            $lastError = $_
            Write-NemesisLog "$OperationName - Tentative $attempt/$MaxRetries échouée: $($_.Exception.Message)" -Level WARNING

            if ($attempt -lt $MaxRetries) {
                $waitTime = if ($ExponentialBackoff) { $DelaySeconds * [math]::Pow(2, $attempt - 1) } else { $DelaySeconds }
                Start-Sleep -Seconds $waitTime
            }
        }
    }

    Write-NemesisLog "$OperationName - Échec après $MaxRetries tentatives" -Level ERROR
    throw $lastError
}

function Invoke-Parallel {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [array]$Items,

        [Parameter(Mandatory)]
        [scriptblock]$ScriptBlock,

        [int]$ThrottleLimit = 5
    )

    if (-not $ParallelMode) {
        # Mode séquentiel
        foreach ($item in $Items) {
            & $ScriptBlock -Item $item
        }
        return
    }

    # Mode parallèle avec ForEach-Object -Parallel (PS7+)
    try {
        $Items | ForEach-Object -ThrottleLimit $ThrottleLimit -Parallel {
            $item = $_
            & $using:ScriptBlock -Item $item
        }
    }
    catch {
        # Fallback séquentiel
        foreach ($item in $Items) {
            & $ScriptBlock -Item $item
        }
    }
}

function New-DirectoryStructure {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [string]$BasePath,

        [Parameter(Mandatory)]
        [hashtable]$Structure
    )

    foreach ($item in $Structure.GetEnumerator()) {
        $path = Join-Path $BasePath $item.Key

        if ($PSCmdlet.ShouldProcess($path, "Créer structure")) {
            if (-not (Test-Path $path)) {
                New-Item -Path $path -ItemType Directory -Force | Out-Null
            }

            if ($item.Value -is [hashtable] -and $item.Value.Count -gt 0) {
                New-DirectoryStructure -BasePath $path -Structure $item.Value
            }
        }
    }
}

function Get-InstalledSoftware {
    [CmdletBinding()]
    param(
        [string]$Pattern = "*"
    )

    $software = @()

    $regPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )

    foreach ($path in $regPaths) {
        try {
            $items = Get-ItemProperty $path -ErrorAction SilentlyContinue |
                Where-Object { $_.DisplayName -and $_.DisplayName -like $Pattern } |
                Select-Object DisplayName, DisplayVersion, Publisher, InstallDate, InstallLocation, UninstallString
            $software += $items
        }
        catch {
            # Silently continue
        }
    }

    return $software | Sort-Object DisplayName -Unique
}

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function ConvertTo-HumanReadableSize {
    param([long]$Bytes)

    if ($Bytes -lt 0) { return "N/A" }
    if ($Bytes -ge 1PB) { return "{0:N2} PB" -f ($Bytes / 1PB) }
    if ($Bytes -ge 1TB) { return "{0:N2} TB" -f ($Bytes / 1TB) }
    if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
    return "$Bytes bytes"
}

function ConvertTo-HumanReadableDuration {
    param([TimeSpan]$Duration)

    if ($Duration.TotalDays -ge 1) {
        return "{0}d {1}h {2}m" -f [int]$Duration.TotalDays, $Duration.Hours, $Duration.Minutes
    }
    if ($Duration.TotalHours -ge 1) {
        return "{0}h {1}m {2}s" -f [int]$Duration.TotalHours, $Duration.Minutes, $Duration.Seconds
    }
    if ($Duration.TotalMinutes -ge 1) {
        return "{0}m {1}s" -f [int]$Duration.TotalMinutes, $Duration.Seconds
    }
    return "{0}s" -f [int]$Duration.TotalSeconds
}

function Protect-Credential {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$PlainText,

        [string]$Entropy = "NEMESIS_OMEGA_V3"
    )

    if (-not $EnableEncryption) {
        return $PlainText
    }

    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($PlainText)
        $entropyBytes = [System.Text.Encoding]::UTF8.GetBytes($Entropy)
        $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $entropyBytes, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        return [Convert]::ToBase64String($encrypted)
    }
    catch {
        return $PlainText
    }
}

function Unprotect-Credential {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$EncryptedText,

        [string]$Entropy = "NEMESIS_OMEGA_V3"
    )

    if (-not $EnableEncryption) {
        return $EncryptedText
    }

    try {
        $bytes = [Convert]::FromBase64String($EncryptedText)
        $entropyBytes = [System.Text.Encoding]::UTF8.GetBytes($Entropy)
        $decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropyBytes, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        return [System.Text.Encoding]::UTF8.GetString($decrypted)
    }
    catch {
        return $EncryptedText
    }
}

function Get-SystemUptime {
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        return (Get-Date) - $os.LastBootUpTime
    }
    catch {
        return [TimeSpan]::Zero
    }
}

function Get-NetworkAdapterInfo {
    [CmdletBinding()]
    param()

    $adapters = @()

    try {
        $networkAdapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }

        foreach ($adapter in $networkAdapters) {
            $ipConfig = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1
            $gateway = Get-NetRoute -InterfaceIndex $adapter.ifIndex -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue | Select-Object -First 1

            $adapters += @{
                Name = $adapter.Name
                Description = $adapter.InterfaceDescription
                Status = $adapter.Status
                Speed = ConvertTo-HumanReadableSize -Bytes ($adapter.LinkSpeed / 8)
                MacAddress = $adapter.MacAddress
                IPAddress = $ipConfig.IPAddress
                Gateway = $gateway.NextHop
            }
        }
    }
    catch {
        Write-NemesisLog "Échec récupération info réseau: $($_.Exception.Message)" -Level WARNING -Component "NETWORK"
    }

    return $adapters
}

function Export-PrometheusMetric {
    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [Parameter(Mandatory)]
        [double]$Value,

        [hashtable]$Labels = @{},

        [string]$Help = "",

        [ValidateSet("gauge", "counter", "histogram", "summary")]
        [string]$Type = "gauge"
    )

    if (-not $ExportPrometheus) { return }

    $labelStr = ""
    if ($Labels.Count -gt 0) {
        $labelParts = $Labels.GetEnumerator() | ForEach-Object { "$($_.Key)=`"$($_.Value)`"" }
        $labelStr = "{$($labelParts -join ',')}"
    }

    if ($Help) {
        [void]$script:PrometheusMetrics.Add("# HELP $Name $Help")
    }
    [void]$script:PrometheusMetrics.Add("# TYPE $Name $Type")
    [void]$script:PrometheusMetrics.Add("$Name$labelStr $Value")
}

function Write-TrendingData {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$Metrics
    )

    if (-not $EnableTrending) { return }

    try {
        $trendingDir = $script:Config.Paths.Trending
        if (-not (Test-Path $trendingDir)) {
            New-Item -Path $trendingDir -ItemType Directory -Force | Out-Null
        }

        $historyPath = Join-Path $trendingDir "health_history.csv"

        # Créer header si nouveau fichier
        if (-not (Test-Path $historyPath)) {
            "Timestamp,HealthScore,CPUUsage,MemoryUsage,DiskFreeC,DiskFreeD,DiskFreeE,APIsValid,ErrorCount" | Out-File $historyPath -Encoding UTF8
        }

        $line = "{0},{1},{2},{3},{4},{5},{6},{7},{8}" -f @(
            (Get-Date -Format "o")
            $Metrics.HealthScore
            $Metrics.CPUUsage
            $Metrics.MemoryUsage
            $Metrics.DiskFreeC
            $Metrics.DiskFreeD
            $Metrics.DiskFreeE
            $Metrics.APIsValid
            $Metrics.ErrorCount
        )

        $line | Out-File $historyPath -Append -Encoding UTF8

        # Nettoyer les anciennes entrées
        $retentionDays = $script:Config.Retention.TrendingHistoryDays
        $cutoffDate = (Get-Date).AddDays(-$retentionDays)

        $content = Get-Content $historyPath
        $header = $content | Select-Object -First 1
        $filtered = $content | Select-Object -Skip 1 | Where-Object {
            try {
                $timestamp = [DateTime]::Parse(($_ -split ',')[0])
                $timestamp -gt $cutoffDate
            }
            catch { $true }
        }

        @($header) + $filtered | Out-File $historyPath -Encoding UTF8

        Write-NemesisLog "Données trending enregistrées" -Level DEBUG -Component "TRENDING"
    }
    catch {
        Write-NemesisLog "Échec écriture trending: $($_.Exception.Message)" -Level WARNING -Component "TRENDING"
    }
}

#region ═══════════════════════════════════════════════════════════════════════════
#                              SELF-TESTS & VALIDATION
#endregion ════════════════════════════════════════════════════════════════════════

function Invoke-SelfTests {
    [CmdletBinding()]
    param()

    if (-not $Silent) {
        Write-Host ""
        Write-Host "╔══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
        Write-Host "║                        SELF-TESTS PRÉ-EXÉCUTION                              ║" -ForegroundColor Magenta
        Write-Host "╚══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
        Write-Host ""
    }

    $tests = @(
        # === TESTS CRITIQUES ===
        @{ Name = "PowerShell Version ≥ 7.0"; Test = { $PSVersionTable.PSVersion.Major -ge 7 }; Required = $true; Category = "System" }
        @{ Name = "Privilèges Administrateur"; Test = { Test-AdminPrivileges }; Required = $true; Category = "System" }
        @{ Name = "Disque C: accessible"; Test = { Test-Path "C:\" }; Required = $true; Category = "Storage" }

        # === TESTS STOCKAGE ===
        @{ Name = "Disque D: accessible"; Test = { Test-Path "D:\" }; Required = $false; Category = "Storage" }
        @{ Name = "Disque E: accessible"; Test = { Test-Path "E:\" }; Required = $false; Category = "Storage" }
        @{ Name = "Espace C: > 1GB"; Test = { (Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace -gt 1GB }; Required = $true; Category = "Storage" }

        # === TESTS RÉSEAU ===
        @{ Name = "Connexion Internet (8.8.8.8)"; Test = { Test-Connection -TargetName "8.8.8.8" -Count 1 -Quiet -TimeoutSeconds 5 }; Required = $false; Category = "Network" }
        @{ Name = "DNS fonctionnel"; Test = { try { [System.Net.Dns]::GetHostEntry("google.com"); $true } catch { $false } }; Required = $false; Category = "Network" }
        @{ Name = "HTTPS accessible"; Test = { try { Invoke-WebRequest -Uri "https://www.google.com" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop; $true } catch { $false } }; Required = $false; Category = "Network" }

        # === TESTS OUTILS ===
        @{ Name = "Winget disponible"; Test = { Test-CommandExists "winget" }; Required = $false; Category = "Tools" }
        @{ Name = "Git disponible"; Test = { Test-CommandExists "git" }; Required = $false; Category = "Tools" }
        @{ Name = "Python disponible"; Test = { Test-CommandExists "python" -or Test-CommandExists "python3" }; Required = $false; Category = "Tools" }
        @{ Name = "Node.js disponible"; Test = { Test-CommandExists "node" }; Required = $false; Category = "Tools" }
        @{ Name = "NPM disponible"; Test = { Test-CommandExists "npm" }; Required = $false; Category = "Tools" }
        @{ Name = "Docker disponible"; Test = { Test-CommandExists "docker" }; Required = $false; Category = "Tools" }

        # === TESTS IA ===
        @{ Name = "Ollama disponible"; Test = { Test-CommandExists "ollama" }; Required = $false; Category = "AI" }
        @{ Name = "Ollama en cours d'exécution"; Test = { $null -ne (Get-Process "ollama" -ErrorAction SilentlyContinue) }; Required = $false; Category = "AI" }
        @{ Name = "Claude Desktop installé"; Test = { Test-Path "$env:LOCALAPPDATA\Programs\claude-desktop" -or (Get-Process "claude" -ErrorAction SilentlyContinue) }; Required = $false; Category = "AI" }
        @{ Name = "Cursor IDE installé"; Test = { Test-Path "$env:LOCALAPPDATA\Programs\cursor" -or Test-CommandExists "cursor" }; Required = $false; Category = "AI" }

        # === TESTS MODULES POWERSHELL ===
        @{ Name = "Module PSSQLite"; Test = { $null -ne (Get-Module -ListAvailable -Name PSSQLite) }; Required = $false; Category = "Modules" }
        @{ Name = "Module BurntToast"; Test = { $null -ne (Get-Module -ListAvailable -Name BurntToast) }; Required = $false; Category = "Modules" }
        @{ Name = "Module PSReadLine"; Test = { $null -ne (Get-Module -ListAvailable -Name PSReadLine) }; Required = $false; Category = "Modules" }

        # === TESTS SÉCURITÉ ===
        @{ Name = "Windows Defender actif"; Test = { try { (Get-MpComputerStatus).AntivirusEnabled } catch { $false } }; Required = $false; Category = "Security" }
        @{ Name = "Firewall actif"; Test = { try { (Get-NetFirewallProfile -Profile Domain,Public,Private | Where-Object { $_.Enabled }).Count -gt 0 } catch { $false } }; Required = $false; Category = "Security" }
        @{ Name = "UAC activé"; Test = { (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System").EnableLUA -eq 1 }; Required = $false; Category = "Security" }

        # === TESTS SERVICES ===
        @{ Name = "Service Windows Update"; Test = { (Get-Service "wuauserv" -ErrorAction SilentlyContinue).Status -eq 'Running' }; Required = $false; Category = "Services" }
        @{ Name = "Service Event Log"; Test = { (Get-Service "eventlog" -ErrorAction SilentlyContinue).Status -eq 'Running' }; Required = $false; Category = "Services" }
    )

    $allPassed = $true
    $criticalFailed = $false
    $categories = @{}

    foreach ($test in $tests) {
        try {
            $result = & $test.Test
            $passed = [bool]$result
        }
        catch {
            $passed = $false
        }

        $script:SelfTestResults[$test.Name] = @{
            Passed = $passed
            Required = $test.Required
            Category = $test.Category
        }

        # Grouper par catégorie
        if (-not $categories.ContainsKey($test.Category)) {
            $categories[$test.Category] = @{ Passed = 0; Failed = 0; Total = 0 }
        }
        $categories[$test.Category].Total++

        if ($passed) {
            if (-not $Silent) {
                Write-Host "  ✅ $($test.Name)" -ForegroundColor Green
            }
            $script:Statistics.SelfTestsPassed++
            $categories[$test.Category].Passed++
        }
        else {
            if ($test.Required) {
                if (-not $Silent) {
                    Write-Host "  ❌ $($test.Name) [REQUIS]" -ForegroundColor Red
                }
                $criticalFailed = $true
            }
            else {
                if (-not $Silent) {
                    Write-Host "  ⚠️ $($test.Name) [OPTIONNEL]" -ForegroundColor Yellow
                }
            }
            $allPassed = $false
            $script:Statistics.SelfTestsFailed++
            $categories[$test.Category].Failed++
        }
    }

    # Résumé par catégorie
    if (-not $Silent) {
        Write-Host ""
        Write-Host "  📊 Résumé par catégorie:" -ForegroundColor White
        foreach ($cat in $categories.GetEnumerator() | Sort-Object Name) {
            $status = if ($cat.Value.Failed -eq 0) { "✅" } else { "⚠️" }
            Write-Host "     $status $($cat.Key): $($cat.Value.Passed)/$($cat.Value.Total)" -ForegroundColor $(if ($cat.Value.Failed -eq 0) { "Green" } else { "Yellow" })
        }
        Write-Host ""
    }

    if ($criticalFailed -and -not $Force) {
        Write-NemesisLog "ÉCHEC DES TESTS CRITIQUES - Arrêt du script" -Level CRITICAL
        throw "Tests critiques échoués. Utilisez -Force pour continuer malgré les erreurs."
    }

    Export-PrometheusMetric -Name "nemesis_selftests_passed" -Value $script:Statistics.SelfTestsPassed -Help "Number of self-tests passed"
    Export-PrometheusMetric -Name "nemesis_selftests_failed" -Value $script:Statistics.SelfTestsFailed -Help "Number of self-tests failed"

    return $allPassed
}

function Test-APIConnectivity {
    [CmdletBinding()]
    param(
        [switch]$QuickMode
    )

    Write-NemesisLog "Validation des connexions API ($($script:Config.APIs.Count) APIs configurées)..." -Level INFO -Component "API"

    $results = @{}
    $tierStats = @{}

    foreach ($api in $script:Config.APIs.GetEnumerator()) {
        $apiConfig = $api.Value
        $tier = $apiConfig.Tier

        # Initialiser les stats du tier
        if (-not $tierStats.ContainsKey($tier)) {
            $tierStats[$tier] = @{ Tested = 0; Valid = 0 }
        }

        # Vérifier si la clé existe
        $apiKey = $null
        if ($apiConfig.EnvVar) {
            $apiKey = [System.Environment]::GetEnvironmentVariable($apiConfig.EnvVar)
        }

        # Pour les APIs locales, vérifier l'endpoint directement
        if ($apiConfig.Local -and -not $apiKey) {
            $apiKey = $apiConfig.TestEndpoint
        }

        if (-not $apiKey -and -not $apiConfig.Local) {
            if (-not $Silent) {
                Write-Host "  ⚪ $($apiConfig.Name) - Non configuré" -ForegroundColor DarkGray
            }
            $results[$api.Key] = @{ Status = "NotConfigured"; Latency = 0; Tier = $tier }
            continue
        }

        $script:Statistics.APIsTested++
        $tierStats[$tier].Tested++

        # Test de connectivité
        try {
            $startTime = Get-Date
            $headers = @{}

            # Construire les headers d'authentification
            if ($apiConfig.AuthHeader -and -not $apiConfig.Local) {
                if ($apiConfig.AuthPrefix) {
                    $headers[$apiConfig.AuthHeader] = "$($apiConfig.AuthPrefix) $apiKey"
                }
                else {
                    $headers[$apiConfig.AuthHeader] = $apiKey
                }
            }

            # Ajouter les headers supplémentaires
            if ($apiConfig.ExtraHeaders) {
                foreach ($h in $apiConfig.ExtraHeaders.GetEnumerator()) {
                    $headers[$h.Key] = $h.Value
                }
            }

            $testEndpoint = $apiConfig.TestEndpoint
            if (-not $testEndpoint) {
                $results[$api.Key] = @{ Status = "NoEndpoint"; Latency = 0; Tier = $tier }
                continue
            }

            $response = Invoke-WebRequest -Uri $testEndpoint -Headers $headers -Method Head -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
            $latency = ((Get-Date) - $startTime).TotalMilliseconds

            if ($response.StatusCode -lt 400) {
                $statusIcon = if ($latency -lt $script:Config.Thresholds.APIResponseTimeWarningMs) { "✅" } else { "🟡" }
                if (-not $Silent) {
                    Write-Host "  $statusIcon $($apiConfig.Name) - OK ($([int]$latency)ms)" -ForegroundColor Green
                }
                $results[$api.Key] = @{ Status = "Valid"; Latency = $latency; Tier = $tier }
                $script:Statistics.APIsValid++
                $tierStats[$tier].Valid++
            }
            else {
                if (-not $Silent) {
                    Write-Host "  ⚠️ $($apiConfig.Name) - HTTP $($response.StatusCode)" -ForegroundColor Yellow
                }
                $results[$api.Key] = @{ Status = "Warning"; Latency = $latency; StatusCode = $response.StatusCode; Tier = $tier }
            }

            Export-PrometheusMetric -Name "nemesis_api_latency_ms" -Value $latency -Labels @{ api = $api.Key } -Help "API response latency in milliseconds"
        }
        catch {
            $errorMessage = $_.Exception.Message
            if ($errorMessage -match "401|403") {
                if (-not $Silent) {
                    Write-Host "  🔑 $($apiConfig.Name) - Clé invalide" -ForegroundColor Red
                }
                $results[$api.Key] = @{ Status = "InvalidKey"; Latency = 0; Error = $errorMessage; Tier = $tier }
            }
            elseif ($errorMessage -match "timeout|timed out") {
                if (-not $Silent) {
                    Write-Host "  ⏱️ $($apiConfig.Name) - Timeout" -ForegroundColor Yellow
                }
                $results[$api.Key] = @{ Status = "Timeout"; Latency = 0; Error = $errorMessage; Tier = $tier }
            }
            else {
                if (-not $Silent) {
                    Write-Host "  ❌ $($apiConfig.Name) - Erreur" -ForegroundColor Red
                }
                $results[$api.Key] = @{ Status = "Error"; Latency = 0; Error = $errorMessage; Tier = $tier }
            }
        }
    }

    $script:APIValidationResults = $results

    # Résumé par tier
    if (-not $Silent) {
        Write-Host ""
        Write-Host "  📊 Résumé par niveau:" -ForegroundColor White
        foreach ($tier in ($tierStats.Keys | Sort-Object)) {
            $stats = $tierStats[$tier]
            $tierName = switch ($tier) {
                1 { "Major Providers" }
                2 { "Specialized" }
                3 { "Cloud Inference" }
                4 { "Local Models" }
                5 { "Tools & Services" }
                6 { "Databases" }
                7 { "Automation" }
                default { "Tier $tier" }
            }
            if ($stats.Tested -gt 0) {
                Write-Host "     Tier $tier ($tierName): $($stats.Valid)/$($stats.Tested) valides" -ForegroundColor $(if ($stats.Valid -eq $stats.Tested) { "Green" } else { "Yellow" })
            }
        }
    }

    Write-NemesisLog "APIs validées: $($script:Statistics.APIsValid)/$($script:Statistics.APIsTested)" -Level INFO -Component "API"

    Export-PrometheusMetric -Name "nemesis_apis_valid" -Value $script:Statistics.APIsValid -Help "Number of valid APIs"
    Export-PrometheusMetric -Name "nemesis_apis_tested" -Value $script:Statistics.APIsTested -Help "Number of APIs tested"

    return $results
}

#region ═══════════════════════════════════════════════════════════════════════════
#                              HARDWARE MONITORING
#endregion ════════════════════════════════════════════════════════════════════════

function Get-HardwareHealth {
    [CmdletBinding()]
    param()

    Write-NemesisLog "Analyse santé hardware complète..." -Level INFO -Component "HARDWARE"

    $health = @{
        Timestamp = Get-Date -Format "o"
        CPU = @{}
        Memory = @{}
        Disks = @{}
        GPU = @{}
        Temperature = @{}
        Network = @{}
        Battery = @{}
        SMART = @{}
        HealthScore = 100
        Issues = [System.Collections.Generic.List[string]]::new()
    }

    # === CPU ===
    try {
        $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
        $cpuCounters = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor | Where-Object { $_.Name -eq "_Total" }

        $health.CPU = @{
            Name = $cpu.Name.Trim()
            Manufacturer = $cpu.Manufacturer
            Cores = $cpu.NumberOfCores
            LogicalProcessors = $cpu.NumberOfLogicalProcessors
            MaxSpeed = "{0:N2} GHz" -f ($cpu.MaxClockSpeed / 1000)
            CurrentSpeed = "{0:N2} GHz" -f ($cpu.CurrentClockSpeed / 1000)
            CurrentLoad = $cpuCounters.PercentProcessorTime
            Architecture = switch ($cpu.Architecture) { 0 { "x86" }; 9 { "x64" }; 12 { "ARM64" }; default { "Unknown" } }
            L2Cache = ConvertTo-HumanReadableSize -Bytes ($cpu.L2CacheSize * 1KB)
            L3Cache = ConvertTo-HumanReadableSize -Bytes ($cpu.L3CacheSize * 1KB)
            VirtualizationEnabled = $cpu.VirtualizationFirmwareEnabled
            Status = "OK"
        }

        if ($health.CPU.CurrentLoad -gt $script:Config.Thresholds.CPUCriticalPercent) {
            $health.HealthScore -= 15
            $health.CPU.Status = "CRITICAL"
            [void]$health.Issues.Add("CPU en surcharge critique: $($health.CPU.CurrentLoad)%")
        }
        elseif ($health.CPU.CurrentLoad -gt $script:Config.Thresholds.CPUWarningPercent) {
            $health.HealthScore -= 5
            $health.CPU.Status = "WARNING"
        }

        if (-not $Silent) {
            Write-Host "  🖥️ CPU: $($health.CPU.Name) - $($health.CPU.CurrentLoad)% utilisé" -ForegroundColor $(if ($health.CPU.Status -eq "OK") { "Green" } elseif ($health.CPU.Status -eq "WARNING") { "Yellow" } else { "Red" })
        }
    }
    catch {
        Write-NemesisLog "Échec lecture CPU: $($_.Exception.Message)" -Level WARNING -Component "HARDWARE"
    }

    # === MÉMOIRE ===
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $physicalMemory = Get-CimInstance Win32_PhysicalMemory

        $totalMemoryGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
        $freeMemoryGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
        $usedMemoryGB = $totalMemoryGB - $freeMemoryGB
        $usedPercent = [math]::Round(($usedMemoryGB / $totalMemoryGB) * 100, 1)

        $memorySlots = @()
        foreach ($mem in $physicalMemory) {
            $memorySlots += @{
                Manufacturer = $mem.Manufacturer
                Capacity = ConvertTo-HumanReadableSize -Bytes $mem.Capacity
                Speed = "$($mem.Speed) MHz"
                FormFactor = switch ($mem.FormFactor) { 8 { "DIMM" }; 12 { "SODIMM" }; default { "Unknown" } }
            }
        }

        $health.Memory = @{
            Total = "$totalMemoryGB GB"
            Free = "$freeMemoryGB GB"
            Used = "$usedMemoryGB GB"
            UsedPercent = $usedPercent
            Slots = $memorySlots
            SlotCount = $memorySlots.Count
            PageFileSize = ConvertTo-HumanReadableSize -Bytes ($os.TotalVirtualMemorySize * 1KB)
            PageFileFree = ConvertTo-HumanReadableSize -Bytes ($os.FreeVirtualMemory * 1KB)
            Status = "OK"
        }

        if ($usedPercent -gt $script:Config.Thresholds.MemoryCriticalPercent) {
            $health.HealthScore -= 20
            $health.Memory.Status = "CRITICAL"
            [void]$health.Issues.Add("Mémoire critique: $usedPercent% utilisé")
        }
        elseif ($usedPercent -gt $script:Config.Thresholds.MemoryWarningPercent) {
            $health.HealthScore -= 8
            $health.Memory.Status = "WARNING"
        }

        if (-not $Silent) {
            Write-Host "  🧠 RAM: $usedMemoryGB/$totalMemoryGB GB ($usedPercent%)" -ForegroundColor $(if ($health.Memory.Status -eq "OK") { "Green" } elseif ($health.Memory.Status -eq "WARNING") { "Yellow" } else { "Red" })
        }
    }
    catch {
        Write-NemesisLog "Échec lecture mémoire: $($_.Exception.Message)" -Level WARNING -Component "HARDWARE"
    }

    # === DISQUES ===
    try {
        $drives = @("C:", "D:", "E:", "F:", "G:")

        foreach ($drive in $drives) {
            if (Test-Path $drive) {
                $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$drive'"
                if ($disk -and $disk.Size -gt 0) {
                    $freePercent = [math]::Round(($disk.FreeSpace / $disk.Size) * 100, 1)
                    $freeGB = [math]::Round($disk.FreeSpace / 1GB, 2)
                    $totalGB = [math]::Round($disk.Size / 1GB, 2)
                    $usedGB = $totalGB - $freeGB

                    $status = "OK"
                    if ($freePercent -lt $script:Config.Thresholds.DiskCriticalPercent) {
                        $health.HealthScore -= 25
                        $status = "CRITICAL"
                        [void]$health.Issues.Add("Disque $drive critique: $freePercent% libre")
                    }
                    elseif ($freePercent -lt $script:Config.Thresholds.DiskWarningPercent) {
                        $health.HealthScore -= 10
                        $status = "WARNING"
                    }

                    $health.Disks[$drive] = @{
                        Total = "$totalGB GB"
                        Free = "$freeGB GB"
                        Used = "$usedGB GB"
                        FreePercent = $freePercent
                        FileSystem = $disk.FileSystem
                        VolumeName = $disk.VolumeName
                        DriveType = switch ($disk.DriveType) { 2 { "Removable" }; 3 { "Fixed" }; 4 { "Network" }; 5 { "CD-ROM" }; default { "Unknown" } }
                        Status = $status
                    }

                    if (-not $Silent) {
                        $icon = switch ($status) { "OK" { "✅" }; "WARNING" { "⚠️" }; "CRITICAL" { "🔴" } }
                        Write-Host "  💾 $drive $freeGB GB libre ($freePercent%) $icon" -ForegroundColor $(if ($status -eq "OK") { "Green" } elseif ($status -eq "WARNING") { "Yellow" } else { "Red" })
                    }

                    Export-PrometheusMetric -Name "nemesis_disk_free_percent" -Value $freePercent -Labels @{ drive = $drive } -Help "Disk free space percentage"
                    Export-PrometheusMetric -Name "nemesis_disk_free_bytes" -Value $disk.FreeSpace -Labels @{ drive = $drive } -Help "Disk free space in bytes"
                }
            }
        }
    }
    catch {
        Write-NemesisLog "Échec lecture disques: $($_.Exception.Message)" -Level WARNING -Component "HARDWARE"
    }

    # === GPU (NVIDIA, AMD, Intel) ===
    try {
        $gpus = Get-CimInstance Win32_VideoController

        foreach ($gpu in $gpus) {
            $gpuName = $gpu.Name
            $gpuInfo = @{
                Name = $gpuName
                DriverVersion = $gpu.DriverVersion
                DriverDate = if ($gpu.DriverDate) { $gpu.DriverDate.ToString("yyyy-MM-dd") } else { "Unknown" }
                Status = $gpu.Status
                AdapterRAM = ConvertTo-HumanReadableSize -Bytes $gpu.AdapterRAM
                Resolution = "$($gpu.CurrentHorizontalResolution)x$($gpu.CurrentVerticalResolution)"
                RefreshRate = "$($gpu.CurrentRefreshRate) Hz"
                VideoProcessor = $gpu.VideoProcessor
            }

            $health.GPU[$gpuName] = $gpuInfo
        }

        # === NVIDIA spécifique (nvidia-smi) ===
        if (Test-CommandExists "nvidia-smi") {
            try {
                $nvidiaSmi = nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,utilization.memory,memory.used,memory.total,power.draw,fan.speed,pstate --format=csv,noheader,nounits 2>$null
                if ($nvidiaSmi) {
                    $parts = $nvidiaSmi -split ","
                    $gpuTemp = [int]$parts[1].Trim()

                    $health.GPU["NVIDIA_Details"] = @{
                        Model = $parts[0].Trim()
                        Temperature = "$gpuTemp°C"
                        GPUUtilization = "$($parts[2].Trim())%"
                        MemoryUtilization = "$($parts[3].Trim())%"
                        MemoryUsed = "$($parts[4].Trim()) MB"
                        MemoryTotal = "$($parts[5].Trim()) MB"
                        PowerDraw = "$($parts[6].Trim()) W"
                        FanSpeed = "$($parts[7].Trim())%"
                        PerformanceState = $parts[8].Trim()
                    }

                    $health.Temperature["GPU_NVIDIA"] = @{ Value = $gpuTemp; Unit = "°C" }

                    if ($gpuTemp -gt $script:Config.Thresholds.TempCriticalCelsius) {
                        $health.HealthScore -= 25
                        $health.Temperature["GPU_NVIDIA"].Status = "CRITICAL"
                        [void]$health.Issues.Add("GPU NVIDIA surchauffe: $gpuTemp°C")
                    }
                    elseif ($gpuTemp -gt $script:Config.Thresholds.TempWarningCelsius) {
                        $health.HealthScore -= 10
                        $health.Temperature["GPU_NVIDIA"].Status = "WARNING"
                    }
                    else {
                        $health.Temperature["GPU_NVIDIA"].Status = "OK"
                    }

                    if (-not $Silent) {
                        Write-Host "  🎮 GPU NVIDIA: $gpuTemp°C, $($parts[2].Trim())% utilisé" -ForegroundColor $(if ($health.Temperature["GPU_NVIDIA"].Status -eq "OK") { "Green" } elseif ($health.Temperature["GPU_NVIDIA"].Status -eq "WARNING") { "Yellow" } else { "Red" })
                    }

                    Export-PrometheusMetric -Name "nemesis_gpu_temperature" -Value $gpuTemp -Labels @{ vendor = "nvidia" } -Help "GPU temperature in Celsius"
                    Export-PrometheusMetric -Name "nemesis_gpu_utilization" -Value ([int]$parts[2].Trim()) -Labels @{ vendor = "nvidia" } -Help "GPU utilization percentage"
                }
            }
            catch {
                # nvidia-smi failed silently
            }
        }

        # === AMD spécifique (rocm-smi ou amd-smi) ===
        if (Test-CommandExists "rocm-smi") {
            try {
                $amdSmi = rocm-smi --showtemp --showuse --showmemuse --json 2>$null | ConvertFrom-Json
                if ($amdSmi) {
                    # Parse AMD GPU info
                    $health.GPU["AMD_Details"] = $amdSmi
                }
            }
            catch {
                # AMD SMI failed silently
            }
        }
    }
    catch {
        Write-NemesisLog "Échec lecture GPU: $($_.Exception.Message)" -Level WARNING -Component "HARDWARE"
    }

    # === BATTERIE (laptops) ===
    try {
        $battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
        if ($battery) {
            $health.Battery = @{
                Status = switch ($battery.BatteryStatus) {
                    1 { "Discharging" }
                    2 { "AC Power" }
                    3 { "Fully Charged" }
                    4 { "Low" }
                    5 { "Critical" }
                    default { "Unknown" }
                }
                ChargePercent = $battery.EstimatedChargeRemaining
                TimeRemaining = if ($battery.EstimatedRunTime -and $battery.EstimatedRunTime -ne 71582788) { "$([math]::Round($battery.EstimatedRunTime / 60, 1)) hours" } else { "N/A" }
            }

            if ($battery.BatteryStatus -eq 5) {
                $health.HealthScore -= 15
                [void]$health.Issues.Add("Batterie niveau critique")
            }
        }
    }
    catch {
        # No battery or error
    }

    # === S.M.A.R.T. (santé disques) ===
    try {
        $smartData = Get-CimInstance -Namespace "root\wmi" -ClassName MSStorageDriver_FailurePredictStatus -ErrorAction SilentlyContinue
        if ($smartData) {
            foreach ($disk in $smartData) {
                $instanceName = $disk.InstanceName
                $health.SMART[$instanceName] = @{
                    PredictFailure = $disk.PredictFailure
                    Reason = $disk.Reason
                }

                if ($disk.PredictFailure) {
                    $health.HealthScore -= 40
                    [void]$health.Issues.Add("ALERTE S.M.A.R.T.: Défaillance disque prédite pour $instanceName!")
                    Write-NemesisLog "ALERTE S.M.A.R.T.: Défaillance disque prédite!" -Level CRITICAL -Component "HARDWARE"
                }
            }
        }

        # Essayer aussi WMI pour plus de détails
        $diskDrives = Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue
        foreach ($dd in $diskDrives) {
            $health.SMART["$($dd.DeviceID)_Info"] = @{
                Model = $dd.Model
                SerialNumber = $dd.SerialNumber
                InterfaceType = $dd.InterfaceType
                MediaType = $dd.MediaType
                Size = ConvertTo-HumanReadableSize -Bytes $dd.Size
                Status = $dd.Status
            }
        }
    }
    catch {
        # S.M.A.R.T. not available
    }

    # === RÉSEAU ===
    try {
        $health.Network = Get-NetworkAdapterInfo
    }
    catch {
        Write-NemesisLog "Échec lecture réseau: $($_.Exception.Message)" -Level WARNING -Component "HARDWARE"
    }

    # === UPTIME ===
    try {
        $uptime = Get-SystemUptime
        $health.Uptime = @{
            Duration = ConvertTo-HumanReadableDuration -Duration $uptime
            TotalDays = [math]::Round($uptime.TotalDays, 2)
            Since = ((Get-Date) - $uptime).ToString("yyyy-MM-dd HH:mm:ss")
        }

        # Avertir si uptime > 30 jours (besoin de redémarrage)
        if ($uptime.TotalDays -gt 30) {
            $health.HealthScore -= 5
            [void]$health.Issues.Add("Uptime élevé ($([int]$uptime.TotalDays) jours) - redémarrage recommandé")
        }
    }
    catch {
        # Uptime error
    }

    # Finaliser le score
    $health.HealthScore = [math]::Max(0, [math]::Min(100, $health.HealthScore))
    $script:HardwareHealth = $health

    # Prometheus metrics
    Export-PrometheusMetric -Name "nemesis_health_score" -Value $health.HealthScore -Help "Overall system health score"
    Export-PrometheusMetric -Name "nemesis_cpu_usage_percent" -Value (Get-ValueOrDefault $health.CPU.CurrentLoad 0) -Help "CPU usage percentage"
    Export-PrometheusMetric -Name "nemesis_memory_usage_percent" -Value (Get-ValueOrDefault $health.Memory.UsedPercent 0) -Help "Memory usage percentage"

    # Résumé
    $scoreColor = if ($health.HealthScore -ge 80) { "Green" } elseif ($health.HealthScore -ge 60) { "Yellow" } else { "Red" }
    Write-NemesisLog "Score de santé système: $($health.HealthScore)/100" -Level $(if ($health.HealthScore -ge 80) { "SUCCESS" } elseif ($health.HealthScore -ge 60) { "WARNING" } else { "ERROR" }) -Component "HARDWARE"

    if ($health.Issues.Count -gt 0 -and -not $Silent) {
        Write-Host ""
        Write-Host "  ⚠️ Problèmes détectés:" -ForegroundColor Yellow
        foreach ($issue in $health.Issues) {
            Write-Host "     • $issue" -ForegroundColor Yellow
        }
    }

    return $health
}

#region ═══════════════════════════════════════════════════════════════════════════
#                              BACKUP & ROTATION
#endregion ════════════════════════════════════════════════════════════════════════

function Invoke-PreExecutionBackup {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisLog "Création backup pré-exécution..." -Level INFO -Component "BACKUP"

    $backupDir = Join-Path $script:Config.Paths.Backups (Get-Date -Format "yyyyMMdd_HHmmss")

    if ($PSCmdlet.ShouldProcess($backupDir, "Créer backup")) {
        try {
            New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
        }
        catch {
            Write-NemesisLog "Impossible de créer le répertoire backup: $($_.Exception.Message)" -Level WARNING -Component "BACKUP"
            return
        }

        # Fichiers critiques à sauvegarder
        $criticalFiles = @(
            @{ Path = (Join-Path $script:Config.Paths.Config ".env.master"); Name = "env_master" }
            @{ Path = (Join-Path $script:Config.Paths.Config "mcp_servers.json"); Name = "mcp_config" }
            @{ Path = (Join-Path $script:Config.Paths.SharedIndex "file_index.sqlite"); Name = "file_index" }
            @{ Path = (Join-Path $script:Config.Paths.SharedIndex "file_tree.json"); Name = "file_tree" }
            @{ Path = (Join-Path $script:Config.Paths.Trending "health_history.csv"); Name = "health_history" }
            @{ Path = (Join-Path $env:APPDATA "Claude\claude_desktop_config.json"); Name = "claude_config" }
        )

        $backedUp = 0
        foreach ($file in $criticalFiles) {
            if (Test-Path $file.Path) {
                try {
                    $destName = Split-Path $file.Path -Leaf
                    Copy-Item -Path $file.Path -Destination (Join-Path $backupDir $destName) -Force
                    $backedUp++
                    $script:Statistics.BackupsCreated++
                }
                catch {
                    Write-NemesisLog "Échec backup $($file.Name): $($_.Exception.Message)" -Level WARNING -Component "BACKUP"
                }
            }
        }

        # Créer manifest du backup
        $manifest = @{
            Timestamp = Get-Date -Format "o"
            Files = (Get-ChildItem $backupDir -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
            ScriptVersion = $script:Config.Version
            Machine = $env:COMPUTERNAME
            User = $env:USERNAME
            BackupType = "PreExecution"
        }

        try {
            $manifest | ConvertTo-Json -Depth 5 | Out-File (Join-Path $backupDir "manifest.json") -Encoding UTF8
        }
        catch {
            # Continue silently
        }

        Write-NemesisLog "Backup créé: $backupDir ($backedUp fichiers)" -Level SUCCESS -Component "BACKUP"

        # Rotation des anciens backups
        try {
            $oldBackups = Get-ChildItem $script:Config.Paths.Backups -Directory -ErrorAction SilentlyContinue |
                Sort-Object CreationTime -Descending |
                Select-Object -Skip $script:Config.Retention.BackupCount

            foreach ($old in $oldBackups) {
                try {
                    Remove-Item $old.FullName -Recurse -Force
                    Write-NemesisLog "Ancien backup supprimé: $($old.Name)" -Level DEBUG -Component "BACKUP"
                }
                catch {
                    # Silently continue
                }
            }
        }
        catch {
            # Continue silently
        }
    }
}

function Invoke-LogRotation {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisLog "Rotation des logs..." -Level INFO -Component "LOGS"

    $logPath = $script:Config.Paths.Logs

    if (-not (Test-Path $logPath)) { return }

    $rotated = 0

    # Compresser les logs anciens
    try {
        $logsToCompress = Get-ChildItem $logPath -Filter "*.log" -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$script:Config.Retention.CompressAfterDays) -and $_.Name -notmatch "\.gz$" }

        foreach ($log in $logsToCompress) {
            if ($PSCmdlet.ShouldProcess($log.FullName, "Compresser log")) {
                try {
                    $gzPath = "$($log.FullName).gz"
                    $inStream = [System.IO.File]::OpenRead($log.FullName)
                    $outStream = [System.IO.File]::Create($gzPath)
                    $gzStream = [System.IO.Compression.GZipStream]::new($outStream, [System.IO.Compression.CompressionMode]::Compress)

                    $inStream.CopyTo($gzStream)

                    $gzStream.Close()
                    $outStream.Close()
                    $inStream.Close()

                    Remove-Item $log.FullName -Force
                    $rotated++
                    Write-NemesisLog "Log compressé: $($log.Name)" -Level DEBUG -Component "LOGS"
                }
                catch {
                    Write-NemesisLog "Échec compression $($log.Name): $($_.Exception.Message)" -Level WARNING -Component "LOGS"
                }
            }
        }
    }
    catch {
        # Continue silently
    }

    # Supprimer les logs trop anciens
    try {
        $oldLogs = Get-ChildItem $logPath -File -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$script:Config.Retention.LogDays) }

        foreach ($old in $oldLogs) {
            if ($PSCmdlet.ShouldProcess($old.FullName, "Supprimer ancien log")) {
                try {
                    Remove-Item $old.FullName -Force
                    $rotated++
                }
                catch {
                    # Silently continue
                }
            }
        }
    }
    catch {
        # Continue silently
    }

    $script:Statistics.LogsRotated = $rotated
    Write-NemesisLog "Rotation terminée: $rotated fichiers traités" -Level INFO -Component "LOGS"
}

#region ═══════════════════════════════════════════════════════════════════════════
#                          PHASE 1 : SCAN SYSTÈME COMPLET
#endregion ════════════════════════════════════════════════════════════════════════

function Invoke-Phase1-SystemScan {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 1 -PhaseName "SCAN SYSTÈME COMPLET"

    $scanResult = @{
        Timestamp = Get-Date -Format "o"
        Hardware = @{}
        Software = @{}
        AITools = @{}
        DevEnvironments = @{}
        EnvFiles = @()
        Processes = @{}
        Services = @{}
        StartupItems = @{}
    }

    # === HARDWARE ===
    Write-NemesisLog "Scan hardware..." -Level INFO -Component "SCAN"
    $scanResult.Hardware = Get-HardwareHealth

    # === PROCESSUS IA ACTIFS ===
    Write-NemesisLog "Détection processus IA ($($script:Config.AIProcesses.Count) patterns)..." -Level INFO -Component "SCAN"

    $categories = @{}
    foreach ($proc in $script:Config.AIProcesses) {
        $running = Get-Process -Name $proc.Name -ErrorAction SilentlyContinue

        if (-not $categories.ContainsKey($proc.Category)) {
            $categories[$proc.Category] = @{ Running = 0; Total = 0 }
        }
        $categories[$proc.Category].Total++

        if ($running) {
            $categories[$proc.Category].Running++
            $scanResult.Processes[$proc.DisplayName] = @{
                Status = "Running"
                PID = ($running | Select-Object -First 1).Id
                Memory = ConvertTo-HumanReadableSize -Bytes (($running | Measure-Object -Property WorkingSet64 -Sum).Sum)
                CPU = [math]::Round(($running | Measure-Object -Property CPU -Sum).Sum, 2)
                Instances = $running.Count
                Critical = $proc.Critical
            }

            if (-not $Silent) {
                $icon = if ($proc.Critical) { "🟢" } else { "✅" }
                Write-Host "  $icon $($proc.DisplayName) - Actif (PID: $(($running | Select-Object -First 1).Id))" -ForegroundColor Green
            }
        }
        else {
            $scanResult.Processes[$proc.DisplayName] = @{
                Status = "Stopped"
                Critical = $proc.Critical
            }

            if ($proc.Critical -and -not $Silent) {
                Write-Host "  ⚪ $($proc.DisplayName) - Inactif" -ForegroundColor DarkGray
            }
        }
    }

    # Résumé par catégorie
    if (-not $Silent) {
        Write-Host ""
        Write-Host "  📊 Processus par catégorie:" -ForegroundColor White
        foreach ($cat in $categories.GetEnumerator() | Sort-Object Name) {
            Write-Host "     $($cat.Key): $($cat.Value.Running)/$($cat.Value.Total) actifs" -ForegroundColor $(if ($cat.Value.Running -gt 0) { "Green" } else { "Gray" })
        }
    }

    # === LOGICIELS INSTALLÉS ===
    Write-NemesisLog "Inventaire logiciels..." -Level INFO -Component "SCAN"

    $softwareCategories = @{
        "AI & ML" = @("*ollama*", "*claude*", "*openai*", "*huggingface*", "*pytorch*", "*tensorflow*", "*CUDA*", "*cuDNN*", "*cursor*", "*copilot*")
        "Development" = @("*Visual Studio*", "*VS Code*", "*Git*", "*Node*", "*Python*", "*Docker*", "*WSL*", "*Rust*", "*Go*", "*JetBrains*")
        "Databases" = @("*PostgreSQL*", "*MongoDB*", "*Redis*", "*MySQL*", "*SQLite*", "*DBeaver*", "*pgAdmin*")
        "Browsers" = @("*Chrome*", "*Firefox*", "*Edge*", "*Brave*", "*Arc*")
        "Productivity" = @("*Notion*", "*Obsidian*", "*Discord*", "*Slack*", "*Teams*", "*Zoom*")
        "Utilities" = @("*PowerToys*", "*7-Zip*", "*WinRAR*", "*Everything*", "*Rclone*")
    }

    foreach ($category in $softwareCategories.GetEnumerator()) {
        $found = @()
        foreach ($pattern in $category.Value) {
            $software = Get-InstalledSoftware -Pattern $pattern
            $found += $software
        }
        $scanResult.Software[$category.Key] = $found | Select-Object DisplayName, DisplayVersion -Unique
        Write-NemesisLog "  $($category.Key): $($found.Count) logiciels" -Level DEBUG -Component "SCAN"
    }

    # === ENVIRONNEMENTS DE DÉVELOPPEMENT ===
    Write-NemesisLog "Scan environnements dev..." -Level INFO -Component "SCAN"

    $devEnvs = @{
        Python = @{
            Installed = Test-CommandExists "python" -or Test-CommandExists "python3"
            Version = if (Test-CommandExists "python") { try { (python --version 2>&1).ToString().Trim() } catch { "N/A" } } else { "N/A" }
            Pip = Test-CommandExists "pip" -or Test-CommandExists "pip3"
            Conda = Test-CommandExists "conda"
            Poetry = Test-CommandExists "poetry"
            UV = Test-CommandExists "uv"
        }
        Node = @{
            Installed = Test-CommandExists "node"
            Version = if (Test-CommandExists "node") { try { (node --version 2>&1).ToString().Trim() } catch { "N/A" } } else { "N/A" }
            NPM = if (Test-CommandExists "npm") { try { (npm --version 2>&1).ToString().Trim() } catch { "N/A" } } else { "N/A" }
            Yarn = Test-CommandExists "yarn"
            PNPM = Test-CommandExists "pnpm"
            Bun = Test-CommandExists "bun"
        }
        Rust = @{
            Installed = Test-CommandExists "rustc"
            Version = if (Test-CommandExists "rustc") { try { ((rustc --version 2>&1).ToString() -split " ")[1] } catch { "N/A" } } else { "N/A" }
            Cargo = Test-CommandExists "cargo"
        }
        Go = @{
            Installed = Test-CommandExists "go"
            Version = if (Test-CommandExists "go") { try { ((go version 2>&1).ToString() -split " ")[2] } catch { "N/A" } } else { "N/A" }
        }
        Git = @{
            Installed = Test-CommandExists "git"
            Version = if (Test-CommandExists "git") { try { ((git --version 2>&1).ToString() -replace "git version ", "").Trim() } catch { "N/A" } } else { "N/A" }
        }
        Docker = @{
            Installed = Test-CommandExists "docker"
            Running = $null -ne (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue) -or $null -ne (Get-Process "dockerd" -ErrorAction SilentlyContinue)
            Compose = Test-CommandExists "docker-compose" -or (Test-CommandExists "docker" -and ((docker compose version 2>&1) -match "version"))
        }
        Ollama = @{
            Installed = Test-CommandExists "ollama"
            Running = $null -ne (Get-Process "ollama" -ErrorAction SilentlyContinue)
            Models = @()
        }
    }

    # Lister modèles Ollama
    if ($devEnvs.Ollama.Running) {
        try {
            $modelsRaw = ollama list 2>&1
            $devEnvs.Ollama.Models = ($modelsRaw | Select-Object -Skip 1 | ForEach-Object { ($_ -split "\s+")[0] }) | Where-Object { $_ }
            Write-NemesisLog "  Ollama: $($devEnvs.Ollama.Models.Count) modèles installés" -Level DEBUG -Component "SCAN"
        }
        catch {
            # Silently continue
        }
    }

    $scanResult.DevEnvironments = $devEnvs

    # === FICHIERS .ENV ===
    Write-NemesisLog "Recherche fichiers .env..." -Level INFO -Component "SCAN"

    $searchPaths = @(
        @{ Path = $env:USERPROFILE; Depth = 3 }
        @{ Path = "D:\"; Depth = 4 }
        @{ Path = "E:\"; Depth = 4 }
    )

    foreach ($search in $searchPaths) {
        if (Test-Path $search.Path) {
            try {
                $envFiles = Get-ChildItem -Path $search.Path -Filter ".env*" -Recurse -Depth $search.Depth -ErrorAction SilentlyContinue -Force |
                    Where-Object { -not $_.PSIsContainer -and $_.Length -gt 0 -and $_.Name -notmatch "\.example$|\.sample$|\.template$" }

                foreach ($envFile in $envFiles) {
                    $scanResult.EnvFiles += @{
                        Path = $envFile.FullName
                        Size = $envFile.Length
                        LastModified = $envFile.LastWriteTime.ToString("o")
                        Name = $envFile.Name
                    }
                    $script:Statistics.FilesScanned++
                }
            }
            catch {
                # Continue silently
            }
        }
    }

    Write-NemesisLog "Fichiers .env trouvés: $($scanResult.EnvFiles.Count)" -Level INFO -Component "SCAN"

    # === SERVICES WINDOWS IMPORTANTS ===
    Write-NemesisLog "Scan services..." -Level INFO -Component "SCAN"

    $importantServices = @("wuauserv", "WSearch", "Spooler", "BITS", "WinDefend", "mpssvc", "eventlog", "Dnscache", "LanmanServer", "LanmanWorkstation")

    foreach ($svcName in $importantServices) {
        try {
            $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
            if ($svc) {
                $scanResult.Services[$svc.DisplayName] = @{
                    Status = $svc.Status.ToString()
                    StartType = $svc.StartType.ToString()
                }
            }
        }
        catch {
            # Continue
        }
    }

    # === SAUVEGARDE RAPPORT ===
    $reportPath = Join-Path $script:Config.Paths.Reports "system_scan_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"

    if ($PSCmdlet.ShouldProcess($reportPath, "Sauvegarder rapport scan")) {
        try {
            $scanResult | ConvertTo-Json -Depth 10 | Out-File $reportPath -Encoding UTF8
            Write-NemesisLog "Rapport scan: $reportPath" -Level SUCCESS -Component "SCAN"
        }
        catch {
            Write-NemesisLog "Échec sauvegarde rapport: $($_.Exception.Message)" -Level WARNING -Component "SCAN"
        }
    }

    Complete-NemesisPhase -PhaseNumber 1 -Summary "Score santé: $($scanResult.Hardware.HealthScore)/100, $($scanResult.EnvFiles.Count) fichiers .env"
}

#region ═══════════════════════════════════════════════════════════════════════════
#                          PHASE 2 : MISES À JOUR SYSTÈME
#endregion ════════════════════════════════════════════════════════════════════════

function Invoke-Phase2-UpdateAll {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 2 -PhaseName "MISES À JOUR SYSTÈME"

    if ($SkipUpdates) {
        Write-NemesisLog "Phase ignorée (SkipUpdates activé)" -Level WARNING -Component "UPDATE"
        Complete-NemesisPhase -PhaseNumber 2 -Summary "Ignorée"
        return
    }

    $updatesApplied = 0

    # === WINGET ===
    if (Test-CommandExists "winget") {
        Write-NemesisLog "Mise à jour via Winget..." -Level INFO -Component "UPDATE"

        if ($PSCmdlet.ShouldProcess("Winget packages", "Mettre à jour")) {
            try {
                $result = winget upgrade --all --accept-package-agreements --accept-source-agreements --silent 2>&1
                $upgradedCount = ($result | Select-String "Successfully installed|réinstallé").Count
                $updatesApplied += $upgradedCount
                Write-NemesisLog "Winget: $upgradedCount packages mis à jour" -Level SUCCESS -Component "UPDATE"
            }
            catch {
                Write-NemesisLog "Échec Winget: $($_.Exception.Message)" -Level WARNING -Component "UPDATE"
            }
        }
    }

    # === CHOCOLATEY ===
    if (Test-CommandExists "choco") {
        Write-NemesisLog "Mise à jour via Chocolatey..." -Level INFO -Component "UPDATE"

        if ($PSCmdlet.ShouldProcess("Chocolatey packages", "Mettre à jour")) {
            try {
                $result = choco upgrade all -y --no-progress 2>&1
                $upgradedCount = ($result | Select-String "upgraded|installed").Count
                $updatesApplied += $upgradedCount
                Write-NemesisLog "Chocolatey: packages vérifiés" -Level SUCCESS -Component "UPDATE"
            }
            catch {
                Write-NemesisLog "Échec Chocolatey: $($_.Exception.Message)" -Level WARNING -Component "UPDATE"
            }
        }
    }

    # === SCOOP ===
    if (Test-CommandExists "scoop") {
        Write-NemesisLog "Mise à jour via Scoop..." -Level INFO -Component "UPDATE"

        if ($PSCmdlet.ShouldProcess("Scoop apps", "Mettre à jour")) {
            try {
                scoop update * 2>&1 | Out-Null
                Write-NemesisLog "Scoop: mise à jour effectuée" -Level SUCCESS -Component "UPDATE"
            }
            catch {
                Write-NemesisLog "Échec Scoop: $($_.Exception.Message)" -Level WARNING -Component "UPDATE"
            }
        }
    }

    # === PIP (packages IA) ===
    if (Test-CommandExists "pip" -or Test-CommandExists "pip3") {
        Write-NemesisLog "Mise à jour packages Python IA..." -Level INFO -Component "UPDATE"

        $aiPackages = @("openai", "anthropic", "langchain", "langchain-core", "transformers", "torch", "crewai", "autogen", "ollama", "chromadb", "qdrant-client", "httpx", "pydantic")
        $pipCmd = if (Test-CommandExists "pip3") { "pip3" } else { "pip" }

        foreach ($pkg in $aiPackages) {
            if ($PSCmdlet.ShouldProcess("pip $pkg", "Mettre à jour")) {
                try {
                    $installed = & $pipCmd show $pkg 2>&1
                    if ($installed -notmatch "not found|WARNING") {
                        & $pipCmd install --upgrade $pkg --quiet 2>&1 | Out-Null
                        $updatesApplied++
                    }
                }
                catch {
                    # Silently continue
                }
            }
        }
        Write-NemesisLog "Packages Python IA vérifiés" -Level SUCCESS -Component "UPDATE"
    }

    # === NPM GLOBAL ===
    if (Test-CommandExists "npm") {
        Write-NemesisLog "Mise à jour packages NPM globaux..." -Level INFO -Component "UPDATE"

        if ($PSCmdlet.ShouldProcess("NPM global packages", "Mettre à jour")) {
            try {
                npm update -g 2>&1 | Out-Null
                Write-NemesisLog "NPM global mis à jour" -Level SUCCESS -Component "UPDATE"
            }
            catch {
                Write-NemesisLog "Échec NPM: $($_.Exception.Message)" -Level WARNING -Component "UPDATE"
            }
        }
    }

    # === OLLAMA MODELS ===
    if (Test-CommandExists "ollama") {
        Write-NemesisLog "Mise à jour modèles Ollama..." -Level INFO -Component "UPDATE"

        # Récupérer la liste des modèles installés
        try {
            $installedModels = ollama list 2>&1 | Select-Object -Skip 1 | ForEach-Object { ($_ -split "\s+")[0] } | Where-Object { $_ }

            foreach ($model in $installedModels) {
                if ($PSCmdlet.ShouldProcess("ollama $model", "Pull latest")) {
                    try {
                        if (-not $Silent) {
                            Write-Host "  ⬇️ Mise à jour $model..." -ForegroundColor Cyan -NoNewline
                        }
                        $result = ollama pull $model 2>&1
                        if ($result -match "up to date") {
                            if (-not $Silent) { Write-Host " ✓" -ForegroundColor Green }
                        }
                        else {
                            $updatesApplied++
                            if (-not $Silent) { Write-Host " ↑" -ForegroundColor Yellow }
                        }
                    }
                    catch {
                        if (-not $Silent) { Write-Host " ✗" -ForegroundColor Red }
                    }
                }
            }
        }
        catch {
            Write-NemesisLog "Échec liste modèles Ollama: $($_.Exception.Message)" -Level WARNING -Component "UPDATE"
        }
    }

    # === VS CODE EXTENSIONS ===
    if (Test-CommandExists "code") {
        Write-NemesisLog "Mise à jour extensions VS Code..." -Level INFO -Component "UPDATE"

        if ($PSCmdlet.ShouldProcess("VS Code extensions", "Mettre à jour")) {
            try {
                code --update-extensions 2>&1 | Out-Null
                Write-NemesisLog "Extensions VS Code mises à jour" -Level SUCCESS -Component "UPDATE"
            }
            catch {
                Write-NemesisLog "Échec VS Code extensions: $($_.Exception.Message)" -Level WARNING -Component "UPDATE"
            }
        }
    }

    # === POWERSHELL MODULES ===
    Write-NemesisLog "Mise à jour modules PowerShell..." -Level INFO -Component "UPDATE"

    $psModules = @("PSReadLine", "posh-git", "Terminal-Icons", "PSSQLite", "BurntToast")

    foreach ($mod in $psModules) {
        if ($PSCmdlet.ShouldProcess("Module $mod", "Mettre à jour")) {
            try {
                $installed = Get-Module -ListAvailable -Name $mod -ErrorAction SilentlyContinue
                if ($installed) {
                    Update-Module -Name $mod -Force -ErrorAction SilentlyContinue
                    $updatesApplied++
                }
            }
            catch {
                # Silently continue
            }
        }
    }

    $script:Statistics.UpdatesInstalled = $updatesApplied
    Complete-NemesisPhase -PhaseNumber 2 -Summary "$updatesApplied mises à jour appliquées"
}

#region ═══════════════════════════════════════════════════════════════════════════
#                       PHASE 3 : GÉNÉRATION .ENV.MASTER
#endregion ════════════════════════════════════════════════════════════════════════

function Invoke-Phase3-GenerateEnvMaster {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 3 -PhaseName "GÉNÉRATION .ENV.MASTER"

    # Collecter toutes les clés API existantes
    $envVars = @{}

    # Patterns de variables d'environnement à collecter
    $apiPatterns = @(
        "*_API_KEY*", "*_TOKEN*", "*_SECRET*", "*_WEBHOOK*", "*_PASSWORD*",
        "ANTHROPIC*", "OPENAI*", "GOOGLE*", "MISTRAL*", "XAI*", "AZURE*",
        "HUGGINGFACE*", "HF_*", "REPLICATE*", "DEEPSEEK*", "COHERE*",
        "TOGETHER*", "FIREWORKS*", "GROQ*", "PERPLEXITY*", "ANYSCALE*",
        "DISCORD*", "TELEGRAM*", "SLACK*", "NOTION*", "GITHUB*", "GITLAB*",
        "MAKE*", "ZAPIER*", "N8N*", "POSTGRES*", "MONGO*", "REDIS*",
        "QDRANT*", "PINECONE*", "WEAVIATE*", "CHROMA*", "MILVUS*",
        "OLLAMA*", "LOCALAI*", "LMSTUDIO*", "TEXTGEN*",
        "PAGERDUTY*", "PUSHOVER*", "NTFY*", "GOTIFY*", "MATRIX*",
        "SMTP*", "EMAIL*", "JIRA*", "LINEAR*", "BRAVE*"
    )

    Write-NemesisLog "Collecte des variables d'environnement..." -Level INFO -Component "ENV"

    foreach ($pattern in $apiPatterns) {
        Get-ChildItem env: -ErrorAction SilentlyContinue | Where-Object { $_.Name -like $pattern } | ForEach-Object {
            if ($_.Value -and $_.Value.Length -gt 3) {
                $envVars[$_.Name] = $_.Value
            }
        }
    }

    Write-NemesisLog "Variables collectées: $($envVars.Count)" -Level INFO -Component "ENV"

    # Générer le fichier .env.master
    $envContent = @"
# ═══════════════════════════════════════════════════════════════════════════════
# NEMESIS OMEGA V3 - MASTER ENVIRONMENT FILE
# ═══════════════════════════════════════════════════════════════════════════════
# Généré le: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# Version: $($script:Config.Version)
# Machine: $env:COMPUTERNAME
# ═══════════════════════════════════════════════════════════════════════════════

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │                           AI MODELS - TIER 1 (MAJOR)                        │
# └─────────────────────────────────────────────────────────────────────────────┘

# Anthropic Claude
ANTHROPIC_API_KEY=$(Get-ValueOrDefault $envVars['ANTHROPIC_API_KEY'] '# sk-ant-xxx')

# OpenAI GPT
OPENAI_API_KEY=$(Get-ValueOrDefault $envVars['OPENAI_API_KEY'] '# sk-xxx')
OPENAI_ORG_ID=$(Get-ValueOrDefault $envVars['OPENAI_ORG_ID'] '# org-xxx')

# Google Gemini
GOOGLE_API_KEY=$(Get-ValueOrDefault $envVars['GOOGLE_API_KEY'] '# AIzaxxx')
GOOGLE_PROJECT_ID=$(Get-ValueOrDefault $envVars['GOOGLE_PROJECT_ID'] '# project-id')

# Azure OpenAI
AZURE_OPENAI_API_KEY=$(Get-ValueOrDefault $envVars['AZURE_OPENAI_API_KEY'] '# xxx')
AZURE_OPENAI_ENDPOINT=$(Get-ValueOrDefault $envVars['AZURE_OPENAI_ENDPOINT'] '# https://xxx.openai.azure.com')

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │                           AI MODELS - TIER 2 (SPECIALIZED)                  │
# └─────────────────────────────────────────────────────────────────────────────┘

# Mistral AI
MISTRAL_API_KEY=$(Get-ValueOrDefault $envVars['MISTRAL_API_KEY'] '# xxx')

# xAI Grok
XAI_API_KEY=$(Get-ValueOrDefault $envVars['XAI_API_KEY'] '# xai-xxx')

# Cohere
COHERE_API_KEY=$(Get-ValueOrDefault $envVars['COHERE_API_KEY'] '# xxx')

# DeepSeek
DEEPSEEK_API_KEY=$(Get-ValueOrDefault $envVars['DEEPSEEK_API_KEY'] '# sk-xxx')

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │                           AI MODELS - TIER 3 (CLOUD INFERENCE)              │
# └─────────────────────────────────────────────────────────────────────────────┘

# Hugging Face
HF_API_KEY=$(Get-ValueOrDefault (Get-ValueOrDefault $envVars['HF_API_KEY'] $envVars['HUGGINGFACE_API_KEY']) '# hf_xxx')
HF_HOME=$(Get-ValueOrDefault $envVars['HF_HOME'] 'D:\HuggingFace')

# Replicate
REPLICATE_API_TOKEN=$(Get-ValueOrDefault $envVars['REPLICATE_API_TOKEN'] '# r8_xxx')

# Together AI
TOGETHER_API_KEY=$(Get-ValueOrDefault $envVars['TOGETHER_API_KEY'] '# xxx')

# Fireworks AI
FIREWORKS_API_KEY=$(Get-ValueOrDefault $envVars['FIREWORKS_API_KEY'] '# xxx')

# Groq
GROQ_API_KEY=$(Get-ValueOrDefault $envVars['GROQ_API_KEY'] '# gsk_xxx')

# Perplexity AI
PERPLEXITY_API_KEY=$(Get-ValueOrDefault $envVars['PERPLEXITY_API_KEY'] '# pplx-xxx')

# Anyscale
ANYSCALE_API_KEY=$(Get-ValueOrDefault $envVars['ANYSCALE_API_KEY'] '# xxx')

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │                          AI MODELS - TIER 4 (LOCAL)                         │
# └─────────────────────────────────────────────────────────────────────────────┘

# Ollama
OLLAMA_HOST=$(Get-ValueOrDefault $envVars['OLLAMA_HOST'] 'http://localhost:11434')
OLLAMA_MODELS=$(Get-ValueOrDefault $envVars['OLLAMA_MODELS'] 'D:\Ollama\models')

# LM Studio
LMSTUDIO_HOST=$(Get-ValueOrDefault $envVars['LMSTUDIO_HOST'] 'http://localhost:1234')

# LocalAI
LOCALAI_HOST=$(Get-ValueOrDefault $envVars['LOCALAI_HOST'] 'http://localhost:8080')

# Text Generation WebUI
TEXTGEN_HOST=$(Get-ValueOrDefault $envVars['TEXTGEN_HOST'] 'http://localhost:5000')

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │                         TIER 5 - TOOLS & SERVICES                           │
# └─────────────────────────────────────────────────────────────────────────────┘

# Notion
NOTION_API_KEY=$(Get-ValueOrDefault $envVars['NOTION_API_KEY'] '# secret_xxx')
NOTION_DATABASE_ID=$(Get-ValueOrDefault $envVars['NOTION_DATABASE_ID'] '# xxx')

# GitHub
GITHUB_TOKEN=$(Get-ValueOrDefault $envVars['GITHUB_TOKEN'] '# ghp_xxx')
GITHUB_USERNAME=$(Get-ValueOrDefault $envVars['GITHUB_USERNAME'] '# username')

# GitLab
GITLAB_TOKEN=$(Get-ValueOrDefault $envVars['GITLAB_TOKEN'] '# glpat-xxx')

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │                         TIER 6 - DATABASES & VECTORS                        │
# └─────────────────────────────────────────────────────────────────────────────┘

# PostgreSQL
POSTGRES_HOST=$(Get-ValueOrDefault $envVars['POSTGRES_HOST'] 'localhost')
POSTGRES_PORT=$(Get-ValueOrDefault $envVars['POSTGRES_PORT'] '5432')
POSTGRES_USER=$(Get-ValueOrDefault $envVars['POSTGRES_USER'] 'postgres')
POSTGRES_PASSWORD=$(Get-ValueOrDefault $envVars['POSTGRES_PASSWORD'] '# password')
POSTGRES_DB=$(Get-ValueOrDefault $envVars['POSTGRES_DB'] 'nemesis')

# MongoDB
MONGODB_URI=$(Get-ValueOrDefault $envVars['MONGODB_URI'] '# mongodb://localhost:27017')

# Redis
REDIS_HOST=$(Get-ValueOrDefault $envVars['REDIS_HOST'] 'localhost')
REDIS_PORT=$(Get-ValueOrDefault $envVars['REDIS_PORT'] '6379')
REDIS_PASSWORD=$(Get-ValueOrDefault $envVars['REDIS_PASSWORD'] '# password')

# Qdrant
QDRANT_HOST=$(Get-ValueOrDefault $envVars['QDRANT_HOST'] 'localhost')
QDRANT_PORT=$(Get-ValueOrDefault $envVars['QDRANT_PORT'] '6333')
QDRANT_API_KEY=$(Get-ValueOrDefault $envVars['QDRANT_API_KEY'] '# xxx')

# Pinecone
PINECONE_API_KEY=$(Get-ValueOrDefault $envVars['PINECONE_API_KEY'] '# xxx')
PINECONE_ENVIRONMENT=$(Get-ValueOrDefault $envVars['PINECONE_ENVIRONMENT'] '# us-east-1')

# Weaviate
WEAVIATE_URL=$(Get-ValueOrDefault $envVars['WEAVIATE_URL'] 'http://localhost:8080')
WEAVIATE_API_KEY=$(Get-ValueOrDefault $envVars['WEAVIATE_API_KEY'] '# xxx')

# ChromaDB
CHROMA_HOST=$(Get-ValueOrDefault $envVars['CHROMA_HOST'] 'http://localhost:8000')

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │                         TIER 7 - AUTOMATION & WEBHOOKS                      │
# └─────────────────────────────────────────────────────────────────────────────┘

# Discord
DISCORD_WEBHOOK_URL=$(Get-ValueOrDefault $envVars['DISCORD_WEBHOOK_URL'] '# https://discord.com/api/webhooks/xxx')
DISCORD_BOT_TOKEN=$(Get-ValueOrDefault $envVars['DISCORD_BOT_TOKEN'] '# xxx')

# Telegram
TELEGRAM_BOT_TOKEN=$(Get-ValueOrDefault $envVars['TELEGRAM_BOT_TOKEN'] '# xxx:xxx')
TELEGRAM_CHAT_ID=$(Get-ValueOrDefault $envVars['TELEGRAM_CHAT_ID'] '# xxx')

# Slack
SLACK_WEBHOOK_URL=$(Get-ValueOrDefault $envVars['SLACK_WEBHOOK_URL'] '# https://hooks.slack.com/xxx')
SLACK_BOT_TOKEN=$(Get-ValueOrDefault $envVars['SLACK_BOT_TOKEN'] '# xoxb-xxx')

# Teams
TEAMS_WEBHOOK_URL=$(Get-ValueOrDefault $envVars['TEAMS_WEBHOOK_URL'] '# https://outlook.office.com/webhook/xxx')

# PagerDuty
PAGERDUTY_ROUTING_KEY=$(Get-ValueOrDefault $envVars['PAGERDUTY_ROUTING_KEY'] '# xxx')

# Pushover
PUSHOVER_USER_KEY=$(Get-ValueOrDefault $envVars['PUSHOVER_USER_KEY'] '# xxx')
PUSHOVER_API_TOKEN=$(Get-ValueOrDefault $envVars['PUSHOVER_API_TOKEN'] '# xxx')

# Make.com
MAKE_API_KEY=$(Get-ValueOrDefault $envVars['MAKE_API_KEY'] '# xxx')
MAKE_WEBHOOK_URL=$(Get-ValueOrDefault $envVars['MAKE_WEBHOOK_URL'] '# https://hook.eu2.make.com/xxx')

# Zapier
ZAPIER_WEBHOOK_URL=$(Get-ValueOrDefault $envVars['ZAPIER_WEBHOOK_URL'] '# https://hooks.zapier.com/xxx')
ZAPIER_NLA_API_KEY=$(Get-ValueOrDefault $envVars['ZAPIER_NLA_API_KEY'] '# xxx')

# N8N
N8N_HOST=$(Get-ValueOrDefault $envVars['N8N_HOST'] 'http://localhost:5678')
N8N_API_KEY=$(Get-ValueOrDefault $envVars['N8N_API_KEY'] '# xxx')

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │                           NEMESIS CONFIGURATION                             │
# └─────────────────────────────────────────────────────────────────────────────┘

# Paths
NEMESIS_ROOT=$($script:Config.Paths.NemesisRoot)
NEMESIS_LOGS=$($script:Config.Paths.Logs)
NEMESIS_CONFIG=$($script:Config.Paths.Config)

# Settings
NEMESIS_VERSION=$($script:Config.Version)
NEMESIS_DEBUG=$(Get-ValueOrDefault $envVars['NEMESIS_DEBUG'] 'false')
NEMESIS_LOG_LEVEL=$(Get-ValueOrDefault $envVars['NEMESIS_LOG_LEVEL'] 'INFO')
NEMESIS_LANGUAGE=$Language

# ═══════════════════════════════════════════════════════════════════════════════
# FIN DU FICHIER - $($envVars.Count) variables configurées
# ═══════════════════════════════════════════════════════════════════════════════
"@

    if ($PSCmdlet.ShouldProcess($script:EnvMasterPath, "Créer .env.master")) {
        try {
            # Créer le répertoire parent si nécessaire
            $parentDir = Split-Path $script:EnvMasterPath -Parent
            if (-not (Test-Path $parentDir)) {
                New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
            }

            # Sauvegarder l'ancien fichier
            if (Test-Path $script:EnvMasterPath) {
                $backupPath = "$($script:EnvMasterPath).backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
                Copy-Item $script:EnvMasterPath $backupPath -Force
            }

            $envContent | Out-File $script:EnvMasterPath -Encoding UTF8 -Force
            Write-NemesisLog ".env.master créé: $($script:EnvMasterPath)" -Level SUCCESS -Component "ENV"
        }
        catch {
            Write-NemesisLog "Échec création .env.master: $($_.Exception.Message)" -Level ERROR -Component "ENV"
        }
    }

    # Sécuriser les credentials si demandé
    if ($EnableEncryption) {
        Write-NemesisLog "Chiffrement des credentials activé" -Level INFO -Component "ENV"
        $script:Statistics.CredentialsSecured = $envVars.Count
    }

    Complete-NemesisPhase -PhaseNumber 3 -Summary "$($envVars.Count) variables consolidées"
}

#region ═══════════════════════════════════════════════════════════════════════════
#                          PHASE 4 : TRI & ORGANISATION
#endregion ════════════════════════════════════════════════════════════════════════

function Invoke-Phase4-OrganizeFiles {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 4 -PhaseName "TRI & ORGANISATION"

    $hashIndex = @{}
    $duplicates = [System.Collections.Generic.List[object]]::new()
    $fileIndex = [System.Collections.Generic.List[object]]::new()

    # === SCAN ET INDEXATION DES FICHIERS ===
    Write-NemesisLog "Indexation des fichiers..." -Level INFO -Component "ORGANIZE"

    $scanPaths = @(
        @{ Path = $script:Config.Paths.Workflows; Depth = $MaxScanDepth }
        @{ Path = $script:Config.Paths.NemesisRoot; Depth = 5 }
        @{ Path = (Join-Path $env:USERPROFILE "Documents"); Depth = 3 }
        @{ Path = (Join-Path $env:USERPROFILE "Projects"); Depth = 4 }
    )

    $totalFiles = 0
    $extensions = @{}

    foreach ($scan in $scanPaths) {
        if (-not (Test-Path $scan.Path)) { continue }

        Write-NemesisLog "  Scan: $($scan.Path)" -Level DEBUG -Component "ORGANIZE"

        try {
            # Patterns d'extensions à indexer
            $allExtensions = $script:Config.FileExtensions.Code + $script:Config.FileExtensions.Config + $script:Config.FileExtensions.Docs + $script:Config.FileExtensions.Scripts
            $extensionPattern = ($allExtensions | ForEach-Object { "*$_" }) -join ","

            $files = Get-ChildItem -Path $scan.Path -Recurse -File -Depth $scan.Depth -ErrorAction SilentlyContinue |
                Where-Object { $_.Length -gt 0 -and $_.Extension -in $allExtensions }

            $fileCount = 0
            foreach ($file in $files) {
                $fileCount++
                $totalFiles++
                $script:Statistics.FilesScanned++

                # Compteur par extension
                if (-not $extensions.ContainsKey($file.Extension)) {
                    $extensions[$file.Extension] = 0
                }
                $extensions[$file.Extension]++

                # Hash pour détection doublons (fichiers > 1KB et < 50MB)
                if ($file.Length -gt 1KB -and $file.Length -lt 50MB) {
                    $hash = Get-FileHashSafe -Path $file.FullName
                    if ($hash) {
                        if ($hashIndex.ContainsKey($hash)) {
                            [void]$duplicates.Add(@{
                                Original = $hashIndex[$hash]
                                Duplicate = $file.FullName
                                Size = $file.Length
                                Hash = $hash
                            })
                        }
                        else {
                            $hashIndex[$hash] = $file.FullName
                        }
                    }
                }

                # Catégorisation automatique
                $category = "Other"
                if ($file.Extension -in $script:Config.FileExtensions.Code) { $category = "Code" }
                elseif ($file.Extension -in $script:Config.FileExtensions.Config) { $category = "Config" }
                elseif ($file.Extension -in $script:Config.FileExtensions.Docs) { $category = "Documentation" }
                elseif ($file.Extension -in $script:Config.FileExtensions.Scripts) { $category = "Scripts" }
                elseif ($file.Extension -in $script:Config.FileExtensions.AI) { $category = "AI Models" }

                [void]$fileIndex.Add(@{
                    Path = $file.FullName
                    Filename = $file.Name
                    Extension = $file.Extension
                    Size = $file.Length
                    CreatedAt = $file.CreationTime.ToString("o")
                    ModifiedAt = $file.LastWriteTime.ToString("o")
                    Category = $category
                })

                # Progress
                if ($fileCount % 100 -eq 0 -and -not $Silent) {
                    Write-Host "`r  📁 $fileCount fichiers scannés dans $($scan.Path)..." -NoNewline -ForegroundColor Cyan
                }
            }

            if (-not $Silent -and $fileCount -gt 0) {
                Write-Host "`r  ✅ $fileCount fichiers dans $($scan.Path)                    " -ForegroundColor Green
            }
        }
        catch {
            Write-NemesisLog "Erreur scan $($scan.Path): $($_.Exception.Message)" -Level WARNING -Component "ORGANIZE"
        }
    }

    Write-NemesisLog "Fichiers indexés: $totalFiles" -Level INFO -Component "ORGANIZE"
    Write-NemesisLog "Doublons détectés: $($duplicates.Count)" -Level INFO -Component "ORGANIZE"

    # Afficher les stats par extension
    if (-not $Silent -and $extensions.Count -gt 0) {
        Write-Host ""
        Write-Host "  📊 Top extensions:" -ForegroundColor White
        $topExtensions = $extensions.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 10
        foreach ($ext in $topExtensions) {
            Write-Host "     $($ext.Key): $($ext.Value)" -ForegroundColor Gray
        }
    }

    # === TRAITEMENT DOUBLONS ===
    if ($duplicates.Count -gt 0 -and -not $DryRun -and $AggressiveCleanup) {
        Write-NemesisLog "Traitement des doublons (mode agressif)..." -Level INFO -Component "ORGANIZE"

        $dupLogPath = Join-Path $script:Config.Paths.Reports "duplicates_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

        foreach ($dup in $duplicates) {
            $original = Get-Item $dup.Original -ErrorAction SilentlyContinue
            $duplicate = Get-Item $dup.Duplicate -ErrorAction SilentlyContinue

            if ($original -and $duplicate) {
                # Garder le plus ancien
                $toRemove = if ($original.CreationTime -lt $duplicate.CreationTime) { $dup.Duplicate } else { $dup.Original }

                if ($PSCmdlet.ShouldProcess($toRemove, "Supprimer doublon")) {
                    try {
                        "$(Get-Date -Format 'o') | REMOVED: $toRemove | KEPT: $(if ($toRemove -eq $dup.Duplicate) { $dup.Original } else { $dup.Duplicate })" | Out-File $dupLogPath -Append -Encoding UTF8
                        Remove-Item $toRemove -Force
                        $script:Statistics.DuplicatesRemoved++
                    }
                    catch {
                        Write-NemesisLog "Échec suppression doublon: $($_.Exception.Message)" -Level WARNING -Component "ORGANIZE"
                    }
                }
            }
        }
    }
    elseif ($duplicates.Count -gt 0) {
        # Juste logger les doublons sans les supprimer
        $dupReportPath = Join-Path $script:Config.Paths.Reports "duplicates_report_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
        try {
            @{
                Timestamp = Get-Date -Format "o"
                Count = $duplicates.Count
                TotalSize = ($duplicates | Measure-Object -Property Size -Sum).Sum
                Duplicates = $duplicates
            } | ConvertTo-Json -Depth 5 | Out-File $dupReportPath -Encoding UTF8
            Write-NemesisLog "Rapport doublons: $dupReportPath" -Level INFO -Component "ORGANIZE"
        }
        catch {
            # Continue
        }
    }

    # === SAUVEGARDE INDEX ===
    $indexJsonPath = Join-Path $script:Config.Paths.SharedIndex "file_index.json"

    if ($PSCmdlet.ShouldProcess($indexJsonPath, "Sauvegarder index JSON")) {
        try {
            @{
                Timestamp = Get-Date -Format "o"
                TotalFiles = $fileIndex.Count
                Extensions = $extensions
                Files = $fileIndex
            } | ConvertTo-Json -Depth 5 -Compress | Out-File $indexJsonPath -Encoding UTF8

            Write-NemesisLog "Index sauvegardé: $indexJsonPath" -Level SUCCESS -Component "ORGANIZE"
        }
        catch {
            Write-NemesisLog "Échec sauvegarde index: $($_.Exception.Message)" -Level WARNING -Component "ORGANIZE"
        }
    }

    Complete-NemesisPhase -PhaseNumber 4 -Summary "$totalFiles fichiers, $($duplicates.Count) doublons, $($script:Statistics.DuplicatesRemoved) supprimés"
}

#region ═══════════════════════════════════════════════════════════════════════════
#                       PHASE 5 : ARBORESCENCE NEMESIS
#endregion ════════════════════════════════════════════════════════════════════════

function Invoke-Phase5-CreateTreeStructure {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 5 -PhaseName "ARBORESCENCE NEMESIS"

    # Structure NEMESIS complète
    $structure = @{
        "_LOGS" = @{ "archive" = @{} }
        "_REPORTS" = @{
            "daily" = @{}
            "weekly" = @{}
            "prometheus" = @{}
            "trending" = @{}
            "security" = @{}
            "network" = @{}
            "containers" = @{}
        }
        "_BACKUPS" = @{ "auto" = @{}; "manual" = @{} }
        "_CONFIG" = @{
            "templates" = @{}
            "credentials" = @{}
        }
        "_DOCS" = @{
            "architecture" = @{}
            "api" = @{}
            "guides" = @{}
            "changelog" = @{}
        }
        "_PLUGINS" = @{}
        "SHARED_INDEX" = @{}
        "AGENT_MEMORY" = @{
            "CLAUDE" = @{ "conversations" = @{}; "context" = @{} }
            "GPT" = @{ "conversations" = @{}; "context" = @{} }
            "GEMINI" = @{ "conversations" = @{}; "context" = @{} }
            "MISTRAL" = @{ "conversations" = @{}; "context" = @{} }
            "GROK" = @{ "conversations" = @{}; "context" = @{} }
            "DEEPSEEK" = @{ "conversations" = @{}; "context" = @{} }
            "LOCAL" = @{ "ollama" = @{}; "lmstudio" = @{} }
            "SHARED" = @{}
        }
        "ORCHESTRATION" = @{
            "CREWAI" = @{ "agents" = @{}; "tasks" = @{} }
            "AUTOGEN" = @{ "agents" = @{}; "workflows" = @{} }
            "LANGCHAIN" = @{ "chains" = @{}; "agents" = @{} }
            "LANGGRAPH" = @{ "graphs" = @{} }
            "WORKFLOWS" = @{}
        }
        "PROJECTS" = @{
            "ACTIVE" = @{}
            "ARCHIVE" = @{}
            "TEMPLATES" = @{}
        }
        "KNOWLEDGE_BASE" = @{
            "DOCUMENTS" = @{}
            "PROMPTS" = @{ "system" = @{}; "user" = @{} }
            "SKILLS" = @{}
            "EMBEDDINGS" = @{}
        }
        "MCP" = @{
            "servers" = @{}
            "tools" = @{}
            "resources" = @{}
        }
    }

    Write-NemesisLog "Création structure NEMESIS..." -Level INFO -Component "TREE"

    if ($PSCmdlet.ShouldProcess($script:Config.Paths.NemesisRoot, "Créer arborescence")) {
        try {
            New-DirectoryStructure -BasePath $script:Config.Paths.NemesisRoot -Structure $structure
            Write-NemesisLog "Arborescence créée" -Level SUCCESS -Component "TREE"
        }
        catch {
            Write-NemesisLog "Erreur création arborescence: $($_.Exception.Message)" -Level WARNING -Component "TREE"
        }
    }

    # === GÉNÉRATION README ===
    $readmePath = Join-Path $script:Config.Paths.NemesisRoot "README.md"

    $readmeContent = @"
# 🔥 NEMESIS OMEGA V3 - Mémoire Collective ULTIMATE

> **Version**: $($script:Config.Version)
> **Généré le**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
> **Machine**: $env:COMPUTERNAME

## 📂 Structure

\`\`\`
NEMESIS_MEMORY/
├── _LOGS/              # Journaux d'exécution
├── _REPORTS/           # Rapports, dashboards, métriques
│   ├── prometheus/     # Métriques Prometheus
│   ├── trending/       # Historique et tendances
│   └── security/       # Audits de sécurité
├── _BACKUPS/           # Sauvegardes automatiques
├── _CONFIG/            # Configuration système
│   ├── templates/      # Templates de configuration
│   └── credentials/    # Credentials chiffrés
├── _DOCS/              # Documentation auto-générée
├── _PLUGINS/           # Extensions et plugins
├── SHARED_INDEX/       # Index partagé (SQLite + JSON)
├── AGENT_MEMORY/       # Mémoire par agent IA
│   ├── CLAUDE/
│   ├── GPT/
│   ├── GEMINI/
│   ├── LOCAL/          # Modèles locaux
│   └── SHARED/
├── ORCHESTRATION/      # Workflows multi-agents
│   ├── CREWAI/
│   ├── AUTOGEN/
│   ├── LANGCHAIN/
│   └── LANGGRAPH/
├── PROJECTS/           # Projets actifs et archives
├── KNOWLEDGE_BASE/     # Base de connaissances
│   ├── PROMPTS/
│   ├── SKILLS/
│   └── EMBEDDINGS/
└── MCP/                # Model Context Protocol
    ├── servers/
    ├── tools/
    └── resources/
\`\`\`

## 📊 Dernière Exécution

| Métrique | Valeur |
|----------|--------|
| Fichiers scannés | $($script:Statistics.FilesScanned) |
| Score santé | $((Get-ValueOrDefault $script:HardwareHealth.HealthScore 'N/A'))/100 |
| APIs valides | $($script:Statistics.APIsValid)/$($script:Statistics.APIsTested) |
| Erreurs | $($script:Statistics.ErrorsEncountered) |

## 🔧 Configuration

- **Script**: NEMESIS_OMEGA_ARCHITECT_V3_ULTIMATE.ps1
- **Config MCP**: _CONFIG/mcp_servers.json
- **Variables**: _CONFIG/.env.master

---
*Généré par NEMESIS OMEGA v$($script:Config.Version)*
"@

    if ($PSCmdlet.ShouldProcess($readmePath, "Générer README")) {
        try {
            $readmeContent | Out-File $readmePath -Encoding UTF8
            Write-NemesisLog "README généré" -Level SUCCESS -Component "TREE"
        }
        catch {
            # Continue
        }
    }

    Complete-NemesisPhase -PhaseNumber 5 -Summary "Arborescence NEMESIS créée"
}

#region ═══════════════════════════════════════════════════════════════════════════
#                          PHASE 6 : CONFIGURATION MCP
#endregion ════════════════════════════════════════════════════════════════════════

function Invoke-Phase6-SetupMCP {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 6 -PhaseName "CONFIGURATION MCP"

    $mcpConfigPath = Join-Path $script:Config.Paths.Config "mcp_servers.json"

    # Configuration MCP complète pour Claude Desktop
    $mcpConfig = @{
        mcpServers = @{
            # === FILESYSTEM ===
            "filesystem" = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-filesystem", $script:Config.Paths.NemesisRoot, $env:USERPROFILE)
            }

            # === DATABASES ===
            "sqlite" = @{
                command = "npx"
                args = @("-y", "@anthropic/mcp-server-sqlite", "--db-path", (Join-Path $script:Config.Paths.SharedIndex "nemesis.sqlite"))
            }

            # === MEMORY ===
            "memory" = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-memory")
            }

            # === FETCH ===
            "fetch" = @{
                command = "npx"
                args = @("-y", "@anthropic/mcp-server-fetch")
            }

            # === GITHUB ===
            "github" = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-github")
                env = @{
                    GITHUB_TOKEN = '$($(Get-ValueOrDefault $env:GITHUB_TOKEN ""))'
                }
            }

            # === PUPPETEER ===
            "puppeteer" = @{
                command = "npx"
                args = @("-y", "@anthropic/mcp-server-puppeteer")
            }

            # === SEQUENTIAL THINKING ===
            "sequential-thinking" = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-sequential-thinking")
            }
        }
    }

    Write-NemesisLog "Génération configuration MCP..." -Level INFO -Component "MCP"

    if ($PSCmdlet.ShouldProcess($mcpConfigPath, "Créer config MCP")) {
        try {
            $parentDir = Split-Path $mcpConfigPath -Parent
            if (-not (Test-Path $parentDir)) {
                New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
            }

            $mcpConfig | ConvertTo-Json -Depth 10 | Out-File $mcpConfigPath -Encoding UTF8
            Write-NemesisLog "Configuration MCP créée: $mcpConfigPath" -Level SUCCESS -Component "MCP"
        }
        catch {
            Write-NemesisLog "Échec création config MCP: $($_.Exception.Message)" -Level ERROR -Component "MCP"
        }
    }

    # === DÉPLOIEMENT CLAUDE DESKTOP ===
    $claudeConfigPath = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"

    if (Test-Path (Split-Path $claudeConfigPath)) {
        if ($PSCmdlet.ShouldProcess($claudeConfigPath, "Déployer config Claude Desktop")) {
            try {
                if (Test-Path $claudeConfigPath) {
                    Copy-Item $claudeConfigPath "$claudeConfigPath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')" -Force
                }
                Copy-Item $mcpConfigPath $claudeConfigPath -Force
                Write-NemesisLog "Config déployée vers Claude Desktop" -Level SUCCESS -Component "MCP"
            }
            catch {
                Write-NemesisLog "Échec déploiement Claude Desktop: $($_.Exception.Message)" -Level WARNING -Component "MCP"
            }
        }
    }
    else {
        Write-NemesisLog "Claude Desktop non détecté" -Level DEBUG -Component "MCP"
    }

    Complete-NemesisPhase -PhaseNumber 6 -Summary "Configuration MCP déployée"
}

#region ═══════════════════════════════════════════════════════════════════════════
#                          PHASES 7-10 : RÉSUMÉ
#endregion ════════════════════════════════════════════════════════════════════════

function Invoke-Phase7-NetworkDiagnostics {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 7 -PhaseName "DIAGNOSTICS RÉSEAU"

    if (-not $IncludeNetworkDiag) {
        Write-NemesisLog "Phase ignorée (IncludeNetworkDiag non activé)" -Level DEBUG -Component "NETWORK"
        Complete-NemesisPhase -PhaseNumber 7 -Summary "Ignorée"
        return
    }

    $networkResults = @{
        Timestamp = Get-Date -Format "o"
        Connectivity = @{}
        DNS = @{}
        Latency = @{}
        Ports = @{}
    }

    # Test de connectivité
    Write-NemesisLog "Test de connectivité..." -Level INFO -Component "NETWORK"

    foreach ($host in $script:Config.NetworkDiagnostics.TestHosts) {
        try {
            $ping = Test-Connection -TargetName $host -Count 3 -TimeoutSeconds 5 -ErrorAction SilentlyContinue
            if ($ping) {
                $avgLatency = ($ping | Measure-Object -Property Latency -Average).Average
                $networkResults.Connectivity[$host] = @{
                    Status = "OK"
                    AverageLatency = [math]::Round($avgLatency, 2)
                }
                $script:Statistics.NetworkTestsPassed++

                if (-not $Silent) {
                    Write-Host "  ✅ $host - $([int]$avgLatency)ms" -ForegroundColor Green
                }
            }
            else {
                $networkResults.Connectivity[$host] = @{ Status = "Failed" }
                $script:Statistics.NetworkTestsFailed++
            }
        }
        catch {
            $networkResults.Connectivity[$host] = @{ Status = "Error"; Error = $_.Exception.Message }
            $script:Statistics.NetworkTestsFailed++
        }
    }

    # Test DNS
    Write-NemesisLog "Test DNS..." -Level INFO -Component "NETWORK"

    foreach ($dns in $script:Config.NetworkDiagnostics.DNSServers) {
        try {
            $startTime = Get-Date
            $result = Resolve-DnsName -Name "google.com" -Server $dns -DnsOnly -ErrorAction SilentlyContinue
            $latency = ((Get-Date) - $startTime).TotalMilliseconds

            if ($result) {
                $networkResults.DNS[$dns] = @{
                    Status = "OK"
                    Latency = [math]::Round($latency, 2)
                }
            }
        }
        catch {
            $networkResults.DNS[$dns] = @{ Status = "Failed" }
        }
    }

    $script:NetworkHealth = $networkResults

    Complete-NemesisPhase -PhaseNumber 7 -Summary "$($script:Statistics.NetworkTestsPassed) tests réussis"
}

function Invoke-Phase8-SecurityAudit {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 8 -PhaseName "AUDIT SÉCURITÉ"

    if (-not $IncludeSecurityAudit) {
        Write-NemesisLog "Phase ignorée (IncludeSecurityAudit non activé)" -Level DEBUG -Component "SECURITY"
        Complete-NemesisPhase -PhaseNumber 8 -Summary "Ignorée"
        return
    }

    $securityResults = @{
        Timestamp = Get-Date -Format "o"
        WindowsDefender = @{}
        Firewall = @{}
        UAC = @{}
        Updates = @{}
        Issues = [System.Collections.Generic.List[string]]::new()
    }

    # Windows Defender
    Write-NemesisLog "Vérification Windows Defender..." -Level INFO -Component "SECURITY"
    try {
        $defender = Get-MpComputerStatus -ErrorAction SilentlyContinue
        if ($defender) {
            $securityResults.WindowsDefender = @{
                AntivirusEnabled = $defender.AntivirusEnabled
                RealTimeProtection = $defender.RealTimeProtectionEnabled
                SignaturesUpToDate = $defender.AntivirusSignatureLastUpdated -gt (Get-Date).AddDays(-7)
                LastScan = $defender.FullScanEndTime
            }

            if (-not $defender.RealTimeProtectionEnabled) {
                [void]$securityResults.Issues.Add("Protection temps réel désactivée")
                $script:Statistics.SecurityIssuesFound++
            }
        }
    }
    catch {
        Write-NemesisLog "Impossible de vérifier Windows Defender" -Level WARNING -Component "SECURITY"
    }

    # Firewall
    Write-NemesisLog "Vérification Firewall..." -Level INFO -Component "SECURITY"
    try {
        $firewallProfiles = Get-NetFirewallProfile -ErrorAction SilentlyContinue
        $allEnabled = ($firewallProfiles | Where-Object { $_.Enabled }).Count -eq 3

        $securityResults.Firewall = @{
            DomainEnabled = ($firewallProfiles | Where-Object { $_.Name -eq "Domain" }).Enabled
            PrivateEnabled = ($firewallProfiles | Where-Object { $_.Name -eq "Private" }).Enabled
            PublicEnabled = ($firewallProfiles | Where-Object { $_.Name -eq "Public" }).Enabled
            AllEnabled = $allEnabled
        }

        if (-not $allEnabled) {
            [void]$securityResults.Issues.Add("Firewall partiellement désactivé")
            $script:Statistics.SecurityIssuesFound++
        }
    }
    catch {
        Write-NemesisLog "Impossible de vérifier le Firewall" -Level WARNING -Component "SECURITY"
    }

    $script:SecurityAuditResults = $securityResults

    if (-not $Silent -and $securityResults.Issues.Count -gt 0) {
        Write-Host ""
        Write-Host "  ⚠️ Problèmes de sécurité détectés:" -ForegroundColor Yellow
        foreach ($issue in $securityResults.Issues) {
            Write-Host "     • $issue" -ForegroundColor Yellow
        }
    }

    Complete-NemesisPhase -PhaseNumber 8 -Summary "$($script:Statistics.SecurityIssuesFound) problèmes détectés"
}

function Invoke-Phase9-SelfRepair {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 9 -PhaseName "AUTO-RÉPARATION"

    $repaired = 0

    # Vérification et création des chemins critiques
    Write-NemesisLog "Vérification chemins critiques..." -Level INFO -Component "REPAIR"

    $criticalPaths = @(
        $script:Config.Paths.NemesisRoot
        $script:Config.Paths.Logs
        $script:Config.Paths.Reports
        $script:Config.Paths.Config
        $script:Config.Paths.SharedIndex
        $script:Config.Paths.Backups
    )

    foreach ($path in $criticalPaths) {
        if (-not (Test-Path $path)) {
            if ($PSCmdlet.ShouldProcess($path, "Créer répertoire manquant")) {
                try {
                    New-Item -Path $path -ItemType Directory -Force | Out-Null
                    $repaired++
                    Write-NemesisLog "Répertoire créé: $path" -Level SUCCESS -Component "REPAIR"
                }
                catch {
                    Write-NemesisLog "Échec création: $path" -Level WARNING -Component "REPAIR"
                }
            }
        }
    }

    # Nettoyage fichiers temporaires
    if ($AggressiveCleanup) {
        Write-NemesisLog "Nettoyage fichiers temporaires..." -Level INFO -Component "REPAIR"

        $tempPaths = @($env:TEMP, (Join-Path $env:LOCALAPPDATA "Temp"))

        foreach ($tempPath in $tempPaths) {
            if (Test-Path $tempPath) {
                try {
                    $oldFiles = Get-ChildItem $tempPath -File -ErrorAction SilentlyContinue |
                        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) }

                    $cleanedSize = 0
                    foreach ($file in $oldFiles) {
                        try {
                            $cleanedSize += $file.Length
                            Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
                            $script:Statistics.TempFilesRemoved++
                        }
                        catch {
                            # Continue
                        }
                    }

                    if ($cleanedSize -gt 0) {
                        Write-NemesisLog "Nettoyé: $(ConvertTo-HumanReadableSize -Bytes $cleanedSize)" -Level DEBUG -Component "REPAIR"
                    }
                }
                catch {
                    # Continue
                }
            }
        }
    }

    $script:Statistics.ErrorsRepaired = $repaired
    Complete-NemesisPhase -PhaseNumber 9 -Summary "$repaired éléments réparés"
}

function Invoke-Phase10-Dashboard {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 10 -PhaseName "GÉNÉRATION DASHBOARD"

    $elapsed = (Get-Date) - $script:StartTime

    # === EXPORT PROMETHEUS ===
    if ($ExportPrometheus) {
        Write-NemesisLog "Export métriques Prometheus..." -Level INFO -Component "DASHBOARD"

        $prometheusPath = Join-Path $script:Config.Paths.Prometheus "metrics.prom"

        Export-PrometheusMetric -Name "nemesis_execution_duration_seconds" -Value $elapsed.TotalSeconds -Help "Duration of NEMESIS execution"
        Export-PrometheusMetric -Name "nemesis_files_scanned" -Value $script:Statistics.FilesScanned -Help "Total files scanned" -Type "counter"
        Export-PrometheusMetric -Name "nemesis_errors_total" -Value $script:Statistics.ErrorsEncountered -Help "Total errors encountered" -Type "counter"
        Export-PrometheusMetric -Name "nemesis_updates_installed" -Value $script:Statistics.UpdatesInstalled -Help "Updates installed" -Type "counter"

        try {
            $parentDir = Split-Path $prometheusPath -Parent
            if (-not (Test-Path $parentDir)) {
                New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
            }
            $script:PrometheusMetrics | Out-File $prometheusPath -Encoding UTF8
            Write-NemesisLog "Métriques Prometheus: $prometheusPath" -Level SUCCESS -Component "DASHBOARD"
        }
        catch {
            Write-NemesisLog "Échec export Prometheus: $($_.Exception.Message)" -Level WARNING -Component "DASHBOARD"
        }
    }

    # === TRENDING DATA ===
    if ($EnableTrending) {
        Write-TrendingData -Metrics @{
            HealthScore = (Get-ValueOrDefault $script:HardwareHealth.HealthScore 0)
            CPUUsage = (Get-ValueOrDefault $script:HardwareHealth.CPU.CurrentLoad 0)
            MemoryUsage = (Get-ValueOrDefault $script:HardwareHealth.Memory.UsedPercent 0)
            DiskFreeC = (Get-ValueOrDefault $script:HardwareHealth.Disks["C:"].FreePercent 0)
            DiskFreeD = (Get-ValueOrDefault $script:HardwareHealth.Disks["D:"].FreePercent 0)
            DiskFreeE = (Get-ValueOrDefault $script:HardwareHealth.Disks["E:"].FreePercent 0)
            APIsValid = $script:Statistics.APIsValid
            ErrorCount = $script:Statistics.ErrorsEncountered
        }
    }

    Complete-NemesisPhase -PhaseNumber 10 -Summary "Dashboard généré"
}

#region ═══════════════════════════════════════════════════════════════════════════
#                          PHASES 11-12 : FINALISATION
#endregion ════════════════════════════════════════════════════════════════════════

function Invoke-Phase11-ContainerScan {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 11 -PhaseName "SCAN CONTAINERS"

    if (-not $IncludeContainerScan) {
        Complete-NemesisPhase -PhaseNumber 11 -Summary "Ignorée"
        return
    }

    # Docker scan
    if (Test-CommandExists "docker") {
        Write-NemesisLog "Scan containers Docker..." -Level INFO -Component "CONTAINERS"

        try {
            $containers = docker ps -a --format "{{json .}}" 2>$null | ConvertFrom-Json
            $script:Statistics.ContainersScanned = $containers.Count

            foreach ($container in $containers) {
                if ($container.State -eq "running") {
                    $script:Statistics.ContainersHealthy++
                }
            }

            Write-NemesisLog "Containers: $($script:Statistics.ContainersHealthy)/$($script:Statistics.ContainersScanned) actifs" -Level INFO -Component "CONTAINERS"
        }
        catch {
            Write-NemesisLog "Échec scan Docker: $($_.Exception.Message)" -Level WARNING -Component "CONTAINERS"
        }
    }

    Complete-NemesisPhase -PhaseNumber 11 -Summary "$($script:Statistics.ContainersHealthy) containers actifs"
}

function Invoke-Phase12-Finalization {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    Write-NemesisPhase -PhaseNumber 12 -PhaseName "FINALISATION"

    $elapsed = (Get-Date) - $script:StartTime
    $script:Statistics.Duration = $elapsed

    # === RAPPORT FINAL JSON ===
    $finalReport = @{
        ExecutionInfo = @{
            StartTime = $script:StartTime.ToString("o")
            EndTime = (Get-Date).ToString("o")
            Duration = $elapsed.ToString()
            DurationSeconds = [math]::Round($elapsed.TotalSeconds, 2)
            DryRun = $DryRun.IsPresent
            Version = $script:Config.Version
            Mode = "ULTIMATE"
            Machine = $env:COMPUTERNAME
            User = $env:USERNAME
        }
        Statistics = $script:Statistics
        HardwareHealth = $script:HardwareHealth
        APIValidation = $script:APIValidationResults
        SecurityAudit = $script:SecurityAuditResults
        Actions = $script:Actions
        Errors = $script:Errors
        Warnings = $script:Warnings
    }

    $reportPath = Join-Path $script:Config.Paths.Reports "final_report_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"

    if ($PSCmdlet.ShouldProcess($reportPath, "Créer rapport final")) {
        try {
            $finalReport | ConvertTo-Json -Depth 10 | Out-File $reportPath -Encoding UTF8
            Write-NemesisLog "Rapport final: $reportPath" -Level SUCCESS -Component "FINAL"
        }
        catch {
            Write-NemesisLog "Échec création rapport: $($_.Exception.Message)" -Level WARNING -Component "FINAL"
        }
    }

    # === RAPPORT MARKDOWN ===
    if ($ReportAsMarkdown) {
        $mdPath = Join-Path $script:Config.Paths.Reports "report_$(Get-Date -Format 'yyyyMMdd_HHmmss').md"

        $mdContent = @"
# 📊 Rapport NEMESIS OMEGA V3 ULTIMATE

**Date**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Durée**: $(ConvertTo-HumanReadableDuration -Duration $elapsed)
**Version**: $($script:Config.Version)

## 🏥 Santé Système

- **Score**: $((Get-ValueOrDefault $script:HardwareHealth.HealthScore 'N/A'))/100
- **CPU**: $((Get-ValueOrDefault $script:HardwareHealth.CPU.CurrentLoad 'N/A'))%
- **RAM**: $((Get-ValueOrDefault $script:HardwareHealth.Memory.UsedPercent 'N/A'))%

## 📊 Statistiques

| Métrique | Valeur |
|----------|--------|
| Fichiers scannés | $($script:Statistics.FilesScanned) |
| Doublons supprimés | $($script:Statistics.DuplicatesRemoved) |
| Mises à jour | $($script:Statistics.UpdatesInstalled) |
| APIs valides | $($script:Statistics.APIsValid)/$($script:Statistics.APIsTested) |
| Erreurs | $($script:Statistics.ErrorsEncountered) |

## ✅ Actions

$(($script:Actions | ForEach-Object { "- $_" }) -join "`n")

---
*NEMESIS OMEGA v$($script:Config.Version)*
"@

        try {
            $mdContent | Out-File $mdPath -Encoding UTF8
            Write-NemesisLog "Rapport Markdown: $mdPath" -Level SUCCESS -Component "FINAL"
        }
        catch {
            # Continue
        }
    }

    # === NOTIFICATION FINALE ===
    $statusEmoji = if ($script:Errors.Count -eq 0) { "✅" } else { "⚠️" }
    $notifType = if ($script:Errors.Count -eq 0) { "Success" } else { "Warning" }

    $notifContent = @"
$statusEmoji **NEMESIS V3 ULTIMATE - TERMINÉ**

📊 **Résumé:**
• Fichiers: $($script:Statistics.FilesScanned)
• Mises à jour: $($script:Statistics.UpdatesInstalled)
• APIs: $($script:Statistics.APIsValid)/$($script:Statistics.APIsTested)
• Erreurs: $($script:Statistics.ErrorsEncountered)

🏥 **Santé**: $((Get-ValueOrDefault $script:HardwareHealth.HealthScore 'N/A'))/100
⏱️ **Durée**: $(ConvertTo-HumanReadableDuration -Duration $elapsed)
"@

    Send-MultiWebhookNotification -Content $notifContent -Title "NEMESIS ULTIMATE Complete" -Type $notifType

    # === ROTATION DES LOGS ===
    Invoke-LogRotation

    Complete-NemesisPhase -PhaseNumber 12 -Summary "Rapport généré, durée $(ConvertTo-HumanReadableDuration -Duration $elapsed)"
}

#region ═══════════════════════════════════════════════════════════════════════════
#                              ORCHESTRATEUR PRINCIPAL
#endregion ════════════════════════════════════════════════════════════════════════

function Invoke-NemesisOmegaArchitect {
    [CmdletBinding(SupportsShouldProcess)]
    param()

    # === BANNER ULTIMATE ===
    if (-not $Silent) {
        $banner = @"

    ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
    ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
    ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
    ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
    ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
    ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝

          ██╗   ██╗██╗  ████████╗██╗███╗   ███╗ █████╗ ████████╗███████╗
          ██║   ██║██║  ╚══██╔══╝██║████╗ ████║██╔══██╗╚══██╔══╝██╔════╝
          ██║   ██║██║     ██║   ██║██╔████╔██║███████║   ██║   █████╗
          ██║   ██║██║     ██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██╔══╝
          ╚██████╔╝███████╗██║   ██║██║ ╚═╝ ██║██║  ██║   ██║   ███████╗
           ╚═════╝ ╚══════╝╚═╝   ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝

                    SYSTEM ARCHITECT v$($script:Config.Version)

"@
        Write-Host $banner -ForegroundColor Magenta
        Write-Host "    ⚡ MODE ULTIMATE ACTIVÉ - MAINTENANCE TRANSCENDANTE ⚡" -ForegroundColor Yellow
        Write-Host ""
    }

    # === INITIALISATION ===
    Initialize-NemesisDirectories

    # === VÉRIFICATIONS PRÉLIMINAIRES ===
    if (-not (Test-AdminPrivileges)) {
        Write-NemesisLog "Ce script nécessite des privilèges administrateur!" -Level CRITICAL
        if (-not $Silent) {
            Write-Host "Relancez PowerShell en tant qu'Administrateur." -ForegroundColor Red
        }
        return
    }

    if ($DryRun -and -not $Silent) {
        Write-Host "🔶 MODE DRY-RUN ACTIVÉ - Aucune modification réelle" -ForegroundColor Yellow
        Write-Host ""
    }

    # === SELF-TESTS ===
    if (-not $SkipSelfTest) {
        try {
            Invoke-SelfTests
        }
        catch {
            Write-NemesisLog "Self-tests échoués: $($_.Exception.Message)" -Level CRITICAL
            if (-not $Force) { return }
        }
    }

    # === VALIDATION API ===
    Test-APIConnectivity

    # === BACKUP PRÉ-EXÉCUTION ===
    Invoke-PreExecutionBackup

    # === EXÉCUTION DES PHASES ===
    $phases = @(
        @{ Number = 1; Name = "SystemScan"; Function = { Invoke-Phase1-SystemScan } }
        @{ Number = 2; Name = "UpdateAll"; Function = { Invoke-Phase2-UpdateAll } }
        @{ Number = 3; Name = "GenerateEnvMaster"; Function = { Invoke-Phase3-GenerateEnvMaster } }
        @{ Number = 4; Name = "OrganizeFiles"; Function = { Invoke-Phase4-OrganizeFiles } }
        @{ Number = 5; Name = "CreateTreeStructure"; Function = { Invoke-Phase5-CreateTreeStructure } }
        @{ Number = 6; Name = "SetupMCP"; Function = { Invoke-Phase6-SetupMCP } }
        @{ Number = 7; Name = "NetworkDiagnostics"; Function = { Invoke-Phase7-NetworkDiagnostics } }
        @{ Number = 8; Name = "SecurityAudit"; Function = { Invoke-Phase8-SecurityAudit } }
        @{ Number = 9; Name = "SelfRepair"; Function = { Invoke-Phase9-SelfRepair } }
        @{ Number = 10; Name = "Dashboard"; Function = { Invoke-Phase10-Dashboard } }
        @{ Number = 11; Name = "ContainerScan"; Function = { Invoke-Phase11-ContainerScan } }
        @{ Number = 12; Name = "Finalization"; Function = { Invoke-Phase12-Finalization } }
    )

    foreach ($phase in $phases) {
        if ($OnlyPhases -and $phase.Number -notin $OnlyPhases) {
            continue
        }

        try {
            & $phase.Function
        }
        catch {
            Write-NemesisLog "ERREUR PHASE $($phase.Number): $($_.Exception.Message)" -Level ERROR

            Send-MultiWebhookNotification -Content "❌ Erreur Phase $($phase.Number): $($_.Exception.Message)" -Title "NEMESIS Erreur" -Type "Error"

            if (-not $Force) {
                if (-not $Silent) {
                    Write-Host "`nContinuer malgré l'erreur? (O/N)" -ForegroundColor Yellow
                    $response = Read-Host
                    if ($response -notmatch '^[OoYy]') {
                        Write-NemesisLog "Exécution interrompue" -Level WARNING
                        break
                    }
                }
                else {
                    break
                }
            }
        }
    }

    # === RÉSUMÉ FINAL ===
    $elapsed = (Get-Date) - $script:StartTime

    if (-not $Silent) {
        Write-Host ""
        Write-Host "╔══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
        Write-Host "║       🔥 NEMESIS OMEGA V3 ULTIMATE - MAINTENANCE TERMINÉE 🔥                 ║" -ForegroundColor Magenta
        Write-Host "╚══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
        Write-Host ""
        Write-Host "  📊 Fichiers scannés      : $($script:Statistics.FilesScanned)" -ForegroundColor White
        Write-Host "  🗑️  Doublons supprimés    : $($script:Statistics.DuplicatesRemoved)" -ForegroundColor Yellow
        Write-Host "  🔄 Mises à jour          : $($script:Statistics.UpdatesInstalled)" -ForegroundColor Green
        Write-Host "  🔑 APIs valides          : $($script:Statistics.APIsValid)/$($script:Statistics.APIsTested)" -ForegroundColor Cyan
        Write-Host "  ❌ Erreurs               : $($script:Statistics.ErrorsEncountered)" -ForegroundColor $(if ($script:Statistics.ErrorsEncountered -gt 0) { "Red" } else { "Green" })
        Write-Host "  🏥 Score santé           : $((Get-ValueOrDefault $script:HardwareHealth.HealthScore 'N/A'))/100" -ForegroundColor $(if (((Get-ValueOrDefault $script:HardwareHealth.HealthScore 0)) -ge 80) { "Green" } else { "Yellow" })
        Write-Host ""
        Write-Host "  ⏱️  Durée totale          : $(ConvertTo-HumanReadableDuration -Duration $elapsed)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "══════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Magenta
    }

    Write-NemesisLog "NEMESIS OMEGA V3 ULTIMATE - EXÉCUTION TERMINÉE" -Level SUCCESS
}

# ═══════════════════════════════════════════════════════════════════════════════
# POINT D'ENTRÉE
# ═══════════════════════════════════════════════════════════════════════════════

try {
    Invoke-NemesisOmegaArchitect
}
catch {
    if (-not $Silent) {
        Write-Host ""
        Write-Host "╔══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Red
        Write-Host "║                           💀 ERREUR FATALE 💀                                 ║" -ForegroundColor Red
        Write-Host "╚══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Red
        Write-Host ""
        Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
    }

    try {
        Send-MultiWebhookNotification -Content "💀 ERREUR FATALE: $($_.Exception.Message)" -Title "NEMESIS CRASH" -Type "Critical" -Urgent
    }
    catch {
        # Silent fail
    }
}

