import { useState, useEffect, useCallback } from 'react';
import { Button, Alert, PageHeader, Card, Spinner, EmptyState } from '../components/ui';
import { adminGingrApi } from '../lib/api';
import type {
  GingrStatusResponse,
  GingrSyncResponse,
  GingrHistoryItem,
  GingrImportResponse,
  GingrUnclaimedCustomer,
} from '../lib/api';

export function GingrSyncPage() {
  const [status, setStatus] = useState<GingrStatusResponse | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<GingrSyncResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [history, setHistory] = useState<GingrHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<GingrImportResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [unclaimedCustomers, setUnclaimedCustomers] = useState<GingrUnclaimedCustomer[]>([]);
  const [isLoadingUnclaimed, setIsLoadingUnclaimed] = useState(true);

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

  const loadUnclaimedCustomers = useCallback(async () => {
    setIsLoadingUnclaimed(true);
    const { data } = await adminGingrApi.unclaimedCustomers();
    if (data) {
      setUnclaimedCustomers(data.customers);
    }
    setIsLoadingUnclaimed(false);
  }, []);

  useEffect(() => {
    checkStatus();
    loadHistory();
    loadUnclaimedCustomers();
  }, [checkStatus, loadHistory, loadUnclaimedCustomers]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    const { data, error } = await adminGingrApi.sync();
    if (error) {
      setSyncError(error);
    } else if (data) {
      setSyncResult(data);
      if (data.success) loadHistory();
    }
    setIsSyncing(false);
  };

  const handleImport = async () => {
    setIsImporting(true);
    setImportError(null);
    setImportResult(null);
    const { data, error } = await adminGingrApi.importCustomers(90);
    if (error) {
      setImportError(error);
    } else if (data) {
      setImportResult(data);
      if (data.success) loadUnclaimedCustomers();
    }
    setIsImporting(false);
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
    <>
      <PageHeader title="Gingr Sync" subtitle="Manage Gingr API integration" />

      {/* Connection Status */}
      <Card
        title="Gingr Connection"
        headerRight={
          <Button variant="outline" size="sm" onClick={checkStatus} disabled={isCheckingStatus}>
            {isCheckingStatus ? 'Checking...' : 'Refresh Status'}
          </Button>
        }
        className="mb-6"
      >
        {statusError && (
          <Alert variant="error" className="mb-4">{statusError}</Alert>
        )}
        {status && (
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${status.connected ? 'bg-[#7FB685]' : 'bg-[#E8837B]'}`} />
            <div>
              <p className={`font-medium ${status.connected ? 'text-[#5A9A62]' : 'text-[#E8837B]'}`}>
                {status.connected ? 'Connected' : 'Not Connected'}
              </p>
              {status.connected && status.auth_format && (
                <p className="text-sm text-gray-500">Auth: {status.auth_format}</p>
              )}
              {!status.connected && status.error && (
                <p className="text-sm text-[#E8837B]">{status.error}</p>
              )}
              <p className="text-sm text-gray-500">Subdomain: {status.subdomain}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Sync Invoices */}
      <Card title="Sync Invoices" className="mb-6">
        <p className="text-gray-600 mb-6">
          Pull completed invoices from Gingr and automatically apply points to matched customers.
          Grooming services receive 1.5x points.
        </p>

        {syncError && <Alert variant="error" className="mb-4">{syncError}</Alert>}

        {syncResult && syncResult.success && (
          <Alert variant="success" className="mb-4">
            <div className="space-y-2">
              <p className="font-medium">Sync completed successfully!</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <div className="bg-white bg-opacity-50 rounded-lg p-2 text-center">
                  <p className="text-2xl font-bold">{syncResult.invoices_processed}</p>
                  <p className="text-sm">Invoices</p>
                </div>
                <div className="bg-white bg-opacity-50 rounded-lg p-2 text-center">
                  <p className="text-2xl font-bold text-[#5A9A62]">{syncResult.customers_matched}</p>
                  <p className="text-sm">Matched</p>
                </div>
                <div className="bg-white bg-opacity-50 rounded-lg p-2 text-center">
                  <p className="text-2xl font-bold text-amber-600">{syncResult.customers_not_found}</p>
                  <p className="text-sm">Unmatched</p>
                </div>
                <div className="bg-white bg-opacity-50 rounded-lg p-2 text-center">
                  <p className="text-2xl font-bold text-[#62A2C3]">+{syncResult.total_points_applied.toLocaleString()}</p>
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
      </Card>

      {/* Import Customers */}
      <Card title="Import Customers" className="mb-6">
        <p className="text-gray-600 mb-6">
          Import customers from Gingr invoices (last 90 days) and create unclaimed loyalty accounts.
          Customers can later claim their accounts at <span className="font-mono text-sm bg-gray-100 px-1 rounded">/claim</span> using their email or phone.
        </p>

        {importError && <Alert variant="error" className="mb-4">{importError}</Alert>}

        {importResult && importResult.success && (
          <Alert variant="success" className="mb-4">
            <div className="space-y-2">
              <p className="font-medium">Import completed successfully!</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                <div className="bg-white bg-opacity-50 rounded-lg p-2 text-center">
                  <p className="text-2xl font-bold text-[#5A9A62]">{importResult.customers_imported}</p>
                  <p className="text-sm">Imported</p>
                </div>
                <div className="bg-white bg-opacity-50 rounded-lg p-2 text-center">
                  <p className="text-2xl font-bold text-amber-600">{importResult.customers_skipped}</p>
                  <p className="text-sm">Skipped</p>
                </div>
                <div className="bg-white bg-opacity-50 rounded-lg p-2 text-center">
                  <p className="text-2xl font-bold text-[#62A2C3]">+{importResult.total_points_applied.toLocaleString()}</p>
                  <p className="text-sm">Points Applied</p>
                </div>
              </div>
            </div>
          </Alert>
        )}

        {importResult && importResult.skipped_customers.length > 0 && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-medium text-amber-800 mb-2">
              Skipped ({importResult.skipped_customers.length})
            </h3>
            <div className="max-h-32 overflow-y-auto text-sm text-amber-700 space-y-1">
              {importResult.skipped_customers.map((c, idx) => (
                <p key={idx}>
                  {c.email || c.phone || 'Unknown'}: {c.reason}
                </p>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={handleImport}
          isLoading={isImporting}
          disabled={!status?.connected || isImporting}
          size="lg"
          variant="outline"
          className="w-full md:w-auto"
        >
          {isImporting ? 'Importing...' : 'Import Customers from Gingr'}
        </Button>
      </Card>

      {/* Unmatched Customers */}
      {syncResult && syncResult.unmatched_customers.length > 0 && (
        <Card
          title={`Unmatched Customers (${syncResult.unmatched_customers.length})`}
          className="mb-6"
        >
          <p className="text-gray-600 mb-4">
            These customers from Gingr could not be matched to loyalty accounts.
          </p>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {syncResult.unmatched_customers.map((customer, index) => (
              <div key={index} className="border border-gray-100 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-[#1B365D]">{customer.owner_name}</p>
                    <p className="text-sm text-gray-500 font-mono">{customer.invoice_id}</p>
                  </div>
                  <p className="text-lg font-semibold text-[#1B365D]">${customer.total.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Owner Name</th>
                  <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Invoice ID</th>
                  <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {syncResult.unmatched_customers.map((customer, index) => (
                  <tr key={index} className={`border-b border-gray-50 ${index % 2 === 1 ? 'bg-[#F8F6F3]/50' : ''}`}>
                    <td className="px-5 sm:px-6 py-3.5 text-sm font-medium text-[#1B365D]">{customer.owner_name}</td>
                    <td className="px-5 sm:px-6 py-3.5 text-sm text-gray-500 font-mono">{customer.invoice_id}</td>
                    <td className="px-5 sm:px-6 py-3.5 text-sm text-[#1B365D]">${customer.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Unclaimed Accounts */}
      <Card
        title={`Unclaimed Accounts (${unclaimedCustomers.length})`}
        headerRight={
          <Button variant="outline" size="sm" onClick={loadUnclaimedCustomers} disabled={isLoadingUnclaimed}>
            {isLoadingUnclaimed ? 'Loading...' : 'Refresh'}
          </Button>
        }
        className="mb-6"
      >
        <p className="text-gray-600 mb-4">
          These customers have been imported but haven't claimed their accounts yet.
          They can visit <span className="font-mono text-sm bg-gray-100 px-1 rounded">/claim</span> to set up their password.
        </p>

        {isLoadingUnclaimed ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : unclaimedCustomers.length === 0 ? (
          <EmptyState
            title="No unclaimed accounts"
            description="All imported customers have claimed their accounts!"
          />
        ) : (
          <>
            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {unclaimedCustomers.map((customer) => (
                <div key={customer.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-[#1B365D]">{customer.first_name} {customer.last_name}</p>
                      <p className="text-sm text-gray-500">{customer.phone}</p>
                      <p className="text-sm text-gray-500 truncate max-w-[200px]">{customer.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#62A2C3]">{customer.points_balance.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">points</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">Imported: {formatDate(customer.created_at)}</p>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto -mx-5 sm:-mx-6">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Email</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Phone</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Points</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Imported</th>
                  </tr>
                </thead>
                <tbody>
                  {unclaimedCustomers.map((customer, idx) => (
                    <tr key={customer.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? 'bg-[#F8F6F3]/50' : ''}`}>
                      <td className="px-5 sm:px-6 py-3.5 text-sm font-medium text-[#1B365D]">{customer.first_name} {customer.last_name}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-gray-500">{customer.email}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-gray-500">{customer.phone}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-[#62A2C3] font-semibold">{customer.points_balance.toLocaleString()}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-gray-500">{formatDate(customer.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Sync History */}
      <Card title="Sync History">
        {isLoadingHistory ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : history.length === 0 ? (
          <EmptyState
            title="No sync history yet"
            description="Run your first sync above!"
          />
        ) : (
          <>
            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {history.map((item) => (
                <div key={item.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-[#1B365D]">{formatDate(item.synced_at)}</p>
                      <p className="text-sm text-gray-500">By: {item.synced_by}</p>
                    </div>
                    <p className="text-lg font-bold text-[#62A2C3]">+{item.total_points_applied.toLocaleString()}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#F8F6F3] rounded-lg p-2">
                      <p className="text-lg font-semibold">{item.invoices_processed}</p>
                      <p className="text-xs text-gray-500">Invoices</p>
                    </div>
                    <div className="bg-[#7FB685]/10 rounded-lg p-2">
                      <p className="text-lg font-semibold text-[#5A9A62]">{item.customers_matched}</p>
                      <p className="text-xs text-gray-500">Matched</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2">
                      <p className="text-lg font-semibold text-amber-600">{item.customers_not_found}</p>
                      <p className="text-xs text-gray-500">Unmatched</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto -mx-5 sm:-mx-6">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Date</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Synced By</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Invoices</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Matched</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Unmatched</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, idx) => (
                    <tr key={item.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? 'bg-[#F8F6F3]/50' : ''}`}>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-[#1B365D]">{formatDate(item.synced_at)}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-gray-500">{item.synced_by}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-[#1B365D]">{item.invoices_processed}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-[#5A9A62] font-medium">{item.customers_matched}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-amber-600">{item.customers_not_found}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-[#62A2C3] font-semibold">+{item.total_points_applied.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
