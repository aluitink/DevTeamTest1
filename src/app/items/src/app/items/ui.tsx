/**
 * Presentational pieces for the `/items` Server Component (task #75).
 *
 * These are plain React functions with **no** `"use client"` directive, no
 * hooks, and no browser APIs: they render typed data that the Server
 * Component fetched, validated, and passed down. They could be extracted
 * into a Client Component only if interactivity (sorting, pagination
 * controls, …) were added.
 */
import type { ReactElement, ReactNode } from "react";

import type { Item } from "@devteamtest1/validation";

export interface ItemsErrorState {
  title: string;
  detail: string;
  /** Upstream HTTP status, when the failure was an HTTP error. */
  status?: number;
  retryHint: string;
}

export function ItemsPage({
  total,
  page,
  pageSize,
  children,
}: {
  total: number;
  page: number;
  pageSize: number;
  children: ReactNode;
}): ReactElement {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <section className="items-page" aria-label="Inventory items">
      <header className="items-header">
        <h1>Items</h1>
        <p className="items-count">
          {total} item{total === 1 ? "" : "s"}
          {total > 0 ? ` (showing ${from}–${to})` : ""}
        </p>
      </header>
      {children}
    </section>
  );
}

export function ItemRow({ item }: { item: Item }): ReactElement {
  return (
    <tr className="item-row">
      <td>{item.name}</td>
      <td data-testid="item-quantity">{item.quantity}</td>
      <td>{item.notes ?? ""}</td>
      <td>{new Date(item.updatedAt).toISOString().slice(0, 10)}</td>
    </tr>
  );
}

export function ItemsErrorState({
  title,
  detail,
  status,
  retryHint,
}: ItemsErrorState): ReactElement {
  return (
    <div className="items-error" role="alert">
      <h2>{title}</h2>
      <p>{detail}</p>
      {status !== undefined && <p className="items-error-status">HTTP {status}</p>}
      <p className="items-error-retry">{retryHint}</p>
    </div>
  );
}

/** Placeholder rows for `loading.tsx` / Suspense boundaries. */
export function ItemsSkeleton({ rows = 5 }: { rows?: number }): ReactElement {
  return (
    <table className="items-skeleton" aria-hidden>
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <tr key={i}>
            <td colSpan={4} className="skeleton-row" />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
