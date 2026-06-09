// Procedural human-anatomy fighter renderer (NES Punch-Out style). Draws each
// fighter to an offscreen buffer, wraps it in a bold dark outline, and blits it
// pixel-crisp. Per-fighter identity is a `look` data object (see opponents.js).
import { PAL, FIGHTER } from './config.js';
import { shade } from './gfx.js';

const GOLD = PAL.gold;
const OUT = FIGHTER.OUTLINE;
const IW = 150, IH = 216, CX = 75, FEET = 190;   // offscreen geometry (internal px)

function newCv(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.imageSmoothingEnabled=false; return [c,x]; }
function outlineCanvas(art){ const w=art.width,h=art.height; const [out,o]=newCv(w,h);
  const [dark,dc]=newCv(w,h); dc.drawImage(art,0,0); dc.globalCompositeOperation='source-in'; dc.fillStyle=OUT; dc.fillRect(0,0,w,h);
  for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]) o.drawImage(dark,dx,dy);
  o.drawImage(art,0,0); return out; }
function colors(h){ return { body:h.body, bodyHi:shade(h.body,42), bodySh:shade(h.body,-40),
  trim:h.trim, trimHi:shade(h.trim,30), trimSh:shade(h.trim,-28),
  skin:h.skin, skinSh:shade(h.skin,-30), skinHi:shade(h.skin,24) }; }

function geom(B){
  const h=B.hgt||1, hd=B.head||1;
  const segBoot=7, segCalf=17*h, segThigh=25*h, segTrunk=18*h, segTorso=30*h, segNeck=6*h, headH=27*hd;
  const yFeet=FEET, yAnkle=yFeet-segBoot, yKnee=yAnkle-segCalf, yHip=yKnee-segThigh,
        yWaist=yHip-segTrunk, yShoulder=yWaist-segTorso, yNeck=yShoulder-segNeck,
        yHeadBot=yNeck, yHeadTop=yHeadBot-headH, yHeadC=(yHeadBot+yHeadTop)/2;
  return { headRx:11*hd, headRy:headH/2, yHeadC, yHeadTop, yNeck, yShoulder, yWaist, yHip, yKnee, yAnkle, yFeet,
    neckW:7*hd, shoulderHalf:28*(B.shoulder||1), chestHalf:21*(B.chest||1),
    waistHalf:14*(B.waist||1)+(B.belly?5:0), hipHalf:17*(B.hip||1),
    thighHalf:8*(B.thigh||1), calfHalf:6*(B.thigh||1), gloveR:9*(B.glove||1),
    upperW:9*(B.shoulder||1)*0.55+6, foreW:7*(B.glove||1)*0.5+5, belly:B.belly };
}

