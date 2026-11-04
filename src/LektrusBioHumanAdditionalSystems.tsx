/** Additional independent anatomy plates painted on the EXACT 360 x 840
 * coordinate system of the existing gender-neutral human biomodel.
 *
 * These are educational vector diagrams, not radiographs. The drawings
 * intentionally contain no external sex traits. Detailed reproductive
 * anatomy is not inferred from a gender-neutral outline.
 *
 * Every system is a different React group. Selecting one never combines
 * it with an unrelated organ layer or an old flattened atlas image.
 */
import {memo} from "react";

const bone="#f5e8cb",boneEdge="#a79782";
const boneLine={fill:"none",stroke:bone,strokeWidth:11,strokeLinecap:"round" as const,
 strokeLinejoin:"round" as const};
const nerveGreen="#6d9e79";

function HumanSkeleton(){
 const ribPairs=[
  ["M178 195Q143 180 124 206Q112 229 143 232","M182 195Q217 180 236 206Q248 229 217 232"],
  ["M178 214Q142 194 118 227Q112 247 149 251","M182 214Q218 194 242 227Q248 247 211 251"],
  ["M178 233Q140 210 116 249Q115 268 152 273","M182 233Q220 210 244 249Q245 268 208 273"],
  ["M178 252Q143 232 123 271Q125 289 154 294","M182 252Q217 232 237 271Q235 289 206 294"],
  ["M178 273Q149 254 134 295Q139 311 159 314","M182 273Q211 254 226 295Q221 311 201 314"],
  ["M178 293Q153 278 143 316Q151 333 164 335","M182 293Q207 278 217 316Q209 333 196 335"]
 ];
 return <g data-anatomy="skeletal" strokeLinejoin="round" strokeLinecap="round">
  <g fill={bone} stroke={boneEdge} strokeWidth="3">
   <path d="M180 48Q148 44 144 77Q141 102 153 119L168 130L193 130
    L207 119Q219 104 218 80Q216 46 180 48Z"/>
   <path d="M157 107Q179 115 204 107L200 128Q179 144 161 128Z"
    fill="#ead9b9"/>
   <path d="M164 114Q180 106 196 114" fill="none" strokeWidth="2.2"/>
   <path d="M169 65Q178 62 190 65M160 84Q170 79 177 85
    M185 85Q194 79 204 84M173 100h14" fill="none" strokeWidth="2.1"/>
   <path d="M169 440Q143 422 124 442L149 479Q168 486 180 470
    Q192 486 211 479L237 442Q217 422 190 440Z" fill="#ecddbf"/>
  </g>
  <g fill="none" stroke={boneEdge} strokeWidth="2">
   <ellipse cx="168" cy="90" rx="7" ry="5"/><ellipse cx="195" cy="90" rx="7" ry="5"/>
   <path d="M160 116q20 8 41 0M148 447l30 16 29-16"/>
  </g>
  <g stroke={boneEdge} strokeWidth="2" fill={bone}>
   {Array.from({length:21},(_,i)=><rect key={i}
    x={174+(i%3===0?-1:0)} y={141+i*14} width={12} height={11} rx="4"/>)}
   <path d="M180 184Q158 176 137 183L115 195
    M180 184Q202 176 223 183L245 195" fill="none" strokeWidth="6"/>
  </g>
  <g stroke={bone} strokeWidth="5.7" fill="none">
   {ribPairs.map(([left,right],i)=><g key={i}>
    <path d={left}/><path d={right}/>
   </g>)}
  </g>
  <path d="M180 183L180 292" stroke="#ded0af" strokeWidth="9"/>
  <g {...boneLine}>
   <path d="M128 190L103 242L83 309"/>
   <path d="M232 190L258 242L278 309"/>
   <path d="M84 307L61 376L51 425"/>
   <path d="M85 310L74 380L59 427"/>
   <path d="M276 307L293 377L308 425"/>
   <path d="M277 310L284 378L299 427"/>
   <path d="M156 472L141 541L130 610"/>
   <path d="M203 472L220 541L230 610"/>
   <path d="M130 610L123 704L121 748"/>
   <path d="M134 610L138 705L130 744"/>
   <path d="M231 610L236 704L238 748"/>
   <path d="M227 610L222 705L230 744"/>
  </g>
  <g fill={bone} stroke={boneEdge} strokeWidth="2.2">
   {[[104,242],[258,242],[83,310],[277,310],[141,542],
     [219,542],[130,608],[230,608]].map(([x,y],i)=>
    <circle key={i} cx={x} cy={y} r="8"/>)}
   <path d="M48 418L42 442L39 465M53 421L52 446L49 466
    M58 421L60 445L59 462M64 422L70 442L69 454
    M301 420L297 442L294 463M307 420L306 446L307 468
    M312 420L318 444L320 463M317 420L326 438L329 453"
    fill="none" stroke={bone} strokeWidth="4"/>
   <path d="M120 747Q113 754 99 766L96 776Q115 781 135 763
    M238 747Q245 754 261 766L265 777Q241 781 226 762"
    fill={bone}/>
  </g>
  <g fill="none" stroke={boneEdge} strokeWidth="1.5" opacity=".7">
   <path d="M156 476l-6 65-16 66M205 476l9 66 12 64"/>
   <path d="M121 742l-10 22M238 742l11 22"/>
  </g>
 </g>;
}

