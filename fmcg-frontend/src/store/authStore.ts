import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, UserRole } from '../types';

interface AuthState {
  user:            AuthUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  setUser:         (user: AuthUser) => void;
  logout:          () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,

      setUser: (user) => set({ user, token: user.token, isAuthenticated: true }),

      logout: () => set({ user: null, token: null, isAuthenticated: false }),

      loadFromStorage: () => {
        const stored = localStorage.getItem('fmcg_auth');
        if (stored && !get().user) {
          try {
            const parsed = JSON.parse(stored);
            const { state } = parsed;
            if (state?.user) set({ user: state.user, token: state.token ?? state.user.token ?? null, isAuthenticated: true });
          } catch {
            localStorage.removeItem('fmcg_auth');
          }
        }
      },
    }),
    {
      name:       'fmcg_auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    },
  ),
);

// ── Role guards ────────────────────────────────────────────────────────────────
export function useRole(): UserRole | null {
  return useAuthStore((s) => s.user?.role ?? null);
}

export function useIsAdmin(): boolean {
  const role = useRole();
  return role === 'Admin' || role === 'SuperAdmin';
}

export function useIsSalesman(): boolean {
  return useRole() === 'Salesman';
}

export function useIsAccounts(): boolean {
  const role = useRole();
  return role === 'Accounts' || role === 'Admin' || role === 'SuperAdmin';
}

export function useIsWarehouse(): boolean {
  const role = useRole();
  return role === 'Warehouse' || role === 'Admin' || role === 'SuperAdmin';
}

// ── Default redirect by role ───────────────────────────────────────────────────
export function getRoleHome(role: UserRole): string {
  switch (role) {
    case 'SuperAdmin': return '/admin/dashboard';
    case 'Admin':      return '/admin/dashboard';
    case 'Salesman':   return '/salesman/routes';
    case 'Accounts':   return '/accounts/settlement';
    case 'Warehouse':  return '/warehouse/loading';
    default:           return '/login';
  }
}
