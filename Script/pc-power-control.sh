#!/bin/bash
#
# PC Power Control Script
# Cross-platform script for shutdown, restart, and other power operations
# Supports: Linux, macOS
#
# Usage: ./pc-power-control.sh [command] [options]
# Commands: shutdown, restart, sleep, hibernate, lock, logout, schedule, cancel
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DELAY=0
FORCE=false
MESSAGE=""
SCHEDULED_TIME=""

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Linux*)     OS="Linux";;
        Darwin*)    OS="macOS";;
        CYGWIN*)    OS="Cygwin";;
        MINGW*)     OS="MinGw";;
        *)          OS="Unknown";;
    esac
    echo "$OS"
}

# Print colored message
print_msg() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Print usage information
usage() {
    cat << EOF
PC Power Control Script
========================

Usage: $(basename "$0") <command> [options]

Commands:
  shutdown    - Shut down the computer
  restart     - Restart the computer
  sleep       - Put computer to sleep
  hibernate   - Hibernate the computer (if supported)
  lock        - Lock the screen
  logout      - Log out current user
  schedule    - Schedule a shutdown/restart
  cancel      - Cancel scheduled shutdown
  status      - Show system power status
  help        - Show this help message

Options:
  -d, --delay <seconds>    Delay before executing (default: 0)
  -f, --force              Force operation (skip confirmation)
  -m, --message <text>     Display message before operation
  -t, --time <HH:MM>       Schedule time (for schedule command)

Examples:
  $(basename "$0") shutdown                    # Immediate shutdown
  $(basename "$0") restart -d 60               # Restart in 60 seconds
  $(basename "$0") shutdown -f -m "Maintenance" # Force shutdown with message
  $(basename "$0") schedule shutdown -t 23:00  # Schedule shutdown at 11 PM
  $(basename "$0") cancel                      # Cancel scheduled operation

EOF
}

# Check if running as root (for Linux)
check_privileges() {
    if [[ "$OS" == "Linux" ]] && [[ $EUID -ne 0 ]]; then
        print_msg "$YELLOW" "Warning: Some operations may require root privileges."
        print_msg "$YELLOW" "Consider running with: sudo $(basename "$0") $*"
    fi
}

# Confirm action
confirm_action() {
    local action=$1
    if [[ "$FORCE" == false ]]; then
        read -p "Are you sure you want to $action? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_msg "$YELLOW" "Operation cancelled."
            exit 0
        fi
    fi
}

# Display countdown
countdown() {
    local seconds=$1
    if [[ $seconds -gt 0 ]]; then
        print_msg "$BLUE" "Operation will execute in $seconds seconds..."
        print_msg "$YELLOW" "Press Ctrl+C to cancel"
        while [[ $seconds -gt 0 ]]; do
            echo -ne "\r${YELLOW}Time remaining: ${seconds}s   ${NC}"
            sleep 1
            ((seconds--))
        done
        echo
    fi
}

# Shutdown function
do_shutdown() {
    local os=$(detect_os)

    if [[ -n "$MESSAGE" ]]; then
        print_msg "$BLUE" "Message: $MESSAGE"
    fi

    confirm_action "shut down the computer"
    countdown "$DELAY"

    print_msg "$RED" "Shutting down..."

    case "$os" in
        Linux)
            if command -v systemctl &> /dev/null; then
                sudo systemctl poweroff
            else
                sudo shutdown -h now
            fi
            ;;
        macOS)
            sudo shutdown -h now
            ;;
        *)
            print_msg "$RED" "Unsupported operating system: $os"
            exit 1
            ;;
    esac
}

# Restart function
do_restart() {
    local os=$(detect_os)

    if [[ -n "$MESSAGE" ]]; then
        print_msg "$BLUE" "Message: $MESSAGE"
    fi

    confirm_action "restart the computer"
    countdown "$DELAY"

    print_msg "$YELLOW" "Restarting..."

    case "$os" in
        Linux)
            if command -v systemctl &> /dev/null; then
                sudo systemctl reboot
            else
                sudo shutdown -r now
            fi
            ;;
        macOS)
            sudo shutdown -r now
            ;;
        *)
            print_msg "$RED" "Unsupported operating system: $os"
            exit 1
            ;;
    esac
}

# Sleep function
do_sleep() {
    local os=$(detect_os)

    confirm_action "put the computer to sleep"
    countdown "$DELAY"

    print_msg "$BLUE" "Going to sleep..."

    case "$os" in
        Linux)
            if command -v systemctl &> /dev/null; then
                sudo systemctl suspend
            elif [[ -f /sys/power/state ]]; then
                echo mem | sudo tee /sys/power/state
            else
                print_msg "$RED" "Sleep not supported on this system"
                exit 1
            fi
            ;;
        macOS)
            pmset sleepnow
            ;;
        *)
            print_msg "$RED" "Unsupported operating system: $os"
            exit 1
            ;;
    esac
}

# Hibernate function
do_hibernate() {
    local os=$(detect_os)

    confirm_action "hibernate the computer"
    countdown "$DELAY"

    print_msg "$BLUE" "Hibernating..."

    case "$os" in
        Linux)
            if command -v systemctl &> /dev/null; then
                sudo systemctl hibernate
            elif [[ -f /sys/power/state ]]; then
                echo disk | sudo tee /sys/power/state
            else
                print_msg "$RED" "Hibernate not supported on this system"
                exit 1
            fi
            ;;
        macOS)
            sudo pmset -a hibernatemode 25
            pmset sleepnow
            ;;
        *)
            print_msg "$RED" "Unsupported operating system: $os"
            exit 1
            ;;
    esac
}

