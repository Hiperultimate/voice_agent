import { Dispatch, SetStateAction } from "react";

export type SessionStateProps = {
  sessionId: string | null;
  setSessionId: Dispatch<SetStateAction<string | null>>;
}