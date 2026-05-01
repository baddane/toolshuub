import React, { useState } from 'react';
import {
  Mail,
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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { improveEmail, EmailVersion } from './services/emailService';
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

// ── Settings Modal (shared with main page, same keys) ──────────────────────

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

// ── Version Card ───────────────────────────────────────────────────────────

const VERSION_COLORS = [
  { border: 'border-blue-500/20',   bg: 'bg-blue-500/[0.03]',   badge: 'bg-blue-500/10 text-blue-400',   icon: 'text-blue-400' },
  { border: 'border-emerald-500/20', bg: 'bg-emerald-500/[0.03]', badge: 'bg-emerald-500/10 text-emerald-400', icon: 'text-emerald-400' },
  { border: 'border-orange-500/20', bg: 'bg-orange-500/[0.03]', badge: 'bg-orange-500/10 text-orange-400', icon: 'text-orange-400' },
];

interface VersionCardProps {
  version: EmailVersion;
  index: number;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}

function VersionCard({ version, index, copiedField, onCopy }: VersionCardProps) {
  const [expanded, setExpanded] = useState(true);
  const colors = VERSION_COLORS[index % VERSION_COLORS.length];
  const fullText = `Objet : ${version.subject}\n\n${version.body}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`glass-card border ${colors.border} overflow-hidden`}
    >
      {/* Card header */}
      <div className={`p-6 ${colors.bg}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${colors.badge}`}>
              <Mail className="w-3 h-3" />
              {version.label}
            </span>
            <p className="text-xs text-white/40 leading-relaxed">{version.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Copy all */}
            <button
              onClick={() => onCopy(fullText, `all-${index}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold text-white/50 hover:text-white transition-all"
            >
              {copiedField === `all-${index}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              Tout copier
            </button>
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-white/20 hover:text-white/60">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-6 space-y-4">
              {/* Subject */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Objet</span>
                  <button
                    onClick={() => onCopy(version.subject, `subj-${index}`)}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-white/20 hover:text-white/60"
                  >
                    {copiedField === `subj-${index}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-sm font-semibold text-white/80 bg-white/[0.03] rounded-xl px-4 py-3 border border-white/5">
                  {version.subject}
                </p>
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Corps</span>
                  <button
                    onClick={() => onCopy(version.body, `body-${index}`)}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-white/20 hover:text-white/60"
                  >
                    {copiedField === `body-${index}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <pre className="text-sm text-white/60 bg-black/30 rounded-xl px-4 py-4 border border-white/5 whitespace-pre-wrap font-sans leading-relaxed">
                  {version.body}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── EmailImprover ──────────────────────────────────────────────────────────

interface Props {
  onNavigate: (to: string) => void;
}

const MAX_DRAFT_LENGTH = 3000;

export default function EmailImprover({ onNavigate }: Props) {
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmailVersion[] | null>(null);
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
    const trimmed = draft.trim();
    if (!trimmed) return;

    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await improveEmail(trimmed, selectedModel, selectedProvider, apiKeys[selectedProvider]);
      setResult(data.versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <button onClick={() => onNavigate('/')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="bg-red-600 p-2 rounded-xl shadow-lg shadow-red-600/20">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <span className="text-xl font-black tracking-tighter leading-none block">Email <span className="text-red-500">AI</span></span>
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
              Correction & Amélioration d'emails par IA
            </div>
            <h2 className="text-5xl sm:text-6xl font-black mb-6 tracking-tighter leading-[0.9]">
              EMAILS<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500">IMPECCABLES.</span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Collez votre brouillon, obtenez instantanément 3 versions corrigées et améliorées prêtes à envoyer.
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
            <div className="glass-card p-1 focus-within:ring-4 focus-within:ring-red-500/10 transition-all">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_DRAFT_LENGTH))}
                placeholder="Collez votre brouillon d'email ici...&#10;&#10;Ex : salut, je voulais te dire que la réunion est reportée à jeudi, dsl du dérangement"
                rows={8}
                className="w-full bg-transparent border-none px-6 py-5 text-sm text-white/80 focus:outline-none placeholder:text-white/20 font-sans leading-relaxed resize-none"
              />
              <div className="flex items-center justify-between px-6 pb-4">
                <span className={`text-[10px] font-mono ${draft.length >= MAX_DRAFT_LENGTH ? 'text-red-400' : 'text-white/20'}`}>
                  {draft.length}/{MAX_DRAFT_LENGTH}
                </span>
                <button
                  type="submit"
                  disabled={loading || !draft.trim()}
                  className="btn-primary"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Améliorer <Sparkles className="w-5 h-5" /></>
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
              <p className="text-sm font-medium">Génération des 3 versions en cours...</p>
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
                  3 Versions améliorées
                </h3>
                <button
                  onClick={() => { setResult(null); setDraft(''); setError(null); }}
                  className="flex items-center gap-2 text-xs text-white/30 hover:text-white transition-colors font-bold uppercase tracking-widest"
                >
                  <RefreshCw className="w-3 h-3" />
                  Recommencer
                </button>
              </div>

              {result.map((version, idx) => (
                <React.Fragment key={idx}>
                  <VersionCard
                    version={version}
                    index={idx}
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                  />
                </React.Fragment>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
