import { useId } from 'react';

export function SproutLogo({ className = '', ...props }) {
  return <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true" {...props}>
    <rect width="40" height="40" rx="13" fill="#356749" />
    <path d="M20 29V19" stroke="#f2f0d4" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M20 22C9 22 9 13 10 11C20 10 24 17 20 22Z" fill="#b6ce92" />
    <path d="M21 20C21 10 29 8 32 9C33 19 27 23 21 20Z" fill="#e3e9bc" />
    <path d="M20 22L14 16M21 20L27 14" stroke="#356749" strokeWidth="1.1" strokeLinecap="round" opacity=".5" />
  </svg>;
}

export function WateringCan({ className = '', ...props }) {
  return <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" {...props}>
    <path d="M44 27Q63 18 59 38Q56 47 44 45" stroke="#75988a" strokeWidth="5" />
    <path d="M22 32L12 22L7 26L21 45" fill="#87aa9b" />
    <path d="M19 28H46L48 51Q47 56 42 57H24Q18 56 18 51Z" fill="#9fbdab" />
    <path d="M22 29V23Q32 11 43 24V29" stroke="#75988a" strokeWidth="4" />
    <path d="M22 34V49Q22 52 25 52" stroke="#cbd8bb" strokeWidth="3" strokeLinecap="round" />
    <path d="M6 18L15 25L8 31L1 23Z" fill="#769b8c" />
    <path d="M3 35L1 39M7 39L5 43M12 42L10 46" stroke="#a5c6d0" strokeWidth="2" strokeLinecap="round" />
    <path d="M33 39C26 35 27 45 33 46C40 43 40 35 33 39Z" fill="#e4e5bd" />
  </svg>;
}

