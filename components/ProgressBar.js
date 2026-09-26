export default function ProgressBar({ completed, total }) {
  const pct = total ? Math.min(100, Math.max(0, (completed / total) * 100)) : 0;
  return (
    <div className="progressWrap" aria-label={`Прогрес ${completed} з ${total}`}>
      <div className="progressMeta"><span>{completed} / {total}</span><span>{Math.round(pct)}%</span></div>
      <div className="progressTrack"><div className="progressFill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
