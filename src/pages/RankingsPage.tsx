import { useState } from 'react';
import { useRemote } from '../hooks/useRemote';
import { segment } from '../services/contractApi';
import type { Row } from '../types/contracts';
import { ErrorNotice, Field, Table } from '../components/admin/Shared';
export function RankingsPage() {
  const seasons = useRemote<Row[]>('/seasons');
  const [seasonId, setSeason] = useState('');
  const rankings = useRemote<Row[]>(seasonId ? `/rankings/season/${segment(seasonId)}` : '/rankings');
  return (
    <div className="page contract-workspace">
      <header className="page-header">
        <h1>시즌 순위</h1>
        <p>종료 시즌은 저장된 순위이며 현재 계정값으로 덮어쓰지 않습니다.</p>
      </header>
      <section className="panel">
        <Field label="시즌">
          <select value={seasonId} onChange={(e) => setSeason(e.target.value)}>
            <option value="">현재 시즌</option>
            {seasons.data?.map((s) => (
              <option key={String(s.id)} value={String(s.id)}>
                {String(s.name)} · {String(s.status)}
              </option>
            ))}
          </select>
        </Field>
        <button onClick={rankings.refresh}>새로고침</button>
        <ErrorNotice error={seasons.error ?? rankings.error} />
        <Table
          rows={(rankings.data ?? []).map((row) => ({
            ...row,
            nickname: (row.user as Row)?.nickname,
            role: (row.user as Row)?.role,
          }))}
          columns={['rank', 'nickname', 'role', 'totalAssetValue', 'profitRate']}
        />
      </section>
    </div>
  );
}
