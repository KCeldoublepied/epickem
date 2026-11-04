'use client';

import { useEffect, useState } from 'react';
import type { Page, TournamentSummary } from '@epickem/shared';

import { ApiRequestError, apiFetch } from '../api-client';

const PAGE_SIZE = 20;

export type ListState = 'loading' | 'ready' | 'logged-out' | 'error';

type ListPath = '/tournaments' | '/me/tournaments';

function fetchPage(path: ListPath, cursor: string | null): Promise<Page<TournamentSummary>> {
  const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) query.set('cursor', cursor);
  return apiFetch<Page<TournamentSummary>>(`${path}?${query}`);
}

function stateFromError(cause: unknown): ListState {
  return cause instanceof ApiRequestError && cause.status === 401 ? 'logged-out' : 'error';
}

/** Liste de tournois chargée page par page (`GET /tournaments` ou `GET /me/tournaments`). */
export function useTournamentList(path: ListPath) {
  const [items, setItems] = useState<TournamentSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<ListState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let current = true;
    fetchPage(path, null).then(
      (page) => {
        if (!current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setState('ready');
      },
      (cause: unknown) => current && setState(stateFromError(cause)),
    );
    return () => {
      current = false;
    };
  }, [path]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const page = await fetchPage(path, nextCursor);
      setItems((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setState(stateFromError(cause));
    } finally {
      setLoadingMore(false);
    }
  }

  return { items, state, hasMore: nextCursor !== null, loadingMore, loadMore };
}

export type TournamentList = ReturnType<typeof useTournamentList>;
