import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { useFandexStore } from '../src/store/useFandexStore';
vi.mock('../src/components/Layout', () => ({ Layout: () => <Outlet /> }));
vi.mock('../src/pages/IntroPage', () => ({ IntroPage: () => <p>공개 소개</p> }));
vi.mock('../src/pages/AdminPage', () => ({ AdminPage: () => <p>관리자 영역</p> }));
describe('admin route role boundary', () => {
  it.each(['user', undefined] as const)('blocks %s before mounting admin data consumers', async (role) => {
    useFandexStore.setState({
      isReady: true,
      load: async () => {},
      user: role
        ? { id: 'u', role, name: '사용자', cash: 0, totalDividend: 0, holdings: [], favoriteStockIds: [] }
        : undefined,
    });
    render(
      <MemoryRouter
        initialEntries={['/admin']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );
    await screen.findByText('공개 소개');
    expect(screen.queryByText('관리자 영역')).toBeNull();
  });
  it('allows admin and removes the mounted area when role changes', async () => {
    useFandexStore.setState({
      isReady: true,
      load: async () => {},
      user: {
        id: 'u',
        role: 'admin',
        name: '관리자',
        cash: 0,
        totalDividend: 0,
        holdings: [],
        favoriteStockIds: [],
      },
    });
    render(
      <MemoryRouter
        initialEntries={['/admin']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );
    await screen.findByText('관리자 영역');
    await waitFor(() => useFandexStore.setState({ user: undefined }));
    await screen.findByText('공개 소개');
    expect(screen.queryByText('관리자 영역')).toBeNull();
  });
});
