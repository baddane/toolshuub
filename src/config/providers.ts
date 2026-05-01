export type ProviderId = 'gemini' | 'openai' | 'anthropic' | 'deepseek';

export interface ModelOption {
  id: string;
  name: string;
  desc: string;
}

export interface Provider {
  id: ProviderId;
  name: string;
  tagline: string;
  docsUrl: string;
  models: ModelOption[];
}

export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    tagline: 'Google DeepMind',
    docsUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-3.1-flash-lite-preview', name: 'Flash Lite', desc: 'Le plus rapide' },
      { id: 'gemini-3-flash-preview',         name: 'Flash',      desc: 'Équilibré' },
      { id: 'gemini-3.1-pro-preview',          name: 'Pro',        desc: 'Le plus puissant' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'GPT-4o',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Rapide & économique' },
      { id: 'gpt-4o',      name: 'GPT-4o',      desc: 'Très puissant' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Claude',
    tagline: 'Anthropic',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5',  desc: 'Rapide' },
      { id: 'claude-sonnet-4-6',         name: 'Sonnet 4.6', desc: 'Équilibré' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    tagline: 'DeepSeek AI',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat',     name: 'Chat',     desc: 'Général' },
      { id: 'deepseek-reasoner', name: 'Reasoner', desc: 'Raisonnement avancé' },
    ],
  },
];

export const PROVIDER_ACTIVE: Record<ProviderId, string> = {
  gemini:    'bg-blue-500/10 border-blue-500 shadow-blue-500/10',
  openai:    'bg-green-500/10 border-green-500 shadow-green-500/10',
  anthropic: 'bg-orange-500/10 border-orange-500 shadow-orange-500/10',
  deepseek:  'bg-purple-500/10 border-purple-500 shadow-purple-500/10',
};

export const PROVIDER_ICON_ACTIVE: Record<ProviderId, string> = {
  gemini:    'bg-blue-500 text-white',
  openai:    'bg-green-500 text-white',
  anthropic: 'bg-orange-500 text-white',
  deepseek:  'bg-purple-500 text-white',
};
