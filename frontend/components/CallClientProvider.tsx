"use client";

import { useState } from "react";
import ActiveCall from "./ActiveCall";
import TranscriptTable from "./TranscriptTable";

export default function CallClientProvider() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <>
      <ActiveCall
        sessionId={sessionId}
        setSessionId={setSessionId}
      />

      <TranscriptTable
        sessionId={sessionId}
        setSessionId={setSessionId}
      />
    </>
  );
}
