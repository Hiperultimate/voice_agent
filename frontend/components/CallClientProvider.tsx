"use client";

import { useState } from "react";
import ActiveCall from "./ActiveCall";
import TranscriptTable from "./TranscriptTable";
import SessionPlayer from "./SessionPlayer";

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
        <>
          <SessionPlayer
            sessionId={sessionId}
            setSessionId={setSessionId} // Pass props if your interface requires it
          />
          <TranscriptTable sessionId={sessionId} setSessionId={setSessionId} />
        </>
      )}
    </>
  );
}
