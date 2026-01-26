#!/usr/bin/env python3
"""
NEMESIS HTTP Service - Always-on local server
Receive analysis requests from any application via REST API.

Endpoints:
    GET  /health          - Health check
    POST /analyze         - Submit analysis request
    GET  /results/<id>    - Get results for a request
    GET  /history         - List recent analyses
    POST /verify          - Verify content
    GET  /stats           - System statistics
    POST /cancel/<id>     - Cancel running analysis

Usage:
    python nemesis_server.py [--port 8765] [--host 127.0.0.1]
"""

import os
import sys
import json
import uuid
import time
import queue
import signal
import logging
import argparse
import threading
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor

try:
    from flask import Flask, request, jsonify, send_file, Response
    from flask_cors import CORS
except ImportError:
    print("Installing required packages...")
    os.system("pip install flask flask-cors")
    from flask import Flask, request, jsonify, send_file, Response
    from flask_cors import CORS

# =============================================================================
# Configuration
# =============================================================================

NEMESIS_DIR = Path(__file__).parent.resolve()
CONFIG_DIR = Path.home() / ".config" / "nemesis"
DATA_DIR = Path.home() / ".local" / "share" / "nemesis"
RESULTS_DIR = Path.home() / "nemesis_results"
LOG_DIR = DATA_DIR / "logs"

# Ensure directories exist
for d in [CONFIG_DIR, DATA_DIR, RESULTS_DIR, LOG_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / "server.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# =============================================================================
# Data Models
# =============================================================================

@dataclass
class AnalysisRequest:
    """Analysis request model."""
    request_id: str
    content: str
    mode: str = "auto"
    rounds: int = 1
    timeout: int = 300
    headless: bool = False
    agents: Optional[List[str]] = None
    created_at: str = None
    status: str = "pending"

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


@dataclass
class AnalysisResult:
    """Analysis result model."""
    request_id: str
    status: str
    started_at: str
    completed_at: Optional[str] = None
    output_dir: Optional[str] = None
    report_path: Optional[str] = None
    error: Optional[str] = None
    duration_seconds: Optional[float] = None


# =============================================================================
# Job Queue and Executor
# =============================================================================

class JobQueue:
    """Thread-safe job queue with status tracking."""

    def __init__(self, max_workers: int = 2):
        self.pending: queue.Queue = queue.Queue()
        self.running: Dict[str, AnalysisRequest] = {}
        self.completed: Dict[str, AnalysisResult] = {}
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self._lock = threading.Lock()

    def submit(self, req: AnalysisRequest) -> str:
        """Submit a new analysis request."""
        with self._lock:
            self.running[req.request_id] = req

        self.executor.submit(self._execute, req)
        logger.info(f"[{req.request_id}] Job submitted: {req.mode}, {req.rounds} rounds")
        return req.request_id

    def _execute(self, req: AnalysisRequest):
        """Execute an analysis request."""
        result = AnalysisResult(
            request_id=req.request_id,
            status="running",
            started_at=datetime.now().isoformat()
        )

        output_dir = RESULTS_DIR / f"run_{req.request_id}"
        output_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Save request
            with open(output_dir / "request.json", 'w') as f:
                json.dump(asdict(req), f, indent=2)

            # Build command
            cmd = [
                sys.executable,
                str(NEMESIS_DIR / "nemesis.py"),
                "run",
                "--request-id", req.request_id,
                "--mode", req.mode,
                "--rounds", str(req.rounds),
                "--output-dir", str(output_dir)
            ]

            if req.headless:
                cmd.append("--headless")

            # Write content to temp file
            content_file = output_dir / "input.txt"
            with open(content_file, 'w') as f:
                f.write(req.content)
            cmd.extend(["--file", str(content_file)])

            # Execute
            logger.info(f"[{req.request_id}] Executing: {' '.join(cmd)}")

            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=req.timeout,
                cwd=str(NEMESIS_DIR)
            )

            # Save output
            with open(output_dir / "stdout.log", 'w') as f:
                f.write(proc.stdout)
            with open(output_dir / "stderr.log", 'w') as f:
                f.write(proc.stderr)

            # Check for report
            report_path = output_dir / "report.md"
            if not report_path.exists():
                # Try to find it
                for rp in output_dir.glob("*.md"):
                    report_path = rp
                    break

            result.status = "completed" if proc.returncode == 0 else "failed"
            result.output_dir = str(output_dir)
            result.report_path = str(report_path) if report_path.exists() else None

            if proc.returncode != 0:
                result.error = proc.stderr[:1000]

        except subprocess.TimeoutExpired:
            result.status = "timeout"
            result.error = f"Analysis exceeded {req.timeout}s timeout"
            logger.error(f"[{req.request_id}] Timeout after {req.timeout}s")

        except Exception as e:
            result.status = "error"
            result.error = str(e)
            logger.exception(f"[{req.request_id}] Error: {e}")

        finally:
            result.completed_at = datetime.now().isoformat()
            if result.started_at:
                started = datetime.fromisoformat(result.started_at)
                completed = datetime.fromisoformat(result.completed_at)
                result.duration_seconds = (completed - started).total_seconds()

            # Save result
            with open(output_dir / "result.json", 'w') as f:
                json.dump(asdict(result), f, indent=2)

            # Move from running to completed
            with self._lock:
                if req.request_id in self.running:
                    del self.running[req.request_id]
                self.completed[req.request_id] = result

            logger.info(f"[{req.request_id}] Completed: {result.status}")

    def get_status(self, request_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a request."""
        with self._lock:
            if request_id in self.running:
                return {"status": "running", "request": asdict(self.running[request_id])}
            if request_id in self.completed:
                return {"status": self.completed[request_id].status, "result": asdict(self.completed[request_id])}

        # Check disk
        result_file = RESULTS_DIR / f"run_{request_id}" / "result.json"
        if result_file.exists():
            with open(result_file) as f:
                return json.load(f)

        return None

    def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent analysis history."""
        history = []

        for run_dir in sorted(RESULTS_DIR.glob("run_*"), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]:
            result_file = run_dir / "result.json"
            request_file = run_dir / "request.json"

            entry = {"request_id": run_dir.name.replace("run_", "")}

            if result_file.exists():
                with open(result_file) as f:
                    entry.update(json.load(f))

            if request_file.exists():
                with open(request_file) as f:
                    req_data = json.load(f)
                    entry["preview"] = req_data.get("content", "")[:200]

            history.append(entry)

        return history

    def cancel(self, request_id: str) -> bool:
        """Cancel a running request (best effort)."""
        with self._lock:
            if request_id in self.running:
                # Note: Can't actually cancel subprocess, but mark it
                logger.warning(f"[{request_id}] Cancel requested (best effort)")
                return True
        return False


# =============================================================================
# Flask Application
# =============================================================================

app = Flask(__name__)
CORS(app)  # Allow requests from browser extensions

job_queue = JobQueue()


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "version": "2.0.0",
        "uptime_seconds": time.time() - app.start_time,
        "running_jobs": len(job_queue.running),
        "completed_jobs": len(job_queue.completed)
    })


