/**
 * Floating Clock Widget Engine v6
 * 52 Designs (13 Ghost/Floating, 25 With Dial, 14 Unique Motion)
 * 10 Hand Styles × 10 Color Themes
 * High-performance 60fps canvas renderer
 */
(() => {
  const api = window.clockAPI;
  const canvas = document.getElementById('clock');
  const X = canvas.getContext('2d');

  const PI2 = Math.PI * 2;
  const DEG2RAD = Math.PI / 180;

  const THEMES = {
    midnight:  { accent:'#8b5cf6', sec:'#ef4444', glow:'rgba(139,92,246,0.5)' },
    obsidian:  { accent:'#10b981', sec:'#38bdf8', glow:'rgba(16,185,129,0.5)' },
    charcoal:  { accent:'#38bdf8', sec:'#f43f5e', glow:'rgba(56,189,248,0.5)' },
    slate:     { accent:'#f59e0b', sec:'#10b981', glow:'rgba(245,158,11,0.5)' },
    eclipse:   { accent:'#ef4444', sec:'#fbbf24', glow:'rgba(239,68,68,0.5)' },
    void:      { accent:'#ec4899', sec:'#8b5cf6', glow:'rgba(236,72,153,0.5)' },
    graphite:  { accent:'#14b8a6', sec:'#f97316', glow:'rgba(20,184,166,0.5)' },
    onyx:      { accent:'#f97316', sec:'#06b6d4', glow:'rgba(249,115,22,0.5)' },
    shadow:    { accent:'#a855f7', sec:'#ec4899', glow:'rgba(168,85,247,0.5)' },
    abyss:     { accent:'#06b6d4', sec:'#10b981', glow:'rgba(6,182,212,0.5)' }
  };

  let style='handsonly_ghost', theme='midnight', handType='tapered', opacity=100;
  const saved = api.loadSettings();
  if (saved.clockStyle) style=saved.clockStyle;
  if (saved.theme) theme=saved.theme;
  if (saved.handType) handType=saved.handType;
  if (typeof saved.opacity==='number') opacity=saved.opacity;

  function applyOpacity() { canvas.style.opacity=opacity/100; }
  applyOpacity();
  function save() { api.saveSettings({clockStyle:style,theme,handType,opacity}); }

  api.onSetStyle(s => { style=s; save(); });
  api.onSetTheme(t => { theme=t; save(); });
  api.onSetOpacity(o => { opacity=o; applyOpacity(); save(); });
  api.onSetHands(h => { handType=h; save(); });

  const dpr = window.devicePixelRatio||1;
  function resize() {
    const w=window.innerWidth, h=window.innerHeight;
    canvas.width=w*dpr; canvas.height=h*dpr;
    canvas.style.width=w+'px'; canvas.style.height=h+'px';
    X.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener('resize', resize);
  api.onWindowResized(resize);

  let dragging=false;
  canvas.addEventListener('mousedown', e => { if(e.button===0){dragging=true;api.dragStart();} });
  window.addEventListener('mousemove', () => { if(dragging)api.dragMove(); });
  window.addEventListener('mouseup', () => { if(dragging){dragging=false;api.dragEnd();} });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); api.showPanel({style,theme,handType,opacity}); });

  /* ================================================================
   *  MODULAR HAND DRAWING SYSTEM — 10 Types
   * ================================================================ */

  function drawHandSet(cx, cy, r, hAngle, mAngle, sAngle, hCol, mCol, sCol, glowSec=false, opacityScale=1) {
    X.save();
    if (opacityScale < 1) X.globalAlpha *= opacityScale;

    const fn = HANDS[handType] || HANDS.tapered;
    fn.hour(cx, cy, hAngle, r*0.50, hCol);
    fn.minute(cx, cy, mAngle, r*0.74, mCol);

    if (sCol) {
      drawNeedle(cx, cy, sAngle, r*0.84, sCol, glowSec);
      X.beginPath(); X.arc(cx,cy,Math.max(3,r*0.032),0,PI2);
      X.fillStyle=sCol; X.fill();
    }
    X.restore();
  }

  function drawNeedle(cx,cy,a,len,col,glow) {
    X.save(); X.translate(cx,cy); X.rotate(a);
    if(glow){X.shadowColor=col;X.shadowBlur=10;} else {X.shadowColor='rgba(0,0,0,0.4)';X.shadowBlur=4;}
    X.beginPath(); X.moveTo(0,len*0.22); X.lineTo(0,-len);
    X.strokeStyle=col; X.lineWidth=Math.max(0.8,len*0.008); X.lineCap='round'; X.stroke();
    X.beginPath(); X.arc(0,len*0.15,Math.max(2.5,len*0.028),0,PI2); X.fillStyle=col; X.fill();
    X.restore();
  }

  function _tapered(cx,cy,a,len,bw,tw,col,hollow,glowCol) {
    X.save(); X.translate(cx,cy); X.rotate(a);
    if(glowCol){X.shadowColor=glowCol;X.shadowBlur=8;} else {X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;X.shadowOffsetY=2;}
    const tail=len*0.15;
    X.beginPath(); X.moveTo(0,tail); X.lineTo(-bw/2,0); X.lineTo(-tw/2,-len); X.lineTo(0,-len-tw); X.lineTo(tw/2,-len); X.lineTo(bw/2,0); X.closePath();
    if(hollow){X.strokeStyle=col;X.lineWidth=1.5;X.stroke();}else{X.fillStyle=col;X.fill();}
    X.restore();
  }

  const HANDS = {
    tapered: {
      hour:(cx,cy,a,len,col)=>_tapered(cx,cy,a,len,len*0.09,len*0.03,col),
      minute:(cx,cy,a,len,col)=>_tapered(cx,cy,a,len,len*0.065,len*0.02,col)
    },
    sword: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        const w=len*0.04;
        X.beginPath();X.moveTo(0,len*0.12);X.lineTo(-w,0);X.lineTo(-w*0.7,-len*0.4);X.lineTo(0,-len);X.lineTo(w*0.7,-len*0.4);X.lineTo(w,0);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        const w=len*0.03;
        X.beginPath();X.moveTo(0,len*0.12);X.lineTo(-w,0);X.lineTo(-w*0.7,-len*0.45);X.lineTo(0,-len);X.lineTo(w*0.7,-len*0.45);X.lineTo(w,0);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    dauphine: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        const w=len*0.05;
        X.beginPath();X.moveTo(0,len*0.1);X.lineTo(-w,0);X.lineTo(-w*0.3,-len*0.5);X.lineTo(0,-len);X.lineTo(w*0.3,-len*0.5);X.lineTo(w,0);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        const w=len*0.04;
        X.beginPath();X.moveTo(0,len*0.1);X.lineTo(-w,0);X.lineTo(-w*0.3,-len*0.5);X.lineTo(0,-len);X.lineTo(w*0.3,-len*0.5);X.lineTo(w,0);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    leaf: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        X.beginPath();X.moveTo(0,len*0.12);
        X.quadraticCurveTo(-len*0.06,-len*0.3,0,-len);
        X.quadraticCurveTo(len*0.06,-len*0.3,0,len*0.12);
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        X.beginPath();X.moveTo(0,len*0.12);
        X.quadraticCurveTo(-len*0.045,-len*0.35,0,-len);
        X.quadraticCurveTo(len*0.045,-len*0.35,0,len*0.12);
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    baton: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        X.beginPath();X.roundRect(-len*0.025,len*0.1,len*0.05,-len-len*0.1,len*0.012);
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        X.beginPath();X.roundRect(-len*0.018,len*0.1,len*0.036,-len-len*0.1,len*0.009);
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    skeletonH: {
      hour:(cx,cy,a,len,col)=>_tapered(cx,cy,a,len,len*0.09,len*0.03,col,true),
      minute:(cx,cy,a,len,col)=>_tapered(cx,cy,a,len,len*0.065,len*0.02,col,true)
    },
    arrow: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        const w=len*0.035;
        X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(-w,-len*0.7);X.lineTo(-w*1.8,-len*0.7);X.lineTo(0,-len);X.lineTo(w*1.8,-len*0.7);X.lineTo(w,-len*0.7);X.lineTo(w,len*0.1);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        const w=len*0.025;
        X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(-w,-len*0.72);X.lineTo(-w*1.8,-len*0.72);X.lineTo(0,-len);X.lineTo(w*1.8,-len*0.72);X.lineTo(w,-len*0.72);X.lineTo(w,len*0.1);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    spade: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        const w=len*0.025;
        X.beginPath();X.moveTo(-w,len*0.12);X.lineTo(-w,-len*0.65);
        X.quadraticCurveTo(-len*0.07,-len*0.85,0,-len);
        X.quadraticCurveTo(len*0.07,-len*0.85,w,-len*0.65);
        X.lineTo(w,len*0.12);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        const w=len*0.018;
        X.beginPath();X.moveTo(-w,len*0.12);X.lineTo(-w,-len*0.68);
        X.quadraticCurveTo(-len*0.055,-len*0.88,0,-len);
        X.quadraticCurveTo(len*0.055,-len*0.88,w,-len*0.68);
        X.lineTo(w,len*0.12);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    cathedral: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        const w=len*0.03;
        X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(-w,-len*0.5);
        X.arc(0,-len*0.65,w*1.5,Math.PI*0.8,Math.PI*0.2,true);
        X.lineTo(w,-len*0.5);X.lineTo(w,len*0.1);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        const w=len*0.02;
        X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(-w,-len*0.55);
        X.arc(0,-len*0.7,w*1.5,Math.PI*0.8,Math.PI*0.2,true);
        X.lineTo(w,-len*0.55);X.lineTo(w,len*0.1);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    needle_minimal: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=4;
        X.beginPath();X.moveTo(0,len*0.15);X.lineTo(0,-len);
        X.strokeStyle=col;X.lineWidth=Math.max(1.2,len*0.015);X.lineCap='round';X.stroke();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=4;
        X.beginPath();X.moveTo(0,len*0.15);X.lineTo(0,-len);
        X.strokeStyle=col;X.lineWidth=Math.max(0.8,len*0.009);X.lineCap='round';X.stroke();X.restore();
      }
    }
  };

  /* ================================================================
   *  DIAL HELPERS
   * ================================================================ */
  function bezel(cx,cy,r,colors) {
    X.save();X.shadowColor='rgba(0,0,0,0.6)';X.shadowBlur=r*0.12;X.shadowOffsetY=r*0.04;
    const g=X.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
    g.addColorStop(0,colors[0]);g.addColorStop(0.5,colors[1]);g.addColorStop(1,colors[2]);
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle=g;X.fill();X.restore();
  }

  function ticks60(cx,cy,r,hCol,mCol,hW,mW) {
    for(let i=0;i<60;i++){
      const a=i*6*DEG2RAD,isH=i%5===0;
      const o=r*0.85,len=isH?r*0.09:r*0.035,inner=o-len;
      X.beginPath();X.moveTo(cx+Math.sin(a)*inner,cy-Math.cos(a)*inner);
      X.lineTo(cx+Math.sin(a)*o,cy-Math.cos(a)*o);
      X.strokeStyle=isH?hCol:mCol;X.lineWidth=isH?hW:mW;X.lineCap='round';X.stroke();
    }
  }

  function nums12(cx,cy,r,rFrac,font,col) {
    X.font=font;X.fillStyle=col;X.textAlign='center';X.textBaseline='middle';
    for(let n=1;n<=12;n++){const a=n*30*DEG2RAD;X.fillText(n.toString(),cx+Math.sin(a)*r*rFrac,cy-Math.cos(a)*r*rFrac);}
  }

  function angles(hrF,minF,secF) {
    return [hrF*30*DEG2RAD, minF*6*DEG2RAD, secF*6*DEG2RAD];
  }

  /* ================================================================
   *  52 CLOCK DESIGNS
   * ================================================================ */

  /* ── GHOST & FLOATING (13) ── */

  function drawGhostPure(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;
      X.beginPath();X.arc(cx+Math.sin(a)*r*0.88,cy-Math.cos(a)*r*0.88,Math.max(1.5,r*0.012),0,PI2);
      X.fillStyle='rgba(255,255,255,0.18)';X.fill();}
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.65)','rgba(255,255,255,0.45)',t.sec,false,0.7);
  }

  function drawGhostMist(cx,cy,r,hrF,minF,secF,t) {
    X.save();X.shadowColor=t.accent;X.shadowBlur=25;
    const g=X.createRadialGradient(cx,cy,0,cx,cy,r*0.7);
    g.addColorStop(0,t.glow);g.addColorStop(1,'rgba(0,0,0,0)');
    X.beginPath();X.arc(cx,cy,r*0.7,0,PI2);X.fillStyle=g;X.fill();X.restore();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff','rgba(255,255,255,0.85)',t.sec,true);
  }

  function drawGhostPrism(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    // Chromatic offset hands
    drawHandSet(cx-1.5,cy,r,ha,ma,sa,'rgba(239,68,68,0.7)','rgba(239,68,68,0.5)',null);
    drawHandSet(cx+1.5,cy,r,ha,ma,sa,'rgba(56,189,248,0.7)','rgba(56,189,248,0.5)',null);
    drawHandSet(cx,cy,r,ha,ma,sa,'#ffffff','rgba(255,255,255,0.9)',t.sec,true);
  }

  function drawGhostWireframe(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r*0.9,0,PI2);
    X.strokeStyle='rgba(255,255,255,0.06)';X.lineWidth=0.5;X.stroke();
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;
      X.beginPath();X.moveTo(cx+Math.sin(a)*r*0.82,cy-Math.cos(a)*r*0.82);
      X.lineTo(cx+Math.sin(a)*r*0.88,cy-Math.cos(a)*r*0.88);
      X.strokeStyle='rgba(255,255,255,0.2)';X.lineWidth=0.8;X.stroke();}
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,t.accent,'rgba(255,255,255,0.7)',t.sec,true);
  }

  function drawGhostShadow(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    // Soft floating dark shadow hands with zero outline
    drawHandSet(cx+3,cy+4,r,ha,ma,sa,'rgba(0,0,0,0.55)','rgba(0,0,0,0.4)',null);
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.9)','rgba(255,255,255,0.7)',t.sec);
  }

  function drawGhostEmber(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.7)','rgba(255,255,255,0.5)',t.sec);
    // Floating glowing ember particles at tips
    const hx=cx+Math.sin(ha)*r*0.5, hy=cy-Math.cos(ha)*r*0.5;
    const mx=cx+Math.sin(ma)*r*0.74, my=cy-Math.cos(ma)*r*0.74;
    X.save();X.shadowColor='#f97316';X.shadowBlur=12;
    X.beginPath();X.arc(hx,hy,Math.max(3,r*0.025),0,PI2);X.fillStyle='#f97316';X.fill();
    X.beginPath();X.arc(mx,my,Math.max(2.5,r*0.02),0,PI2);X.fillStyle='#fbbf24';X.fill();
    X.restore();
  }

  function drawGhostGlass(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    X.save();X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=15;
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.4)','rgba(255,255,255,0.25)',t.sec,true);
    X.restore();
  }

  function drawGhostStarlight(cx,cy,r,hrF,minF,secF,t) {
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;
      X.save();X.shadowColor='#fff';X.shadowBlur=6;
      X.beginPath();X.arc(cx+Math.sin(a)*r*0.85,cy-Math.cos(a)*r*0.85,Math.max(1.8,r*0.014),0,PI2);
      X.fillStyle='#fff';X.fill();X.restore();}
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff','rgba(255,255,255,0.8)',t.sec,true);
  }

  function drawGhostPulsar(cx,cy,r,hrF,minF,secF,t) {
    const pulse=1+Math.sin(Date.now()*0.004)*0.08;
    X.save();X.shadowColor=t.accent;X.shadowBlur=16*pulse;
    X.beginPath();X.arc(cx,cy,r*0.06*pulse,0,PI2);X.fillStyle=t.accent;X.fill();X.restore();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff',t.accent,t.sec,true);
  }

  function drawGhostCyberpunk(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    X.save();X.shadowColor='#06b6d4';X.shadowBlur=8;
    drawHandSet(cx,cy,r,ha,ma,sa,'#06b6d4','#ec4899',t.sec,true);
    X.restore();
  }

  function drawGhostZenith(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(226,232,240,0.85)','rgba(203,213,225,0.65)',t.sec,false,0.85);
  }

  function drawHandsOnlyDark(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;
      X.beginPath();X.arc(cx+Math.sin(a)*r*0.88,cy-Math.cos(a)*r*0.88,Math.max(1.5,r*0.012),0,PI2);
      X.fillStyle='rgba(255,255,255,0.12)';X.fill();}
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.85)','rgba(255,255,255,0.6)',t.sec);
  }

  function drawHandsOnlyGlow(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;
      X.save();X.shadowColor=t.accent;X.shadowBlur=4;
      X.beginPath();X.arc(cx+Math.sin(a)*r*0.88,cy-Math.cos(a)*r*0.88,Math.max(1.5,r*0.012),0,PI2);
      X.fillStyle=t.accent;X.fill();X.restore();}
    X.save();X.shadowColor=t.accent;X.shadowBlur=8;
    drawHandSet(cx,cy,r,ha,ma,sa,t.accent,'rgba(255,255,255,0.7)',t.sec,true);
    X.restore();
  }

  /* ── WITH DIAL (25) ── */

  function drawClassic(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#2e2e38','#1b1b22','#111116']);
    X.beginPath();X.arc(cx,cy,r-0.5,0,PI2);X.strokeStyle='rgba(255,255,255,0.12)';X.lineWidth=1;X.stroke();
    const gf=X.createRadialGradient(cx,cy-r*0.2,r*0.05,cx,cy,r*0.88);
    gf.addColorStop(0,'#fff');gf.addColorStop(0.8,'#ebeef2');gf.addColorStop(1,'#ced4da');
    X.beginPath();X.arc(cx,cy,r*0.88,0,PI2);X.fillStyle=gf;X.fill();
    ticks60(cx,cy,r,'#0f172a','rgba(15,23,42,0.35)',Math.max(2,r*0.016),Math.max(0.8,r*0.005));
    nums12(cx,cy,r,0.67,'600 '+(r*0.15)+'px "Inter",sans-serif','#0f172a');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#0f172a','#1e293b',t.sec);
  }

  function drawMinimal(cx,cy,r,hrF,minF,secF,t) {
    X.save();X.shadowColor='rgba(0,0,0,0.6)';X.shadowBlur=r*0.1;
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#09090b';X.fill();X.restore();
    X.beginPath();X.arc(cx,cy,r-1,0,PI2);X.strokeStyle=t.accent;X.lineWidth=1.5;X.stroke();
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;const s=i%3===0?Math.max(2.5,r*0.022):Math.max(1.2,r*0.01);
      X.beginPath();X.arc(cx+Math.sin(a)*r*0.82,cy-Math.cos(a)*r*0.82,s,0,PI2);
      X.fillStyle=i%3===0?'#fff':'rgba(255,255,255,0.25)';X.fill();}
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff','rgba(255,255,255,0.85)',t.accent,true);
  }

  function drawRoman(cx,cy,r,hrF,minF,secF,t) {
    X.save();X.shadowColor='rgba(0,0,0,0.7)';X.shadowBlur=r*0.12;
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0c0a09';X.fill();X.restore();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle='#d97706';X.lineWidth=2.5;X.stroke();
    const rom=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
    X.font='600 '+(r*0.13)+'px serif';X.fillStyle='#fef3c7';X.textAlign='center';X.textBaseline='middle';
    rom.forEach((n,i)=>{const a=i*30*DEG2RAD;X.fillText(n,cx+Math.sin(a)*r*0.74,cy-Math.cos(a)*r*0.74);});
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fef3c7','#fde68a','#ef4444');
  }

  function drawNeon(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#030712';X.fill();
    X.save();X.shadowColor=t.accent;X.shadowBlur=18;
    X.beginPath();X.arc(cx,cy,r-1,0,PI2);X.strokeStyle=t.accent;X.lineWidth=2;X.stroke();X.restore();
    nums12(cx,cy,r,0.68,'600 '+(r*0.12)+'px "Inter",sans-serif',t.accent);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff','#ddd',t.sec,true);
  }

  function drawSkeleton(cx,cy,r,hrF,minF,secF,t) {
    X.save();X.shadowColor='rgba(0,0,0,0.8)';X.shadowBlur=r*0.1;
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0f172a';X.fill();X.restore();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle=t.accent;X.lineWidth=1.5;X.stroke();
    ticks60(cx,cy,r,t.accent,'rgba(255,255,255,0.2)',1.5,0.6);
    nums12(cx,cy,r,0.56,'400 '+(r*0.13)+'px "Inter",sans-serif','rgba(255,255,255,0.7)');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.9)',t.accent,t.sec);
  }

  function drawChrono(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#27272a','#18181b','#09090b']);
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD,o=r*0.85,len=r*0.08,inner=o-len;
      X.beginPath();X.moveTo(cx+Math.sin(a)*inner,cy-Math.cos(a)*inner);
      X.lineTo(cx+Math.sin(a)*o,cy-Math.cos(a)*o);X.strokeStyle='#f4f4f5';X.lineWidth=Math.max(2.5,r*0.02);X.stroke();}
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fafafa','#e4e4e7','#dc2626');
  }

  function drawBauhaus(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#f8fafc';X.fill();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle='#0f172a';X.lineWidth=3;X.stroke();
    ticks60(cx,cy,r,'#0f172a','#0f172a',3,1);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#0f172a','#0f172a','#e11d48');
  }

  function drawSwiss(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#fafafa';X.fill();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle='#71717a';X.lineWidth=r*0.04;X.stroke();
    ticks60(cx,cy,r,'#18181b','#52525b',3,1);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#18181b','#18181b','#dc2626');
  }

  function drawPilot(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0a0a0f';X.fill();
    ticks60(cx,cy,r,'#e2e8f0','rgba(255,255,255,0.15)',2,0.5);
    nums12(cx,cy,r,0.67,'600 '+(r*0.14)+'px "Inter",sans-serif','#e2e8f0');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#e2e8f0','#cbd5e1',t.sec);
  }

  function drawDiver(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0c1117';X.fill();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle='#374151';X.lineWidth=r*0.06;X.stroke();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#e2e8f0','#94a3b8',t.sec);
  }

  function drawArtDeco(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#1a1814';X.fill();
    nums12(cx,cy,r,0.6,'600 '+(r*0.13)+'px serif','#d4a574');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fef3c7','#d4a574','#ef4444');
  }

  function drawSundial(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#f5f0e6';X.fill();
    const [ha,ma]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,0,'#5c4a32','#8b7355','rgba(0,0,0,0)');
  }

  function drawDashboard(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#111111';X.fill();
    nums12(cx,cy,r,0.64,'500 '+(r*0.12)+'px "Inter",sans-serif','#aaa');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#ffffff','#cccccc',t.accent);
  }

  function drawDotMatrix(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0a0a12';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,t.accent,'rgba(255,255,255,0.7)',t.sec,true);
  }

  function drawFloatingNum(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0e0e18';X.fill();
    nums12(cx,cy,r,0.82,'500 '+(r*0.1)+'px "Inter",sans-serif',t.accent);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.8)','rgba(255,255,255,0.55)',t.sec,true);
  }

  /* NEW DIAL DESIGNS (+10) */

  function drawAstronomy(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#030712';X.fill();
    // Star map dots
    for(let i=0;i<30;i++){
      const sx=cx+(Math.sin(i*7)*0.7)*r, sy=cy+(Math.cos(i*13)*0.7)*r;
      X.beginPath();X.arc(sx,sy,Math.max(0.6,r*0.008),0,PI2);
      X.fillStyle='rgba(255,255,255,0.3)';X.fill();
    }
    nums12(cx,cy,r,0.74,'400 '+(r*0.12)+'px serif','#c084fc');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#c084fc','#e9d5ff',t.sec,true);
  }

  function drawSubmariner(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#0284c7','#0369a1','#075985']);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#f0f9ff','#bae6fd',t.sec);
  }

  function drawIndustrial(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#475569','#334155','#1e293b']);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#f8fafc','#cbd5e1','#f97316');
  }

  function drawPapercraft(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#f1f5f9';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#334155','#64748b','#ef4444');
  }

  function drawRetroLCD(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#84cc16';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#1a2e05','#2d4a09','#1a2e05');
  }

  function drawZen(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#1c1917';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#e7e5e4','#a8a29e',t.sec);
  }

  function drawHologram(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#042f2e';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#2dd4bf','#99f6e4',t.sec,true);
  }

  function drawCopper(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#b45309','#92400e','#78350f']);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fef3c7','#fde68a','#ef4444');
  }

  function drawMonochrome(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#000000';X.fill();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle='#ffffff';X.lineWidth=4;X.stroke();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#ffffff','#ffffff','#ffffff');
  }

  function drawRegatta(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#1e3a8a','#1e40af','#1d4ed8']);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#ffffff','#e0e7ff','#ef4444');
  }

  /* ── UNIQUE MOTION (14) ── */

  function drawOrbit(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#020617';X.fill();
    const rH=r*0.45,rM=r*0.68,rS=r*0.88;
    [rH,rM,rS].forEach((o,i)=>{X.beginPath();X.arc(cx,cy,o,0,PI2);
      X.strokeStyle=i===2?t.glow:'rgba(255,255,255,0.08)';X.lineWidth=i===2?1.5:1;X.stroke();});
    const [ha,ma,sa]=angles(hrF,minF,secF);
    const hx=cx+Math.sin(ha)*rH,hy=cy-Math.cos(ha)*rH;
    X.beginPath();X.moveTo(cx,cy);X.lineTo(hx,hy);X.strokeStyle='rgba(255,255,255,0.4)';X.lineWidth=2;X.stroke();
    X.beginPath();X.arc(hx,hy,Math.max(5,r*0.04),0,PI2);X.fillStyle='#fff';X.fill();
    const mx=cx+Math.sin(ma)*rM,my=cy-Math.cos(ma)*rM;
    X.beginPath();X.moveTo(cx,cy);X.lineTo(mx,my);X.strokeStyle=t.accent;X.lineWidth=1.5;X.stroke();
    X.beginPath();X.arc(mx,my,Math.max(4,r*0.03),0,PI2);X.fillStyle=t.accent;X.fill();
    const sx=cx+Math.sin(sa)*rS,sy=cy-Math.cos(sa)*rS;
    X.save();X.shadowColor=t.sec;X.shadowBlur=12;
    X.beginPath();X.moveTo(cx,cy);X.lineTo(sx,sy);X.strokeStyle=t.sec;X.lineWidth=0.9;X.stroke();
    X.beginPath();X.arc(sx,sy,Math.max(3,r*0.025),0,PI2);X.fillStyle=t.sec;X.fill();X.restore();
    X.beginPath();X.arc(cx,cy,Math.max(4,r*0.03),0,PI2);X.fillStyle='#fff';X.fill();
  }

  function drawConcentric(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#050510';X.fill();
    const rings=[{f:secF/60,r:r*0.88,w:r*0.04,col:t.sec},{f:minF/60,r:r*0.68,w:r*0.06,col:t.accent},{f:hrF/12,r:r*0.45,w:r*0.08,col:'#fff'}];
    rings.forEach(ring=>{
      X.beginPath();X.arc(cx,cy,ring.r,0,PI2);X.strokeStyle='rgba(255,255,255,0.06)';X.lineWidth=ring.w;X.stroke();
      const arc=ring.f*PI2;
      X.save();X.shadowColor=ring.col;X.shadowBlur=8;
      X.beginPath();X.arc(cx,cy,ring.r,-Math.PI/2,-Math.PI/2+arc);
      X.strokeStyle=ring.col;X.lineWidth=ring.w;X.lineCap='round';X.stroke();X.restore();
    });
  }

  function drawRadar(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#020a08';X.fill();
    const sa=secF*6*DEG2RAD-Math.PI/2;
    const sweepGrad=X.createConicGradient(sa,cx,cy);
    sweepGrad.addColorStop(0,'rgba(16,185,129,0.35)');sweepGrad.addColorStop(0.15,'rgba(16,185,129,0)');
    sweepGrad.addColorStop(1,'rgba(16,185,129,0)');
    X.beginPath();X.arc(cx,cy,r*0.9,0,PI2);X.fillStyle=sweepGrad;X.fill();
  }

  function drawGradientArc(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#09090b';X.fill();
    const now=new Date();let h12=now.getHours()%12||12;
    X.font='600 '+(r*0.22)+'px "Inter",sans-serif';X.fillStyle='#fff';X.textAlign='center';X.textBaseline='middle';
    X.fillText(String(h12).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),cx,cy);
  }

  /* NEW MOTION DESIGNS (+10) */

  function drawHourglass(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0c0a09';X.fill();
    const now=new Date();let h12=now.getHours()%12||12;
    X.font='600 '+(r*0.2)+'px "Inter",sans-serif';X.fillStyle=t.accent;X.textAlign='center';X.textBaseline='middle';
    X.fillText(String(h12).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),cx,cy);
  }

  function drawSonar(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#030712';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,t.accent,'#38bdf8',t.sec,true);
  }

  function drawSine(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#09090b';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff',t.accent,t.sec,true);
  }

  function drawDNA(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#020617';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#38bdf8',t.accent,t.sec,true);
  }

  function drawPendulum(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0f172a';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#f8fafc',t.accent,t.sec);
  }

  function drawCompass(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#1c1917';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#ef4444','#f8fafc',t.sec);
  }

  function drawEclipseMotion(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#000';X.fill();
    X.save();X.shadowColor=t.accent;X.shadowBlur=20;
    X.beginPath();X.arc(cx,cy,r*0.8,0,PI2);X.strokeStyle=t.accent;X.lineWidth=4;X.stroke();X.restore();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff',t.accent,t.sec,true);
  }

  function drawMatrixRain(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#022c22';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#4ade80','#22c55e','#ef4444',true);
  }

  function drawEqualizer(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0f172a';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#38bdf8',t.accent,t.sec,true);
  }

  function drawVortex(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#090514';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#c084fc',t.accent,t.sec,true);
  }

  /* ── Router Map (52) ── */
  const STYLES = {
    // Ghost / Hands Only (13)
    handsonly_ghost:drawGhostPure, ghost_mist:drawGhostMist, ghost_prism:drawGhostPrism,
    ghost_wireframe:drawGhostWireframe, ghost_shadow:drawGhostShadow, ghost_ember:drawGhostEmber,
    ghost_glass:drawGhostGlass, ghost_starlight:drawGhostStarlight, ghost_pulsar:drawGhostPulsar,
    ghost_cyberpunk:drawGhostCyberpunk, ghost_zenith:drawGhostZenith, handsonly_dark:drawHandsOnlyDark,
    handsonly_glow:drawHandsOnlyGlow,

    // With Dial (25)
    classic:drawClassic, minimal:drawMinimal, roman:drawRoman, neon:drawNeon,
    skeleton:drawSkeleton, chrono:drawChrono, bauhaus:drawBauhaus, swiss:drawSwiss,
    pilot:drawPilot, diver:drawDiver, artdeco:drawArtDeco, sundial:drawSundial,
    dashboard:drawDashboard, dotmatrix:drawDotMatrix, floatingnum:drawFloatingNum,
    astronomy:drawAstronomy, submariner:drawSubmariner, industrial:drawIndustrial,
    papercraft:drawPapercraft, retrodigital:drawRetroLCD, zen:drawZen,
    hologram:drawHologram, copper:drawCopper, monochrome:drawMonochrome, regatta:drawRegatta,

    // Unique Motion (14)
    orbit:drawOrbit, concentric:drawConcentric, radar:drawRadar, gradientarc:drawGradientArc,
    hourglass:drawHourglass, sonar:drawSonar, sine:drawSine, dna:drawDNA,
    pendulum:drawPendulum, compass:drawCompass, eclipse_motion:drawEclipseMotion,
    matrix_rain:drawMatrixRain, equalizer:drawEqualizer, vortex:drawVortex
  };

  function draw() {
    const w=window.innerWidth,h=window.innerHeight;
    const cx=w/2,cy=h/2,r=Math.min(cx,cy)-4;
    const now=new Date();
    const sec=now.getSeconds(),ms=now.getMilliseconds();
    const secF=sec+ms/1000, minF=now.getMinutes()+secF/60, hrF=(now.getHours()%12)+minF/60;
    const t=THEMES[theme]||THEMES.midnight;
    X.clearRect(0,0,w,h);
    (STYLES[style]||drawGhostPure)(cx,cy,r,hrF,minF,secF,t);
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
