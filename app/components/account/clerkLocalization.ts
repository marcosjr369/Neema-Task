import { ptPT } from '@clerk/localizations'

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