function HumanMuscles(){
 const muscles=[
  ["M147 176Q168 172 177 187L178 242Q161 247 137 227Q129 200 147 176Z",
   "M213 176Q192 172 183 187L182 242Q199 247 223 227Q231 200 213 176Z"],
  ["M141 234Q159 244 176 247L177 337L155 347Q129 309 141 234Z",
   "M219 234Q201 244 184 247L183 337L205 347Q231 309 219 234Z"],
  ["M117 180Q97 194 92 230L103 265Q124 253 135 218Z",
   "M243 180Q263 194 268 230L257 265Q236 253 225 218Z"],
  ["M108 260Q96 275 84 314L71 351Q87 363 97 344L122 281Z",
   "M252 260Q264 275 276 314L289 351Q273 363 263 344L238 281Z"],
  ["M151 453Q122 470 128 513L138 577Q155 586 163 565L174 467Z",
   "M209 453Q238 470 232 513L222 577Q205 586 197 565L186 467Z"],
  ["M130 590Q110 633 117 681L126 731Q143 717 144 683L146 610Z",
   "M230 590Q250 633 243 681L234 731Q217 717 216 683L214 610Z"]
 ];
 return <g data-anatomy="muscular" strokeLinecap="round" strokeLinejoin="round">
  <g stroke="#ad656d" strokeWidth="2.4" fill="#d99899" fillOpacity=".94">
   {muscles.flat().map((d,i)=><path key={i} d={d}/>)}
   <path d="M146 345Q158 337 177 344V424L155 434
    Q135 393 146 345Z"/>
   <path d="M214 345Q202 337 183 344V424L205 434
    Q225 393 214 345Z"/>
   <path d="M144 127Q154 139 161 165L144 181L128 175
    Q142 148 144 127Z"/>
   <path d="M216 127Q206 139 199 165L216 181L232 175
    Q218 148 216 127Z"/>
  </g>
  <g stroke="#f1beb8" strokeWidth="1.7" fill="none" opacity=".86">
   <path d="M145 198q17 9 31 24M153 184l21 28M157 248l12 73
    M150 265l16 65M202 184l-17 28M216 198q-17 9-31 24
    M201 248l-12 73M211 265l-16 65"/>
   <path d="M160 351l8 63M151 357l7 58M200 351l-8 63M209 357l-7 58"/>
   <path d="M144 466l-6 95M158 466l-9 94M216 466l6 95M202 466l9 94
    M126 609l2 96M140 613l-8 94M234 609l-2 96M220 613l8 94"/>
  </g>
  <g stroke="#bd7f7f" strokeWidth="3" fill="none">
   <path d="M158 62Q166 75 163 91Q165 111 173 116
    M202 62Q194 75 197 91Q195 111 187 116"/>
   <path d="M166 105L168 125M194 105L192 125"/>
   <path d="M178 244V423M182 244V423" opacity=".5"/>
  </g>
 </g>;
}

