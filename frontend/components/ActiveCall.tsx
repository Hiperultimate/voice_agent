"use client";

import {
  useEffect,
  useState,
  useCallback,
  Dispatch,
  SetStateAction,
} from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import {
  WebSocketTransport,
  ProtobufFrameSerializer,
} from "@pipecat-ai/websocket-transport";
import { Mic, PhoneOff, Loader2 } from "lucide-react";
import axios from "axios";
import { SessionStateProps } from "@/types";

export default function ActiveCall({sessionId, setSessionId}: SessionStateProps) {
  const [client, setClient] = useState<PipecatClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const transport = new WebSocketTransport({
      serializer: new ProtobufFrameSerializer(),
    });

    const pcClient = new PipecatClient({
      transport,
      enableMic: true,
      enableCam: false,
      callbacks: {
        onConnected: () => {
          setIsConnected(true);
          setIsConnecting(false);
        },
        onDisconnected: () => {
          setIsConnected(false);
          setIsConnecting(false);

          // notify backend that the session ID is over
        },
      },
    });

    setClient(pcClient);

    return () => {
      pcClient.disconnect();
    };
  }, []);

  const startCall = useCallback(async () => {
    if (!client) return;
    setIsConnecting(true);

    try {
      const res = await axios.post("http://localhost:8000/start-session");

      const data = await res.data;
      setSessionId(data.session_id);

      await client.connect({ wsUrl: data.url });
    } catch (err) {
      console.error("Failed to connect:", err);
      alert("Could not connect to backend. Is it running?");
    }
  }, [client]);

  const endCall = useCallback(async () => {
    if (client) {
      await client.disconnect();
    }
  }, [client]);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-xl border w-full max-w-sm">
      <div
        className={`mb-8 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
          isConnected
            ? "bg-green-100 shadow-[0_0_30px_rgba(34,197,94,0.3)]"
            : "bg-gray-100"
        }`}
      >
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
          }`}
        >
          <Mic className="text-white w-10 h-10" />
        </div>
      </div>

      <h2 className="text-xl font-bold mb-6 text-gray-800">
        {isConnected ? "Voice Agent Active" : "Ready to Chat"}
      </h2>

      {!isConnected ? (
        <button
          onClick={startCall}
          disabled={isConnecting}
          className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isConnecting ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Mic size={18} />
          )}
          Start Conversation
        </button>
      ) : (
        <button
          onClick={endCall}
          className="w-full py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition flex items-center justify-center gap-2"
        >
          <PhoneOff size={18} />
          End Call
        </button>
      )}
    </div>
  );
}
