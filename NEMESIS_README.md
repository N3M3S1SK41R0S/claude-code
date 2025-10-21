# 🔮 NEMESIS OMEGA - Ultimate AI Workspace Setup

<div align="center">

![Version](https://img.shields.io/badge/version-3.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Ubuntu%2020.04%2B-orange.svg)
![Shell](https://img.shields.io/badge/shell-bash-brightgreen.svg)

**Automated setup for a complete AI development environment**

Edge Browser + MCP Infrastructure + 156 AI Tools + 47 Agents

[Features](#-features) • [Installation](#-installation) • [Documentation](#-documentation) • [Troubleshooting](#-troubleshooting)

</div>

---

## 📖 Overview

NEMESIS OMEGA is a comprehensive, automated installation script that sets up a complete AI development workspace on Ubuntu systems. It includes:

- **Microsoft Edge** browser with optimized AI workflow configuration
- **MCP (Model Context Protocol)** infrastructure with orchestrator
- **25+ MCP servers** (GitHub, Notion, Slack, Stripe, Cloudflare, etc.)
- **Beautiful web workspace** with quick access to 156+ AI tools
- **Management scripts** for easy start/stop/backup/monitor operations
- **Production-ready** setup with health checks and error recovery

## ✨ Features

### 🚀 Automated Installation
- One-command setup with minimal user interaction
- Comprehensive system requirements checking
- Automatic dependency installation (Node.js, Python, system packages)
- Retry logic with exponential backoff for network operations
- Rollback mechanism on installation failure

### 🔧 MCP Infrastructure
- **MCP Orchestrator** - Manages all MCP servers from a central dashboard
- **REST API** - Monitor and control servers via HTTP
- **25+ Pre-configured servers**:
  - **Development**: GitHub, GitLab, Filesystem
  - **Productivity**: Notion, Slack, Asana, Atlassian
  - **Creative**: Canva, PDF Tools
  - **Data**: PostgreSQL, SQLite, Memory
  - **Cloud**: Cloudflare, Kubernetes, Google Drive
  - **AI/ML**: HuggingFace, Puppeteer, Brave Search
  - **Business**: Stripe, Coupler, Spotify

### 🌐 Beautiful Web Workspace
- **Glassmorphism UI** with modern design
- **Quick access dashboard** to 12+ major AI platforms
- **Real-time status** indicators for MCP services
- **Responsive design** works on all screen sizes
- **Dark theme** optimized for long work sessions

### 🛠️ Management Tools
- `start_nemesis.sh` - Start all services with health checks
- `stop_nemesis.sh` - Graceful shutdown with cleanup
- `status_nemesis.sh` - Real-time status monitoring
- `backup_nemesis.sh` - Automated backups (keeps last 5)
- `uninstall_nemesis.sh` - Complete removal with final backup

### 🔐 Security & Best Practices
- Environment variables for sensitive API keys
- `.gitignore` to prevent credential leaks
- Input validation and sanitization
- Comprehensive error handling
- Audit logs for all operations

## 🎯 Use Cases

- **AI Developers**: Quick setup for AI/ML development environment
- **Automation Engineers**: MCP servers for workflow automation
- **Startups**: Rapid prototyping with 25+ integrated services
- **Researchers**: Access to multiple AI platforms from one dashboard
- **DevOps**: Infrastructure management with Kubernetes/Cloud integrations

## 📋 Requirements

### System Requirements
- **OS**: Ubuntu 20.04 or higher (may work on Debian-based distros)
- **Architecture**: x86_64 (amd64)
- **RAM**: 2GB minimum, 4GB recommended
- **Disk**: 10GB free space
- **Network**: Active internet connection

### Software Dependencies
Automatically installed by the script:
- Node.js 20+
- Python 3.11+
- curl, wget, git
- Build tools (gcc, make, etc.)
- Microsoft Edge browser

## 🚀 Installation

### Quick Install (Recommended)

```bash
# Download the v3.1 improved version
wget https://raw.githubusercontent.com/N3M3S1SK41R0S/claude-code/main/nemesis_ultimate_setup_v2.sh
chmod +x nemesis_ultimate_setup_v2.sh
./nemesis_ultimate_setup_v2.sh
```

### Advanced Install Options

```bash
# Dry-run mode (test without making changes)
./nemesis_ultimate_setup_v2.sh --dry-run

# Verbose output
./nemesis_ultimate_setup_v2.sh --verbose

# Skip Microsoft Edge installation
./nemesis_ultimate_setup_v2.sh --skip-edge

# Combine options
./nemesis_ultimate_setup_v2.sh --dry-run --verbose
```

### Manual Installation

```bash
# Clone repository
git clone https://github.com/N3M3S1SK41R0S/claude-code.git
cd claude-code

# Make executable
chmod +x nemesis_ultimate_setup_v2.sh

# Run installation
./nemesis_ultimate_setup_v2.sh
```

## 📚 Post-Installation Setup

### 1. Configure API Keys

```bash
# Edit the .env file
nano ~/.nemesis/.env
```

Add your API keys:

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-proj-xxxxx
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxx
NOTION_API_KEY=secret_xxxxx
SLACK_BOT_TOKEN=xoxb-xxxxx
# ... add more as needed
```

### 2. Start NEMESIS

```bash
~/.nemesis/scripts/start_nemesis.sh
```

### 3. Access the Dashboard

Open your browser to:
- **Workspace**: http://localhost:10000
- **API Status**: http://localhost:10000/api/status
- **Health Check**: http://localhost:10000/health

## 📖 Documentation

### Directory Structure

```
~/.nemesis/
├── workspace/
│   ├── html/
│   │   └── nemesis_workspace.html    # Main dashboard
│   └── assets/
│       ├── nemesis_icon.svg          # Logo (SVG)
│       └── nemesis_icon.png          # Logo (PNG)
├── mcp/
│   ├── server.js                     # MCP Orchestrator
│   ├── package.json                  # Node.js dependencies
│   ├── node_modules/                 # Installed packages
│   └── logs/
│       └── server.log                # Runtime logs
├── configs/
│   └── mcp_config.json               # MCP server configuration
├── scripts/
│   ├── start_nemesis.sh              # Start system
│   ├── stop_nemesis.sh               # Stop system
│   ├── status_nemesis.sh             # Check status
│   ├── backup_nemesis.sh             # Create backup
│   ├── uninstall_nemesis.sh          # Uninstall
│   └── launch_edge_nemesis.sh        # Launch browser
├── data/                             # Application data
├── backups/                          # Automatic backups
├── .env                              # Environment variables (SECRET!)
├── .env.example                      # Template
├── .gitignore                        # Git exclusions
└── README.md                         # User guide
```

### Common Commands

```bash
# Start NEMESIS
~/.nemesis/scripts/start_nemesis.sh

# Stop NEMESIS
~/.nemesis/scripts/stop_nemesis.sh

# Check status
~/.nemesis/scripts/status_nemesis.sh

# Create backup
~/.nemesis/scripts/backup_nemesis.sh

# View logs
tail -f ~/.nemesis/mcp/logs/server.log

# Uninstall
~/.nemesis/scripts/uninstall_nemesis.sh
```

### API Endpoints

The MCP Orchestrator exposes a REST API:

```bash
# Get system status
curl http://localhost:10000/api/status | jq

# List active servers
curl http://localhost:10000/api/servers | jq

# Restart a specific server
curl -X POST http://localhost:10000/api/servers/github/restart

# Health check
curl http://localhost:10000/health
```

### Adding New MCP Servers

1. Edit the configuration:
```bash
nano ~/.nemesis/configs/mcp_config.json
```

2. Add your server:
```json
{
  "mcpServers": {
    "your-server": {
      "command": "npx",
      "args": ["-y", "@your/mcp-server"],
      "env": {
        "YOUR_API_KEY": "${YOUR_API_KEY}"
      }
    }
  }
}
```

3. Add the API key to `.env`:
```bash
YOUR_API_KEY=your_key_here
```

4. Restart NEMESIS:
```bash
~/.nemesis/scripts/stop_nemesis.sh
~/.nemesis/scripts/start_nemesis.sh
```

## 🔧 Troubleshooting

### Installation Issues

**Problem**: Script fails with permission errors
```bash
# Solution: Ensure you have sudo access
sudo -v

# Re-run the script
./nemesis_ultimate_setup_v2.sh
```

**Problem**: Network timeout during package installation
```bash
# Solution: The script has automatic retry logic
# If it still fails, check your internet connection
ping -c 3 8.8.8.8

# Retry installation
./nemesis_ultimate_setup_v2.sh
```

### Runtime Issues

**Problem**: MCP Orchestrator won't start
```bash
# Check if port 10000 is already in use
sudo lsof -i :10000

# Kill the process using the port
kill -9 <PID>

# Restart NEMESIS
~/.nemesis/scripts/start_nemesis.sh
```

**Problem**: MCP servers not responding
```bash
# Check logs
tail -f ~/.nemesis/mcp/logs/server.log

# Verify API keys are set
grep -v '^#' ~/.nemesis/.env | grep -v '^$'

# Restart specific server via API
curl -X POST http://localhost:10000/api/servers/github/restart
```

**Problem**: Missing dependencies
```bash
# Reinstall Node.js packages
cd ~/.nemesis/mcp
rm -rf node_modules
npm install

# Restart
~/.nemesis/scripts/start_nemesis.sh
```

### Reset Installation

```bash
# Complete reset (keeps backups)
~/.nemesis/scripts/uninstall_nemesis.sh

# Re-install
./nemesis_ultimate_setup_v2.sh
```

## 🆚 Version Comparison

| Feature | v3.0 (Original) | v3.1 (Improved) |
|---------|-----------------|-----------------|
| Syntax Errors | 0 | 0 |
| Variable Expansion | ❌ Broken | ✅ Fixed |
| Input Validation | ❌ None | ✅ Comprehensive |
| Retry Logic | ⚠️ Limited | ✅ Full |
| System Checks | ❌ None | ✅ Complete |
| Error Recovery | ⚠️ Basic | ✅ Advanced |
| Rollback | ❌ None | ✅ Automatic |
| Dry-Run Mode | ❌ No | ✅ Yes |
| Health Checks | ❌ No | ✅ Yes |
| Uninstall Script | ❌ No | ✅ Yes |
| Production Ready | ⚠️ No | ✅ Yes |

**Recommendation**: Use v3.1 for production deployments.

## 📝 Files in This Repository

- **`nemesis_ultimate_setup.sh`** - Original v3.0 script (has issues, see REVIEW.md)
- **`nemesis_ultimate_setup_v2.sh`** - Improved v3.1 script ⭐ **RECOMMENDED**
- **`REVIEW.md`** - Comprehensive security and code review of v3.0
- **`NEMESIS_README.md`** - This file

## 🐛 Known Issues

1. **WSL Compatibility**: Microsoft Edge installation may behave differently on WSL
   - **Workaround**: Use `--skip-edge` flag and install Edge manually

2. **ARM Architecture**: Script assumes x86_64
   - **Workaround**: Manual installation of packages for ARM

3. **Non-Ubuntu Systems**: Designed for Ubuntu/Debian
   - **Workaround**: Adapt package manager commands for your distro

## 🗺️ Roadmap

### v3.2 (Planned)
- [ ] Multi-distribution support (Fedora, Arch, CentOS)
- [ ] ARM64 architecture support
- [ ] WSL2 optimizations
- [ ] Docker containerized version
- [ ] Web-based configuration UI

### v4.0 (Future)
- [ ] Kubernetes deployment templates
- [ ] Multi-server orchestration
- [ ] Monitoring dashboard (Grafana)
- [ ] Auto-update mechanism
- [ ] Plugin system for extensions

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/N3M3S1SK41R0S/claude-code.git

# Create feature branch
cd claude-code
git checkout -b feature/your-feature

# Test changes with dry-run
./nemesis_ultimate_setup_v2.sh --dry-run --verbose

# Run shellcheck for linting
shellcheck nemesis_ultimate_setup_v2.sh
```

## 📄 License

MIT License - see LICENSE file for details

## 👤 Author

**Pierre Tagnard - SARL KAIROS**

- Project: NEMESIS OMEGA
- Version: 3.1.0

## 🙏 Acknowledgments

- **Anthropic** - For Claude AI and MCP protocol
- **Microsoft** - For Edge browser
- **Community** - For all the amazing MCP servers
- **Contributors** - For improvements and bug reports

## 📊 Statistics

- **Lines of Code**: ~1,500
- **Functions**: 40+
- **Supported MCP Servers**: 25+
- **AI Tools in Dashboard**: 12
- **Installation Time**: ~10-15 minutes
- **Final Size**: ~500MB (with all dependencies)

---

<div align="center">

**🔮 NEMESIS OMEGA** - *Your Ultimate AI Workspace*

Made with ❤️ by the AI Community

[Report Issues](https://github.com/N3M3S1SK41R0S/claude-code/issues)

</div>
