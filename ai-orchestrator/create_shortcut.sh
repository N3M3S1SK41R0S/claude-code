#!/bin/bash
# ==============================================================================
# Create Desktop Shortcut for AI Orchestrator
# Run this script once to create a double-clickable shortcut on your desktop
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$HOME/Desktop"

# Detect OS and create appropriate shortcut
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - create an alias or copy the .command file
    SHORTCUT_PATH="$DESKTOP_DIR/AI Orchestrator.command"

    cat > "$SHORTCUT_PATH" << EOF
#!/bin/bash
cd "$SCRIPT_DIR"
./launch.sh
EOF
    chmod +x "$SHORTCUT_PATH"
    echo "✓ Created macOS shortcut: $SHORTCUT_PATH"
    echo "  Double-click 'AI Orchestrator.command' on your desktop to launch"

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - create a .desktop file
    SHORTCUT_PATH="$DESKTOP_DIR/ai-orchestrator.desktop"

    cat > "$SHORTCUT_PATH" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=AI Orchestrator
Comment=Multi-AI Collaboration System
Exec=gnome-terminal -- "$SCRIPT_DIR/launch.sh"
Icon=utilities-terminal
Terminal=false
Categories=Development;Utility;
EOF
    chmod +x "$SHORTCUT_PATH"

    # Also create for file managers that prefer executable scripts
    SCRIPT_SHORTCUT="$DESKTOP_DIR/AI-Orchestrator.sh"
    cat > "$SCRIPT_SHORTCUT" << EOF
#!/bin/bash
cd "$SCRIPT_DIR"
gnome-terminal -- ./launch.sh || xterm -e ./launch.sh || ./launch.sh
EOF
    chmod +x "$SCRIPT_SHORTCUT"

    echo "✓ Created Linux shortcuts:"
    echo "  - $SHORTCUT_PATH (for desktop environments)"
    echo "  - $SCRIPT_SHORTCUT (executable script)"
    echo "  Double-click either one to launch"

else
    echo "Unsupported OS. Please manually create a shortcut to:"
    echo "  $SCRIPT_DIR/launch.sh"
fi

echo ""
echo "Setup complete! You can now double-click the shortcut to launch AI Orchestrator."
