import { blogArticles, BlogArticle } from './blogData';
import { motion } from 'motion/react';
import { Calendar, Clock, ArrowRight, Tag } from 'lucide-react';

interface BlogListProps {
  onNavigate: (path: string) => void;
}

export default function BlogList({ onNavigate }: BlogListProps) {
  const categories = [...new Set(blogArticles.map(a => a.category))];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <section className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl sm:text-6xl font-black mb-6 tracking-tighter leading-[0.9]">
            BLOG <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500">YOUTUBE SEO</span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto leading-relaxed">
            Guides, astuces et stratégies pour optimiser vos vidéos YouTube et dominer l'algorithme.
          </p>
        </motion.div>
      </section>

      {/* CTA vers l'outil */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-8 mb-12 text-center"
      >
        <p className="text-white/60 mb-4">Passez de la théorie à la pratique :</p>
        <button
          onClick={() => onNavigate('/')}
          className="btn-primary inline-flex"
        >
          Générer vos métadonnées YouTube
          <ArrowRight className="w-5 h-5" />
        </button>
      </motion.div>

      {/* Categories */}
      <div className="flex flex-wrap gap-3 justify-center mb-12">
        {categories.map(cat => (
          <span key={cat} className="px-4 py-2 bg-white/5 text-white/50 rounded-full text-xs font-bold uppercase tracking-widest border border-white/10">
            <Tag className="w-3 h-3 inline mr-2" />
            {cat}
          </span>
        ))}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {blogArticles.map((article, i) => (
          <ArticleCard key={article.slug} article={article} index={i} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function ArticleCard({ article, index, onNavigate }: { key?: string; article: BlogArticle; index: number; onNavigate: (path: string) => void }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index }}
      className="glass-card p-6 flex flex-col group hover:bg-white/[0.05] transition-colors cursor-pointer"
      onClick={() => onNavigate(`/blog/${article.slug}`)}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
          {article.category}
        </span>
      </div>
      <h2 className="text-lg font-black tracking-tight mb-3 group-hover:text-red-400 transition-colors leading-tight">
        {article.title}
      </h2>
      <p className="text-sm text-white/40 leading-relaxed mb-6 flex-1">
        {article.excerpt}
      </p>
      <div className="flex items-center justify-between text-[10px] text-white/30 uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(article.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {article.readTime}
          </span>
        </div>
        <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
      </div>
    </motion.article>
  );
}
