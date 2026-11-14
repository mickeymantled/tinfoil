import { useEffect, useRef, useState } from 'react';
import { config, isPlaceholder } from '../../config';

/** Clipboard API first; hidden-textarea + execCommand fallback for in-app browsers. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    ta.style.fontSize = '16px'; // stops iOS from zooming
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ContractAddress() {
  const address = config.contractAddress;
  const pending = isPlaceholder(address);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onCopy = async () => {
    if (pending) return;
    const ok = await copyText(address);
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };

  return (
    <div className="home-ca">
      <p className="home-ca__label">
        CONTRACT ADDRESS <span className="text-phosphor-dim">// {config.chain.toUpperCase()}</span>
      </p>
      <div className="home-ca__row">
        {pending ? (
          <p className="home-ca__pending">
            <span className="home-ca__bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="home-ca__pending-text">ADDRESS PENDING DECLASSIFICATION</span>
          </p>
        ) : (
          <code className="home-ca__value">{address}</code>
        )}
        <button
          type="button"
          className="btn btn-amber btn-sm home-ca__copy"
          onClick={onCopy}
          disabled={pending}
          aria-label={pending ? 'Copy contract address (not available yet)' : 'Copy contract address'}
        >
          {state === 'copied' ? 'COPIED' : state === 'failed' ? 'COPY FAILED' : 'COPY'}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {state === 'copied' ? 'Contract address copied to clipboard' : state === 'failed' ? 'Copy failed. Select the address and copy it manually.' : ''}
      </p>
    </div>
  );
}
