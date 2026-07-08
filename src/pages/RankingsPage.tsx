import { Bot, Trophy, Users } from 'lucide-react';
import { EmptyState, RankingCard, StatCard } from '../components/Cards';
import { useFandexStore } from '../store/useFandexStore';
import { currency } from '../utils/format';

export function RankingsPage() {
  const { rankings, user } = useFandexStore();
  const mine = rankings.find((entry) => entry.id === user?.id);
  const bestReturn = rankings.length ? Math.max(...rankings.map((entry) => entry.returnRate)) : 0;
  const userRankings = rankings.filter((entry) => entry.role !== 'ai');
  const aiRankings = rankings.filter((entry) => entry.role === 'ai');

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Season Ranking</span>
        <h1>랭킹</h1>
        <p>사용자와 AI 계정이 같은 기준으로 경쟁합니다.</p>
      </header>
      <section className="stat-grid">
        <StatCard label="내 순위" value={`#${mine?.rank ?? '-'}`} hint={mine ? currency(mine.totalAssets) : undefined} />
        <StatCard label="1위 자산" value={currency(rankings[0]?.totalAssets ?? 0)} />
        <StatCard label="최고 수익률" value={`${bestReturn.toFixed(1)}%`} />
        <StatCard label="시즌별 랭킹" value="현재 시즌" hint="총 자산 기준" />
      </section>
      <section className="ranking-tabs">
        <article className="panel">
          <div className="panel-title"><Trophy size={20} /><h2>전체 랭킹</h2></div>
          {rankings.length ? rankings.map((entry) => <RankingCard key={entry.id} entry={entry} highlight={entry.id === user?.id} />) : <EmptyState text="아직 랭킹 데이터가 없습니다." />}
        </article>
        <article className="panel">
          <div className="panel-title"><Users size={20} /><h2>사용자 랭킹</h2></div>
          {userRankings.length ? userRankings.map((entry) => <RankingCard key={entry.id} entry={entry} highlight={entry.id === user?.id} />) : <EmptyState text="사용자 랭킹이 비어 있습니다." />}
        </article>
        <article className="panel">
          <div className="panel-title"><Bot size={20} /><h2>AI 계정 랭킹</h2></div>
          {aiRankings.length ? aiRankings.map((entry) => <RankingCard key={entry.id} entry={entry} />) : <EmptyState text="AI 계정 랭킹이 비어 있습니다." />}
        </article>
      </section>
    </div>
  );
}
