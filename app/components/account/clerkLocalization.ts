import { ptPT } from '@clerk/localizations'

/**
 * Português de Portugal do Clerk, com os textos do login no mesmo tom da app ("tu", curto).
 * O resto vem da tradução oficial.
 */
export const CLERK_LOCALIZATION = {
  ...ptPT,
  formFieldLabel__emailAddress: 'Email',
  formFieldLabel__emailAddress_username: 'Email ou nome de utilizador',
  formFieldInputPlaceholder__emailAddress: 'o.teu@email.com',
  formFieldInputPlaceholder__emailAddress_username: 'o.teu@email.com',
  formFieldLabel__password: 'Palavra-passe',
  formFieldInputPlaceholder__password: 'A tua palavra-passe',
  signIn: {
    ...ptPT.signIn,
    emailCode: {
      ...ptPT.signIn?.emailCode,
      title: 'Vê o teu email',
      subtitle: 'Enviámos-te um código de 6 dígitos',
      formTitle: 'Código',
    },
  },
}
