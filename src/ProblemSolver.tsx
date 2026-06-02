import React, { useState, useEffect, useRef } from 'react';
import {
  Target,
  Zap,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Map,
  FileText,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  X,
  Settings,
  ArrowRight,
  Star,
  ChevronDown,
  Lightbulb,
  BookOpen,
  FlaskConical,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  solveProblem,
  ProblemSolverResult,
  MethodSolution,
} from './services/problemSolverService';
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
              <span className="text-amber-400 mt-[3px] shrink-0 text-[10px]">▸</span>
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

// ── Mermaid viewer (shared pattern) ────────────────────────────────────────

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
          mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose', fontFamily: 'Inter, sans-serif' });
          mermaidReady = true;
        }
        const id = `mmd-ps-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setRenderError(true); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [code]);

  if (loading && !renderError) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>;
  }
  if (renderError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-amber-400 text-xs p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Mindmap non disponible. Code source :
        </div>
        <pre className="bg-black/40 p-6 rounded-2xl text-xs text-white/40 overflow-auto border border-white/5 font-mono whitespace-pre leading-relaxed">{code}</pre>
      </div>
    );
  }
  return (
    <div ref={containerRef} className="flex justify-center items-center min-h-[280px] [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:rounded-xl" />
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
  const [visible, setVisible] = useState<Record<ProviderId, boolean>>(
    { gemini: false, openai: false, anthropic: false, deepseek: false }
  );
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 flex items-center justify-center z-[70] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-lg bg-[#111] border border-white/10 rounded-3xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-xl"><Key className="w-5 h-5 text-amber-400" /></div>
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
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all text-sm font-bold">Annuler</button>
            <button onClick={() => { onSave(draft); onClose(); }} className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-all text-sm font-black">Enregistrer</button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Method Solution Card ────────────────────────────────────────────────────

interface MethodCardProps {
  method: MethodSolution;
  index: number;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}

function MethodCard({ method, index, copiedField, onCopy }: MethodCardProps) {
  const [expanded, setExpanded] = useState(false);
  const copyText = `${method.methodName} [${method.discipline}]\n\nComment ça marche :\n${method.methodExplanation}\n\nSolution appliquée :\n${method.appliedSolution}\n\nÉtapes :\n${method.keySteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`glass-card p-6 group transition-all ${
        method.isTopRecommendation
          ? 'border-amber-500/30 bg-amber-500/[0.03]'
          : 'hover:border-amber-500/15'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl shrink-0 mt-0.5">{method.emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-black text-sm text-white leading-snug">{method.methodName}</h4>
              {method.isTopRecommendation && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider shrink-0">
                  <Star className="w-2.5 h-2.5 fill-amber-400" />
                  Top
                </span>
              )}
            </div>
            <span className="text-[10px] text-white/30 uppercase tracking-widest">{method.discipline}</span>
          </div>
        </div>
        <button
          onClick={() => onCopy(copyText, `method-${index}`)}
          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-lg transition-all text-white/30 hover:text-white shrink-0"
        >
          {copiedField === `method-${index}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Method explanation */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <BookOpen className="w-3 h-3 text-white/30 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Comment ça marche</span>
        </div>
        <p className="text-xs text-white/40 leading-relaxed italic">{method.methodExplanation}</p>
      </div>

      {/* Applied solution */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Zap className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/60">Solution appliquée</span>
        </div>
        <p className="text-xs text-amber-200/70 leading-relaxed">{method.appliedSolution}</p>
      </div>

      {/* Key steps */}
      <div className="pt-4 border-t border-white/5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full text-left mb-2"
        >
          <ListChecks className="w-3 h-3 text-white/30" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Étapes clés</span>
          <ChevronDown className={`w-3 h-3 text-white/20 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <ol className="space-y-2 pt-1">
                {method.keySteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-[9px] font-black shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-xs text-white/55 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
        {!expanded && (
          <p className="text-[10px] text-white/20 mt-1">{method.keySteps.length} étapes — cliquez pour afficher</p>
        )}
      </div>
    </motion.div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────

type Tab = 'solutions' | 'synthese' | 'mindmap' | 'recommandation';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'solutions', label: 'Solutions', icon: <FlaskConical className="w-4 h-4" /> },
  { id: 'synthese', label: 'Synthèse', icon: <FileText className="w-4 h-4" /> },
  { id: 'mindmap', label: 'Mindmap', icon: <Map className="w-4 h-4" /> },
  { id: 'recommandation', label: 'Recommandation', icon: <Star className="w-4 h-4" /> },
];

// ── Example problems ─────────────────────────────────────────────────────────

const EXAMPLE_PROBLEMS = [
  "Je n'arrive pas à maintenir ma concentration sur mes projets importants face aux interruptions constantes.",
  "Mon équipe manque de cohésion et les conflits entre membres ralentissent nos projets.",
  "Je procrastine systématiquement les tâches difficiles même quand elles sont urgentes.",
  "Notre startup a du mal à passer de 10 à 100 clients malgré un produit validé.",
];

// ── Main component ──────────────────────────────────────────────────────────

interface ProblemSolverProps {
  onNavigate: (path: string) => void;
}

export default function ProblemSolver({ onNavigate: _onNavigate }: ProblemSolverProps) {
  const [problemDescription, setProblemDescription] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>(loadApiKeys);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProblemSolverResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('solutions');
  const [showSettings, setShowSettings] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
    const trimmed = problemDescription.trim();
    if (trimmed.length < 10) return;
    setError(null);
    setLoading(true);
    try {
      const data = await solveProblem(
        trimmed,
        additionalContext.trim(),
        selectedModel,
        selectedProvider,
        apiKeys[selectedProvider]
      );
      setResult(data);
      setActiveTab('solutions');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue lors de l'analyse.");
    } finally {
      setLoading(false);
    }
  };

  const canGenerate = problemDescription.trim().length >= 10 && !loading;
  const topMethod = result?.selectedMethods.find((m) => m.isTopRecommendation) ?? result?.selectedMethods[0];

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
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-bold uppercase tracking-widest mb-8">
          <Target className="w-3 h-3" />
          Problem Solver — Multi-Disciplinaire
        </div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-[0.9] mb-8">
          CHAQUE PROBLÈME<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-500">A UNE SOLUTION.</span>
        </h1>
        <p className="text-white/50 text-xl max-w-2xl mx-auto leading-relaxed">
          Exposez votre problème. L'IA sélectionne les 5 meilleures méthodes de résolution issues de toutes les disciplines — management, neurosciences, biologie, sport, philosophie — et les applique à votre cas précis.
        </p>
      </motion.section>

      {/* Form */}
      <motion.form
        onSubmit={handleGenerate}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-6 mb-12"
      >
        {/* Problem textarea — hero input */}
        <div className="glass-card p-6 border border-amber-500/10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0">1</div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white/50">Décrivez votre problème</h3>
          </div>
          <textarea
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value.slice(0, 1200))}
            placeholder="Décrivez votre problème avec précision : ce qui se passe, depuis quand, les tentatives déjà effectuées, l'impact sur votre situation..."
            rows={6}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20 resize-none transition-colors leading-relaxed"
          />
          <div className="flex items-center justify-between mt-2">
            {problemDescription.length > 0 && problemDescription.length < 10 ? (
              <p className="text-[10px] text-amber-400/70">Minimum 10 caractères</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {EXAMPLE_PROBLEMS.slice(0, 2).map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setProblemDescription(ex)}
                    className="text-[10px] text-white/25 hover:text-amber-400/60 transition-colors underline underline-offset-2 text-left"
                  >
                    Exemple {i + 1}
                  </button>
                ))}
              </div>
            )}
            <span className={`text-[10px] font-mono ml-auto ${problemDescription.length >= 1200 ? 'text-red-400' : 'text-white/20'}`}>
              {problemDescription.length}/1200
            </span>
          </div>
        </div>

        {/* Context + Provider row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Optional context */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0">2</div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white/50">Contexte additionnel</h3>
                <p className="text-[10px] text-white/25 mt-0.5">Optionnel — contraintes, domaine, urgence...</p>
              </div>
            </div>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value.slice(0, 400))}
              placeholder="Ex : deadline dans 2 semaines, budget limité, équipe de 3 personnes, secteur B2B SaaS..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20 resize-none transition-colors leading-relaxed"
            />
            <div className={`text-right text-[10px] font-mono mt-1.5 ${additionalContext.length >= 400 ? 'text-red-400' : 'text-white/20'}`}>
              {additionalContext.length}/400
            </div>
          </div>

          {/* Provider */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-black shrink-0">3</div>
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
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
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
            className="flex items-center gap-3 px-12 py-4 rounded-2xl font-black text-base bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-xl shadow-amber-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                <Target className="w-5 h-5" />
                Résoudre ce problème
                <Sparkles className="w-4 h-4 opacity-70" />
              </>
            )}
          </motion.button>
        </div>
      </motion.form>

      {/* Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="glass-card p-10 border border-amber-500/10"
          >
            <div className="flex items-center gap-5 mb-8">
              <div className="p-3 bg-amber-500/10 rounded-2xl shrink-0">
                <Target className="w-7 h-7 text-amber-400 animate-pulse" />
              </div>
              <div>
                <p className="font-black text-white text-lg">Analyse multi-disciplinaire en cours</p>
                <p className="text-sm text-white/40 mt-0.5">
                  Sélection des 5 méthodes les plus adaptées à votre problème...
                </p>
              </div>
            </div>
            <div className="space-y-3 animate-pulse">
              {[100, 70, 85, 60, 90, 55].map((w, i) => (
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
            key="results"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* Problem Summary */}
            <div className="glass-card p-8 border border-amber-500/10">
              <div className="flex items-start gap-5">
                <div className="p-2.5 bg-amber-500/10 rounded-2xl shrink-0">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/50 mb-3">Problème analysé</p>
                  <p className="text-base text-white/75 leading-relaxed font-medium">{result.problemSummary}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[10px] text-white/20 uppercase tracking-widest block">Méthodes</span>
                  <span className="text-2xl font-black text-amber-400">{result.selectedMethods.length}</span>
                </div>
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
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-sm'
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
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
                >
                  {/* ── Solutions ── */}
                  {activeTab === 'solutions' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                      {result.selectedMethods.map((method, i) => (
                        <React.Fragment key={i}>
                          <MethodCard
                            method={method}
                            index={i}
                            copiedField={copiedField}
                            onCopy={copyToClipboard}
                          />
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* ── Synthèse ── */}
                  {activeTab === 'synthese' && (
                    <div className="glass-card p-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500/10 rounded-xl">
                            <FileText className="w-5 h-5 text-amber-400" />
                          </div>
                          <h3 className="font-black text-xs uppercase tracking-widest text-white/50">Analyse Comparative</h3>
                        </div>
                        <button
                          onClick={() => copyToClipboard(result.synthesisMarkdown, 'synthese')}
                          className="btn-secondary text-xs"
                        >
                          {copiedField === 'synthese' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          Copier
                        </button>
                      </div>
                      <div className="bg-black/30 rounded-2xl p-6 border border-white/5">
                        <RenderMarkdown content={result.synthesisMarkdown} />
                      </div>
                    </div>
                  )}

                  {/* ── Mindmap ── */}
                  {activeTab === 'mindmap' && (
                    <div className="glass-card p-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500/10 rounded-xl">
                            <Map className="w-5 h-5 text-amber-400" />
                          </div>
                          <h3 className="font-black text-xs uppercase tracking-widest text-white/50">Carte des Solutions</h3>
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

                  {/* ── Recommandation ── */}
                  {activeTab === 'recommandation' && topMethod && (
                    <div className="space-y-6">
                      <div className="glass-card p-8 border border-amber-500/20">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2.5 bg-amber-500/10 rounded-2xl">
                            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/50">Méthode recommandée en priorité</p>
                            <h3 className="text-xl font-black text-white mt-0.5">{result.topRecommendation}</h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div className="bg-black/30 rounded-2xl p-5 border border-white/5">
                            <div className="flex items-center gap-2 mb-3">
                              <BookOpen className="w-3.5 h-3.5 text-white/30" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-white/30">La méthode</span>
                            </div>
                            <p className="text-sm text-white/60 leading-relaxed">{topMethod.methodExplanation}</p>
                            <span className="mt-3 inline-block text-[10px] text-white/25 uppercase tracking-widest border border-white/10 px-2 py-0.5 rounded-full">
                              {topMethod.discipline}
                            </span>
                          </div>
                          <div className="bg-amber-500/[0.04] rounded-2xl p-5 border border-amber-500/10">
                            <div className="flex items-center gap-2 mb-3">
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/50">Votre solution</span>
                            </div>
                            <p className="text-sm text-amber-200/70 leading-relaxed">{topMethod.appliedSolution}</p>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <ListChecks className="w-4 h-4 text-white/40" />
                            <h4 className="text-xs font-black uppercase tracking-widest text-white/40">Plan d'action immédiat</h4>
                          </div>
                          <ol className="space-y-3">
                            {topMethod.keySteps.map((step, i) => (
                              <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-start gap-4 p-4 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-amber-500/15 transition-colors"
                              >
                                <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-black shrink-0">
                                  {i + 1}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-white/70 leading-relaxed">{step}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-amber-400/30 shrink-0 mt-0.5" />
                              </motion.li>
                            ))}
                          </ol>
                        </div>
                      </div>

                      {/* Other methods summary */}
                      <div className="glass-card p-6">
                        <p className="text-xs font-black uppercase tracking-widest text-white/30 mb-4">Autres méthodes analysées</p>
                        <div className="space-y-2">
                          {result.selectedMethods
                            .filter((m) => !m.isTopRecommendation)
                            .map((m, i) => (
                              <div key={i} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/5">
                                <span className="text-lg shrink-0">{m.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-white/60 truncate">{m.methodName}</p>
                                  <p className="text-[10px] text-white/25 uppercase tracking-wider">{m.discipline}</p>
                                </div>
                                <button
                                  onClick={() => { setActiveTab('solutions'); }}
                                  className="text-[10px] text-amber-400/40 hover:text-amber-400 transition-colors shrink-0"
                                >
                                  Voir →
                                </button>
                              </div>
                            ))}
                        </div>
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
                  setProblemDescription('');
                  setAdditionalContext('');
                  setActiveTab('solutions');
                  setError(null);
                }}
                className="btn-secondary text-xs font-bold uppercase tracking-widest"
              >
                <RefreshCw className="w-4 h-4" />
                Nouveau problème
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!result && !loading && (
        <motion.section
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="space-y-10 mt-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <FlaskConical className="text-amber-400 w-6 h-6" />, title: '20 Méthodes Expertes', desc: 'Design Thinking, TRIZ, First Principles, Biomimétisme, Marginal Gains... issues de toutes les disciplines.' },
              { icon: <Target className="text-orange-400 w-6 h-6" />, title: 'Sélection Automatique', desc: "L'IA choisit les 5 méthodes les plus adaptées à VOTRE problème spécifique, pas les plus populaires." },
              { icon: <Zap className="text-red-400 w-6 h-6" />, title: 'Solutions Concrètes', desc: 'Chaque méthode est expliquée et appliquée à votre cas avec des étapes actionnables immédiatement.' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.1 }}
                className="glass-card p-8 hover:bg-white/[0.05] transition-colors group"
              >
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">{f.icon}</div>
                <h4 className="text-lg font-black mb-3 tracking-tight">{f.title}</h4>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Example problems */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white/25 mb-4 text-center">Exemples de problèmes</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {EXAMPLE_PROBLEMS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setProblemDescription(ex)}
                  className="text-left p-4 bg-white/[0.03] border border-white/5 rounded-2xl text-sm text-white/40 hover:text-white/70 hover:border-amber-500/20 hover:bg-amber-500/[0.03] transition-all group"
                >
                  <span className="text-amber-400/40 group-hover:text-amber-400 mr-2 transition-colors">→</span>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </motion.section>
      )}
    </div>
  );
}
