/**
 * Aspecto do formulário do Clerk no passo de login da entrada.
 * Parte do tema "simple" (quase sem estilo do Clerk) e veste cada elemento com as
 * classes da app: sem cartão nem título (quem fala é a Udacha), botões 3D, campos iguais
 * aos do resto da app. Funciona porque os estilos do Clerk estão na camada CSS "clerk",
 * abaixo das utilitárias do Tailwind (ver globals.css e layout.tsx).
 */

const socialButton =
  'flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-b-4 border-line bg-white px-4 py-3.5 ' +
  'text-[15px] font-extrabold text-ink transition-[transform,background] duration-100 hover:bg-snow ' +
  'active:translate-y-[2px] active:border-b-2 cursor-pointer'

const primaryButton =
  'flex w-full items-center justify-center gap-2 rounded-2xl border-0 border-b-4 border-brand-dark bg-brand px-5 py-3.5 ' +
  'text-[15px] font-extrabold uppercase tracking-wide text-white shadow-none transition-[transform,filter] duration-100 ' +
  'hover:brightness-105 active:translate-y-[2px] active:border-b-2 cursor-pointer'

// "!" (important no Tailwind 4): ganha a qualquer estilo em linha que o Clerk aplique ao campo
const input =
  'h-14! w-full! rounded-2xl! border-2! border-line! bg-white! px-5! text-base! font-bold! text-ink! shadow-none! outline-none! ' +
  'placeholder:font-semibold placeholder:text-muted/80 transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-[#D3D0E0]! focus:border-brand! focus:ring-4! focus:ring-brand/15!'

export const CLERK_APPEARANCE = {
  theme: 'simple' as const,
  options: {
    socialButtonsVariant: 'blockButton' as const,
    socialButtonsPlacement: 'top' as const,
    logoPlacement: 'none' as const,
    // o aviso "Development mode" só existe com chaves de desenvolvimento; em produção não aparece
    unsafe_disableDevelopmentModeWarnings: true,
  },
  elements: {
    // estrutura: sem cartão, sem sombra, sem título
    rootBox: 'w-full',
    cardBox: 'w-full max-w-none border-0 bg-transparent shadow-none',
    card: 'w-full border-0 bg-transparent p-0 shadow-none flex flex-col gap-5',
    header: 'hidden',
    main: 'flex flex-col gap-5',

    // botões dos fornecedores (Google, Microsoft, LinkedIn…), um por linha
    socialButtonsRoot: 'w-full',
    socialButtons: 'flex flex-col gap-3',
    socialButtonsBlockButton: socialButton,
    socialButtonsBlockButtonText: 'text-[15px] font-extrabold text-ink normal-case',
    socialButtonsBlockButtonArrow: 'hidden',
    socialButtonsProviderIcon: 'h-5 w-5',

    // "ou"
    dividerRow: 'flex items-center gap-3',
    dividerLine: 'h-0.5 flex-1 bg-line',
    dividerText: 'text-xs font-extrabold uppercase tracking-wider text-muted',

    // formulário de email
    form: 'flex flex-col gap-4',
    formFieldRow: 'flex flex-col gap-4',
    formField: 'flex flex-col gap-2',
    formFieldLabelRow: 'flex items-center justify-between',
    formFieldLabel: 'text-xs font-extrabold uppercase tracking-wider text-muted mb-0.5',
    formFieldInput: input,
    formFieldInputShowPasswordButton: 'text-muted hover:text-ink',
    formFieldErrorText: 'mt-1 text-sm font-bold text-danger',
    formFieldHintText: 'text-xs font-semibold text-muted',
    formFieldAction: 'text-xs font-extrabold text-accent',
    formButtonPrimary: primaryButton,
    buttonArrowIcon: 'hidden',

    // código enviado por email
    otpCodeField: 'flex flex-col items-center gap-3',
    otpCodeFieldInputs: 'flex justify-center gap-2',
    otpCodeFieldInput:
      'h-14 w-12 rounded-xl border-2 border-b-4 border-line bg-snow text-center text-2xl font-black text-ink outline-none focus:border-accent focus:bg-white',
    formResendCodeLink: 'text-sm font-extrabold text-accent',

    // email escolhido, "voltar", alternativas, avisos
    identityPreview: 'flex items-center justify-center gap-2 rounded-xl bg-snow px-4 py-2.5',
    identityPreviewText: 'text-sm font-bold text-body',
    identityPreviewEditButton: 'text-accent',
    backLink: 'text-sm font-extrabold text-accent',
    alternativeMethods: 'flex flex-col gap-3',
    alternativeMethodsBlockButton: socialButton,
    alert: 'rounded-xl border-2 border-danger/30 bg-danger-light px-4 py-3',
    alertText: 'text-sm font-bold text-danger',

    // rodapé (marca do Clerk e aviso de modo de desenvolvimento): discreto
    footer: 'mt-1 flex flex-col items-center gap-1 border-0 bg-none bg-transparent text-xs text-muted shadow-none [&_*]:bg-transparent',
    footerItem: 'bg-transparent',
    footerAction: 'flex items-center justify-center gap-1 text-sm font-semibold text-muted',
    footerActionLink: 'font-extrabold text-accent',
  },
}
