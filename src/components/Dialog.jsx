import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Dialog({ title, subtitle, children, onClose, wide = false }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef(null);
  const [portalHost, setPortalHost] = useState(() => document.fullscreenElement || document.body);
  const titleId = useId();
  const subtitleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    function updatePortalHost() { setPortalHost(document.fullscreenElement || document.body); }
    document.addEventListener('fullscreenchange', updatePortalHost);
    return () => document.removeEventListener('fullscreenchange', updatePortalHost);
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      const previousFocus = previousFocusRef.current;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const visibleControls = () => Array.from(dialog.querySelectorAll(FOCUSABLE)).filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
    const firstField = dialog.querySelector('[data-autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled])');
    (firstField || visibleControls()[0] || dialog).focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = visibleControls();
      if (!controls.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      const outside = !dialog.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside || document.activeElement === dialog)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [portalHost]);

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section
        ref={dialogRef}
        className={`dialog-card${wide ? ' dialog-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
      >
        <header className="dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p id={subtitleId}>{subtitle}</p>}
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close dialog"><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="dialog-body">{children}</div>
      </section>
    </div>, portalHost
  );
}
