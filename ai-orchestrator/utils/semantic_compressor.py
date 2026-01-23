"""
Semantic Compressor
Handles context compression to manage token limits across synthesis rounds.
"""

import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import hashlib

logger = logging.getLogger('Semantic-Compressor')


@dataclass
class CompressedContent:
    """Represents compressed content with metadata."""
    original_length: int
    compressed_length: int
    compression_ratio: float
    content: str
    key_points: List[str]
    metadata: Dict


class SemanticCompressor:
    """
    Compresses content while preserving semantic meaning.

    Strategies:
    1. Extract key points and summaries
    2. Remove redundant information
    3. Chunk large content into manageable pieces
    4. Progressive summarization for multi-round contexts
    """

    # Approximate tokens per character (rough estimate)
    CHARS_PER_TOKEN = 4

    def __init__(self, max_tokens: int = 8000):
        self.max_tokens = max_tokens
        self.max_chars = max_tokens * self.CHARS_PER_TOKEN

    def estimate_tokens(self, text: str) -> int:
        """Estimate token count from text."""
        return len(text) // self.CHARS_PER_TOKEN

    def needs_compression(self, text: str) -> bool:
        """Check if text exceeds token limit."""
        return self.estimate_tokens(text) > self.max_tokens

    def compress(self, text: str, preserve_code: bool = True) -> CompressedContent:
        """
        Compress text while preserving key information.

        Args:
            text: Content to compress
            preserve_code: Whether to preserve code blocks intact

        Returns:
            CompressedContent with compressed text and metadata
        """
        original_length = len(text)

        if not self.needs_compression(text):
            return CompressedContent(
                original_length=original_length,
                compressed_length=original_length,
                compression_ratio=1.0,
                content=text,
                key_points=[],
                metadata={'strategy': 'none'}
            )

        # Extract and preserve code blocks if requested
        code_blocks = []
        if preserve_code:
            text, code_blocks = self._extract_code_blocks(text)

        # Apply compression strategies
        compressed = text

        # 1. Remove excessive whitespace
        compressed = self._normalize_whitespace(compressed)

        # 2. Extract key points
        key_points = self._extract_key_points(compressed)

        # 3. Remove redundant sections
        compressed = self._remove_redundancy(compressed)

        # 4. Summarize long sections
        if self.estimate_tokens(compressed) > self.max_tokens * 0.8:
            compressed = self._summarize_sections(compressed)

        # 5. Truncate if still too long
        if self.estimate_tokens(compressed) > self.max_tokens:
            compressed = self._smart_truncate(compressed, key_points)

        # Restore code blocks
        if code_blocks:
            compressed = self._restore_code_blocks(compressed, code_blocks)

        compressed_length = len(compressed)

        return CompressedContent(
            original_length=original_length,
            compressed_length=compressed_length,
            compression_ratio=compressed_length / original_length if original_length > 0 else 1.0,
            content=compressed,
            key_points=key_points,
            metadata={
                'strategy': 'multi-pass',
                'code_blocks_preserved': len(code_blocks),
                'tokens_saved': self.estimate_tokens(text) - self.estimate_tokens(compressed)
            }
        )

    def _extract_code_blocks(self, text: str) -> Tuple[str, List[Dict]]:
        """Extract code blocks and replace with placeholders."""
        code_blocks = []
        pattern = r'```[\w]*\n[\s\S]*?```'

        def replace_block(match):
            block_id = f"__CODE_BLOCK_{len(code_blocks)}__"
            code_blocks.append({
                'id': block_id,
                'content': match.group(0),
                'hash': hashlib.md5(match.group(0).encode()).hexdigest()[:8]
            })
            return block_id

        processed = re.sub(pattern, replace_block, text)
        return processed, code_blocks

    def _restore_code_blocks(self, text: str, code_blocks: List[Dict]) -> str:
        """Restore code blocks from placeholders."""
        for block in code_blocks:
            text = text.replace(block['id'], block['content'])
        return text

    def _normalize_whitespace(self, text: str) -> str:
        """Normalize whitespace while preserving structure."""
        # Remove multiple blank lines
        text = re.sub(r'\n{3,}', '\n\n', text)
        # Remove trailing whitespace
        text = re.sub(r'[ \t]+$', '', text, flags=re.MULTILINE)
        # Normalize spaces
        text = re.sub(r'[ \t]+', ' ', text)
        return text.strip()

    def _extract_key_points(self, text: str) -> List[str]:
        """Extract key points from text."""
        key_points = []

        # Look for bullet points
        bullets = re.findall(r'^[\s]*[-*•]\s+(.+)$', text, re.MULTILINE)
        key_points.extend(bullets[:10])

        # Look for numbered items
        numbered = re.findall(r'^[\s]*\d+[.)]\s+(.+)$', text, re.MULTILINE)
        key_points.extend(numbered[:10])

        # Look for headers
        headers = re.findall(r'^#+\s+(.+)$', text, re.MULTILINE)
        key_points.extend(headers[:5])

        # Look for important markers
        important = re.findall(
            r'(?:important|key|critical|note|warning|must|should)[:]\s*(.+?)(?:\.|$)',
            text, re.IGNORECASE
        )
        key_points.extend(important[:5])

        # Deduplicate while preserving order
        seen = set()
        unique_points = []
        for point in key_points:
            point_clean = point.strip()[:100]
            if point_clean.lower() not in seen:
                seen.add(point_clean.lower())
                unique_points.append(point_clean)

        return unique_points[:15]

    def _remove_redundancy(self, text: str) -> str:
        """Remove redundant or repetitive content."""
        # Split into paragraphs
        paragraphs = text.split('\n\n')

        if len(paragraphs) <= 3:
            return text

        # Calculate similarity between paragraphs
        unique_paragraphs = []
        seen_hashes = set()

        for para in paragraphs:
            # Simple hash for similarity detection
            para_hash = hashlib.md5(
                re.sub(r'\s+', '', para.lower()).encode()
            ).hexdigest()[:16]

            # Also check for high word overlap
            para_words = set(para.lower().split())
            is_duplicate = False

            for prev_hash, prev_words in seen_hashes:
                if para_hash == prev_hash:
                    is_duplicate = True
                    break
                # Check word overlap
                if len(para_words) > 5 and len(prev_words) > 5:
                    overlap = len(para_words & prev_words) / min(len(para_words), len(prev_words))
                    if overlap > 0.8:
                        is_duplicate = True
                        break

            if not is_duplicate:
                unique_paragraphs.append(para)
                seen_hashes.add((para_hash, para_words))

        return '\n\n'.join(unique_paragraphs)

    def _summarize_sections(self, text: str) -> str:
        """Summarize long sections."""
        # Split by headers
        sections = re.split(r'(^#+\s+.+$)', text, flags=re.MULTILINE)

        result = []
        for i, section in enumerate(sections):
            if section.startswith('#'):
                result.append(section)
            elif len(section) > 500:
                # Keep first and last parts, summarize middle
                lines = section.strip().split('\n')
                if len(lines) > 10:
                    kept_lines = lines[:4] + ['...'] + lines[-3:]
                    result.append('\n'.join(kept_lines))
                else:
                    result.append(section)
            else:
                result.append(section)

        return '\n'.join(result)

    def _smart_truncate(self, text: str, key_points: List[str]) -> str:
        """Truncate text while preserving key points."""
        max_chars = self.max_chars - 200  # Leave buffer

        if len(text) <= max_chars:
            return text

        # Keep beginning and end
        beginning = text[:max_chars // 2]
        end = text[-max_chars // 4:]

        # Create summary of middle
        middle_summary = "\n\n[... Content compressed. Key points preserved ...]\n\n"

        if key_points:
            middle_summary += "### Key Points:\n"
            for point in key_points[:7]:
                middle_summary += f"- {point}\n"
            middle_summary += "\n"

        return beginning + middle_summary + end

    def chunk_content(self, text: str, chunk_size: int = 4000) -> List[str]:
        """
        Split content into manageable chunks for processing.

        Args:
            text: Content to chunk
            chunk_size: Maximum tokens per chunk

        Returns:
            List of content chunks
        """
        max_chars = chunk_size * self.CHARS_PER_TOKEN
        chunks = []

        # Try to split on natural boundaries
        paragraphs = text.split('\n\n')
        current_chunk = []
        current_length = 0

        for para in paragraphs:
            para_length = len(para)

            if current_length + para_length > max_chars and current_chunk:
                chunks.append('\n\n'.join(current_chunk))
                current_chunk = []
                current_length = 0

            if para_length > max_chars:
                # Split large paragraph
                words = para.split()
                word_chunk = []
                word_length = 0

                for word in words:
                    if word_length + len(word) > max_chars and word_chunk:
                        current_chunk.append(' '.join(word_chunk))
                        chunks.append('\n\n'.join(current_chunk))
                        current_chunk = []
                        word_chunk = []
                        word_length = 0
                        current_length = 0

                    word_chunk.append(word)
                    word_length += len(word) + 1

                if word_chunk:
                    current_chunk.append(' '.join(word_chunk))
                    current_length += word_length
            else:
                current_chunk.append(para)
                current_length += para_length

        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))

        return chunks

    def merge_responses(self, responses: List[str],
                        max_tokens: int = None) -> str:
        """
        Merge multiple AI responses while managing size.

        Args:
            responses: List of response texts
            max_tokens: Maximum tokens for merged result

        Returns:
            Merged and compressed content
        """
        if max_tokens is None:
            max_tokens = self.max_tokens

        merged = "\n\n---\n\n".join(responses)

        if self.estimate_tokens(merged) <= max_tokens:
            return merged

        # Compress each response first
        compressed_responses = []
        tokens_per_response = max_tokens // len(responses)

        for resp in responses:
            if self.estimate_tokens(resp) > tokens_per_response:
                compressor = SemanticCompressor(max_tokens=tokens_per_response)
                compressed = compressor.compress(resp)
                compressed_responses.append(compressed.content)
            else:
                compressed_responses.append(resp)

        return "\n\n---\n\n".join(compressed_responses)
