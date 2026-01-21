import os
import sys
import time
import json
import wave

# Pipecat imports
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.frames.frames import (Frame, TranscriptionFrame, TextFrame, UserStartedSpeakingFrame, UserStoppedSpeakingFrame, LLMFullResponseStartFrame, LLMFullResponseEndFrame, BotStartedSpeakingFrame, BotStoppedSpeakingFrame)
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.serializers.protobuf import ProtobufFrameSerializer
from pipecat.processors.audio.audio_buffer_processor import AudioBufferProcessor
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketTransport,
    FastAPIWebsocketParams,
)

from loguru import logger
from dotenv import load_dotenv

load_dotenv()

logger.remove()
logger.add(sys.stderr, level="DEBUG")

class SessionData:
    """Holds the data shared between the UserRecorder and BotRecorder."""
    def __init__(self, session_id):
        self.session_id = session_id
        self.turns = []

        self.audio_start_time = 0.0
        self.start_time = time.time() 

        self.t1_user_stop = 0.0     
        self.t2_transcript = 0.0     
        self.t3_llm_start = 0.0      

    def save_json(self):
        # later on we can change this code to save transcription inside a DB as jsonb or as blob in s3
        os.makedirs("data", exist_ok=True)
        file_path = f"data/{self.session_id}.json"
        try:
            with open(file_path, "w") as f:
                json.dump({
                    "session_id": self.session_id,
                    "start_time": self.start_time, 
                    "audio_start_time": self.audio_start_time,
                    "turns": self.turns
                    }, f, indent=2 )
            logger.info(f"Transcript saved to {file_path}")
        except Exception as e:
            logger.error(f"Failed to save JSON: {e}")

class UserRecorder(FrameProcessor):
    def __init__(self, data: SessionData):
        super().__init__()
        self.data = data
        self._user_buffer = []
        self._start_time = 0

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        now = time.time()

        if isinstance(frame, UserStartedSpeakingFrame):
            self._user_buffer = []
            self._start_time = now
            
        elif isinstance(frame, TranscriptionFrame):
            self.data.t2_transcript = now

            text = frame.text.strip()
            if text:
                self._user_buffer.append(text)

        elif isinstance(frame, UserStoppedSpeakingFrame):
            self.data.t1_user_stop = now

            if self._user_buffer:
                full_text = " ".join(self._user_buffer).strip()
                if full_text:
                    logger.info(f"User Turn: {full_text}")
                    self.data.turns.append({
                        "role": "user",
                        "start": self._start_time or now,
                        "end" : now,
                        "metadata" : {"text" : full_text}
                    })
            self._user_buffer = []

        await self.push_frame(frame, direction)

class BotRecorder(FrameProcessor):
    def __init__(self, data: SessionData):
        super().__init__()
        self.data = data
        self._bot_buffer = []
        self._start_time = 0
        self._is_first_token = True

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        now = time.time()

        if isinstance(frame, LLMFullResponseStartFrame):
            self._bot_buffer = []
            self._is_first_token = now

        elif isinstance(frame, TextFrame):
            self._bot_buffer.append(frame.text)

            if ( self._is_first_token
                    and self.data.t1_user_stop > 0
                    and self.data.t2_transcript > 0 ):
                self._start_time = now
                self._is_first_token = False
                self.data.t3_llm_start = now # Save T3
                
                # Calculating LLM Latency here
                stt_latency_ms = stt_latency_ms = round(
                    max(0, (self.data.t2_transcript - self.data.t1_user_stop) * 1000)
                )
                llm_latency_ms = round((now - self.data.t2_transcript) * 1000)

                latency_start_time = self.data.t1_user_stop if self.data.t1_user_stop > 0 else now
                
                self.data.turns.append({
                    "role": "latency",
                    "start" : latency_start_time, 
                    "end" : 0,
                    "metadata": {
                        "stt": stt_latency_ms,
                        "llm": llm_latency_ms, 
                        "tts": 0 # to be calculated later on
                    }
                })

        elif isinstance(frame, LLMFullResponseEndFrame):
            if self._bot_buffer:
                full_text = "".join(self._bot_buffer).strip()
                if full_text:
                    logger.info(f"Bot Turn: {full_text}")
                    self.data.turns.append({
                        "role": "bot",
                        "start": self._start_time or now,
                        "end": now,
                        "metadata": {"text": full_text},
                    })
            self._bot_buffer = []

        await self.push_frame(frame, direction)

