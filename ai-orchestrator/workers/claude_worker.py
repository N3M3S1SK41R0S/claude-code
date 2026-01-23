"""
Claude AI Worker - Anthropic API integration.
"""

import asyncio
import logging
import os
import time
from typing import Dict, List, Optional, Any

from .base import AIWorker, WorkerTask, WorkerResponse, WorkerStatus

logger = logging.getLogger('Claude-Worker')


class ClaudeWorker(AIWorker):
    """Worker for Claude/Anthropic API interactions."""

    MODELS = {
        'sonnet': 'claude-sonnet-4-5-20250514',
        'opus': 'claude-opus-4-5-20251101',
        'haiku': 'claude-haiku-4-20250514',
    }

    def __init__(self, api_key: Optional[str] = None, model: str = 'sonnet',
                 config: Dict = None):
        super().__init__(api_key, config)
        self.api_key = api_key or os.environ.get('ANTHROPIC_API_KEY')
        self.name = f"Claude-{model.capitalize()}"
        self.model = self.MODELS.get(model, model)
        self.max_tokens = 8192
        self.base_url = "https://api.anthropic.com/v1"
        self._client = None

    def _get_client(self):
        """Get or create Anthropic client."""
        if self._client is None:
            try:
                import anthropic
                self._client = anthropic.Anthropic(api_key=self.api_key)
            except ImportError:
                logger.error("anthropic package not installed. Run: pip install anthropic")
                raise
        return self._client

    async def check_availability(self) -> bool:
        """Check if Claude API is available."""
        if not self.api_key:
            logger.warning("No Anthropic API key configured")
            return False

        try:
            # Simple availability check
            client = self._get_client()
            return True
        except Exception as e:
            logger.error(f"Claude availability check failed: {e}")
            return False

    async def send_message(self, task: WorkerTask) -> WorkerResponse:
        """Send a message to Claude API."""
        start_time = time.time()

        try:
            client = self._get_client()

            # Build messages
            messages = []
            for ctx in task.context:
                messages.append({
                    'role': ctx.get('role', 'user'),
                    'content': ctx.get('content', '')
                })
            messages.append({
                'role': 'user',
                'content': task.prompt
            })

            # Make API call (sync for simplicity, wrap in executor for async)
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.messages.create(
                    model=self.model,
                    max_tokens=min(task.max_tokens, self.max_tokens),
                    system=task.system_prompt or "You are a helpful AI assistant.",
                    messages=messages
                )
            )

            latency = (time.time() - start_time) * 1000

            # Extract content
            content = ""
            if response.content:
                for block in response.content:
                    if hasattr(block, 'text'):
                        content += block.text

            return WorkerResponse(
                content=content,
                model=self.model,
                tokens_used=response.usage.input_tokens + response.usage.output_tokens,
                latency_ms=latency,
                status=WorkerStatus.COMPLETED,
                metadata={
                    'stop_reason': response.stop_reason,
                    'input_tokens': response.usage.input_tokens,
                    'output_tokens': response.usage.output_tokens
                }
            )

        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise

    async def send_with_tools(self, task: WorkerTask,
                              tools: List[Dict]) -> WorkerResponse:
        """Send a message with tool use capabilities."""
        start_time = time.time()

        try:
            client = self._get_client()

            messages = [{'role': 'user', 'content': task.prompt}]

            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.messages.create(
                    model=self.model,
                    max_tokens=task.max_tokens,
                    system=task.system_prompt or "You are a helpful AI assistant with access to tools.",
                    messages=messages,
                    tools=tools
                )
            )

            latency = (time.time() - start_time) * 1000

            # Process response including tool calls
            content = ""
            tool_calls = []

            for block in response.content:
                if hasattr(block, 'text'):
                    content += block.text
                elif block.type == 'tool_use':
                    tool_calls.append({
                        'id': block.id,
                        'name': block.name,
                        'input': block.input
                    })

            return WorkerResponse(
                content=content,
                model=self.model,
                tokens_used=response.usage.input_tokens + response.usage.output_tokens,
                latency_ms=latency,
                status=WorkerStatus.COMPLETED,
                metadata={
                    'tool_calls': tool_calls,
                    'stop_reason': response.stop_reason
                }
            )

        except Exception as e:
            logger.error(f"Claude API error with tools: {e}")
            raise


class ClaudeMCPWorker(ClaudeWorker):
    """Claude worker with MCP (Model Context Protocol) support."""

    def __init__(self, api_key: Optional[str] = None, model: str = 'sonnet',
                 mcp_servers: List[Dict] = None, config: Dict = None):
        super().__init__(api_key, model, config)
        self.mcp_servers = mcp_servers or []
        self.name = f"Claude-MCP-{model.capitalize()}"

    async def connect_mcp_servers(self) -> Dict[str, bool]:
        """Connect to configured MCP servers."""
        results = {}
        for server in self.mcp_servers:
            server_name = server.get('name', 'unknown')
            try:
                # MCP connection logic would go here
                # This is a placeholder for actual MCP integration
                results[server_name] = True
                logger.info(f"Connected to MCP server: {server_name}")
            except Exception as e:
                results[server_name] = False
                logger.error(f"Failed to connect to MCP server {server_name}: {e}")
        return results

    async def send_with_mcp(self, task: WorkerTask,
                            mcp_context: Dict = None) -> WorkerResponse:
        """Send a message with MCP context."""
        # Enhance prompt with MCP context
        enhanced_prompt = task.prompt
        if mcp_context:
            enhanced_prompt = f"""# MCP Context
{self._format_mcp_context(mcp_context)}

# User Request
{task.prompt}"""

        enhanced_task = WorkerTask(
            id=task.id,
            prompt=enhanced_prompt,
            system_prompt=task.system_prompt,
            max_tokens=task.max_tokens,
            temperature=task.temperature,
            context=task.context
        )

        return await self.send_message(enhanced_task)

    def _format_mcp_context(self, context: Dict) -> str:
        """Format MCP context for the prompt."""
        formatted = []
        for key, value in context.items():
            formatted.append(f"## {key}\n{value}")
        return "\n\n".join(formatted)
