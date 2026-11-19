import { useEffect, useState, useMemo, Fragment } from 'react';
import { permissionAPI, roleAPI, resourceAPI } from '../utils/api';
import {
  Key,
  Grid,
  List,
  Plus,
  Edit,
  Trash2,
  X,
  Check,
  GitBranch,
  Search,
  Filter
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

export default function Permissions() {
  const { user: currentUser, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' or 'list'
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingRolePerm, setTogglingRolePerm] = useState(null); // { roleId, permId }
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResourceFilter, setSelectedResourceFilter] = useState('all');

  // Modal State for adding/editing permissions
  const [showModal, setShowModal] = useState(false);
  const [editingPerm, setEditingPerm] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    action: '',
    resource: '',
    description: '',
    resourceId: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [permsRes, rolesRes, resourcesRes] = await Promise.all([
        permissionAPI.getAll(),
        roleAPI.getAll().catch(() => ({ data: { roles: [] } })),
        resourceAPI.getAll().catch(() => ({ data: { resources: [] } })),
      ]);

      setPermissions(permsRes.data.permissions || []);
      // Sort roles by hierarchy level ascending (Employee -> HR -> Manager -> Admin)
      const sortedRoles = (rolesRes.data.roles || []).sort((a, b) => (a.level || 0) - (b.level || 0));
      setRoles(sortedRoles);
      setResources(resourcesRes.data.resources || []);
    } catch (error) {
      console.error('Error fetching matrix data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build inheritance map for each role: roleId -> Map(permId -> ancestorRoleName)
  const roleInheritedPermsMap = useMemo(() => {
    const map = new Map();

    roles.forEach((role) => {
      const inherited = new Map(); // permId -> ancestorRoleName
      let currentParentId = role.parentRoleId;
      const visited = new Set();

      while (currentParentId && !visited.has(currentParentId)) {
        visited.add(currentParentId);
        const parentRole = roles.find((r) => r.id === currentParentId);
        if (!parentRole) break;

        (parentRole.permissions || []).forEach((p) => {
          if (!inherited.has(p.id)) {
            inherited.set(p.id, parentRole.name);
          }
        });

        currentParentId = parentRole.parentRoleId;
      }

      map.set(role.id, inherited);
    });

    return map;
  }, [roles]);

  // Unique list of resources
  const uniqueResources = useMemo(() => {
    const set = new Set(permissions.map((p) => p.resource));
    return ['all', ...Array.from(set)];
  }, [permissions]);

  // Filtered permissions
  const filteredPermissions = useMemo(() => {
    return permissions.filter((perm) => {
      const matchesSearch =
        perm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (perm.description && perm.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        perm.resource.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesResource =
        selectedResourceFilter === 'all' || perm.resource === selectedResourceFilter;

      return matchesSearch && matchesResource;
    });
  }, [permissions, searchQuery, selectedResourceFilter]);

  // Group filtered permissions by resource
  const groupedPermissions = useMemo(() => {
    const groups = {};
    filteredPermissions.forEach((p) => {
      if (!groups[p.resource]) groups[p.resource] = [];
      groups[p.resource].push(p);
    });
    return groups;
  }, [filteredPermissions]);

  // Handle live toggle in the matrix
  const handleTogglePermission = async (role, permission, isDirect, isInherited, ancestorName) => {
    if (!hasPermission('update:roles')) {
      alert('You do not have permission to modify roles.');
      return;
    }

    // Role hierarchy rank protection
    if (currentUser?.maxRoleLevel < 100 && role.level >= currentUser?.maxRoleLevel) {
      alert('Hierarchy Boundary: You cannot modify a role with rank equal to or higher than your own.');
      return;
    }

    if (isInherited && !isDirect) {
      const confirmDirect = window.confirm(
        `This permission is already inherited from "${ancestorName}" via NIST RBAC1 hierarchy.\n\nDo you want to explicitly grant it as a direct permission to "${role.name}" as well?`
      );
      if (!confirmDirect) return;
    }

    try {
      setTogglingRolePerm({ roleId: role.id, permId: permission.id });
      const currentPermIds = (role.permissions || []).map((p) => p.id);
      let updatedPermIds;

      if (isDirect) {
        // Remove direct permission
        updatedPermIds = currentPermIds.filter((id) => id !== permission.id);
      } else {
        // Add direct permission
        updatedPermIds = [...currentPermIds, permission.id];
      }

      await roleAPI.update(role.id, {
        name: role.name,
        description: role.description,
        level: role.level,
        parentRoleId: role.parentRoleId,
        permissionIds: updatedPermIds,
      });

      // Update local state without full reload
      setRoles((prevRoles) =>
        prevRoles.map((r) => {
          if (r.id !== role.id) return r;
          const newPermissions = isDirect
            ? r.permissions.filter((p) => p.id !== permission.id)
            : [...r.permissions, permission];
          return { ...r, permissions: newPermissions };
        })
      );
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update permission mapping.');
    } finally {
      setTogglingRolePerm(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPerm) {
        await permissionAPI.update(editingPerm.id, formData);
      } else {
        await permissionAPI.create(formData);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this permission definition?')) {
      try {
        await permissionAPI.delete(id);
        fetchData();
      } catch (error) {
        alert(error.response?.data?.message || 'Delete failed');
      }
    }
  };

  const openEditModal = (perm) => {
    setEditingPerm(perm);
    setFormData({
      name: perm.name,
      action: perm.action,
      resource: perm.resource,
      description: perm.description || '',
      resourceId: perm.resourceId || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingPerm(null);
    setFormData({ name: '', action: '', resource: '', description: '', resourceId: '' });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center text-white">
            <Key className="w-8 h-8 mr-3 text-primary-500" />
            Role-Permission Matrix & Access Control
          </h1>
          <p className="text-gray-400 mt-1">
            2D visual access matrix displaying direct and transitively inherited permissions (NIST RBAC1).
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start md:self-auto">
          {/* Tab Switcher */}
          <div className="bg-gray-800 p-1 rounded-xl border border-gray-700 flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'matrix'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Matrix Grid</span>
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'list'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
          </div>

          {hasPermission('create:permissions') && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="btn-primary flex items-center space-x-1.5 text-xs px-3.5 py-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Permission</span>
            </button>
          )}
        </div>
      </div>

      {/* MATRIX VIEW */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Controls Bar: Search, Resource Filter, Legend */}
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter actions or permissions..."
                  className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500 w-full"
                />
              </div>

              {/* Resource Filter */}
              <div className="flex items-center space-x-1 overflow-x-auto py-1">
                <span className="text-xs text-gray-400 mr-1 flex items-center">
                  <Filter className="w-3 h-3 mr-1" /> Scope:
                </span>
                {uniqueResources.slice(0, 6).map((res) => (
                  <button
                    key={res}
                    onClick={() => setSelectedResourceFilter(res)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                      selectedResourceFilter === res
                        ? 'bg-primary-600 text-white font-semibold'
                        : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-700/60'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-4 text-xs text-gray-300 border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-700">
              <div className="flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-md bg-emerald-950 border border-emerald-600 flex items-center justify-center text-emerald-400 font-bold text-xs">
                  ✓
                </span>
                <span>Direct Permission</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-md bg-indigo-950 border border-indigo-600 flex items-center justify-center text-indigo-400 font-bold text-xs">
                  ↳
                </span>
                <span>Inherited (RBAC1)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-md bg-gray-900 border border-gray-700 flex items-center justify-center text-gray-600 font-bold text-xs">
                  —
                </span>
                <span>Not Granted</span>
              </div>
            </div>
          </div>

          {/* Matrix Grid Table */}
          <div className="card overflow-hidden p-0 border border-gray-700 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <colgroup>
                  <col className="w-80 min-w-[280px]" />
                  {roles.map((role) => (
                    <col key={role.id} className="min-w-[140px]" />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-gray-850 border-b border-gray-700 text-gray-300">
                    <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider sticky left-0 z-20 bg-gray-850 w-80 min-w-[280px]">
                      Protected Permission & Action
                    </th>
                    {roles.map((role) => (
                      <th
                        key={role.id}
                        className="py-3.5 px-4 text-center text-xs font-semibold uppercase tracking-wider min-w-[140px] border-l border-gray-700/60"
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-white font-bold">{role.name}</span>
                          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.2 rounded border border-indigo-800/80 mt-0.5">
                            Rank Lvl {role.level}
                          </span>
                          {role.parentRole && (
                            <span className="text-[9px] text-gray-400 flex items-center mt-0.5">
                              <GitBranch className="w-2.5 h-2.5 mr-0.5 text-primary-400" />
                              Inherits {role.parentRole.name}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-800">
                  {Object.entries(groupedPermissions).map(([resourceName, perms]) => (
                    <Fragment key={resourceName}>
                      {/* Resource Section Header */}
                      <tr className="bg-gray-900/95 font-semibold text-xs text-primary-400 uppercase tracking-wider border-t-2 border-gray-700">
                        <td
                          colSpan={roles.length + 1}
                          className="py-2 px-4 border-l-4 border-primary-500 bg-primary-950/20"
                        >
                          Resource: <strong className="text-white">{resourceName}</strong> ({perms.length} actions)
                        </td>
                      </tr>

                      {perms.map((perm) => (
                        <tr
                          key={perm.id}
                          className="hover:bg-gray-800/60 transition-colors group"
                        >
                          {/* Permission info column */}
                          <td className="py-3 px-4 sticky left-0 z-10 bg-gray-900 group-hover:bg-gray-850 transition-colors border-r border-gray-800 w-80 min-w-[280px]">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-xs font-semibold text-gray-200">
                                  {perm.name}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700">
                                  {perm.action}
                                </span>
                              </div>
                              {perm.description && (
                                <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-xs">
                                  {perm.description}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Matrix Cells for each role */}
                          {roles.map((role) => {
                            const isDirect = (role.permissions || []).some((p) => p.id === perm.id);
                            const inheritedFrom = roleInheritedPermsMap.get(role.id)?.get(perm.id);
                            const isInherited = Boolean(inheritedFrom);
                            const isToggling =
                              togglingRolePerm?.roleId === role.id &&
                              togglingRolePerm?.permId === perm.id;

                            return (
                              <td
                                key={role.id}
                                className="py-2.5 px-3 text-center border-l border-gray-800 align-middle min-w-[140px]"
                              >
                                {isToggling ? (
                                  <div className="inline-block animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                                ) : isDirect ? (
                                  <button
                                    onClick={() =>
                                      handleTogglePermission(role, perm, true, isInherited, inheritedFrom)
                                    }
                                    title={`Direct permission granted to ${role.name}. Click to revoke direct assignment.`}
                                    className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-950/80 hover:bg-red-950/80 border border-emerald-600 hover:border-red-600 text-emerald-400 hover:text-red-300 transition-all shadow-sm group/btn"
                                  >
                                    <span className="group-hover/btn:hidden flex items-center">
                                      <Check className="w-3.5 h-3.5 mr-1" />
                                      Direct
                                    </span>
                                    <span className="hidden group-hover/btn:flex items-center">
                                      <X className="w-3.5 h-3.5 mr-1" />
                                      Revoke
                                    </span>
                                  </button>
                                ) : isInherited ? (
                                  <button
                                    onClick={() =>
                                      handleTogglePermission(role, perm, false, true, inheritedFrom)
                                    }
                                    title={`Inherited from "${inheritedFrom}" via role hierarchy. Click to assign as explicit direct permission.`}
                                    className="inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-semibold bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-300 transition-all shadow-sm"
                                  >
                                    <GitBranch className="w-3 h-3 mr-1 text-indigo-400" />
                                    <span>via {inheritedFrom}</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleTogglePermission(role, perm, false, false, null)
                                    }
                                    title={`Click to grant "${perm.name}" to role "${role.name}".`}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:text-primary-400 hover:bg-gray-800 transition-all"
                                  >
                                    <span className="text-lg font-light text-gray-600 hover:text-primary-400">
                                      +
                                    </span>
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* LIST VIEW (Table View) */}
      {activeTab === 'list' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Permission</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Action</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Resource</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Description</th>
                  {(hasPermission('update:permissions') || hasPermission('delete:permissions')) && (
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {permissions.map((perm) => (
                  <tr key={perm.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-primary-400">{perm.name}</td>
                    <td className="px-6 py-4">
                      <span className="badge-success text-xs">{perm.action}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{perm.resource}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{perm.description}</td>
                    {(hasPermission('update:permissions') || hasPermission('delete:permissions')) && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {hasPermission('update:permissions') && (
                            <button
                              onClick={() => openEditModal(perm)}
                              className="p-2 hover:bg-gray-700 rounded-lg text-blue-400"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {hasPermission('delete:permissions') && (
                            <button
                              onClick={() => handleDelete(perm.id)}
                              className="p-2 hover:bg-gray-700 rounded-lg text-red-400"
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
      )}

      {/* Modal for Creating / Editing Permission */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingPerm ? 'Edit Permission' : 'Create Permission'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Permission Key</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="e.g. read:financial_reports"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Action</label>
                <select
                  value={formData.action}
                  onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select action</option>
                  <option value="create">Create</option>
                  <option value="read">Read</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="approve">Approve</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Resource Entity</label>
                <input
                  type="text"
                  value={formData.resource}
                  onChange={(e) => setFormData({ ...formData, resource: e.target.value })}
                  className="input-field"
                  placeholder="e.g. documents, invoices, users"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows="2"
                  placeholder="Detailed functional description..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  {editingPerm ? 'Update' : 'Create'}
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
