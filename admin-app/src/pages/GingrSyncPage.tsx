import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button, Alert } from '../components/ui';
import { adminGingrApi } from '../lib/api';
import type {
  GingrStatusResponse,
  GingrSyncResponse,
  GingrHistoryItem,
} from '../lib/api';

export function GingrSyncPage() {
  const { staff, logout } = useAuth();
  const navigate = useNavigate();

  // Connection status state
  const [status, setStatus] = useState<GingrStatusResponse | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<GingrSyncResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<GingrHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const checkStatus = useCallback(async () => {
    setIsCheckingStatus(true);
    setStatusError(null);

    const { data, error } = await adminGingrApi.status();

    if (error) {
      setStatusError(error);
    } else if (data) {
      setStatus(data);
    }

    setIsCheckingStatus(false);
  }, []);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);

    const { data } = await adminGingrApi.history();

    if (data) {
      setHistory(data.history);
    }

    setIsLoadingHistory(false);
  }, []);

  useEffect(() => {
    checkStatus();
    loadHistory();
  }, [checkStatus, loadHistory]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);

    const { data, error } = await adminGingrApi.sync();

    if (error) {
      setSyncError(error);
    } else if (data) {
      setSyncResult(data);
      if (data.success) {
        // Refresh history after successful sync
        loadHistory();
      }
    }

    setIsSyncing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-green-600">Happy Tail Happy Dog</h1>
            <p className="text-sm text-gray-600">Admin Portal - Gingr Sync</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
            <span className="text-gray-700">
              {staff?.first_name} {staff?.last_name}
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full capitalize">
                {staff?.role}
              </span>
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Connection Status Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Gingr Connection</h2>
            <Button variant="outline" size="sm" onClick={checkStatus} disabled={isCheckingStatus}>
              {isCheckingStatus ? 'Checking...' : 'Refresh Status'}
            </Button>
          </div>

          {statusError && (
            <Alert variant="error" className="mb-4">{statusError}</Alert>
          )}

          {status && (
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${status.connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className={`font-medium ${status.connected ? 'text-green-700' : 'text-red-700'}`}>
                  {status.connected ? 'Connected' : 'Not Connected'}
                </p>
                {status.connected && status.auth_format && (
                  <p className="text-sm text-gray-500">Auth: {status.auth_format}</p>
                )}
                {!status.connected && status.error && (
                  <p className="text-sm text-red-600">{status.error}</p>
                )}
                <p className="text-sm text-gray-500">Subdomain: {status.subdomain}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sync Action Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Sync Invoices</h2>
          <p className="text-gray-600 mb-6">
            Pull completed invoices from Gingr and automatically apply points to matched customers.
            Grooming services receive 1.5x points.
          </p>

          {syncError && (
            <Alert variant="error" className="mb-4">{syncError}</Alert>
          )}

          {syncResult && syncResult.success && (
            <Alert variant="success" className="mb-4">
              <div className="space-y-2">
                <p className="font-medium">Sync completed successfully!</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <div className="bg-white bg-opacity-50 rounded p-2 text-center">
                    <p className="text-2xl font-bold">{syncResult.invoices_processed}</p>
                    <p className="text-sm">Invoices</p>
                  </div>
                  <div className="bg-white bg-opacity-50 rounded p-2 text-center">
                    <p className="text-2xl font-bold text-green-700">{syncResult.customers_matched}</p>
                    <p className="text-sm">Matched</p>
                  </div>
                  <div className="bg-white bg-opacity-50 rounded p-2 text-center">
                    <p className="text-2xl font-bold text-orange-600">{syncResult.customers_not_found}</p>
                    <p className="text-sm">Unmatched</p>
                  </div>
                  <div className="bg-white bg-opacity-50 rounded p-2 text-center">
                    <p className="text-2xl font-bold text-blue-600">+{syncResult.total_points_applied.toLocaleString()}</p>
                    <p className="text-sm">Points Applied</p>
                  </div>
                </div>
              </div>
            </Alert>
          )}

          <Button
            onClick={handleSync}
            isLoading={isSyncing}
            disabled={!status?.connected || isSyncing}
            size="lg"
            className="w-full md:w-auto"
          >
            {isSyncing ? 'Syncing...' : 'Sync from Gingr'}
          </Button>
        </div>

        {/* Unmatched Customers Card */}
        {syncResult && syncResult.unmatched_customers.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Unmatched Customers ({syncResult.unmatched_customers.length})
            </h2>
            <p className="text-gray-600 mb-4">
              These customers from Gingr could not be matched to loyalty accounts. They may need to register,
              or their name/email/phone may not match.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owner Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {syncResult.unmatched_customers.map((customer, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {customer.owner_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {customer.invoice_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${customer.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sync History Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Sync History</h2>

          {isLoadingHistory ? (
            <div className="flex justify-center py-8">
              <svg
                className="animate-spin h-8 w-8 text-green-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No sync history yet. Run your first sync above!
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Synced By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoices
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Matched
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unmatched
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Points Applied
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(item.synced_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.synced_by}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.invoices_processed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {item.customers_matched}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                        {item.customers_not_found}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">
                        +{item.total_points_applied.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