export function GardenBackdrop({ className = '', theme = 'sunshine', ...props }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const night = theme === 'moonlight';
  const golden = theme === 'sunset' || theme === 'evening';
  const colors = night ? {
    sky: '#263e53', horizon: '#60777c', lawn: '#516c54', lawnBottom: '#3d5948',
    hill: '#6b8272', nearHill: '#5b7763', fence: '#9ba58a', tree: '#4b7059', treeLight: '#658366',
    trunk: '#7f8c70', grass: '#90a57b', flower: '#d8e0bb', cloud: '#adbdc4',
  } : golden ? {
    sky: '#f3d5bb', horizon: '#f8e7c7', lawn: '#e1dfb7', lawnBottom: '#cfd4a5',
    hill: '#d7d2ab', nearHill: '#c7cca1', fence: '#fff1cf', tree: '#b7c493', treeLight: '#d4d2a1',
    trunk: '#b2a180', grass: '#a9b781', flower: '#fff1c7', cloud: '#fff2df',
  } : {
    sky: '#e4efe8', horizon: '#f5f3dc', lawn: '#dce8c9', lawnBottom: '#cbdcb1',
    hill: '#cedfc2', nearHill: '#bdd3ae', fence: '#f8f4df', tree: '#accb9b', treeLight: '#ccddb2',
    trunk: '#aca986', grass: '#9eb888', flower: '#fff9df', cloud: '#fffdf2',
  };
  return <svg viewBox="0 0 1100 700" preserveAspectRatio="xMidYMin slice" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={colors.sky} /><stop offset="1" stopColor={colors.horizon} /></linearGradient>
      <linearGradient id={`grass-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={colors.lawn} /><stop offset="1" stopColor={colors.lawnBottom} /></linearGradient>
      <mask id={`moon-${id}`}><rect width="1100" height="700" fill="white" /><circle cx="960" cy="64" r="29" fill="black" /></mask>
    </defs>
    <path d="M0 0H1100V700H0Z" fill={`url(#sky-${id})`} />
    <g className="scenery-clouds" fill={colors.cloud} opacity={night ? '.12' : '.62'}><path d="M144 103c-19 0-20-23-3-27c-4-21 27-30 39-13c13-7 28 2 27 15c22-2 27 25 5 25Z" /><path d="M658 71c-15 0-19-17-6-23c-2-17 23-23 32-10c14-8 29 3 26 15c17-1 21 18 4 18Z" /><path d="M846 141c-12 0-15-14-5-19c-2-15 19-20 27-9c11-6 24 2 21 13c15-1 18 15 3 15Z" /></g>
    {night ? <g><circle cx="948" cy="77" r="48" fill="#e8e7c5" opacity=".07" /><circle cx="948" cy="77" r="34" fill="#f4edd0" mask={`url(#moon-${id})`} /><g className="scenery-stars" fill="#e3e8cb"><path d="M327 54l1.8 5.2 5.2 1.8-5.2 1.8L327 68l-1.8-5.2L320 61l5.2-1.8Z" /><path d="M764 100l1.3 3.7 3.7 1.3-3.7 1.3L764 110l-1.3-3.7L759 105l3.7-1.3Z" /><circle cx="450" cy="38" r="1.5" /><circle cx="510" cy="114" r="1.2" /><circle cx="221" cy="144" r="1.7" /><circle cx="860" cy="36" r="1.2" /><circle cx="1035" cy="124" r="1.7" /><circle cx="566" cy="62" r="1.5" /></g></g> : <g transform={golden ? 'translate(0 40)' : undefined}><circle cx="948" cy="77" r={golden ? '61' : '49'} fill={golden ? '#efb17c' : '#eddb94'} opacity=".18" /><circle cx="948" cy="77" r="33" fill={golden ? '#eba269' : '#efcf71'} opacity=".8" /><g stroke={golden ? '#e8ac73' : '#e6c66d'} strokeWidth="2.5" strokeLinecap="round" opacity=".6"><path d="M948 29V21M948 126V133M900 77H892M997 77H1005M914 43L908 37M982 111L988 117M914 111L908 117M982 43L988 37" /></g></g>}
    <path d="M0 206Q165 116 345 204Q521 112 726 199Q900 112 1100 196V700H0Z" fill={colors.hill} opacity=".63" />
    <path d="M0 231Q173 186 353 243Q570 163 784 223Q954 174 1100 225V700H0Z" fill={colors.nearHill} opacity=".65" />
    <g stroke={colors.fence} strokeWidth="6" opacity={night ? '.38' : '.8'}><path d="M0 244H1100M0 271H1100" />{Array.from({length:38}, (_,i)=><path key={i} d={`M${i*31-5} 282V226l7-7 7 7v56`} fill={colors.fence} strokeWidth="1" />)}</g>
    <path d="M0 283Q280 269 530 283T1100 282V700H0Z" fill={`url(#grass-${id})`} />
    <g opacity=".55" fill={colors.nearHill}><ellipse cx="44" cy="279" rx="66" ry="20" /><ellipse cx="1046" cy="284" rx="89" ry="23" /></g>
    <g transform="translate(-35 100)"><path d="M61 180Q69 115 63 63" stroke={colors.trunk} strokeWidth="12" fill="none" /><path d="M64 133L32 104M65 110L94 82" stroke={colors.trunk} strokeWidth="7" fill="none" /><path d="M-10 98C-41 47 7 17 42 27C38-16 110-12 118 29C167 33 163 93 122 105C81 134 13 132-10 98Z" fill={colors.tree} /><path d="M13 65Q50 88 87 48" stroke={colors.treeLight} strokeWidth="35" strokeLinecap="round" fill="none" opacity=".4" /></g>
    <g transform="translate(1072 126)"><path d="M7 161V74" stroke={colors.trunk} strokeWidth="9" /><path d="M-43 69C-66 18-19-7 7 14C32-20 74 3 71 38C105 61 83 105 49 101C11 121-38 106-43 69Z" fill={colors.tree} /><path d="M-25 50Q0 71 33 41" stroke={colors.treeLight} strokeWidth="25" strokeLinecap="round" fill="none" opacity=".45" /></g>
    <g stroke={colors.grass} strokeWidth="2" strokeLinecap="round" opacity=".5"><path d="M24 355l-4-8m5 8l4-11M1071 390l-4-8m5 8l4-11M53 523l-4-8m5 8l4-11M1037 554l-4-8m5 8l4-11M351 654l-4-8m5 8l4-11M776 601l-4-8m5 8l4-11M275 325l-4-8m5 8l4-11M819 332l-4-8m5 8l4-11" /></g>
    {!night && <g className="scenery-butterflies"><g transform="translate(224 170) rotate(-17)" opacity=".8"><path d="M0 0C-17-25-27-2-7 6C-22 14-4 22 0 7C6 23 22 12 8 6C29-4 13-24 0 0Z" fill="#e6b788" /><path d="M0 0V11" stroke="#b39d75" strokeWidth="2" strokeLinecap="round" /></g><g transform="translate(806 229) rotate(19) scale(.65)" opacity=".8"><path d="M0 0C-17-25-27-2-7 6C-22 14-4 22 0 7C6 23 22 12 8 6C29-4 13-24 0 0Z" fill="#dbc2da" /><path d="M0 0V11" stroke="#a495a5" strokeWidth="2" strokeLinecap="round" /></g></g>}
    {night && <g className="scenery-fireflies" fill="#eff1af"><circle cx="224" cy="320" r="2" /><circle cx="782" cy="370" r="2.5" /><circle cx="905" cy="507" r="1.5" /><circle cx="149" cy="529" r="1.6" /></g>}
    <g fill={colors.flower} opacity=".8"><circle cx="29" cy="448" r="3" /><circle cx="1049" cy="485" r="3" /><circle cx="88" cy="657" r="2" /><circle cx="1001" cy="655" r="2.5" /><circle cx="540" cy="672" r="2" /></g>
  </svg>;
}
