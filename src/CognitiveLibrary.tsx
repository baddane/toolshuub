import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  BookOpen,
  ChevronDown,
  Sparkles,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Target,
  Map,
  FileText,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  X,
  Settings,
  Lightbulb,
  ArrowRight,
  Quote,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COGNITIVE_BOOKS } from './data/cognitiveBooks';
import {
  generateCognitiveAnalysis,
  CognitiveResult,
  CognitiveConcept,
  ActionStep,
} from './services/cognitiveService';
import {
  PROVIDERS,
  PROVIDER_ACTIVE,
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

// ── Inline Markdown renderer ────────────────────────────────────────────────

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function RenderMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <h3 key={i} className="text-sm font-black text-white mt-5 mb-1 first:mt-0">{formatInline(line.slice(3))}</h3>;
        }
        if (line.startsWith('### ')) {
          return <h4 key={i} className="text-xs font-bold text-white/90 mt-3 mb-1">{formatInline(line.slice(4))}</h4>;
        }
        if (line.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-purple-400 mt-[3px] shrink-0 text-[10px]">▸</span>
              <span className="text-xs text-white/60 leading-relaxed">{formatInline(line.slice(2))}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-xs text-white/60 leading-relaxed">{formatInline(line)}</p>;
      })}
    </div>
  );
}

// ── Mermaid Mindmap viewer ──────────────────────────────────────────────────

let mermaidReady = false;

