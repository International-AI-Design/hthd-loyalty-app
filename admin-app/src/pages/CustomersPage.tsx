import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Alert, PageHeader, Card, Spinner, EmptyState, Badge } from '../components/ui';
import { adminCustomersListApi } from '../lib/api';
import type { CustomerListItem, PaginationInfo } from '../lib/api';

const POINTS_CAP = 500;

type SortField = 'name' | 'phone' | 'email' | 'points_balance' | 'join_date';
type SortOrder = 'asc' | 'desc';

export function CustomersPage() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('join_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await adminCustomersListApi.list({
      page,
      limit: pageSize,
      sort_by: sortField,
      sort_order: sortOrder,
      search: debouncedSearch || undefined,
    });
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setCustomers(result.data.customers);
      setPagination(result.data.pagination);
    }
  }, [page, pageSize, sortField, sortOrder, debouncedSearch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'points_balance' || field === 'join_date' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? ' \u2191' : ' \u2193';
  };

  const handleRowClick = (customerId: string) => {
    navigate(`/customers/${customerId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={pagination ? `${pagination.total} customer${pagination.total !== 1 ? 's' : ''} total` : 'Manage your customer database'}
      />

      <Card>
        <div className="mb-6">
          <Input
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {error && (
          <Alert variant="error" className="mb-4">{error}</Alert>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner size="lg" />
            <p className="mt-3 text-sm text-gray-500">Loading customers...</p>
          </div>
        )}

        {!isLoading && customers.length > 0 && (
          <>
            {/* Mobile: Card Layout */}
            <div className="md:hidden space-y-3">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleRowClick(customer.id)}
                  className="w-full text-left border border-gray-100 rounded-xl p-4 bg-white hover:bg-[#62A2C3]/5 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-[#1B365D]">{customer.name}</p>
                      <p className="text-sm text-gray-500">{customer.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${customer.points_balance >= POINTS_CAP ? 'text-amber-600' : 'text-[#62A2C3]'}`}>
                        {customer.points_balance.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {customer.points_balance >= POINTS_CAP ? 'AT CAP' : 'points'}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span className="truncate max-w-[180px]">{customer.email}</span>
                    <span>{formatDate(customer.join_date)}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop: Table Layout */}
            <div className="hidden md:block overflow-x-auto -mx-5 sm:-mx-6">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {([
                      { field: 'name' as SortField, label: 'Name' },
                      { field: 'phone' as SortField, label: 'Phone' },
                      { field: 'email' as SortField, label: 'Email' },
                      { field: 'points_balance' as SortField, label: 'Points' },
                      { field: 'join_date' as SortField, label: 'Joined' },
                    ]).map((col) => (
                      <th
                        key={col.field}
                        className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3 cursor-pointer select-none hover:text-[#62A2C3] transition-colors"
                        onClick={() => handleSort(col.field)}
                      >
                        {col.label}{renderSortIndicator(col.field)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, idx) => (
                    <tr
                      key={customer.id}
                      onClick={() => handleRowClick(customer.id)}
                      className={`border-b border-gray-50 cursor-pointer hover:bg-[#62A2C3]/5 transition-colors ${
                        idx % 2 === 1 ? 'bg-[#F8F6F3]/50' : ''
                      }`}
                    >
                      <td className="px-5 sm:px-6 py-3.5 text-sm font-medium text-[#1B365D]">
                        {customer.name}
                      </td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-gray-500">
                        {customer.phone}
                      </td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-gray-500">
                        {customer.email}
                      </td>
                      <td className={`px-5 sm:px-6 py-3.5 text-sm font-semibold ${customer.points_balance >= POINTS_CAP ? 'text-amber-600' : 'text-[#62A2C3]'}`}>
                        {customer.points_balance.toLocaleString()} pts
                        {customer.points_balance >= POINTS_CAP && (
                          <Badge variant="overdue" className="ml-2">CAP</Badge>
                        )}
                      </td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-gray-500">
                        {formatDate(customer.join_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!isLoading && customers.length === 0 && !error && (
          <EmptyState
            title={debouncedSearch ? `No customers found matching "${debouncedSearch}"` : 'No customers found'}
            description={debouncedSearch ? 'Try a different search term' : 'Customers will appear here once they sign up'}
          />
        )}

        {pagination && pagination.total_pages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500 order-2 sm:order-1">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total}
            </p>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="inline-flex items-center px-3 py-2 text-sm text-gray-700">
                {pagination.page} / {pagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={!pagination.has_more}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
