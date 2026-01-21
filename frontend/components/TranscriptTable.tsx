'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { User, Bot, Loader2 } from 'lucide-react';
import { BackendTurn, SessionData, SessionStateProps } from '@/types';
import { formatTime } from '@/helperFns/formatTime';
import { isNull } from 'node:util';

export default function TranscriptTable({ sessionId }: SessionStateProps) {
  const [data, setData] = useState<SessionData | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');

  // Polling for transcript
  useEffect(() => {
    if (!sessionId) return;

    let attempts = 0;
    const maxAttempts = 10;
    let timeoutId: NodeJS.Timeout;

    const fetchTranscript = async () => {
      try {
        const res = await axios.get(`http://localhost:8000/session/${sessionId}/data`);
        setData(res.data || null);
        setStatus('success');
      } catch (err) {
        attempts++;
        if (attempts < maxAttempts) {
          timeoutId = setTimeout(fetchTranscript, 1000);
        } else {
          setStatus('error');
        }
      }
    };

    setStatus('loading');
    fetchTranscript();

    return () => clearTimeout(timeoutId);
  }, [sessionId]);

  // Calculate the Session Start Time (First turn timestamp)
  const turns = data?.turns || [];
  const sessionStart = data?.start_time || 0;

  if (status === 'loading') return <div className="text-center p-4"><Loader2 className="animate-spin inline mr-2"/>Generating transcript...</div>;
  if (status === 'error') return <div className="text-center p-4 text-red-500">Transcript not found.</div>;

  return (
    <div className="w-full max-w-3xl bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
      {/* ... Header and Table Header (Keep as is) ... */}
      <div className="divide-y divide-gray-100">
        {turns.map((turn, index) => {
          
          // Calculate Relative Time
          const relativeStart = Math.max(0, turn.start - sessionStart);
          const relativeEnd = turn.end > 0 ? Math.max(0, turn.end - sessionStart) : 0;

          if (turn.role === 'latency') {
             return (
                <div key={index} className="grid grid-cols-12 gap-4 px-6 py-2 bg-orange-50/30">
                  <div className="col-span-2"></div>
                  <div className="col-span-7 text-xs text-orange-400 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-orange-400"></span>
                    Processing...
                  </div>
                  <div className="col-span-3 text-right flex justify-end gap-3 text-[10px] font-mono text-gray-500">
                     <span title="Speech to Text">STT: {turn.metadata?.stt}ms</span>
                     <span title="LLM Generation">LLM: {turn.metadata?.llm}ms</span>
                     <span title="Text to Speech">TTS: {turn.metadata?.tts}ms</span>
                  </div>
                </div>
              );
          }

          const isUser = turn.role === 'user';
          return (
            <div key={index} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="col-span-2 flex items-center gap-2">
                <div className={`p-1.5 rounded-full ${isUser ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                  {isUser ? <User size={14} /> : <Bot size={14} />}
                </div>
                <span className="text-sm font-medium capitalize text-gray-700">{turn.role}</span>
              </div>

              <div className="col-span-7 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {turn.metadata?.text || "..."}
              </div>

              {/* Display Relative Timestamp */}
              <div className="col-span-3 text-right text-xs text-gray-400 font-mono flex flex-col justify-center">
                 <span>{formatTime(relativeStart)} - {turn.end !== 0 ? formatTime(relativeEnd) : '...'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}