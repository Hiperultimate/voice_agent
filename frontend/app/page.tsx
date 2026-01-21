import ActiveCall from '@/components/ActiveCall';
import CallClientProvider from '@/components/CallClientProvider';
import TranscriptTable from '@/components/TranscriptTable';

export default function Home() {
  

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <CallClientProvider />
    </main>
  );
}