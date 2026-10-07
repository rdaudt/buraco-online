type PetTarget='idle'|'monte'|'discard'|'morto'|'meld'|'hand';

const poses:Record<PetTarget,{x:number;y:number;tilt:number}>={
 idle:{x:0,y:0,tilt:0},
 monte:{x:-3,y:1,tilt:-3},
 discard:{x:0,y:2,tilt:0},
 morto:{x:3,y:1,tilt:3},
 meld:{x:0,y:3,tilt:1},
 hand:{x:-1,y:3,tilt:-1},
};

export type {PetTarget};

export default function PetAvatar({target='idle'}:{target?:PetTarget}){
 const {x,y,tilt}=poses[target];
 return <svg className="pet-avatar" viewBox="0 0 180 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cachorrinho branco observando a mesa">
  <defs>
   <linearGradient id="pet-fur" x1=".2" y1="0" x2=".82" y2="1"><stop stopColor="#fffdf5"/><stop offset=".55" stopColor="#f6f0e1"/><stop offset="1" stopColor="#dcd3c1"/></linearGradient>
   <radialGradient id="pet-face"><stop stopColor="#fffef7"/><stop offset=".72" stopColor="#f8f2e6"/><stop offset="1" stopColor="#e3d9c7"/></radialGradient>
   <linearGradient id="pet-tongue" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d9909b"/><stop offset="1" stopColor="#b86175"/></linearGradient>
   <radialGradient id="pet-eye"><stop stopColor="#3c302b"/><stop offset=".65" stopColor="#211c1b"/><stop offset="1" stopColor="#17191a"/></radialGradient>
  </defs>

  <g id="pet-body">
   <path d="M28 146 Q22 137 28 125 L21 124 L30 115 L25 110 L37 104 Q39 92 54 91 L125 91 Q140 94 145 105 L155 111 L149 116 L157 125 L149 129 Q153 142 148 150 Z" fill="url(#pet-fur)" stroke="#d9d0bc" strokeWidth="2" strokeLinejoin="round"/>
   <path d="M36 131 Q31 112 57 106 M143 132 Q149 112 124 106" fill="none" stroke="#fffcf3" strokeWidth="7" opacity=".68" strokeLinecap="round"/>
  </g>

  <g id="pet-head" className="pet-head" style={{transform:`rotate(${tilt}deg)`}}>
   <g id="pet-ears">
    <path d="M46 64 Q34 45 35 18 Q47 22 57 34 Q62 39 66 48 Z" fill="url(#pet-fur)" stroke="#d8cbb5" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M134 64 Q146 45 145 18 Q133 22 123 34 Q118 39 114 48 Z" fill="url(#pet-fur)" stroke="#d8cbb5" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M44 44 Q39 34 40 27 Q49 33 53 44 Z M136 44 Q141 34 140 27 Q131 33 127 44 Z" fill="#d7c5ad" opacity=".55"/>
    <path d="M40 31 L46 42 M140 31 L134 42" fill="none" stroke="#fffcf4" strokeWidth="4" strokeLinecap="round"/>
   </g>

   <g id="pet-fur-outline">
    <path d="M48 43 L44 34 L54 37 L54 28 L63 34 L71 24 L76 31 Q89 22 100 29 L109 23 L116 34 L125 29 L126 39 L137 36 L134 47 Q151 54 151 71 L158 78 L149 84 L157 93 L149 99 L153 109 L143 111 Q138 132 117 141 Q90 154 63 141 Q41 133 36 112 L27 109 L32 100 L24 93 L32 85 L25 78 L32 72 Q31 53 48 43 Z" fill="url(#pet-fur)" stroke="#d6cbb7" strokeWidth="2.3" strokeLinejoin="round"/>
    <path d="M51 53 Q90 36 129 53 Q147 68 140 103 Q134 134 91 142 Q45 137 39 101 Q32 70 51 53 Z" fill="url(#pet-face)"/>
    <path d="M45 73 Q37 90 48 111 M135 72 Q145 94 132 113" fill="none" stroke="#d7c9b3" strokeWidth="5" strokeLinecap="round" opacity=".25"/>
    <path d="M55 47 L53 38 L64 43 L72 34 L77 41 Q88 31 96 38 L106 31 L110 42 L123 38 L120 49" fill="none" stroke="#fffdf5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M39 103 L33 109 M42 116 L38 123 M137 104 L145 111 M135 118 L141 124" fill="none" stroke="#fdf8ea" strokeWidth="5" strokeLinecap="round"/>
   </g>

   <g id="pet-eyes" className="pet-eyes">
    <path d="M50 79 Q61 68 74 79 M106 79 Q119 68 130 79" fill="none" stroke="#d6c8b6" strokeWidth="5" strokeLinecap="round" opacity=".65"/>
    <ellipse cx="65" cy="84" rx="13" ry="13.5" fill="#ece0cc"/>
    <ellipse cx="115" cy="84" rx="13" ry="13.5" fill="#ece0cc"/>
    <circle cx="65" cy="84" r="11" fill="url(#pet-eye)"/>
    <circle cx="115" cy="84" r="11" fill="url(#pet-eye)"/>
    <g id="pet-pupils" className="pet-pupils" style={{transform:`translate(${x}px, ${y}px)`}}>
     <circle cx="65" cy="85" r="6.8" fill="#111717"/>
     <circle cx="115" cy="85" r="6.8" fill="#111717"/>
     <circle cx="61" cy="79" r="3.5" fill="#fffef8" opacity=".92"/>
     <circle cx="111" cy="79" r="3.5" fill="#fffef8" opacity=".92"/>
     <circle cx="69" cy="89" r="1.6" fill="#e5ddcd" opacity=".7"/>
     <circle cx="119" cy="89" r="1.6" fill="#e5ddcd" opacity=".7"/>
    </g>
   </g>

   <g id="pet-muzzle">
    <path d="M67 104 Q78 96 90 99 Q102 96 113 104 Q124 115 110 124 Q101 130 90 123 Q78 130 68 124 Q55 116 67 104 Z" fill="#fffdf5" stroke="#eee4d3" strokeWidth="1"/>
    <path d="M76 118 Q88 129 90 126 Q92 129 104 118" fill="none" stroke="#5a4742" strokeWidth="2.6" strokeLinecap="round"/>
    <path d="M79 120 Q86 135 90 136 Q99 135 102 120 Q96 123 90 122 Q84 123 79 120 Z" fill="url(#pet-tongue)" stroke="#aa6470" strokeWidth="1"/>
    <path d="M90 122 L90 131" stroke="#aa6272" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M78 103 Q90 96 102 103 Q103 108 96 112 Q90 117 84 112 Q77 108 78 103 Z" fill="#222527"/>
    <path d="M82 103 Q85 100 89 101" fill="none" stroke="#a9a1a0" strokeWidth="2" strokeLinecap="round" opacity=".75"/>
   </g>
  </g>

  <g id="pet-collar">
   <path d="M84 139 Q90 145 96 139" fill="none" stroke="#9c987e" strokeWidth="2"/>
   <path d="M90 143 Q97 145 97 152 Q97 161 90 163 Q83 161 83 152 Q83 145 90 143 Z" fill="#b8b6ab" stroke="#8f9188" strokeWidth="1.5"/>
   <path d="M87 148 Q89 146 92 147" fill="none" stroke="#f7f5e9" strokeWidth="2" strokeLinecap="round"/>
  </g>

  <g id="pet-paws">
   <path d="M39 133 Q49 128 58 135 Q65 143 62 153 Q60 160 51 162 Q39 163 34 156 Q29 145 39 133 Z" fill="url(#pet-fur)" stroke="#d9cebb" strokeWidth="2"/>
   <path d="M121 135 Q130 128 140 134 Q151 145 146 156 Q141 164 129 162 Q120 160 117 153 Q115 142 121 135 Z" fill="url(#pet-fur)" stroke="#d9cebb" strokeWidth="2"/>
   <path d="M41 150 L40 156 M51 151 L51 158 M129 151 L129 158 M139 150 L140 156" fill="none" stroke="#d1c5b4" strokeWidth="1.6" strokeLinecap="round"/>
   <path d="M36 145 Q45 136 56 143 M124 143 Q135 136 144 145" fill="none" stroke="#fffdf6" strokeWidth="2.6" strokeLinecap="round" opacity=".8"/>
  </g>
 </svg>;
}
