'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm opacity-80" role="status" aria-live="polite">
      <span className="inline-block h-5 w-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}

export default function TranscriptPage({ params }: { params: { projectId: string } }){
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [text, setText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [noSession, setNoSession] = useState(false);

  async function fetchCurrent(){
    const res = await fetch('/api/session/current');
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setProjectId(data.projectId || null);
    setSessionId(data.sessionId || null);
    setTranscriptId(data.transcriptId || null);
    return data;
  }

  async function fetchTranscript(sid: string){
    const res = await fetch(`/api/transcript?sessionId=${sid}`);
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setTranscriptId(data.id);
    setText(data.text || '');
  }

  async function transcribeNow(sid: string){
    setStatus('Transcribing your audio… typically 10–60s.');
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid })
    });
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setTranscriptId(data.transcriptId);
    setStatus('Transcription complete.');
    return data;
  }

  useEffect(()=>{
    (async () => {
      try{
        const cur = await fetchCurrent();
        if(!cur.sessionId){
          setNoSession(true);
          return;
        }
        if(!cur.transcriptId){
          await transcribeNow(cur.sessionId);
        }
        await fetchTranscript(cur.sessionId);
      }catch(e:any){
        setError(e.message || 'Failed to load transcript');
      } finally{
        setLoading(false);
      }
    })();
  }, []);

  async function save(){
    if(!transcriptId) return;
    setSaving(true);
    setError(null);
    try{
      const res = await fetch('/api/transcript', {
        method:'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptId, text })
      });
      if(!res.ok) throw new Error(await res.text());
      setStatus('Saved.');
    }catch(e:any){
      setError(e.message || 'Save failed');
    }finally{
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="p-6 md:p-12">
        <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-black mb-3">Transcript</h1>
          <Spinner label={status || 'Preparing…'} />
          <p className="text-xs opacity-60 mt-2">You can keep this tab open; the text will appear when ready.</p>
        </div>
      </main>
    );
  }

  if (noSession) {
    return (
      <main className="p-6 md:p-12">
        <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-black mb-3">Transcript</h1>
          <p className="mb-4">No session yet. Upload audio first.</p>
          {projectId && (
            <Link
              href={`/session/${projectId}/upload`}
              className="inline-block bg-terracotta text-white font-bold rounded px-4 py-2"
            >
              Upload audio
            </Link>
          )}
        </div>
      </main>
    );
  }

  if(error) {
    return (
      <main className="p-6 md:p-12">
        <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-black mb-3">Transcript</h1>
          <p className="text-red-700">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-12">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-3xl font-black mb-3">Transcript</h1>
        <p className="text-sm opacity-80 mb-4">Edit for clarity. These changes affect outline & drafts.</p>
        <textarea
          value={text}
          onChange={e=>setText(e.target.value)}
          rows={18}
          className="w-full border rounded p-3"
        />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="bg-terracotta text-white font-bold rounded px-4 py-2">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {status && !/transcrib/i.test(status) && (
            <span className="text-green-700 text-sm">{status}</span>
          )}
        </div>
      </div>
    </main>
  );
}
