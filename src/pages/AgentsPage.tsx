import { Bot, Trophy } from 'lucide-react';
import { EmptyState, RankingCard, StatCard } from '../components/Cards';
import { useFandexStore } from '../store/useFandexStore';
import { currency } from '../utils/format';

export function AgentsPage() {
  const agents = useFandexStore((state) => state.rankings.filter((entry) => entry.role === 'ai'));
  const leader = agents[0];

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Autonomous Participants</span>
        <h1>AI 투자자</h1>
        <p>Backend 랭킹에 공개된 AI 계정의 성과만 표시합니다. 내부 판단식과 숨겨진 성향값은 노출하지 않습니다.</p>
      </header>
      <section className="stat-grid">
        <StatCard label="활동 AI" value={`${agents.length}명`} />
        <StatCard label="AI 1위" value={leader?.name ?? '-'} hint={leader ? currency(leader.totalAssets) : undefined} />
      </section>
      <section className="panel">
        <div className="panel-title"><Bot size={20} /><h2>AI 계정 랭킹</h2></div>
        {agents.length
          ? agents.map((agent) => <RankingCard key={agent.id} entry={agent} />)
          : <EmptyState text="Backend에서 공개된 AI 투자자 데이터가 없습니다." />}
      </section>
      <section className="panel">
        <div className="panel-title"><Trophy size={20} /><h2>공개 데이터 범위</h2></div>
        <p className="panel-copy">현재 API는 이름, 총 자산, 수익률, 순위를 제공합니다. 투자 스타일과 주요 활동 Market은 공개 API 추가 후 표시합니다.</p>
      </section>
    </div>
  );
}
