/**
 * A small router with the same calls the phone screens use (router.push,
 * router.back, useLocalSearchParams), on top of the browser's history.
 * Tab pages: /, /year, /chapter, /content, /money. Everything else opens as
 * a dialog over the last tab page.
 */
import { useSyncExternalStore, type ReactNode } from 'react';

export const TABS = ['/', '/year', '/chapter', '/content', '/money'] as const;
const MODALS = [
  '/week/[w]',
  '/plan/[id]',
  '/post/[id]',
  '/income/[id]',
  '/test/[id]',
  '/chapter-edit/[id]',
  '/habit/[id]',
  '/minutes/[hid]',
  '/settings',
  '/target',
  '/share',
  '/intro',
] as const;
export type ModalRoute = (typeof MODALS)[number];

type Href = string | { pathname: string; params?: Record<string, string | number | undefined> };

function toUrl(href: Href): string {
  if (typeof href === 'string') return href;
  const params = { ...(href.params || {}) };
  const path = href.pathname.replace(/\[(\w+)\]/g, (_, k) => {
    const v = params[k];
    delete params[k];
    return encodeURIComponent(String(v ?? ''));
  });
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

export function match(pathname: string): { route: string; params: Record<string, string> } | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if ((TABS as readonly string[]).includes(path)) return { route: path, params: {} };
  for (const pattern of MODALS) {
    const names: string[] = [];
    const re = new RegExp('^' + pattern.replace(/\[(\w+)\]/g, (_, n) => (names.push(n), '([^/]+)')) + '$');
    const m = path.match(re);
    if (m) return { route: pattern, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

const listeners = new Set<() => void>();
let current = location.pathname + location.search;
const notify = () => {
  current = location.pathname + location.search;
  listeners.forEach((l) => l());
};
window.addEventListener('popstate', notify);

// Count in-app history entries so back() never leaves the app.
const depth = () => (history.state?.ywDepth as number) || 0;
if (!history.state?.ywDepth) history.replaceState({ ywDepth: 0 }, '');

export const router = {
  push(href: Href) {
    history.pushState({ ywDepth: depth() + 1 }, '', toUrl(href));
    notify();
    window.scrollTo?.({ top: 0 });
  },
  navigate(href: Href) {
    router.push(href);
  },
  replace(href: Href) {
    history.replaceState({ ywDepth: depth() }, '', toUrl(href));
    notify();
  },
  back() {
    if (depth() > 0) history.back();
    else router.replace('/');
  },
  dismiss() {
    router.back();
  },
  /** Close the dialog and show this page instead. */
  dismissTo(href: Href) {
    router.replace(href);
  },
  canGoBack: () => depth() > 0,
};

export function useLocation(): string {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => current,
  );
}

/** Path and query parameters of the current route. */
export function useLocalSearchParams<T extends Record<string, string | undefined> = Record<string, string>>(): T {
  const loc = useLocation();
  const [path, qs] = loc.split('?');
  const m = match(path);
  return { ...Object.fromEntries(new URLSearchParams(qs || '')), ...(m?.params || {}) } as T;
}

export function Link({ href, children }: { href: Href; children: ReactNode; asChild?: boolean }) {
  const url = toUrl(href);
  return (
    <a
      href={url}
      onClick={(e) => {
        e.preventDefault();
        router.push(href);
      }}
      style={{ color: 'inherit', textDecoration: 'none', display: 'contents' }}
    >
      {children}
    </a>
  );
}
