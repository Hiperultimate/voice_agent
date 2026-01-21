"use client";

import { useState } from "react";
import ActiveCall from "./ActiveCall";
import TranscriptTable from "./TranscriptTable";

export default function CallClientProvider() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCallEnded, setIsCallEnded] = useState(false);

  const handleCallEnd = () => {
    setIsCallEnded(true);
  };

  const handleCallStart = (newSessionId: string) => {
    setSessionId(newSessionId);
    setIsCallEnded(false);
  };

  return (
    <>
      <ActiveCall
        sessionId={sessionId}
        setSessionId={handleCallStart}
        onCallEnd={handleCallEnd}
      />

      {/* Only show table if session exists AND call has ended */}
      {sessionId && isCallEnded && (
        <TranscriptTable
          sessionId={sessionId}
          setSessionId={setSessionId}
        />
      )}
    </>
  );
}