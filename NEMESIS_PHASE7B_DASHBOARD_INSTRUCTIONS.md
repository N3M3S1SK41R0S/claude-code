# INSTRUCTIONS ANTIGRAVITY - PHASE 7B: DASHBOARD NEMESIS PREMIUM

## Dashboard avec effet CRT et interface Streamlit

**Destination:** `C:\Users\pierr\NEMESIS_SINGULARITY\`

---

## ÉTAPE 1: Créer le Dashboard Streamlit Premium

```powershell
# Créer le dossier dashboard
New-Item -ItemType Directory -Force -Path "C:\Users\pierr\NEMESIS_SINGULARITY\dashboard"

@"
"""
NEMESIS OMEGA UNIFIED v9.0 - Premium Dashboard
Effet CRT + Interface Streamlit
"""
import streamlit as st
import requests
import json
from datetime import datetime
import time

# Configuration
st.set_page_config(
    page_title="NEMESIS OMEGA UNIFIED",
    page_icon="🔮",
    layout="wide",
    initial_sidebar_state="expanded"
)

# API Base URL
API_URL = "http://localhost:8000"

# CSS avec effet CRT
CRT_CSS = '''
<style>
/* Font import */
@import url('https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap');

/* Global CRT effect */
body {
    background-color: #0a0a0a;
    color: #00ff00;
    font-family: 'Share Tech Mono', monospace;
}

.stApp {
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
                linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
    background-size: 100% 2px, 3px 100%;
    background-color: #0a0a0a;
}

/* Scanlines effect */
.stApp::before {
    content: "";
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.15),
        rgba(0, 0, 0, 0.15) 1px,
        transparent 1px,
        transparent 2px
    );
    pointer-events: none;
    z-index: 1000;
}

/* Flicker animation */
@keyframes flicker {
    0% { opacity: 0.97; }
    5% { opacity: 0.95; }
    10% { opacity: 0.97; }
    15% { opacity: 0.94; }
    20% { opacity: 0.98; }
    50% { opacity: 0.95; }
    80% { opacity: 0.96; }
    90% { opacity: 0.94; }
    100% { opacity: 0.98; }
}

.stApp {
    animation: flicker 0.15s infinite;
}

/* Green glow text */
h1, h2, h3, h4, h5, h6 {
    color: #00ff00 !important;
    text-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 30px #00ff00;
    font-family: 'VT323', monospace !important;
}

/* Sidebar styling */
.css-1d391kg, [data-testid="stSidebar"] {
    background-color: #0d0d0d !important;
    border-right: 2px solid #00ff00;
}

/* Input fields */
.stTextInput input, .stTextArea textarea {
    background-color: #1a1a1a !important;
    color: #00ff00 !important;
    border: 1px solid #00ff00 !important;
    font-family: 'Share Tech Mono', monospace !important;
}

/* Buttons */
.stButton button {
    background-color: #0d0d0d !important;
    color: #00ff00 !important;
    border: 2px solid #00ff00 !important;
    font-family: 'VT323', monospace !important;
    text-transform: uppercase;
    letter-spacing: 2px;
    transition: all 0.3s ease;
}

.stButton button:hover {
    background-color: #00ff00 !important;
    color: #0d0d0d !important;
    box-shadow: 0 0 20px #00ff00;
}

/* Cards/Containers */
.element-container {
    background-color: rgba(0, 255, 0, 0.05);
    border: 1px solid rgba(0, 255, 0, 0.3);
    border-radius: 5px;
    padding: 10px;
    margin: 5px 0;
}

/* Metrics */
[data-testid="stMetricValue"] {
    color: #00ff00 !important;
    text-shadow: 0 0 10px #00ff00;
    font-family: 'VT323', monospace !important;
}

/* Status indicators */
.status-ok {
    color: #00ff00;
    text-shadow: 0 0 5px #00ff00;
}

.status-warn {
    color: #ffff00;
    text-shadow: 0 0 5px #ffff00;
}

.status-error {
    color: #ff0000;
    text-shadow: 0 0 5px #ff0000;
}

/* Brother cards */
.brother-card {
    background: linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%);
    border: 1px solid #00ff00;
    border-radius: 10px;
    padding: 15px;
    margin: 10px 0;
    box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
}

.brother-card:hover {
    box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
    transform: translateY(-2px);
    transition: all 0.3s ease;
}

/* Mode indicators */
.mode-berserker {
    color: #ff0000 !important;
    text-shadow: 0 0 10px #ff0000;
    border-color: #ff0000 !important;
}

.mode-oracle {
    color: #9b59b6 !important;
    text-shadow: 0 0 10px #9b59b6;
    border-color: #9b59b6 !important;
}

.mode-shadow {
    color: #2c3e50 !important;
    text-shadow: 0 0 10px #2c3e50;
    border-color: #2c3e50 !important;
}

/* Terminal output */
.terminal-output {
    background-color: #0a0a0a;
    border: 2px solid #00ff00;
    border-radius: 5px;
    padding: 15px;
    font-family: 'Share Tech Mono', monospace;
    color: #00ff00;
    white-space: pre-wrap;
    overflow-x: auto;
}

/* Glitch effect for title */
@keyframes glitch {
    0% { transform: translate(0); }
    20% { transform: translate(-2px, 2px); }
    40% { transform: translate(-2px, -2px); }
    60% { transform: translate(2px, 2px); }
    80% { transform: translate(2px, -2px); }
    100% { transform: translate(0); }
}

.glitch-text {
    animation: glitch 0.3s infinite;
}

/* Pulse animation for active elements */
@keyframes pulse {
    0% { box-shadow: 0 0 5px #00ff00; }
    50% { box-shadow: 0 0 20px #00ff00; }
    100% { box-shadow: 0 0 5px #00ff00; }
}

.pulse {
    animation: pulse 2s infinite;
}
</style>
'''