function HumanUrinary(){
 return <g data-anatomy="urinary" strokeLinecap="round" strokeLinejoin="round">
  {/* Frontal teaching projection: kidneys sit behind the abdominal viscera. */}
  <g fill="#a96a79" stroke="#87566a" strokeWidth="3">
   <path d="M150 333Q127 326 119 348Q107 386 123 405
    Q140 416 155 396Q168 384 156 366Q147 359 150 333Z"/>
   <path d="M210 333Q233 326 241 348Q253 386 237 405
    Q220 416 205 396Q192 384 204 366Q213 359 210 333Z"/>
  </g>
  <g fill="#cdaab0" stroke="#985f6f" strokeWidth="1.8">
   <path d="M153 352Q139 354 136 372L150 391Q158 379 154 368Z"/>
   <path d="M207 352Q221 354 224 372L210 391Q202 379 206 368Z"/>
  </g>
  <g fill="none" stroke="#e7b47e" strokeWidth="7">
   <path d="M153 381Q169 407 167 433Q167 451 176 472"/>
   <path d="M207 381Q191 407 193 433Q193 451 184 472"/>
  </g>
  <path d="M175 466Q150 470 154 499Q162 520 181 523
   Q202 520 208 500Q211 473 185 466Z"
   fill="#d4a789" stroke="#9b6a61" strokeWidth="3.3"/>
  <path d="M162 489Q181 479 200 489" stroke="#f3d0b8" strokeWidth="2.5"
   fill="none"/>
  <path d="M181 523V551" stroke="#cb997f" strokeWidth="7" fill="none"/>
 </g>;
}

function HumanLymphatic(){
 const nodes=[
  [169,144],[193,143],[152,162],[208,161],[139,227],[221,227],
  [137,248],[223,248],[154,306],[205,306],[161,363],[199,364],
  [149,453],[211,453],[153,479],[207,479],[147,544],[213,544],
  [138,617],[222,617],[79,312],[282,312]
 ];
 return <g data-anatomy="lymphatic" strokeLinecap="round" strokeLinejoin="round">
  <g fill="none" stroke={nerveGreen} strokeWidth="3.2" opacity=".95">
   <path d="M166 148Q173 205 175 255L180 353L183 431"/>
   <path d="M196 148Q189 205 185 255L180 353"/>
   <path d="M176 236Q148 212 138 242L119 288L83 313"/>
   <path d="M184 236Q212 212 222 242L241 288L277 313"/>
   <path d="M169 346Q138 382 145 445L153 502L140 614L131 734"/>
   <path d="M191 346Q222 382 215 445L207 502L220 614L229 734"/>
   <path d="M174 260Q144 303 153 351M186 260Q216 303 205 351"/>
  </g>
  <path d="M191 209Q203 196 212 211L211 236Q200 244 190 231Z"
   fill="#d8b4c1" stroke="#9e828f" strokeWidth="2.4"/>
  <path d="M218 345Q236 333 240 350Q246 375 229 390
   Q213 386 211 369Z" fill="#aa7385" stroke="#85596f" strokeWidth="2.5"/>
  <g fill="#aacaaa" stroke="#5c966d" strokeWidth="1.65">
   {nodes.map(([x,y],i)=><ellipse key={i} cx={x} cy={y}
    rx={i<8?5.6:4.2} ry={i<8?8:6}/>)}
  </g>
  <g fill="none" stroke="#bed9ba" strokeWidth="1.5">
   <path d="M180 186Q163 180 155 166M180 197Q202 185 205 166
    M178 275Q150 265 139 247M182 275Q212 265 221 247"/>
  </g>
 </g>;
}

function HumanEndocrine(){
 return <g data-anatomy="endocrine" strokeLinejoin="round" strokeLinecap="round">
  <g fill="#b697c4" stroke="#81699c" strokeWidth="2.4">
   <ellipse cx="180" cy="83" rx="8" ry="4.5"/>
   <path d="M176 103Q180 97 184 103L185 112Q180 118 175 112Z"/>
   <path d="M161 159Q143 150 145 167Q145 181 160 181L174 172
    Q180 181 186 172L200 181Q215 181 215 167Q217 150 199 159
    L187 169Q180 160 173 169Z"/>
   <path d="M173 226Q158 221 159 237L176 260
    Q184 261 186 249L201 236Q202 223 187 226Z" fill="#c8acc6"/>
   <path d="M133 337Q149 327 157 341L149 353L131 351Z"
    fill="#ca9bb7"/>
   <path d="M203 341Q211 327 227 337L229 351L211 353Z"
    fill="#ca9bb7"/>
   <path d="M143 370Q167 355 183 361Q201 353 223 363
    Q231 375 215 380L184 373Q164 384 143 377Z"
    fill="#dab2a2" stroke="#a98289"/>
  </g>
  <g fill="#f0daec" opacity=".8">
   <ellipse cx="161" cy="168" rx="7" ry="5"/>
   <ellipse cx="199" cy="168" rx="7" ry="5"/>
   <ellipse cx="176" cy="239" rx="8" ry="6"/>
  </g>
 </g>;
}

