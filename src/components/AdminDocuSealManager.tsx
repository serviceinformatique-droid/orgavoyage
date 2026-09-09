import React, { useState } from 'react';
import { Voyage, Inscription } from '../types.js';
import {
  Plus,
  Zap,
  RefreshCw,
  Server,
  Key,
  Globe,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  ExternalLink,
  ShieldCheck,
  X,
  Webhook,
  Copy,
  Check,
  AlertTriangle,
  Code2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Mail
} from 'lucide-react';
import { MassRelanceModal } from './MassRelanceModal.js';

interface AdminDocuSealManagerProps {
  voyages: Voyage[];
  adminToken: string;
  onRefreshVoyages: () => void;
  onSelectVoyageForTeacherView: (voyageId: string) => void;
}

export const AdminDocuSealManager: React.FC<AdminDocuSealManagerProps> = ({
  voyages,
  adminToken,
  onRefreshVoyages,
  onSelectVoyageForTeacherView,
}) => {
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVoyage, setEditingVoyage] = useState<Voyage | null>(null);
  const [activeWebhookVoyage, setActiveWebhookVoyage] = useState<Voyage | null>(null);
  const [voyageToDelete, setVoyageToDelete] = useState<Voyage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Admin password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);

  // Testing & sync states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [formNom, setFormNom] = useState('');
  const [formDestination, setFormDestination] = useState('');
  const [formDateDepart, setFormDateDepart] = useState('2027-04-12');
  const [formDateRetour, setFormDateRetour] = useState('2027-04-16');
  const [formEtablissement, setFormEtablissement] = useState("L'établissement scolaire Notre Dame des Missions");
  const [formClasses, setFormClasses] = useState('5A, 5B, 5C');
  const [formDocusealName, setFormDocusealName] = useState('');
  const [formDocusealUrl, setFormDocusealUrl] = useState('');
  const [formDocusealApiKey, setFormDocusealApiKey] = useState('');
  const [formDocusealTemplateId, setFormDocusealTemplateId] = useState('');
  const [formMotDePasse, setFormMotDePasse] = useState('');
  const [showPasswordInForm, setShowPasswordInForm] = useState(false);
  const [showPasswordsInList, setShowPasswordsInList] = useState<Record<string, boolean>>({});
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);
  const [formStatut, setFormStatut] = useState<Voyage['statut']>('inscriptions_ouvertes');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formTestResult, setFormTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [formTesting, setFormTesting] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Template fetcher state
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [docusealTemplates, setDocusealTemplates] = useState<Array<{ id: number | string; name: string; slug?: string }>>([]);

  // Inspect raw DocuSeal data modal
  const [inspectModal, setInspectModal] = useState<{ voyage: Voyage; raw: any; loading: boolean } | null>(null);

  // Mass relance modal state
  const [relanceVoyage, setRelanceVoyage] = useState<{ voyage: Voyage; inscriptions: Inscription[] } | null>(null);
  const [loadingRelanceId, setLoadingRelanceId] = useState<string | null>(null);

  const handleOpenRelance = async (v: Voyage) => {
    setLoadingRelanceId(v.id);
    try {
      const res = await fetch(`/api/voyages/${v.id}/inscriptions`, {
        headers: { 'x-admin-token': adminToken },
      });
      if (res.ok) {
        const data = await res.json();
        setRelanceVoyage({ voyage: v, inscriptions: data });
      } else {
        setActionNotice({ type: 'error', message: 'Impossible de charger les dossiers pour ce voyage.' });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Erreur de communication lors du chargement des dossiers.' });
    } finally {
      setLoadingRelanceId(null);
    }
  };

  // Reset / Purge entire database
  const handleResetDatabase = async () => {
    const confirm = window.confirm(
      "ATTENTION : Voulez-vous effacer complètement tous les voyages et élèves de la base de données ?\n\nCette action supprimera toutes les données d'exemple et réinitialisera le système pour la production."
    );
    if (!confirm) return;

    try {
      const res = await fetch('/api/admin/reset-database', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice({ type: 'success', message: '✓ Base de données réinitialisée à 0.' });
        onRefreshVoyages();
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Erreur lors de la réinitialisation' });
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Erreur réseau lors de la réinitialisation' });
    }
  };

  // Helper to clean DocuSeal URL and auto-extract Template ID if pasted from browser
  const handleDocusealUrlChange = (raw: string) => {
    let val = raw.trim();
    // Auto-detect template ID in URL (e.g., /templates/1 or /templates/42)
    const tplMatch = val.match(/\/templates\/([a-zA-Z0-9_-]+)/i);
    if (tplMatch && tplMatch[1]) {
      setFormDocusealTemplateId(tplMatch[1]);
      val = val.replace(/\/templates(\/.*)?$/i, '');
    }
    val = val.replace(/\/(submissions|s|documents|api)(\/.*)?$/i, '');
    val = val.replace(/\/+$/, '');
    setFormDocusealUrl(val);
    return val;
  };

  // Fetch templates from DocuSeal instance
  const handleLoadDocusealTemplates = async () => {
    // Clean URL and extract template ID if present in the field
    const cleanedUrl = handleDocusealUrlChange(formDocusealUrl);

    if (!cleanedUrl) {
      alert("Veuillez d'abord renseigner l'URL de votre instance DocuSeal.");
      return;
    }
    if (!formDocusealApiKey && !editingVoyage) {
      alert("Veuillez renseigner la clé API DocuSeal (située dans DocuSeal > Paramètres > Clés API).");
      return;
    }

    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/docuseal/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({
          url: cleanedUrl,
          apiKey: formDocusealApiKey,
          voyageId: editingVoyage?.id,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.templates)) {
        setDocusealTemplates(data.templates);
        if (data.templates.length === 0) {
          alert("Connecté à DocuSeal avec succès, mais aucun modèle (template) n'a été trouvé sur cette instance.");
        }
      } else {
        alert(data.message || 'Impossible de récupérer les modèles DocuSeal.');
      }
    } catch (err: any) {
      alert(`Erreur réseau : ${err.message || 'Serveur inaccessible'}`);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Inspect raw submissions from DocuSeal
  const handleInspectRaw = async (v: Voyage) => {
    setInspectModal({ voyage: v, raw: null, loading: true });
    try {
      const res = await fetch(`/api/docuseal/raw-submissions/${v.id}`, {
        headers: { 'x-admin-token': adminToken },
      });
      const data = await res.json();
      setInspectModal({ voyage: v, raw: data, loading: false });
    } catch (err: any) {
      setInspectModal({ voyage: v, raw: { error: err.message }, loading: false });
    }
  };

  // Open add modal
  const openAddModal = () => {
    setEditingVoyage(null);
    setFormNom('');
    setFormDestination('');
    setFormDateDepart(new Date().toISOString().split('T')[0]);
    setFormDateRetour(new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]);
    setFormEtablissement("L'établissement scolaire Notre Dame des Missions");
    setFormClasses('');
    setFormDocusealName(`Instance DocuSeal #${voyages.length + 1}`);
    setFormDocusealUrl('');
    setFormDocusealApiKey('');
    setFormDocusealTemplateId('');
    setFormMotDePasse('');
    setShowPasswordInForm(false);
    setFormStatut('inscriptions_ouvertes');
    setFormTestResult(null);
    setShowAddModal(true);
  };

  // Open edit modal
  const openEditModal = (v: Voyage) => {
    setEditingVoyage(v);
    setFormNom(v.nom);
    setFormDestination(v.destination);
    setFormDateDepart(v.date_depart);
    setFormDateRetour(v.date_retour);
    setFormEtablissement(v.etablissement);
    setFormClasses(v.classes_concernees.join(', '));
    setFormDocusealName(v.docuseal_instance_name);
    setFormDocusealUrl(v.docuseal_url);
    setFormDocusealApiKey(''); // Kept empty unless user wants to replace
    setFormDocusealTemplateId(v.docuseal_template_id);
    setFormMotDePasse(v.mot_de_passe || '');
    setShowPasswordInForm(false);
    setFormStatut(v.statut);
    setFormTestResult(null);
    setShowAddModal(true);
  };

  // Test single connection
  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/voyages/${id}/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice({ type: 'success', message: `✓ ${data.message}` });
      } else {
        setActionNotice({ type: 'error', message: `⚠ ${data.message}` });
      }
      onRefreshVoyages();
    } catch {
      setActionNotice({ type: 'error', message: 'Erreur réseau lors du test' });
    } finally {
      setTestingId(null);
    }
  };

  // Test all connections
  const handleTestAll = async () => {
    setTestingAll(true);
    setActionNotice(null);
    try {
      const res = await fetch('/api/voyages/test-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice({ type: 'success', message: `✓ Les ${voyages.length} instances DocuSeal ont été testées.` });
        onRefreshVoyages();
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Erreur réseau lors du test général' });
    } finally {
      setTestingAll(false);
    }
  };

  // Sync all trips
  const handleSyncAll = async () => {
    setSyncingAll(true);
    setActionNotice(null);
    try {
      const res = await fetch('/api/voyages/sync-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice({ type: 'success', message: `✓ ${data.message}` });
        onRefreshVoyages();
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Erreur lors de la synchronisation globale' });
    } finally {
      setSyncingAll(false);
    }
  };

  // Confirm and execute delete voyage (No window.confirm, handles both DELETE and POST)
  const handleConfirmDeleteVoyage = async () => {
    if (!voyageToDelete) return;
    setIsDeleting(true);
    const nom = voyageToDelete.nom;
    const id = voyageToDelete.id;

    try {
      // First attempt DELETE
      let res = await fetch(`/api/voyages/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
      });

      // If DELETE not allowed by proxy or returns error, fallback to POST /api/voyages/:id/delete
      if (!res.ok && res.status !== 404) {
        res = await fetch(`/api/voyages/${id}/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken,
          },
        });
      }

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.success || res.status === 200)) {
        setActionNotice({ type: 'success', message: `✓ Le voyage "${nom}" a été supprimé avec succès.` });
        setVoyageToDelete(null);
        if (editingVoyage?.id === id) {
          setShowAddModal(false);
          setEditingVoyage(null);
        }
        onRefreshVoyages();
      } else {
        setActionNotice({ type: 'error', message: data.error || data.message || 'Erreur lors de la suppression du voyage.' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: `Erreur réseau : ${err.message || 'Impossible de joindre le serveur'}` });
    } finally {
      setIsDeleting(false);
    }
  };

  // Change Admin Password handler
  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordModalError(null);

    if (newAdminPassword.length < 4) {
      setPasswordModalError('Le nouveau mot de passe doit contenir au moins 4 caractères.');
      return;
    }

    if (newAdminPassword !== confirmAdminPassword) {
      setPasswordModalError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-admin-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({
          currentPassword: currentAdminPassword,
          newPassword: newAdminPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionNotice({ type: 'success', message: '✓ Mot de passe administrateur modifié avec succès.' });
        setShowPasswordModal(false);
        setCurrentAdminPassword('');
        setNewAdminPassword('');
        setConfirmAdminPassword('');
      } else {
        setPasswordModalError(data.message || 'Erreur lors du changement de mot de passe.');
      }
    } catch {
      setPasswordModalError('Erreur réseau lors de la communication avec le serveur.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Test connection within form before saving (real API call)
  const handleTestFormConnection = async () => {
    const cleanedUrl = handleDocusealUrlChange(formDocusealUrl);
    if (!cleanedUrl || !formDocusealTemplateId) {
      alert('Veuillez renseigner l’URL DocuSeal et le Template ID.');
      return;
    }
    setFormTesting(true);
    setFormTestResult(null);

    try {
      const res = await fetch('/api/docuseal/test-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({
          url: cleanedUrl,
          apiKey: formDocusealApiKey,
          templateId: formDocusealTemplateId,
          voyageId: editingVoyage?.id,
        }),
      });

      const data = await res.json();
      setFormTestResult({
        success: data.success,
        message: data.message || (data.success ? 'Connexion réussie' : 'Échec de connexion'),
      });
    } catch (err: any) {
      setFormTestResult({
        success: false,
        message: `Erreur réseau : ${err.message || 'Impossible de joindre le serveur'}`,
      });
    } finally {
      setFormTesting(false);
    }
  };

  // Save new or edited voyage
  const handleSaveVoyage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);

    const cleanedUrl = handleDocusealUrlChange(formDocusealUrl);

    const classesArray = formClasses
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const payload = {
      nom: formNom,
      destination: formDestination,
      date_depart: formDateDepart,
      date_retour: formDateRetour,
      etablissement: formEtablissement,
      classes_concernees: classesArray,
      docuseal_instance_name: formDocusealName,
      docuseal_url: cleanedUrl,
      docuseal_api_key: formDocusealApiKey,
      docuseal_template_id: formDocusealTemplateId,
      mot_de_passe: formMotDePasse.trim(),
      statut: formStatut,
    };

    try {
      let res: Response;
      if (editingVoyage) {
        res = await fetch(`/api/voyages/${editingVoyage.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken,
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/voyages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken,
          },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setShowAddModal(false);
        setActionNotice({
          type: 'success',
          message: editingVoyage
            ? `Site DocuSeal "${formNom}" mis à jour.`
            : `Nouveau site DocuSeal "${formNom}" enregistré avec succès !`,
        });
        onRefreshVoyages();
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur lors de l’enregistrement');
      }
    } catch {
      alert('Erreur réseau');
    } finally {
      setFormSubmitting(false);
    }
  };

  const totalConnected = voyages.filter((v) => v.connection_status === 'connected').length;
  const totalErrors = voyages.filter((v) => v.connection_status === 'error').length;
  const totalInscritsAll = voyages.reduce((acc, v) => acc + v.total_inscrits, 0);
  const totalCompletsAll = voyages.reduce((acc, v) => acc + v.total_complets, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Admin Header & Summary */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Console d’Administration — Gestion Multi-DocuSeal</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gestion des {voyages.length} Sites & Instances DocuSeal
            </h2>
            <p className="text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              Supervisez, configurez et ajoutez de nouveaux voyages scolaires. Chaque voyage possède son URL propre, sa clé API (stockée côté serveur) et son modèle DocuSeal à deux signatures.
            </p>
          </div>

          {/* Quick Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-admin-add-site"
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un site DocuSeal</span>
            </button>

            <button
              id="btn-admin-change-pwd"
              type="button"
              onClick={() => {
                setPasswordModalError(null);
                setCurrentAdminPassword('');
                setNewAdminPassword('');
                setConfirmAdminPassword('');
                setShowPasswordModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all"
              title="Changer le mot de passe du portail Admin"
            >
              <Key className="w-4 h-4 text-indigo-400" />
              <span>Mot de passe Admin</span>
            </button>

            {voyages.length > 0 && (
              <>
                <button
                  id="btn-admin-test-all"
                  onClick={handleTestAll}
                  disabled={testingAll}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-extrabold border border-slate-700 shadow-sm transition-all disabled:opacity-50"
                >
                  <Zap className={`w-4 h-4 text-amber-400 ${testingAll ? 'animate-bounce' : ''}`} />
                  <span>{testingAll ? 'Test en cours...' : `Tester les connexions (${voyages.length})`}</span>
                </button>

                <button
                  id="btn-admin-sync-all"
                  onClick={handleSyncAll}
                  disabled={syncingAll}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
                  <span>{syncingAll ? 'Synchronisation...' : 'Synchroniser tous'}</span>
                </button>

                <button
                  id="btn-admin-reset-db"
                  onClick={handleResetDatabase}
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800/80 hover:bg-rose-950/80 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-800 rounded-xl text-xs font-bold transition-all"
                  title="Vider la base de données et effacer les élèves d'exemple"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Purger la base</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Global Multi-instance metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div>
            <div className="text-xs text-slate-400 uppercase font-bold">Instances Actives</div>
            <div className="text-2xl font-black text-white mt-0.5">{voyages.length} sites</div>
            <div className="text-[11px] text-slate-400">1 instance par voyage</div>
          </div>

          <div>
            <div className="text-xs text-slate-400 uppercase font-bold">État Connexions</div>
            <div className="text-2xl font-black text-emerald-400 mt-0.5 flex items-center gap-2">
              <span>{totalConnected} 🟢</span>
              {totalErrors > 0 && <span className="text-rose-400 text-lg">({totalErrors} 🔴)</span>}
            </div>
            <div className="text-[11px] text-slate-400">
              {totalConnected}/{voyages.length} en ligne avec succès
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400 uppercase font-bold">Élèves Enregistrés</div>
            <div className="text-2xl font-black text-white mt-0.5">{totalInscritsAll}</div>
            <div className="text-[11px] text-slate-400">Total global de L'établissement scolaire Notre Dame des Missions</div>
          </div>

          <div>
            <div className="text-xs text-slate-400 uppercase font-bold">Dossiers Complets (2/2)</div>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">
              {totalCompletsAll}{' '}
              <span className="text-xs font-semibold text-slate-400">
                ({totalInscritsAll > 0 ? Math.round((totalCompletsAll / totalInscritsAll) * 100) : 0}%)
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Parents 1 et 2 validés</div>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold animate-in fade-in ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grid of DocuSeal Instances or Empty State */}
      {voyages.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
            <Plus className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Aucun voyage configuré</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            La base de démonstration a été effacée. Ajoutez votre premier voyage scolaire avec l'URL de votre instance DocuSeal et votre clé API pour commencer.
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter votre premier voyage</span>
          </button>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {voyages.map((v) => {
          const isTesting = testingId === v.id;

          return (
            <div
              key={v.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
            >
              <div>
                {/* Trip & Status Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {v.docuseal_instance_name}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base mt-1.5 leading-snug">
                      {v.nom}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {v.destination} • {v.classes_concernees.join(', ')}
                    </p>
                  </div>

                  <div>
                    {v.connection_status === 'connected' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        🟢 Connecté
                      </span>
                    )}
                    {v.connection_status === 'error' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        🔴 Erreur
                      </span>
                    )}
                    {v.connection_status === 'untested' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                        Non testé
                      </span>
                    )}
                  </div>
                </div>

                {/* Configuration details (conforming to section 4) */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 text-xs font-mono mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-sans">URL DocuSeal :</span>
                    <a
                      href={v.docuseal_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline truncate max-w-[170px] flex items-center gap-1 font-semibold"
                    >
                      <span>{v.docuseal_url.replace('https://', '')}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-sans">Clé API (Serveur) :</span>
                    <span className="text-slate-700 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {v.docuseal_api_key_masked || '••••••••'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-sans">Template ID :</span>
                    <span className="text-slate-800 font-bold">{v.docuseal_template_id}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-sans">Accès Enseignants :</span>
                    {v.mot_de_passe ? (
                      <div className="flex items-center gap-1.5 bg-indigo-50/90 px-2 py-0.5 rounded-lg border border-indigo-100">
                        <Lock className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span className="font-mono text-xs font-bold text-indigo-950">
                          {showPasswordsInList[v.id] ? v.mot_de_passe : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswordsInList((prev) => ({
                              ...prev,
                              [v.id]: !prev[v.id],
                            }))
                          }
                          className="text-indigo-500 hover:text-indigo-800"
                          title={showPasswordsInList[v.id] ? 'Masquer' : 'Afficher'}
                        >
                          {showPasswordsInList[v.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(v.mot_de_passe || '');
                            setCopiedPasswordId(v.id);
                            setTimeout(() => setCopiedPasswordId(null), 2000);
                          }}
                          className="text-indigo-500 hover:text-indigo-800"
                          title="Copier le mot de passe pour les enseignants"
                        >
                          {copiedPasswordId === v.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-sans flex items-center gap-1">
                        <Unlock className="w-3 h-3 text-slate-400" /> Accès libre
                      </span>
                    )}
                  </div>

                  {v.last_test_message && (
                    <div className="pt-1.5 border-t border-slate-200/60 text-[10px] text-slate-500 truncate font-sans">
                      {v.last_test_message}
                    </div>
                  )}
                </div>

                {/* Progress bar and small metrics */}
                <div className="space-y-1 mb-4">
                  <div className="flex justify-between text-xs text-slate-600 font-semibold">
                    <span>Inscriptions : {v.total_inscrits} élèves</span>
                    <span className="text-emerald-700">{v.total_complets} complets (2/2)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: v.total_inscrits > 0 ? `${(v.total_complets / v.total_inscrits) * 100}%` : '0%',
                      }}
                      title="Complets"
                    ></div>
                    <div
                      className="bg-amber-400 h-full"
                      style={{
                        width: v.total_inscrits > 0 ? `${(v.total_a_finaliser / v.total_inscrits) * 100}%` : '0%',
                      }}
                      title="1 signature sur 2"
                    ></div>
                    <div
                      className="bg-rose-400 h-full"
                      style={{
                        width: v.total_inscrits > 0 ? `${(v.total_non_signes / v.total_inscrits) * 100}%` : '0%',
                      }}
                      title="0 signature"
                    ></div>
                  </div>
                </div>
              </div>

              {/* Bottom Card Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTestConnection(v.id)}
                    disabled={isTesting}
                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-colors"
                    title="Tester la connexion API DocuSeal"
                  >
                    <Zap className={`w-4 h-4 ${isTesting ? 'animate-bounce text-indigo-600' : ''}`} />
                  </button>

                  <button
                    onClick={() => setActiveWebhookVoyage(v)}
                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-colors"
                    title="Configurer le Webhook DocuSeal"
                  >
                    <Webhook className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => openEditModal(v)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors"
                    title="Modifier la configuration"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleInspectRaw(v)}
                    className="p-2 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg text-xs font-bold transition-colors"
                    title="Inspecter les données brutes DocuSeal (Debug)"
                  >
                    <Code2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleOpenRelance(v)}
                    disabled={loadingRelanceId === v.id}
                    className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg text-xs font-bold transition-colors"
                    title="Relance en masse des parents pour ce voyage"
                  >
                    <Mail className={`w-4 h-4 ${loadingRelanceId === v.id ? 'animate-bounce' : ''}`} />
                  </button>

                  <button
                    onClick={() => setVoyageToDelete(v)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors"
                    title="Supprimer ce voyage"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => onSelectVoyageForTeacherView(v.id)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  Voir élèves →
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Add / Edit DocuSeal Site Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-6 relative">
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {editingVoyage ? 'Modification Site DocuSeal' : 'Nouveau Site DocuSeal'}
                </span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight">
                {editingVoyage ? `Paramètres : ${editingVoyage.nom}` : 'Ajouter un Site DocuSeal & Voyage'}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Renseignez les coordonnées de l’instance DocuSeal, la clé API serveur et le template associé.
              </p>
            </div>

            <form onSubmit={handleSaveVoyage} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Section 1: Informations Générales du Voyage */}
              <div className="border-b border-slate-200 pb-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  1. Informations Générales du Voyage
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nom du voyage <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formNom}
                      onChange={(e) => setFormNom(e.target.value)}
                      placeholder="Ex: Voyage à Londres — 5e — Avril 2027"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Destination <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formDestination}
                      onChange={(e) => setFormDestination(e.target.value)}
                      placeholder="Ex: Londres, Royaume-Uni"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Classes / Niveaux concernés
                    </label>
                    <input
                      type="text"
                      value={formClasses}
                      onChange={(e) => setFormClasses(e.target.value)}
                      placeholder="Ex: 5A, 5B, 5C"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Établissement scolaire
                    </label>
                    <input
                      type="text"
                      value={formEtablissement}
                      onChange={(e) => setFormEtablissement(e.target.value)}
                      placeholder="L'établissement scolaire Notre Dame des Missions"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Date de départ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formDateDepart}
                      onChange={(e) => setFormDateDepart(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Date de retour <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formDateRetour}
                      onChange={(e) => setFormDateRetour(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Connexion DocuSeal (URL, Clé API, Template) */}
              <div className="border-b border-slate-200 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    2. Configuration Instance DocuSeal & Clé API
                  </h4>
                  <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Stocké sécurisé côté serveur (X-Auth-Token)
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nom / Libellé de l’instance DocuSeal
                    </label>
                    <input
                      type="text"
                      value={formDocusealName}
                      onChange={(e) => setFormDocusealName(e.target.value)}
                      placeholder="Ex: DocuSeal Instance 01"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      URL de l’instance DocuSeal <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Globe className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={formDocusealUrl}
                        onChange={(e) => {
                          setFormDocusealUrl(e.target.value);
                          // Clean live if it contains /templates/
                          if (e.target.value.includes('/templates/')) {
                            handleDocusealUrlChange(e.target.value);
                          }
                        }}
                        onBlur={() => handleDocusealUrlChange(formDocusealUrl)}
                        placeholder="https://londres.docuseal.ndmissions.fr"
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Indiquez l'URL racine de votre DocuSeal (ex: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-mono">https://londres.docuseal.ndmissions.fr</code>). Si vous collez l'URL complète contenant <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">/templates/1</code>, elle sera automatiquement nettoyée et le Template ID extrait.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Clé API DocuSeal <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                          className="text-[10px] text-indigo-600 hover:underline"
                        >
                          {showApiKeyInput ? 'Masquer' : 'Afficher'}
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Key className="w-4 h-4" />
                        </div>
                        <input
                          type={showApiKeyInput ? 'text' : 'password'}
                          value={formDocusealApiKey}
                          onChange={(e) => setFormDocusealApiKey(e.target.value)}
                          placeholder={editingVoyage ? 'Laisser vide pour conserver' : 'Ex: ds_sec_live_9948...'}
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required={!editingVoyage}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Template ID DocuSeal <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleLoadDocusealTemplates}
                          disabled={loadingTemplates || !formDocusealUrl}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline disabled:opacity-40"
                        >
                          {loadingTemplates ? 'Recherche...' : 'Charger mes modèles DocuSeal'}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={formDocusealTemplateId}
                        onChange={(e) => setFormDocusealTemplateId(e.target.value)}
                        placeholder="Ex: 81042"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />

                      {docusealTemplates.length > 0 && (
                        <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-xl">
                          <div className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                            Modèles trouvés sur votre DocuSeal :
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {docusealTemplates.map((tpl) => (
                              <button
                                key={tpl.id}
                                type="button"
                                onClick={() => setFormDocusealTemplateId(String(tpl.id))}
                                className={`w-full text-left px-2 py-1 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                  String(tpl.id) === formDocusealTemplateId
                                    ? 'bg-indigo-600 text-white font-bold'
                                    : 'hover:bg-indigo-100 text-slate-700'
                                }`}
                              >
                                <span className="truncate">{tpl.name}</span>
                                <span className="font-mono text-[10px] ml-2 shrink-0">ID: {tpl.id}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline Connection Test */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleTestFormConnection}
                        disabled={formTesting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors"
                      >
                        <Zap className={`w-3.5 h-3.5 text-amber-500 ${formTesting ? 'animate-bounce' : ''}`} />
                        <span>{formTesting ? 'Test en cours...' : 'Tester la connexion maintenant'}</span>
                      </button>

                      <span className="text-[11px] text-slate-500">
                        Vérifie la validité de l’URL et du template
                      </span>
                    </div>

                    {formTestResult && (
                      <div
                        className={`mt-2.5 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                          formTestResult.success
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-rose-50 border-rose-200 text-rose-900'
                        }`}
                      >
                        {formTestResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{formTestResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Teacher Security / Password Section */}
              <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Accès Enseignants & Mot de passe
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const generated = Math.random().toString(36).substring(2, 8).toUpperCase();
                      setFormMotDePasse(generated);
                      setShowPasswordInForm(true);
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline font-semibold"
                  >
                    Générer un code aléatoire
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mot de passe pour ce voyage (Optionnel)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPasswordInForm ? 'text' : 'password'}
                      value={formMotDePasse}
                      onChange={(e) => setFormMotDePasse(e.target.value)}
                      placeholder="Laisser vide pour un accès libre sans mot de passe"
                      className="w-full pl-9 pr-10 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordInForm(!showPasswordInForm)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPasswordInForm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Chaque voyage peut avoir son propre mot de passe distinct. Les professeurs devront entrer ce code pour consulter les élèves et télécharger les exports Excel de ce voyage.
                  </p>
                </div>
              </div>

              {/* Submit Buttons & Delete Option */}
              <div className="pt-2 flex items-center justify-between gap-3">
                {editingVoyage ? (
                  <button
                    type="button"
                    onClick={() => setVoyageToDelete(editingVoyage)}
                    className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer ce voyage</span>
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
                  >
                    {formSubmitting ? 'Enregistrement...' : editingVoyage ? 'Mettre à jour le site' : 'Enregistrer le site DocuSeal'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Webhook Configuration Modal */}
      {activeWebhookVoyage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-6 relative">
              <button
                onClick={() => setActiveWebhookVoyage(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center mb-3">
                <Webhook className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight">Configuration Webhook DocuSeal</h3>
              <p className="text-xs text-slate-300 mt-1">
                Permet de recevoir les signatures des parents en temps réel sans attendre la synchronisation périodique.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  URL Webhook à copier dans votre DocuSeal
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/api/webhooks/docuseal/${activeWebhookVoyage.id}`}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/docuseal/${activeWebhookVoyage.id}`);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }}
                    className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors shrink-0"
                    title="Copier l'URL Webhook"
                  >
                    {copiedWebhook ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
                <div className="font-bold text-slate-900">Événements DocuSeal recommandés :</div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 font-mono text-[11px]">
                  <li>submission.created</li>
                  <li>submission.completed</li>
                  <li>form.completed</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setActiveWebhookVoyage(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Raw DocuSeal Submissions Modal */}
      {inspectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-indigo-600" />
                  <span>Données réelles DocuSeal pour : {inspectModal.voyage.nom}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vérification directe de ce que renvoie l'API DocuSeal pour le modèle #{inspectModal.voyage.docuseal_template_id}
                </p>
              </div>
              <button
                onClick={() => setInspectModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto flex-1 font-mono text-xs">
              {inspectModal.loading ? (
                <div className="py-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                  Interrogation de l'instance DocuSeal en cours...
                </div>
              ) : inspectModal.raw?.error ? (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl">
                  <strong>Erreur :</strong> {inspectModal.raw.error}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                    <span>Statut HTTP : <strong>{inspectModal.raw?.httpStatus}</strong></span>
                    <span>URL : {inspectModal.raw?.url}</span>
                  </div>
                  <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] leading-relaxed max-h-[50vh]">
                    {JSON.stringify(inspectModal.raw?.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setInspectModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Voyage Deletion (Bypasses iframe window.confirm restrictions) */}
      {voyageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900 text-center">
              Supprimer ce voyage ?
            </h3>

            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
              <div className="text-sm font-bold text-slate-900">{voyageToDelete.nom}</div>
              <div className="text-xs text-slate-500 mt-1">
                Destination : <strong>{voyageToDelete.destination}</strong> • {voyageToDelete.total_inscrits} élève(s)
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                {voyageToDelete.docuseal_url}
              </div>
            </div>

            <p className="text-xs text-slate-500 text-center mt-3 leading-relaxed">
              Cette action retirera ce voyage et le suivi de ses inscriptions de ce portail. 
              Vos modèles et formulaires sur votre serveur DocuSeal distant ne seront pas supprimés.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setVoyageToDelete(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteVoyage}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Suppression en cours...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Oui, supprimer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Change Admin Password */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Mot de passe Administrateur
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modifier le code d'accès au panneau de contrôle
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangeAdminPassword} className="mt-4 space-y-4">
              {passwordModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{passwordModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mot de passe actuel (optionnel)
                </label>
                <input
                  type="password"
                  value={currentAdminPassword}
                  onChange={(e) => setCurrentAdminPassword(e.target.value)}
                  placeholder="Saisissez l'ancien mot de passe..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nouveau mot de passe *
                </label>
                <input
                  type="password"
                  required
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Au moins 4 caractères..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmer le nouveau mot de passe *
                </label>
                <input
                  type="password"
                  required
                  value={confirmAdminPassword}
                  onChange={(e) => setConfirmAdminPassword(e.target.value)}
                  placeholder="Répétez le nouveau mot de passe..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {changingPassword ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Mettre à jour le mot de passe</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mass Relance Modal */}
      {relanceVoyage && (
        <MassRelanceModal
          isOpen={!!relanceVoyage}
          voyage={relanceVoyage.voyage}
          inscriptions={relanceVoyage.inscriptions}
          classesList={Array.from(new Set(relanceVoyage.inscriptions.map((i) => i.classe).filter(Boolean))).sort()}
          onClose={() => setRelanceVoyage(null)}
          onSuccess={() => {
            onRefreshVoyages();
          }}
        />
      )}
    </div>
  );
};
