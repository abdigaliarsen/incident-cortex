# Blog Scrape: Voice Agents with Elastic Agent Builder
Source: https://www.elastic.co/search-labs/blog/build-voice-agents-elastic-agent-builder

## Architecture Overview

Voice pipeline architecture combining speech-to-text, LLM processing, and text-to-speech components (not end-to-end speech-to-speech).

## Core Components

### Transcription (Speech-to-Text)
Audio frame conversion to text. Buffers until speech completion detected, then initiates LLM generation.
Providers: AssemblyAI, Deepgram, OpenAI, ElevenLabs (all support streamed transcripts).

### Turn Detection
Voice Activity Detection (VAD) models like Silero VAD analyze audio energy levels. Integrates with end-of-utterance prediction models (livekit/turn-detector, pipecat-ai/smart-turn-v3).

### Agent Core
Elastic Agent Builder provides built-in reasoning, tool libraries, and workflow integration for data-aware agent behavior.

### LLM Selection
Two critical characteristics:
- Reasoning benchmarks (MT-Bench, Humanity's Last Exam)
- Time to First Token (TTFT) for latency

### Text-to-Speech
Providers: ElevenLabs, Cartesia, Rime. Lower Time to First Byte (TTFB) reduces turn latency.

## Integration Approaches (3 Levels)

1. **Tools only**: STT -> LLM with Agent Builder tools -> TTS
2. **MCP access**: STT -> LLM with Agent Builder via MCP -> TTS
3. **Core approach**: STT -> Agent Builder -> TTS

Implementation uses LiveKit orchestrating transcription, turn detection, and synthesis while a custom LLM node integrates with Agent Builder.

## ElasticSport Implementation Example

### Data Tools Used

**Product.search**: Semantic matching across 65-product catalog using hybrid search on `semantic_text` fields, `.rerank-v1-elasticsearch` inference for top 20 results, returns 5 most relevant.

**Knowledgebase.search**: Semantic search on knowledge base documents (title + content as semantic_text).

**Orders.search**: Retrieves order details by order_id through ES|QL matching.

### Workflow Example
SMS workflow: agents send caller information via Twilio API during conversations by triggering HTTP POST requests.

### Voice-Specific Prompt Design
- Personality-defining prompts ensuring proper audio synthesis
- Graceful error recovery instructions
- Voice-optimized response formatting

## Getting Started
GitHub repo: elastic_agent_builder_livekit
Requires AGENT_ID configuration and Kibana instance connectivity.
