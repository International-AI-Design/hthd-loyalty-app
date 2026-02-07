import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { adminStaffApi } from '../lib/api';
import type { AdminStaffUser } from '../lib/api';
import { Modal } from '../components/ui';

const ROLE_OPTIONS = [
  { value: 'staff', label: 'Staff' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  owner: { bg: 'bg-purple-100', text: 'text-purple-800' },
  admin: { bg: 'bg-blue-100', text: 'text-blue-800' },
  manager: { bg: 'bg-brand-cream', text: 'text-brand-navy' },
  staff: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

export function StaffPage() {
  const { staff: currentStaff } = useAuth();
  const [staffList, setStaffList] = useState<AdminStaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'staff',
  });

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setIsLoading(true);
    setError(null);
    const result = await adminStaffApi.getStaff();
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setStaffList(result.data.staff);
    }
  };

  const [roleError, setRoleError] = useState<string | null>(null);

  const handleRoleChange = async (staffId: string, newRole: string) => {
    setRoleError(null);
    const result = await adminStaffApi.updateRole(staffId, newRole);
    if (result.data) {
      // Merge response with existing data to preserve fields the API may not return (e.g., created_at)
      setStaffList((prev) => prev.map((s) => (s.id === staffId ? { ...s, ...result.data! } : s)));
    } else if (result.error) {
      setRoleError(result.error);
    }
  };

  const handleAddStaff = async () => {
    if (!addForm.username.trim() || !addForm.password.trim() || !addForm.firstName.trim() || !addForm.lastName.trim()) {
      setFormError('All fields are required');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const result = await adminStaffApi.createStaff({
      username: addForm.username.trim(),
      password: addForm.password,
      firstName: addForm.firstName.trim(),
      lastName: addForm.lastName.trim(),
      role: addForm.role,
    });

    setIsSubmitting(false);

    if (result.error) {
      setFormError(result.error);
    } else if (result.data) {
      setStaffList((prev) => [...prev, result.data!]);
      setShowAddForm(false);
      setAddForm({ username: '', password: '', firstName: '', lastName: '', role: 'staff' });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="font-heading text-2xl font-bold text-brand-navy mb-6">Staff Management</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-40 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-60" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="font-heading text-2xl font-bold text-brand-navy mb-6">Staff Management</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">{error}</p>
          <button onClick={loadStaff} className="mt-3 text-sm text-red-600 hover:text-red-800 underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-navy">Staff Management</h1>
          <p className="text-gray-500 text-sm mt-1">{staffList.length} team members</p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(true);
            setFormError(null);
          }}
          className="min-h-[44px] px-4 py-2.5 bg-brand-blue text-white rounded-lg font-medium hover:bg-brand-blue-dark transition-colors"
        >
          Add Staff
        </button>
      </div>

      {roleError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <p className="text-red-800 text-sm">Role update failed: {roleError}</p>
          <button onClick={() => setRoleError(null)} className="text-red-600 hover:text-red-800 text-sm font-medium ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staffList.map((member) => {
              const isSelf = currentStaff?.id === member.id;
              const roleColor = ROLE_COLORS[member.role] || ROLE_COLORS.staff;

              return (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-brand-navy">
                      {member.first_name} {member.last_name}
                    </span>
                    {isSelf && (
                      <span className="ml-2 text-xs text-gray-400">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{member.username}</td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColor.bg} ${roleColor.text}`}>
                        {member.role}
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${roleColor.bg} ${roleColor.text} min-h-[32px]`}
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      member.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {staffList.map((member) => {
          const isSelf = currentStaff?.id === member.id;
          const roleColor = ROLE_COLORS[member.role] || ROLE_COLORS.staff;

          return (
            <div key={member.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-brand-navy">
                    {member.first_name} {member.last_name}
                    {isSelf && <span className="text-xs text-gray-400 ml-1">(you)</span>}
                  </h3>
                  <p className="text-sm text-gray-500">@{member.username}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  member.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {member.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">
                  Joined {new Date(member.created_at).toLocaleDateString()}
                </span>
                {isSelf ? (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColor.bg} ${roleColor.text}`}>
                    {member.role}
                  </span>
                ) : (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border-0 cursor-pointer min-h-[36px] ${roleColor.bg} ${roleColor.text}`}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="Add Staff Member"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={addForm.firstName}
                onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={addForm.lastName}
                onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={addForm.username}
              onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue min-h-[44px]"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">{formError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddStaff}
              disabled={isSubmitting}
              className="flex-1 min-h-[44px] px-4 py-2.5 bg-brand-blue text-white rounded-lg font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Add Staff'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
