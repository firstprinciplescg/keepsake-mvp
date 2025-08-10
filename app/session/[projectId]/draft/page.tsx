'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type DraftChapter = { title: string; text: string };

type DraftApi = {
  id: string;
  // server may return one of these keys; we normalize
  draft?: any;
  content?: any;
  chapters?: Array<{ title?: string; text?: string }>;
};

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm opacity-80" role="status" aria-live="polite">
      <span className="inline-block h-5 w-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}

export default function DraftPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();

  const [projectId, setProjectId] = useState<string>(params.projectId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<DraftChapter[]>([]);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [noSession, setNoSession] = useState(false);

  // ---- helpers ----
  const normalizeToChapters = (payload: any): DraftChapter[] => {
    if (!payload) return [];
    // supported shapes:
    //  - { draft: { chapters: [...] } }
    //  - { content: { chapters: [...] } }
    //  - { chapters: [...] }
    const obj = payload.draft ?? payload.content ?? payload;
    const list: any[] = Array.isArray(obj?.chapters) ? obj.chapters : [];
    return list.map((c) => ({
      title: String(c?.title ?? ''),
      text: String(c?.text ?? ''),
    }));
  };

  const toServerDraft = useMemo(
    () => () => ({
      chapters: chapters.map((c) => ({
        title: c.title.trim(),
        text: c.text.trim(),
      })),
    }),
    [chapters]
  );

  // ---- data fetchers ----
  async function fetchCurrent() {
    const res = await fetch('/api/session/current', { cache: 'no-store' });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setProjectId(data.projectId || projectId);
    setSessionId(data.sessionId || null);
    return data as { projectId?: string; sessionId?: string };
  }

  async function fetchDraftForSession(sid: string) {
    const res = await fetch(`/api/draft?sessionId=${sid}`, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(await res.text());
    }
    const data: DraftApi = await res.json();
    setDraftId(data.id);
    const normalized =
      normalizeToChapters(data) ||
      normalizeToChapters((data as any).draft) ||
      normalizeToChapters((data as any).content);
    setChapters(normalized);
    return data;
  }

  async function ensureOutlineAndGenerateDrafts(sid: string) {
    // try to get outline id
    const getOutline = async () => {
      const r = await fetch(`/api/outline?sessionId=${sid}`, { cache: 'no-store' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(await r.text());
      return (await r.json()) as { id: string; [k: string]: any };
    };

    let outline = await getOutline();
    if (!outline) {
      // create outline if missing
      const c = await fetch('/api/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });
      if (!c.ok) throw new Error(await c.text());
      outline = (await c.json()) as any;
    }

    // now generate drafts from outline
    const res = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outlineId: (outline as any).id }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data: DraftApi = await res.json();
    setDraftId(data.id);
    setChapters(normalizeToChapters(data));
  }

  useEffect(() => {
    (async () => {
      try {
        const cur = await fetchCurrent();
        if (!cur.sessionId) {
          setNoSession(true);
          return;
        }
        const existing = await fetchDraftForSession(cur.sessionId);
        if (!existing) {
          setWorking(true);
          setStatus('Generating first draft…');
          await ensureOutlineAndGenerateDrafts(cur.sessionId);
          setStatus('Draft created.');
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load drafts');
      } finally {
        setWorking(false);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- handlers ----
  const updateTitle = (idx: number, value: string) => {
    setChapters((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], title: value };
      return next;
    });
  };

  const updateText = (idx: number, value: string) => {
    setChapters((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], text: value };
      return next;
    });
  };

  async function saveAll() {
    if (!draftId) return;
    try {
      setWorking(true);
      setStatus('Saving…');
      const payload = toServerDraft();
      const res = await fetch('/api/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, draft: payload }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus('Saved.');
    } catch (e: any) {
      setError(e.message || 'Save failed');
      setStatus('');
    } finally {
      setWorking(false);
    }
  }

  async function regenerateChapter(idx: number) {
    if (!draftId) return;
    try {
      setWorking(true);
      setStatus(`Regenerating chapter ${idx + 1}…`);
      const res = await fetch('/api/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, regenerate: true, chapterIndex: idx }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: DraftApi = await res.json();
      setChapters(normalizeToChapters(data));
      setStatus(`Chapter ${idx + 1} updated.`);
    } catch (e: any) {
      setError(e.message || 'Regenerate failed');
      setStatus('');
    } finally {
      setWorking(false);
    }
  }

  async function exportPdf() {
    if (!draftId || !projectId) return;
    try {
      setWorking(true);
      setStatus('Exporting PDF…');
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus('PDF generated.');
      router.push(`/session/${projectId}/export`);
    } catch (e: any) {
      setError(e.message || 'Export failed');
      setStatus('');
    } finally {
      setWorking(false);
    }
  }

  // ---- renders ----
  if (loading) {
    return (
      <main className="p-6 md:p-12">
        <div className="mx-auto max-w-4xl bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-black mb-3">Draft</h1>
          <Spinner label={status || 'Preparing…'} />
        </div>
      </main>
    );
  }

  if (noSession) {
    return (
      <main className="p-6 md:p-12">
        <div className="mx-auto max-w-4xl bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-black mb-3">Draft</h1>
          <p className="mb-4">No session yet. Upload audio first.</p>
          <Link
            href={`/session/${projectId}/upload`}
            className="inline-block bg-terracotta text-white font-bold rounded px-4 py-2"
          >
            Upload audio
          </Link>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6 md:p-12">
        <div className="mx-auto max-w-4xl bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-black mb-3">Draft</h1>
          <p className="text-red-700">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-12">
      <div className="mx-auto max-w-4xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-3xl font-black mb-3">Draft</h1>
        <p className="text-sm opacity-80 mb-6">
          Edit chapter drafts below. You can regenerate any chapter, save, and export to PDF.
        </p>

        {chapters.length === 0 && (
          <div className="rounded-lg border p-4 text-sm opacity-80">
            No chapters yet. Try reloading this page.
          </div>
        )}

        <div className="space-y-6">
          {chapters.map((c, idx) => (
            <div key={idx} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  value={c.title}
                  onChange={(e) => updateTitle(idx, e.target.value)}
                  className="w-full md:w-[70%] border rounded px-3 py-2 font-semibold"
                  placeholder={`Chapter ${idx + 1} title`}
                />
                <button
                  onClick={() => regenerateChapter(idx)}
                  disabled={working || !draftId}
                  className="bg-stone-900 text-white font-bold rounded px-3 py-2 disabled:opacity-60"
                  title="AI will rewrite this chapter using your outline/transcript."
                >
                  {working ? 'Working…' : `Regenerate Chapter ${idx + 1}`}
                </button>
              </div>

              <textarea
                value={c.text}
                onChange={(e) => updateText(idx, e.target.value)}
                rows={10}
                className="mt-3 w-full border rounded p-3"
                placeholder="Chapter text"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={saveAll}
            disabled={working || !draftId}
            className="bg-terracotta text-white font-bold rounded px-4 py-2 disabled:opacity-60"
          >
            {working ? 'Saving…' : 'Save all changes'}
          </button>

          <button
            onClick={exportPdf}
            disabled={working || !draftId}
            className="bg-emerald-700 text-white font-bold rounded px-4 py-2 disabled:opacity-60"
          >
            {working ? 'Exporting…' : 'Export to PDF'}
          </button>

          {status && <span className="text-green-700 text-sm">{status}</span>}
        </div>
      </div>
    </main>
  );
}