function MindmapViewer({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setLoading(true);
    setRenderError(false);

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!mermaidReady) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'Inter, sans-serif',
          });
          mermaidReady = true;
        }

        const id = `mmd-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, code);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRenderError(false);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setRenderError(true);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [code]);

  if (loading && !renderError) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-amber-400 text-xs p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          La mindmap n'a pas pu être rendue graphiquement. Code source :
        </div>
        <pre className="bg-black/40 p-6 rounded-2xl text-xs text-white/40 overflow-auto border border-white/5 font-mono whitespace-pre leading-relaxed">
          {code}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex justify-center items-center min-h-[280px] [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:rounded-xl"
    />
  );
}

// ── Settings Modal ──────────────────────────────────────────────────────────

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
              <div className="p-2 bg-purple-500/10 rounded-xl">
                <Key className="w-5 h-5 text-purple-400" />
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
                  <a
                    href={p.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-white/20 hover:text-white/50 transition-colors flex items-center gap-1"
                  >
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
                  <button
                    type="button"
                    onClick={() => setVisible((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/20 hover:text-white/60 transition-colors"
                  >
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
            <button
              onClick={() => { onSave(draft); onClose(); }}
              className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all text-sm font-black"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Tab definition ──────────────────────────────────────────────────────────

type Tab = 'concepts' | 'analyse' | 'mindmap' | 'plan';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'concepts', label: 'Concepts Clés', icon: <Lightbulb className="w-4 h-4" /> },
  { id: 'analyse', label: 'Analyse', icon: <FileText className="w-4 h-4" /> },
  { id: 'mindmap', label: 'Mindmap', icon: <Map className="w-4 h-4" /> },
  { id: 'plan', label: "Plan d'Action", icon: <Target className="w-4 h-4" /> },
];

// ── Main component ──────────────────────────────────────────────────────────

interface CognitiveLibraryProps {
  onNavigate: (path: string) => void;
}

export default function CognitiveLibrary({ onNavigate: _onNavigate }: CognitiveLibraryProps) {
  const [selectedBookId, setSelectedBookId] = useState('');
  const [userContext, setUserContext] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>(loadApiKeys);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CognitiveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('concepts');
  const [showSettings, setShowSettings] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const selectedBook = COGNITIVE_BOOKS.find((b) => b.id === selectedBookId);
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || userContext.trim().length < 20) return;
    setError(null);
    setLoading(true);
    try {
      const data = await generateCognitiveAnalysis(
        selectedBook.title,
        selectedBook.author,
        userContext.trim(),
        selectedModel,
        selectedProvider,
        apiKeys[selectedProvider]
      );
      setResult(data);
      setActiveTab('concepts');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue lors de l'analyse.");
    } finally {
      setLoading(false);
    }
  };

  const canGenerate = !!(selectedBook && userContext.trim().length >= 20 && !loading);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <AnimatePresence>
        {showSettings && (
          <SettingsModal apiKeys={apiKeys} onSave={handleSaveApiKeys} onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-bold uppercase tracking-widest mb-8">
          <Brain className="w-3 h-3" />
          Cognitive Library — Lecture Actionnable
        </div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-[0.9] mb-8">
          LIRE, C'EST<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-red-500">DÉCIDER.</span>
        </h1>
        <p className="text-white/50 text-xl max-w-2xl mx-auto leading-relaxed">
          Sélectionnez un livre stratégique, décrivez vos projets réels, et l'IA génère une analyse actionnable personnalisée avec mindmap interactive.
        </p>
      </motion.section>

      {/* Form */}
      <motion.form
        onSubmit={handleGenerate}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-8 mb-12"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Step 1 — Book */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-7 h-7 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-black shrink-0">
                1
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-white/50">Choisir le livre</h3>
            </div>
            <div className="relative">
              <select
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-10 text-sm focus:outline-none focus:border-purple-500/40 appearance-none cursor-pointer transition-colors"
              >
                <option value="" disabled>— Sélectionner un livre —</option>
                {COGNITIVE_BOOKS.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.emoji}  {book.title} — {book.author}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            </div>
            <AnimatePresence>
              {selectedBook && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-4 bg-purple-500/[0.05] border border-purple-500/10 rounded-2xl overflow-hidden"
                >
                  <div className="text-2xl mb-2">{selectedBook.emoji}</div>
                  <p className="text-xs text-white/40 leading-relaxed mb-3">{selectedBook.summary}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-full text-purple-300/50 uppercase tracking-widest border border-purple-500/10">
                      {selectedBook.category}
                    </span>
                    <span className="text-[10px] text-white/20">
                      {selectedBook.year > 0 ? selectedBook.year : `${Math.abs(selectedBook.year)} av. J.-C.`}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Step 2 — Context */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-7 h-7 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-black shrink-0">
                2
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-white/50">Votre contexte</h3>
            </div>
            <textarea
              value={userContext}
              onChange={(e) => setUserContext(e.target.value.slice(0, 800))}
              placeholder="Décrivez vos projets actuels, vos objectifs, vos défis... Plus c'est précis, plus l'analyse sera pertinente et actionnable."
              rows={7}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/40 placeholder:text-white/20 resize-none transition-colors leading-relaxed"
            />
            <div className="flex items-center justify-between mt-1.5">
              {userContext.length > 0 && userContext.length < 20 ? (
                <p className="text-[10px] text-amber-400/70">Minimum 20 caractères</p>
              ) : (
                <span />
              )}
              <span className={`text-[10px] font-mono ml-auto ${userContext.length >= 800 ? 'text-red-400' : 'text-white/20'}`}>
                {userContext.length}/800
              </span>
            </div>
          </div>

          {/* Step 3 — Provider */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-black shrink-0">
                  3
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white/50">Modèle IA</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="p-1.5 hover:bg-white/5 rounded-lg transition-colors relative"
                title="Gérer les clés API"
              >
                <Settings className="w-4 h-4 text-white/30 hover:text-white/60 transition-colors" />
                {Object.values(apiKeys).some(Boolean) && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full" />
                )}
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderChange(p.id)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-left text-sm font-bold transition-all flex items-center justify-between ${
                    selectedProvider === p.id
                      ? PROVIDER_ACTIVE[p.id] + ' shadow-sm'
                      : 'bg-white/5 border-white/10 hover:border-white/20 text-white/50 hover:text-white'
                  }`}
                >
                  <span>{p.name}</span>
                  <span className={`text-[10px] font-normal ${selectedProvider === p.id ? 'opacity-60' : 'opacity-30'}`}>{p.tagline}</span>
                </button>
              ))}
            </div>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-white/30 appearance-none cursor-pointer transition-colors pr-8"
              >
                {currentProvider.models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.desc}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            </div>
            {!apiKeys[selectedProvider] && (
              <p className="mt-3 text-[10px] text-amber-400/70 flex items-center gap-1.5">
                <Key className="w-3 h-3 shrink-0" />
                Aucune clé {currentProvider.name} —{' '}
                <button type="button" onClick={() => setShowSettings(true)} className="underline underline-offset-2 hover:text-amber-300 transition-colors">
                  configurer
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-2xl px-6 py-4"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate CTA */}
        <div className="flex justify-center">
          <motion.button
            type="submit"
            disabled={!canGenerate}
            whileHover={canGenerate ? { scale: 1.02 } : {}}
            whileTap={canGenerate ? { scale: 0.98 } : {}}
            className="flex items-center gap-3 px-12 py-4 rounded-2xl font-black text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-xl shadow-purple-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                <Brain className="w-5 h-5" />
                Générer l'analyse cognitive
                <Sparkles className="w-4 h-4 opacity-70" />
              </>
            )}
          </motion.button>
        </div>
      </motion.form>

      {/* Loading state */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card p-10 border border-purple-500/10"
          >
            <div className="flex items-center gap-5 mb-8">
              <div className="p-3 bg-purple-500/10 rounded-2xl shrink-0">
                <Brain className="w-7 h-7 text-purple-400 animate-pulse" />
              </div>
              <div>
                <p className="font-black text-white text-lg">
                  Analyse de <span className="text-purple-400">{selectedBook?.title}</span>
                </p>
                <p className="text-sm text-white/40 mt-0.5">
                  L'IA extrait les concepts clés et les applique à votre contexte...
                </p>
              </div>
            </div>
            <div className="space-y-3 animate-pulse">
              {[100, 75, 88, 55, 80, 65].map((w, i) => (
                <div key={i} className="h-2.5 bg-white/5 rounded-full" style={{ width: `${w}%` }} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && !loading && (
          <motion.div
            key={result.bookTitle}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* Key Quote */}
            <div className="glass-card p-8 border border-purple-500/10">
              <div className="flex items-start gap-5">
                <div className="p-2.5 bg-purple-500/10 rounded-2xl shrink-0 mt-0.5">
                  <Quote className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-purple-400/50 mb-3">Citation emblématique</p>
                  <blockquote className="text-base italic text-white/70 leading-relaxed font-medium">
                    "{result.keyQuote}"
                  </blockquote>
                  <cite className="block mt-3 text-xs text-white/25 not-italic">— {selectedBook?.author}</cite>
                </div>
                <button
                  onClick={() => copyToClipboard(result.keyQuote, 'quote')}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/20 hover:text-white shrink-0"
                >
                  {copiedField === 'quote' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div>
              <div className="flex gap-2 mb-6 flex-wrap">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border text-sm font-bold transition-all ${
                      activeTab === tab.id
                        ? 'bg-purple-500/15 border-purple-500/30 text-purple-300 shadow-sm'
                        : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* ── Concepts Clés ── */}
                  {activeTab === 'concepts' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {result.coreConcepts.map((concept: CognitiveConcept, i: number) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.07 }}
                          className="glass-card p-6 group hover:border-purple-500/20 transition-all"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-purple-400 text-sm font-black shrink-0">
                              {i + 1}
                            </div>
                            <button
                              onClick={() => copyToClipboard(
                                `${concept.title}\n\n${concept.description}\n\nApplication : ${concept.application}`,
                                `concept-${i}`
                              )}
                              className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-lg transition-all text-white/30 hover:text-white"
                            >
                              {copiedField === `concept-${i}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <h4 className="font-black text-sm mb-3 text-white leading-snug">{concept.title}</h4>
                          <p className="text-xs text-white/45 leading-relaxed mb-5">{concept.description}</p>
                          <div className="pt-4 border-t border-white/5">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Lightbulb className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/50">Application</span>
                            </div>
                            <p className="text-xs text-amber-200/60 leading-relaxed">{concept.application}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* ── Analyse ── */}
                  {activeTab === 'analyse' && (
                    <div className="glass-card p-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-500/10 rounded-xl">
                            <FileText className="w-5 h-5 text-purple-400" />
                          </div>
                          <h3 className="font-black text-xs uppercase tracking-widest text-white/50">Analyse & Cas d'Usage</h3>
                        </div>
                        <button
                          onClick={() => copyToClipboard(result.useCaseAnalysis, 'analyse')}
                          className="btn-secondary text-xs"
                        >
                          {copiedField === 'analyse' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          Copier
                        </button>
                      </div>
                      <div className="bg-black/30 rounded-2xl p-6 border border-white/5">
                        <RenderMarkdown content={result.useCaseAnalysis} />
                      </div>
                    </div>
                  )}

                  {/* ── Mindmap ── */}
                  {activeTab === 'mindmap' && (
                    <div className="glass-card p-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-500/10 rounded-xl">
                            <Map className="w-5 h-5 text-purple-400" />
                          </div>
                          <h3 className="font-black text-xs uppercase tracking-widest text-white/50">Mindmap Interactive</h3>
                        </div>
                        <button
                          onClick={() => copyToClipboard(result.mindmapMermaid, 'mindmap')}
                          className="btn-secondary text-xs"
                        >
                          {copiedField === 'mindmap' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          Code Mermaid
                        </button>
                      </div>
                      <div className="bg-black/30 rounded-2xl p-6 border border-white/5 overflow-auto">
                        <MindmapViewer code={result.mindmapMermaid} />
                      </div>
                    </div>
                  )}

                  {/* ── Plan d'Action ── */}
                  {activeTab === 'plan' && (
                    <div className="glass-card p-8">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-500/10 rounded-xl">
                            <Target className="w-5 h-5 text-purple-400" />
                          </div>
                          <h3 className="font-black text-xs uppercase tracking-widest text-white/50">Plan d'Action — 30 Jours</h3>
                        </div>
                        <button
                          onClick={() => copyToClipboard(
                            result.actionPlan.map((s: ActionStep) => `Étape ${s.step} : ${s.action}\n→ Impact : ${s.impact}`).join('\n\n'),
                            'plan'
                          )}
                          className="btn-secondary text-xs"
                        >
                          {copiedField === 'plan' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          Copier tout
                        </button>
                      </div>
                      <div className="space-y-4">
                        {result.actionPlan.map((step: ActionStep, i: number) => (
                          <motion.div
                            key={step.step}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className="flex gap-5 p-5 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-purple-500/20 group transition-all"
                          >
                            <div className="flex flex-col items-center shrink-0">
                              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center text-purple-400 text-sm font-black">
                                {step.step}
                              </div>
                              {i < result.actionPlan.length - 1 && (
                                <div className="w-px flex-1 bg-purple-500/10 mt-2" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pb-1">
                              <p className="text-sm font-semibold text-white leading-relaxed mb-3">{step.action}</p>
                              <div className="flex items-start gap-2">
                                <ArrowRight className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-green-300/60 leading-relaxed">{step.impact}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => copyToClipboard(`${step.action}\n→ ${step.impact}`, `step-${i}`)}
                              className="p-2 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-xl transition-all text-white/20 hover:text-white shrink-0 self-start"
                            >
                              {copiedField === `step-${i}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Reset */}
            <div className="flex justify-center pt-4">
              <button
                onClick={() => {
                  setResult(null);
                  setSelectedBookId('');
                  setUserContext('');
                  setActiveTab('concepts');
                  setError(null);
                }}
                className="btn-secondary text-xs font-bold uppercase tracking-widest"
              >
                <RefreshCw className="w-4 h-4" />
                Nouvelle analyse
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!result && !loading && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-4"
        >
          {[
            {
              icon: <BookOpen className="text-purple-400 w-6 h-6" />,
              title: '20 Livres Stratégiques',
              desc: 'Une sélection des ouvrages les plus impactants : entrepreneuriat, productivité, marketing, stratégie et psychologie.',
            },
            {
              icon: <Brain className="text-pink-400 w-6 h-6" />,
              title: 'Analyse Personnalisée',
              desc: "L'IA adapte les concepts du livre à votre contexte spécifique pour des insights directement actionnables.",
            },
            {
              icon: <Map className="text-red-400 w-6 h-6" />,
              title: 'Mindmap Interactive',
              desc: 'Visualisez les concepts clés sous forme de carte mentale Mermaid.js générée automatiquement.',
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.1 }}
              className="glass-card p-8 hover:bg-white/[0.05] transition-colors group"
            >
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h4 className="text-lg font-black mb-3 tracking-tight">{feature.title}</h4>
              <p className="text-sm text-white/40 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.section>
      )}
    </div>
  );
}
