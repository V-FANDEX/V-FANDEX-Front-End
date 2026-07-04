import { LogIn, LogOut, Medal, Menu, Shield, WalletCards } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useFandexStore } from '../store/useFandexStore';
import { currency } from '../utils/format';

const navItems = [
  { to: '/', label: '홈' },
  { to: '/markets', label: '장' },
  { to: '/portfolio', label: '포트폴리오' },
  { to: '/orders', label: '조건주문' },
  { to: '/dividends', label: '배당' },
  { to: '/scenarios', label: '뉴스' },
];

export function Layout() {
  const { user, stocks, toast, clearToast } = useFandexStore();
  const [open, setOpen] = useState(false);
  const assetValue =
    user?.holdings.reduce((sum, holding) => {
      const stock = stocks.find((item) => item.id === holding.stockId);
      return sum + (stock?.price ?? 0) * holding.quantity;
    }, user.cash) ?? 0;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(clearToast, 2800);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="logo" onClick={() => setOpen(false)}>
          <span className="brand-mark">VF</span>
          <span>
            <strong>V-FANDEX</strong>
            <small>Virtual Fandom Exchange</small>
          </span>
        </NavLink>
        <button className="icon-button mobile-only" onClick={() => setOpen((value) => !value)} aria-label="메뉴 열기">
          <Menu size={20} />
        </button>
        <nav className={open ? 'nav open' : 'nav'}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/rankings" className="rank-link" onClick={() => setOpen(false)}>
            <Medal size={16} /> 랭킹
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className="admin-link" onClick={() => setOpen(false)}>
              <Shield size={16} /> 관리자
            </NavLink>
          )}
        </nav>
        <div className="account-strip">
          <WalletCards size={18} />
          <span>{currency(assetValue)}</span>
          <button className="ghost-button">
            <LogIn size={15} /> 로그인
          </button>
          <button className="ghost-button muted">
            <LogOut size={15} /> 로그아웃
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
