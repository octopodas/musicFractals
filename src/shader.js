// GLSL source for the fullscreen raymarcher. A single fragment shader draws
// everything: it ray-marches a volumetric field inside a glass cube / invisible
// sphere, with the field shape chosen per visualization Mode and coloured per
// Palette. All music reactivity arrives through the u* uniforms.
export const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }`;

export const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform vec2  uOffset;   // screen-space shift (canvas px) to centre the cube beside the panel
uniform float uTime;     // fluid time (already scaled by speed + audio)
uniform vec2  uRot;      // yaw, pitch
uniform float uBass, uMid, uTreble, uLevel, uBeat;
uniform float uReact, uDensity, uHue, uPulse, uPulseT, uSat;
uniform float uChromaHue, uChromaStr, uCentroid, uChromaAmt;   // dominant pitch hue, tonal strength, spectral brightness, pitch→color amount
uniform vec3  uColLow, uColMid, uColHigh, uColCore, uColBase;
uniform vec3  uBassCol, uMidCol, uTrebleCol;   // audio tint-wash colors
uniform float uTintAmt;                         // 0 = off
uniform vec3  uBgTop, uBgBot;                   // backdrop gradient (top, bottom)
uniform int   uStyle, uMode, uShape;

// ---- hash / value noise ----
float hash(vec3 p){
  p = fract(p*0.3183099 + vec3(0.1,0.2,0.3));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){
  float a=0.5, s=0.0;
  for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.02+vec3(1.7); a*=0.5; }
  return s;
}

mat2 r2(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// Kali / Star-Nest volumetric fractal -> glowing fractal foam filling the cube.
// The fold offset, strength and rotation are driven by the music so it "dances".
float fractalField(vec3 p){
  p *= 1.4;
  p.xz = r2(uTime*0.09 + uMid*0.8) * p.xz;   // tumble with the mids
  p.xy = r2(uTime*0.06) * p.xy;
  float strength = 6.5 + 2.5*uReact*(uBass + uBeat*0.7);
  vec3 offs = vec3(-0.5, -0.78 + 0.14*sin(uTime*0.35), -1.1);
  float accum = 0.0, prev = 0.0, tw = 0.0;
  for(int i=0;i<16;i++){
    float mag = dot(p,p);
    p = abs(p)/mag + offs;                    // sphere inversion fold
    float w = exp(-float(i)/7.0);
    accum += w * exp(-strength * abs(mag - prev));
    tw += w;
    prev = mag;
  }
  return max(0.0, 4.2*accum/tw - 0.6);
}

vec3 hash33(vec3 p){
  p = vec3(dot(p,vec3(127.1,311.7,74.7)),
           dot(p,vec3(269.5,183.3,246.1)),
           dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(p)*43758.5453123);
}
// 3D cellular noise -> nearest (F1) and 2nd nearest (F2) feature-point distances
vec2 worley(vec3 p){
  vec3 ip = floor(p), fp = fract(p);
  float f1 = 9.0, f2 = 9.0;
  for(int x=-1;x<=1;x++)
  for(int y=-1;y<=1;y++)
  for(int z=-1;z<=1;z++){
    vec3 g = vec3(float(x),float(y),float(z));
    vec3 o = hash33(ip+g);
    o = 0.5 + 0.5*sin(uTime*0.7 + 6.2831853*o);   // animate the gem centres
    vec3 d = g + o - fp;
    float dd = dot(d,d);
    if(dd<f1){ f2=f1; f1=dd; } else if(dd<f2){ f2=dd; }
  }
  return sqrt(vec2(f1,f2));
}
// faceted crystal lattice: glowing cell edges + soft gem cores, flaring on the beat
float crystalField(vec3 p){
  float scale = 3.0 + uBass*1.2;
  vec2 w = worley(p*scale);
  float edge = 1.0 - smoothstep(0.0, 0.06 + uTreble*0.05, w.y - w.x); // thin glowing facets
  float gem  = smoothstep(0.75, 0.0, w.x);                            // soft glow toward centres
  return edge*(1.0 + uReact*uBeat*1.6) + gem*0.35;
}

// spiral galaxy: arms + bright pulsing core + twinkling stars
float galaxyField(vec3 p, out float starOut){
  p.xz = r2(uTime*0.12 + uMid*0.5) * p.xz;            // spin the disk with the mids
  float r = length(p.xz);
  float a = atan(p.z, p.x);
  float spiral = pow(0.5 + 0.5*cos(2.0*a + r*7.0 - uTime*0.9), 2.0); // two arms winding out
  float disk = exp(-abs(p.y)*5.0) * exp(-r*1.3);                     // dense near the plane
  float arms = disk * spiral;
  float core = exp(-r*4.5) * exp(-abs(p.y)*7.0) * (1.2 + uBass*2.5 + uBeat*2.0); // throbs on bass
  // twinkling stars: one jittered point per grid cell
  vec3 gp = p*9.0;
  vec3 ip = floor(gp), fp = fract(gp)-0.5;
  vec3 jit = hash33(ip)-0.5;
  float sd = length(fp - jit*0.7);
  float star = pow(smoothstep(0.13, 0.0, sd), 1.5) * step(0.6, hash(ip+vec3(9.3))); // tight, sharp points
  star *= (0.5 + 0.5*sin(uTime*4.0 + hash(ip)*31.0)) * (0.9 + uTreble*1.6);
  starOut = star * smoothstep(1.6, 0.0, r) * exp(-abs(p.y)*1.6);   // spread off the disk; handled separately as colored emissive
  return arms*1.6 + core*2.4;
}

// bioluminescence: drifting glow blobs + trailing tendrils, breathing on bass, sparkling on treble
float bioField(vec3 p){
  // slow organic warp so the whole field drifts and curls
  vec3 q = p + 0.28*vec3(
    fbm(p*1.3 + vec3(0.0,  uTime*0.15, 0.0)),
    fbm(p*1.3 + vec3(3.1, -uTime*0.12, 1.7)),
    fbm(p*1.3 + vec3(1.2,  2.4, uTime*0.10)));
  float breathe = 0.7 + 0.3*sin(uTime*0.8) + uBass*1.0;   // slow swell + bass pulse
  float blobs = 0.0;
  for(int i=0;i<5;i++){
    float fi=float(i);
    vec3 c = 0.72*vec3(sin(uTime*0.20+fi*2.4),
                       cos(uTime*0.17+fi*1.7)*0.7,
                       sin(uTime*0.23+fi*3.1));   // each blob drifts on its own orbit
    vec3 dv = q - c;
    blobs += exp(-dot(dv,dv)*5.0);
  }
  blobs *= breathe;
  float veins = 1.0 - abs(2.0*fbm(q*2.2 + uTime*0.10) - 1.0);   // ridged filaments
  float tendrils = pow(veins, 6.0) * 0.7;
  float spark = pow(max(fbm(q*7.0 - uTime*0.6), 0.0), 3.0) * uTreble * 1.4;   // treble shimmer
  return blobs*0.6 + tendrils + spark;
}

// singularity: accretion disk spiralling into a blazing core, with a dark event horizon
float singularityField(vec3 p){
  float r = length(p.xz);
  float swirl = uTime*0.5 + 1.5/(r+0.22);          // inner matter whips around faster (gravity)
  p.xz = r2(swirl) * p.xz;
  float a = atan(p.z, p.x);
  float disk = exp(-abs(p.y)*(7.0 + 6.0*exp(-r*2.0))) * smoothstep(1.3, 0.12, r);  // thin disk on the plane
  float arms = pow(0.5 + 0.5*cos(a*2.0 + r*9.0 - uTime*1.2), 2.0);                  // two arms winding in
  disk *= 0.35 + 0.65*arms;
  float core = exp(-r*5.5) * exp(-abs(p.y)*8.0) * (1.6 + uBass*3.0 + uBeat*3.0);    // throbs on bass/beat
  float shock = max(sin(r*16.0 - uPulseT*5.0), 0.0) * exp(-r*1.6) * uBeat * 1.4;    // beat shockwave rings
  float horizon = smoothstep(0.07, 0.13, r);                                        // dark hole at the centre
  return (disk*1.9 + core*2.6 + shock) * horizon;
}

// wormhole: a ribbed tunnel funnelling to a bright vanishing point, rushing past the viewer
float wormholeField(vec3 p){
  float dd = smoothstep(1.0, -1.0, p.z);            // 0 at the near mouth → 1 at the far end
  p.xy = r2(p.z*0.8 + uTime*0.2) * p.xy;            // gentle twist down the throat
  float r = length(p.xy);
  float radius = 0.85 - 0.6*dd;                     // funnels narrower toward the far end
  float wall = exp(-pow((r - radius)*6.0, 2.0));    // glowing tube wall
  float ribs = 0.5 + 0.5*sin(p.z*11.0 - uTime*5.0 + atan(p.y,p.x)*3.0);  // ribs rushing toward the viewer
  wall *= 0.35 + 0.65*ribs;
  float core = exp(-r*4.5) * dd * (1.2 + uBass*2.0);   // bright vanishing point, throbs on bass
  return wall*1.6 + core*2.2;
}

mat3 rotY(float a){ float c=cos(a),s=sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
mat3 rotX(float a){ float c=cos(a),s=sin(a); return mat3(1,0,0, 0,c,-s, 0,s,c); }

// ray-box, returns (tNear,tFar) and sets entry normal
vec2 boxI(vec3 ro, vec3 rd, vec3 rad, out vec3 nrm){
  vec3 m = 1.0/rd, n = m*ro, k = abs(m)*rad;
  vec3 t1 = -n-k, t2 = -n+k;
  float tN = max(max(t1.x,t1.y),t1.z);
  float tF = min(min(t2.x,t2.y),t2.z);
  if(tN>tF || tF<0.0){ nrm=vec3(0); return vec2(-1.0); }
  nrm = -sign(rd)*step(t1.yzx,t1.xyz)*step(t1.zxy,t1.xyz);
  return vec2(tN,tF);
}

// ray-sphere (centred at origin), returns (tNear,tFar) and sets entry normal
vec2 sphereI(vec3 ro, vec3 rd, float rad, out vec3 nrm){
  float b = dot(ro, rd);
  float c = dot(ro, ro) - rad*rad;
  float h = b*b - c;
  if(h < 0.0){ nrm=vec3(0); return vec2(-1.0); }
  h = sqrt(h);
  float tN = -b - h, tF = -b + h;
  if(tF < 0.0){ nrm=vec3(0); return vec2(-1.0); }
  nrm = normalize(ro + rd*tN);
  return vec2(tN, tF);
}

vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(6.28318*(c*t+d)); }

// rotate a color's hue by angle a about the luma (1,1,1) axis — preserves brightness
vec3 hueShift(vec3 col, float a){
  const vec3 k = vec3(0.57735026);   // normalize(vec3(1))
  float c = cos(a), s = sin(a);
  return col*c + cross(k, col)*s + k*dot(k, col)*(1.0 - c);
}

// style-driven emissive color from density d and height y (-1..1)
vec3 fluidColor(float d, float y){
  float t = clamp(d*0.9 + uHue, 0.0, 2.0);
  vec3 col;
  if(uStyle==0){               // Liquid Cyan  (blue core, hot orange floor)
    vec3 deep = vec3(0.02,0.10,0.28);                 // dark blue voids
    vec3 cyan = vec3(0.15,0.65,1.0);                  // electric blue body
    vec3 core = vec3(0.75,0.95,1.0);                  // white-hot core
    vec3 cool = mix(deep, cyan, smoothstep(0.0,0.6,d));
    cool = mix(cool, core, pow(d,2.5));
    vec3 hot  = mix(vec3(0.8,0.2,0.02), vec3(1.0,0.7,0.2), smoothstep(0.2,1.0,d)); // molten base
    float floorMix = smoothstep(-0.15,-0.95,y);
    col = mix(cool, hot, floorMix*0.9);
  } else if(uStyle==1){        // Plasma
    col = pal(t+y*0.2, vec3(0.5), vec3(0.5), vec3(1.0,1.0,1.0), vec3(0.0,0.33,0.67));
  } else if(uStyle==2){        // Nebula
    vec3 c = pal(t*0.6, vec3(0.2,0.1,0.4), vec3(0.4,0.2,0.5), vec3(1.0), vec3(0.1,0.4,0.7));
    col = c + vec3(0.9,0.5,0.8)*pow(d,4.0);
  } else if(uStyle==3){        // Inferno
    col = pal(t, vec3(0.5,0.15,0.05), vec3(0.5,0.35,0.1), vec3(1.0,1.0,1.0), vec3(0.0,0.1,0.2));
    col += vec3(1.0,0.6,0.2)*pow(d,3.0);
  } else if(uStyle==4){        // Aurora
    col = pal(t*0.7+y*0.3, vec3(0.0,0.3,0.2), vec3(0.3,0.5,0.4), vec3(1.0), vec3(0.3,0.5,0.7));
    col += vec3(0.3,1.0,0.6)*pow(d,3.0)*0.7;
  } else {                     // Custom — 4-stop density ramp (Low→Body→High→Core) + Base
    vec3 ramp = mix(uColLow,  uColMid,  smoothstep(0.0, 0.40, d));
    ramp = mix(ramp, uColHigh, smoothstep(0.40, 0.70, d));
    ramp = mix(ramp, uColCore, clamp(smoothstep(0.70, 1.0, d), 0.0, 1.0));
    float floorMix = smoothstep(-0.15,-0.95,y);
    col = mix(ramp, uColBase, floorMix*0.9);
  }
  col = max(col, 0.0);
  // audio tint wash: recolor toward the loudest band, keeping the bright/dark structure
  if(uTintAmt > 0.0){
    vec3 bandCol = (uBassCol*uBass + uMidCol*uMid + uTrebleCol*uTreble)
                 / (uBass + uMid + uTreble + 1e-4);   // weighted toward loudest band
    float blum = dot(col, vec3(0.299,0.587,0.114));
    col = mix(col, blum * bandCol * 2.0, uTintAmt);
  }
  // spectral temperature: warm/cool tint from brightness, but recede where a pitch is
  // confident (chroma owns hue then). bass darkening below isn't pitch-gated, so it fires under chords too.
  float warm = 0.5 - uCentroid;                                  // + low/warm, − high/cool
  col += uChromaAmt * (1.0 - uChromaStr) * 0.18 * vec3(warm, warm*0.15, -warm);
  col += uChromaAmt * uTreble * uCentroid * 0.12 * vec3(0.6,0.85,1.0);   // icy highlight bloom on bright/airy content
  col *= 1.0 - uChromaAmt * uBass*uBass*0.25;                     // bass drop dims the field (not pitch-gated, so it fires under chords)
  col = max(col, 0.0);
  // pitch → hue: blend toward the palette rotated by the dominant pitch class. Rotating by the FULL
  // angle makes the 0↔1 hue wrap a full turn (= identity), so a pitch sitting on A (hue≈0/1) never
  // snaps; strength × amount is the blend toward that target rather than a scale on the angle.
  vec3 rotated = hueShift(col, 6.2831853 * uChromaHue);
  col = max(mix(col, rotated, clamp(uChromaStr * uChromaAmt, 0.0, 1.0)), 0.0);
  // saturation: 0 = greyscale, 1 = normal, >1 = boosted
  float lum = dot(col, vec3(0.299,0.587,0.114));
  return max(mix(vec3(lum), col, uSat), 0.0);
}

vec3 background(vec3 rd){
  float g = 0.5+0.5*rd.y;
  vec3 col = mix(uBgBot, uBgTop, g);
  // a few warm floating sparks (bokeh embers)
  for(int i=0;i<6;i++){
    float fi=float(i);
    vec3 dir = normalize(vec3(sin(fi*12.9+uTime*0.1),cos(fi*7.3+uTime*0.07)*0.6+0.3,sin(fi*4.1)));
    float sp = pow(max(dot(rd,dir),0.0), 900.0);
    col += vec3(1.0,0.55,0.25)*sp*1.6;
  }
  col += vec3(0.9,0.4,0.15)*pow(max(-rd.y,0.0),2.5)*0.35; // warm floor bounce
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes - uOffset)/uRes.y;
  vec3 ro = vec3(0.0,0.15,4.7);
  vec3 rd = normalize(vec3(uv,-1.6));
  mat3 rot = rotY(uRot.x)*rotX(uRot.y);
  ro = rot*ro; rd = rot*rd;

  vec3 col = background(rd);

  vec3 nrm;
  vec2 t = (uShape==1) ? sphereI(ro, rd, 1.0, nrm) : boxI(ro, rd, vec3(1.0), nrm);
  if(t.x > 0.0){
    vec3 entry = ro + rd*t.x;
    float fres = (uShape==1) ? 0.0 : pow(1.0 - max(dot(-rd,nrm),0.0), 4.0);

    // cube refracts through the glass; the invisible sphere lets the ray pass straight
    vec3 marchDir = rd;
    if(uShape==0){
      marchDir = refract(rd, nrm, 0.72);
      if(length(marchDir) < 0.001) marchDir = reflect(rd,nrm);
    }
    vec3 q = entry + marchDir*0.02;

    const int STEPS = 64;
    float dt = 0.032;
    vec3 acc = vec3(0.0);
    float trans = 1.0;
    float reactBoost = 1.0 + uReact*(uBass*1.6 + uBeat*1.2);

    for(int i=0;i<STEPS;i++){
      if(trans < 0.02) break;
      float rq = length(q);
      if(uShape==1 ? rq>1.02 : (abs(q.x)>1.02||abs(q.y)>1.02||abs(q.z)>1.02)) break;
      float d;
      vec3 starEmis = vec3(0.0);
      if(uMode==1){
        // ---- FRACTAL: kaliset sphere-folding field, dancing with the music ----
        d = fractalField(q) * uDensity * reactBoost;
      } else if(uMode==2){
        // ---- CRYSTAL: faceted Voronoi lattice, glowing gem cells ----
        d = crystalField(q) * uDensity * reactBoost;
      } else if(uMode==3){
        // ---- COSMOS: spiral galaxy; stars are sharp emissive points colored by the loudest band ----
        float starI;
        d = galaxyField(q, starI) * uDensity * reactBoost;
        float bsum = uBass + uMid + uTreble;
        // power-weight so the dominant band wins the hue (linear average muddies to grey)
        float wb = uBass*uBass, wm = uMid*uMid, wt = uTreble*uTreble;
        vec3 bandMix = (uBassCol*wb + uMidCol*wm + uTrebleCol*wt) / (wb + wm + wt + 1e-4);
        vec3 starCol = mix(vec3(0.85,0.92,1.0), bandMix, smoothstep(0.06, 0.5, bsum)); // icy-white when quiet → band hue when loud
        starEmis = starCol * starI * (10.0 + uTreble*8.0);
      } else if(uMode==4){
        // ---- BIOLUMINESCENCE: drifting glow blobs with trailing tendrils ----
        d = bioField(q) * uDensity * reactBoost;
      } else if(uMode==5){
        // ---- SINGULARITY: accretion disk spiralling into a dark core ----
        d = singularityField(q) * uDensity * reactBoost;
      } else if(uMode==6){
        // ---- WORMHOLE: ribbed tunnel funnelling to a vanishing point ----
        d = wormholeField(q) * uDensity * reactBoost;
      } else {
        // ---- LIQUID: domain-warped fbm fluid with ridged veins ----
        vec3 sp = q*2.3;
        vec3 warp = vec3(
          fbm(sp + vec3(0.0,  uTime*0.25, 0.0)),
          fbm(sp + vec3(5.2, -uTime*0.20, 1.3)),
          fbm(sp + vec3(1.7,  3.1, uTime*0.22)));
        float base = fbm(sp + warp*1.8*reactBoost + vec3(0.0,-uTime*0.15,0.0));
        d = pow(smoothstep(0.40,0.88,base), 1.7);
        float veins = 1.0 - abs(2.0*fbm(sp*1.6 + warp + uTime*0.12) - 1.0);
        d += pow(veins, 5.0) * 0.7;
        d *= uDensity * reactBoost;
        d += uReact*uTreble*0.4*pow(smoothstep(0.62,0.92,warp.x),4.0);
      }
      // soft radial falloff so the mass floats inside the container
      float rr = rq;
      d *= smoothstep(1.5, 0.45, rr);
      // radial pulse: brightness rings travel from the centre to the sides on the beat
      float ring = 0.5 + 0.5*sin(rr*9.0 - uPulseT*4.0);
      d *= 1.0 + uPulse*(0.30 + uBass*1.1 + uBeat*1.7)*ring;

      vec3 e = fluidColor(d, q.y);
      float dens = d*1.7;
      acc += trans * (dens * e + starEmis) * dt * 12.0;   // stars add as direct bright light, uncoupled from density
      trans *= exp(-dens*1.6*dt*12.0);
      q += marchDir*dt;
    }

    // beat flash from the core
    acc *= 1.0 + uBeat*0.6*uReact;
    acc += vec3(0.3,0.6,1.0)*uBeat*uReact*0.15;

    vec3 inside = acc;
    if(uShape==1){
      // invisible sphere: just the emissive volume composited over the background
      col = inside + col*trans;
    } else {
      vec3 reflCol = background(reflect(rd,nrm)) * (0.6+uMid*0.5);
      // crisp glass rim: glow along whole cube edges (2nd-smallest of 1-|coord|)
      vec3 m = 1.0 - abs(entry);
      float edgeDist = (m.x+m.y+m.z) - min(m.x,min(m.y,m.z)) - max(m.x,max(m.y,m.z));
      float edge = smoothstep(0.018, 0.0, edgeDist);   // narrower, crisper rim
      vec3 rim = mix(vec3(0.18,0.5,1.0), vec3(0.6,0.85,1.0), 0.25) * edge * (0.35 + uTreble*0.7);  // icy crystal blue
      // show interior through the glass, add reflection by fresnel, then rim on top
      col = mix(inside, reflCol, fres*0.5);
      col += rim + fres*0.12;
    }
  }

  // tone map + vignette
  col = col/(col+vec3(0.9));
  col = pow(col, vec3(0.85));
  float vig = 1.0 - 0.25*dot(uv,uv);
  col *= vig;
  gl_FragColor = vec4(col,1.0);
}
`;
