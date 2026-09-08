import React, { useState, useEffect } from 'react';
import { SyncLog } from '../types.js';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Search,
  Filter
} from 'lucide-react';

interface SyncLogsViewProps {
  adminToken: string;
}

export const SyncLogsView: React.FC<SyncLogsViewProps> = ({ adminToken }) => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logs/sync', {
        headers: adminToken ? { 'x-admin-token': adminToken } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.voyage_nom.toLowerCase().includes(q) ||
      log.message.toLowerCase().includes(q) ||
      log.timestamp.includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Journal de Synchronisation DocuSeal
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Traçabilité exhaustive des échanges API, webhooks et synchronisations automatiques pour chaque voyage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer les journaux..."
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64"
            />
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Horodatage</th>
                <th className="py-3 px-4">Voyage / Instance</th>
                <th className="py-3 px-3 text-center">Statut</th>
                <th className="py-3 px-3 text-center">Dossiers Inscrits</th>
                <th className="py-3 px-3 text-center">Nouvelles Signatures</th>
                <th className="py-3 px-4">Détails de l'opération</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Chargement des journaux...</span>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    Aucun événement de synchronisation trouvé.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900 font-sans">
                      {log.voyage_nom}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {log.status === 'success' && (
                        <span className="inline-flex items-center gap-1 font-sans text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Succès
                        </span>
                      )}
                      {log.status === 'warning' && (
                        <span className="inline-flex items-center gap-1 font-sans text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Avertissement
                        </span>
                      )}
                      {log.status === 'error' && (
                        <span className="inline-flex items-center gap-1 font-sans text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Erreur
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center text-slate-700">
                      {log.new_inscriptions !== undefined ? `+${log.new_inscriptions}` : log.inscriptions_count !== undefined ? `${log.inscriptions_count}` : '—'}
                    </td>

                    <td className="py-3 px-3 text-center text-emerald-700 font-bold">
                      {log.new_signatures !== undefined ? `+${log.new_signatures}` : '—'}
                    </td>

                    <td className="py-3 px-4 text-slate-600 font-sans text-xs">
                      {log.message}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