def api_call(endpoint, method="GET", data=None):
    """Make API call to NEMESIS backend"""
    try:
        url = f"{API_URL}{endpoint}"
        if method == "GET":
            response = requests.get(url, timeout=10)
        else:
            response = requests.post(url, json=data, timeout=30)
        return response.json()
    except requests.exceptions.ConnectionError:
        return {"error": "Cannot connect to NEMESIS backend"}
    except Exception as e:
        return {"error": str(e)}

def render_header():
    """Render the main header with CRT effect"""
    st.markdown(CRT_CSS, unsafe_allow_html=True)

    col1, col2, col3 = st.columns([1, 3, 1])
    with col2:
        st.markdown("""
        <div style="text-align: center; padding: 20px;">
            <h1 style="font-size: 3em; letter-spacing: 10px;">
                ⚡ NEMESIS ⚡
            </h1>
            <h2 style="font-size: 1.5em; color: #00cc00;">
                OMEGA UNIFIED v9.0
            </h2>
            <p style="color: #008800; font-size: 0.9em;">
                [ THE ULTIMATE AI PILOTING CONSOLE ]
            </p>
        </div>
        """, unsafe_allow_html=True)

def render_status_bar():
    """Render the system status bar"""
    status = api_call("/status")

    if "error" in status:
        st.error(f"⚠️ SYSTEM OFFLINE: {status['error']}")
        return

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        mode = status.get("mode", "UNKNOWN").upper()
        mode_colors = {"BERSERKER": "🔴", "ORACLE": "🟣", "SHADOW": "⚫"}
        st.metric("MODE", f"{mode_colors.get(mode, '🟢')} {mode}")

    with col2:
        brothers = status.get("brothers", {})
        active = sum(1 for b in brothers.values() if b.get("active", False))
        st.metric("BROTHERS ACTIVE", f"{active}/7")

    with col3:
        st.metric("SOVEREIGN", status.get("sovereign", "N/A"))

    with col4:
        st.metric("VERSION", status.get("version", "N/A"))

