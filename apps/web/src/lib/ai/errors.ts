import { cannedMessagesFor } from './canned-messages';

/**
 * Error classification for the Puter AI transport (spec 004 AI surface).
 *
 * These classifiers turn opaque SDK/network failures into the small set of
 * decisions the assistant actually needs: retry, fall back to another
 * model, ask the user to sign in, or open the circuit breaker.
 */

export const asErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message || error.name || 'Error';
  }

  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const rec = error as Record<string, unknown>;
    const parts: string[] = [];

    const pushIfString = (v: unknown) => {
      if (typeof v === 'string' && v.trim()) parts.push(v);
    };

    pushIfString(rec.message);
    pushIfString(rec.reason);
    pushIfString(rec.error);
    pushIfString(rec.type);
    pushIfString(rec.code);

    // Some libraries nest the real error at `error` or `data`
    if (rec.error && typeof rec.error === 'object') {
      const inner = rec.error as Record<string, unknown>;
      pushIfString(inner.message);
      pushIfString(inner.reason);
      pushIfString(inner.code);
      pushIfString(inner.type);
    }
    if (rec.data && typeof rec.data === 'object') {
      const inner = rec.data as Record<string, unknown>;
      pushIfString(inner.message);
      pushIfString(inner.reason);
      pushIfString(inner.code);
      pushIfString(inner.type);
    }

    if (parts.length > 0) return parts.join(' | ');

    // Last resort: safe JSON preview (avoids [object Object])
    try {
      const json = JSON.stringify(error);
      if (typeof json === 'string' && json.length > 0) return json.slice(0, 500);
    } catch {
      // ignore
    }
  }

  return String(error);
};

export const isPuterModelNotAvailableError = (error: unknown) => {
  const msg = asErrorMessage(error).toLowerCase();
  return (
    (msg.includes('model') && msg.includes('does not exist')) ||
    msg.includes('you do not have access to it') ||
    msg.includes('error_400_from_delegate') ||
    (msg.includes('delegate') && msg.includes('404'))
  );
};

export const isPuterInsufficientFundsError = (error: unknown) => {
  const msg = asErrorMessage(error).toLowerCase();
  return (
    msg.includes('insufficient_funds') ||
    msg.includes('no usage left') ||
    msg.includes('payment required') ||
    msg.includes('insufficient balance')
  );
};

export const isPuterAuthError = (error: unknown) => {
  const msg = asErrorMessage(error).toLowerCase();
  return (
    msg.includes('not signed in') ||
    msg.includes('not signed') ||
    msg.includes('signed in') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('auth')
  );
};

export const isClaudeLikeModel = (model?: string) => {
  const m = (model || '').toLowerCase();
  return (
    m.includes('claude') ||
    m.includes('opus') ||
    m.includes('sonnet') ||
    m.includes('haiku') ||
    m.includes('o1-') ||
    m.includes('o3-') ||
    m.includes('gpt-4o')
  );
};

export const isPuterTransportError = (error: unknown) => {
  const msg = asErrorMessage(error).toLowerCase();

  if (isPuterModelNotAvailableError(error)) return false;

  return (
    msg.includes('socket.io') ||
    msg.includes('engine.io') ||
    msg.includes('websocket') ||
    msg.includes('polling') ||
    msg.includes('transport') ||
    msg.includes('eio=') ||
    msg.includes('websocket is closed') ||
    msg.includes('network') ||
    msg.includes('closed before the connection') ||
    msg.includes('failed to fetch') ||
    msg.includes('connection error') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('disconnected')
  );
};

export const formatPuterNeedsLoginMessage = (model?: string, locale?: string) => {
  const modelSuffix = model ? ` (${model})` : '';
  // The __PUTER_AUTH_REQUIRED__ sentinel is parsed upstream - keep it literal.
  return cannedMessagesFor(locale).needsLogin.replace('{modelSuffix}', modelSuffix);
};
