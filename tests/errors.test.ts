import { describe, expect, it } from 'vitest'
import { ApiError, GENERIC_ERROR, UserError, errorText } from '../app/lib/api'

describe('mensagens de erro para o utilizador', () => {
  it('mostra a explicação concreta do servidor (4xx)', () => {
    expect(errorText(new ApiError(404, 'Tarefa não encontrada'), 'Não foi possível carregar.')).toBe('Tarefa não encontrada')
    expect(errorText(new ApiError(403, 'Só podes ver este quadro'))).toBe('Só podes ver este quadro')
  })

  it('nunca mostra códigos HTTP nem erros do servidor (5xx)', () => {
    const e = new ApiError(500, 'TypeError: cannot read properties of undefined')
    expect(e.message).not.toMatch(/500|TypeError/)
    expect(errorText(e, 'Não foi possível carregar as tarefas.')).toBe('Não foi possível carregar as tarefas.')
    expect(errorText(new ApiError(502))).not.toMatch(/\d{3}/)
  })

  it('troca respostas vagas ou sem corpo pela mensagem do contexto', () => {
    expect(errorText(new ApiError(404, 'Não encontrado'), 'Quadro não encontrado.')).toBe('Quadro não encontrado.')
    expect(errorText(new ApiError(400, 'Pedido inválido'), 'Não foi possível guardar.')).toBe('Não foi possível guardar.')
    expect(errorText(new ApiError(404))).toBe('Não encontrado.')
  })

  it('sem internet, sessão expirada e limite de pedidos dizem o que fazer', () => {
    expect(errorText(new ApiError(0), 'x')).toMatch(/internet/)
    expect(errorText(new ApiError(401), 'x')).toMatch(/sessão/)
    expect(errorText(new ApiError(429), 'x')).toMatch(/Espera/)
  })

  it('mostra erros do cliente escritos para o utilizador, esconde os técnicos', () => {
    expect(errorText(new UserError('O ficheiro tem mais de 2 MB'), 'x')).toBe('O ficheiro tem mais de 2 MB')
    const quiet = console.error
    console.error = () => {}
    try {
      expect(errorText(new TypeError('Failed to fetch'), 'Não foi possível ler o ficheiro.')).toBe('Não foi possível ler o ficheiro.')
      expect(errorText(new Error('boom'))).toBe(GENERIC_ERROR)
      expect(errorText('string solta')).toBe(GENERIC_ERROR)
    } finally {
      console.error = quiet
    }
  })
})
