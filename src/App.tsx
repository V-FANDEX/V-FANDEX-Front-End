import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { ConditionalOrdersPage } from './pages/ConditionalOrdersPage';
import { DividendsPage } from './pages/DividendsPage';
import { HomePage } from './pages/HomePage';
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
        <div className="brand-mark">VF</div>
        <p>V-FANDEX 시장 데이터를 불러오는 중</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
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
