import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
  onRowClick?: (item: T) => void;
  rowKey: (item: T) => string;
}

type SortDir = 'asc' | 'desc';

export function DataTable<T>({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'No data found',
  emptyAction,
  onRowClick,
  rowKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const sortedData = (() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;
    const getValue = col.sortValue;
    return [...data].sort((a, b) => {
      const aVal = getValue(a);
      const bVal = getValue(b);
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  })();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} variant="table-row" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} action={emptyAction} />;
  }

  return (
    <div className="overflow-x-auto -mx-5 sm:-mx-6">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col, i) => (
              <th
                key={col.key}
                className={`text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3 ${
                  i === 0 ? 'sticky left-0 bg-white z-10' : ''
                } ${col.sortable ? 'cursor-pointer select-none hover:text-[#62A2C3] transition-colors' : ''} ${col.headerClassName ?? ''}`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {sortDir === 'asc' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      )}
                    </svg>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item, rowIdx) => (
            <tr
              key={rowKey(item)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`border-b border-gray-50 transition-colors ${
                rowIdx % 2 === 1 ? 'bg-[#F8F6F3]/50' : ''
              } ${onRowClick ? 'cursor-pointer hover:bg-[#62A2C3]/5' : 'hover:bg-gray-50/50'}`}
            >
              {columns.map((col, i) => (
                <td
                  key={col.key}
                  className={`px-5 sm:px-6 py-3.5 text-sm text-gray-700 ${
                    i === 0 ? 'sticky left-0 bg-inherit z-10' : ''
                  } ${col.className ?? ''}`}
                >
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
