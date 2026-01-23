"""
Gemini Worker - Google AI API integration.
"""

import asyncio
import logging
import os
import time
from typing import Dict, List, Optional

from .base import AIWorker, WorkerTask, WorkerResponse, WorkerStatus

logger = logging.getLogger('Gemini-Worker')


class GeminiWorker(AIWorker):
    """Worker for Google Gemini API interactions."""

    MODELS = {
        'pro': 'gemini-1.5-pro',
        'flash': 'gemini-1.5-flash',
        'ultra': 'gemini-ultra',
    }

    def __init__(self, api_key: Optional[str] = None, model: str = 'pro',
                 config: Dict = None):
        super().__init__(api_key, config)
        self.api_key = api_key or os.environ.get('GOOGLE_API_KEY')
        self.name = f"Gemini-{model.capitalize()}"
        self.model = self.MODELS.get(model, model)
        self.max_tokens = 8192
        self._client = None

    def _get_client(self):
        """Get or create Gemini client."""
        if self._client is None:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self._client = genai.GenerativeModel(self.model)
            except ImportError:
                logger.error("google-generativeai package not installed. Run: pip install google-generativeai")
                raise
        return self._client

    async def check_availability(self) -> bool:
        """Check if Gemini API is available."""
        if not self.api_key:
            logger.warning("No Google API key configured")
            return False

        try:
            client = self._get_client()
            return True
        except Exception as e:
            logger.error(f"Gemini availability check failed: {e}")
            return False

    async def send_message(self, task: WorkerTask) -> WorkerResponse:
        """Send a message to Gemini API."""
        start_time = time.time()

        try:
            client = self._get_client()

            # Build prompt with context
            full_prompt = ""
            if task.system_prompt:
                full_prompt += f"System: {task.system_prompt}\n\n"

            for ctx in task.context:
                role = ctx.get('role', 'user')
                content = ctx.get('content', '')
                full_prompt += f"{role.capitalize()}: {content}\n\n"

            full_prompt += f"User: {task.prompt}"

            # Make API call
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.generate_content(
                    full_prompt,
                    generation_config={
                        'max_output_tokens': min(task.max_tokens, self.max_tokens),
                        'temperature': task.temperature
                    }
                )
            )

            latency = (time.time() - start_time) * 1000

            content = response.text if hasattr(response, 'text') else ""

            return WorkerResponse(
                content=content,
                model=self.model,
                tokens_used=0,  # Gemini doesn't always report token usage
                latency_ms=latency,
                status=WorkerStatus.COMPLETED,
                metadata={
                    'safety_ratings': [
                        {'category': r.category.name, 'probability': r.probability.name}
                        for r in (response.prompt_feedback.safety_ratings
                                  if hasattr(response, 'prompt_feedback') and
                                  hasattr(response.prompt_feedback, 'safety_ratings')
                                  else [])
                    ]
                }
            )

        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise

    async def send_with_images(self, task: WorkerTask,
                               images: List[bytes]) -> WorkerResponse:
        """Send a message with images for multimodal analysis."""
        start_time = time.time()

        try:
            import google.generativeai as genai
            from PIL import Image
            import io

            client = self._get_client()

            # Convert bytes to PIL images
            pil_images = []
            for img_bytes in images:
                img = Image.open(io.BytesIO(img_bytes))
                pil_images.append(img)

            # Create multimodal content
            content = [task.prompt] + pil_images

            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.generate_content(content)
            )

            latency = (time.time() - start_time) * 1000

            return WorkerResponse(
                content=response.text if hasattr(response, 'text') else "",
                model=self.model,
                tokens_used=0,
                latency_ms=latency,
                status=WorkerStatus.COMPLETED,
                metadata={'multimodal': True, 'image_count': len(images)}
            )

        except Exception as e:
            logger.error(f"Gemini multimodal API error: {e}")
            raise
