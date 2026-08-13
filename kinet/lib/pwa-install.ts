export interface KinetInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let savedPrompt: KinetInstallPrompt | null = null;

export function saveInstallPrompt(event: KinetInstallPrompt | null) {
  savedPrompt = event;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("kinet:install-prompt", { detail: event }));
}

export function getInstallPrompt() {
  return savedPrompt;
}
