'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function NextActions() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/session/current', { cache: 'no-store' });
        if (r.ok) {
          const data = await r.json();
          setSessionId(data.sessionId ?? null);
        }
      } catch {
        // no-op
      }
    })();
  }, []);

  async function generateOutline() {
    if (!sessionId) {
      setError('No active session. Upload audio first.');
      return;
    }
    try {
      setGenerating(true);
      setError(null);
      const res = await fetch('/api/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/session/${projectId}/outline`);
    } catch (e: any) {
      setError(e?.message || 'Failed to generate outline');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={generateOutline}
        disabled={generating || !sessionId}
        className="bg-stone-900 text-white font-bold rounded px-4 py-2 disabled:opacity-60"
        title={!sessionId ? 'No session yet' : undefined}
      >
        {generating ? 'Generating…' : 'Next: Generate outline'}
      </button>
      {error && <span className="text-red-700 text-sm">{error}</span>}
    </div>
  ); //rando comment
}
