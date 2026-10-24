/**
 * A app não guarda nada no browser: tudo vive na conta, no servidor.
 * Ao arrancar, apaga o que versões anteriores tenham deixado no localStorage/sessionStorage.
 */
export function clearBrowserStorage() {
  try {
    localStorage.clear()
  } catch { /* armazenamento indisponível */ }
  try {
    sessionStorage.clear()
  } catch { /* armazenamento indisponível */ }
}