def render_brothers_panel():
    """Render the 7 Brothers status panel"""
    st.markdown("### 👥 LES 7 FRÈRES FONDATEURS")

    brothers_data = api_call("/brothers")

    if "error" in brothers_data:
        st.error(brothers_data["error"])
        return

    brothers = brothers_data.get("brothers", {})

    # Create a grid of brother cards
    cols = st.columns(4)

    brother_info = {
        "ZAPPA": {"icon": "🎯", "role": "Compilateur de Prompts"},
        "DAEDALUS": {"icon": "🏗️", "role": "Architecte de Code"},
        "SYNCORIA": {"icon": "🌐", "role": "Orchestrateur d'Essaim"},
        "EXODIA": {"icon": "🧠", "role": "Maître de la Mémoire"},
        "KYRON": {"icon": "⏰", "role": "Gardien du Temps"},
        "LOKI": {"icon": "🎭", "role": "Testeur Chaotique"},
        "RITUEL_MASTER": {"icon": "📜", "role": "Maître du Protocole"}
    }

    for idx, (name, data) in enumerate(brothers.items()):
        with cols[idx % 4]:
            info = brother_info.get(name, {"icon": "❓", "role": "Unknown"})
            active = data.get("active", False)
            status_icon = "🟢" if active else "🔴"

            st.markdown(f"""
            <div class="brother-card">
                <h4>{info['icon']} {name}</h4>
                <p><small>{info['role']}</small></p>
                <p>Status: {status_icon} {'ACTIVE' if active else 'INACTIVE'}</p>
                <p><small>ID: #{data.get('id', 'N/A')}</small></p>
            </div>
            """, unsafe_allow_html=True)

def render_chat_interface():
    """Render the main chat interface"""
    st.markdown("### 💬 TERMINAL NEMESIS")

    # Mode selector
    col1, col2 = st.columns([3, 1])

    with col2:
        mode = st.selectbox(
            "MODE",
            ["ORACLE", "BERSERKER", "SHADOW"],
            index=0
        )
        use_rituel = st.checkbox("Use R.I.T.U.E.L.", value=True)

    with col1:
        user_input = st.text_area(
            "COMMAND INPUT",
            height=100,
            placeholder="Enter your command here..."
        )

    if st.button("⚡ EXECUTE", use_container_width=True):
        if user_input:
            with st.spinner(f"Processing in {mode} mode..."):
                response = api_call("/chat", method="POST", data={
                    "message": user_input,
                    "mode": mode,
                    "use_rituel": use_rituel
                })

                st.markdown("#### 📤 RESPONSE")

                if "error" in response:
                    st.error(response["error"])
                else:
                    # Display ritual phases if available
                    if "phases" in response:
                        with st.expander("🔮 R.I.T.U.E.L. Phases"):
                            for phase, data in response["phases"].items():
                                st.markdown(f"**Phase {phase}:** {data}")

                    # Main response
                    st.markdown(f"""
                    <div class="terminal-output">
{response.get('final_response', response.get('response', str(response)))}
                    </div>
                    """, unsafe_allow_html=True)

def render_memory_panel():
    """Render the memory (EXODIA) panel"""
    st.markdown("### 🧠 MÉMOIRE VECTORIELLE (EXODIA)")

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("#### Rechercher")
        query = st.text_input("Query", placeholder="Search memories...")
        if st.button("🔍 RECALL"):
            if query:
                result = api_call(f"/memory/recall?query={query}&limit=5")
                if "memories" in result:
                    for mem in result["memories"]:
                        st.markdown(f"""
                        <div class="brother-card">
                            <p><strong>Score:</strong> {mem.get('score', 0):.2f}</p>
                            <p>{mem.get('content', '')[:200]}...</p>
                            <small>Type: {mem.get('type', 'unknown')}</small>
                        </div>
                        """, unsafe_allow_html=True)

    with col2:
        st.markdown("#### Statistics")
        stats = api_call("/memory/stats")
        if "error" not in stats:
            st.json(stats)

def render_tasks_panel():
    """Render the tasks (KYRON) panel"""
    st.markdown("### ⏰ CHRONOS GTD (KYRON)")

    tab1, tab2 = st.tabs(["Next Actions", "Weekly Review"])

    with tab1:
        actions = api_call("/tasks/next?limit=5")
        if "next_actions" in actions:
            for action in actions["next_actions"]:
                priority_colors = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢"}
                st.markdown(f"""
                {priority_colors.get(action['priority'], '⚪')} **{action['title']}**
                <small>[{action['id']}]</small>
                """, unsafe_allow_html=True)

    with tab2:
        if st.button("📊 Generate Weekly Review"):
            review = api_call("/tasks/weekly-review")
            st.json(review)

