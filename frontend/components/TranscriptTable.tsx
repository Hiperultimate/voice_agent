'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { User, Bot, Clock } from 'lucide-react';
import { SessionStateProps } from '@/types';

interface Turn {
  role: 'user' | 'bot';
  text: string;
  timestamp: number;
  latency_ms?: number; // Optional for now
}

export default function TranscriptTable(
    {
      sessionId,
      setSessionId,
    }: SessionStateProps
) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the JSON file from the backend
    if(!sessionId){
        return
    }
    axios.get(`http://localhost:8000/session/${sessionId}/data`)
      .then(res => {
        setTurns(res.data.turns || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load transcript", err);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) return <div className="text-center p-4">Loading transcript...</div>;

  return (
    <div className="w-full max-w-2xl bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-3 border-b flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">Turns</h3>
        <span className="text-xs text-gray-400 uppercase tracking-wider">Session: {sessionId.slice(0,6)}</span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase">
        <div className="col-span-2">Speaker</div>
        <div className="col-span-8">Text</div>
        <div className="col-span-2 text-right">Latency</div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-100">
        {turns.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No transcript available.</div>
        ) : (
          turns.map((turn, index) => (
            <div key={index} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
              
              {/* Column 1: Speaker */}
              <div className="col-span-2 flex items-center gap-2">
                {turn.role === 'user' ? (
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded-full">
                    <User size={14} />
                  </div>
                ) : (
                  <div className="p-1.5 bg-green-100 text-green-600 rounded-full">
                    <Bot size={14} />
                  </div>
                )}
                <span className="text-sm font-medium capitalize text-gray-700">{turn.role}</span>
              </div>

              {/* Column 2: Text */}
              <div className="col-span-8 text-sm text-gray-600 leading-relaxed">
                {turn.text}
              </div>

              {/* Column 3: Latency (Placeholder for now) */}
              <div className="col-span-2 text-right flex items-center justify-end text-xs text-gray-400 font-mono">
                {turn.latency_ms ? (
                  <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    <Clock size={10} /> {turn.latency_ms}ms
                  </span>
                ) : '-'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}