import { useEffect, useState } from 'react';
import { documentAPI } from '../utils/api';
import { FileText, Plus, Shield, Lock, Eye, Building, Award } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

export default function Documents() {
  const { user, hasPermission } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    department: user?.department || 'Engineering',
    classification: 'internal',
    minClearanceLevel: 1
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await documentAPI.getAll();
      setDocuments(res.data.documents || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await documentAPI.create(formData);
      setShowModal(false);
      setFormData({
        title: '',
        content: '',
        department: user?.department || 'Engineering',
        classification: 'internal',
        minClearanceLevel: 1
      });
      fetchDocuments();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create document');
    }
  };

  const getClassificationBadge = (classification) => {
    switch (classification) {
      case 'public':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-900/60 text-green-300 border border-green-700">PUBLIC</span>;
      case 'internal':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-900/60 text-blue-300 border border-blue-700">INTERNAL</span>;
      case 'confidential':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-900/60 text-red-300 border border-red-700">CONFIDENTIAL</span>;
      default:
        return null;
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center text-white">
            <FileText className="w-8 h-8 mr-3 text-primary-500" />
            Enterprise Records (ABAC Showcase)
          </h1>
          <p className="text-gray-400 mt-1">
            Access to these documents is dynamically evaluated using <strong className="text-primary-400">NIST SP 800-162 ABAC</strong> rules.
          </p>
        </div>

        {hasPermission('create:documents') && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center space-x-2 self-start sm:self-auto"
          >
            <Plus className="w-5 h-5" />
            <span>New Document</span>
          </button>
        )}
      </div>

      {/* ABAC Subject Attributes Context Banner */}
      <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4 shadow-lg backdrop-blur">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center">
          <Shield className="w-4 h-4 mr-2 text-primary-400" />
          Active Subject Evaluation Context
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-900/80 p-3 rounded-lg border border-gray-800">
            <span className="text-gray-400 text-xs block">Subject Username</span>
            <span className="font-semibold text-white">{user?.username}</span>
          </div>
          <div className="bg-gray-900/80 p-3 rounded-lg border border-gray-800">
            <span className="text-gray-400 text-xs block">Assigned Department</span>
            <span className="font-semibold text-primary-300 flex items-center mt-0.5">
              <Building className="w-3.5 h-3.5 mr-1" />
              {user?.department || 'General'}
            </span>
          </div>
          <div className="bg-gray-900/80 p-3 rounded-lg border border-gray-800">
            <span className="text-gray-400 text-xs block">Security Clearance</span>
            <span className="font-semibold text-amber-400 flex items-center mt-0.5">
              <Award className="w-3.5 h-3.5 mr-1" />
              Level {user?.clearanceLevel || 1}
            </span>
          </div>
          <div className="bg-gray-900/80 p-3 rounded-lg border border-gray-800">
            <span className="text-gray-400 text-xs block">Max Hierarchy Rank</span>
            <span className="font-semibold text-indigo-400">
              Level {user?.maxRoleLevel ?? (user?.roles?.[0]?.level || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="bg-gray-800 border border-gray-700/80 rounded-xl p-5 hover:border-gray-600 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getClassificationBadge(doc.classification)}
                  <span className="text-xs text-gray-400 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                    Dept: {doc.department}
                  </span>
                </div>
                <span className="text-xs font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                  Min Clr: {doc.minClearanceLevel}
                </span>
              </div>

              <h2 className="text-lg font-bold text-white mb-2">{doc.title}</h2>
              <p className="text-gray-300 text-sm leading-relaxed mb-4 line-clamp-3">
                {doc.content}
              </p>
            </div>

            <div className="pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs text-gray-400">
              <span>Owner: <strong className="text-gray-300">{doc.owner?.fullName || 'System'}</strong></span>
              <button
                onClick={() => setSelectedDoc(doc)}
                className="text-primary-400 hover:text-primary-300 flex items-center space-x-1 font-medium"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Full Record</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {documents.length === 0 && (
        <div className="text-center py-12 bg-gray-800/40 rounded-xl border border-gray-700">
          <Lock className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-300">No Documents Accessible</h3>
          <p className="text-sm text-gray-500 mt-1">
            ABAC policies currently restrict view access based on your department and clearance level.
          </p>
        </div>
      )}

      {/* View Document Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                {getClassificationBadge(selectedDoc.classification)}
                <h3 className="text-xl font-bold text-white mt-2">{selectedDoc.title}</h3>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-gray-400 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-900/90 rounded-lg p-4 text-sm text-gray-200 mb-4 whitespace-pre-wrap leading-relaxed border border-gray-800">
              {selectedDoc.content}
            </div>

            <div className="space-y-2 text-xs bg-gray-900/50 p-3 rounded-lg border border-gray-800 text-gray-400 mb-4">
              <div className="flex justify-between">
                <span>Department:</span>
                <strong className="text-gray-200">{selectedDoc.department}</strong>
              </div>
              <div className="flex justify-between">
                <span>Required Clearance:</span>
                <strong className="text-amber-400">Level {selectedDoc.minClearanceLevel}</strong>
              </div>
              <div className="flex justify-between">
                <span>Owner:</span>
                <strong className="text-gray-200">{selectedDoc.owner?.fullName} ({selectedDoc.owner?.username})</strong>
              </div>
            </div>

            <button
              onClick={() => setSelectedDoc(null)}
              className="w-full btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Create Document Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-primary-400" />
              Create Enterprise Document
            </h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  placeholder="e.g. Q3 Strategic Planning"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Content</label>
                <textarea
                  required
                  rows="4"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  placeholder="Document body..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Classification</label>
                  <select
                    value={formData.classification}
                    onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                    <option value="confidential">Confidential</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Min Clearance Level</label>
                  <select
                    value={formData.minClearanceLevel}
                    onChange={(e) => setFormData({ ...formData, minClearanceLevel: Number(e.target.value) })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value={1}>Level 1 (Standard)</option>
                    <option value={2}>Level 2 (Internal/Secret)</option>
                    <option value={3}>Level 3 (Confidential/Top Secret)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Department Scoping
                </label>
                <input
                  type="text"
                  value={formData.department}
                  disabled={user?.maxRoleLevel < 100}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:opacity-60 focus:outline-none focus:border-primary-500"
                />
                {user?.maxRoleLevel < 100 && (
                  <p className="text-xs text-gray-400 mt-1">
                    ABAC rule locks non-admin creators to their assigned department.
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Publish Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

