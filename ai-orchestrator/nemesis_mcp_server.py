#!/usr/bin/env python3
"""
NEMESIS MCP Server - Claude Desktop/Code Integration
Implements Model Context Protocol for seamless Claude integration.

This allows Claude to directly invoke NEMESIS multi-AI analysis
through the MCP protocol.

Usage:
    Add to Claude Desktop config:
    {
        "mcpServers": {
            "nemesis": {
                "command": "python3",
                "args": ["/path/to/nemesis_mcp_server.py"]
            }
        }
    }
"""

import sys
import os
import json
import uuid
import subprocess
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# Setup paths
NEMESIS_DIR = Path(__file__).parent.resolve()
RESULTS_DIR = Path.home() / "nemesis_results"
LOG_DIR = Path.home() / ".local" / "share" / "nemesis" / "logs"

# Ensure directories
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Logging
logging.basicConfig(
    filename=LOG_DIR / "mcp_server.log",
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# MCP Protocol Implementation
# =============================================================================

class MCPServer:
    """MCP Server implementation for NEMESIS."""

    PROTOCOL_VERSION = "2024-11-05"
    SERVER_NAME = "nemesis"
    SERVER_VERSION = "2.0.0"

    def __init__(self):
        self.tools = self._define_tools()

    def _define_tools(self) -> List[Dict[str, Any]]:
        """Define available MCP tools."""
        return [
            {
                "name": "analyze_with_multi_ai",
                "description": """Analyze any topic, question, code, or architecture using multiple AI models simultaneously.

This tool orchestrates analysis across 7+ AI models (Claude, ChatGPT, Gemini, Mistral, Perplexity, DeepSeek, Grok) and synthesizes their responses into a comprehensive report.

Use this when you need:
- Multiple perspectives on a complex topic
- Critical analysis of code or architecture
- Comprehensive research synthesis
- Validation of ideas across different AI viewpoints""",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "description": "The topic, question, code, or content to analyze. Be specific and detailed for better results."
                        },
                        "rounds": {
                            "type": "number",
                            "description": "Number of analysis rounds (1-5). More rounds = deeper analysis but longer time. Default: 1",
                            "default": 1,
                            "minimum": 1,
                            "maximum": 5
                        },
                        "mode": {
                            "type": "string",
                            "enum": ["auto", "semi-auto", "manual"],
                            "description": "Analysis mode. 'auto' = full automation (requires browser), 'semi-auto' = opens tabs for manual paste, 'manual' = returns instructions only",
                            "default": "auto"
                        },
                        "focus": {
                            "type": "string",
                            "enum": ["general", "critique", "technical", "creative", "security"],
                            "description": "Analysis focus area",
                            "default": "general"
                        }
                    },
                    "required": ["topic"]
                }
            },
            {
                "name": "get_analysis_history",
                "description": "Retrieve the history of previous NEMESIS multi-AI analyses, including their topics, timestamps, and results.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "number",
                            "description": "Maximum number of results to return (1-50)",
                            "default": 10,
                            "minimum": 1,
                            "maximum": 50
                        },
                        "status": {
                            "type": "string",
                            "enum": ["all", "completed", "failed"],
                            "description": "Filter by status",
                            "default": "all"
                        }
                    }
                }
            },
            {
                "name": "get_analysis_result",
                "description": "Retrieve the full report from a specific NEMESIS analysis by its request ID.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "request_id": {
                            "type": "string",
                            "description": "The request ID of the analysis to retrieve"
                        }
                    },
                    "required": ["request_id"]
                }
            },
            {
                "name": "verify_content",
                "description": "Verify code or content for security issues, quality problems, and best practices using NEMESIS verification engine.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "content": {
                            "type": "string",
                            "description": "The content (code, text, configuration) to verify"
                        },
                        "type": {
                            "type": "string",
                            "enum": ["code", "text", "config", "auto"],
                            "description": "Content type for specialized checks",
                            "default": "auto"
                        },
                        "checks": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Specific checks to run: security, safety, quality, consistency",
                            "default": ["security", "safety", "quality"]
                        }
                    },
                    "required": ["content"]
                }
            },
            {
                "name": "get_nemesis_stats",
                "description": "Get statistics about NEMESIS usage, including total analyses, success rates, and system health.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            }
        ]

    def handle_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle an incoming MCP message."""
        method = message.get("method")
        params = message.get("params", {})
        msg_id = message.get("id")

        logger.info(f"Received method: {method}")

        try:
            if method == "initialize":
                result = self._handle_initialize(params)
            elif method == "tools/list":
                result = self._handle_list_tools(params)
            elif method == "tools/call":
                result = self._handle_call_tool(params)
            elif method == "notifications/initialized":
                return None  # No response needed
            else:
                result = {"error": {"code": -32601, "message": f"Unknown method: {method}"}}

            if result is None:
                return None

            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": result
            }

        except Exception as e:
            logger.exception(f"Error handling {method}: {e}")
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }

    def _handle_initialize(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle MCP initialize request."""
        logger.info("Initializing NEMESIS MCP Server")
        return {
            "protocolVersion": self.PROTOCOL_VERSION,
            "serverInfo": {
                "name": self.SERVER_NAME,
                "version": self.SERVER_VERSION
            },
            "capabilities": {
                "tools": {}
            }
        }

    def _handle_list_tools(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """List available NEMESIS tools."""
        return {"tools": self.tools}

    def _handle_call_tool(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a NEMESIS tool."""
        tool_name = params.get("name")
        args = params.get("arguments", {})

        logger.info(f"Calling tool: {tool_name} with args: {args}")

        if tool_name == "analyze_with_multi_ai":
            return self._tool_analyze(args)
        elif tool_name == "get_analysis_history":
            return self._tool_history(args)
        elif tool_name == "get_analysis_result":
            return self._tool_get_result(args)
        elif tool_name == "verify_content":
            return self._tool_verify(args)
        elif tool_name == "get_nemesis_stats":
            return self._tool_stats(args)
        else:
            return {
                "content": [{"type": "text", "text": f"Unknown tool: {tool_name}"}],
                "isError": True
            }

    def _tool_analyze(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Run multi-AI analysis."""
        topic = args.get("topic", "")
        rounds = min(int(args.get("rounds", 1)), 5)
        mode = args.get("mode", "auto")
        focus = args.get("focus", "general")

        if not topic:
            return {
                "content": [{"type": "text", "text": "Error: 'topic' is required"}],
                "isError": True
            }

        request_id = str(uuid.uuid4())[:8]
        output_dir = RESULTS_DIR / f"run_{request_id}"
        output_dir.mkdir(parents=True, exist_ok=True)

        # Save request
        request_file = output_dir / "request.md"
        with open(request_file, 'w') as f:
            f.write(f"# NEMESIS Analysis Request\n\n")
            f.write(f"**Request ID:** {request_id}\n")
            f.write(f"**Timestamp:** {datetime.now().isoformat()}\n")
            f.write(f"**Mode:** {mode}\n")
            f.write(f"**Rounds:** {rounds}\n")
            f.write(f"**Focus:** {focus}\n\n")
            f.write(f"## Topic\n\n{topic}\n")

        # Build command
        cmd = [
            sys.executable,
            str(NEMESIS_DIR / "nemesis.py"),
            "run",
            "--request-id", request_id,
            "--mode", mode,
            "--rounds", str(rounds),
            "--output-dir", str(output_dir),
            "--file", str(request_file)
        ]

        try:
            logger.info(f"[{request_id}] Executing analysis...")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600,
                cwd=str(NEMESIS_DIR)
            )

            # Find report
            report_path = output_dir / "report.md"
            if not report_path.exists():
                for rp in output_dir.glob("*.md"):
                    if rp.name != "request.md":
                        report_path = rp
                        break

            if report_path.exists():
                report_content = report_path.read_text()
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": f"# NEMESIS Analysis Complete\n\n**Request ID:** `{request_id}`\n\n---\n\n{report_content}"
                        }
                    ]
                }
            else:
                # Return what we have
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": f"# NEMESIS Analysis\n\n**Request ID:** `{request_id}`\n\nAnalysis executed but report not generated.\n\n**Output:**\n```\n{result.stdout[:2000]}\n```\n\n**Errors:**\n```\n{result.stderr[:1000]}\n```"
                        }
                    ]
                }

        except subprocess.TimeoutExpired:
            logger.error(f"[{request_id}] Timeout")
            return {
                "content": [{"type": "text", "text": f"Analysis timed out after 600 seconds. Request ID: {request_id}"}],
                "isError": True
            }
        except Exception as e:
            logger.exception(f"[{request_id}] Error: {e}")
            return {
                "content": [{"type": "text", "text": f"Error during analysis: {str(e)}"}],
                "isError": True
            }

    def _tool_history(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Get analysis history."""
        limit = min(int(args.get("limit", 10)), 50)
        status_filter = args.get("status", "all")

        history = []
        for run_dir in sorted(RESULTS_DIR.glob("run_*"), key=lambda p: p.stat().st_mtime, reverse=True):
            if len(history) >= limit:
                break

            result_file = run_dir / "result.json"
            request_file = run_dir / "request.md"

            entry = {
                "request_id": run_dir.name.replace("run_", ""),
                "timestamp": datetime.fromtimestamp(run_dir.stat().st_mtime).isoformat()
            }

            if result_file.exists():
                try:
                    with open(result_file) as f:
                        result = json.load(f)
                        entry["status"] = result.get("status", "unknown")
                except:
                    entry["status"] = "unknown"
            else:
                entry["status"] = "unknown"

            if status_filter != "all" and entry.get("status") != status_filter:
                continue

            if request_file.exists():
                entry["preview"] = request_file.read_text()[:200] + "..."

            history.append(entry)

        # Format as text
        if not history:
            text = "No analysis history found."
        else:
            text = "# NEMESIS Analysis History\n\n"
            for h in history:
                text += f"## `{h['request_id']}` - {h.get('status', 'unknown')}\n"
                text += f"**Time:** {h['timestamp']}\n"
                if 'preview' in h:
                    text += f"**Preview:** {h['preview']}\n"
                text += "\n---\n\n"

        return {"content": [{"type": "text", "text": text}]}

    def _tool_get_result(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Get a specific analysis result."""
        request_id = args.get("request_id", "")

        if not request_id:
            return {
                "content": [{"type": "text", "text": "Error: 'request_id' is required"}],
                "isError": True
            }

        output_dir = RESULTS_DIR / f"run_{request_id}"
        if not output_dir.exists():
            return {
                "content": [{"type": "text", "text": f"Analysis not found: {request_id}"}],
                "isError": True
            }

        # Try to find report
        report_path = output_dir / "report.md"
        if not report_path.exists():
            for rp in output_dir.glob("*.md"):
                report_path = rp
                break

        if report_path.exists():
            return {"content": [{"type": "text", "text": report_path.read_text()}]}
        else:
            # Return result.json content
            result_path = output_dir / "result.json"
            if result_path.exists():
                with open(result_path) as f:
                    return {"content": [{"type": "text", "text": f"```json\n{json.dumps(json.load(f), indent=2)}\n```"}]}

        return {
            "content": [{"type": "text", "text": f"No report found for: {request_id}"}],
            "isError": True
        }

    def _tool_verify(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Verify content."""
        content = args.get("content", "")
        content_type = args.get("type", "auto")
        checks = args.get("checks", ["security", "safety", "quality"])

        if not content:
            return {
                "content": [{"type": "text", "text": "Error: 'content' is required"}],
                "isError": True
            }

        try:
            from core.verifier import Verifier
            verifier = Verifier()
            report = verifier.verify(content, content_type=content_type)

            text = f"# Verification Report\n\n"
            text += f"**Passed:** {'Yes' if report.passed else 'No'}\n"
            text += f"**Score:** {report.overall_score:.1%}\n\n"

            if report.issues:
                text += "## Issues Found\n\n"
                for issue in report.issues:
                    text += f"- **{issue.severity.value.upper()}:** {issue.message}\n"
            else:
                text += "No issues found.\n"

            return {"content": [{"type": "text", "text": text}]}

        except ImportError:
            return {
                "content": [{"type": "text", "text": "Verifier module not available"}],
                "isError": True
            }
        except Exception as e:
            return {
                "content": [{"type": "text", "text": f"Verification error: {str(e)}"}],
                "isError": True
            }

    def _tool_stats(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Get NEMESIS statistics."""
        total_runs = len(list(RESULTS_DIR.glob("run_*")))
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

        disk_usage = sum(f.stat().st_size for f in RESULTS_DIR.rglob("*") if f.is_file())

        text = f"""# NEMESIS Statistics

**Total Analyses:** {total_runs}
**Successful:** {success}
**Failed:** {failed}
**Success Rate:** {success / max(total_runs, 1):.1%}

**Results Directory:** `{RESULTS_DIR}`
**Disk Usage:** {disk_usage / (1024 * 1024):.1f} MB

**Server Version:** {self.SERVER_VERSION}
**Protocol Version:** {self.PROTOCOL_VERSION}
"""
        return {"content": [{"type": "text", "text": text}]}


# =============================================================================
# Main Loop
# =============================================================================

def read_message() -> Optional[Dict[str, Any]]:
    """Read a JSON-RPC message from stdin."""
    try:
        line = sys.stdin.readline()
        if not line:
            return None
        return json.loads(line.strip())
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return None
    except Exception as e:
        logger.error(f"Read error: {e}")
        return None


def write_message(msg: Dict[str, Any]):
    """Write a JSON-RPC message to stdout."""
    try:
        output = json.dumps(msg)
        sys.stdout.write(output + '\n')
        sys.stdout.flush()
    except Exception as e:
        logger.error(f"Write error: {e}")


def main():
    """Main MCP server loop."""
    logger.info("NEMESIS MCP Server starting...")

    server = MCPServer()

    while True:
        try:
            msg = read_message()
            if msg is None:
                logger.info("EOF received, shutting down")
                break

            response = server.handle_message(msg)
            if response is not None:
                write_message(response)

        except KeyboardInterrupt:
            logger.info("Interrupted, shutting down")
            break
        except Exception as e:
            logger.exception(f"Main loop error: {e}")


if __name__ == '__main__':
    main()
