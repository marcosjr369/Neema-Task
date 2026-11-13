import { ptPT } from '@clerk/localizations'

export const CLERK_LOCALIZATION = {
  ...ptPT,
  formFieldLabel__emailAddress: 'Email',
  formFieldLabel__emailAddress_username: 'Email ou nome de utilizador',
  formFieldInputPlaceholder__emailAddress: 'o.teu@email.com',
  formFieldInputPlaceholder__emailAddress_username: 'o.teu@email.com',
  formFieldLabel__password: 'Palavra-passe',
  formFieldInputPlaceholder__password: 'A tua palavra-passe',
  formFieldInputPlaceholder__signUpPassword: 'Cria uma palavra-passe',
  unstable__errors: {
    ...ptPT.unstable__errors,
    // ao criar conta com um email que já está registado (ver o passo de login em /entrar)
    form_identifier_exists__email_address: 'Já existe uma conta com este email. Carrega em "Entrar", em baixo.',
  },
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