def render_testing_panel():
    """Render the testing (LOKI) panel"""
    st.markdown("### 🎭 CHAOS TESTING (LOKI)")

    col1, col2 = st.columns(2)

    with col1:
        scenario = st.selectbox(
            "Test Scenario",
            ["smoke", "regression", "stress", "chaos_monkey"]
        )

        if st.button("🎲 RUN SCENARIO"):
            with st.spinner(f"Running {scenario} tests..."):
                result = api_call(f"/test/scenario/{scenario}", method="POST")
                st.json(result)

    with col2:
        st.markdown("#### Test Report")
        if st.button("📊 GET REPORT"):
            report = api_call("/test/report")
            st.json(report)

def render_rituel_panel():
    """Render the R.I.T.U.E.L. protocol panel"""
    st.markdown("### 📜 PROTOCOLE R.I.T.U.E.L.")

    protocol = api_call("/rituel/protocol")

    if "error" not in protocol:
        st.markdown("""
        **R.I.T.U.E.L.** = Réception → Invocation → Tissage → Unification → Épreuve → Lancement
        """)

        phases = protocol.get("phases", {})

        for phase_key, phase_data in phases.items():
            with st.expander(f"Phase {phase_key}: {phase_data['name']}"):
                st.markdown(f"**Description:** {phase_data['description']}")
                st.markdown(f"**Agents:** {', '.join(phase_data['agents'])}")

def render_sovereign_panel():
    """Render the sovereign command panel"""
    st.markdown("### 👑 COMMANDES SOUVERAINES")

    st.warning("⚠️ Zone réservée au Souverain (N1)")

    with st.expander("🔐 Accès Souverain"):
        code = st.text_input("Code Souverain", type="password")
        command = st.selectbox(
            "Commande",
            ["status", "set_mode", "activate_brother", "emergency_stop", "reset"]
        )

        params = {}
        if command == "set_mode":
            params["mode"] = st.selectbox("Mode", ["oracle", "berserker", "shadow"])
        elif command == "activate_brother":
            params["name"] = st.text_input("Brother Name")
            params["key"] = st.text_input("Activation Key")

        if st.button("⚡ EXECUTE SOVEREIGN COMMAND"):
            if code:
                result = api_call("/sovereign/command", method="POST", data={
                    "code": code,
                    "command": command,
                    "params": params
                })
                st.json(result)

def main():
    """Main dashboard function"""
    render_header()
    render_status_bar()

    st.markdown("---")

    # Main tabs
    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
        "💬 Terminal",
        "👥 Brothers",
        "🧠 Memory",
        "⏰ Tasks",
        "🎭 Testing",
        "📜 R.I.T.U.E.L."
    ])

    with tab1:
        render_chat_interface()

    with tab2:
        render_brothers_panel()

    with tab3:
        render_memory_panel()

    with tab4:
        render_tasks_panel()

    with tab5:
        render_testing_panel()

    with tab6:
        render_rituel_panel()

    # Sidebar
    with st.sidebar:
        st.markdown("### ⚙️ CONTROLS")

        render_sovereign_panel()

        st.markdown("---")

        st.markdown("### 📊 SYSTEM INFO")
        st.markdown(f"**Time:** {datetime.now().strftime('%H:%M:%S')}")
        st.markdown(f"**API:** {API_URL}")

        if st.button("🔄 REFRESH"):
            st.rerun()

if __name__ == "__main__":
    main()
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\dashboard\app.py" -Encoding UTF8

