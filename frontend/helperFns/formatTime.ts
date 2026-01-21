// MM:SS.xx
export const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "00:00.00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  const centis = Math.floor((seconds - Math.floor(seconds)) * 100);

  return `${mins.toString().padStart(2, "0")}:` +
         `${secs.toString().padStart(2, "0")}.` +
         `${centis.toString().padStart(2, "0")}`;
};
