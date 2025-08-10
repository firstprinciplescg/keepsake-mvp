'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type OutlineApi = {
  id: string;
  // The server may return outline under different keys; we normalize.
  outline?: any;
  content?: any;
  structure?: any;
};

type Chapter = { title: string; bullets: string[] };

// --- Small UI helpers ---
function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm opacity-80" role="status" aria-live="polite">
      <span className="inline-block h-5 w-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold mt-6 mb-2">{children}</h2>;
}

// --- Page ---
export default function OutlinePage({ params }: { params: { projectId: string } }) {
  const router = useRouter();

  const [projectId, setProjectId] = useState<string>(params.projectId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [outlineId, setOutlineId] = useState<string | null>(null);

  const [chapters, setChapters] = useState<{ title: string; bulletsText: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [noSession, setNoSession] = useState(false);

  // Normalize server outline payload → UI state
  const normalizeToChapters = (payload: any): { title: string; bulletsText: string }[] => {
    if (!payload) return [];
    const obj = payload.outline ?? payload.content ?? payload.structure ?? payload;
    const list: Chapter[] = Array.isArray(obj?.chapters) ? obj.chapters : [];
    return list.map((c) => ({
      title: String(c?.title ?? ''),
      bulletsText: Array.isArray(c?.bullets) ? (c.bullets as string[]).join('\n') : String(c?.bullets ?? ''),
    }));
  };

  const toServerOutline = useMemo(
    () => () => ({
      chapters: chapters.map((c) => ({
        title: c.title.trim(),
        bullets: c.bulletsText
          .split('\n')
          .map((b) => b.trim())
          .filter(Boolean),
      })),
    }),
    [chapters]
  );

  // Fetch current session context
  async function fetchCurrent() {
    const res = await fetch('/api/session/current', { cache: 'no-store' });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setProjectId(data.projectId || projectId);
    setSessionId(data.sessionId || null);
    return data as { projectId?: string; sessionId?: string; transcriptId?: string; outlineId?: string };
  }

  async function fetchOutlineForSession(sid: string) {
    const res = await fetch(`/api/outline?sessionId=${sid}`, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(await res.text());
    }
    const data: OutlineApi = await res.json();
    setOutlineId(data.id);
    setChapters(normalizeToChapters(data));
    return data;
  }

  async function generateOutline(sid: string) {
    setWorking(true);
    setStatus('Generating outline…');
    const res = await fetch('/api/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data: OutlineApi = await res.json();
    setOutlineId(data.id);
    setChapters(normalizeToChapters(data));
    setStatus('Outline generated.');
  }

  useEffect(() => {
    (async () => {
      try {
        const cur = await fetchCurrent();
        if (!cur.sessionId) {
          setNoSession(true);
          return;
        }
        const existing = await fetchOutlineForSession(cur.sessionId);
        if (!existing) {
          await generateOutline(cur.sessionId);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load outline');
      } finally {
        setWorking(false);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Handlers ---
  const updateTitle = (idx: number, value: string) => {
    setChapters((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], title: value };
      return next;
    });
  };

  const updateBullets = (idx: number, value: string) => {
    setChapters((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], bulletsText: value };
      return next;
    });
  };

  const addChapter = () =>
    setChapters((prev) => [...prev, { title: 'New chapter', bulletsText: '' }]);

  const removeChapter = (idx: number) =>
    setChapters((prev) => prev.filter((_, i) => i !== idx));

  async function save() {
    if (!outlineId) return;
    try {
      setWorking(true);
      setStatus('Saving…');
      const payload = toServerOutline();
      const res = await fetch('/api/outline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlineId, outline: payload }),
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

  async function approveAndGenerateDrafts() {
    if (!outlineId || !projectId) return;
    try {
      setWorking(true);
      setStatus('Generating drafts…');
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlineId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus('Drafts ready.');
      router.push(`/session/${projectId}/draft`);
    } catch (e: any) {
      setError(e.message || 'Failed to generate drafts');
      setStatus('');
    } finally {
      setWorking(false);
    }
  }

  // --- Render states ---
  if (loading) {
    return (
      <main className="p-6 md:p-12">
        <div className="mx-auto max-w-4xl bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-black mb-3">Outline</h1>
          <Spinner label={status || 'Preparing…'} />
        </div>
      </main>
    );
  }

  if (noSession) {
    return (
      <main className="p-6 md:p-12">
        <div className="mx-auto max-w-4xl bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-black mb-3">Outline</h1>
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
          <h1 className="text-3xl font-black mb-3">Outline</h1>
          <p className="text-red-700">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-12">
      <div className="mx-auto max-w-4xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-3xl font-black mb-3">Outline</h1>
        <p className="text-sm opacity-80 mb-6">
          Review and edit your chapter outline. Approving will generate full drafts.
        </p>

        {chapters.length === 0 && (
          <div className="rounded-lg border p-4 text-sm opacity-80">
            No chapters yet.
          </div>
        )}

        <div className="space-y-6">
          {chapters.map((c, idx) => (
            <div key={idx} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold">Chapter {idx + 1}</label>
                <button
                  onClick={() => removeChapter(idx)}
                  className="text-sm text-red-600 hover:underline"
                  aria-label={`Remove chapter ${idx + 1}`}
                >
                  Remove
                </button>
              </div>
              <input
                value={c.title}
                onChange={(e) => updateTitle(idx, e.target.value)}
                className="mt-2 w-full border rounded px-3 py-2"
                placeholder="Chapter title"
              />
              <SectionTitle>Bullets</SectionTitle>
              <textarea
                value={c.bulletsText}
                onChange={(e) => updateBullets(idx, e.target.value)}
                rows={5}
                className="w-full border rounded p-3"
                placeholder="One bullet per line"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={addChapter}
            className="bg-stone-100 text-stone-900 font-semibold rounded px-4 py-2"
          >
            + Add chapter
          </button>

          <button
            onClick={save}
            disabled={working || !outlineId}
            className="bg-terracotta text-white font-bold rounded px-4 py-2 disabled:opacity-60"
          >
            {working ? 'Saving…' : 'Save outline'}
          </button>

          <button
            onClick={approveAndGenerateDrafts}
            disabled={working || !outlineId}
            className="bg-stone-900 text-white font-bold rounded px-4 py-2 disabled:opacity-60"
          >
            {working ? 'Working…' : 'Approve & generate drafts'}
          </button>

          {status && <span className="text-green-700 text-sm">{status}</span>}
        </div>
      </div>
    </main>
  );
}