# Lock screen function
do_lock() {
    local os=$(detect_os)

    print_msg "$BLUE" "Locking screen..."

    case "$os" in
        Linux)
            # Try various lock screen commands
            if command -v gnome-screensaver-command &> /dev/null; then
                gnome-screensaver-command -l
            elif command -v xdg-screensaver &> /dev/null; then
                xdg-screensaver lock
            elif command -v loginctl &> /dev/null; then
                loginctl lock-session
            elif command -v xscreensaver-command &> /dev/null; then
                xscreensaver-command -lock
            elif command -v i3lock &> /dev/null; then
                i3lock
            else
                print_msg "$RED" "No supported screen locker found"
                exit 1
            fi
            ;;
        macOS)
            /System/Library/CoreServices/Menu\ Extras/User.menu/Contents/Resources/CGSession -suspend
            ;;
        *)
            print_msg "$RED" "Unsupported operating system: $os"
            exit 1
            ;;
    esac
}

# Logout function
do_logout() {
    local os=$(detect_os)

    confirm_action "log out"
    countdown "$DELAY"

    print_msg "$YELLOW" "Logging out..."

    case "$os" in
        Linux)
            if command -v gnome-session-quit &> /dev/null; then
                gnome-session-quit --logout --no-prompt
            elif command -v loginctl &> /dev/null; then
                loginctl terminate-user "$USER"
            elif command -v pkill &> /dev/null; then
                pkill -KILL -u "$USER"
            else
                print_msg "$RED" "No supported logout method found"
                exit 1
            fi
            ;;
        macOS)
            osascript -e 'tell application "System Events" to log out'
            ;;
        *)
            print_msg "$RED" "Unsupported operating system: $os"
            exit 1
            ;;
    esac
}

# Schedule shutdown/restart
do_schedule() {
    local action=$1
    local os=$(detect_os)

    if [[ -z "$SCHEDULED_TIME" ]]; then
        print_msg "$RED" "Error: Please specify time with -t option (HH:MM format)"
        exit 1
    fi

    print_msg "$BLUE" "Scheduling $action at $SCHEDULED_TIME..."

    case "$os" in
        Linux)
            case "$action" in
                shutdown)
                    sudo shutdown -h "$SCHEDULED_TIME"
                    ;;
                restart)
                    sudo shutdown -r "$SCHEDULED_TIME"
                    ;;
                *)
                    print_msg "$RED" "Can only schedule shutdown or restart"
                    exit 1
                    ;;
            esac
            ;;
        macOS)
            # Convert HH:MM to timestamp
            local target_time=$(date -j -f "%H:%M" "$SCHEDULED_TIME" "+%m%d%H%M")
            case "$action" in
                shutdown)
                    sudo shutdown -h "$target_time"
                    ;;
                restart)
                    sudo shutdown -r "$target_time"
                    ;;
                *)
                    print_msg "$RED" "Can only schedule shutdown or restart"
                    exit 1
                    ;;
            esac
            ;;
        *)
            print_msg "$RED" "Unsupported operating system: $os"
            exit 1
            ;;
    esac

    print_msg "$GREEN" "Scheduled $action for $SCHEDULED_TIME"
}

# Cancel scheduled operation
do_cancel() {
    local os=$(detect_os)

    print_msg "$BLUE" "Cancelling scheduled operation..."

    case "$os" in
        Linux|macOS)
            sudo shutdown -c 2>/dev/null || print_msg "$YELLOW" "No scheduled shutdown to cancel"
            ;;
        *)
            print_msg "$RED" "Unsupported operating system: $os"
            exit 1
            ;;
    esac

    print_msg "$GREEN" "Scheduled operation cancelled"
}

# Show system status
do_status() {
    local os=$(detect_os)

    print_msg "$BLUE" "System Power Status"
    echo "===================="
    echo "Operating System: $os"
    echo "Hostname: $(hostname)"
    echo "Current User: $USER"
    echo "Uptime: $(uptime -p 2>/dev/null || uptime)"

    case "$os" in
        Linux)
            if command -v systemctl &> /dev/null; then
                echo ""
                echo "Power State:"
                cat /sys/power/state 2>/dev/null || echo "  Not available"
            fi

            # Check for scheduled shutdown
            if [[ -f /run/systemd/shutdown/scheduled ]]; then
                echo ""
                echo "Scheduled Shutdown:"
                cat /run/systemd/shutdown/scheduled
            fi
            ;;
        macOS)
            echo ""
            echo "Power Settings:"
            pmset -g 2>/dev/null || echo "  Not available"
            ;;
    esac
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--delay)
                DELAY="$2"
                shift 2
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -m|--message)
                MESSAGE="$2"
                shift 2
                ;;
            -t|--time)
                SCHEDULED_TIME="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                break
                ;;
        esac
    done

    # Return remaining arguments
    echo "$@"
}

# Main function
main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 1
    fi

    local command=$1
    shift

    # Parse remaining options
    local remaining_args
    remaining_args=$(parse_args "$@")

    OS=$(detect_os)
    check_privileges "$command"

    case "$command" in
        shutdown)
            do_shutdown
            ;;
        restart|reboot)
            do_restart
            ;;
        sleep|suspend)
            do_sleep
            ;;
        hibernate)
            do_hibernate
            ;;
        lock)
            do_lock
            ;;
        logout|logoff)
            do_logout
            ;;
        schedule)
            # Get action from remaining args
            local action=$(echo "$remaining_args" | awk '{print $1}')
            do_schedule "$action"
            ;;
        cancel)
            do_cancel
            ;;
        status)
            do_status
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            print_msg "$RED" "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
