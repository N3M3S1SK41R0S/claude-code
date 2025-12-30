# Scripts Directory

Utility scripts for various operations.

## PC Power Control Scripts

Cross-platform scripts for managing PC power operations (shutdown, restart, sleep, hibernate, lock, logout).

### Available Scripts

| Script | Platform | Description |
|--------|----------|-------------|
| `pc-power-control.sh` | Linux/macOS | Bash script for Unix-based systems |
| `pc-power-control.ps1` | Windows | PowerShell script for Windows 10/11/Server |

### Features

- **Shutdown** - Power off the computer
- **Restart** - Reboot the computer
- **Sleep** - Suspend to RAM
- **Hibernate** - Suspend to disk
- **Lock** - Lock the screen
- **Logout** - Log out current user
- **Schedule** - Schedule shutdown/restart for a specific time
- **Cancel** - Cancel scheduled operations
- **Status** - View system power status

### Usage

#### Linux/macOS (Bash)

```bash
# Make executable (first time only)
chmod +x pc-power-control.sh

# Show help
./pc-power-control.sh help

# Immediate shutdown
./pc-power-control.sh shutdown

# Restart with 60 second delay
./pc-power-control.sh restart -d 60

# Force shutdown with message
./pc-power-control.sh shutdown -f -m "System maintenance"

# Schedule shutdown at 11 PM
./pc-power-control.sh schedule shutdown -t 23:00

# Cancel scheduled operation
./pc-power-control.sh cancel

# Check system status
./pc-power-control.sh status
```

#### Windows (PowerShell)

```powershell
# Show help
.\pc-power-control.ps1 help

# Immediate shutdown
.\pc-power-control.ps1 shutdown

# Restart with 60 second delay
.\pc-power-control.ps1 restart -Delay 60

# Force shutdown with message
.\pc-power-control.ps1 shutdown -Force -Message "System maintenance"

# Schedule shutdown at 11 PM
.\pc-power-control.ps1 schedule shutdown -ScheduledTime "23:00"

# Cancel scheduled operation
.\pc-power-control.ps1 cancel

# Check system status
.\pc-power-control.ps1 status
```

### Options

| Option | Bash | PowerShell | Description |
|--------|------|------------|-------------|
| Delay | `-d`, `--delay` | `-Delay` | Seconds to wait before executing |
| Force | `-f`, `--force` | `-Force` | Skip confirmation prompts |
| Message | `-m`, `--message` | `-Message` | Display message before operation |
| Time | `-t`, `--time` | `-ScheduledTime` | Schedule time (HH:mm format) |

### Requirements

- **Linux**: `systemctl` (systemd) or traditional `shutdown` command
- **macOS**: Built-in system commands
- **Windows**: PowerShell 5.1 or later, some features require Administrator privileges

### Notes

- Most power operations require elevated privileges (sudo on Linux/macOS, Administrator on Windows)
- Sleep and hibernate availability depends on hardware and system configuration
- Scheduled operations are cancelled if the system is restarted before the scheduled time
