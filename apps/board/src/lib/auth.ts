import { API_URL } from './config';

const TOKEN_KEY = 'pulse_token';
const APP = 'board';

export function captureTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.hash.match(/[#&]token=([^&]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  localStorage.setItem(TOKEN_KEY, token);
  window.history.replaceState(null, '', window.location.pathname);
  return token;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Fresh sign-in (Entra SSO applies if a browser session still exists). */
export function signIn(): void {
  clearToken();
  window.location.href = `${API_URL}/auth/login?app=${APP}`;
}

/** Force the Microsoft account picker — use when switching users. */
export function signInAsDifferentUser(): void {
  clearToken();
  window.location.href = `${API_URL}/auth/login?app=${APP}&prompt=select_account`;
}

/** Clear local JWT and end the Entra federated browser session. */
export function logout(): void {
  clearToken();
  window.location.href = `${API_URL}/auth/logout?app=${APP}`;
}
