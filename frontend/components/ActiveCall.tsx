"use client";

import {
  useEffect,
  useState,
  useCallback,
} from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import {
  WebSocketTransport,
  ProtobufFrameSerializer,
} from "@pipecat-ai/websocket-transport";
import { Mic, PhoneOff, Loader2, Snowflake } from "lucide-react";
import axios from "axios";
import { ActiveCallProps } from "@/types";

export default function ActiveCall({ sessionId, setSessionId, onCallEnd }: ActiveCallProps) {
  const [client, setClient] = useState<PipecatClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);

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
      setIsConnecting(false);
    }
  }, [client, setSessionId]);

  const endCall = useCallback(async () => {
    if (client) {
      await client.disconnect();
      onCallEnd();
    }
  }, [client, onCallEnd]);

  const sendFreezeMessage = useCallback(async () => {
    if (!sessionId || !client) return;

    try {
      const res = await axios.post(
        `http://localhost:8000/session/${sessionId}/freeze`,
        null,
        {
          params: { frozen: !isFrozen },
        }
      );

      if (res.data?.status === "success") {
        setIsFrozen(res.data.is_frozen);
      } else {
        console.error("Freeze toggle failed:", res.data);
      }
    } catch (err) {
      console.error("Freeze API error:", err);
    }
  }, [sessionId, client, isFrozen]);

  return (
    <div className="w-full max-w-sm mx-auto mb-12">
      <div className="flex flex-col items-center justify-center p-10 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <div className="relative mb-8">
          <div
            className={`absolute inset-0 rounded-full transition-all duration-700 ${
              isConnected
                ? "bg-green-100 scale-150 animate-pulse opacity-50"
                : "bg-gray-100 scale-100 opacity-0"
            }`}
          />
          
          {/* Inner Circle Container */}
          <div
            className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
              isConnected 
                ? "bg-green-50 text-green-600 shadow-green-100" 
                : "bg-gray-50 text-gray-400"
            }`}
          >
            <div className={`transition-all duration-300 ${isConnected ? "scale-110" : "scale-100"}`}>
              <Mic size={32} strokeWidth={isConnected ? 2.5 : 2} />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-2 text-gray-900 tracking-tight">
          {isConnected ? "Agent Listening" : "Voice Agent"}
        </h2>
        <p className="text-sm text-gray-500 mb-8 font-medium">
          {isConnected ? "Go ahead, I'm listening..." : "Ready to start conversation"}
        </p>

        <div className="w-full flex flex-col gap-2 ">
          {!isConnected ? (
            <button
              onClick={startCall}
              disabled={isConnecting}
              className="w-full h-12 bg-gray-900 text-white rounded-full font-medium hover:bg-black transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
            >
              {isConnecting ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                <>
                  <Mic size={18} />
                  <span>Start Conversation</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={endCall}
              className="w-full h-12 bg-red-50 text-red-600 border border-red-100 rounded-full font-medium hover:bg-red-100 hover:border-red-200 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <PhoneOff size={18} />
              <span>End Conversation</span>
            </button>
          )}

          <button
            onClick={sendFreezeMessage}
            disabled={!sessionId || !client}
            className="w-full h-12 bg-gray-900 text-white rounded-full font-medium hover:bg-black transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
          >
            <Snowflake size={18}/>
            {isFrozen ? <span>Unfreeze</span> : <span>Freeze</span> }
          </button>
        </div>
      </div>
    </div>
  );
}