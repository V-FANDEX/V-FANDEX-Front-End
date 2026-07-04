import { Newspaper } from 'lucide-react';
import { ScenarioCard } from '../components/Cards';
import { useFandexStore } from '../store/useFandexStore';

export function ScenariosPage() {
  const { scenarios, stocks } = useFandexStore();

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">GPT Scenario Log</span>
        <h1>시나리오 / 뉴스 로그</h1>
        <p>가격이 왜 움직였는지 이해할 수 있도록 영향 종목과 강도를 함께 표시합니다.</p>
      </header>
      <section className="scenario-grid">
        {scenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            stockNames={scenario.affectedStockIds.map((id) => stocks.find((stock) => stock.id === id)?.name ?? id)}
          />
        ))}
      </section>
      <section className="panel">
        <div className="panel-title"><Newspaper size={20} /><h2>생성 구분</h2></div>
        <p className="panel-copy">메인 시나리오는 시장 흐름, BIG 시나리오는 강한 가격 충격, 소규모 시나리오는 종목별 미세 변동에 사용됩니다.</p>
      </section>
    </div>
  );
}
