"""
OpenAI Worker - GPT API integration.
"""

import asyncio
import logging
import os
import time
from typing import Dict, List, Optional

from .base import AIWorker, WorkerTask, WorkerResponse, WorkerStatus

logger = logging.getLogger('OpenAI-Worker')


class OpenAIWorker(AIWorker):
    """Worker for OpenAI GPT API interactions."""

    MODELS = {
        'gpt4': 'gpt-4-turbo-preview',
        'gpt4o': 'gpt-4o',
        'gpt4o-mini': 'gpt-4o-mini',
        'o1': 'o1-preview',
        'o1-mini': 'o1-mini',
    }

    def __init__(self, api_key: Optional[str] = None, model: str = 'gpt4o',
                 config: Dict = None):
        super().__init__(api_key, config)
        self.api_key = api_key or os.environ.get('OPENAI_API_KEY')
        self.name = f"OpenAI-{model}"
        self.model = self.MODELS.get(model, model)
        self.max_tokens = 4096
        self._client = None

    def _get_client(self):
        """Get or create OpenAI client."""
        if self._client is None:
            try:
                import openai
                self._client = openai.OpenAI(api_key=self.api_key)
            except ImportError:
                logger.error("openai package not installed. Run: pip install openai")
                raise
        return self._client

    async def check_availability(self) -> bool:
        """Check if OpenAI API is available."""
        if not self.api_key:
            logger.warning("No OpenAI API key configured")
            return False

        try:
            client = self._get_client()
            return True
        except Exception as e:
            logger.error(f"OpenAI availability check failed: {e}")
            return False

    async def send_message(self, task: WorkerTask) -> WorkerResponse:
        """Send a message to OpenAI API."""
        start_time = time.time()

        try:
            client = self._get_client()

            # Build messages
            messages = []
            if task.system_prompt:
                messages.append({
                    'role': 'system',
                    'content': task.system_prompt
                })

            for ctx in task.context:
                messages.append({
                    'role': ctx.get('role', 'user'),
                    'content': ctx.get('content', '')
                })

            messages.append({
                'role': 'user',
                'content': task.prompt
            })

            # Make API call
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    max_tokens=min(task.max_tokens, self.max_tokens),
                    temperature=task.temperature
                )
            )

            latency = (time.time() - start_time) * 1000

            content = response.choices[0].message.content if response.choices else ""

            return WorkerResponse(
                content=content,
                model=self.model,
                tokens_used=response.usage.total_tokens if response.usage else 0,
                latency_ms=latency,
                status=WorkerStatus.COMPLETED,
                metadata={
                    'finish_reason': response.choices[0].finish_reason if response.choices else None,
                    'prompt_tokens': response.usage.prompt_tokens if response.usage else 0,
                    'completion_tokens': response.usage.completion_tokens if response.usage else 0
                }
            )

        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    async def send_with_functions(self, task: WorkerTask,
                                  functions: List[Dict]) -> WorkerResponse:
        """Send a message with function calling capabilities."""
        start_time = time.time()

        try:
            client = self._get_client()

            messages = [{'role': 'user', 'content': task.prompt}]
            if task.system_prompt:
                messages.insert(0, {'role': 'system', 'content': task.system_prompt})

            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    functions=functions,
                    function_call="auto",
                    max_tokens=task.max_tokens
                )
            )

            latency = (time.time() - start_time) * 1000

            choice = response.choices[0] if response.choices else None
            content = choice.message.content if choice else ""
            function_call = None

            if choice and choice.message.function_call:
                function_call = {
                    'name': choice.message.function_call.name,
                    'arguments': choice.message.function_call.arguments
                }

            return WorkerResponse(
                content=content or "",
                model=self.model,
                tokens_used=response.usage.total_tokens if response.usage else 0,
                latency_ms=latency,
                status=WorkerStatus.COMPLETED,
                metadata={
                    'function_call': function_call,
                    'finish_reason': choice.finish_reason if choice else None
                }
            )

        except Exception as e:
            logger.error(f"OpenAI API error with functions: {e}")
            raise
