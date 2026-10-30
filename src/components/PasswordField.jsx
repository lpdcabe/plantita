import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordField({ label, value, onChange, disabled = false, current = false }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="field"><label htmlFor={id} className="label">{label}</label><div className="password-field-input"><input id={id} className="input" type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} required minLength={current ? undefined : 12} maxLength={current ? undefined : 128} autoComplete={current ? 'current-password' : 'new-password'} disabled={disabled} /><button type="button" className="icon-button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(value => !value)} disabled={disabled}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>;
}
