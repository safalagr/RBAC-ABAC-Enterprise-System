import { useEffect, useState } from 'react';
import { auditAPI } from '../utils/api';
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Flame,
  Wrench,
  Link as LinkIcon,
  Eye,
  X
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [tampering, setTampering] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [filters, setFilters] = useState({ page: 1, limit: 20, action: '', status: '' });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Clean query parameters so empty filters are not passed to backend
      const cleanParams = {
        page: filters.page,
        limit: filters.limit
      };
      if (filters.action && filters.action.trim()) {
        cleanParams.action = filters.action.trim();
      }
      if (filters.status && filters.status.trim() && filters.status !== 'all') {
        cleanParams.status = filters.status.trim();
      }

      const [logsRes, statsRes, verifyRes] = await Promise.all([
        auditAPI.getLogs(cleanParams).catch((err) => {
          console.error('Audit getLogs error:', err);
          return { data: { logs: [] } };
        }),
        auditAPI.getStats().catch((err) => {
          console.error('Audit getStats error:', err);
          return { data: { stats: null } };
        }),
        auditAPI.verifyChain().catch((err) => {
          console.error('Audit verifyChain error:', err);
          return { data: { verification: null } };
        })
      ]);

      setLogs(logsRes.data?.logs || []);
      setStats(statsRes.data?.stats || null);
      setVerification(verifyRes.data?.verification || null);
    } catch (error) {
      console.error('Error fetching audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunVerification = async () => {
    try {
      setVerifying(true);
      const res = await auditAPI.verifyChain();
      setVerification(res.data.verification);
    } catch (error) {
      alert('Verification request failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setVerifying(false);
    }
  };

  const handleSimulateTamper = async () => {
    const confirmTamper = window.confirm(
      'Simulate unauthorized database tampering?\n\nThis will modify a row directly in the database without recomputing the SHA-256 hash to prove that the integrity check flags fraudulent alteration.'
    );
    if (!confirmTamper) return;

    try {
      setTampering(true);
      await auditAPI.simulateTamper();
      await handleRunVerification();
      await fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Tamper simulation failed.');
    } finally {
      setTampering(false);
    }
  };

  const handleRepairChain = async () => {
    try {
      setRepairing(true);
      await auditAPI.repairChain();
      await handleRunVerification();
      await fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Chain repair failed.');
    } finally {
      setRepairing(false);
    }
  };

  const formatTimestamp = (val) => {
    if (!val) return { time: 'N/A', date: '' };
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return { time: String(val), date: '' };
      return {
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: d.toLocaleDateString()
      };
    } catch {
      return { time: String(val), date: '' };
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return (
          <span className="badge-success flex items-center text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />
            Success
          </span>
        );
      case 'failed':
        return (
          <span className="badge-error flex items-center text-xs">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
      case 'denied':
        return (
          <span className="badge-warning flex items-center text-xs">
            <AlertCircle className="w-3 h-3 mr-1" />
            Denied
          </span>
        );
      case 'tampered':
        return (
          <span className="badge-error flex items-center text-xs font-semibold">
            <Flame className="w-3 h-3 mr-1 text-red-400" />
            Tampered
          </span>
        );
      default:
        return <span className="badge-info text-xs">{status}</span>;
    }
  };

  if (loading && logs.length === 0) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center text-white">
            <FileText className="w-8 h-8 mr-3 text-primary-500" />
            Tamper-Evident Audit Ledger
          </h1>
          <p className="text-gray-400 mt-1">
            Immutable, SHA-256 hash-chained audit log supporting SOC2 & ISO 27001 non-repudiation.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            onClick={handleRunVerification}
            disabled={verifying}
            className="btn-primary flex items-center space-x-1.5 text-xs px-3.5 py-2 shadow-lg"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Verifying Chain...' : 'Verify Ledger Integrity'}</span>
          </button>
        </div>
      </div>

      {/* Cryptographic Hash Chain Integrity Card */}
      {verification && (
        <div
          className={`rounded-2xl p-5 border shadow-2xl transition-all ${
            verification.isValid
              ? 'bg-emerald-950/30 border-emerald-700/60 shadow-emerald-950/20'
              : 'bg-red-950/40 border-red-600/80 shadow-red-950/30'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div
                className={`p-3 rounded-xl border flex-shrink-0 ${
                  verification.isValid
                    ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300'
                    : 'bg-red-900/60 border-red-500 text-red-200 animate-pulse'
                }`}
              >
                {verification.isValid ? (
                  <ShieldCheck className="w-7 h-7" />
                ) : (
                  <ShieldAlert className="w-7 h-7" />
                )}
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h3
                    className={`text-lg font-bold ${
                      verification.isValid ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {verification.isValid
                      ? 'Cryptographic Ledger Verified (Tamper-Free)'
                      : 'SECURITY ALERT: Unauthorized Log Modification Detected!'}
                  </h3>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold border ${
                      verification.isValid
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                        : 'bg-red-950 text-red-300 border-red-700'
                    }`}
                  >
                    {verification.isValid ? 'Chain Valid' : 'Chain Compromised'}
                  </span>
                </div>

                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  {verification.isValid
                    ? `Every log entry is cryptographically linked with SHA-256. All ${verification.totalLogs} blocks verified unbroken.`
                    : verification.reason}
                </p>

                {verification.isValid && verification.latestBlockHash && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-gray-400 mt-2">
                    <span>
                      Latest Block Hash:{' '}
                      <strong className="text-emerald-400">
                        {verification.latestBlockHash.substring(0, 16)}...
                      </strong>
                    </span>
                    <span>
                      Genesis Hash:{' '}
                      <strong className="text-gray-300">
                        {verification.genesisHash?.substring(0, 16)}...
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tamper Simulation & Repair Action Buttons (Demo Tooling) */}
            <div className="flex items-center space-x-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-700/60">
              {verification.isValid ? (
                <button
                  onClick={handleSimulateTamper}
                  disabled={tampering}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 hover:bg-red-950 text-red-400 border border-red-800/60 hover:border-red-600 transition-all flex items-center space-x-1.5"
                  title="Simulate modifying a database row directly via SQL to verify tamper detection"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{tampering ? 'Simulating...' : 'Simulate DB Tampering'}</span>
                </button>
              ) : (
                <button
                  onClick={handleRepairChain}
                  disabled={repairing}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-900 hover:bg-emerald-800 text-white border border-emerald-600 transition-all flex items-center space-x-1.5"
                  title="Recalculate cryptographic hash chain to restore valid state"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{repairing ? 'Repairing...' : 'Repair & Restore Chain'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card bg-blue-500/10 border-blue-500/20 p-4">
            <p className="text-xs text-gray-400 mb-1">Total Ledger Entries</p>
            <p className="text-2xl font-bold text-white">{stats.totalLogs}</p>
          </div>
          <div className="card bg-green-500/10 border-green-500/20 p-4">
            <p className="text-xs text-gray-400 mb-1">Success Operations</p>
            <p className="text-2xl font-bold text-green-400">{stats.successLogs}</p>
          </div>
          <div className="card bg-red-500/10 border-red-500/20 p-4">
            <p className="text-xs text-gray-400 mb-1">Failed Attempts</p>
            <p className="text-2xl font-bold text-red-400">{stats.failedLogs}</p>
          </div>
          <div className="card bg-yellow-500/10 border-yellow-500/20 p-4">
            <p className="text-xs text-gray-400 mb-1">ABAC Denials</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.deniedLogs}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-300">Filter Audit Trail</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Action Name</label>
            <input
              type="text"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
              className="input-field text-xs py-1.5"
              placeholder="e.g., login, create_user, publish_document"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              className="input-field text-xs py-1.5"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="denied">Denied</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ page: 1, limit: 20, action: '', status: '' })}
              className="btn-secondary w-full text-xs py-1.5"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden p-0 border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-300">Block # & Time</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-300">Actor</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-300">Action & Resource</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-300">Status</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-gray-300">SHA-256 Block Hash</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-300">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {logs.map((log) => {
                const isTamperedRow =
                  verification &&
                  !verification.isValid &&
                  verification.tamperedRowId === log.id;

                const { time, date } = formatTimestamp(log.timestamp);

                return (
                  <tr
                    key={log.id}
                    className={`transition-colors ${
                      isTamperedRow
                        ? 'bg-red-950/40 hover:bg-red-950/60 border-l-4 border-red-500'
                        : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-gray-400">
                          #{log.id}
                        </span>
                        <span className="text-xs text-gray-300">{time}</span>
                      </div>
                      {date && (
                        <span className="text-[10px] text-gray-500 block">
                          {date}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-xs">
                      {log.user ? (
                        <div>
                          <p className="font-semibold text-gray-200">
                            {log.user.fullName || log.user.username}
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono">
                            @{log.user.username}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">System Kernel</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-xs text-primary-400 font-semibold">
                          {log.action}
                        </span>
                        {log.resource && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700">
                            {log.resource}
                          </span>
                        )}
                      </div>
                      {isTamperedRow && (
                        <span className="text-[10px] text-red-400 font-bold block mt-0.5">
                          ⚠ Tampering Detected at this Row!
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {isTamperedRow ? (
                        <span className="badge-error flex items-center text-xs font-semibold whitespace-nowrap">
                          <Flame className="w-3 h-3 mr-1 text-red-400 flex-shrink-0" />
                          Tampered
                        </span>
                      ) : (
                        getStatusBadge(log.status)
                      )}
                    </td>

                    {/* Cryptographic Hash Badge */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-1 font-mono text-[11px]">
                        <LinkIcon className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        <span
                          className="bg-gray-900 border border-gray-700 px-2 py-0.5 rounded text-gray-300 truncate max-w-[120px]"
                          title={`Full Block Hash: ${log.hash}\nPrevious Hash: ${log.previousHash}`}
                        >
                          {log.hash ? `${log.hash.substring(0, 10)}...` : 'GENESIS'}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 hover:bg-gray-700 rounded-lg text-primary-400 transition-colors"
                        title="View Full Cryptographic Block & Metadata"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-gray-400">
                    <FileText className="w-10 h-10 mx-auto text-gray-600 mb-2" />
                    <p className="text-sm font-semibold text-gray-300">No Audit Logs Found</p>
                    <p className="text-xs text-gray-500 mt-1">
                      No activities match your current filters or no actions have been logged yet.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <p>Showing page {filters.page}</p>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
            disabled={filters.page === 1}
            className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            disabled={logs.length < filters.limit}
            className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Block Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card max-w-xl w-full p-6 border-gray-700 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-primary-400" />
                <h3 className="text-lg font-bold text-white">
                  Audit Block #{selectedLog.id} Cryptographic Inspection
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-gray-900 p-3 rounded-lg border border-gray-800 space-y-2">
                <div>
                  <span className="text-gray-400 block font-semibold">Current Block SHA-256 Hash:</span>
                  <span className="font-mono text-emerald-400 break-all select-all">
                    {selectedLog.hash}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-800">
                  <span className="text-gray-400 block font-semibold">Previous Block SHA-256 Link:</span>
                  <span className="font-mono text-indigo-400 break-all select-all">
                    {selectedLog.previousHash}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-gray-300">
                <div className="bg-gray-800 p-2.5 rounded-lg border border-gray-700">
                  <span className="text-gray-500 block">Action</span>
                  <span className="font-semibold text-white">{selectedLog.action}</span>
                </div>
                <div className="bg-gray-800 p-2.5 rounded-lg border border-gray-700">
                  <span className="text-gray-500 block">Actor</span>
                  <span className="font-semibold text-white">
                    {selectedLog.user?.username || 'System Kernel'}
                  </span>
                </div>
                <div className="bg-gray-800 p-2.5 rounded-lg border border-gray-700">
                  <span className="text-gray-500 block">Timestamp</span>
                  <span className="font-mono">{new Date(selectedLog.timestamp).toISOString()}</span>
                </div>
                <div className="bg-gray-800 p-2.5 rounded-lg border border-gray-700">
                  <span className="text-gray-500 block">IP / Origin</span>
                  <span className="font-mono">{selectedLog.ipAddress || 'Internal'}</span>
                </div>
              </div>

              {selectedLog.details && (
                <div>
                  <span className="text-gray-400 font-semibold block mb-1">Structured Event Details:</span>
                  <pre className="bg-gray-900 border border-gray-800 p-3 rounded-lg text-gray-300 text-[11px] overflow-x-auto max-h-36">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.details), null, 2);
                      } catch {
                        return selectedLog.details;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-5">
              <button onClick={() => setSelectedLog(null)} className="btn-secondary w-full text-xs">
                Close Block Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
