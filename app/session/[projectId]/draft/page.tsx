'use client';
import { useEffect, useState } from 'react';

type Draft = { id: string; title: string; content: string; regen_count: number; version: number; status: string };

export default function DraftPage({ params }: { params: { projectId: string } }){
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [outlineId, setOutlineId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [regenLimit, setRegenLimit] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  async function fetchCurrent(){
    const res = await fetch('/api/session/current');
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setSessionId(data.sessionId);
    return data;
  }

  async function fetchOutline(sid: string){
    const res = await fetch(`/api/outline?sessionId=${sid}`);
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setOutlineId(data.id);
    return data;
  }

  async function fetchDrafts(oid: string){
    const res = await fetch(`/api/draft?outlineId=${oid}`);
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setDrafts(data.drafts || []);
    setRegenLimit(data.regenLimit || 2);
  }

  async function generateAll(){
    if(!outlineId) return;
    setStatus('Generating chapter drafts…');
    const res = await fetch('/api/draft', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ outlineId }) });
    if(!res.ok){ setStatus(''); throw new Error(await res.text()); }
    await fetchDrafts(outlineId);
    setStatus('Drafts ready.');
  }

  async function regenerate(id: string){
    setStatus('Regenerating…');
    const res = await fetch('/api/draft', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ draftId: id }) });
    if(!res.ok){ setStatus(''); alert(await res.text()); return; }
    if(outlineId) await fetchDrafts(outlineId);
    setStatus('Done.');
  }

  async function accept(id: string){
    setStatus('Accepting…');
    const res = await fetch('/api/draft', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ draftId: id, accept: true }) });
    if(!res.ok){ setStatus(''); alert(await res.text()); return; }
    if(outlineId) await fetchDrafts(outlineId);
    setStatus('Accepted.');
  }

  useEffect(()=>{
    (async () => {
      try{
        const cur = await fetchCurrent();
        if(!cur.sessionId){ setError('No session yet. Upload audio first.'); return; }
        const ol = await fetchOutline(cur.sessionId);
        await fetchDrafts(ol.id);
      }catch(e:any){
        setError(e.message || 'Failed to load drafts');
      } finally{
        setLoading(false);
      }
    })();
  }, []);

  if(loading) return <main className="p-6 md:p-12"><p>Loading…</p></main>;
  if(error) return <main className="p-6 md:p-12"><p className="text-red-700">{error}</p></main>;

  return (
    <main className="p-6 md:p-12">
      <div className="mx-auto max-w-4xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-3xl font-black mb-3">Draft Chapters</h1>
        <p className="text-sm opacity-80 mb-4">Regenerate up to your limit per chapter. Accept chapters when you’re happy.</p>

        <div className="mb-4 flex items-center gap-3">
          <button onClick={generateAll} disabled={!outlineId} className="bg-terracotta text-white font-bold rounded px-4 py-2">Generate All Drafts</button>
          {status && <span className="text-green-700 text-sm">{status}</span>}
        </div>

        <div className="space-y-6">
          {drafts.map(d => (
            <div key={d.id} className="border rounded p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-lg">{d.title}</h2>
                <span className="text-xs opacity-70">Version {d.version} · Regens {d.regen_count}/{regenLimit} · {d.status}</span>
              </div>
              <div className="prose max-w-none whitespace-pre-wrap">{d.content}</div>
              <div className="mt-3 flex gap-2">
                <button onClick={()=>regenerate(d.id)} disabled={d.regen_count >= regenLimit} className="bg-warmbrown text-white font-bold rounded px-3 py-1 disabled:opacity-50">Regenerate</button>
                <button onClick={()=>accept(d.id)} className="bg-green-700 text-white font-bold rounded px-3 py-1">Accept</button>
              </div>
            </div>
          ))}
          {drafts.length === 0 && <p className="opacity-80">No drafts yet—click “Generate All Drafts.”</p>}
        </div>
      </div>
    </main>
  );
}