function poseFor(g,pose,step,look){
  const shY=g.yShoulder+3, shL=CX-g.shoulderHalf*0.8, shR=CX+g.shoulderHalf*0.8;
  const chin=g.yHeadC+g.headRy*0.6, bob=Math.sin(step*0.5)*(look.bob??1.2);
  let L={sh:[shL,shY], el:[shL-3,shY+20], gl:[CX-13,chin+12+bob]};
  let R={sh:[shR,shY], el:[shR+3,shY+20], gl:[CX+13,chin+12-bob]};
  let leanX=0, sink=0, fx=null, label=pose.toUpperCase(), expose=false;
  if(pose==='guard'){ L.gl=[CX-9,chin+2]; R.gl=[CX+9,chin+2]; }
  else if(pose==='jab'){ R.gl=[CX+4,chin+16]; R.el=[shR+5,shY+15]; L.gl=[CX-9,chin+2]; label='JAB'; }
  else if(pose==='hook'){ R.gl=[CX-6,chin-6]; R.el=[shR+10,shY+12]; L.gl=[CX-9,chin+2]; leanX=4; label='HOOK'; }
  else if(pose==='special'){
    const sp=look.special||{}; label=sp.name||'SPECIAL'; fx=sp.fx; const f=sp.frame;
    const HI=g.yHeadC-g.headRy-6;
    if(f==='bothLow'){ L.gl=[CX-7,chin+14]; R.gl=[CX+7,chin+14]; L.el=[shL-2,shY+16]; R.el=[shR+2,shY+16]; sink=2; }
    else if(f==='bothHighFeint'){ L.gl=[CX-9,chin-2]; R.gl=[CX+9,chin-2]; }
    else if(f==='overhead'){ L.gl=[CX-18,HI]; R.gl=[CX+18,HI]; L.el=[shL-6,shY+6]; R.el=[shR+6,shY+6]; sink=5; }
    else if(f==='maul'){ L.gl=[CX-5,HI+2]; R.gl=[CX+5,HI+2]; L.el=[shL-4,shY+8]; R.el=[shR+4,shY+8]; sink=4; }
    else if(f==='crucifix'){ L.gl=[CX-30,shY+2]; R.gl=[CX+30,shY+2]; L.el=[shL-12,shY+4]; R.el=[shR+12,shY+4]; expose=true; }
    else if(f==='oneLoadedLow'){ R.gl=[CX-8,g.yWaist+4]; R.el=[shR+8,shY+18]; L.gl=[CX-9,chin]; leanX=4; }
    else if(f==='oneLoadedHigh'){ R.gl=[shR+14,shY+2]; R.el=[shR+12,shY+12]; L.gl=[CX-4,chin+16]; leanX=4; }
    else if(f==='counter'){ L.gl=[CX-9,g.yWaist]; R.gl=[CX+9,g.yWaist]; L.el=[shL-3,shY+16]; R.el=[shR+3,shY+16]; sink=2; }
    else if(f==='uppercut'){ R.gl=[CX+4,g.yWaist+6]; R.el=[shR+4,shY+20]; L.gl=[CX-9,chin]; sink=3; }
  }
  return {L,R,leanX,sink,fx,label,expose};
}
function drawArm(ctx,a,limbCol,glove,g){
  const cap=(p0,p1,w,col)=>{ ctx.strokeStyle=col; ctx.lineWidth=w; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.stroke(); };
  cap(a.sh,a.el,g.upperW,limbCol); cap(a.el,a.gl,g.foreW,limbCol);
  ctx.fillStyle=glove.g; ctx.beginPath(); ctx.arc(a.gl[0],a.gl[1],g.gloveR,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=glove.hi; ctx.beginPath(); ctx.arc(a.gl[0]-g.gloveR*0.3,a.gl[1]-g.gloveR*0.35,g.gloveR*0.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=glove.sh; ctx.fillRect(a.gl[0]-g.gloveR*0.7,a.gl[1]+g.gloveR*0.25,g.gloveR*1.4,g.gloveR*0.4);
}
function torsoPath(ctx,g){
  const {yShoulder,yWaist,yHip,shoulderHalf,chestHalf,waistHalf,hipHalf}=g;
  const yChest=yShoulder+(yWaist-yShoulder)*0.42;
  ctx.beginPath();
  ctx.moveTo(CX-shoulderHalf,yShoulder+4);
  ctx.quadraticCurveTo(CX-chestHalf-3,yChest,CX-waistHalf,yWaist);
  ctx.quadraticCurveTo(CX-hipHalf-2,(yWaist+yHip)/2,CX-hipHalf,yHip+1);
  ctx.lineTo(CX+hipHalf,yHip+1);
  ctx.quadraticCurveTo(CX+hipHalf+2,(yWaist+yHip)/2,CX+waistHalf,yWaist);
  ctx.quadraticCurveTo(CX+chestHalf+3,yChest,CX+shoulderHalf,yShoulder+4);
  ctx.quadraticCurveTo(CX,yShoulder-6,CX-shoulderHalf,yShoulder+4);
  ctx.closePath();
}
function drawLegs(ctx,g,C){
  const thW=g.thighHalf*2, caW=g.calfHalf*2, lx=CX-g.hipHalf*0.5, rx=CX+g.hipHalf*0.5;
  ctx.strokeStyle=C.body; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.lineWidth=thW; ctx.beginPath(); ctx.moveTo(lx,g.yHip-2); ctx.lineTo(lx-1,g.yKnee); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rx,g.yHip-2); ctx.lineTo(rx+1,g.yKnee); ctx.stroke();
  ctx.lineWidth=caW; ctx.beginPath(); ctx.moveTo(lx-1,g.yKnee); ctx.lineTo(lx-1,g.yAnkle); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rx+1,g.yKnee); ctx.lineTo(rx+1,g.yAnkle); ctx.stroke();
  ctx.fillStyle='#15151d';
  ctx.fillRect(lx-g.calfHalf-2,g.yAnkle-1,caW+4,g.yFeet-g.yAnkle+2);
  ctx.fillRect(rx-g.calfHalf-2,g.yAnkle-1,caW+4,g.yFeet-g.yAnkle+2);
}
function drawTorso(ctx,g,C){
  ctx.fillStyle=C.body; torsoPath(ctx,g); ctx.fill();
  ctx.save(); torsoPath(ctx,g); ctx.clip();
  ctx.fillStyle=C.bodySh; ctx.fillRect(CX,g.yShoulder-4,g.shoulderHalf+4,g.yHip-g.yShoulder+10);
  ctx.fillStyle=C.bodyHi; ctx.fillRect(CX-g.shoulderHalf,g.yShoulder-2,4,g.yHip-g.yShoulder+6);
  ctx.globalAlpha=0.45; ctx.fillStyle=C.bodySh;
  ctx.fillRect(CX-g.chestHalf*0.55,g.yShoulder+13,g.chestHalf*1.1,2);
  ctx.fillRect(CX-1,g.yShoulder+6,2,15);
  ctx.fillRect(CX-g.waistHalf*0.5,g.yShoulder+24,g.waistHalf,1.5); ctx.globalAlpha=1;
  ctx.restore();
  ctx.fillStyle=C.trim; ctx.fillRect(CX-g.hipHalf-1,g.yHip-11,(g.hipHalf+1)*2,13);
  ctx.fillStyle=C.trimHi; ctx.fillRect(CX-g.hipHalf-1,g.yHip-11,(g.hipHalf+1)*2,2);
  ctx.fillStyle=C.trim; ctx.fillRect(CX-g.hipHalf-1,g.yHip,(g.hipHalf+1)*2,6);
  ctx.clearRect(CX-1.5,g.yHip+2,3,5);
}
function drawTowers(ctx,g,C){
  for(const sx of [CX-g.shoulderHalf-2, CX+g.shoulderHalf-8]){
    ctx.fillStyle=C.trim; ctx.fillRect(sx,g.yShoulder-2,11,12);
    ctx.fillStyle=GOLD; ctx.fillRect(sx,g.yShoulder-3,3,2); ctx.fillRect(sx+4,g.yShoulder-3,3,2); ctx.fillRect(sx+8,g.yShoulder-3,3,2);
    ctx.fillStyle=C.trimHi; ctx.fillRect(sx,g.yShoulder-2,2,12);
  }
}
function drawHead(ctx,g,C,look){
  ctx.fillStyle=C.skin; ctx.fillRect(CX-g.neckW/2,g.yNeck-2,g.neckW,8);
  if(look.heavyJaw){ ctx.beginPath(); ctx.ellipse(CX,g.yHeadC+g.headRy*0.35,g.headRx*1.02,g.headRy*0.7,0,0,Math.PI*2); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(CX,g.yHeadC,g.headRx,g.headRy,0,0,Math.PI*2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(CX,g.yHeadC,g.headRx,g.headRy,0,0,Math.PI*2); ctx.clip();
  ctx.fillStyle=C.skinSh; ctx.fillRect(CX+g.headRx*0.28,g.yHeadC-g.headRy,g.headRx,g.headRy*2);
  const hc=look.hairCol||'#241813';
  if(look.hair!=='none'){
    if(look.hair==='sideSwept'){ ctx.fillStyle=hc; ctx.fillRect(CX-g.headRx,g.yHeadTop-1,g.headRx*2,g.headRy*0.7);
      ctx.fillStyle=shade(hc,18); ctx.fillRect(CX-g.headRx*0.2,g.yHeadTop+1,g.headRx*1.1,g.headRy*0.45); }
    else { ctx.fillStyle=hc; ctx.fillRect(CX-g.headRx,g.yHeadTop-1,g.headRx*2,g.headRy*0.82); }
    if(look.widowPeak){ ctx.fillStyle=hc; ctx.fillRect(CX-1.5,g.yHeadC-g.headRy*0.45,3,g.headRy*0.3); }
  }
  ctx.restore();
  if(look.hair==='stormMane'){
    ctx.fillStyle=hc;
    for(const dx of [-2,1,4,-5]){ const bx=CX+dx*g.headRx*0.18;
      ctx.beginPath(); ctx.moveTo(bx,g.yHeadTop+2); ctx.lineTo(bx+5,g.yHeadTop+4); ctx.lineTo(bx+2,g.yHeadTop-11); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle=C.trim; ctx.fillRect(CX-1,g.yHeadTop-9,3,8);
  }
}
const HAT={
  pawnDomeShort(ctx,g,C){ const t=g.yHeadTop, hw=g.headRx;
    ctx.fillStyle=C.body; ctx.beginPath(); ctx.ellipse(CX,t+2,hw*0.96,hw*0.8,0,Math.PI,0); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(CX,t+2,hw*0.96,hw*0.8,0,Math.PI,0); ctx.clip();
    ctx.fillStyle=C.bodyHi; ctx.fillRect(CX-hw,t-hw*0.8,hw*0.5,hw*0.9);
    ctx.fillStyle=C.bodySh; ctx.fillRect(CX+hw*0.3,t-hw*0.8,hw*0.7,hw*0.9); ctx.restore();
    ctx.fillStyle=C.trim; ctx.fillRect(CX-hw,t-1,hw*2,3); },
  pawnDomeTall(ctx,g,C){ const t=g.yHeadTop, hw=g.headRx;
    ctx.fillStyle=C.body; ctx.beginPath(); ctx.moveTo(CX-hw*0.8,t+2);
    ctx.quadraticCurveTo(CX-hw*0.95,t-hw*1.6,CX,t-hw*2.0); ctx.quadraticCurveTo(CX+hw*0.95,t-hw*1.6,CX+hw*0.8,t+2); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.bodyHi; ctx.fillRect(CX-hw*0.7,t-hw*1.4,hw*0.35,hw*1.4);
    ctx.fillStyle=C.trim; ctx.fillRect(CX-hw*0.8,t-1,hw*1.6,2.5); ctx.fillRect(CX-hw*0.5,t-hw*1.5,hw*1.0,1.5);
    ctx.fillStyle=C.trimHi; ctx.fillRect(CX-1.5,t-hw*2.1,3,2.5); },
  rookChimney(ctx,g,C){ const t=g.yHeadTop, hw=g.headRx, H=hw*2.6, w=hw*1.8;
    ctx.fillStyle=C.body; ctx.fillRect(CX-w/2,t-H,w,H+3);
    ctx.fillStyle=C.bodyHi; ctx.fillRect(CX-w/2,t-H,2,H);
    ctx.fillStyle=C.bodySh; ctx.fillRect(CX+w/2-3,t-H,3,H);
    ctx.clearRect(CX-w/2+w/3-1.5,t-H,3,4); ctx.clearRect(CX+w/2-w/3-1.5,t-H,3,4);
    ctx.fillStyle=C.trim; ctx.fillRect(CX-w/2,t-H*0.55,w,2.5);
    ctx.fillStyle=C.trimSh; ctx.fillRect(CX-1,t-H*0.78,2,5); },
  rookStub(ctx,g,C){ const t=g.yHeadTop, hw=g.headRx;
    ctx.fillStyle=C.trim; ctx.fillRect(CX-hw,t-3,hw*2,4);
    for(const dx of [-hw, -2.5, hw-5]){ ctx.fillStyle=C.trim; ctx.fillRect(CX+dx,t-9,5,6); ctx.fillStyle=C.trimHi; ctx.fillRect(CX+dx,t-9,1.5,6); } },
  knightVisor(ctx,g,C){ const t=g.yHeadTop, hw=g.headRx;
    ctx.fillStyle=C.trim; ctx.fillRect(CX-hw,t-1,hw*2,g.headRy*0.9);
    ctx.fillStyle=C.trimHi; ctx.fillRect(CX-hw,t-1,hw*2,2);
    ctx.fillStyle=C.trim; ctx.beginPath(); ctx.moveTo(CX+hw*0.5,g.yHeadC-g.headRy*0.3);
    ctx.lineTo(CX+hw*1.5,g.yHeadC-g.headRy*0.1); ctx.lineTo(CX+hw*1.4,g.yHeadC+g.headRy*0.2); ctx.lineTo(CX+hw*0.5,g.yHeadC+g.headRy*0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.trim; ctx.fillRect(CX-hw*0.7,t-7,3,7); ctx.fillRect(CX+hw*0.2,t-7,3,7);
    ctx.fillStyle=C.bodyHi; for(let i=0;i<4;i++) ctx.fillRect(CX-hw-2,t+i*3,2,2); },
  mitre(ctx,g,C){ const t=g.yHeadTop, hw=g.headRx, top=t-hw*2.4, ac=C.skinHi;
    const tri=(x0)=>{ ctx.beginPath(); ctx.moveTo(x0-hw*0.55,t+1); ctx.lineTo(x0+hw*0.55,t+1); ctx.lineTo(x0,top); ctx.closePath(); ctx.fill(); };
    ctx.fillStyle=C.trim; tri(CX-hw*0.5); tri(CX+hw*0.5);
    ctx.fillStyle=C.body; ctx.fillRect(CX-hw,t-hw*0.7,hw*2,hw*0.7);
    ctx.fillStyle=ac; ctx.fillRect(CX-1,t-hw*1.6,2,hw*1.6);
    ctx.fillStyle=ac; ctx.fillRect(CX-hw*0.8,t-2,hw*1.6,2); },
  queenCoronet(ctx,g,C){ const t=g.yHeadTop, hw=g.headRx;
    ctx.fillStyle=C.trim; ctx.fillRect(CX-hw,t-3,hw*2,3);
    ctx.fillStyle=C.body; ctx.fillRect(CX-hw,t-hw*0.9,hw*2,hw*0.6);
    for(const f of [-1,-0.5,0,0.5,1]){ const sx=CX+f*hw*0.9, top=t-hw*(f===0?1.7:1.4);
      ctx.fillStyle=C.body; ctx.fillRect(sx-1,top,2,t-hw*0.6-top);
      ctx.fillStyle=C.bodyHi; ctx.beginPath(); ctx.arc(sx,top,2.4,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle=C.trimHi; ctx.fillRect(CX-2,t-1.5,4,3); },
  kingCrown(ctx,g,C){ const t=g.yHeadTop, hw=g.headRx;
    ctx.fillStyle=GOLD; ctx.fillRect(CX-hw,t-hw*0.8,hw*2,hw*0.7);
    ctx.fillStyle=C.trim; ctx.fillRect(CX-hw,t-0.6,hw*2,2);
    for(const dx of [-hw*0.8,-1.2,hw*0.8-2]){ ctx.fillStyle=GOLD; ctx.fillRect(CX+dx,t-hw*1.4,2.4,hw*0.7); }
    ctx.fillStyle=GOLD; ctx.fillRect(CX-1,t-hw*2.2,2,hw*1.1); ctx.fillRect(CX-3,t-hw*1.9,6,2);
    ctx.fillStyle=shade(GOLD,40); ctx.fillRect(CX-hw,t-hw*0.8,hw*2,1.5); },
  amalgam(ctx,g,C){ const t=g.yHeadTop, hw=g.headRx;
    ctx.fillStyle=C.body; ctx.fillRect(CX-hw,t-hw*0.9,hw*2,hw*0.7);
    ctx.fillStyle=C.trim; ctx.fillRect(CX-hw,t-0.4,hw*2,2);
    for(const [dx,tp] of [[-hw*0.85,-hw*1.6],[-1.2,-hw*2.3],[hw*0.85-2,-hw*1.6]]){
      ctx.fillStyle=C.body; ctx.fillRect(CX+dx,t+tp,2.6,(-hw*0.9)-tp);
      ctx.fillStyle=GOLD; ctx.fillRect(CX+dx-0.4,t+tp-1.6,3.4,2); ctx.fillStyle=C.trim; ctx.fillRect(CX+dx+1,t+tp-1.6,0.7,2); }
    ctx.fillStyle=C.body; ctx.beginPath(); ctx.moveTo(CX+hw*0.4,g.yHeadC-g.headRy*0.4);
    ctx.lineTo(CX+hw*1.3,g.yHeadC-g.headRy*0.15); ctx.lineTo(CX+hw*1.2,g.yHeadC+g.headRy*0.15); ctx.lineTo(CX+hw*0.4,g.yHeadC); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.trim; ctx.fillRect(CX-hw,t-hw*1.0,2.5,5); ctx.fillRect(CX+hw-2.5,t-hw*1.0,2.5,5); },
  none(){},
};
function drawSash(ctx,g,look,C){ const s=look.sash; if(!s) return;
  const x0=s.dir==='LR'?CX-g.shoulderHalf*0.7:CX+g.shoulderHalf*0.7, x1=s.dir==='LR'?CX+g.waistHalf*0.7:CX-g.waistHalf*0.7;
  const y0=g.yShoulder+4, y1=g.yHip-4, w=s.wide?7:5;
  ctx.save(); torsoPath(ctx,g); ctx.clip();
  ctx.strokeStyle=C.trim; ctx.lineWidth=w; ctx.lineCap='butt';
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
  ctx.strokeStyle=OUT; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x0+w*0.4,y0+1); ctx.lineTo(x1+w*0.4,y1+1); ctx.stroke();
  ctx.strokeStyle=C.trimHi; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x0-w*0.4,y0); ctx.lineTo(x1-w*0.4,y1); ctx.stroke();
  if(s.pips){ ctx.fillStyle=C.bodyHi; for(let k=1;k<=s.pips;k++){ const tt=k/(s.pips+1); ctx.fillRect(x0+(x1-x0)*tt-1,y0+(y1-y0)*tt-1,2,2);} }
  if(s.stud){ ctx.fillStyle=GOLD; ctx.fillRect((x0+x1)/2-2,(y0+y1)/2-2,4,4); }
  ctx.restore();
}
function drawChest(ctx,g,look,C){ const m=look.emblem; if(!m) return; ctx.save(); torsoPath(ctx,g); ctx.clip();
  const cx=CX, y=g.yShoulder+10;
  if(m==='pawnGlyph'){ ctx.fillStyle=C.trim; ctx.beginPath(); ctx.arc(cx,y+2,2.4,0,Math.PI*2); ctx.fill(); ctx.fillRect(cx-3.5,y+8,7,2.4); ctx.fillRect(cx-1.6,y+4,3.2,5); }
  else if(m==='fork'){ ctx.fillStyle=C.trim; ctx.fillRect(cx-3,y+2,2,8); ctx.fillRect(cx+1,y+2,2,8); ctx.fillRect(cx-3,y+9,6,2); }
  else if(m==='brick'){ ctx.strokeStyle=C.trimSh; ctx.lineWidth=1.4; ctx.beginPath();
    ctx.moveTo(cx-g.chestHalf*0.7,y+4); ctx.lineTo(cx+g.chestHalf*0.7,y+4); ctx.moveTo(cx-3,y); ctx.lineTo(cx-3,y+8); ctx.moveTo(cx+3,y+4); ctx.lineTo(cx+3,y+12); ctx.stroke(); }
  else if(m==='rivets'){ for(const dy of [0,5,10]){ ctx.fillStyle=look._forge&&dy===5?'#ff7a18':C.trimSh; ctx.beginPath(); ctx.arc(cx,y+dy,1.8,0,Math.PI*2); ctx.fill(); } }
  else if(m==='kingcross'){ ctx.fillStyle=GOLD; ctx.fillRect(cx-1,y,2,9); ctx.fillRect(cx-3.5,y+3,8,2); }
  ctx.restore();
}
function drawFace(ctx,g,C,look){ const f=look.face||{}, hw=g.headRx, hh=g.headRy, hc=g.yHeadC;
  const eY=hc-hh*0.04, eDX=hw*0.42, bY=eY-hh*0.26, mY=hc+hh*0.44, eS=Math.max(1.6,hw*0.18);
  const bc=f.browCol||'#241813';
  if(f.brows==='hopeful'){ ctx.fillStyle=bc; ctx.fillRect(CX-eDX-eS,bY+1,eS*1.4,eS*0.7); ctx.fillRect(CX+eDX-eS*0.4,bY+1,eS*1.4,eS*0.7); }
  else if(f.brows==='cocked'){ ctx.fillStyle=bc; ctx.fillRect(CX-eDX-eS,bY-1,eS*1.5,eS*0.7); ctx.fillRect(CX+eDX-eS*0.4,bY+1,eS*1.5,eS*0.7); }
  else if(f.brows==='angryV'){ ctx.fillStyle=bc; ctx.fillRect(CX-eDX-eS*0.6,bY,eS*1.6,eS*0.8); ctx.fillRect(CX+eDX-eS,bY,eS*1.6,eS*0.8); ctx.fillRect(CX-eDX-eS,bY-1,eS,eS*0.7); ctx.fillRect(CX+eDX,bY-1,eS,eS*0.7); }
  else if(f.brows==='flatHeavy'){ ctx.fillStyle=bc; ctx.fillRect(CX-eDX-eS,bY,eS*2,eS*0.9); ctx.fillRect(CX+eDX-eS,bY,eS*2,eS*0.9); }
  else if(f.brows==='bar'){ ctx.fillStyle=bc; ctx.fillRect(CX-eDX-eS,bY,eDX*2+eS*2,eS*0.9); }
  else { ctx.fillStyle=bc; ctx.fillRect(CX-eDX-eS*0.5,bY,eS,eS*0.7); ctx.fillRect(CX+eDX-eS*0.5,bY,eS,eS*0.7); }
  ctx.fillStyle=f.eyeCol||'#1a1a1a'; ctx.fillRect(CX-eDX-eS*0.5,eY,eS,eS); ctx.fillRect(CX+eDX-eS*0.5,eY,eS,eS);
  if(f.hooded){ ctx.fillStyle=C.skinSh; ctx.fillRect(CX-eDX-eS*0.5,eY,eS,eS*0.45); ctx.fillRect(CX+eDX-eS*0.5,eY,eS,eS*0.45); }
  if(f.catchlight){ ctx.fillStyle=C.bodyHi; ctx.fillRect(CX-eDX,eY+eS*0.1,eS*0.4,eS*0.4); ctx.fillRect(CX+eDX,eY+eS*0.1,eS*0.4,eS*0.4); }
  if(f.glint){ ctx.fillStyle=GOLD; ctx.fillRect(CX-eDX-eS*0.4,eY,eS*0.7,eS*0.7); ctx.fillRect(CX+eDX-eS*0.3,eY,eS*0.7,eS*0.7); }
  ctx.fillStyle=C.skinSh; ctx.fillRect(CX-0.6,hc+hh*0.12,1.4,hh*0.18);
  if(f.mouth==='grin'){ ctx.fillStyle=shade(C.skin,-45); ctx.fillRect(CX-eDX*0.8,mY,eDX*1.6,1.6); ctx.fillStyle='#fff'; ctx.fillRect(CX-1.5,mY,3,1); }
  else if(f.mouth==='smirk'){ ctx.fillStyle=shade(C.skin,-45); ctx.fillRect(CX-eDX*0.7,mY,eDX*1.3,1.4); ctx.fillRect(CX-eDX*0.7,mY-1.2,1.6,1.4); }
  else if(f.mouth==='lipstick'){ ctx.fillStyle=C.trim; ctx.fillRect(CX-eDX*0.8,mY,eDX*1.6,1.8); }
  else { ctx.fillStyle=shade(C.skin,-45); ctx.fillRect(CX-eDX*0.8,mY,eDX*1.6,1.4); }
  if(f.goatee){ ctx.fillStyle='#241813'; ctx.fillRect(CX-1.5,mY+1.6,3,2.4); }
  if(f.stubble){ ctx.fillStyle=C.skinSh; for(const [a,b] of [[-3,2],[2,2],[-1,3],[1,2.4],[3,1.6],[-4,1]]) ctx.fillRect(CX+a,mY-2+b,0.9,0.9); }
  if(f.cheekMark){ ctx.fillStyle=C.trim; ctx.fillRect(CX+eDX+eS*0.5,eY+eS,1.4,1.4); }
  if(f.cheekDab){ ctx.fillStyle=C.skinHi; ctx.fillRect(CX-eDX-eS*0.7,eY+eS*1.4,1.6,1.6); ctx.fillRect(CX+eDX+eS*0.2,eY+eS*1.4,1.6,1.6); }
}
function drawFX(ctx,g,C,pp,step){ const t=step*0.1; ctx.save();
  const top=g.yHeadC-g.headRy-8;
  if(pp.fx==='pips'){ for(let i=0;i<3;i++){ const u=(t*0.6+i*0.33)%1; ctx.globalAlpha=1-u; ctx.fillStyle=C.trim; ctx.fillRect(CX+(i-1)*8,top-u*18,3,3); } }
  else if(pp.fx==='quake'||pp.fx==='forge'){ ctx.strokeStyle=pp.fx==='forge'?'#ff7a18':C.bodyHi; ctx.globalAlpha=0.5;
    for(let i=0;i<3;i++){ const r=10+i*14+Math.sin(t*4+i)*4; ctx.beginPath(); ctx.ellipse(CX,g.yFeet-2,r,r*0.28,0,0,Math.PI*2); ctx.stroke(); } }
  else if(pp.fx==='bolt'){ ctx.strokeStyle=C.bodyHi; ctx.lineWidth=2; ctx.globalAlpha=0.85; ctx.beginPath(); let px=CX-30,py=g.yShoulder; ctx.moveTo(px,py);
    for(let i=0;i<6;i++){ px+=10; py+=(i%2?-6:6); ctx.lineTo(px,py);} ctx.stroke(); }
  else if(pp.fx==='diag'){ ctx.strokeStyle=C.skinHi; ctx.lineWidth=2; ctx.globalAlpha=0.7; ctx.beginPath(); ctx.moveTo(CX-8,g.yWaist+4); ctx.lineTo(CX+8,g.yShoulder-2); ctx.stroke(); }
  else if(pp.fx==='streak'){ ctx.strokeStyle=C.bodyHi; ctx.globalAlpha=0.5; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(CX-26,g.yShoulder+i*4); ctx.lineTo(CX-12,g.yShoulder+i*4); ctx.stroke(); } }
  else if(pp.fx==='spark'){ for(let i=0;i<4;i++){ const a=t*3+i*1.6; ctx.globalAlpha=0.8; ctx.fillStyle=C.bodyHi; ctx.fillRect(CX+Math.cos(a)*9,top+6+Math.sin(a)*4,2,2);} }
  else if(pp.fx==='aura'){ ctx.globalAlpha=0.16+0.1*Math.sin(t*6); const gr=ctx.createRadialGradient(CX,g.yShoulder+6,3,CX,g.yShoulder+6,40); gr.addColorStop(0,GOLD); gr.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(CX,g.yShoulder+6,40,0,Math.PI*2); ctx.fill(); }
  ctx.restore();
}

function render(look,pose,step){
  const [art,ctx]=newCv(IW,IH); const g=geom(look); const C=colors(look.hue);
  const pp=poseFor(g,pose,step,look);
  look._forge = pp.fx==='forge';
  const glove = look.gloveTint==='orange' ? {g:C.body,hi:C.bodyHi,sh:C.bodySh} : {g:'#ededf2',hi:'#ffffff',sh:'#b9b9c6'};
  drawLegs(ctx,g,C);
  ctx.save(); ctx.translate(pp.leanX,pp.sink);
  drawArm(ctx,pp.R,C.body,glove,g);
  drawTorso(ctx,g,C);
  drawChest(ctx,g,look,C);
  drawSash(ctx,g,look,C);
  if(look.towers) drawTowers(ctx,g,C);
  drawHead(ctx,g,C,look);
  (HAT[look.headgear]||HAT.none)(ctx,g,C);
  drawArm(ctx,pp.L,C.body,glove,g);
  ctx.restore();
  const lined=outlineCanvas(art); const lctx=lined.getContext('2d');
  lctx.save(); lctx.translate(pp.leanX,pp.sink); drawFace(lctx,g,C,look); lctx.restore();
  if(pp.fx) drawFX(lctx,g,C,pp,step);
  return {lined,label:pp.label,geom:g};
}
