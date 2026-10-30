import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sprout, X } from 'lucide-react';

export function Progress({ value, max, className = '', label = 'Progress' }) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeValue = Math.min(safeMax, Math.max(0, Number(value) || 0));
  return <div className={`progress ${className}`} role="progressbar" aria-label={label} aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={safeMax}><span style={{ width: `${safeValue / safeMax * 100}%` }} /></div>;
}
export function Empty({ title, text, children }) {
  return <div className="empty-state"><span className="empty-illustration"><Sprout size={38} /></span><h3>{title}</h3><p>{text}</p>{children}</div>;
}

export function Toast({ message, onDismiss }) {
  const [host, setHost] = useState(() => document.fullscreenElement || document.body);
  useEffect(() => {
    const updateHost = () => setHost(document.fullscreenElement || document.body);
    document.addEventListener('fullscreenchange', updateHost);
    return () => document.removeEventListener('fullscreenchange', updateHost);
  }, []);
  return createPortal(<div className="toast" role="status"><span><Sprout size={19} /></span><p>{message}</p><button aria-label="Dismiss notification" onClick={onDismiss}><X size={18} /></button></div>, host);
}
