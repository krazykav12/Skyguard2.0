export type PairGroup = { label: string; a: number | null; b: number | null };
export function PairBars({ groups, labelA, labelB, unit }: { groups: PairGroup[]; labelA: string; labelB: string | null; unit: string }) {
  const max = Math.max(1e-9, ...groups.flatMap(g => [g.a ?? 0, g.b ?? 0]));
  const W = 580, base = 112, band = Math.min(180, 520 / Math.max(1, groups.length));
  return (
    <div>
      <div className="chart-area" style={{ height: 150 }}>
        <svg viewBox="0 0 580 136" preserveAspectRatio="none" role="img" aria-label={`Mean ${unit} by group for ${labelA}${labelB ? ` and ${labelB}` : ''}`}>
          {[0, 1, 2, 3].map(t => <g key={t}><line className="chart-grid" x1="40" x2={W - 5} y1={base - t * 31} y2={base - t * 31} /><text className="chart-text" x="0" y={base + 3 - t * 31}>{(max * t / 3).toFixed(max < 10 ? 1 : 0)}</text></g>)}
          {groups.map((g, i) => {
            const c = 50 + i * band + band / 2 - 35;
            const ha = g.a === null ? 0 : Math.max(2, g.a / max * 88), hb = g.b === null ? 0 : Math.max(2, g.b / max * 88);
            return <g key={g.label}><rect x={c} y={base - ha} width="32" height={ha} rx="3" fill="#4d8c79" />{labelB && <rect x={c + 38} y={base - hb} width="32" height={hb} rx="3" fill="#d58b66" />}<text className="chart-text" x={c + 35} y="128" textAnchor="middle">{g.label}</text></g>;
          })}
        </svg>
      </div>
      <div className="chart-key"><span><i className="legend-dot" style={{ background: '#4d8c79', width: 7, height: 7 }} />{labelA}</span>{labelB && <span><i className="legend-dot" style={{ background: '#d58b66', width: 7, height: 7 }} />{labelB}</span>}</div>
    </div>
  );
}
