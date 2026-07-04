import { Bot, Building2, Coins, RefreshCw, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { StatCard } from '../components/Cards';
import { useFandexStore } from '../store/useFandexStore';
import { compact, currency } from '../utils/format';

export function AdminPage() {
  const { markets, stocks, rankings, scenarios, notify } = useFandexStore();
  const totalCap = markets.reduce((sum, market) => sum + market.marketCap, 0);

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Admin Console</span>
        <h1>관리자 대시보드</h1>
        <p>시즌, 장, 종목, AI 계정, 시나리오, 배당 정책을 운영합니다.</p>
      </header>
      <section className="stat-grid">
        <StatCard label="서비스 시가총액" value={currency(totalCap)} />
        <StatCard label="활성 장" value={`${markets.filter((market) => market.active).length}개`} />
        <StatCard label="상장 종목" value={`${stocks.length}개`} />
        <StatCard label="랭킹 계정" value={`${rankings.length}명`} />
      </section>
      <section className="admin-grid">
        <AdminCard icon={<RefreshCw size={20} />} title="시즌 운영" actions={['시즌 초기화', '초기 자금 설정', '전체 유저 자금 리셋']} onAction={notify} />
        <AdminCard icon={<Building2 size={20} />} title="장/시장 관리" actions={['새 장 추가', '장 수정', '장 비활성화']} onAction={notify} />
        <AdminCard icon={<Coins size={20} />} title="종목 관리" actions={['새 종목 상장', '종목 수정', '상장폐지']} onAction={notify} />
        <AdminCard icon={<Bot size={20} />} title="AI 계정 관리" actions={['AI 계정 추가', '투자 성향 수정', 'AI 계정 삭제']} onAction={notify} />
        <AdminCard icon={<Sparkles size={20} />} title="시나리오 생성" actions={['메인 시나리오 요청', 'BIG 시나리오 요청', '소규모 시나리오 요청']} onAction={notify} />
        <AdminCard icon={<ShieldCheck size={20} />} title="정책/유저" actions={['배당금 정책 설정', '랭킹 초기화', '유저 관리']} onAction={notify} />
      </section>
      <section className="form-grid">
        <AdminForm title="관리자 종목 상장 폼" fields={['종목명', '소속 장', '초기 가격', '초기 발행량', '설명', '이미지 URL', '태그', '기본 배당률', '변동성 등급']} />
        <AdminForm title="관리자 장 추가 폼" fields={['장 이름', '장 설명', '아이콘', '정렬 순서']} />
        <AdminForm title="관리자 AI 계정 추가 폼" fields={['AI 계정 이름', '초기 자금', '투자 성향', '선호 장']} />
      </section>
      <section className="panel">
        <div className="panel-title"><Users size={20} /><h2>적용 내역</h2></div>
        <p className="panel-copy">최근 생성 시나리오 {scenarios.length}건 · 오늘 거래량 {compact(markets.reduce((sum, market) => sum + market.volume, 0))}</p>
      </section>
    </div>
  );
}

function AdminCard({ icon, title, actions, onAction }: { icon: React.ReactNode; title: string; actions: string[]; onAction: (message: string) => void }) {
  return (
    <article className="panel admin-card">
      <div className="panel-title">{icon}<h2>{title}</h2></div>
      {actions.map((action) => (
        <button key={action} className="secondary-button" onClick={() => onAction(`${action} 작업이 요청되었습니다.`)}>
          {action}
        </button>
      ))}
    </article>
  );
}

function AdminForm({ title, fields }: { title: string; fields: string[] }) {
  return (
    <form className="panel admin-form" onSubmit={(event) => event.preventDefault()}>
      <h2>{title}</h2>
      {fields.map((field) => (
        <label className="field" key={field}>
          <span>{field}</span>
          <input placeholder={field} />
        </label>
      ))}
      <label className="check-row">
        <input type="checkbox" defaultChecked /> 활성화 여부
      </label>
      <button className="primary-button">저장</button>
    </form>
  );
}
