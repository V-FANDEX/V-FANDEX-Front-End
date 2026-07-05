import { Lock, LogIn, LogOut, Mail, ShieldCheck, UserPlus, UserRound, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useFandexStore } from '../store/useFandexStore';

export type AuthMode = 'login' | 'signup' | 'logout';

interface AuthModalProps {
  initialMode: AuthMode;
  onClose: () => void;
}

export function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const { login, logout, signup, user } = useFandexStore();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('player@vfandex.dev');
  const [password, setPassword] = useState('vfandex2026');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [remember, setRemember] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setError('');
    await login({ email, password, role, remember });
    setSubmitting(false);
    onClose();
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('이름, 이메일, 비밀번호를 모두 입력해주세요.');
      return;
    }

    if (password.length < 8) {
      setError('비밀번호는 8자 이상으로 입력해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    if (!accepted) {
      setError('시즌 운영 정책에 동의해야 가입할 수 있습니다.');
      return;
    }

    setSubmitting(true);
    setError('');
    await signup({ name, email, password });
    setSubmitting(false);
    onClose();
  };

  const handleLogout = async () => {
    setSubmitting(true);
    await logout();
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="modal-backdrop auth-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="auth-head">
          <div className="auth-brand">
            <span className="auth-mark">VF</span>
            <div>
              <span className="eyebrow">V-FANDEX Account</span>
              <h3 id="auth-title">{mode === 'signup' ? '회원가입' : mode === 'logout' ? '로그아웃' : '로그인'}</h3>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </header>

        {mode === 'logout' ? (
          <div className="auth-logout">
            <div className="auth-summary">
              <UserRound size={22} />
              <div>
                <strong>{user?.name ?? '게스트'}</strong>
                <span>{user?.role === 'admin' ? '관리자 세션' : '사용자 세션'}</span>
              </div>
            </div>
            <p>현재 세션을 종료하면 거래와 관리자 기능은 다시 로그인한 뒤 사용할 수 있습니다.</p>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={onClose}>취소</button>
              <button className="primary-button danger" type="button" onClick={handleLogout} disabled={submitting}>
                <LogOut size={17} /> {submitting ? '처리 중' : '로그아웃'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="auth-tabs" role="tablist" aria-label="인증 방식">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
                <LogIn size={16} /> 로그인
              </button>
              <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>
                <UserPlus size={16} /> 회원가입
              </button>
            </div>

            {mode === 'login' ? (
              <form className="auth-form" onSubmit={handleLogin}>
                <label className="auth-field">
                  <span>이메일</span>
                  <div className="auth-input">
                    <Mail size={17} />
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
                  </div>
                </label>
                <label className="auth-field">
                  <span>비밀번호</span>
                  <div className="auth-input">
                    <Lock size={17} />
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
                  </div>
                </label>

                <div className="auth-role-grid" aria-label="로그인 권한">
                  <button type="button" className={role === 'user' ? 'active' : ''} onClick={() => setRole('user')}>
                    <UserRound size={18} />
                    <span>일반 사용자</span>
                  </button>
                  <button type="button" className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>
                    <ShieldCheck size={18} />
                    <span>관리자 데모</span>
                  </button>
                </div>

                <label className="auth-inline">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  <span>이 브라우저에서 세션 유지</span>
                </label>

                {error && <p className="auth-error">{error}</p>}

                <button className="primary-button auth-submit" type="submit" disabled={submitting}>
                  <LogIn size={18} /> {submitting ? '로그인 중' : '로그인'}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleSignup}>
                <label className="auth-field">
                  <span>닉네임</span>
                  <div className="auth-input">
                    <UserRound size={17} />
                    <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="nickname" placeholder="예: 루키트레이더" />
                  </div>
                </label>
                <label className="auth-field">
                  <span>이메일</span>
                  <div className="auth-input">
                    <Mail size={17} />
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
                  </div>
                </label>
                <div className="auth-grid">
                  <label className="auth-field">
                    <span>비밀번호</span>
                    <div className="auth-input">
                      <Lock size={17} />
                      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
                    </div>
                  </label>
                  <label className="auth-field">
                    <span>비밀번호 확인</span>
                    <div className="auth-input">
                      <Lock size={17} />
                      <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                    </div>
                  </label>
                </div>

                <div className="auth-benefit">
                  <strong>초기 가상 자금 ₩10,000,000</strong>
                  <span>가입 즉시 시즌 랭킹에 참가할 수 있습니다.</span>
                </div>

                <label className="auth-inline">
                  <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                  <span>가상 거래 서비스 정책과 시즌 랭킹 규칙에 동의합니다.</span>
                </label>

                {error && <p className="auth-error">{error}</p>}

                <button className="primary-button auth-submit" type="submit" disabled={submitting}>
                  <UserPlus size={18} /> {submitting ? '생성 중' : '계정 만들기'}
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
