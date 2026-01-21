import { Dispatch, SetStateAction } from "react";

export type SessionStateProps = {
    sessionId: string | null;
    setSessionId: Dispatch<SetStateAction<string | null>>;
}

export type SessionData = {
  session_id: string;
  start_time: number;
  turns: BackendTurn[];
}

export type ActiveCallProps = {
    sessionId: string | null;
    setSessionId: (id: string) => void;
    onCallEnd: () => void;
}

export type BackendTurn = {
  role: 'user' | 'bot' | 'latency';
  start: number;
  end: number;
  metadata?: {
    text?: string;
    stt?: number;
    llm?: number;
    tts?: number;
  };
}