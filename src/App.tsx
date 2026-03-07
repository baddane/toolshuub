import React, { useState, useEffect } from 'react';
import {
  Youtube,
  Sparkles,
  Copy,
  Check,
  Loader2,
  Type as TypeIcon,
  AlignLeft,
  Hash,
  Image as ImageIcon,
  Zap,
  RefreshCw,
  MessageSquare,
  Users,
  Film,
  Share2,
  Search,
  History,
  Trash2,
  ExternalLink,
  ChevronRight,
  Lightbulb,
  Megaphone,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateYouTubeMetadata, YouTubeMetadata } from './services/geminiService';

const MOCK_RESULT: YouTubeMetadata = {
  titles: [
    "Comment dresser son chat en 7 jours (SANS STRESS)",
    "5 Astuces de pro pour un chat obéissant",
    "Le guide ULTIME du dressage félin : Ce que personne ne vous dit",
    "Dressage de chat : Arrêtez de faire ces 3 erreurs !",
    "Mon chat fait enfin ce que je lui demande (Tuto complet)"
  ],
  description: "Dans cette vidéo, je vous partage ma méthode éprouvée pour dresser votre chat en seulement une semaine. Que ce soit pour le rappel, l'utilisation de la litière ou simplement pour qu'il arrête de griffer vos meubles, ces astuces vont changer votre vie de propriétaire de félin.\n\n📌 AU PROGRAMME :\n0:00 - Introduction\n1:20 - Comprendre la psychologie féline\n3:45 - La technique de la récompense positive\n6:10 - Exercices pratiques au quotidien\n9:30 - Conclusion et FAQ\n\n🔔 ABONNEZ-VOUS pour plus de conseils sur vos animaux préférés !",
  tags: ["dressage chat", "comportement félin", "astuces chat", "éducation animale", "chat obéissant", "tuto chat"],
  thumbnailIdeas: [
    "Gros plan sur un chat qui fait 'high five' avec un texte jaune 'INCROYABLE'",
    "Avant/Après : Un chat qui griffe un canapé vs un chat assis sagement",
    "Le créateur pointant du doigt un chat avec une bulle de texte 'Il m'écoute !'"
  ],
  hooks: [
    "Saviez-vous que votre chat comprend plus de mots que vous ne le pensez ?",
    "Si votre chat ignore vos ordres, c'est probablement à cause de cette erreur simple.",
    "Imaginez un chat qui vient quand on l'appelle... C'est possible, et je vous montre comment."
  ],
  shortsScript: "INTRO: (0-5s) 'Votre chat vous ignore ? Arrêtez tout !' \nCORPS: (5-45s) 'Étape 1: Utilisez des friandises irrésistibles. Étape 2: Soyez constant. Étape 3: Ne punissez jamais.' \nOUTRO: (45-60s) 'Abonnez-vous pour la méthode complète !'",
  communityPost: "Sondage : Quel est le plus gros défi avec votre chat ? \n1. Les griffures \n2. Le rappel \n3. Les bêtises nocturnes \nDites-le moi en commentaire, je prépare une vidéo spéciale !",
  pinnedComment: "Dites-moi en commentaire : Quel âge a votre chat et quel est son petit nom ? 🐱👇",
  targetAudience: "Propriétaires de chats frustrés par le comportement de leur animal, nouveaux adoptants cherchant des bases solides.",
  ctaVariants: [
    "Rejoignez la meute des amoureux des chats en vous abonnant !",
    "Cliquez sur la cloche pour ne rater aucun tuto félin.",
    "Partagez cette vidéo à un ami dont le chat est un petit démon !"
  ],
  longTailKeywords: ["comment dresser un chaton qui griffe", "méthode positive dressage chat adulte", "faire venir son chat quand on l'appelle"]
};

const MAX_INPUT_LENGTH = 200;

