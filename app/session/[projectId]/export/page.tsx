'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type ExportApi = {
  id?: string;
  url?: string;
  fileUrl?: string;
  signedUrl?: string;
  downloadUrl?: string;
  status?: string; // e.g., "processing" | "ready"
};

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm opacity-80" role="status" aria-live="polite">
      <span className="inline-block h-5 w-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}

export default function ExportPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();

  const [projectId, setProjectId] = useState<string>(params.projectId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);

  const [exportId, setExportId] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [noSession, setNoSession] = useState(false);

  // Normalize possible API response shapes -> URL string
  const normalizeUrl = (payload: any): string | null => {
    if (!payload) return null;
    return (
      payload.url ||
      payload.fileUrl ||
      payload.signedUrl ||
      payload.downloadUrl ||
      null
    );
  };

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
    const r = await fetch(`/api/draft?sessionId=${sid}`, { cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(await r.text());
    const d = await r.json();
    setDraftId(d?.id || null);
    return d as { id?: string };
  }

  async function ensureDraft(sid: string) {
    // Try to get a draft; if missing, ensure outline then create a draft
    let d = await fetchDraftForSession(sid);
    if (d?.id) return d;

    // ensure outline first if needed
    const ro = await fetch(`/api/outline?sessionId=${sid}`, { cache: 'no-store' });
    if (ro.status === 404) {
      const co = await fetch('/api/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });
      if (!co.ok) throw new Error(await co.text());
    } else if (!ro.ok) {
      throw new Error(await ro.text());
    }
    const outline = ro.ok ? await ro.json() : await (await fetch(`/api/outline?sessionId=${sid}`, { cache: 'no-store' })).json();

    const cd = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outlineId: outline.id }),
    });
    if (!cd.ok) throw new Error(await cd.text());
    d = await cd.json();
    setDraftId(d?.id || null);
    return d as { id?: string };
  }

  async function fetchExportForSession(sid: string) {
    const r = await fetch(`/api/export?sessionId=${sid}`, { cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(await r.text());
    const data: ExportApi = await r.json();
    setExportId(data.id || null);
    const url = normalizeUrl(data);
    if (url) setExportUrl(url);
    return data;
  }

  async function createExportFromDraft(did: string) {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId: did }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data: ExportApi = await res.json();
    setExportId(data.id || null);
    const url = normalizeUrl(data);
    if (url) setExportUrl(url);
    return data;
  }

  // Initial load: ensure we have a session, draft, and export URL
  useEffect(() => {
    (async () => {
      try {
        const cur = await fetchCurrent();
        if (!cur.sessionId) {
          setNoSession(true);
          return;
        }
        // Try to get an existing export
        const existing = await fetchExportForSession(cur.sessionId);
        if (normalizeUrl(existing)) return;

        // If no export yet, ensure draft and create export
        setWorking(true);
        setStatus('Preparing your PDF…');
        const d = await ensureDraft(cur.sessionId);
        if (!d?.id) throw new Error('No draft available to export');
        await createExportFromDraft(d.id);
        setStatus('PDF ready.');
      } catch (e: any) {
        setError(e.message || 'Failed to prepare export');
        setStatus('');
      } finally {
        setWorking(false);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actions
  async function reexport() {
    if (!draftId) return;
    try {
      setWorking(true);
      setStatus('Re-exporting PDF…');
      const data = await createExportFromDraft(draftId);
      if (!normalizeUrl(data)) throw new Error('PDF export did not return a URL');
      setStatus('New PDF ready.');
    } catch (e: any) {
      setError(e.message || 'Re-export failed');
      setStatus('');
    } finally {
      setWorking(false);
    }
  }

  // ---- renders ----
  if (loading) {
    return (
      <main className="p-6 md:p-12">
        <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-black mb-3">Export</h1>
          <Spinner label={status || 'Preparing…'} />
        </div>
      </main>
    );
  }

  if (noSession) {
    return (
      <main className="p-6 md:p-12">
        <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-black mb-3">Export</h1>
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
        <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-black mb-3">Export</h1>
          <p className="text-red-700">{error}</p>
          <div className="mt-4 flex gap-3">
            <Link
              href={`/session/${projectId}/draft`}
              className="inline-block bg-stone-900 text-white font-bold rounded px-4 py-2"
            >
              Back to Drafts
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-12">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-3xl font-black mb-3">Export</h1>
        <p className="text-sm opacity-80 mb-6">
          Your PDF is generated from the latest saved draft. You can download it or re-export if you’ve made changes.
        </p>

        {!exportUrl ? (
          <div className="rounded-lg border p-4">
            <Spinner label={status || 'Rendering PDF…'} />
            <p className="text-xs opacity-60 mt-2">This usually takes a few seconds.</p>
          </div>
        ) : (
          <div className="rounded-lg border p-4">
            <p className="mb-3">Your PDF is ready:</p>
            <a
              href={exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-emerald-700 text-white font-bold rounded px-4 py-2"
            >
              Download PDF
            </a>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={reexport}
                disabled={working || !draftId}
                className="bg-stone-900 text-white font-bold rounded px-4 py-2 disabled:opacity-60"
              >
                {working ? 'Re-exporting…' : 'Re-export PDF'}
              </button>

              <Link
                href={`/session/${projectId}/draft`}
                className="inline-block bg-stone-100 text-stone-900 font-semibold rounded px-4 py-2"
              >
                Back to Drafts
              </Link>

              {status && <span className="text-green-700 text-sm">{status}</span>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
