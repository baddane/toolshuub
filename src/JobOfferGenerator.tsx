import React, { useState } from 'react';
import {
  Briefcase,
  Sparkles,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Key,
  Settings,
  Eye,
  EyeOff,
  X,
  ExternalLink,
  AlignLeft,
  Search,
  Hash,
  ListChecks,
  Building2,
  MapPin,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateJobOffer, JobOffer } from './services/jobOfferService';
import {
  PROVIDERS,
  PROVIDER_ACTIVE,
  PROVIDER_ICON_ACTIVE,
  ProviderId,
} from './config/providers';

// ── localStorage helpers ────────────────────────────────────────────────────

const APIKEYS_KEY = 'llm_apikeys';

function loadApiKeys(): Record<ProviderId, string> {
  const defaults: Record<ProviderId, string> = { gemini: '', openai: '', anthropic: '', deepseek: '' };
  try {
    const saved = localStorage.getItem(APIKEYS_KEY);
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  } catch { return defaults; }
}

function saveApiKeys(keys: Record<ProviderId, string>) {
  try { localStorage.setItem(APIKEYS_KEY, JSON.stringify(keys)); } catch {}
}

// ── Settings Modal (shared keys with other tools) ──────────────────────────

interface SettingsModalProps {
  apiKeys: Record<ProviderId, string>;
  onSave: (keys: Record<ProviderId, string>) => void;
  onClose: () => void;
}

