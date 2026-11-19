import { useState, useEffect } from 'react';
import { approvalAPI, userAPI, roleAPI, documentAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  UserCheck,
  Plus,
  Send,
  ShieldAlert,
  FileText,
  User,
  Users,
  Award,
  Trash2,
  X
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Approvals() {
  const { user: currentUser, hasPermission } = useAuth();
  const canReview = hasPermission('manage:approvals');
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(canReview ? 'actionable' : 'my-requests'); // 'actionable', 'all-pending', 'my-requests', 'history'
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null); // { request, decision: 'approve' | 'reject' }
  const [reviewNote, setReviewNote] = useState('');

  // Creation form state
  const [formData, setFormData] = useState({
    actionType: 'ROLE_ELEVATION',
    title: '',
    resource: 'users',
    resourceId: '',
    targetUserId: '',
    targetRoleId: '',
    targetClearance: 2,
    targetDocumentId: '',
    reason: ''
  });

  // Reference data for dropdowns
  const [allUsers, setAllUsers] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);

  useEffect(() => {
    fetchData();
    fetchReferenceData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const params = {};

      if (activeTab === 'actionable') {
        params.view = 'review-queue';
      } else if (activeTab === 'my-requests') {
        params.view = 'my-requests';
      } else if (activeTab === 'all-pending') {
        params.status = 'pending';
      } else if (activeTab === 'history') {
        // history handled via client filter or status
      }

      const [reqRes, statsRes] = await Promise.all([
        approvalAPI.getAll(params).catch(err => {
          console.error('Approvals fetch error:', err);
          return { data: { requests: [] } };
        }),
        approvalAPI.getStats().catch(err => {
          console.error('Approvals stats error:', err);
          return { data: { stats: null } };
        })
      ]);

      let fetchedRequests = reqRes.data?.requests || [];
      if (activeTab === 'history') {
        fetchedRequests = fetchedRequests.filter(r => r.status === 'approved' || r.status === 'rejected' || r.status === 'cancelled');
      }

      setRequests(fetchedRequests);
      setStats(statsRes.data?.stats || null);
    } catch (err) {
      setErrorMsg('Failed to load approvals data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [uRes, rRes, dRes] = await Promise.all([
        userAPI.getAll().catch(() => ({ data: { users: [] } })),
        roleAPI.getAll().catch(() => ({ data: { roles: [] } })),
        documentAPI.getAll().catch(() => ({ data: { documents: [] } }))
      ]);
      setAllUsers(uRes.data?.users || []);
      setAllRoles(rRes.data?.roles || []);
      setAllDocuments(dRes.data?.documents || []);
    } catch (err) {
      console.error('Reference data load error:', err);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.reason.trim()) {
      alert('Please provide a descriptive title and business justification.');
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg('');
      let payload = {};
      let resource = 'users';
      let resourceId = null;

      if (formData.actionType === 'ROLE_ELEVATION') {
        const targetU = allUsers.find(u => String(u.id) === String(formData.targetUserId));
        const targetR = allRoles.find(r => String(r.id) === String(formData.targetRoleId));
        if (!targetU || !targetR) {
          alert('Please select both a target user and a role.');
          setActionLoading(false);
          return;
        }
        resource = 'users';
        resourceId = targetU.id;
        payload = {
          targetUserId: targetU.id,
          targetUsername: targetU.username,
          newRoleId: targetR.id,
          roleName: targetR.name
        };
      } else if (formData.actionType === 'CLEARANCE_UPGRADE') {
        const targetU = allUsers.find(u => String(u.id) === String(formData.targetUserId));
        if (!targetU) {
          alert('Please select a target user.');
          setActionLoading(false);
          return;
        }
        resource = 'users';
        resourceId = targetU.id;
        payload = {
          targetUserId: targetU.id,
          targetUsername: targetU.username,
          newClearanceLevel: Number(formData.targetClearance)
        };
      } else if (formData.actionType === 'DOCUMENT_PUBLISH') {
        const targetD = allDocuments.find(d => String(d.id) === String(formData.targetDocumentId));
        if (!targetD) {
          alert('Please select a document.');
          setActionLoading(false);
          return;
        }
        resource = 'documents';
        resourceId = targetD.id;
        payload = {
          documentId: targetD.id,
          documentTitle: targetD.title,
          newStatus: 'published',
          newClassification: targetD.classification
        };
      } else if (formData.actionType === 'USER_DECOMMISSION') {
        const targetU = allUsers.find(u => String(u.id) === String(formData.targetUserId));
        if (!targetU) {
          alert('Please select a target user to decommission.');
          setActionLoading(false);
          return;
        }
        resource = 'users';
        resourceId = targetU.id;
        payload = {
          targetUserId: targetU.id,
          targetUsername: targetU.username,
          decommission: true
        };
      }

      await approvalAPI.create({
        actionType: formData.actionType,
        title: formData.title,
        resource,
        resourceId,
        payload,
        reason: formData.reason
      });

      setSuccessMsg('Request submitted successfully into 4-Eyes Queue!');
      setShowCreateModal(false);
      setFormData({
        actionType: 'ROLE_ELEVATION',
        title: '',
        resource: 'users',
        resourceId: '',
        targetUserId: '',
        targetRoleId: '',
        targetClearance: 2,
        targetDocumentId: '',
        reason: ''
      });
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit request: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewDecision = async () => {
    if (!reviewTarget) return;
    try {
      setActionLoading(true);
      setErrorMsg('');
      const { request, decision } = reviewTarget;

      if (decision === 'approve') {
        const res = await approvalAPI.approve(request.id, reviewNote);
        setSuccessMsg(res.data?.message || 'Request approved and executed!');
      } else {
        const res = await approvalAPI.reject(request.id, reviewNote);
        setSuccessMsg(res.data?.message || 'Request rejected.');
      }

      setShowReviewModal(false);
      setReviewTarget(null);
      setReviewNote('');
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Review action failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this pending approval request?')) return;
    try {
      setActionLoading(true);
      await approvalAPI.cancel(id);
      setSuccessMsg('Request cancelled successfully.');
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Cancel failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getActionBadge = (type) => {
    switch (type) {
      case 'ROLE_ELEVATION':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-900/60 text-purple-300 border border-purple-700">
            <Users className="w-3 h-3 mr-1" />
            Role Elevation
          </span>
        );
      case 'CLEARANCE_UPGRADE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-900/60 text-amber-300 border border-amber-700">
            <Award className="w-3 h-3 mr-1" />
            Clearance Upgrade
          </span>
        );
      case 'DOCUMENT_PUBLISH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-cyan-900/60 text-cyan-300 border border-cyan-700">
            <FileText className="w-3 h-3 mr-1" />
            Document Release
          </span>
        );
      case 'USER_DECOMMISSION':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-900/60 text-red-300 border border-red-700">
            <Trash2 className="w-3 h-3 mr-1" />
            User Decommission
          </span>
        );
      default:
        return <span className="badge-info text-xs">{type}</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-700">
            <Clock className="w-3 h-3 mr-1 animate-pulse" />
            Pending Checker Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved & Executed
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-950/80 text-red-300 border border-red-700">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
            Cancelled by Maker
          </span>
        );
      default:
        return <span className="badge-info text-xs">{status}</span>;
    }
  };

  const parsePayload = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const getRequiredAuthority = (actionType) => {
    switch (actionType) {
      case 'ROLE_ELEVATION':
      case 'USER_DECOMMISSION':
        return 'System Admin (Level 100)';
      case 'CLEARANCE_UPGRADE':
        return 'HR Management / Admin';
      case 'DOCUMENT_PUBLISH':
        return 'Department Manager / Admin';
      default:
        return 'Manager / Admin';
    }
  };

  const hasSpecificAuthority = (actionType) => {
    if (!currentUser) return false;
    const maxLevel = currentUser.maxRoleLevel || 0;
    if (maxLevel >= 100) return true;
    if (!canReview) return false;

    switch (actionType) {
      case 'ROLE_ELEVATION':
      case 'USER_DECOMMISSION':
        return false; // strictly admin
      case 'CLEARANCE_UPGRADE':
        return currentUser.department === 'HR' || maxLevel >= 100;
      case 'DOCUMENT_PUBLISH':
        return maxLevel >= 50;
      default:
        return true;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center text-white">
            <ShieldCheck className="w-8 h-8 mr-3 text-primary-500" />
            4-Eyes Dual-Control Workflow
          </h1>
          <p className="text-gray-400 mt-1 text-sm flex items-center gap-2">
            <span>Maker-Checker Authorization Model</span>
            <span className="text-gray-600">•</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-primary-300">
              NIST SP 800-53 (AC-5 Separation of Duties)
            </span>
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center space-x-2 text-sm px-4 py-2 self-start sm:self-auto shadow-lg shadow-primary-500/30"
        >
          <Plus className="w-4 h-4" />
          <span>New Elevation Request (Maker)</span>
        </button>
      </div>

      {/* Alert Banners */}
      {errorMsg && (
        <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-900/40 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card border border-gray-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Actionable by You</p>
          <p className="text-2xl font-bold text-amber-400 mt-1 flex items-center gap-2">
            {stats?.actionableByMe ?? 0}
            <span className="text-xs font-normal text-gray-500 font-sans">(Checker Role)</span>
          </p>
        </div>

        <div className="card border border-gray-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Pending</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats?.pending ?? 0}
          </p>
        </div>

        <div className="card border border-gray-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Approved & Executed</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {stats?.approved ?? 0}
          </p>
        </div>

        <div className="card border border-gray-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Rejected Decisions</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">
            {stats?.rejected ?? 0}
          </p>
        </div>
      </div>

      {/* Visual 4-Eyes Enterprise Process Infographic */}
      <div className="card border border-gray-700 bg-gradient-to-r from-gray-900 via-gray-900/90 to-primary-950/40 p-4">
        <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-400 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4" />
            Enterprise Governance Flow (4-Eyes Principle)
          </span>
          <span className="text-[11px] text-gray-400">
            Maker ≠ Checker (Insiders Cannot Unilaterally Elevate Privileges)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-gray-800/80 p-3 rounded-lg border border-gray-700 flex flex-col justify-between">
            <div>
              <p className="font-bold text-gray-200">1. Maker Initiates</p>
              <p className="text-gray-400 mt-1 text-[11px]">
                Authorized user submits request with proposed changes & business justification.
              </p>
            </div>
            <span className="text-[10px] text-primary-400 font-mono mt-2">State: PENDING</span>
          </div>

          <div className="bg-gray-800/80 p-3 rounded-lg border border-gray-700 flex flex-col justify-between">
            <div>
              <p className="font-bold text-amber-300">2. Anti-Self-Approval</p>
              <p className="text-gray-400 mt-1 text-[11px]">
                NIST AC-5 constraint strictly locks out the original Maker from approving their own request.
              </p>
            </div>
            <span className="text-[10px] text-amber-400 font-mono mt-2">Constraint: requesterId ≠ reviewerId</span>
          </div>

          <div className="bg-gray-800/80 p-3 rounded-lg border border-gray-700 flex flex-col justify-between">
            <div>
              <p className="font-bold text-emerald-300">3. Independent Checker</p>
              <p className="text-gray-400 mt-1 text-[11px]">
                Second independent authorized manager evaluates merits, risks, and records feedback.
              </p>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono mt-2">Decision: APPROVE / REJECT</span>
          </div>

          <div className="bg-gray-800/80 p-3 rounded-lg border border-gray-700 flex flex-col justify-between">
            <div>
              <p className="font-bold text-cyan-300">4. Atomic Execution</p>
              <p className="text-gray-400 mt-1 text-[11px]">
                Payload executes into database; dual digital IDs anchored into SHA-256 audit chain.
              </p>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono mt-2">Tamper-Evident SHA-256 Trail</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 space-x-2">
        <button
          onClick={() => setActiveTab('actionable')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'actionable'
              ? 'border-primary-500 text-primary-400 bg-primary-950/20'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Actionable Queue (Checker Review)</span>
          {stats?.actionableByMe > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {stats.actionableByMe}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('all-pending')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'all-pending'
              ? 'border-primary-500 text-primary-400 bg-primary-950/20'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>All Pending</span>
        </button>

        <button
          onClick={() => setActiveTab('my-requests')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'my-requests'
              ? 'border-primary-500 text-primary-400 bg-primary-950/20'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>My Submissions (Maker)</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-primary-500 text-primary-400 bg-primary-950/20'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Decisions History</span>
        </button>
      </div>

      {/* Requests List */}
      {loading ? (
        <LoadingSpinner />
      ) : requests.length === 0 ? (
        <div className="card text-center py-12 border border-gray-700">
          <ShieldCheck className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-300">
            {activeTab === 'actionable' && !canReview
              ? 'Checker Authority Required (Managers / Admins Only)'
              : 'No approval requests found'}
          </h3>
          <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
            {activeTab === 'actionable'
              ? !canReview
                ? 'To prevent unauthorized peer collusion, base employees cannot act as Checkers. Review and approval controls are strictly reserved for Managers and Administrators.'
                : 'All clear! There are no pending requests submitted by other team members awaiting your checker review.'
              : 'No requests match the selected view.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const isMaker = currentUser?.id === req.requesterId;
            const payload = parsePayload(req.payload);

            return (
              <div
                key={req.id}
                className="card border border-gray-700 hover:border-gray-600 transition-all p-5"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Left Column: Metadata & Badges */}
                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-gray-400 font-bold">
                        REQ #{req.id}
                      </span>
                      {getActionBadge(req.actionType)}
                      {getStatusBadge(req.status)}
                      <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                        Checker: {getRequiredAuthority(req.actionType)}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white leading-snug">
                      {req.title}
                    </h3>

                    {/* Maker & Reviewer Attribution */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                      <div className="flex items-center space-x-1.5">
                        <User className="w-3.5 h-3.5 text-primary-400" />
                        <span>Maker:</span>
                        <span className="font-semibold text-gray-200">
                          {req.requester?.fullName || req.requester?.username}
                        </span>
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.2 rounded border border-gray-700 font-mono">
                          {req.requester?.department} • Lvl {req.requester?.clearanceLevel}
                        </span>
                      </div>

                      {req.reviewer && (
                        <div className="flex items-center space-x-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Checker:</span>
                          <span className="font-semibold text-gray-200">
                            {req.reviewer?.fullName || req.reviewer?.username}
                          </span>
                        </div>
                      )}

                      <div className="text-gray-500">
                        {new Date(req.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {/* Proposed State Change Preview */}
                    <div className="bg-gray-800/80 border border-gray-700/80 rounded-lg p-3 text-xs">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Target Operation & State Transition:
                      </p>
                      <div className="font-mono text-gray-200">
                        {req.actionType === 'ROLE_ELEVATION' && (
                          <span>
                            Elevate target user <strong className="text-primary-300">@{payload.targetUsername || `User #${payload.targetUserId}`}</strong> to role <strong className="text-purple-300">{payload.roleName}</strong>
                          </span>
                        )}
                        {req.actionType === 'CLEARANCE_UPGRADE' && (
                          <span>
                            Upgrade target user <strong className="text-primary-300">@{payload.targetUsername || `User #${payload.targetUserId}`}</strong> to security clearance <strong className="text-amber-300">Level {payload.newClearanceLevel}</strong>
                          </span>
                        )}
                        {req.actionType === 'DOCUMENT_PUBLISH' && (
                          <span>
                            Publish restricted document <strong className="text-cyan-300">"{payload.documentTitle || `Doc #${payload.documentId}`}"</strong>
                          </span>
                        )}
                        {req.actionType === 'USER_DECOMMISSION' && (
                          <span>
                            Decommission active enterprise account <strong className="text-red-300">@{payload.targetUsername || `User #${payload.targetUserId}`}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Business Justification */}
                    <div className="text-xs bg-gray-900/60 p-2.5 rounded border border-gray-800">
                      <span className="font-semibold text-gray-400">Justification: </span>
                      <span className="text-gray-300 italic">"{req.reason}"</span>
                    </div>

                    {/* Review Note (if reviewed) */}
                    {req.reviewNote && (
                      <div className="text-xs bg-emerald-950/30 p-2.5 rounded border border-emerald-900/60 text-emerald-300">
                        <span className="font-semibold">Checker Rationale: </span>
                        <span>{req.reviewNote}</span>
                        {req.reviewedAt && (
                          <span className="text-[10px] text-gray-500 ml-2">
                            ({new Date(req.reviewedAt).toLocaleString()})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: 4-Eyes Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-center gap-2 self-end lg:self-center min-w-[180px]">
                    {req.status === 'pending' && (
                      <>
                        {isMaker ? (
                          <div className="text-right space-y-2">
                            <span className="inline-flex items-center text-[11px] px-2.5 py-1 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-400" />
                              Anti-Self-Approval Locked
                            </span>
                            <button
                              onClick={() => handleCancelRequest(req.id)}
                              disabled={actionLoading}
                              className="btn-secondary text-xs px-3 py-1.5 w-full text-red-400 hover:text-red-300 border-red-800/60"
                            >
                              Cancel Request
                            </button>
                          </div>
                        ) : hasSpecificAuthority(req.actionType) ? (
                          <div className="flex flex-col gap-2 w-full">
                            <button
                              onClick={() => {
                                setReviewTarget({ request: req, decision: 'approve' });
                                setShowReviewModal(true);
                              }}
                              disabled={actionLoading}
                              className="btn-primary text-xs px-3 py-2 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Approve & Execute</span>
                            </button>

                            <button
                              onClick={() => {
                                setReviewTarget({ request: req, decision: 'reject' });
                                setShowReviewModal(true);
                              }}
                              disabled={actionLoading}
                              className="btn-secondary text-xs px-3 py-2 flex items-center justify-center gap-1.5 text-red-400 hover:text-red-300 border-red-800/60"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject Request</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="text-[11px] text-amber-400/90 italic bg-amber-950/40 px-2.5 py-1 rounded border border-amber-800/80 block whitespace-nowrap">
                              Requires {getRequiredAuthority(req.actionType)}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {req.status === 'approved' && (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Executed into Database
                      </span>
                    )}

                    {req.status === 'rejected' && (
                      <span className="text-xs text-red-400 font-semibold flex items-center gap-1">
                        <XCircle className="w-4 h-4" />
                        Declined by Checker
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New 4-Eyes Elevation Request (Maker) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="card max-w-lg w-full border border-gray-700 bg-gray-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary-500" />
                Submit 4-Eyes Request (Maker)
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Target Enterprise Action
                </label>
                <select
                  value={formData.actionType}
                  onChange={(e) => setFormData({ ...formData, actionType: e.target.value })}
                  className="input w-full bg-gray-800 text-white"
                >
                  <option value="ROLE_ELEVATION">Role Elevation (Grant Higher Role)</option>
                  <option value="CLEARANCE_UPGRADE">Clearance Upgrade (Grant Level 2 or 3)</option>
                  <option value="DOCUMENT_PUBLISH">Publish Restricted Enterprise Document</option>
                  <option value="USER_DECOMMISSION">Decommission Active Enterprise User</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Request Title
                </label>
                <input
                  type="text"
                  placeholder="e.g., Elevate employee to Manager for Project Lead"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input w-full bg-gray-800 text-white"
                  required
                />
              </div>

              {/* Conditional Form Fields based on Action Type */}
              {(formData.actionType === 'ROLE_ELEVATION' ||
                formData.actionType === 'CLEARANCE_UPGRADE' ||
                formData.actionType === 'USER_DECOMMISSION') && (
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Select Target User
                  </label>
                  <select
                    value={formData.targetUserId}
                    onChange={(e) => setFormData({ ...formData, targetUserId: e.target.value })}
                    className="input w-full bg-gray-800 text-white"
                    required
                  >
                    <option value="">-- Select a User --</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName || u.username} (@{u.username}) - {u.department} (Clearance {u.clearanceLevel})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.actionType === 'ROLE_ELEVATION' && (
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Select Target Role to Assign
                  </label>
                  <select
                    value={formData.targetRoleId}
                    onChange={(e) => setFormData({ ...formData, targetRoleId: e.target.value })}
                    className="input w-full bg-gray-800 text-white"
                    required
                  >
                    <option value="">-- Select Target Role --</option>
                    {allRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Hierarchy Level {r.level})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.actionType === 'CLEARANCE_UPGRADE' && (
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Target Clearance Level
                  </label>
                  <select
                    value={formData.targetClearance}
                    onChange={(e) => setFormData({ ...formData, targetClearance: Number(e.target.value) })}
                    className="input w-full bg-gray-800 text-white"
                  >
                    <option value={2}>Level 2 (Secret / Department Confidential)</option>
                    <option value={3}>Level 3 (Top Secret / Enterprise Executive)</option>
                  </select>
                </div>
              )}

              {formData.actionType === 'DOCUMENT_PUBLISH' && (
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Select Restricted Document to Publish
                  </label>
                  <select
                    value={formData.targetDocumentId}
                    onChange={(e) => setFormData({ ...formData, targetDocumentId: e.target.value })}
                    className="input w-full bg-gray-800 text-white"
                    required
                  >
                    <option value="">-- Select Document --</option>
                    {allDocuments.map((d) => (
                      <option key={d.id} value={d.id}>
                        "{d.title}" [{d.classification}] ({d.department})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Business Justification (Required for Audit Compliance)
                </label>
                <textarea
                  rows="3"
                  placeholder="Explain why this high-impact action is necessary..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="input w-full bg-gray-800 text-white"
                  required
                />
              </div>

              <div className="bg-amber-950/40 border border-amber-800/80 p-2.5 rounded text-[11px] text-amber-300">
                <strong>Notice:</strong> As the Maker, you will be locked out of approving this request. An independent authorized Checker will need to review and verify it.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit for Review</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Review Decision (Checker) */}
      {showReviewModal && reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="card max-w-md w-full border border-gray-700 bg-gray-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {reviewTarget.decision === 'approve' ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    Confirm Approval & Atomic Execution
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-500" />
                    Reject Approval Request
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-gray-300">
                {reviewTarget.decision === 'approve'
                  ? `You are acting as the independent Checker approving REQ #${reviewTarget.request.id} ("${reviewTarget.request.title}"). This action will immediately update the database and write dual-signatures into the SHA-256 audit ledger.`
                  : `You are rejecting REQ #${reviewTarget.request.id}. Please provide a compliance rationale for the audit record.`}
              </p>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Checker Review Feedback / Rationale
                </label>
                <textarea
                  rows="3"
                  placeholder={
                    reviewTarget.decision === 'approve'
                      ? 'e.g., Verified business need and security clearance compliance.'
                      : 'e.g., Rejected: Insufficient justification provided.'
                  }
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="input w-full bg-gray-800 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleReviewDecision}
                  disabled={actionLoading}
                  className={`text-xs px-4 py-1.5 rounded-lg font-medium text-white shadow-md flex items-center gap-1.5 ${
                    reviewTarget.decision === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                      : 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                  }`}
                >
                  {reviewTarget.decision === 'approve' ? 'Approve & Execute' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

