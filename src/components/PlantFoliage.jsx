// A single solid plant develops in place. Maturity is animated only toward an
// already earned stage; height comes from the continuously earned point total.
const clamp = value => Math.max(0, Math.min(1, value));
const phase = (maturity, start) => clamp(maturity - start);
const mix = (from, to, progress) => from + (to - from) * progress;
function at(maturity, values) {
  const stage = Math.min(3, Math.floor(maturity));
  return mix(values[stage], values[stage + 1], maturity - stage);
}
const yAt = (height, fraction) => 145 - height * fraction;

function Leaf({ x, y, flip = false, size = 1, fill = '#6e9d63', angle = 0 }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${flip ? -size : size} ${size})`}>
    <path d="M0 0C-8-17-31-23-40-18C-35 2-16 10 0 0Z" fill={fill} />
    <path d="M-2-1Q-18-11-33-14" fill="none" stroke="#426f48" strokeWidth="1.4" strokeLinecap="round" opacity=".32" />
  </g>;
}

function Blossom({ x, y, kind = 'sunflower', size = 1 }) {
  const daisy = kind === 'daisy';
  const petals = daisy ? 10 : 12;
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    {Array.from({ length: petals }, (_, i) => <ellipse key={i} cx="0" cy="-19" rx={daisy ? 6.6 : 7.1} ry={daisy ? 15 : 14} transform={`rotate(${i * 360 / petals})`} fill={daisy ? (i % 2 ? '#fffdf3' : '#f3f1db') : (i % 2 ? '#eeb940' : '#f6ce62')} />)}
    <circle r={daisy ? 10 : 14} fill={daisy ? '#ebbd58' : '#9b7246'} />
    <circle r={daisy ? 7 : 10.5} fill={daisy ? '#f7d572' : '#b28a51'} />
    {!daisy && <g fill="#82613e" opacity=".48">{[[-4,-4],[3,-5],[-6,2],[0,1],[6,1],[-2,6],[4,6]].map(([cx,cy], i) => <circle key={i} cx={cx} cy={cy} r="1.3" />)}</g>}
  </g>;
}

function Tulip({ x, y, size }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    <path d="M-23-22C-26 9-15 25 0 27C17 24 26 7 23-22L10-12L0-27L-11-12Z" fill="#de8f9e" />
    <path d="M-23-22C-22 6-10 23 0 27C5 6 1-13-11-12Z" fill="#ecacb5" />
    <path d="M0 27C17 24 26 7 23-22C7-13 2 4 0 27" fill="#d87e91" />
  </g>;
}

function Flower({ type, maturity: m, height: h }) {
  const top = yAt(h, .72);
  const size = at(m, [.34, .53, .65, .82, .9]);
  const flowerSize = at(m, [0, 0, .7, .9, 1.02]);
  const extra = phase(m, 3);
  const branchBase = yAt(h, .12);
  const branchX = mix(80, 114, extra);
  const branchY = mix(branchBase, yAt(h, .52), extra);
  return <g>
    <path d={`M80 145Q77 ${yAt(h, .36)} 80 ${top}`} stroke="#638855" strokeWidth={at(m, [3, 3.6, 4.2, 4.6, 5])} strokeLinecap="round" fill="none" />
    <Leaf x="79" y={yAt(h, .24)} size={size} />
    <Leaf x="80" y={yAt(h, .43)} size={size * .93} flip fill="#93b573" />
    <Leaf x="80" y={yAt(h, .61)} size={at(m, [0,.25,.35,.5,.55])} />
    <path d={`M80 ${branchBase}Q${mix(80,100,extra)} ${mix(branchBase,yAt(h,.33),extra)} ${branchX} ${branchY}`} stroke="#70965b" strokeWidth={3 * extra} fill="none" />
    <Leaf x={mix(80,101,extra)} y={mix(branchBase,yAt(h,.3),extra)} flip size={.4 * extra} fill="#a3be7c" />
    {type === 'tulip' ? <><Tulip x="80" y={top} size={flowerSize} /><Tulip x={branchX} y={branchY} size={.55 * extra} /></> : <><Blossom x="80" y={top} kind={type} size={flowerSize} /><Blossom x={branchX} y={branchY} kind={type} size={.55 * extra} /></>}
  </g>;
}

function HibiscusBloom({ x, y, size }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    {[0,72,144,216,288].map((angle, index) => <g key={angle} transform={`rotate(${angle})`}>
      <path d="M0 5C-11-2-28-12-23-25C-20-35-8-34-1-28C6-36 21-32 24-23C28-9 10 1 0 5Z" fill={index % 2 ? '#e992a0' : '#e37f92'} />
      <path d="M0 3Q-4-11-1-26M0 2Q-10-8-17-20" stroke="#f3b5b6" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </g>)}
    <circle r="8" fill="#bd546f" />
    <circle r="4.5" fill="#a74761" />
    <path d="M1 3Q8-13 12-34" stroke="#f0c76d" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    <g fill="#f6db83">{[[8,-14],[13,-18],[10,-22],[15,-26],[12,-29]].map(([cx,cy], index) => <circle key={index} cx={cx} cy={cy} r="2.3" />)}</g>
    <g fill="#bd536b"><circle cx="10" cy="-35" r="2.5" /><circle cx="15" cy="-34" r="2.4" /><circle cx="13" cy="-38" r="2.4" /></g>
  </g>;
}

function HibiscusLeaf({ x, y, size, flip = false }) {
  return <g transform={`translate(${x} ${y}) scale(${flip ? -size : size} ${size})`}>
    <path d="M0 0C-8-20-25-29-40-25L-35-18L-40-14L-32-10L-34-4L-25-3L-25 3C-14 8-5 5 0 0Z" fill="#6f9b65" />
    <path d="M-2-1L-34-21M-13-8L-16 0M-23-14L-26-5" stroke="#aac587" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </g>;
}

function Hibiscus({ maturity: m, height: h }) {
  const top = yAt(h, .7);
  const leaf = at(m,[.24,.38,.55,.68,.76]);
  const extra = phase(m, 3);
  const base = yAt(h,.23);
  const x = mix(80,116,extra), y = mix(base,yAt(h,.5),extra);
  return <g>
    <path d={`M80 145Q75 ${yAt(h,.35)} 80 ${top}`} stroke="#638557" strokeWidth={at(m,[2.8,3.4,4,4.6,5])} strokeLinecap="round" fill="none" />
    <HibiscusLeaf x="79" y={yAt(h,.23)} size={leaf} />
    <HibiscusLeaf x="80" y={yAt(h,.45)} size={leaf * .9} flip />
    <HibiscusLeaf x="80" y={yAt(h,.6)} size={.37 * phase(m,1)} />
    <path d={`M80 ${base}Q${mix(80,105,extra)} ${mix(base,yAt(h,.28),extra)} ${x} ${y}`} stroke="#638557" strokeWidth={3 * extra} fill="none" />
    <HibiscusBloom x="80" y={top} size={at(m,[0,0,.6,.83,.94])} />
    <HibiscusBloom x={x} y={y} size={.43 * extra} />
  </g>;
}

function RoseBloom({ x, y, size }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    <path d="M-6-22C4-33 18-28 21-19C34-13 32 1 24 8C24 23 9 30 0 24C-13 32-27 22-25 11C-37 1-29-15-19-17C-17-27-10-29-6-22Z" fill="#ca6b81" />
    <path d="M-19-15Q-1-28 10-15Q27-15 24 0Q24 13 11 16Q0 27-13 16Q-29 10-24-3Z" fill="#e194a3" />
    <path d="M-21 1Q-14-16 1-15Q-3-2-21 1M1-15Q18-21 22-4Q13 2 1-15M22-4Q27 13 9 18Q8 5 22-4M9 18Q-10 27-19 10Q-7 9 9 18" fill="#d77d94" />
    <path d="M-10-5C-5-16 10-14 14-4C20 6 8 16 0 12C-12 15-18 0-10-5Z" fill="#bf5a76" />
    <path d="M-8-5Q3-13 10-3Q0-3-5 5Q6 11 10 4" stroke="#f0b3bd" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M-3-1Q3-6 5 0Q7 5 1 6" stroke="#e391a4" strokeWidth="2.3" strokeLinecap="round" fill="none" />
  </g>;
}

function Rose({ maturity: m, height: h }) {
  const top = yAt(h,.72);
  const leaf = at(m,[.25,.4,.57,.67,.75]);
  const extra = phase(m,3);
  const base = yAt(h,.21);
  const x = mix(80,113,extra), y = mix(base,yAt(h,.48),extra);
  return <g>
    <path d={`M80 145Q76 ${yAt(h,.38)} 80 ${top}`} stroke="#5e8258" strokeWidth={at(m,[2.8,3.4,4,4.6,5])} strokeLinecap="round" fill="none" />
    <Leaf x="79" y={yAt(h,.25)} size={leaf} fill="#5d8a5b" />
    <Leaf x="80" y={yAt(h,.44)} size={leaf * .9} flip fill="#85a86a" />
    <Leaf x="80" y={yAt(h,.58)} size={.4 * phase(m,1)} fill="#6e975d" />
    <path d={`M78 ${yAt(h,.17)}l${-5*phase(m,1)} ${-3*phase(m,1)}M81 ${yAt(h,.35)}l${5*phase(m,1)} ${-3*phase(m,1)}`} stroke="#789160" strokeWidth={1.5 * phase(m,1)} fill="none" />
    <path d={`M80 ${base}Q${mix(80,102,extra)} ${mix(base,yAt(h,.3),extra)} ${x} ${y}`} stroke="#5e8258" strokeWidth={3 * extra} fill="none" />
    <RoseBloom x="80" y={top} size={at(m,[0,0,.62,.85,1])} />
    <RoseBloom x={x} y={y} size={.47 * extra} />
  </g>;
}

function MarigoldBloom({ x, y, size }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    {Array.from({ length: 14 }, (_, index) => <path key={index} transform={`rotate(${index * 360 / 14})`} d="M-5-14C-12-20-11-28-6-29C-4-34 2-33 4-29C11-28 12-20 5-14Z" fill={index % 2 ? '#eea83b' : '#e89135'} />)}
    <circle r="22" fill="#efa83a" />
    {Array.from({ length: 11 }, (_, index) => <path key={index} transform={`rotate(${index * 360 / 11 + 13})`} d="M-4-7C-11-12-10-21-5-22C-3-26 3-25 5-21C11-18 9-11 4-7Z" fill={index % 2 ? '#f5c254' : '#f4b443'} />)}
    <circle r="13" fill="#eaa038" />
    {Array.from({ length: 8 }, (_, index) => <ellipse key={index} cy="-8" rx="4.4" ry="7" transform={`rotate(${index * 45 + 9})`} fill={index % 2 ? '#f9d16b' : '#f6c354'} />)}
    <circle r="5" fill="#f4bd4b" /><path d="M-2 0Q0-5 3-1M-2 3Q1 0 3 3" stroke="#ffe29a" strokeWidth="1.7" fill="none" strokeLinecap="round" />
  </g>;
}

function FeatherLeaf({ x, y, size, flip = false }) {
  return <g transform={`translate(${x} ${y}) scale(${flip ? -size : size} ${size})`}>
    <path d="M0 0L-35-22" stroke="#6e955b" strokeWidth="2" strokeLinecap="round" />
    {[.24,.46,.68,.87].map((fraction,index) => <g key={index} transform={`translate(${-35*fraction} ${-22*fraction})`}>
      <path d="M0 0Q-13-1-14-8Q-3-10 0 0" fill="#80a266" />
      <path d="M0 0Q-2-13 4-15Q11-5 0 0" fill="#94b478" />
    </g>)}
  </g>;
}

function Marigold({ maturity: m, height: h }) {
  const top = yAt(h,.71);
  const leaf = at(m,[.2,.32,.48,.58,.65]);
  const extra = phase(m,3);
  const base = yAt(h,.24);
  const x = mix(80,115,extra), y = mix(base,yAt(h,.48),extra);
  return <g>
    <path d={`M80 145Q77 ${yAt(h,.4)} 80 ${top}`} stroke="#6b8d55" strokeWidth={at(m,[2.7,3.3,3.9,4.5,4.8])} strokeLinecap="round" fill="none" />
    <FeatherLeaf x="79" y={yAt(h,.2)} size={leaf} />
    <FeatherLeaf x="80" y={yAt(h,.37)} size={leaf * .92} flip />
    <FeatherLeaf x="79" y={yAt(h,.55)} size={.38 * phase(m,1)} />
    <path d={`M80 ${base}Q${mix(80,105,extra)} ${mix(base,yAt(h,.3),extra)} ${x} ${y}`} stroke="#6b8d55" strokeWidth={3 * extra} fill="none" />
    <MarigoldBloom x="80" y={top} size={at(m,[0,0,.6,.84,1])} />
    <MarigoldBloom x={x} y={y} size={.46 * extra} />
  </g>;
}

function BonsaiCanopy({ x, y, size, fill = '#6e9465', light = '#94b37a' }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    <path d="M-38 8C-45-3-34-13-24-12C-25-24-10-28-2-20C7-31 24-25 24-14C40-16 47-3 38 8Q22 17 0 13Q-24 18-38 8Z" fill={fill} />
    <path d="M-31-4Q-26-12-15-10Q-15-21-4-15Q7-24 16-14Q27-17 33-7Q18-3 5-6Q-11-2-31-4Z" fill={light} />
    <path d="M-20 9Q-7 5 3 9M13 5Q22 3 29 5" stroke="#577d52" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".4" />
  </g>;
}

function Bonsai({ maturity: m, height: h }) {
  const top = yAt(h,.77);
  const thickness = at(m,[2.8,4.2,7,10,12]);
  const left = phase(m,1), right = phase(m,2);
  const baseLeft = yAt(h,.3), baseRight = yAt(h,.49);
  const lx = mix(80,43,left), ly = mix(baseLeft,yAt(h,.48),left);
  const rx = mix(76,115,right), ry = mix(baseRight,yAt(h,.64),right);
  return <g>
    <path d={`M80 145C${mix(80,98,phase(m,0))} ${yAt(h,.21)} ${mix(80,59,phase(m,0))} ${yAt(h,.4)} 76 ${yAt(h,.58)}Q85 ${yAt(h,.68)} 80 ${top}`} stroke="#987a59" strokeWidth={thickness} strokeLinecap="round" fill="none" />
    <path d={`M80 144C${mix(80,94,phase(m,0))} ${yAt(h,.21)} ${mix(80,63,phase(m,0))} ${yAt(h,.4)} 77 ${yAt(h,.58)}`} stroke="#b79a70" strokeWidth={thickness * .25} strokeLinecap="round" fill="none" />
    <path d={`M80 ${baseLeft}Q${mix(80,58,left)} ${mix(baseLeft,yAt(h,.32),left)} ${lx} ${ly}`} stroke="#987a59" strokeWidth={6 * left} strokeLinecap="round" fill="none" />
    <path d={`M76 ${baseRight}Q${mix(76,100,right)} ${mix(baseRight,yAt(h,.5),right)} ${rx} ${ry}`} stroke="#987a59" strokeWidth={5 * right} strokeLinecap="round" fill="none" />
    <BonsaiCanopy x={lx} y={ly} size={at(m,[0,0,.5,.66,.73])} fill="#62885b" light="#88a66c" />
    <BonsaiCanopy x={rx} y={ry} size={.65 * right} fill="#789b6b" light="#a0b982" />
    <BonsaiCanopy x="80" y={top} size={at(m,[.12,.27,.48,.68,.85])} />
    <path d={`M80 145L${80-10*phase(m,3)} 145M80 145L${80+10*phase(m,3)} 145`} stroke="#987a59" strokeWidth={3 * phase(m,3)} strokeLinecap="round" />
  </g>;
}

function Cactus({ maturity: m, height: h }) {
  const width = at(m, [2.2, 3, 14, 18, 19]);
  const top = yAt(h, .72);
  const spread = at(m, [10,15,27,37,39]);
  const armWidth = at(m, [2.3,3.3,8,13,15]);
  const spine = phase(m, 1);
  const bloom = at(m, [0,0,0,.47,.55]);
  return <g>
    <path d={`M${80-width} 145V${top+width}Q${80-width} ${top} 80 ${top}Q${80+width} ${top} ${80+width} ${top+width}V145Z`} fill="#80a883" />
    <path d={`M80 ${yAt(h,.25)}H${80-spread+5}Q${80-spread} ${yAt(h,.25)} ${80-spread} ${yAt(h,.32)}V${yAt(h,.49)}`} stroke="#80a883" strokeWidth={armWidth} strokeLinecap="round" fill="none" />
    <path d={`M80 ${yAt(h,.35)}H${80+spread-4}Q${80+spread} ${yAt(h,.35)} ${80+spread} ${yAt(h,.42)}V${yAt(h,.61)}`} stroke="#91b48e" strokeWidth={armWidth * .9} strokeLinecap="round" fill="none" />
    <path d={`M80 143V${top+width*.45}`} stroke="#bed0a1" strokeWidth={at(m,[1,1.5,3,3.8,4])} strokeLinecap="round" />
    <path d={`M${80+width*.6} 143V${top+width}`} stroke="#62916e" strokeWidth={2.5 * spine} strokeLinecap="round" opacity=".6" />
    <g stroke="#f2ead1" strokeWidth={1.5 * spine} strokeLinecap="round">{[.18,.36,.55].map((fraction, index) => <path key={index} d={`M${80-width*.65} ${yAt(h,fraction)}l${-3*spine} ${-2*spine}M${80+width*.65} ${yAt(h,fraction+.03)}l${3*spine} ${2*spine}`} />)}</g>
    <g transform={`translate(80 ${top+2}) scale(${bloom})`}>{[0,72,144,216,288].map(r => <ellipse key={r} cy="-11" rx="9" ry="14" transform={`rotate(${r})`} fill="#e9a0b6" />)}<circle r="6" fill="#f6d277" /></g>
  </g>;
}

function MonsteraLeaf({ x, y, angle = 0, size = 1, fill = '#5e9065' }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}>
    <path d="M0 28C-31 15-40-10-28-24C-17-37-4-27 0-18C7-32 23-34 30-20C42 2 20 21 0 28Z" fill={fill} />
    <path d="M0 24V-16" stroke="#b6ce95" strokeWidth="2" strokeLinecap="round" opacity=".7" />
    <path d="M-3 6L-25-7M3 11L25-2M-4-7L-19-19M4-3L22-17" stroke="#c6d8a5" strokeWidth="3.5" strokeLinecap="round" opacity=".55" />
  </g>;
}

function Monstera({ maturity: m, height: h }) {
  const branch = (key, x, fraction, size, angle, fill, reveal = 1) => {
    const px = mix(80, x, reveal);
    const py = mix(145, yAt(h, fraction), reveal);
    const scale = size * reveal;
    return <g key={key}>
      <path d={`M80 145Q${mix(80,px,.65)} ${mix(145,py,.55)} ${px} ${py+20*scale}`} stroke="#537e52" strokeWidth={3.5 * reveal} fill="none" />
      <MonsteraLeaf x={px} y={py} size={scale} angle={angle} fill={fill} />
    </g>;
  };
  return <g>
    {branch('left', at(m,[74,67,57,53,51]), .51, at(m,[.22,.4,.65,.9,1]), -24, '#5e9065')}
    {branch('right', at(m,[86,94,106,108,110]), .36, at(m,[.2,.36,.55,.8,.86]), 28, '#8baa70')}
    {branch('upper', 89, .79, mix(.65,.85,phase(m,3)), 10, '#77a16f', phase(m,2))}
    {branch('lower', 36, .24, .6, -43, '#9ab881', phase(m,3))}
  </g>;
}

function LavenderHead({ x, y, angle, size, dark }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}>
    {[0,1,2,3].map(j => <g key={j}><ellipse cx="-4" cy={j*7-17} rx="5" ry="6.5" transform={`rotate(-22 -4 ${j*7-17})`} fill={dark ? '#a18bbd' : '#b49bc8'} /><ellipse cx="4" cy={j*7-14} rx="5" ry="6.5" transform={`rotate(22 4 ${j*7-14})`} fill="#c4add4" /></g>)}
    <ellipse cy="-24" rx="4.5" ry="6" fill="#d2bedc" />
  </g>;
}

function Lavender({ maturity: m, height: h }) {
  const newStems = phase(m, 2);
  const mainHead = at(m,[0,0,.62,.83,.9]);
  const stems = [
    { key: 'first', x: at(m,[77,74,70,68,66]), fraction: .62, angle: -11, reveal: 1, head: mainHead },
    { key: 'second', x: at(m,[83,85,88,90,92]), fraction: .82, angle: 8, reveal: 1, head: mainHead },
    { key: 'left', x: 48, fraction: .55, angle: -22, reveal: newStems, head: .8 },
    { key: 'right', x: 105, fraction: .61, angle: 13, reveal: newStems, head: .8 },
    { key: 'outer', x: 116, fraction: .39, angle: 22, reveal: newStems, head: .75 },
  ];
  return <g>{stems.map((stem, index) => {
    const x = mix(80, stem.x, stem.reveal);
    const y = mix(145, yAt(h, stem.fraction), stem.reveal);
    return <g key={stem.key}>
      <path d={`M80 145Q${x} ${mix(145,y,.5)} ${x} ${y}`} fill="none" stroke="#779464" strokeWidth={2.8 * stem.reveal} />
      <Leaf x={mix(80,x,.5)} y={mix(145,y,.4)} size={at(m,[.32,.4,.43,.45,.48]) * stem.reveal} flip={index % 2 === 0} fill="#9eaf80" angle={index % 2 ? 22 : -18} />
      <LavenderHead x={x} y={y} angle={stem.angle} size={stem.head * stem.reveal} dark={index % 2 === 0} />
    </g>;
  })}</g>;
}

function StrawberryLeaf({ x, y, angle, size, fill }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}>
    <path d="M0 14C-24 7-29-8-19-18C-8-24-1-14 0-9C4-22 18-24 24-12C30 1 12 12 0 14Z" fill={fill} />
    <path d="M0 13L0-8" stroke="#b2c58d" strokeWidth="1.5" />
  </g>;
}

function Berry({ x, y, size }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    <path d="M-13-8C-7-17 7-17 13-8C21 2 10 20 0 23C-10 20-21 2-13-8Z" fill="#dd7d7d" />
    <path d="M-12-9L-2-13L0-20L5-13L14-11L6-6L0-9L-6-4Z" fill="#6f9555" />
    <g fill="#f9ddb1">{[[-6,1],[5,2],[0,10],[-9,8],[7,11]].map(([cx,cy],i) => <ellipse key={i} cx={cx} cy={cy} rx="1" ry="2" />)}</g>
  </g>;
}

function Strawberry({ maturity: m, height: h }) {
  const size = at(m,[.24,.42,.7,.9,1]);
  const leaves = [
    { x: at(m,[74,65,55,51,49]), fraction: .43, angle: -28, reveal: 1 },
    { x: at(m,[86,96,106,110,112]), fraction: .4, angle: 35, reveal: 1 },
    { x: 80, fraction: .54, angle: 0, reveal: phase(m,0) },
  ];
  return <g>
    {leaves.map((leaf,index) => {
      const x = mix(80,leaf.x,leaf.reveal), y = mix(145,yAt(h,leaf.fraction),leaf.reveal);
      return <g key={index}><path d={`M80 145Q${mix(80,x,.7)} ${mix(145,y,.6)} ${x} ${y+10*size*leaf.reveal}`} stroke="#648c55" strokeWidth={3.5 * leaf.reveal} fill="none" /><StrawberryLeaf x={x} y={y} angle={leaf.angle} size={size * leaf.reveal} fill={index % 2 ? '#8eae72' : '#6d985e'} /></g>;
    })}
    <Blossom x="46" y={yAt(h,.58)} kind="daisy" size={.37 * phase(m,1)} />
    <Blossom x="117" y={yAt(h,.57)} kind="daisy" size={.3 * phase(m,3)} />
    <Berry x="57" y={yAt(h,.23)} size={.82 * phase(m,2)} />
    <Berry x="104" y={yAt(h,.21)} size={.72 * phase(m,2)} />
    <Berry x="84" y={yAt(h,.46)} size={.6 * phase(m,3)} />
  </g>;
}

export default function Foliage({ type = 'sunflower', maturity = 0, height = 100 }) {
  const m = Math.max(0, Math.min(4, maturity));
  const h = Math.max(0, Math.min(130, height));
  const props = { maturity: m, height: h };
  if (type === 'cactus') return <Cactus {...props} />;
  if (type === 'monstera') return <Monstera {...props} />;
  if (type === 'lavender') return <Lavender {...props} />;
  if (type === 'strawberry') return <Strawberry {...props} />;
  if (type === 'hibiscus') return <Hibiscus {...props} />;
  if (type === 'rose') return <Rose {...props} />;
  if (type === 'marigold') return <Marigold {...props} />;
  if (type === 'bonsai') return <Bonsai {...props} />;
  return <Flower type={type} {...props} />;
}

