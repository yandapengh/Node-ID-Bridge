import type {
  PluginToUiMessage,
  UiToPluginMessage
} from "../shared/types";

export type StatusTone = "neutral" | "success" | "error";

export function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Missing UI element: ${id}`);
  }
  return element as T;
}

export function setStatus(
  element: HTMLElement,
  message: string,
  tone: StatusTone
): void {
  element.textContent = message;
  element.dataset.tone = tone;
}

export function postToPlugin(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

export function receivePluginMessage(
  data: unknown
): PluginToUiMessage | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const envelope = data as { pluginMessage?: unknown };
  if (
    typeof envelope.pluginMessage !== "object" ||
    envelope.pluginMessage === null
  ) {
    return null;
  }
  return envelope.pluginMessage as PluginToUiMessage;
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText !== undefined) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Continue to the document.execCommand fallback below.
    }
  }

  const fallbackInput = document.createElement("textarea");
  fallbackInput.value = text;
  fallbackInput.setAttribute("readonly", "");
  fallbackInput.style.position = "fixed";
  fallbackInput.style.opacity = "0";
  fallbackInput.style.pointerEvents = "none";
  document.body.append(fallbackInput);
  fallbackInput.select();
  fallbackInput.setSelectionRange(0, fallbackInput.value.length);

  const copied = document.execCommand("copy");
  fallbackInput.remove();
  if (!copied) {
    throw new Error("Clipboard access was denied.");
  }
}