class TTSRecorder(FrameProcessor):
    def __init__(self, data: SessionData):
        super().__init__()
        self.data = data
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        now = time.time()
        if isinstance(frame, BotStartedSpeakingFrame):

            if len(self.data.turns) >= 2:
                bot_turn = self.data.turns[-1]
                latency_turn = self.data.turns[-2]

                if bot_turn["role"] == "bot" and latency_turn["role"] == "latency":
                    
                    # Calculate TTS Latency
                    if self.data.t3_llm_start > 0:
                        tts_latency = now - self.data.t3_llm_start
                        
                        # Store it in the latency turn metadata
                        latency_turn.setdefault("metadata", {})
                        latency_turn["metadata"]["tts"] = round(max(0, tts_latency * 1000))

                    # Update the Green Box to start exactly when sound starts
                    bot_turn["start"] = now

        if isinstance(frame, BotStoppedSpeakingFrame):
            if self.data.turns:
                last_turn = self.data.turns[-1]
                if last_turn["role"] == "bot":
                    last_turn["end"] = now

        await self.push_frame(frame, direction)

async def run_bot(websocket_client, session_id):
    logger.info(f"Starting bot for session: {session_id}")

    transport = FastAPIWebsocketTransport(
        websocket=websocket_client,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            vad_analyzer=SileroVADAnalyzer(),
            vad_audio_passthrough=True,
            serializer=ProtobufFrameSerializer(),
        ),
    )

    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))
    
    llm = GoogleLLMService(
        api_key=os.getenv("GOOGLE_API_KEY"),
    )
    
    tts = CartesiaTTSService(
        api_key=os.getenv("CARTESIA_API_KEY"),
        voice_id="5ee9feff-1265-424a-9d7f-8e4d431a12c7", 
    )

    messages = [
        {
            "role": "system",
            "content": "You are a helpful and concise voice assistant.",
        }
    ]
    context = LLMContext(messages)
    context_aggregator = LLMContextAggregatorPair(context)
    
    audiobuffer = AudioBufferProcessor(
        num_channels=1,               # 1 for mono, 2 for stereo (user left, bot right)
        enable_turn_audio=False,      # Enable per-turn audio recording
        user_continuous_stream=False,  # User has continuous audio stream
        buffer_size=5 * 1024 * 1024
    )

    session_data = SessionData(session_id)
    user_recorder = UserRecorder(session_data)
    bot_recorder = BotRecorder(session_data)
    tts_recorder = TTSRecorder(session_data)

    pipeline = Pipeline(
        [
            transport.input(),           # In from Mic
            stt,                         # Speech -> Text
            user_recorder,               # Saves user sst text
            context_aggregator.user(),   # Log User Text
            llm,                         # Text -> Text | Generating reply
            bot_recorder,                # Saves bot tts text
            tts,                         # Text -> Audio
            tts_recorder,                # tts latency
            transport.output(),          # Out to Speaker
            audiobuffer,                 # Recorder
            context_aggregator.assistant(), # Log Bot Text
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,
        ),
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        session_data.audio_start_time = time.time()
        logger.info(f"Client connected")
        await audiobuffer.start_recording()
    
    @audiobuffer.event_handler("on_audio_data")
    async def on_audio_data(buffer, audio_bytes, sample_rate, num_channels):
        with wave.open(f"data/{session_id}.wav", "wb") as wf:
            wf.setnchannels(num_channels)
            wf.setsampwidth(2)           # 16-bit PCM
            wf.setframerate(sample_rate)
            wf.writeframes(audio_bytes)


    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected session {session_id}. Killing pipeline.")
        await task.cancel()

    runner = PipelineRunner()

    try:
        await runner.run(task)
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
    finally:
        logger.info("Session ended. Saving data immediately.")
        session_data.save_json()