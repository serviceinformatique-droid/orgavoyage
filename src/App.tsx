/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Voyage } from './types.js';
import { Header } from './components/Header.js';
import { TeacherDashboard } from './components/TeacherDashboard.js';
import { AdminDocuSealManager } from './components/AdminDocuSealManager.js';
import { SyncLogsView } from './components/SyncLogsView.js';
import { AdminLoginModal } from './components/AdminLoginModal.js';
import { TripPasswordModal } from './components/TripPasswordModal.js';
import { RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'teacher' | 'admin' | 'logs'>('teacher');
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [selectedVoyageId, setSelectedVoyageId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Admin Auth state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminToken, setAdminToken] = useState<string>('');
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);

  // Per-voyage password state (stores unlocked voyage passwords)
  const [unlockedVoyages, setUnlockedVoyages] = useState<Record<string, string>>(() => {
    try {
      const saved = sessionStorage.getItem('ndm_unlocked_voyages');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [passwordModalVoyage, setPasswordModalVoyage] = useState<Voyage | null>(null);

  // Fetch voyages list from server
  const fetchVoyages = async (token?: string) => {
    try {
      const activeToken = token !== undefined ? token : adminToken;
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['x-admin-token'] = activeToken;
      }

      const res = await fetch('/api/voyages', { headers });
      if (res.ok) {
        const data: Voyage[] = await res.json();
        setVoyages(data);
        if (data.length > 0) {
          if (!selectedVoyageId || !data.some((v) => v.id === selectedVoyageId)) {
            setSelectedVoyageId(data[0].id);
          }
        } else {
          setSelectedVoyageId('');
        }
        setError(null);
      } else {
        setError('Impossible de récupérer la liste des voyages');
      }
    } catch (err: any) {
      setError(`Erreur de connexion au serveur : ${err.message || 'Serveur hors ligne'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if previous session had admin token saved in sessionStorage
    const savedToken = sessionStorage.getItem('ndm_admin_token');
    if (savedToken) {
      setIsAdmin(true);
      setAdminToken(savedToken);
      fetchVoyages(savedToken);
    } else {
      fetchVoyages();
    }
  }, []);

  const handleAdminLoginSuccess = (token: string) => {
    setIsAdmin(true);
    setAdminToken(token);
    sessionStorage.setItem('ndm_admin_token', token);
    setCurrentTab('admin');
    fetchVoyages(token);
  };

  const handleLogoutAdmin = () => {
    setIsAdmin(false);
    setAdminToken('');
    sessionStorage.removeItem('ndm_admin_token');
    setCurrentTab('teacher');
    fetchVoyages('');
  };

  const handleSelectVoyage = (voyageId: string) => {
    setSelectedVoyageId(voyageId);
    const target = voyages.find((v) => v.id === voyageId);
    if (target?.has_password && !isAdmin && !unlockedVoyages[voyageId]) {
      setPasswordModalVoyage(target);
    }
  };

  const handleVoyageUnlocked = (voyageId: string, password: string) => {
    setUnlockedVoyages((prev) => {
      const updated = { ...prev, [voyageId]: password };
      try {
        sessionStorage.setItem('ndm_unlocked_voyages', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
    setPasswordModalVoyage(null);
  };

  const handleLockVoyage = (voyageId: string) => {
    setUnlockedVoyages((prev) => {
      const updated = { ...prev };
      delete updated[voyageId];
      try {
        sessionStorage.setItem('ndm_unlocked_voyages', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  const handleSelectVoyageForTeacherView = (voyageId: string) => {
    setSelectedVoyageId(voyageId);
    setCurrentTab('teacher');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Header Navigation */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        isAdmin={isAdmin}
        onAdminLoginClick={() => setShowAdminLoginModal(true)}
        onLogoutAdmin={handleLogoutAdmin}
        totalTripsCount={voyages.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
            <p className="text-sm font-semibold">Connexion aux instances DocuSeal...</p>
            <p className="text-xs text-slate-400 mt-1">Chargement des 15 voyages scolaires</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-800 text-center max-w-lg mx-auto my-12">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <h3 className="font-bold text-base">Erreur de chargement</h3>
            <p className="text-xs mt-1 text-red-700">{error}</p>
            <button
              onClick={() => fetchVoyages()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <>
            {currentTab === 'teacher' && (
              <TeacherDashboard
                voyages={voyages}
                selectedVoyageId={selectedVoyageId}
                onSelectVoyage={handleSelectVoyage}
                onRefreshVoyages={() => fetchVoyages()}
                voyagePassword={unlockedVoyages[selectedVoyageId]}
                onRequestUnlock={() => {
                  const curr = voyages.find((v) => v.id === selectedVoyageId);
                  if (curr) setPasswordModalVoyage(curr);
                }}
                onLockVoyage={() => handleLockVoyage(selectedVoyageId)}
                isAdmin={isAdmin}
              />
            )}

            {currentTab === 'admin' && (
              <AdminDocuSealManager
                voyages={voyages}
                adminToken={adminToken}
                onRefreshVoyages={() => fetchVoyages()}
                onSelectVoyageForTeacherView={handleSelectVoyageForTeacherView}
              />
            )}

            {currentTab === 'logs' && <SyncLogsView adminToken={adminToken} />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold uppercase tracking-wider text-slate-700">
              L'établissement scolaire Notre Dame des Missions
            </span>
            <span>•</span>
            <span>Portail Centralisé DocuSeal</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
            <span>Sécurité eIDAS — 2 signatures requises</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600 font-sans font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Clés API isolées serveur
            </span>
          </div>
        </div>
      </footer>

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={showAdminLoginModal}
        onClose={() => setShowAdminLoginModal(false)}
        onSuccess={handleAdminLoginSuccess}
      />

      {/* Per-Trip Password Modal */}
      {passwordModalVoyage && (
        <TripPasswordModal
          voyage={passwordModalVoyage}
          isOpen={Boolean(passwordModalVoyage)}
          onUnlock={(pwd) => handleVoyageUnlocked(passwordModalVoyage.id, pwd)}
          onCancel={() => setPasswordModalVoyage(null)}
        />
      )}
    </div>
  );
}
