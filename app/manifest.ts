import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Udacha',
    short_name: 'Udacha',
    description: 'Tarefas, cronómetro de foco, pausas e estatísticas',
    lang: 'pt',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#7B61FF',
    categories: ['productivity', 'education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Nova tarefa', url: '/tarefas?nova=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Foco', url: '/foco', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Estatísticas', url: '/estatisticas', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
