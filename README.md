# Technical Write-up: AI Voice Agent with Freeze Detection

### 1. Implementation Approach
The application is built using a decoupled Fullstack architecture:
*   **Backend (Python/FastAPI):** Built on the **Pipecat** framework using a modular pipeline.
    *   **Latency Tracking:** I used a custom "Shared Whiteboard" pattern (`SessionData`). By placing specific `FrameProcessors` at different stages (STT, LLM, TTS), I captured 4 precise timestamps (T1-T4) to calculate STT processing time, LLM Time-to-First-Token, and TTS playback latency.
    *   **Freeze Simulation:** I implemented a `FreezeProcessor` sitting before the output transport. It uses a "Frame Dropping" strategy: when frozen, it stops the audio packets from reaching the user.
    *   **Data Sync:** To make sure the transcript matches the audio player, I captured an `audio_start_time` anchor. Since the JSON uses Unix timestamps, the frontend uses this anchor to "reset" the clock to 0.0s so the labels line up perfectly with the audio.

*   **Frontend (Next.js/TS):** 
    *   **Interaction:** Used the `@pipecat-ai/client-js` SDK to handle the microphone and speaker.
    *   **Visualization:** Leveraged **WaveSurfer.js v7**. I built a polling system that waits for the backend to finish writing the audio file before showing the player to the user.

### 2. Technical Observations
*   **The 0ms STT Latency (Simplified):** You might notice STT latency is often 0ms. This is often because Deepgram returns final transcripts before VAD signals end-of-speech. By the time the system's "Silence Detector" (VAD) realized you finished speaking, the text was already there. Since there is no waiting time, the latency is zero.
*   **Audio Synchronization:** I found that audio in a streaming pipeline has "travel time." If you record audio at the end of the pipeline, it sounds slightly delayed compared to the timestamps. I addressed this by carefully placing the recorder to minimize this "lag" on the waveform (Ref: [GitHub Issue #3150](https://github.com/pipecat-ai/pipecat/issues/3150)).

### 3. Trade-offs & Challenges
*   **Raw Pipeline vs. RTVI:** Based on my research, I chose to use the **Raw Pipecat Pipeline** because it promised more control over the audio frames. 
    *   *The Result:* This gave me the control I wanted, but it was much harder than expected. Pipecat is very strict about how audio bytes are timed. When I tried to manually change the audio (like adding silence), it caused bugs and transport errors. The framework expects a very specific sequence to keep the sound smooth.
*   **Freeze Strategy (Drop vs. Mute):** 
    *   *What I tried:* I tried to "Mute" the bot by sending silent data so the recording stayed the same length. 
    *   *What happened:* This caused bugs in the audio transport. 
    *   *Final Decision:* I chose to "Drop" the frames instead. This keeps the system stable, even though it causes a "fast-forward" effect in the final recording where the frozen time is skipped.
*   **Local File Storage:** Used local `.wav` and `.json` files. *Trade-off:* Simplifies the assignment for a 2-day timeline while avoiding the overhead of setting up S3 or a database, while remaining easy to swap for a cloud provider in the future.

### 4. Future Improvements
*   **Fixing the "Fast-Forward" Freeze:** As discussed in Pipecat Issue #3150, preventing the audio from skipping during a freeze requires deep investigation into the framework's clock-sync logic. A future version would use a "Silent Frame Generator" to keep time moving without breaking the transport.
*   **Multi-Recorder Architecture:** To solve "Pipeline Lag," I would implement a two-recorder system. One would record the User's voice at the very start (the input), and one would record the Bot's voice at the TTS stage. Merging these two separate files at the end would produce a 100% accurate recording with zero processing delay.
*   **WebRTC Integration:** Switching from WebSockets to WebRTC. WebRTC is built for real-time media and handles internet "hiccups" better, which would make the voice feel even more natural and reduce the "robotic" lag. May fix some latency issues as well.
*   **Stereo Audio:** Recording the user on the left side and the bot on the right side. This makes it much easier to see exactly when someone was interrupted during a review.
*   **Decoupled Media Recording Service:** To fully resolve the synchronization and "Fast-Forwarding" issues during freezes, I would transition to a dedicated Media Recording Service. Instead of recording within the Pipecat pipeline (where processing lag affects the file), the pipeline would stream audio to an external recorder. This recorder would use an independent wall-clock to detect gaps in the incoming stream and automatically inject "Digital Silence" in real-time. This decoupling ensures that the final `.wav` file duration perfectly matches the session wall-clock time, regardless of any internal AI pipeline delays or simulated freezes.

---

### PR Message Summary:

**Description:**
Implemented a voice agent with Gemini LLM that features custom freeze simulation and detailed latency metrics.

**Key Fixes & Research:**
- **Pipeline Logic:** Researched and chose Raw Pipeline over RTVI for granular frame control.
- **Clock Sync:** Handled the "Pipeline Delay" issue by optimizing processor placement to ensure audio and timestamps match.
- **Simplified Latency:** Documented why STT latency is 0ms (Deepgram's speed vs. VAD silence detection).
- **Freeze Behavior:** Implemented a stable "Frame Drop" freeze after discovering that manual byte manipulation in the raw pipeline leads to transport instability (Issue #3150).

**Improvements noted:**
- Current freeze implementation causes audio "fast-forwarding" in the recording; needs further Pipecat clock-sync investigation.
- Suggested a multi-recorder setup to further eliminate processing lag from the final WAV file.