function SettingsModal({ apiKeys, onSave, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState<Record<ProviderId, string>>({ ...apiKeys });
  const [visible, setVisible] = useState<Record<ProviderId, boolean>>({
    gemini: false, openai: false, anthropic: false, deepseek: false,
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 flex items-center justify-center z-[70] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-lg bg-[#111] border border-white/10 rounded-3xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-xl">
                <Key className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">Clés API</h2>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">Stockées localement dans votre navigateur</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
              <X className="w-5 h-5 text-white/40" />
            </button>
          </div>
          <div className="space-y-4">
            {PROVIDERS.map((p) => (
              <div key={p.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/50">
                    {p.name} <span className="text-white/20 font-normal normal-case tracking-normal">— {p.tagline}</span>
                  </label>
                  <a href={p.docsUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-white/20 hover:text-white/50 transition-colors flex items-center gap-1">
                    Obtenir une clé <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={visible[p.id] ? 'text' : 'password'}
                    value={draft[p.id]}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder={`Clé API ${p.name}...`}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm font-mono focus:outline-none focus:border-white/30 placeholder:text-white/20 transition-colors"
                  />
                  <button type="button"
                    onClick={() => setVisible((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/20 hover:text-white/60 transition-colors">
                    {visible[p.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all text-sm font-bold">
              Annuler
            </button>
            <button onClick={() => { onSave(draft); onClose(); }}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all text-sm font-black">
              Enregistrer
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── JobOfferGenerator ────────────────────────────────────────────────────────

interface Props {
  onNavigate: (to: string) => void;
}

const MAX_FIELD_LENGTH = 120;

export default function JobOfferGenerator({ onNavigate }: Props) {
  const [poste, setPoste] = useState('');
  const [entreprise, setEntreprise] = useState('');
  const [ville, setVille] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JobOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>(loadApiKeys);

  const currentProvider = PROVIDERS.find((p) => p.id === selectedProvider)!;

  const handleProviderChange = (pid: ProviderId) => {
    setSelectedProvider(pid);
    setSelectedModel(PROVIDERS.find((p) => p.id === pid)!.models[0].id);
  };

  const handleSaveApiKeys = (keys: Record<ProviderId, string>) => {
    setApiKeys(keys);
    saveApiKeys(keys);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poste.trim() || !entreprise.trim() || !ville.trim()) return;

    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await generateJobOffer(
        poste.trim(), entreprise.trim(), ville.trim(),
        selectedModel, selectedProvider, apiKeys[selectedProvider]
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setPoste('');
    setEntreprise('');
    setVille('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <button onClick={() => onNavigate('/')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="bg-red-600 p-2 rounded-xl shadow-lg shadow-red-600/20">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <span className="text-xl font-black tracking-tighter leading-none block">Offre Emploi <span className="text-red-500">AI</span></span>
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
                Powered by {currentProvider.name}
              </span>
            </div>
          </button>
          <nav className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('/')}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all"
            >
              YouTube Meta
            </button>
            <button
              onClick={() => onNavigate('/email')}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all"
            >
              Email AI
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-3 hover:bg-white/5 rounded-xl transition-all relative group"
              title="Clés API"
            >
              <Settings className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
              {Object.values(apiKeys).some(Boolean) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full border-2 border-black" />
              )}
            </button>
          </nav>
        </div>
      </header>

      <AnimatePresence>
        {showSettings && (
          <SettingsModal apiKeys={apiKeys} onSave={handleSaveApiKeys} onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>

      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero */}
        <section className="text-center mb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-xs font-bold uppercase tracking-widest mb-8">
              <Sparkles className="w-3 h-3" />
              Générateur d'offres d'emploi optimisées SEO
            </div>
            <h2 className="text-5xl sm:text-6xl font-black mb-6 tracking-tighter leading-[0.9]">
              RECRUTEZ<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500">PLUS VITE.</span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Indiquez le poste, l'entreprise et la ville — obtenez une offre complète : description, meta SEO, mots-clés et compétences.
            </p>

            {/* Provider selector */}
            <div className="flex justify-center gap-3 mb-6 flex-wrap">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`px-5 py-2.5 rounded-2xl border text-sm font-bold transition-all ${
                    selectedProvider === p.id
                      ? PROVIDER_ACTIVE[p.id] + ' shadow-lg'
                      : 'bg-white/5 border-white/10 hover:border-white/20 text-white/50 hover:text-white'
                  }`}
                >
                  {p.name}
                  <span className={`ml-1.5 text-[10px] font-normal tracking-wide ${selectedProvider === p.id ? 'opacity-60' : 'opacity-30'}`}>
                    {p.tagline}
                  </span>
                </button>
              ))}
            </div>

            {/* Model selector */}
            <div className="flex justify-center gap-4 mb-8 flex-wrap">
              {currentProvider.models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`flex flex-col items-center p-4 rounded-2xl border transition-all min-w-[120px] ${
                    selectedModel === m.id
                      ? PROVIDER_ACTIVE[selectedProvider] + ' shadow-lg'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`p-2 rounded-lg mb-2 ${selectedModel === m.id ? PROVIDER_ICON_ACTIVE[selectedProvider] : 'bg-white/5 text-white/40'}`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className={`text-sm font-bold ${selectedModel === m.id ? 'text-white' : 'text-white/60'}`}>{m.name}</span>
                  <span className="text-[10px] uppercase tracking-widest opacity-30 mt-1">{m.desc}</span>
                </button>
              ))}
            </div>

            {/* API key hint */}
            {!apiKeys[selectedProvider] && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-yellow-500/5 border border-yellow-500/20 rounded-full text-yellow-400/70 text-xs"
              >
                <Key className="w-3 h-3" />
                Aucune clé API {currentProvider.name} configurée —{' '}
                <button onClick={() => setShowSettings(true)} className="underline underline-offset-2 hover:text-yellow-300 transition-colors font-bold">
                  ajouter depuis les paramètres
                </button>
              </motion.div>
            )}
          </motion.div>
        </section>

        {/* Input form */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="glass-card p-6 focus-within:ring-4 focus-within:ring-red-500/10 transition-all">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                    <Briefcase className="w-3 h-3" /> Poste
                  </label>
                  <input
                    type="text"
                    value={poste}
                    onChange={(e) => setPoste(e.target.value.slice(0, MAX_FIELD_LENGTH))}
                    placeholder="Ex : Aide Comptable"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                    <Building2 className="w-3 h-3" /> Entreprise
                  </label>
                  <input
                    type="text"
                    value={entreprise}
                    onChange={(e) => setEntreprise(e.target.value.slice(0, MAX_FIELD_LENGTH))}
                    placeholder="Ex : ABC Consulting"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                    <MapPin className="w-3 h-3" /> Ville
                  </label>
                  <input
                    type="text"
                    value={ville}
                    onChange={(e) => setVille(e.target.value.slice(0, MAX_FIELD_LENGTH))}
                    placeholder="Ex : Agadir"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20 transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end mt-5">
                <button
                  type="submit"
                  disabled={loading || !poste.trim() || !entreprise.trim() || !ville.trim()}
                  className="btn-primary"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Générer l'offre <Sparkles className="w-5 h-5" /></>
                  )}
                </button>
              </div>
            </div>
          </form>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </motion.div>

        {/* Loading state */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-20 text-white/30"
            >
              <Loader2 className="w-10 h-10 animate-spin text-red-500/50" />
              <p className="text-sm font-medium">Rédaction de l'offre d'emploi en cours...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence mode="wait">
          {result && !loading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black uppercase tracking-tight">
                  Offre d'emploi générée
                </h3>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 text-xs text-white/30 hover:text-white transition-colors font-bold uppercase tracking-widest"
                >
                  <RefreshCw className="w-3 h-3" />
                  Recommencer
                </button>
              </div>

              {/* Description */}
              <div className="glass-card p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <AlignLeft className="w-5 h-5 text-red-500" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Description du poste</h3>
                  </div>
                  <button onClick={() => copyToClipboard(result.description, 'desc')} className="btn-secondary text-xs">
                    {copiedField === 'desc' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    Copier
                  </button>
                </div>
                <div className="bg-black/40 rounded-3xl p-8 text-sm leading-relaxed text-white/70 whitespace-pre-wrap border border-white/5">
                  {result.description}
                </div>
              </div>

              {/* Meta description */}
              <div className="glass-card p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Search className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Meta Description SEO</h3>
                  </div>
                  <button onClick={() => copyToClipboard(result.metaDescription, 'meta')} className="btn-secondary text-xs">
                    {copiedField === 'meta' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    Copier
                  </button>
                </div>
                <p className="text-sm text-white/70 bg-blue-500/[0.03] rounded-2xl px-6 py-5 border border-blue-500/10 leading-relaxed">
                  {result.metaDescription}
                </p>
                <p className="mt-2 text-right text-[10px] font-mono text-white/20">
                  {result.metaDescription.length} caractères
                </p>
              </div>

              {/* Keywords */}
              <div className="glass-card p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Hash className="w-5 h-5 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Mots-clés SEO</h3>
                    <span className="text-[10px] text-white/30 font-mono">{result.keywords.length}</span>
                  </div>
                  <button onClick={() => copyToClipboard(result.keywords.join(', '), 'keywords')} className="btn-secondary text-xs">
                    {copiedField === 'keywords' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    Copier tout
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((kw, idx) => (
                    <button
                      key={idx}
                      onClick={() => copyToClipboard(kw, `kw-${idx}`)}
                      className="px-3 py-1.5 bg-blue-500/5 text-blue-300 rounded-xl text-[11px] border border-blue-500/10 hover:bg-blue-500/10 transition-all flex items-center gap-2"
                    >
                      {kw}
                      {copiedField === `kw-${idx}` ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5 opacity-30" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div className="glass-card p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <ListChecks className="w-5 h-5 text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Compétences requises</h3>
                    <span className="text-[10px] text-white/30 font-mono">{result.skills.length}</span>
                  </div>
                  <button onClick={() => copyToClipboard(result.skills.join(', '), 'skills')} className="btn-secondary text-xs">
                    {copiedField === 'skills' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    Copier tout
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-4 py-2 bg-emerald-500/5 text-emerald-400 rounded-full text-[11px] font-bold border border-emerald-500/10"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
