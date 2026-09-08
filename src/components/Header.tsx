import React from 'react';
import { Compass, Shield, Users, FileText, Lock, LogOut } from 'lucide-react';

interface HeaderProps {
  currentTab: 'teacher' | 'admin' | 'logs';
  onTabChange: (tab: 'teacher' | 'admin' | 'logs') => void;
  isAdmin: boolean;
  onAdminLoginClick: () => void;
  onLogoutAdmin: () => void;
  totalTripsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  isAdmin,
  onAdminLoginClick,
  onLogoutAdmin,
  totalTripsCount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Establishment identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/10">
              <Compass className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Notre-Dame des Missions
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-semibold text-slate-500">
                  {totalTripsCount > 0 ? `${totalTripsCount} instance${totalTripsCount > 1 ? 's' : ''} DocuSeal` : 'Production'}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight mt-0.5">
                Portail de Suivi des Voyages Scolaires
              </h1>
            </div>
          </div>

          {/* Nav navigation buttons */}
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                id="btn-nav-teacher"
                onClick={() => onTabChange('teacher')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentTab === 'teacher'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Espace Professeur</span>
              </button>

              <button
                id="btn-nav-admin"
                onClick={() => {
                  if (isAdmin) {
                    onTabChange('admin');
                  } else {
                    onAdminLoginClick();
                  }
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentTab === 'admin'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isAdmin ? (
                  <Shield className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>Administration ({totalTripsCount} DocuSeal)</span>
              </button>

              <button
                id="btn-nav-logs"
                onClick={() => onTabChange('logs')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentTab === 'logs'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Journal Synchro</span>
              </button>
            </nav>

            {/* Role indicator & Switch action */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Admin Connecté
                  </span>
                  <button
                    onClick={onLogoutAdmin}
                    title="Quitter le mode administrateur"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  id="btn-header-admin-login"
                  onClick={onAdminLoginClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Accès Admin</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile secondary tab bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-100">
          <button
            onClick={() => onTabChange('teacher')}
            className={`text-xs font-bold px-3 py-1 rounded-lg ${currentTab === 'teacher' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}
          >
            Professeur
          </button>
          <button
            onClick={() => {
              if (isAdmin) onTabChange('admin');
              else onAdminLoginClick();
            }}
            className={`text-xs font-bold px-3 py-1 rounded-lg ${currentTab === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}
          >
            Admin DocuSeal
          </button>
          <button
            onClick={() => onTabChange('logs')}
            className={`text-xs font-bold px-3 py-1 rounded-lg ${currentTab === 'logs' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}
          >
            Journal
          </button>
        </div>
      </div>
    </header>
  );
};
