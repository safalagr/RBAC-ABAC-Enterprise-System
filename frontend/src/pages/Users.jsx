import { useEffect, useState } from 'react';
import { userAPI, roleAPI } from '../utils/api';
import { Users as UsersIcon, Plus, Edit, Trash2, X, CheckCircle, XCircle, Building, Award, Shield } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

export default function Users() {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [scopingApplied, setScopingApplied] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    department: 'Engineering',
    title: 'Staff',
    clearanceLevel: 1,
    roleIds: [],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const usersRes = await userAPI.getAll();
      setUsers(usersRes.data.users);
      setScopingApplied(usersRes.data.scopingApplied || 'Active Scoping');

      if (hasPermission('create:users') || hasPermission('update:users')) {
        try {
          const rolesRes = await roleAPI.getAll();
          setRoles(rolesRes.data.roles);
        } catch (error) {
          console.error('Error fetching roles:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await userAPI.update(editingUser.id, formData);
      } else {
        await userAPI.create(formData);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await userAPI.delete(id);
        fetchData();
      } catch (error) {
        alert(error.response?.data?.message || 'Delete failed');
      }
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      fullName: user.fullName,
      department: user.department || 'Engineering',
      title: user.title || 'Staff',
      clearanceLevel: user.clearanceLevel || 1,
      roleIds: user.roles?.map(r => r.id) || [],
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      fullName: '',
      department: currentUser?.department || 'Engineering',
      title: 'Staff',
      clearanceLevel: 1,
      roleIds: [],
    });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center text-white">
            <UsersIcon className="w-8 h-8 mr-3 text-primary-500" />
            User Management (ABAC Scoped)
          </h1>
          <p className="text-gray-400 mt-1">Manage enterprise users with department boundaries and security clearance</p>
        </div>
        {hasPermission('create:users') && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn-primary flex items-center space-x-2 self-start sm:self-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Add User</span>
          </button>
        )}
      </div>

      {/* ABAC Scoping Info Banner */}
      <div className="bg-primary-950/40 border border-primary-800/60 rounded-xl p-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3 text-sm">
          <Shield className="w-5 h-5 text-primary-400 flex-shrink-0" />
          <span className="text-gray-300">
            <strong className="text-white">Active Visibility Scope:</strong> {scopingApplied}
          </span>
        </div>
        <span className="text-xs bg-primary-900/80 text-primary-300 border border-primary-700 px-2 py-0.5 rounded-full font-mono">
          {users.length} visible user(s)
        </span>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">User & Designation</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Department</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Clearance</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Roles</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                {(hasPermission('update:users') || hasPermission('delete:users')) && (
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-200">{user.fullName}</p>
                      <p className="text-xs text-primary-400">{user.title || 'Staff'} • @{user.username}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center text-xs bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-md text-gray-300">
                      <Building className="w-3 h-3 mr-1 text-primary-400" />
                      {user.department || 'General'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center text-xs bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded-md text-amber-300 font-mono">
                      <Award className="w-3 h-3 mr-1 text-amber-400" />
                      Level {user.clearanceLevel || 1}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {user.roles?.map((role) => (
                        <span key={role.id} className="badge-info text-xs">
                          {role.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.isActive ? (
                      <span className="badge-success flex items-center w-fit text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="badge-error flex items-center w-fit text-xs">
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactive
                      </span>
                    )}
                  </td>
                  {(hasPermission('update:users') || hasPermission('delete:users')) && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {hasPermission('update:users') && (
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-blue-400"
                            title="Edit User"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {hasPermission('delete:users') && (
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-red-400"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                {editingUser ? 'Edit User Attributes' : 'Create Enterprise User'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="input-field text-sm"
                    required
                    disabled={editingUser}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="input-field text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Job Title / Designation</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input-field text-sm"
                    placeholder="e.g. Director of Finance"
                  />
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field text-sm"
                    required={!editingUser}
                  />
                </div>
              )}

              {/* ABAC Attributes */}
              <div className="bg-gray-850 p-3 rounded-lg border border-gray-700/80 space-y-3">
                <h4 className="text-xs font-semibold uppercase text-primary-400 tracking-wider">
                  ABAC Subject Attributes
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Department</label>
                    <select
                      value={formData.department}
                      disabled={currentUser?.maxRoleLevel < 100}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="input-field text-sm disabled:opacity-60"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="HR">HR</option>
                      <option value="Finance">Finance</option>
                      <option value="IT">IT</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Clearance Level</label>
                    <select
                      value={formData.clearanceLevel}
                      disabled={currentUser?.maxRoleLevel < 100}
                      onChange={(e) => setFormData({ ...formData, clearanceLevel: Number(e.target.value) })}
                      className="input-field text-sm disabled:opacity-60"
                    >
                      <option value={1}>Level 1 (Standard)</option>
                      <option value={2}>Level 2 (Internal/Secret)</option>
                      <option value={3}>Level 3 (Confidential)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Assigned Roles</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-gray-800 rounded-lg border border-gray-700">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center space-x-2 cursor-pointer p-1">
                      <input
                        type="checkbox"
                        checked={formData.roleIds.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              roleIds: [...formData.roleIds, role.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              roleIds: formData.roleIds.filter((id) => id !== role.id),
                            });
                          }
                        }}
                        className="rounded border-gray-600"
                      />
                      <span className="text-xs text-gray-300">{role.name} (Lvl {role.level})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-3">
                <button type="submit" className="btn-primary flex-1">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
