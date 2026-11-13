import { defineConfig } from 'vitest/config'

/**
 * Testes da lógica da app (fórmulas, ficheiros, pontos, partilha, rotas, …).
 * Correm em Node, sem browser nem base de dados: `npm test`.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // a store em ficheiro (sem DATABASE_URL) escreve numa pasta própria dos testes
    env: { DATABASE_URL: '', NEEMA_DATA_DIR: '.data-test' },
  },
})
