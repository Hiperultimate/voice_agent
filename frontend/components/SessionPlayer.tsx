'use client'

import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import { Play, Pause, Loader2, RefreshCw } from 'lucide-react'
import axios from 'axios'
import { SessionStateProps } from '@/types'

export default function SessionPlayer({ sessionId }: SessionStateProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!sessionId || !containerRef.current) return

    let mounted = true
    let attempts = 0
    const maxAttempts = 30 // Increased to 30 seconds for safety
    let retryTimer: NodeJS.Timeout

    const init = async () => {
      try {
        // Add timestamp to prevent browser caching of 404s
        const cacheBuster = new Date().getTime()
        const audioUrl = `http://localhost:8000/session/${sessionId}/audio`
        const dataUrl = `http://localhost:8000/session/${sessionId}/data?t=${cacheBuster}`

        console.log(`Polling session data... Attempt ${attempts + 1}`)

        // 1. Fetch JSON Data
        const dataRes = await axios.get(dataUrl)
        
        // 2. Check Audio Existence (Using GET instead of HEAD for stability)
        // We catch the error specifically for this request to allow retrying
        await axios.get(audioUrl, { params: { t: cacheBuster } })

        if (!mounted) return

        // 3. Cleanup previous instance
        if (wavesurferRef.current) {
          wavesurferRef.current.destroy()
        }

        // 4. Create WaveSurfer
        const ws = WaveSurfer.create({
          container: containerRef.current!,
          waveColor: '#E5E7EB',
          progressColor: '#3B82F6',
          cursorColor: '#EF4444',
          height: 100,
          barWidth: 2,
          barGap: 1,
          normalize: true,
          backend: 'MediaElement', // Key for streaming
          minPxPerSec: 100, // 1 second = 100px wide. Makes it scrollable.
          autoScroll: true, // Follow the cursor
          fillParent: true,
        })

        // 5. Plugins
        const regions = ws.registerPlugin(RegionsPlugin.create())

        ws.registerPlugin(
          TimelinePlugin.create({
            height: 20,
            timeInterval: 0.1,
            primaryLabelInterval: 1,
            secondaryLabelInterval: 0.5,
            style: {
              fontSize: '10px',
              color: '#6B7280',
            },
          })
        )

        // 6. Draw Regions 
        const { turns, audio_start_time } = dataRes.data
        const audioStart = audio_start_time ?? 0

        ws.on('ready', () => {
          const duration = ws.getDuration()

          turns.forEach((turn: any, index: number) => {
            const start = Math.max(0, turn.start - audioStart)

            // USER / BOT turns
            if (
              (turn.role === 'user' || turn.role === 'bot') &&
              turn.end > turn.start
            ) {
              const end = Math.min(turn.end - audioStart, duration)

              if (end > start) {
                regions.addRegion({
                  start,
                  end,
                  drag: false,
                  resize: false,
                  color:
                    turn.role === 'user'
                      ? 'rgba(59,130,246,0.2)'
                      : 'rgba(34,197,94,0.2)',
                })
              }
            }

            // LATENCY turns
            if (turn.role === 'latency') {
              const next = turns[index + 1]
              if (!next) return

              const end = Math.max(0, next.start - audioStart)

              if (end > start) {
                regions.addRegion({
                  start,
                  end,
                  drag: false,
                  resize: false,
                  color: 'rgba(249,115,22,0.35)',
                })
              }
            }
          })
        })

        ws.on('ready', () => {
          if (mounted) setStatus('ready')
        })

        ws.on('finish', () => setIsPlaying(false))
        ws.on('error', (e) => {
            console.error("WaveSurfer error:", e)
            // If audio decode fails, we might want to retry init or just log
        })

        // 7. Load Audio
        ws.load(audioUrl)
        wavesurferRef.current = ws

      } catch (err) {
        attempts++
        // Log clean error message
        console.log(`Polling failed (Attempt ${attempts}):`, err)
        
        if (attempts < maxAttempts && mounted) {
          retryTimer = setTimeout(init, 1000)
        } else if (mounted) {
          console.error("Max retries reached. Audio unavailable.")
          setStatus('error')
        }
      }
    }

    setStatus('loading')
    init()

    return () => {
      mounted = false
      clearTimeout(retryTimer)
      wavesurferRef.current?.destroy()
    }
  }, [sessionId])

  const togglePlay = () => {
    wavesurferRef.current?.playPause()
    setIsPlaying((p) => !p)
  }

  // --- RENDER ---

  if (!sessionId) return null

  if (status === 'error') {
    return (
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-sm border p-8 mb-6 flex flex-col items-center justify-center text-red-500 gap-2">
        <RefreshCw size={24} />
        <p className="font-medium">Recording unavailable</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl bg-white rounded-xl shadow-sm border p-6 mb-6">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-gray-800">Recording</h3>
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full animate-pulse">
            <Loader2 size={12} className="animate-spin" />
            Processing Audio...
          </div>
        )}
      </div>

      {/* Waveform Container */}
      <div 
        className={`relative border rounded-xl bg-gray-50/50 p-4 transition-opacity duration-700 ${
          status === 'ready' ? 'opacity-100' : 'opacity-50 pointer-events-none'
        }`}
      >
        <div ref={containerRef} />
      </div>

      {/* Controls */}
      <div className="flex justify-center mt-6">
        <button
          onClick={togglePlay}
          disabled={status !== 'ready'}
          className={`
            w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
            ${status === 'ready' 
              ? 'bg-black text-white hover:bg-gray-800 hover:scale-105 active:scale-95' 
              : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}
          `}
        >
          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
        </button>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-8 mt-6 border-t pt-6">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded-sm" /> User
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <span className="w-3 h-3 bg-orange-100 border border-orange-300 rounded-sm" /> Latency
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <span className="w-3 h-3 bg-green-100 border border-green-300 rounded-sm" /> Bot
        </div>
      </div>
    </div>
  )
}