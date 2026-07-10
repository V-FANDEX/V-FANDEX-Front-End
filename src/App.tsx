import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { ConditionalOrdersPage } from './pages/ConditionalOrdersPage';
import { DividendsPage } from './pages/DividendsPage';
import { HomePage } from './pages/HomePage';
import { IntroPage } from './pages/IntroPage';
import { MarketListPage } from './pages/MarketListPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { RankingsPage } from './pages/RankingsPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { StockDetailPage } from './pages/StockDetailPage';
import { StockListPage } from './pages/StockListPage';
import { useFandexStore } from './store/useFandexStore';

export default function App() {
  const { isReady, load, user } = useFandexStore();

  useEffect(() => {
    void load();
  }, [load]);

  if (!isReady) {
    return (
      <div className="boot">
        <div className="boot-stage" aria-hidden="true">
          <span className="boot-ring outer" />
          <span className="boot-ring inner" />
          <span className="boot-sweep" />
          <img className="boot-logo" src="/assets/v-fandex-logo.svg" alt="" />
          <span className="boot-tick tick-a" />
          <span className="boot-tick tick-b" />
          <span className="boot-tick tick-c" />
        </div>
        <div className="boot-copy">
          <span className="eyebrow">Opening Market</span>
          <h1>V-FANDEX</h1>
          <p>실시간 시장 데이터와 포트폴리오를 불러오는 중입니다.</p>
        </div>
        <div className="boot-bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<IntroPage />} />
        <Route path="dashboard" element={<HomePage />} />
        <Route path="markets" element={<MarketListPage />} />
        <Route path="markets/:marketId" element={<StockListPage />} />
        <Route path="stocks/:stockId" element={<StockDetailPage />} />
        <Route path="orders" element={<ConditionalOrdersPage />} />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="dividends" element={<DividendsPage />} />
        <Route path="rankings" element={<RankingsPage />} />
        <Route path="scenarios" element={<ScenariosPage />} />
        <Route path="admin" element={user?.role === 'admin' ? <AdminPage /> : <Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