function HumanIntegument(){
 // The existing transparent outer shell IS the skin silhouette.
 // This plate adds only surface markers and skin appendages, not anatomy
 // from an unrelated system, and never draws sexual anatomy.
 const marks=[
  [145,194],[212,195],[134,291],[220,289],[151,372],[203,370],
  [143,483],[218,483],[131,601],[231,601],[79,305],[281,305]
 ];
 return <g data-anatomy="integumentary" strokeLinecap="round">
  <g fill="none" stroke="#c58f80" strokeWidth="2.5" opacity=".6">
   <path d="M152 117Q180 130 208 117M143 166Q181 155 217 166"/>
   <path d="M123 230Q113 277 108 314L70 413
    M237 230Q247 277 252 314L290 413"/>
   <path d="M141 461Q130 534 128 600L126 733
    M219 461Q230 534 232 600L234 733"/>
   <path d="M151 398Q180 405 209 398"/>
  </g>
  <g stroke="#c38a73" strokeWidth="1.2" fill="#f0d4b8" fillOpacity=".65">
   {marks.map(([x,y],i)=><g key={i}>
    <circle cx={x} cy={y} r="5"/>
    <path d={"M"+x+" "+(y-3)+"q-4 -7 -1 -11q4 -3 4 -8"}
     fill="none"/>
   </g>)}
  </g>
  <g fill="none" stroke="#d0a08b" strokeWidth="1.6">
   <path d="M150 79q13-10 24-2M189 77q12-8 23 1"/>
   <path d="M151 103q11 5 21 0M187 103q11 5 21 0"/>
  </g>
 </g>;
}

function HumanSensory(){
 return <g data-anatomy="sensory" strokeLinecap="round" strokeLinejoin="round">
  <g fill="#9abac7" stroke="#5a8e9a" strokeWidth="2.2">
   <path d="M154 86q11-12 23 0q-12 13-23 0Z"/>
   <path d="M183 86q12-12 23 0q-12 13-23 0Z"/>
   <ellipse cx="165" cy="86" rx="4" ry="5" fill="#5a7c96"/>
   <ellipse cx="194" cy="86" rx="4" ry="5" fill="#5a7c96"/>
   <path d="M146 94Q133 88 135 102Q135 112 144 118
    Q153 113 150 105" fill="#d3aea6"/>
   <path d="M214 94Q227 88 225 102Q225 112 216 118
    Q207 113 210 105" fill="#d3aea6"/>
  </g>
  <path d="M180 91Q172 109 175 116Q180 118 185 116
   Q187 109 180 91Z" fill="#dcae98" stroke="#ba867d" strokeWidth="2"/>
  <path d="M164 126Q179 132 197 126Q183 142 164 126Z"
   fill="#cb7f85" stroke="#a26675" strokeWidth="2.2"/>
  <g fill="none" stroke="#80afb7" strokeWidth="2.8">
   <path d="M168 92Q172 107 176 123"/>
   <path d="M192 92Q188 107 184 123"/>
   <path d="M143 111Q161 128 170 151"/>
   <path d="M217 111Q199 128 190 151"/>
  </g>
  <g fill="none" stroke="#96b5b6" strokeWidth="2.4" opacity=".9">
   <path d="M106 314Q81 349 52 412M254 314Q278 349 308 412"/>
   <path d="M161 458Q142 567 126 707M199 458Q218 567 234 707"/>
  </g>
  <g fill="#b4d6d1" stroke="#719f9d" strokeWidth="1.5">
   {[[53,420],[307,420],[125,719],[235,719]].map(([x,y],i)=>
    <circle key={i} cx={x} cy={y} r="6"/>)}
  </g>
 </g>;
}
export const HUMAN_ADDITIONAL_DRAWINGS={
 skeletal:memo(HumanSkeleton),
 muscular:memo(HumanMuscles),
 urinary:memo(HumanUrinary),
 lymphatic:memo(HumanLymphatic),
 endocrine:memo(HumanEndocrine),
 integumentary:memo(HumanIntegument),
 sensory:memo(HumanSensory)
};
