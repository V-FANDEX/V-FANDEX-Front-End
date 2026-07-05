import { LogIn, LogOut, Medal, Menu, Shield, UserPlus, WalletCards } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { AuthModal, type AuthMode } from './AuthModal';
import { useFandexStore } from '../store/useFandexStore';
import { currency } from '../utils/format';

const navItems = [
  { to: '/', label: '소개' },
  { to: '/dashboard', label: '대시보드' },
  { to: '/markets', label: '장' },
  { to: '/portfolio', label: '포트폴리오' },
  { to: '/orders', label: '조건주문' },
  { to: '/dividends', label: '배당' },
  { to: '/scenarios', label: '뉴스' },
];

export function Layout() {
  const { user, stocks, toast, clearToast } = useFandexStore();
  const [open, setOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>();
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
          <span>{user ? currency(assetValue) : '게스트 모드'}</span>
          {user && <span className={user.role === 'admin' ? 'account-badge admin' : 'account-badge'}>{user.role === 'admin' ? 'ADMIN' : 'USER'} · {user.name}</span>}
          {user ? (
            <button className="ghost-button muted" onClick={() => setAuthMode('logout')}>
              <LogOut size={15} /> 로그아웃
            </button>
          ) : (
            <>
              <button className="ghost-button" onClick={() => setAuthMode('login')}>
                <LogIn size={15} /> 로그인
              </button>
              <button className="ghost-button muted" onClick={() => setAuthMode('signup')}>
                <UserPlus size={15} /> 회원가입
              </button>
            </>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      {authMode && <AuthModal initialMode={authMode} onClose={() => setAuthMode(undefined)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