Write-Host "Dashboard Streamlit créé avec effet CRT" -ForegroundColor Green
```

---

## ÉTAPE 2: Créer la version HTML standalone

```powershell
@"
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NEMESIS OMEGA UNIFIED v9.0</title>
    <link href="https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background-color: #0a0a0a;
            color: #00ff00;
            font-family: 'Share Tech Mono', monospace;
            min-height: 100vh;
            overflow-x: hidden;
        }

        /* CRT Effect */
        body::before {
            content: "";
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: repeating-linear-gradient(
                0deg,
                rgba(0, 0, 0, 0.15),
                rgba(0, 0, 0, 0.15) 1px,
                transparent 1px,
                transparent 2px
            );
            pointer-events: none;
            z-index: 1000;
        }

        body::after {
            content: "";
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(
                rgba(18, 16, 16, 0) 50%,
                rgba(0, 0, 0, 0.25) 50%
            ),
            linear-gradient(
                90deg,
                rgba(255, 0, 0, 0.06),
                rgba(0, 255, 0, 0.02),
                rgba(0, 0, 255, 0.06)
            );
            background-size: 100% 2px, 3px 100%;
            pointer-events: none;
            z-index: 999;
        }

        @keyframes flicker {
            0% { opacity: 0.97; }
            5% { opacity: 0.95; }
            10% { opacity: 0.97; }
            15% { opacity: 0.94; }
            20% { opacity: 0.98; }
            50% { opacity: 0.95; }
            100% { opacity: 0.98; }
        }

        .container {
            animation: flicker 0.15s infinite;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        /* Header */
        .header {
            text-align: center;
            padding: 30px;
            border-bottom: 2px solid #00ff00;
            margin-bottom: 30px;
        }

        .header h1 {
            font-family: 'VT323', monospace;
            font-size: 4em;
            text-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 30px #00ff00;
            letter-spacing: 15px;
        }

        .header h2 {
            color: #00cc00;
            font-size: 1.5em;
            margin-top: 10px;
        }

        .header p {
            color: #008800;
            margin-top: 10px;
        }

        /* Status Bar */
        .status-bar {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }

        .status-item {
            background: rgba(0, 255, 0, 0.05);
            border: 1px solid #00ff00;
            padding: 15px;
            text-align: center;
            border-radius: 5px;
        }

        .status-item h3 {
            font-size: 0.9em;
            color: #008800;
            margin-bottom: 10px;
        }

        .status-item .value {
            font-size: 1.5em;
            text-shadow: 0 0 10px #00ff00;
        }

        /* Main Grid */
        .main-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
        }

        /* Terminal */
        .terminal {
            background: #0d0d0d;
            border: 2px solid #00ff00;
            border-radius: 10px;
            padding: 20px;
        }

        .terminal-header {
            display: flex;
            gap: 8px;
            margin-bottom: 15px;
        }

        .terminal-btn {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }

        .terminal-btn.red { background: #ff5f56; }
        .terminal-btn.yellow { background: #ffbd2e; }
        .terminal-btn.green { background: #27c93f; }

        .terminal-input {
            width: 100%;
            background: #1a1a1a;
            border: 1px solid #00ff00;
            color: #00ff00;
            padding: 15px;
            font-family: 'Share Tech Mono', monospace;
            font-size: 1em;
            resize: vertical;
            min-height: 100px;
        }

        .terminal-input:focus {
            outline: none;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
        }

        .terminal-output {
            background: #0a0a0a;
            border: 1px solid #004400;
            padding: 15px;
            margin-top: 15px;
            min-height: 200px;
            white-space: pre-wrap;
            font-size: 0.9em;
            overflow-y: auto;
            max-height: 400px;
        }

        /* Brothers Panel */
        .brothers-panel {
            background: #0d0d0d;
            border: 2px solid #00ff00;
            border-radius: 10px;
            padding: 20px;
        }

        .brothers-panel h2 {
            margin-bottom: 20px;
            font-size: 1.2em;
        }

        .brother-card {
            background: linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%);
            border: 1px solid #00ff00;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 10px;
            transition: all 0.3s ease;
        }

        .brother-card:hover {
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
            transform: translateX(5px);
        }

        .brother-card h4 {
            font-size: 1em;
            margin-bottom: 5px;
        }

        .brother-card p {
            font-size: 0.8em;
            color: #008800;
        }

        .brother-status {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-left: 10px;
        }

        .brother-status.active { background: #00ff00; box-shadow: 0 0 10px #00ff00; }
        .brother-status.inactive { background: #ff0000; }

        /* Buttons */
        .btn {
            background: #0d0d0d;
            color: #00ff00;
            border: 2px solid #00ff00;
            padding: 10px 20px;
            font-family: 'VT323', monospace;
            font-size: 1.2em;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 2px;
            transition: all 0.3s ease;
            margin-top: 15px;
            width: 100%;
        }

        .btn:hover {
            background: #00ff00;
            color: #0d0d0d;
            box-shadow: 0 0 20px #00ff00;
        }

        /* Mode Selector */
        .mode-selector {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }

        .mode-btn {
            flex: 1;
            padding: 10px;
            border: 2px solid;
            background: transparent;
            font-family: 'VT323', monospace;
            font-size: 1em;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .mode-btn.oracle {
            border-color: #9b59b6;
            color: #9b59b6;
        }

        .mode-btn.berserker {
            border-color: #ff0000;
            color: #ff0000;
        }

        .mode-btn.shadow {
            border-color: #2c3e50;
            color: #2c3e50;
        }

        .mode-btn.active {
            background: currentColor;
            color: #0d0d0d;
        }

        /* R.I.T.U.E.L. Timeline */
        .rituel-timeline {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
            padding: 20px;
            background: rgba(0, 255, 0, 0.05);
            border-radius: 5px;
        }

        .rituel-phase {
            text-align: center;
            opacity: 0.5;
            transition: all 0.3s ease;
        }

        .rituel-phase.active {
            opacity: 1;
        }

        .rituel-phase .letter {
            font-size: 2em;
            font-family: 'VT323', monospace;
            text-shadow: 0 0 10px #00ff00;
        }

        .rituel-phase .name {
            font-size: 0.7em;
            color: #008800;
        }

        /* Loading Animation */
        @keyframes pulse {
            0% { box-shadow: 0 0 5px #00ff00; }
            50% { box-shadow: 0 0 20px #00ff00; }
            100% { box-shadow: 0 0 5px #00ff00; }
        }

        .loading {
            animation: pulse 1s infinite;
        }

        /* Responsive */
        @media (max-width: 900px) {
            .main-grid {
                grid-template-columns: 1fr;
            }
            .status-bar {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>⚡ NEMESIS ⚡</h1>
            <h2>OMEGA UNIFIED v9.0</h2>
            <p>[ THE ULTIMATE AI PILOTING CONSOLE ]</p>
        </div>

        <!-- Status Bar -->
        <div class="status-bar">
            <div class="status-item">
                <h3>MODE</h3>
                <div class="value" id="current-mode">🟣 ORACLE</div>
            </div>
            <div class="status-item">
                <h3>BROTHERS ACTIVE</h3>
                <div class="value" id="brothers-count">7/7</div>
            </div>
            <div class="status-item">
                <h3>SOVEREIGN</h3>
                <div class="value">PIERRE TAGNARD</div>
            </div>
            <div class="status-item">
                <h3>STATUS</h3>
                <div class="value" id="system-status">🟢 ONLINE</div>
            </div>
        </div>

        <!-- R.I.T.U.E.L. Timeline -->
        <div class="rituel-timeline" id="rituel-timeline">
            <div class="rituel-phase" id="phase-R">
                <div class="letter">R</div>
                <div class="name">Réception</div>
            </div>
            <div class="rituel-phase" id="phase-I">
                <div class="letter">I</div>
                <div class="name">Invocation</div>
            </div>
            <div class="rituel-phase" id="phase-T">
                <div class="letter">T</div>
                <div class="name">Tissage</div>
            </div>
            <div class="rituel-phase" id="phase-U">
                <div class="letter">U</div>
                <div class="name">Unification</div>
            </div>
            <div class="rituel-phase" id="phase-E">
                <div class="letter">E</div>
                <div class="name">Épreuve</div>
            </div>
            <div class="rituel-phase" id="phase-L">
                <div class="letter">L</div>
                <div class="name">Lancement</div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="main-grid">
            <!-- Terminal -->
            <div class="terminal">
                <div class="terminal-header">
                    <div class="terminal-btn red"></div>
                    <div class="terminal-btn yellow"></div>
                    <div class="terminal-btn green"></div>
                    <span style="margin-left: 10px; color: #008800;">NEMESIS TERMINAL v9.0</span>
                </div>

                <!-- Mode Selector -->
                <div class="mode-selector">
                    <button class="mode-btn oracle active" onclick="setMode('oracle')">ORACLE</button>
                    <button class="mode-btn berserker" onclick="setMode('berserker')">BERSERKER</button>
                    <button class="mode-btn shadow" onclick="setMode('shadow')">SHADOW</button>
                </div>

                <textarea class="terminal-input" id="input" placeholder="Enter your command here..."></textarea>
                <button class="btn" onclick="execute()">⚡ EXECUTE</button>

                <div class="terminal-output" id="output">
NEMESIS OMEGA UNIFIED v9.0 initialized.
Sovereign: Pierre Tagnard (N1)
Protocol: R.I.T.U.E.L.
Status: READY

> Awaiting commands...
                </div>
            </div>

            <!-- Brothers Panel -->
            <div class="brothers-panel">
                <h2>👥 LES 7 FRÈRES</h2>

                <div class="brother-card">
                    <h4>🎯 ZAPPA <span class="brother-status active"></span></h4>
                    <p>Compilateur de Prompts</p>
                </div>

                <div class="brother-card">
                    <h4>🏗️ DAEDALUS <span class="brother-status active"></span></h4>
                    <p>Architecte de Code</p>
                </div>

                <div class="brother-card">
                    <h4>🌐 SYNCORIA <span class="brother-status active"></span></h4>
                    <p>Orchestrateur d'Essaim</p>
                </div>

                <div class="brother-card">
                    <h4>🧠 EXODIA <span class="brother-status active"></span></h4>
                    <p>Maître de la Mémoire</p>
                </div>

                <div class="brother-card">
                    <h4>⏰ KYRON <span class="brother-status active"></span></h4>
                    <p>Gardien du Temps</p>
                </div>

                <div class="brother-card">
                    <h4>🎭 LOKI <span class="brother-status active"></span></h4>
                    <p>Testeur Chaotique</p>
                </div>

                <div class="brother-card">
                    <h4>📜 RITUEL_MASTER <span class="brother-status active"></span></h4>
                    <p>Maître du Protocole</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        const API_URL = 'http://localhost:8000';
        let currentMode = 'oracle';

        function setMode(mode) {
            currentMode = mode;

            // Update UI
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`.mode-btn.${mode}`).classList.add('active');

            // Update status
            const modeIcons = {
                'oracle': '🟣 ORACLE',
                'berserker': '🔴 BERSERKER',
                'shadow': '⚫ SHADOW'
            };
            document.getElementById('current-mode').textContent = modeIcons[mode];

            appendOutput(`> Mode switched to ${mode.toUpperCase()}`);
        }

        function appendOutput(text) {
            const output = document.getElementById('output');
            output.textContent += '\n' + text;
            output.scrollTop = output.scrollHeight;
        }

        async function animateRituel() {
            const phases = ['R', 'I', 'T', 'U', 'E', 'L'];

            for (const phase of phases) {
                document.querySelectorAll('.rituel-phase').forEach(p => p.classList.remove('active'));
                document.getElementById(`phase-${phase}`).classList.add('active');
                await new Promise(r => setTimeout(r, 300));
            }

            // Reset
            document.querySelectorAll('.rituel-phase').forEach(p => p.classList.remove('active'));
        }

        async function execute() {
            const input = document.getElementById('input').value;
            if (!input.trim()) return;

            appendOutput(`\n> ${input}`);
            document.getElementById('input').value = '';

            // Animate R.I.T.U.E.L.
            animateRituel();

            try {
                const response = await fetch(`${API_URL}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: input,
                        mode: currentMode.toUpperCase(),
                        use_rituel: true
                    })
                });

                const data = await response.json();

                if (data.final_response) {
                    appendOutput(`\n[NEMESIS] ${data.final_response}`);
                } else if (data.response) {
                    appendOutput(`\n[NEMESIS] ${data.response}`);
                } else if (data.error) {
                    appendOutput(`\n[ERROR] ${data.error}`);
                } else {
                    appendOutput(`\n[NEMESIS] ${JSON.stringify(data, null, 2)}`);
                }

            } catch (error) {
                appendOutput(`\n[ERROR] Cannot connect to NEMESIS backend: ${error.message}`);
                appendOutput('[INFO] Make sure the backend is running: uvicorn core.main:app --port 8000');
            }
        }

        // Enter key to execute
        document.getElementById('input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                execute();
            }
        });

        // Initial status check
        async function checkStatus() {
            try {
                const response = await fetch(`${API_URL}/health`);
                const data = await response.json();

                if (data.status === 'healthy') {
                    document.getElementById('system-status').textContent = '🟢 ONLINE';
                } else {
                    document.getElementById('system-status').textContent = '🟡 DEGRADED';
                }
            } catch {
                document.getElementById('system-status').textContent = '🔴 OFFLINE';
            }
        }

        // Check status every 10 seconds
        checkStatus();
        setInterval(checkStatus, 10000);
    </script>
</body>
</html>
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\dashboard\index.html" -Encoding UTF8

Write-Host "Dashboard HTML standalone créé" -ForegroundColor Green
```

---

## ÉTAPE 3: Requirements pour le Dashboard

```powershell
@"
# NEMESIS Dashboard Requirements
streamlit>=1.28.0
requests>=2.31.0
plotly>=5.18.0
pandas>=2.1.0
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\dashboard\requirements.txt" -Encoding UTF8

Write-Host "Requirements dashboard créés" -ForegroundColor Green
```

---

## ÉTAPE 4: Script de lancement

```powershell
@"
# NEMESIS Launch Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NEMESIS OMEGA UNIFIED v9.0 - LAUNCHER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

`$nemesisPath = "C:\Users\pierr\NEMESIS_SINGULARITY"

# Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python not found" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/4] Starting Ollama..." -ForegroundColor Yellow
Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden

Write-Host "[2/4] Starting Qdrant..." -ForegroundColor Yellow
# Assumes Qdrant is running in Docker or standalone

Write-Host "[3/4] Starting NEMESIS Backend..." -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList "-m uvicorn core.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory `$nemesisPath -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "[4/4] Starting Dashboard..." -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList "-m streamlit run dashboard/app.py --server.port 3000" -WorkingDirectory `$nemesisPath -WindowStyle Normal

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "NEMESIS OMEGA UNIFIED v9.0 - ONLINE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nAccess Points:" -ForegroundColor Yellow
Write-Host "  API:       http://localhost:8000"
Write-Host "  Dashboard: http://localhost:3000"
Write-Host "  HTML UI:   file://`$nemesisPath/dashboard/index.html"
Write-Host "`nSovereign Codes: WYA, SOEN, MOC-4, TRE, PIERRE416" -ForegroundColor Magenta
"@ | Set-Content -Path "C:\Users\pierr\NEMESIS_SINGULARITY\launch.ps1" -Encoding UTF8

Write-Host "Script de lancement créé" -ForegroundColor Green
```

---

## VÉRIFICATION PHASE 7B

```powershell
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 7B TERMINÉE - VÉRIFICATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$files = @(
    "dashboard\app.py",
    "dashboard\index.html",
    "dashboard\requirements.txt",
    "launch.ps1"
)

$allOk = $true
foreach ($file in $files) {
    $path = "C:\Users\pierr\NEMESIS_SINGULARITY\$file"
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        Write-Host "[OK] $file ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $file" -ForegroundColor Red
        $allOk = $false
    }
}

if ($allOk) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "PHASE 7B: DASHBOARD NEMESIS - SUCCÈS" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nDashboard Features:" -ForegroundColor Yellow
    Write-Host "- Effet CRT avec scanlines"
    Write-Host "- Interface Streamlit premium"
    Write-Host "- Version HTML standalone"
    Write-Host "- Intégration des 7 Frères"
    Write-Host "- Visualisation R.I.T.U.E.L."
    Write-Host "- Modes BERSERKER/ORACLE/SHADOW"
}
```

---

## PROCHAINE ÉTAPE

Après Phase 7A et 7B, la **Phase 7C** concernera:
- **Watchtower Division** (YouTube-Scout, Paper-Hunter, Social-Listener)
- **Shadow Lab** (processus de création de projets)
- **Intégrations n8n avancées**

Donne-moi le rapport de Phase 7A et 7B pour continuer.
