import { useSearchParams } from 'react-router-dom';
import { useRemote } from '../hooks/useRemote';
import { segment } from '../services/contractApi';
import { ErrorNotice } from '../components/admin/Shared';
import type { Row } from '../types/contracts';
import { Newspaper } from 'lucide-react';
import { EmptyState, ScenarioCard } from '../components/Cards';
import { useFandexStore } from '../store/useFandexStore';
import { getScenarioTargetLabels } from '../utils/scenarioLabels';

export function ScenariosPage() {
  const [params] = useSearchParams();
  const eventId = params.get('eventId');
  const evidence = useRemote<Row>(eventId ? `/scenarios/${segment(eventId)}` : undefined);
  const { scenarios, stocks, markets } = useFandexStore();

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Market News</span>
        <h1>뉴스 / 이벤트</h1>
        <p>Backend가 공개한 시장 이벤트입니다. 내부 판단용 감성·중요도·충격 점수는 표시하지 않습니다.</p>
      </header>
      {eventId && <section className="panel"><h2>근거 공개 기사</h2><ErrorNotice error={evidence.error} /><h3>{String(evidence.data?.headline ?? evidence.data?.title ?? eventId)}</h3><p>{String(evidence.data?.body ?? evidence.data?.content ?? '')}</p></section>}
      <section className="scenario-grid">
        {scenarios.length ? scenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            stockNames={getScenarioTargetLabels(scenario, stocks, markets)}
          />
        )) : <EmptyState text="공개된 뉴스나 시장 이벤트가 없습니다." />}
      </section>
      <section className="panel">
        <div className="panel-title"><Newspaper size={20} /><h2>가격 형성 원칙</h2></div>
        <p className="panel-copy">이벤트 자체가 가격을 바꾸지 않습니다. 사용자와 AI의 주문, Backend Market Engine의 체결 결과가 가격에 반영되어야 합니다.</p>
      </section>
    </div>
  );
}
