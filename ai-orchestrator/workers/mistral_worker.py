"""
Mistral Worker - Mistral AI API integration.
Specialized for code generation tasks.
"""

import asyncio
import logging
import os
import time
from typing import Dict, List, Optional

from .base import AIWorker, WorkerTask, WorkerResponse, WorkerStatus

logger = logging.getLogger('Mistral-Worker')


class MistralWorker(AIWorker):
    """Worker for Mistral AI API interactions."""

    MODELS = {
        'large': 'mistral-large-latest',
        'medium': 'mistral-medium-latest',
        'small': 'mistral-small-latest',
        'codestral': 'codestral-latest',  # Specialized for code
    }

    def __init__(self, api_key: Optional[str] = None, model: str = 'large',
                 config: Dict = None):
        super().__init__(api_key, config)
        self.api_key = api_key or os.environ.get('MISTRAL_API_KEY')
        self.name = f"Mistral-{model.capitalize()}"
        self.model = self.MODELS.get(model, model)
        self.max_tokens = 4096
        self._client = None

    def _get_client(self):
        """Get or create Mistral client."""
        if self._client is None:
            try:
                from mistralai.client import MistralClient
                self._client = MistralClient(api_key=self.api_key)
            except ImportError:
                logger.error("mistralai package not installed. Run: pip install mistralai")
                raise
        return self._client

    async def check_availability(self) -> bool:
        """Check if Mistral API is available."""
        if not self.api_key:
            logger.warning("No Mistral API key configured")
            return False

        try:
            client = self._get_client()
            return True
        except Exception as e:
            logger.error(f"Mistral availability check failed: {e}")
            return False

    async def send_message(self, task: WorkerTask) -> WorkerResponse:
        """Send a message to Mistral API."""
        start_time = time.time()

        try:
            from mistralai.models.chat_completion import ChatMessage

            client = self._get_client()

            # Build messages
            messages = []
            if task.system_prompt:
                messages.append(ChatMessage(role="system", content=task.system_prompt))

            for ctx in task.context:
                messages.append(ChatMessage(
                    role=ctx.get('role', 'user'),
                    content=ctx.get('content', '')
                ))

            messages.append(ChatMessage(role="user", content=task.prompt))

            # Make API call
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.chat(
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
                    'finish_reason': response.choices[0].finish_reason if response.choices else None
                }
            )

        except Exception as e:
            logger.error(f"Mistral API error: {e}")
            raise


class CodestralWorker(MistralWorker):
    """Specialized Mistral worker for code generation using Codestral."""

    def __init__(self, api_key: Optional[str] = None, config: Dict = None):
        super().__init__(api_key, 'codestral', config)
        self.name = "Codestral"
        self.max_tokens = 8192  # Higher limit for code

    async def generate_code(self, task: WorkerTask,
                            language: str = "python") -> WorkerResponse:
        """Generate code with language-specific context."""
        enhanced_prompt = f"""# Code Generation Task

## Language: {language}

## Requirements:
{task.prompt}

## Guidelines:
1. Write clean, well-documented code
2. Follow {language} best practices
3. Include error handling
4. Add type hints where applicable
5. Make code production-ready

## Output Format:
Provide only the code with inline comments. No explanations outside code blocks."""

        enhanced_task = WorkerTask(
            id=task.id,
            prompt=enhanced_prompt,
            system_prompt=f"You are an expert {language} developer. Generate production-ready code.",
            max_tokens=task.max_tokens,
            temperature=0.3  # Lower temperature for code
        )

        return await self.send_message(enhanced_task)

    async def review_code(self, code: str, language: str = "python") -> WorkerResponse:
        """Review code for issues and improvements."""
        review_prompt = f"""# Code Review Request

## Language: {language}

## Code to Review:
```{language}
{code}
```

## Review Criteria:
1. Security vulnerabilities
2. Performance issues
3. Code style and conventions
4. Error handling completeness
5. Documentation quality
6. Test coverage suggestions

## Output Format:
Provide structured feedback with severity levels (Critical/Warning/Info) and suggested fixes."""

        task = WorkerTask(
            id="review",
            prompt=review_prompt,
            system_prompt="You are a senior code reviewer. Be thorough and constructive.",
            max_tokens=4096,
            temperature=0.5
        )

        return await self.send_message(task)
