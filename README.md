# Technical Write-up: AI Voice Agent with Freeze Detection

### 1. Implementation Approach
The application is built using a decoupled Fullstack architecture:
*   **Backend (Python/FastAPI):** Built on the **Pipecat** framework using a modular pipeline.
    * **Latency Tracking:** I used a custom pattern to explicitly track timing across the pipeline. By placing lightweight `FrameProcessors` at key boundaries, I captured four wall-clock timestamps:
        * **T1:** `UserStoppedSpeakingFrame` (user finished speaking)
        * **T2:** `TranscriptionFrame` (final STT text available)
        * **T3:** First `TextFrame` from the LLM (time-to-first-token)
        * **T4:** `BotStartedSpeakingFrame` (actual audio playback start)  
        From these timestamps, the following latencies are derived:

            - **STT latency** = T2 − T1  
            - **LLM latency (TTFT)** = T3 − T2  
            - **TTS latency** = T4 − T3  

        This makes each stage of the pipeline observable and allows precise alignment between transcript, latency regions, and recorded audio in the frontend waveform.

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
*   **Local File Storage:** Used local `.wav` for audio and `.json` files for timeline. *Trade-off:* Simplifies the assignment for a 2-day timeline while avoiding the overhead of setting up S3 or a database, while remaining easy to swap for a cloud provider in the future.

### 4. Future Improvements
*   **Fixing the "Fast-Forward" Freeze:** As discussed in Pipecat Issue #3150, preventing the audio from skipping during a freeze requires deep investigation into the framework's clock-sync logic. A future version would use a "Silent Frame Generator" to keep time moving without breaking the transport.
*   **Multi-Recorder Architecture:** To solve "Pipeline Lag," I would implement a two-recorder system. One would record the User's voice at the very start (the input), and one would record the Bot's voice at the TTS stage. Merging these two separate files at the end would produce a 100% accurate recording with zero processing delay.
*   **WebRTC Integration:** Switching from WebSockets to WebRTC. WebRTC is built for real-time media and handles internet "hiccups" better, which would make the voice feel even more natural and reduce the "robotic" lag. May fix some latency issues as well.
*   **Stereo Audio:** Recording the user on the left side and the bot on the right side. This makes it much easier to see exactly when someone was interrupted during a review.
*   **Decoupled Media Recording Service:** To fully resolve the synchronization and "Fast-Forwarding" issues during freezes, I would transition to a dedicated Media Recording Service. Instead of recording within the Pipecat pipeline (where processing lag affects the file), the pipeline would stream audio to an external recorder. This recorder would use an independent wall-clock to detect gaps in the incoming stream and automatically inject "Digital Silence" in real-time. This decoupling ensures that the final `.wav` file duration perfectly matches the session wall-clock time, regardless of any internal AI pipeline delays or simulated freezes.
* **Pipecat Turn Latency:** Pipecat provides a built-in turn latency observer that measures end-to-end conversational turn timing. For this implementation, I intentionally chose a custom latency-tracking approach to keep the system easier to reason about while learning the framework and debugging pipeline behavior.
A future improvement would be to integrate Pipecat’s native turn latency observer and **compare its results against the custom stage-level metrics implemented here**. Depending on stability and accuracy under real streaming conditions, the system could either:
    - Use the built-in observer for standardized turn metrics, or  
    - Continue using custom timestamps for fine-grained, stage-specific visibility.

    The final choice would depend on whether detailed per-stage insight or framework-level consistency is more valuable for the product.