@app.route('/analyze', methods=['POST'])
def analyze():
    """Submit an analysis request."""
    data = request.json or {}

    # Validate input
    content = data.get('text') or data.get('content')
    if not content:
        # Check for file
        if 'file' in data:
            file_path = Path(data['file']).expanduser()
            if file_path.exists():
                content = file_path.read_text()
            else:
                return jsonify({"error": f"File not found: {data['file']}"}), 400
        else:
            return jsonify({"error": "Missing 'text', 'content', or 'file' parameter"}), 400

    # Create request
    req = AnalysisRequest(
        request_id=data.get('request_id') or str(uuid.uuid4())[:8],
        content=content,
        mode=data.get('mode', 'auto'),
        rounds=min(int(data.get('rounds', 1)), 5),
        timeout=min(int(data.get('timeout', 300)), 1800),
        headless=bool(data.get('headless', False)),
        agents=data.get('agents')
    )

    # Submit job
    request_id = job_queue.submit(req)

    return jsonify({
        "status": "accepted",
        "request_id": request_id,
        "message": f"Analysis queued. Check status at /status/{request_id}"
    }), 202


@app.route('/status/<request_id>', methods=['GET'])
def status(request_id):
    """Get status of an analysis request."""
    result = job_queue.get_status(request_id)
    if result:
        return jsonify(result)
    return jsonify({"error": "Request not found"}), 404


@app.route('/results/<request_id>', methods=['GET'])
def results(request_id):
    """Get results for a completed analysis."""
    output_dir = RESULTS_DIR / f"run_{request_id}"

    if not output_dir.exists():
        return jsonify({"error": "Results not found"}), 404

    # Return report if exists
    report_path = output_dir / "report.md"
    if report_path.exists():
        return send_file(report_path, mimetype='text/markdown')

    # Otherwise return result.json
    result_path = output_dir / "result.json"
    if result_path.exists():
        return send_file(result_path, mimetype='application/json')

    return jsonify({"error": "Report not ready"}), 202


