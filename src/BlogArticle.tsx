import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar, Clock, ArrowLeft, ArrowRight, Tag } from 'lucide-react';
import { BlogArticle as BlogArticleType, getArticleBySlug, getRelatedArticles } from './blogData';

interface BlogArticleProps {
  slug: string;
  onNavigate: (path: string) => void;
}

export default function BlogArticle({ slug, onNavigate }: BlogArticleProps) {
  const article = getArticleBySlug(slug);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (article) {
      document.title = `${article.title} | YT MetaGen AI`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', article.metaDescription);
    }
    return () => {
      document.title = 'YT MetaGen AI - Générateur de Métadonnées YouTube par IA';
    };
  }, [slug, article]);

  if (!article) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-black mb-4">Article introuvable</h1>
        <p className="text-white/50 mb-8">Cet article n'existe pas ou a été déplacé.</p>
        <button onClick={() => onNavigate('/blog')} className="btn-primary inline-flex">
          Retour au blog
        </button>
      </div>
    );
  }

  const related = getRelatedArticles(article);
  const contentSections = parseMarkdown(article.content);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-4 py-12"
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-white/30 mb-8" aria-label="Fil d'Ariane">
        <button onClick={() => onNavigate('/')} className="hover:text-white transition-colors">Accueil</button>
        <span>/</span>
        <button onClick={() => onNavigate('/blog')} className="hover:text-white transition-colors">Blog</button>
        <span>/</span>
        <span className="text-white/50 truncate max-w-[200px]">{article.title}</span>
      </nav>

      {/* Article Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
            {article.category}
          </span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter leading-tight mb-6">
          {article.title}
        </h1>
        <div className="flex items-center gap-6 text-sm text-white/40">
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {new Date(article.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {article.readTime} de lecture
          </span>
        </div>
      </header>

      {/* CTA Banner */}
      <div className="glass-card p-6 mb-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-white/60">Mettez ces conseils en pratique avec notre outil IA :</p>
        <button onClick={() => onNavigate('/')} className="btn-primary text-sm whitespace-nowrap">
          Essayer YT MetaGen AI
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Article Content */}
      <article className="prose-custom mb-16">
        {contentSections.map((section, i) => (
          <div key={i}>{section}</div>
        ))}
      </article>

      {/* Related Articles */}
      {related.length > 0 && (
        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-black tracking-tight mb-8">Articles similaires</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {related.map(rel => (
              <button
                key={rel.slug}
                onClick={() => onNavigate(`/blog/${rel.slug}`)}
                className="glass-card p-6 text-left group hover:bg-white/[0.05] transition-colors"
              >
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">{rel.category}</span>
                <h3 className="text-sm font-bold mt-2 mb-3 group-hover:text-red-400 transition-colors leading-tight">
                  {rel.title}
                </h3>
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <Clock className="w-3 h-3" />
                  {rel.readTime}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <div className="mt-12 text-center">
        <div className="glass-card p-10">
          <h2 className="text-2xl font-black tracking-tight mb-4">Prêt à optimiser vos vidéos ?</h2>
          <p className="text-white/50 mb-6 max-w-lg mx-auto">
            Générez des titres, descriptions, tags et bien plus encore en quelques secondes grâce à l'IA.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => onNavigate('/')} className="btn-primary">
              Générer mes métadonnées
              <ArrowRight className="w-5 h-5" />
            </button>
            <button onClick={() => onNavigate('/blog')} className="btn-secondary">
              <ArrowLeft className="w-4 h-4" />
              Tous les articles
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function parseMarkdown(content: string): React.ReactElement[] {
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let currentParagraph: string[] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join(' ');
      elements.push(
        <p key={elements.length} className="text-white/60 leading-relaxed mb-6" dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
      );
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={elements.length} className="space-y-2 mb-6 ml-4">
          {listItems.map((item, i) => (
            <li key={i} className="text-white/60 leading-relaxed flex items-start gap-2">
              <span className="text-red-500 mt-1.5 shrink-0">&#8226;</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushParagraph();
      if (inList) flushList();
      continue;
    }

    if (trimmed.startsWith('### ')) {
      flushParagraph();
      flushList();
      elements.push(
        <h3 key={elements.length} className="text-lg font-black tracking-tight mt-8 mb-4 text-white/90">
          {trimmed.slice(4)}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      elements.push(
        <h2 key={elements.length} className="text-2xl font-black tracking-tight mt-10 mb-6 text-white">
          {trimmed.slice(3)}
        </h2>
      );
    } else if (trimmed.startsWith('- ')) {
      flushParagraph();
      inList = true;
      listItems.push(trimmed.slice(2));
    } else {
      if (inList) flushList();
      currentParagraph.push(trimmed);
    }
  }

  flushParagraph();
  flushList();

  return elements;
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-red-400 text-xs font-mono">$1</code>');
}
