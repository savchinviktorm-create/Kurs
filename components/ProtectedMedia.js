'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client-api';

function Watermark({ text, enabled }) {
  if (!enabled || !text) return null;
  return <div className="mediaWatermark" aria-hidden="true">{text}</div>;
}

function PdfCanvasViewer({ url, watermark, watermarkEnabled }) {
  const canvasRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const doc = await pdfjs.getDocument({ url, disableAutoFetch: false, disableStream: false }).promise;
        if (!cancelled) { setPdf(doc); setPage(1); }
      } catch (e) { if (!cancelled) setError(e.message || 'PDF_ERROR'); }
    })();
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let task;
    (async () => {
      const p = await pdf.getPage(page);
      const viewport = p.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      task = p.render({ canvasContext: ctx, viewport });
      await task.promise;
    })().catch(() => {});
    return () => { try { task?.cancel(); } catch {} };
  }, [pdf, page, scale]);

  return (
    <div className="pdfViewer protectedSurface" onContextMenu={e => e.preventDefault()}>
      <div className="pdfToolbar">
        <button disabled={page <= 1} onClick={() => setPage(v => Math.max(1, v-1))}>‹</button>
        <span>{page} / {pdf?.numPages || '…'}</span>
        <button disabled={!pdf || page >= pdf.numPages} onClick={() => setPage(v => Math.min(pdf?.numPages || v, v+1))}>›</button>
        <button onClick={() => setScale(v => Math.max(.7, v-.15))}>−</button>
        <button onClick={() => setScale(v => Math.min(2.4, v+.15))}>+</button>
      </div>
      {error ? <div className="inlineError">{error}</div> : <div className="pdfCanvasWrap"><canvas ref={canvasRef} /></div>}
      <Watermark text={watermark} enabled={watermarkEnabled} />
    </div>
  );
}

function StreamVideo({ kind, src, poster, watermark, watermarkEnabled }) {
  const ref = useRef(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    let cleanup = () => {};
    if (kind === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) return;
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(src); hls.attachMedia(video);
        cleanup = () => hls.destroy();
      }).catch(() => {});
    } else if (kind === 'dash') {
      import('dashjs').then((mod) => {
        const dashjs = mod.default || mod;
        const player = dashjs.MediaPlayer().create();
        player.initialize(video, src, false);
        cleanup = () => player.reset();
      }).catch(() => {});
    } else {
      video.src = src;
    }
    return () => cleanup();
  }, [kind, src]);

  return (
    <div className="videoFrame protectedSurface" onContextMenu={e => e.preventDefault()}>
      <video ref={ref} poster={poster || undefined} controls playsInline preload="metadata" controlsList="nodownload noremoteplayback" disablePictureInPicture={false} />
      <Watermark text={watermark} enabled={watermarkEnabled} />
    </div>
  );
}

export default function ProtectedMedia({ mediaId, spaceSlug, watermark }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    apiFetch(`/api/media/${mediaId}/token?space=${encodeURIComponent(spaceSlug || 'pkk')}`)
      .then(v => alive && setData(v))
      .catch(e => alive && setError(e.message));
    return () => { alive = false; };
  }, [mediaId, spaceSlug]);

  if (error) return <div className="inlineError">Медіа недоступне: {error}</div>;
  if (!data) return <div className="mediaLoading"><div className="loader small" /></div>;

  const wm = data.media.watermark_enabled;
  if (data.delivery?.kind === 'iframe') {
    return (
      <div className="iframeFrame protectedSurface" onContextMenu={e => e.preventDefault()}>
        <iframe src={data.iframe_url} title={data.media.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        <Watermark text={watermark} enabled={wm} />
      </div>
    );
  }
  const src = data.delivery?.stream_url;
  if (data.delivery?.kind === 'pdf') return <PdfCanvasViewer url={src} watermark={watermark} watermarkEnabled={wm} />;
  if (data.delivery?.kind === 'audio') {
    return (
      <div className="audioFrame protectedSurface" onContextMenu={e => e.preventDefault()}>
        <audio src={src} controls preload="metadata" controlsList="nodownload noremoteplayback" />
        <Watermark text={watermark} enabled={wm} />
      </div>
    );
  }
  return <StreamVideo kind={data.delivery?.kind || 'video'} src={src} poster={data.media.poster_url} watermark={watermark} watermarkEnabled={wm} />;
}
