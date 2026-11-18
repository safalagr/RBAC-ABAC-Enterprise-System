import { useEffect, useState } from 'react';
import { roleAPI, permissionAPI } from '../utils/api';
import { Shield, Plus, Edit, Trash2, X, GitBranch, ArrowDown } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

export default function Roles() {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: 0,
    parentRoleId: '',
    permissionIds: [],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        roleAPI.getAll(),
        permissionAPI.getAll(),
      ]);
      setRoles(rolesRes.data.roles);
      setPermissions(permsRes.data.permissions);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        parentRoleId: formData.parentRoleId ? Number(formData.parentRoleId) : null,
      };
      if (editingRole) {
        await roleAPI.update(editingRole.id, payload);
      } else {
        await roleAPI.create(payload);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this role?')) {
      try {
        await roleAPI.delete(id);
        fetchData();
      } catch (error) {
        alert(error.response?.data?.message || 'Delete failed');
      }
    }
  };

  const openEditModal = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      level: role.level,
      parentRoleId: role.parentRole?.id || '',
      permissionIds: role.permissions?.map(p => p.id) || [],
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '', level: 0, parentRoleId: '', permissionIds: [] });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center text-white">
            <Shield className="w-8 h-8 mr-3 text-primary-500" />
            Hierarchical Roles (NIST RBAC1)
          </h1>
          <p className="text-gray-400 mt-1">
            Roles inherit permissions transitively from parent roles in an enterprise hierarchy graph.
          </p>
        </div>
        {hasPermission('create:roles') && (
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center space-x-2 self-start sm:self-auto">
            <Plus className="w-5 h-5" />
            <span>Add Role</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="card hover:border-primary-500/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-xl font-bold text-gray-200 flex items-center">
                    {role.name}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded font-mono">
                      Level {role.level}
                    </span>
                    {role.parentRole && (
                      <span className="text-xs bg-gray-800 text-gray-300 border border-gray-700 px-2 py-0.5 rounded flex items-center">
                        <GitBranch className="w-3 h-3 mr-1 text-primary-400" />
                        Inherits {role.parentRole.name}
                      </span>
                    )}
                  </div>
                </div>
                {(hasPermission('update:roles') || hasPermission('delete:roles')) && (
                  <div className="flex space-x-1">
                    {hasPermission('update:roles') && (
                      <button onClick={() => openEditModal(role)} className="p-1.5 hover:bg-gray-800 rounded-lg text-blue-400">
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {hasPermission('delete:roles') && (
                      <button onClick={() => handleDelete(role.id)} className="p-1.5 hover:bg-gray-800 rounded-lg text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <p className="text-gray-400 text-sm mb-4 leading-relaxed">{role.description}</p>
            </div>

            <div className="border-t border-gray-800 pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Direct Permissions ({role.permissions?.length || 0})
                </span>
                {role.parentRole && (
                  <span className="text-xs text-primary-400 flex items-center">
                    <ArrowDown className="w-3 h-3 mr-0.5" />
                    + Parent Inherited
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {role.permissions?.slice(0, 4).map((perm) => (
                  <span key={perm.id} className="badge-info text-xs">{perm.name}</span>
                ))}
                {role.permissions?.length > 4 && (
                  <span className="badge-info text-xs">+{role.permissions.length - 4} more</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">{editingRole ? 'Edit Role' : 'Add New Role'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" rows="2" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Hierarchy Level (Rank)</label>
                  <input type="number" value={formData.level} onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 0 })} className="input-field" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Parent Role (Inheritance)</label>
                  <select
                    value={formData.parentRoleId}
                    onChange={(e) => setFormData({ ...formData, parentRoleId: e.target.value })}
                    className="input-field"
                  >
                    <option value="">None (Root Base Role)</option>
                    {roles
                      .filter(r => !editingRole || r.id !== editingRole.id)
                      .map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} (Level {r.level})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Direct Permissions</label>
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto p-3 bg-gray-800/80 rounded-lg border border-gray-700">
                  {permissions.map((perm) => (
                    <label key={perm.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-750 rounded">
                      <input type="checkbox" checked={formData.permissionIds.includes(perm.id)} onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, permissionIds: [...formData.permissionIds, perm.id] });
                        } else {
                          setFormData({ ...formData, permissionIds: formData.permissionIds.filter(id => id !== perm.id) });
                        }
                      }} className="rounded border-gray-600" />
                      <span className="text-xs text-gray-300">{perm.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn-primary flex-1">{editingRole ? 'Update' : 'Create'} Role</button>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
