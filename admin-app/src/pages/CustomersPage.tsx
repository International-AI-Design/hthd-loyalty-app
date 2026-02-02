import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Alert } from '../components/ui';
import { adminCustomersListApi } from '../lib/api';
import type { CustomerListItem, PaginationInfo } from '../lib/api';

type SortField = 'name' | 'phone' | 'email' | 'points_balance' | 'join_date';
type SortOrder = 'asc' | 'desc';

export function CustomersPage() {
  const { staff, logout } = useAuth();
  const navigate = useNavigate();

  // Data state
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<SortField>('join_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Current page
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch customers
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

  // Handle sort column click
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      // Toggle order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending for points/date, ascending for others
      setSortField(field);
      setSortOrder(field === 'points_balance' || field === 'join_date' ? 'desc' : 'asc');
    }
    setPage(1); // Reset to first page on sort change
  };

  // Render sort indicator
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  // Handle row click to view customer details
  const handleRowClick = (customerId: string) => {
    navigate(`/customers/${customerId}`);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-green-600">Happy Tail Happy Dog</h1>
              <p className="text-sm text-gray-600">Admin Portal</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <span className="hidden sm:inline text-gray-700 text-sm">
                {staff?.first_name}
                <span className="ml-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full capitalize">
                  {staff?.role}
                </span>
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">All Customers</h2>
            {pagination && (
              <p className="text-sm text-gray-500">
                {pagination.total} customer{pagination.total !== 1 ? 's' : ''} total
              </p>
            )}
          </div>

          {/* Search/Filter */}
          <div className="mb-6">
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="error" className="mb-4">{error}</Alert>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-green-600"></div>
              <p className="mt-2 text-gray-500">Loading customers...</p>
            </div>
          )}

          {/* Customer list - Card layout on mobile, table on desktop */}
          {!isLoading && customers.length > 0 && (
            <>
              {/* Mobile: Card Layout */}
              <div className="md:hidden space-y-3">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => handleRowClick(customer.id)}
                    className="w-full text-left border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-500">{customer.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{customer.points_balance.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">points</p>
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
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-4 lg:px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('name')}
                      >
                        Name{renderSortIndicator('name')}
                      </th>
                      <th
                        className="px-4 lg:px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('phone')}
                      >
                        Phone{renderSortIndicator('phone')}
                      </th>
                      <th
                        className="px-4 lg:px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('email')}
                      >
                        Email{renderSortIndicator('email')}
                      </th>
                      <th
                        className="px-4 lg:px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('points_balance')}
                      >
                        Points{renderSortIndicator('points_balance')}
                      </th>
                      <th
                        className="px-4 lg:px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('join_date')}
                      >
                        Join Date{renderSortIndicator('join_date')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        onClick={() => handleRowClick(customer.id)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">
                          {customer.name}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-base text-gray-500">
                          {customer.phone}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-base text-gray-500">
                          {customer.email}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-base font-semibold text-green-600">
                          {customer.points_balance.toLocaleString()} pts
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-base text-gray-500">
                          {formatDate(customer.join_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Empty state */}
          {!isLoading && customers.length === 0 && !error && (
            <div className="text-center py-8 text-gray-500">
              {debouncedSearch
                ? `No customers found matching "${debouncedSearch}"`
                : 'No customers found.'}
            </div>
          )}

          {/* Pagination */}
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
        </div>
      </main>
    </div>
  );
}
