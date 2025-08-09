'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function UploadPage({
  params,
}: { params: { projectId?: string; projectID?: string } }) {
  // Be tolerant to param casing just in case
  const routeProjectId =
    params.projectId ?? params.projectID ?? (params as any).projectid ?? '';

  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Helpful while debugging: confirm we have the ID
    console.log('[UploadPage] projectId =', routeProjectId);
  }, [routeProjectId]);

  async function getDuration(f: File): Promise<number | null> {
    try {
      const url = URL.createObjectURL(f);
      const audio = document.createElement('audio');
      audio.src = url;
      await new Promise((res, rej) => {
        audio.onloadedmetadata = () => res(null);
        audio.onerror = () => rej(new Error('metadata error'));
      });
      const d = isFinite(audio.duration) ? Math.round(audio.duration) : null;
      URL.revokeObjectURL(url);
      return d;
    } catch {
      return null;
    }
  }

  const doUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (!routeProjectId) {
      setError('Missing project id in route.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // 1) Ask server for a signed upload URL/token
      const initRes = await fetch('/api/upload-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: routeProjectId,
          fileName: file.name,
          fileSize: file.size,
        }),
      });
      if (!initRes.ok) throw new Error(await initRes.text());
      const { bucket, path, token } = await initRes.json();

      // 2) Upload file directly to Supabase Storage
      const { error: upErr } = await supabaseBrowser
        .storage
        .from(bucket)
        .uploadToSignedUrl(path, token, file, {
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        });
      if (upErr) throw new Error(upErr.message);

      // 3) (Optional) get duration for metrics
      const duration = await getDuration(file);

      // 4) Tell server we’re done → creates the sessions row
      const finRes = await fetch('/api/upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: routeProjectId,
          path,
          durationSeconds: duration,
        }),
      });
      if (!finRes.ok) throw new Error(await finRes.text());
      const data = await finRes.json();

      setMessage(`Uploaded! Session ${data.sessionId} created. Continue to Transcript.`);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 md:p-12">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow p-6">
        <h1 className="text-3xl font-black">Upload Audio</h1>

        {!routeProjectId && (
          <p className="text-red-700 mt-2">
            Missing project id. Please re-open your private link and click Continue again.
          </p>
        )}

        <form onSubmit={doUpload} className="space-y-4 mt-4">
          <input
            type="file"
            accept=".mp3,.wav,.m4a"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            disabled={!file || !routeProjectId || loading}
            className="bg-terracotta text-white font-bold rounded px-4 py-2"
          >
            {loading ? 'Uploading…' : 'Upload'}
          </button>
        </form>

        {message && (
          <p className="text-green-700 mt-3">
            {message}{' '}
            <Link
              className="underline text-terracotta"
              href={`/session/${routeProjectId}/transcript`}
            >
              Go to Transcript →
            </Link>
          </p>
        )}
        {error && <p className="text-red-700 mt-3">{error}</p>}
      </div>
    </main>
  );
}
