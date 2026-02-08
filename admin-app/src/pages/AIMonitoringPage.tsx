import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminMessagingApi } from '../lib/api';

interface AIConversation {
  id: string;
  customer_name: string;
  dog_name: string;
  last_message: string;
  last_ai_response: string;
  last_message_at: string;
  status: 'active' | 'escalated' | 'closed';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function statusBadge(status: AIConversation['status']) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-[#62A2C3]/15', text: 'text-[#4F8BA8]', label: 'Active' },
    escalated: { bg: 'bg-[#E8837B]/15', text: 'text-[#E8837B]', label: 'Escalated' },
    closed: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Closed' },
  };
  const s = map[status] ?? map.active;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

export function AIMonitoringPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchConversations = useCallback(async () => {
    const statusArg = statusFilter === 'all' ? undefined : statusFilter;
    const result = await adminMessagingApi.getConversations(statusArg);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setConversations(result.data.conversations ?? result.data ?? []);
      setError(null);
    }
    setIsLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleView = (id: string) => {
    navigate('/messages?conv=' + id);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="font-heading text-xl font-bold text-[#1B365D]">AI Conversation Monitor</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3]/30 min-h-[44px]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="escalated">Escalated</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      {error && (
        <div className="mb-4 px-3 py-2 bg-[#E8837B]/10 text-[#E8837B] text-sm rounded-lg">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No AI conversations found
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dog</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Message</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI Response</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {conversations.map((conv) => (
                  <tr key={conv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-[#1B365D]">{conv.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{conv.dog_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{conv.last_message}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{conv.last_ai_response}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{formatDate(conv.last_message_at)}</td>
                    <td className="px-4 py-3">{statusBadge(conv.status)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleView(conv.id)}
                        className="text-xs font-medium text-[#62A2C3] hover:text-[#4F8BA8] transition-colors min-h-[36px] px-2"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
