/**
 * A app não guarda nada no browser: tudo vive na conta, no servidor.
 * Ao arrancar, apaga o que versões anteriores tenham deixado no localStorage/sessionStorage.
 * As chaves do Clerk ficam: apagá-las a meio da sessão fazia-o perder o estado do login.
 */
export function clearBrowserStorage() {
  for (const get of [() => localStorage, () => sessionStorage]) {
    try {
      const store = get()
      Object.keys(store)
        .filter(k => !/clerk/i.test(k))
        .forEach(k => store.removeItem(k))
    } catch { /* armazenamento indisponível */ }
  }
}