@app.route('/history', methods=['GET'])
def history():
    """List recent analysis history."""
    limit = min(int(request.args.get('limit', 50)), 100)
    runs = job_queue.get_history(limit)
    return jsonify({"runs": runs, "total": len(runs)})


@app.route('/verify', methods=['POST'])
def verify():
    """Verify content using the Verifier."""
    data = request.json or {}
    content = data.get('content') or data.get('text')

    if not content:
        return jsonify({"error": "Missing 'content' parameter"}), 400

    # Run verification
    try:
        from core.verifier import Verifier
        verifier = Verifier()
        report = verifier.verify(content, content_type=data.get('type', 'text'))

        return jsonify({
            "passed": report.passed,
            "score": report.overall_score,
            "issues": [
                {"severity": i.severity.value, "message": i.message}
                for i in report.issues
            ]
        })
    except ImportError:
        return jsonify({"error": "Verifier not available"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/stats', methods=['GET'])
def stats():
    """Get system statistics."""
    # Count runs
    total_runs = len(list(RESULTS_DIR.glob("run_*")))

    # Calculate success rate
    success = 0
    failed = 0
    for result_file in RESULTS_DIR.glob("run_*/result.json"):
        try:
            with open(result_file) as f:
                result = json.load(f)
                if result.get("status") == "completed":
                    success += 1
                else:
                    failed += 1
        except:
            pass

    return jsonify({
        "total_runs": total_runs,
        "successful": success,
        "failed": failed,
        "success_rate": success / max(total_runs, 1),
        "running_jobs": len(job_queue.running),
        "results_dir": str(RESULTS_DIR),
        "disk_usage_mb": sum(f.stat().st_size for f in RESULTS_DIR.rglob("*") if f.is_file()) / (1024 * 1024)
    })


@app.route('/cancel/<request_id>', methods=['POST'])
def cancel(request_id):
    """Cancel a running analysis."""
    if job_queue.cancel(request_id):
        return jsonify({"status": "cancel_requested", "request_id": request_id})
    return jsonify({"error": "Request not found or not running"}), 404


@app.route('/', methods=['GET'])
def index():
    """Welcome page with API documentation."""
    return """
    <html>
    <head><title>NEMESIS API</title></head>
    <body style="font-family: monospace; padding: 2rem; max-width: 800px; margin: 0 auto;">
        <h1>NEMESIS Multi-AI Service</h1>
        <p>REST API for multi-AI analysis orchestration.</p>

        <h2>Endpoints</h2>
        <ul>
            <li><code>GET /health</code> - Health check</li>
            <li><code>POST /analyze</code> - Submit analysis (JSON: text, mode, rounds)</li>
            <li><code>GET /status/&lt;id&gt;</code> - Check analysis status</li>
            <li><code>GET /results/&lt;id&gt;</code> - Get analysis report</li>
            <li><code>GET /history</code> - List recent analyses</li>
            <li><code>POST /verify</code> - Verify content</li>
            <li><code>GET /stats</code> - System statistics</li>
        </ul>

        <h2>Example</h2>
        <pre>
curl -X POST http://localhost:8765/analyze \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Explain microservices", "rounds": 2}'
        </pre>

        <p><a href="/health">Check Health</a> | <a href="/history">View History</a> | <a href="/stats">Statistics</a></p>
    </body>
    </html>
    """


# =============================================================================
# Main
# =============================================================================

def signal_handler(sig, frame):
    """Handle shutdown signals gracefully."""
    logger.info("Shutting down NEMESIS server...")
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="NEMESIS HTTP Service")
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8765, help='Port to listen on')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    args = parser.parse_args()

    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Store start time
    app.start_time = time.time()

    # Print banner
    print("""
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🚀 NEMESIS HTTP Service v2.0                                  ║
║                                                                  ║
║   Multi-AI Orchestration REST API                               ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    """)
    print(f"   Server: http://{args.host}:{args.port}")
    print(f"   Results: {RESULTS_DIR}")
    print(f"   Logs: {LOG_DIR}")
    print()

    # Run server
    app.run(
        host=args.host,
        port=args.port,
        debug=args.debug,
        threaded=True
    )


if __name__ == '__main__':
    main()