function loadHistory(): YouTubeMetadata[] {
  try {
    const saved = localStorage.getItem('yt_meta_history');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function persistHistory(data: YouTubeMetadata[]) {
  try {
    localStorage.setItem('yt_meta_history', JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, quota exceeded)
  }
}

export default function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [result, setResult] = useState<YouTubeMetadata | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<YouTubeMetadata[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);

  const saveToHistory = (data: YouTubeMetadata) => {
    // Avoid duplicates based on all titles
    const newTitles = data.titles.join('|');
    if (history.some(h => h.titles.join('|') === newTitles)) return;

    const newHistory = [data, ...history.slice(0, 9)];
    setHistory(newHistory);
    persistHistory(newHistory);
  };

  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem('yt_meta_history'); } catch {}
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_INPUT_LENGTH) return;

    setShowExample(false);
    setError(null);
    setLoading(true);
    try {
      const data = await generateYouTubeMetadata(trimmed, selectedModel);
      setResult(data);
      saveToHistory(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Une erreur est survenue lors de la génération.");
    } finally {
      setLoading(false);
    }
  };

  const displayResult = result || (showExample ? MOCK_RESULT : null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2 rounded-xl shadow-lg shadow-red-600/20">
              <Youtube className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">YT MetaGen <span className="text-red-500">AI</span></h1>
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Powered by Gemini</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-3 hover:bg-white/5 rounded-xl transition-all relative group"
              title="Historique"
            >
              <History className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
              {history.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-black"></span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12 relative">
        {/* History Sidebar/Drawer */}
        <AnimatePresence>
          {showHistory && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHistory(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-full max-w-md bg-brand-surface border-l border-white/10 z-[70] p-8 shadow-2xl flex flex-col"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <History className="w-6 h-6 text-red-500" />
                    <h2 className="text-2xl font-black tracking-tight">Historique</h2>
                  </div>
                  <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                    <Check className="w-5 h-5 rotate-45" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="text-center py-12 opacity-30">
                      <History className="w-12 h-12 mx-auto mb-4" />
                      <p>Aucun historique pour le moment</p>
                    </div>
                  ) : (
                    history.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setResult(item);
                          setShowExample(false);
                          setShowHistory(false);
                        }}
                        className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <p className="font-medium text-sm line-clamp-2 group-hover:text-red-400 transition-colors">
                            {item.titles[0]}
                          </p>
                          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 shrink-0 mt-1" />
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-widest">
                          <Hash className="w-3 h-3" />
                          {item.tags.length} tags
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {history.length > 0 && (
                  <button 
                    onClick={clearHistory}
                    className="mt-6 w-full py-4 flex items-center justify-center gap-2 text-red-500/60 hover:text-red-500 hover:bg-red-500/5 rounded-2xl transition-all text-sm font-bold"
                  >
                    <Trash2 className="w-4 h-4" />
                    Vider l'historique
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <section className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-xs font-bold uppercase tracking-widest mb-8">
              <Sparkles className="w-3 h-3" />
              Intelligence Artificielle de pointe
            </div>
            <h2 className="text-5xl sm:text-7xl font-black mb-8 tracking-tighter leading-[0.9]">
              DOMINEZ <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500">L'ALGORITHME.</span>
            </h2>
            <p className="text-white/50 text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
              Générez instantanément des titres, descriptions et tags optimisés pour propulser vos vidéos au sommet.
            </p>

            {/* Model Selector */}
            <div className="flex justify-center gap-4 mb-8">
              {[
                { id: 'gemini-3.1-flash-lite-preview', name: 'Flash Lite', desc: 'Le plus rapide', icon: <Zap className="w-4 h-4" /> },
                { id: 'gemini-3-flash-preview', name: 'Flash', desc: 'Équilibré', icon: <Sparkles className="w-4 h-4" /> },
                { id: 'gemini-3.1-pro-preview', name: 'Pro', desc: 'Le plus puissant', icon: <Zap className="w-4 h-4 text-yellow-500" /> }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`flex flex-col items-center p-4 rounded-2xl border transition-all min-w-[120px] ${
                    selectedModel === m.id 
                      ? 'bg-red-500/10 border-red-500 shadow-lg shadow-red-500/10' 
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`p-2 rounded-lg mb-2 ${selectedModel === m.id ? 'bg-red-500 text-white' : 'bg-white/5 text-white/40'}`}>
                    {m.icon}
                  </div>
                  <span className={`text-sm font-bold ${selectedModel === m.id ? 'text-white' : 'text-white/60'}`}>{m.name}</span>
                  <span className="text-[10px] uppercase tracking-widest opacity-30 mt-1">{m.desc}</span>
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div 
            className="relative max-w-3xl mx-auto"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <form onSubmit={handleGenerate} className="relative flex flex-col sm:flex-row gap-3 bg-white/5 p-3 rounded-3xl border border-white/10 focus-within:ring-4 focus-within:ring-red-500/10 transition-all backdrop-blur-md">
              <div className="flex-1 flex items-center px-4">
                <Search className="w-5 h-5 text-white/20" />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
                  placeholder="Sujet de votre vidéo..."
                  maxLength={MAX_INPUT_LENGTH}
                  className="w-full bg-transparent border-none px-4 py-4 text-lg focus:outline-none placeholder:text-white/20 font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="btn-primary"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Générer
                    <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
            
            {input.length > 0 && (
              <div className={`mt-2 text-right text-[10px] font-mono ${input.length >= MAX_INPUT_LENGTH ? 'text-red-400' : 'text-white/20'}`}>
                {input.length}/{MAX_INPUT_LENGTH}
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {!displayResult && !loading && (
              <button
                onClick={() => setShowExample(true)}
                className="mt-6 text-xs text-white/30 hover:text-white transition-colors flex items-center gap-2 mx-auto font-bold uppercase tracking-widest"
              >
                <RefreshCw className="w-3 h-3" />
                Voir un exemple
              </button>
            )}
          </motion.div>
        </section>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {displayResult && (
            <motion.div
              key={showExample ? "example" : "results"}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative"
            >
              {showExample && (
                <div className="absolute -top-12 left-0 right-0 flex justify-center z-10">
                  <span className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-red-600/40">
                    Mode Démonstration
                  </span>
                </div>
              )}
              
              {/* Main Content Area */}
              <div className="lg:col-span-8 space-y-8">
                {/* Titles */}
                <div className="glass-card p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <TypeIcon className="w-5 h-5 text-red-500" />
                      </div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Titres Suggérés</h3>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {displayResult.titles.map((title, idx) => (
                      <div key={idx} className="group flex items-center justify-between p-5 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-red-500/30 hover:bg-red-500/[0.02] transition-all">
                        <span className="text-lg font-semibold leading-tight">{title}</span>
                        <button 
                          onClick={() => copyToClipboard(title, `title-${idx}`)}
                          className="p-3 hover:bg-white/10 rounded-xl transition-all text-white/20 hover:text-white"
                        >
                          {copiedField === `title-${idx}` ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="glass-card p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <AlignLeft className="w-5 h-5 text-red-500" />
                      </div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Description Optimisée</h3>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(displayResult.description, 'desc')}
                      className="btn-secondary text-xs"
                    >
                      {copiedField === 'desc' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      Copier tout
                    </button>
                  </div>
                  <div className="bg-black/40 rounded-3xl p-8 font-mono text-sm leading-relaxed text-white/70 whitespace-pre-wrap border border-white/5 relative group">
                    {displayResult.description}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none rounded-3xl" />
                  </div>
                </div>

                {/* Shorts Script */}
                <div className="glass-card p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <Film className="w-5 h-5 text-red-500" />
                      </div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Script Shorts / TikTok</h3>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(displayResult.shortsScript, 'shorts')}
                      className="p-3 hover:bg-white/10 rounded-xl transition-all text-white/20 hover:text-white"
                    >
                      {copiedField === 'shorts' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                  <div className="bg-red-500/[0.03] rounded-3xl p-8 italic text-white/70 whitespace-pre-wrap border border-red-500/10 leading-relaxed">
                    {displayResult.shortsScript}
                  </div>
                </div>

                {/* Hooks */}
                <div className="glass-card p-8">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-yellow-500/10 rounded-lg">
                      <Lightbulb className="w-5 h-5 text-yellow-500" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Accroches Vidéo</h3>
                  </div>
                  <div className="space-y-4">
                    {displayResult.hooks.map((hook, idx) => (
                      <div key={idx} className="group flex items-center justify-between p-5 bg-yellow-500/[0.03] rounded-2xl border border-yellow-500/10 hover:border-yellow-500/30 transition-all">
                        <span className="text-sm text-white/70 italic leading-relaxed">"{hook}"</span>
                        <button
                          onClick={() => copyToClipboard(hook, `hook-${idx}`)}
                          className="p-3 hover:bg-white/10 rounded-xl transition-all text-white/20 hover:text-white shrink-0 ml-3"
                        >
                          {copiedField === `hook-${idx}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar Area */}
              <div className="lg:col-span-4 space-y-8">
                {/* Audience Cible */}
                <div className="glass-card p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Users className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-black uppercase tracking-widest text-xs opacity-60">Audience Cible</h3>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed font-medium">{displayResult.targetAudience}</p>
                </div>

                {/* Community Post */}
                <div className="glass-card p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Share2 className="w-5 h-5 text-blue-500" />
                      <h3 className="font-black uppercase tracking-widest text-xs opacity-60">Post Communauté</h3>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(displayResult.communityPost, 'community')}
                      className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/20 hover:text-white"
                    >
                      {copiedField === 'community' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-sm text-white/60 italic bg-black/20 p-6 rounded-2xl border border-white/5 leading-relaxed">{displayResult.communityPost}</p>
                </div>

                {/* Pinned Comment */}
                <div className="glass-card p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-orange-500" />
                      <h3 className="font-black uppercase tracking-widest text-xs opacity-60">Commentaire Épinglé</h3>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(displayResult.pinnedComment, 'pinned')}
                      className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/20 hover:text-white"
                    >
                      {copiedField === 'pinned' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-sm text-white/60 font-medium bg-orange-500/[0.03] p-6 rounded-2xl border border-orange-500/10 leading-relaxed">{displayResult.pinnedComment}</p>
                </div>

                {/* Thumbnail Ideas */}
                <div className="glass-card p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <ImageIcon className="w-5 h-5 text-purple-500" />
                    <h3 className="font-black uppercase tracking-widest text-xs opacity-60">Idées Miniatures</h3>
                  </div>
                  <div className="space-y-3">
                    {displayResult.thumbnailIdeas.map((idea, idx) => (
                      <div key={idx} className="group relative text-xs p-4 bg-white/[0.03] rounded-xl text-white/50 border border-white/5 hover:border-purple-500/30 transition-all leading-relaxed">
                        {idea}
                        <button 
                          onClick={() => copyToClipboard(idea, `thumb-${idx}`)}
                          className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedField === `thumb-${idx}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Long Tail Keywords */}
                <div className="glass-card p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Search className="w-5 h-5 text-blue-400" />
                    <h3 className="font-black uppercase tracking-widest text-xs opacity-60">Longue Traîne</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {displayResult.longTailKeywords.map((kw, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => copyToClipboard(kw, `kw-${idx}`)}
                        className="px-3 py-1.5 bg-blue-400/5 text-blue-300 rounded-xl text-[10px] border border-blue-400/10 hover:bg-blue-400/10 transition-all flex items-center gap-2"
                      >
                        {kw}
                        {copiedField === `kw-${idx}` ? <Check className="w-2 h-2" /> : <Copy className="w-2 h-2 opacity-30" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Original Tags */}
                <div className="glass-card p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Hash className="w-5 h-5 text-blue-500" />
                      <h3 className="font-black uppercase tracking-widest text-xs opacity-60">Tags SEO</h3>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(displayResult.tags.join(', '), 'tags')}
                      className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/20 hover:text-white"
                    >
                      {copiedField === 'tags' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {displayResult.tags.map((tag, idx) => (
                      <span key={idx} className="px-4 py-2 bg-blue-500/5 text-blue-400 rounded-full text-[10px] font-bold border border-blue-500/10">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* CTA Variants */}
                <div className="glass-card p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Megaphone className="w-5 h-5 text-pink-500" />
                    <h3 className="font-black uppercase tracking-widest text-xs opacity-60">Appels à l'action</h3>
                  </div>
                  <div className="space-y-3">
                    {displayResult.ctaVariants.map((cta, idx) => (
                      <div key={idx} className="group relative text-xs p-4 bg-pink-500/[0.03] rounded-xl text-white/50 border border-pink-500/10 hover:border-pink-500/30 transition-all leading-relaxed">
                        {cta}
                        <button
                          onClick={() => copyToClipboard(cta, `cta-${idx}`)}
                          className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedField === `cta-${idx}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setInput('') || setResult(null) || setShowExample(false)}
                  className="btn-secondary w-full text-xs font-bold uppercase tracking-widest"
                >
                  <RefreshCw className="w-4 h-4" />
                  Effacer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State / Features */}
        {!displayResult && !loading && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            {[
              { icon: <Zap className="text-yellow-500" />, title: "Ultra Rapide", desc: "Générez vos métadonnées en moins de 5 secondes grâce à Gemini 3.1 Flash." },
              { icon: <Sparkles className="text-red-500" />, title: "Optimisé SEO", desc: "Basé sur les dernières tendances de l'algorithme YouTube pour maximiser vos vues." },
              { icon: <History className="text-blue-500" />, title: "Historique Local", desc: "Vos 10 dernières recherches sont sauvegardées automatiquement sur votre navigateur." }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (i * 0.1) }}
                className="glass-card p-8 hover:bg-white/[0.05] transition-colors group"
              >
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h4 className="text-lg font-black mb-3 tracking-tight">{feature.title}</h4>
                <p className="text-sm text-white/40 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="bg-white/5 p-2 rounded-lg">
              <Youtube className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-xl font-black tracking-tighter">YT MetaGen AI</span>
          </div>
          <p className="text-white/20 text-[10px] uppercase tracking-[0.4em]">
            © 2025 • L'outil ultime pour les créateurs
          </p>
        </div>
      </footer>
    </div>
  );
}
