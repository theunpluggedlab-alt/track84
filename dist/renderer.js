import {RULES} from './engine.js';
import { ROWING } from './events.js';
import { STAGES } from './stages.js';

const FALLBACK = { year: 1984, city: 'Los Angeles', country: 'United States', cc: 'US', code: 'USA', stadium: "Stadium '84", flag: 'US', sky: ['#6b7fb8', '#2a2a4a'], stand: ['#4c4a5f', '#444357'], roof: '#3a3f4a', accent: '#d5ff64', landmark: 'palms' };

export class TrackRenderer {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.width=1000;this.height=470;
    this.stadium=new Image();this.stadium.src='./assets/stadium.png';this.camera=0;
    this.crowdSeed=1234567;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
  }
  resize(){const b=this.canvas.getBoundingClientRect();this.width=Math.max(1,b.width);this.height=Math.max(1,b.height);const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.width*d);this.canvas.height=Math.round(this.height*d);this.ctx.setTransform(d,0,0,d,0,0);this.ctx.imageSmoothingEnabled=false;}
  stageFor(e){
    const i = Number.isInteger(e?.stageIndex) ? e.stageIndex : 0;
    return STAGES[Math.min(STAGES.length-1, Math.max(0, i))] ?? FALLBACK;
  }
  draw(e,now){
    const c=this.ctx,w=this.width,h=this.height;
    const stage=this.stageFor(e);
    const horizon=h*.35;
    this.drawSky(c,w,horizon,stage);
    this.drawLandmark(c,stage.landmark,w,horizon,stage);
    this.drawStands(c,w,horizon,stage,e);
    // faint legacy texture, never obscures the national theme
    if(this.stadium.complete&&this.stadium.naturalWidth){
      c.save();c.globalAlpha=.10;
      const scale=Math.max(w/this.stadium.width,(horizon)/this.stadium.height);
      c.drawImage(this.stadium,(w-this.stadium.width*scale)/2,0,this.stadium.width*scale,this.stadium.height*scale);
      c.restore();
    }
    c.fillStyle='#15172a55';c.fillRect(0,0,w,horizon*.42);
    this.drawBanner(c,w,horizon,stage);
    // Rowing is a different course on the same stage dressing: bank, water and
    // sculls instead of the tartan track with hurdles.
    if(e?.mode==='rowing'){this.drawRegatta(c,w,h,horizon,stage,e,now);return;}
    // Lane geometry and actors are functional game graphics, rendered at pixel scale.
    const trackTop=horizon+7, laneH=(h-trackTop-23)/5, skew=18;
    const scale=Math.max(13,Math.min(30,w/32));
    const anchor=w<600?w*.26:w*.24;
    this.camera=Math.max(0,e.player.x*scale-(anchor-65));
    const sx=(metres,lane)=>65+metres*scale-this.camera+(2-lane)*9;
    const sy=(x,lane)=>trackTop+laneH*(lane+.5)-skew*x/w;
    for(let lane=0;lane<5;lane++){
      c.fillStyle=lane===2?'#464c3c':lane%2?'#444357':'#4c4a5f';
      c.beginPath();c.moveTo(0,trackTop+laneH*lane);c.lineTo(w,trackTop+laneH*lane-skew);c.lineTo(w,trackTop+laneH*(lane+1)-skew);c.lineTo(0,trackTop+laneH*(lane+1));c.fill();
      // Player lane gets the host-nation accent so the home crowd feels present.
      c.strokeStyle=lane===2?(stage.accent||'#acb880'):'#bcb5ce88';c.lineWidth=lane===2?2:1.4;
      c.beginPath();c.moveTo(0,trackTop+laneH*lane);c.lineTo(w,trackTop+laneH*lane-skew);c.stroke();
      // Course ticks slide with the runners.
      c.strokeStyle='#c0bcd523';c.lineWidth=1;
      for(let m=0;m<=110;m+=5){const x=sx(m,lane);if(x<-10||x>w+10)continue;c.beginPath();c.moveTo(x,sy(x,lane)-laneH*.35);c.lineTo(x-6,sy(x,lane)+laneH*.35);c.stroke();}
      const start=sx(0,lane),finish=sx(110,lane);
      if(start>-40){c.fillStyle='#e4dfed';c.fillRect(Math.round(start),sy(start,lane)-laneH/2,3,laneH);c.font=`bold ${Math.max(14,laneH*.36)}px monospace`;c.fillStyle='#d5cfe799';c.fillText(String(lane+1),start-25,sy(start,lane)+5);}
      if(finish>-20&&finish<w+30){for(let y=0;y<laneH;y+=6){c.fillStyle=(Math.floor(y/6)%2)?'#141522':'#edeee8';c.fillRect(finish,sy(finish,lane)-laneH/2+y,7,6);c.fillStyle=(Math.floor(y/6)%2)?'#edeee8':'#141522';c.fillRect(finish+7,sy(finish,lane)-laneH/2+y,7,6);}}
      const r=e.runners[lane];
      for(let j=0;j<RULES.hurdles.length;j++){
        const x=sx(RULES.hurdles[j],lane);
        if(x<-45||x>w+45)continue;
        this.hurdle(x,sy(x,lane)+laneH*.21,laneH,r.hurdleResults[j]==='hit',lane===2,j);
      }
      const x=sx(r.x,lane),y=sy(x,lane)+laneH*.21;
      if(x>-50&&x<w+50)this.runner(x,y,r,e,laneH,now);
    }
    c.fillStyle='#25283a';c.fillRect(0,h-21,w,21);c.fillStyle='#b1b3c0';c.font='10px monospace';
    const base=Math.floor(e.player.x/10)*10;
    for(let m=Math.max(0,base-20);m<=Math.min(110,base+60);m+=10){const x=sx(m,4);if(x<0||x>w)continue;c.fillRect(x,h-20,1,5);c.fillText(`${m}m`,x+5,h-7);}
    // Subtle scanlines keep the moving image crisp, without obscuring controls.
    c.fillStyle='#070a1214';for(let y=0;y<h;y+=4)c.fillRect(0,y,w,1);
    if(e.phase==='racing'&&e.player.fallRemaining>0){c.fillStyle='#ed755117';c.fillRect(0,0,w,h);}
  }
  drawSky(c,w,horizon,stage){
    const g=c.createLinearGradient(0,0,0,horizon+12);
    g.addColorStop(0,stage.sky[0]);g.addColorStop(1,stage.sky[1]);
    c.fillStyle=g;c.fillRect(0,0,w,horizon+12);
  }
  drawStands(c,w,horizon,stage,e){
    const standH=Math.max(26,horizon*.52);
    const y0=horizon-standH;
    // Roof in host-nation color
    c.fillStyle=stage.roof;c.fillRect(0,y0,w,Math.max(6,standH*.14));
    c.fillStyle='#00000033';c.fillRect(0,y0+Math.max(6,standH*.14),w,2);
    // Two tiers in stadium stone colors
    c.fillStyle=stage.stand[0];c.fillRect(0,y0+standH*.14,w,standH*.42);
    c.fillStyle=stage.stand[1];c.fillRect(0,y0+standH*.56,w,standH*.44);
    c.fillStyle='#0000002e';c.fillRect(0,y0+standH*.54,w,2);
    // Crowd dots (deterministic pseudo-random, cheap)
    let s=(e?.stageIndex??0)*7919+11;
    const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
    const cols=['#f3f1ff','#ffd96d','#ff936a','#9a90ff','#63d8ed','#20242e'];
    for(let i=0;i<Math.min(420,w*0.9);i++){
      const x=rnd()*w, yy=y0+standH*.18+rnd()*standH*.74;
      c.fillStyle=cols[(rnd()*cols.length)|0];
      c.fillRect(x|0,yy|0,2,2);
    }
    // Flag bunting across the stand
    const n=Math.max(8,Math.floor(w/64));
    for(let i=0;i<n;i++){
      const x=(i+0.5)*(w/n);
      c.strokeStyle='#00000055';c.beginPath();c.moveTo(x-14,y0+standH*.14);c.lineTo(x,y0+standH*.14+9);c.lineTo(x+14,y0+standH*.14);c.stroke();
      this.drawFlag(c,x-9,y0+standH*.14+1,18,12,stage.flag);
    }
    // Big host flag on the left of the stand
    const fw=Math.min(64,Math.max(38,w*.07)), fh=fw*.66;
    c.fillStyle='#00000066';c.fillRect(10,y0+standH*.30,fw+4,fh+4);
    this.drawFlag(c,12,y0+standH*.30+2,fw,fh,stage.flag);
    c.fillStyle='#ffffffdd';c.font=`bold ${Math.max(9,Math.min(12,fw*.22))}px monospace`;c.textAlign='left';
    c.fillText(stage.code||'',12,y0+standH*.30+fh+12);
  }
  drawBanner(c,w,horizon,stage){
    const narrow=w<600;
    const label=narrow?`${stage.year} ${String(stage.city).toUpperCase()}`:`${stage.year} ${String(stage.city).toUpperCase()} • ${String(stage.stadium).toUpperCase()}`;
    c.font=`bold ${Math.max(9,Math.min(13,w*.016))}px monospace`;
    const tw=c.measureText(label).width;
    const bw=Math.min(narrow?w-130:w-16,tw+28);
    // Narrow phones: dodge the top-left RACE badge; the DOM location chip is hidden there.
    const bx=narrow?w-bw-8:(w-bw)/2, by=Math.max(2,horizon-20), bh=18;
    c.fillStyle='#10121fee';c.fillRect(bx,by,bw,bh);
    c.strokeStyle=stage.accent||'#d5ff64';c.lineWidth=1;c.strokeRect(bx+.5,by+.5,bw-1,bh-1);
    c.fillStyle='#f3f1ff';c.textAlign='center';
    c.fillText(label,w/2,by+12.5);
    c.textAlign='left';
  }
  drawFlag(c,x,y,w,h,code){
    x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);
    c.save();
    c.fillStyle='#f3f1ff';c.fillRect(x,y,w,h);
    const rect=(rx,ry,rw,rh,col)=>{c.fillStyle=col;c.fillRect(x+rx*w,y+ry*h,rw*w,rh*h);};
    switch(code){
      case 'GR': // Greece: stripes + canton cross
        for(let i=0;i<9;i++)if(i%2===0)rect(0,i/9,1,1/9,'#0d5eaf');
        rect(0,0,.36,.55,'#0d5eaf');rect(.15,0,.06,.55,'#fff');rect(0,.22,.36,.11,'#fff');break;
      case 'FR': rect(0,0,1/3,1,'#0055a4');rect(2/3,0,1/3,1,'#ef4135');break;
      case 'US':
        for(let i=0;i<7;i++)if(i%2===0)rect(0,i/7,1,1/7,'#b31942');
        rect(0,0,.42,.54,'#0a3161');c.fillStyle='#fff';for(let i=0;i<3;i++)for(let j=0;j<4;j++)c.fillRect(x+2+j*3,y+2+i*3,1,1);break;
      case 'GB':
        rect(0,0,1,1,'#012169');c.strokeStyle='#fff';c.lineWidth=Math.max(1,h*.14);
        c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y+h);c.moveTo(x+w,y);c.lineTo(x,y+h);c.stroke();
        c.strokeStyle='#c8102e';c.lineWidth=Math.max(1,h*.09);
        c.beginPath();c.moveTo(x+w/2,y);c.lineTo(x+w/2,y+h);c.moveTo(x,y+h/2);c.lineTo(x+w,y+h/2);c.stroke();break;
      case 'SE': rect(0,0,1,1,'#006aa7');rect(.30,0,.18,1,'#fecc00');rect(0,.42,1,.16,'#fecc00');break;
      case 'BE': rect(0,0,1/3,1,'#000');rect(1/3,0,1/3,1,'#fdda24');rect(2/3,0,1/3,1,'#ef3340');break;
      case 'NL': rect(0,0,1,1/3,'#ae1c28');rect(0,2/3,1,1/3,'#21468b');break;
      case 'DE': rect(0,0,1,1/3,'#000');rect(0,1/3,1,1/3,'#dd0000');rect(0,2/3,1,1/3,'#ffce00');break;
      case 'FI': rect(.30,0,.20,1,'#002f6c');rect(0,.40,1,.20,'#002f6c');break;
      case 'AU':
        rect(0,0,1,1,'#00247d');rect(0,0,.5,.5,'#012169');
        c.strokeStyle='#fff';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+w*.5,y+h*.5);c.moveTo(x+w*.5,y);c.lineTo(x,y+h*.5);c.stroke();
        c.fillStyle='#fff';c.fillRect(x+w*.7,y+h*.2,2,2);c.fillRect(x+w*.8,y+h*.55,2,2);c.fillRect(x+w*.65,y+h*.7,2,2);break;
      case 'IT': rect(0,0,1/3,1,'#009246');rect(2/3,0,1/3,1,'#ce2b37');break;
      case 'JP': c.fillStyle='#bc002d';c.beginPath();c.arc(x+w/2,y+h/2,h*.28,0,Math.PI*2);c.fill();break;
      case 'MX': rect(0,0,1/3,1,'#006847');rect(2/3,0,1/3,1,'#ce1126');c.fillStyle='#8c6d3f';c.beginPath();c.arc(x+w/2,y+h/2,h*.14,0,Math.PI*2);c.fill();break;
      case 'CA': rect(0,0,.25,1,'#ff0000');rect(.75,0,.25,1,'#ff0000');c.fillStyle='#ff0000';c.beginPath();c.moveTo(x+w*.5,y+h*.18);c.lineTo(x+w*.62,y+h*.5);c.lineTo(x+w*.55,y+h*.5);c.lineTo(x+w*.58,y+h*.78);c.lineTo(x+w*.42,y+h*.78);c.lineTo(x+w*.45,y+h*.5);c.lineTo(x+w*.38,y+h*.5);c.closePath();c.fill();break;
      case 'SU': rect(0,0,1,1,'#cc0000');c.fillStyle='#ffd700';c.fillRect(x+w*.14,y+h*.2,w*.3,2);c.fillRect(x+w*.22,y+h*.12,2,h*.4);c.beginPath();c.arc(x+w*.62,y+h*.34,h*.13,0,Math.PI*2);c.fill();break;
      case 'KR': {
        c.fillStyle='#cd2e3a';c.beginPath();c.arc(x+w/2,y+h/2,h*.22,Math.PI*.5,Math.PI*1.5);c.fill();
        c.fillStyle='#0047a0';c.beginPath();c.arc(x+w/2,y+h/2,h*.22,-Math.PI*.5,Math.PI*.5);c.fill();
        c.strokeStyle='#000';c.lineWidth=1;
        for(let k=0;k<4;k++){const bx=x+w*(.08+(k%2)*.78), by=y+h*(.12+((k/2)|0)*.6);c.beginPath();c.moveTo(bx,by);c.lineTo(bx+6,by+6);c.stroke();}
        break;
      }
      case 'ES': rect(0,0,1,.25,'#aa151b');rect(0,.25,1,.5,'#f1bf00');rect(0,.75,1,.25,'#aa151b');break;
      case 'BR': rect(0,0,1,1,'#009b3a');c.fillStyle='#fedf00';c.beginPath();c.moveTo(x+w*.5,y+h*.08);c.lineTo(x+w*.92,y+h*.5);c.lineTo(x+w*.5,y+h*.92);c.lineTo(x+w*.08,y+h*.5);c.closePath();c.fill();c.fillStyle='#002776';c.beginPath();c.arc(x+w/2,y+h/2,h*.2,0,Math.PI*2);c.fill();break;
      case 'CN': rect(0,0,1,1,'#de2910');c.fillStyle='#ffde00';c.fillRect(x+w*.1,y+h*.15,3,3);c.fillRect(x+w*.28,y+h*.1,2,2);c.fillRect(x+w*.34,y+h*.28,2,2);break;
      default: rect(0,0,1,.33,'#002654');rect(0,.66,1,.34,'#ce1126');
    }
    c.strokeStyle='#00000088';c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);
    c.restore();
  }
  drawLandmark(c,kind,w,horizon,stage){
    const col='#1c2030cc';
    c.fillStyle=col;c.strokeStyle=col;
    const base=horizon-2;
    const cx=w*.78;
    switch(kind){
      case 'parthenon': { const lw=120,x0=cx-lw/2; c.fillRect(x0,base-26,lw,5); for(let i=0;i<8;i++)c.fillRect(x0+6+i*14,base-21,5,19); c.beginPath();c.moveTo(x0-6,base-26);c.lineTo(x0+lw/2,base-40);c.lineTo(x0+lw+6,base-26);c.closePath();c.fill(); break; }
      case 'eiffel': { c.beginPath();c.moveTo(cx-26,base);c.lineTo(cx-8,base-52);c.lineTo(cx+8,base-52);c.lineTo(cx+26,base);c.lineTo(cx+14,base);c.lineTo(cx+6,base-30);c.lineTo(cx-6,base-30);c.lineTo(cx-14,base);c.closePath();c.fill(); c.fillRect(cx-2,base-62,4,10); break; }
      case 'arch': { c.lineWidth=6;c.beginPath();c.arc(cx,base,30,Math.PI,0);c.stroke(); break; }
      case 'bigben': { c.fillRect(cx-10,base-64,20,64); c.beginPath();c.moveTo(cx-12,base-64);c.lineTo(cx,base-78);c.lineTo(cx+12,base-64);c.closePath();c.fill(); c.fillStyle='#f3f1ff';c.beginPath();c.arc(cx,base-52,5,0,Math.PI*2);c.fill(); break; }
      case 'cityhall': case 'tower72': case 'tower175': { const lean=kind==='tower175'?12:0; c.fillRect(cx-8,base-70,16,70); c.fillRect(cx-8+lean*.4,base-80,16,12); c.fillRect(cx-2,base-88,4,10); break; }
      case 'cathedral': { c.fillRect(cx-14,base-40,28,40); c.beginPath();c.moveTo(cx-10,base-40);c.lineTo(cx,base-76);c.lineTo(cx+10,base-40);c.closePath();c.fill(); break; }
      case 'tower': { c.fillRect(cx-6,base-56,12,56); c.fillRect(cx-12,base-60,24,6); break; }
      case 'palms': { for(const dx of [-30,10]){ c.fillRect(cx+dx,base-30,5,30); c.beginPath();c.arc(cx+dx+2,base-32,12,Math.PI,0);c.fill(); } break; }
      case 'gate': { for(let i=0;i<6;i++)c.fillRect(cx-40+i*14,base-26,7,26); c.fillRect(cx-46,base-30,92,5); break; }
      case 'mcg': { c.fillRect(cx-60,base-24,120,6); for(let i=0;i<5;i++)c.fillRect(cx-55+i*22,base-18,6,18); break; }
      case 'colosseum': { c.fillRect(cx-55,base-26,110,26); c.fillStyle=stage.sky[1]; for(let i=0;i<5;i++){c.beginPath();c.arc(cx-42+i*21,base-8,6,Math.PI,0);c.fill();} break; }
      case 'fuji': { c.fillStyle='#eef2f7';c.beginPath();c.moveTo(cx-60,base);c.lineTo(cx,base-52);c.lineTo(cx+60,base);c.closePath();c.fill(); c.fillStyle=col;c.beginPath();c.moveTo(cx-60,base);c.lineTo(cx-14,base-36);c.lineTo(cx+14,base-36);c.lineTo(cx+60,base);c.closePath();c.fill(); break; }
      case 'pyramid': { for(let i=0;i<5;i++)c.fillRect(cx-40+i*8,base-10-i*8,80-i*16,8); break; }
      case 'tent': { c.beginPath();c.moveTo(cx-70,base);c.lineTo(cx-35,base-44);c.lineTo(cx,base-12);c.lineTo(cx+35,base-44);c.lineTo(cx+70,base);c.closePath();c.fill(); break; }
      case 'kremlin': { c.fillRect(cx-60,base-14,120,14); for(const dx of [-45,-15,15,45]){c.fillRect(cx+dx-6,base-30,12,30);c.beginPath();c.moveTo(cx+dx-8,base-30);c.lineTo(cx+dx,base-40);c.lineTo(cx+dx+8,base-30);c.closePath();c.fill();} break; }
      case 'gate88': { c.fillRect(cx-30,base-34,8,34);c.fillRect(cx+22,base-34,8,34);c.fillRect(cx-34,base-40,68,7); break; }
      case 'sagrada': { for(let i=0;i<5;i++){c.fillRect(cx-36+i*15,base-58+i*4,8,58-i*4);} break; }
      case 'torch': { c.fillRect(cx-8,base-26,16,26); c.fillStyle='#ffb347';c.beginPath();c.arc(cx,base-32,8,0,Math.PI*2);c.fill(); break; }
      case 'opera': { for(let i=0;i<3;i++){c.beginPath();c.moveTo(cx-45+i*28,base);c.quadraticCurveTo(cx-35+i*28,base-42,cx-8+i*28,base);c.closePath();c.fill();} break; }
      case 'nest': { c.lineWidth=2;c.beginPath();c.ellipse(cx,base-16,52,16,0,0,Math.PI*2);c.stroke(); for(let i=-4;i<=4;i++){c.beginPath();c.moveTo(cx+i*12,base-30);c.lineTo(cx+i*8,base-2);c.stroke();} break; }
      case 'orbit': { c.lineWidth=3;c.beginPath();c.arc(cx,base-30,14,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(cx-24,base);c.lineTo(cx+20,base-52);c.stroke(); break; }
      case 'christ': { c.fillRect(cx-3,base-52,6,52);c.fillRect(cx-18,base-44,36,6);c.beginPath();c.arc(cx,base-54,5,0,Math.PI*2);c.fill(); break; }
    }
  }
  hurdle(x,y,laneH,down,highlight,index){
    const c=this.ctx, hh=Math.max(14,laneH*.46),width=Math.max(18,laneH*.43);
    x=Math.round(x);y=Math.round(y);
    c.fillStyle='#19192955';c.fillRect(x-width/2-2,y+1,width+10,3);
    if(down){c.fillStyle='#c0b4c0';c.fillRect(x-width/2,y-2,width+8,4);c.fillStyle='#eb996e';c.fillRect(x-5,y-2,7,4);return;}
    c.fillStyle=highlight?'#e8e5d2':'#b4b0c3';c.fillRect(x-width/2,y-hh,3,hh);c.fillRect(x+width/2-3,y-hh,3,hh);
    c.fillRect(x-width/2-3,y-hh,width+6,5);
    c.fillStyle=highlight?'#ff9f68':'#cc7f79';for(let z=0;z<width;z+=10)c.fillRect(x-width/2+z,y-hh,5,5);
    c.fillStyle='#302f40';c.fillRect(x-width/2+3,y-hh+5,width-6,2);
    if(highlight){c.fillStyle='#e7d7b7';c.font='9px monospace';c.fillText(String(index+1).padStart(2,'0'),x-6,y+12);}
  }
  runner(x,y,r,e,laneH,now){
    const c=this.ctx,p=Math.max(1.5,Math.min(3.2,laneH/21)),jump=e.heightAt(r.jumpAge)*laneH*.46;
    c.fillStyle='#16182666';c.fillRect(Math.round(x-9*p),Math.round(y),17*p,2*p);
    c.save();c.translate(Math.round(x),Math.round(y-jump));
    const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x*p),Math.round(y*p),Math.ceil(w*p),Math.ceil(h*p));};
    const skin='#f3bc91',dark='#252237',shoe='#edf1e4';
    if(r.fallRemaining>0){
      rect(-9,-4,13,4,r.color);rect(4,-5,4,4,skin);rect(5,-6,4,2,dark);rect(-13,-2,6,2,skin);rect(-16,-2,4,2,shoe);rect(-4,-6,2,3,skin);
      rect(9,-10,2,2,'#ffd96d');rect(12,-6,1,2,'#ffd96d');
    }else{
      const moving=r.speed>.3,frame=Math.floor(r.x*2.7)%4;
      const bob=moving&&r.jumpAge===null?(frame%2)*-1:0;
      c.translate(0,bob*p);
      rect(-2,-20,5,5,skin);rect(-3,-21,5,2,dark);rect(2,-18,2,1,dark);
      rect(-4,-15,7,6,r.color);rect(-4,-9,6,3,dark);rect(-1,-14,2,2,'#fff6');
      if(r.jumpAge!==null){
        rect(1,-14,5,2,skin);rect(5,-17,2,4,skin);rect(-7,-13,3,2,skin);rect(-8,-16,2,4,skin);
        rect(1,-7,6,2,skin);rect(6,-7,2,3,skin);rect(7,-5,4,2,shoe);
        rect(-6,-6,4,2,skin);rect(-8,-8,3,3,skin);rect(-11,-8,3,2,shoe);
      }else if(moving){
        const a=[5,2,-4,-1][frame],b=[-4,-1,5,2][frame];
        rect(2,-13,Math.max(2,a),2,skin);rect(a+1,-15,2,4,skin);rect(-6,-13,3,2,skin);rect(-7,-12,2,3,skin);
        rect(-2,-6,3,4,skin);rect(a-2,-4,3,3,skin);rect(a-2,-2,5,2,shoe);
        rect(-3,-6,3,3,skin);rect(b-2,-4,3,3,skin);rect(b-3,-2,5,2,shoe);
      }else{
        rect(3,-14,2,5,skin);rect(-6,-14,2,5,skin);rect(-4,-6,3,5,skin);rect(1,-6,3,5,skin);rect(-5,-2,4,2,shoe);rect(1,-2,5,2,shoe);
      }
    }
    if(r.human){
      c.fillStyle='#d5ff64';c.font=`bold ${Math.max(10,p*4)}px monospace`;c.textAlign='center';c.fillText(r.name||'YOU',0,-27*p,Math.min(110,Math.max(60,x*1.6)));
      rect(-1,-25,2,1,'#d5ff64');rect(0,-24,1,1,'#d5ff64');
    }
    c.restore();
    if(r.human&&e.phase==='racing'&&e.jumpWindow(r).ideal&&r.jumpAge===null&&r.fallRemaining===0){
      c.strokeStyle='#d5ff64';c.lineWidth=2;c.setLineDash([4,4]);c.beginPath();c.ellipse(x,y+2,17*p,4*p,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
    }
  }
  // ---- Rowing: the regatta course -------------------------------------------
  // The camera, the national dressing and the pixel scale are the track's, but
  // the surface is water, the actors are single sculls, and everything the crew
  // does is visible: blades catch, hulls glide, bows throw spray.
  drawRegatta(c,w,h,horizon,stage,e,now){
    const total=ROWING.distance;
    const waterTop=horizon+5,laneH=(h-waterTop-23)/5,skew=12;
    const scale=Math.max(8,Math.min(19,w/36));
    const anchor=w<600?w*.26:w*.24;
    this.camera=Math.max(0,e.player.x*scale-(anchor-65));
    const sx=(m,lane)=>65+m*scale-this.camera+(2-lane)*8;
    const sy=(x,lane)=>waterTop+laneH*(lane+.5)-(x/w)*skew;
    const g=c.createLinearGradient(0,waterTop,0,h);
    g.addColorStop(0,'#4691c4');g.addColorStop(.42,'#2b6f9c');g.addColorStop(1,'#123c5c');
    c.fillStyle=g;c.fillRect(0,waterTop,w,h-waterTop);
    for(let lane=0;lane<5;lane++){
      const top=waterTop+laneH*lane;
      c.fillStyle=lane===2?'#337fab':lane%2?'#266c96':'#2b739f';
      c.beginPath();c.moveTo(0,top);c.lineTo(w,top-skew);c.lineTo(w,top+laneH-skew);c.lineTo(0,top+laneH);c.closePath();c.fill();
      c.strokeStyle=lane===2?(stage.accent||'#d5ff64'):'#8fd4ff33';c.lineWidth=lane===2?1.6:1;
      c.beginPath();c.moveTo(0,top);c.lineTo(w,top-skew);c.stroke();
      // Lane rope with buoys, every 12.5m like a real 500m course.
      for(let m=0;m<=total;m+=12.5){
        const x=sx(m,lane+1);
        if(x<-8||x>w+8)continue;
        const y=waterTop+laneH*(lane+1)-(x/w)*skew;
        c.fillStyle=(Math.round(m/12.5)%2)?'#edf1e4':'#c8552f';
        c.beginPath();c.arc(x,y,Math.max(1.2,scale*.09),0,Math.PI*2);c.fill();
      }
    }
    // Distance boards across the water, plus the start and finish gates.
    c.font='bold 10px monospace';
    for(let m=100;m<total;m+=100){
      const x=sx(m,4);
      if(x<-30||x>w+30)continue;
      c.fillStyle='#eaf6ff55';c.fillRect(Math.round(x),waterTop,1,h-waterTop-21);
      c.fillStyle='#eaf6ffcc';c.fillText(`${m}m`,Math.round(x)+4,h-26);
    }
    const start=sx(0,4);
    if(start>-30&&start<w+30){c.fillStyle='#edf1e4';c.fillRect(Math.round(start),waterTop,3,h-waterTop-21);}
    const fin=sx(total,4);
    if(fin>-40&&fin<w+40){
      for(let y=waterTop;y<h-21;y+=8){c.fillStyle=(Math.floor((y-waterTop)/8)%2)?'#141522':'#edeee8';c.fillRect(Math.round(fin),y,8,4);}
      c.fillStyle='#10121fee';c.fillRect(Math.round(fin)-46,waterTop-16,100,15);
      c.strokeStyle=stage.accent||'#d5ff64';c.lineWidth=1;c.strokeRect(Math.round(fin)-45.5,waterTop-15.5,99,14);
      c.fillStyle='#f3f1ff';c.textAlign='center';c.fillText('FINISH',Math.round(fin)+4,waterTop-5);c.textAlign='left';
    }
    for(let lane=4;lane>=0;lane--){
      const r=e.runners[lane];if(!r)continue;
      const x=sx(r.x,lane),y=sy(x,lane);
      if(x>-90&&x<w+90)this.boat(x,y,r,e,laneH,now);
    }
    // Foreground sheen and distance rail, then the shared scanlines.
    c.fillStyle='#ffffff12';
    for(let i=0;i<7;i++){const y=waterTop+((i*97+Math.floor(this.camera/3))%(h-waterTop));c.fillRect(0,y,w,1);}
    c.fillStyle='#0d2c44';c.fillRect(0,h-21,w,21);c.fillStyle='#a9cddf';c.font='10px monospace';
    const base=Math.floor(e.player.x/50)*50;
    for(let m=Math.max(0,base-50);m<=Math.min(total,base+150);m+=25){const x=sx(m,4);if(x<0||x>w)continue;c.fillRect(x,h-20,1,5);c.fillText(`${m}m`,x+5,h-7);}
    c.fillStyle='#070a1214';for(let y=0;y<h;y+=4)c.fillRect(0,y,w,1);
    if(e.phase==='racing'&&e.player.crabRemaining>0){c.fillStyle='#ed755117';c.fillRect(0,0,w,h);}
  }
  // A single scull: pointed hull, sliding seat, two blades, wake and spray.
  boat(x,y,r,e,laneH,now){
    const c=this.ctx,p=Math.max(1.5,Math.min(3,laneH/21));
    const len=Math.max(24,laneH*1.02),hull=Math.max(5,laneH*.2);
    const crab=r.crabRemaining>0,moving=r.speed>.4;
    const phase=moving?((r.strokes+now*.001*(r.cadence||0))%1):0;
    const drive=phase<.55;
    const skin='#f3bc91',dark='#252237';
    const rect=(px,py,pw,ph,color)=>{c.fillStyle=color;c.fillRect(Math.round(px*p),Math.round(py*p),Math.ceil(pw*p),Math.ceil(ph*p));};
    c.save();c.translate(Math.round(x),Math.round(y));
    if(crab)c.rotate(Math.sin(now*.02)*.16+(r.lane%2?-.08:.08));
    if(moving){
      const tail=Math.min(len*2.4,r.speed*4.2);
      c.fillStyle='#e8f4ff26';
      c.beginPath();c.moveTo(-len*.45,-hull*.35);c.lineTo(-len*.45-tail,-hull*2.3);c.lineTo(-len*.45-tail,hull*2.3);c.lineTo(-len*.45,hull*.35);c.closePath();c.fill();
      c.strokeStyle='#ffffff3d';c.lineWidth=Math.max(1,p*.7);
      c.beginPath();c.moveTo(-len*.5,-hull*.4);c.lineTo(-len*.5-tail*.75,-hull*1.6);c.moveTo(-len*.5,hull*.4);c.lineTo(-len*.5-tail*.75,hull*1.6);c.stroke();
    }
    // Stroke cycle around a fixed rigger: at the catch the blades plant near
    // the bow, sweep aft through the drive, and feather home on recovery.
    // Seat, torso, arms and catch splash all ride the same phase.
    const dp = drive ? phase / .55 : 0;
    const rp = drive || !moving ? 0 : (phase - .55) / .45;
    const sweep = !moving ? 0 : drive ? len * .14 - dp * len * .26 : -len * .12 + rp * len * .26;
    const slide = !moving ? 0 : drive ? -len * .1 + dp * len * .2 : len * .1 - rp * len * .2;
    const lean = !moving ? 0 : -sweep * .25;
    const pivot = -len * .06;
    const tipX = pivot + len * .5 + sweep;
    const grip = pivot - sweep * .45 + lean * .3;
    const foam = (n) => ((r.strokes * 53 + lane * 17 + n * 29) % 5) - 2;
    const splash = moving && phase < .16;
    const blade = (by, far) => {
      rect(tipX - p * .9, by - p * .5, p * 3.2, p * (drive ? 1.8 : 1.2), far ? '#cfd6e6' : '#e9edf7');
      if (drive) rect(tipX + p * 1.2, by - p * .4, p * 2, p * 1.4, '#ffffff88');
      else rect(tipX - p * .9, by + p * .7, p * 3.2, p * .5, '#8f95ad88');
      if (splash) for (let s = 0; s < 3; s++) rect(tipX + foam(s) * p * 1.4 - p, by + foam(s + 3) * p * 1.2 - p * .5, p * 1.1, p * 1.1, '#ffffffcc');
    };
    const shaft = (y, color) => {
      const x0 = Math.min(grip, tipX), x1 = Math.max(grip, tipX + p * 2);
      rect(x0, y, x1 - x0, p * .8, color);
    };
    // Far oar, then the hull, then the crew, then the near oar on top.
    shaft(-hull * .5 - p * 3.4, '#8f95ad');
    blade(-hull * 1.5, true);
    c.beginPath();c.moveTo(-len*.5,0);c.lineTo(-len*.34,-hull*.5);c.lineTo(len*.34,-hull*.5);c.lineTo(len*.5,0);c.lineTo(len*.34,hull*.5);c.lineTo(-len*.34,hull*.5);c.closePath();
    c.fillStyle=r.color;c.fill();c.strokeStyle='#00000055';c.lineWidth=1;c.stroke();
    rect(-len*.34,-hull*.5,len*.68,Math.max(1,hull*.22),'#ffffff55');
    const seat=pivot+slide;
    rect(seat-len*.05,-hull*.5-p*2.2,len*.1,p*.9,dark);
    // Legs brace toward the stern-side stretcher; torso leans with the arc.
    rect(seat-len*.12,-hull*.5-p*1.6,len*.1,p*1.1,dark);
    rect(seat-len*.02+lean,-hull*.5-p*6.6,p*3.4,p*4.4,crab?'#ff9b85':r.color);
    rect(seat+p*.6+lean,-hull*.5-p*5.4,p*2.6,p*1.6,crab?dark:skin);
    // Arms reach from the shoulders to the handle.
    const armY=-hull*.5-p*5.6;
    rect(Math.min(seat+lean,grip),armY,Math.abs(grip-seat-lean)+p*2,p*1.2,skin);
    rect(seat+p*1.4+lean*1.4,-hull*.5-p*6.8,p*3.6,Math.max(p*.8,1),skin);
    rect(seat+p*3+lean*1.5,-hull*.5-p*7.6,p*1.8,p*2,skin);
    rect(seat-len*.02+lean,-hull*.5-p*8.4,p*3.6,p*1.6,dark);
    if(crab)rect(seat-p*2,-hull*.5-p*10.6,p*4,p*1.8,'#ff8e77');
    else if(r.powerTen>0){for(let i=0;i<3;i++)rect(-len*.5-p*(2+i*2.4),-p*1.4+Math.sin(now*.02+i)*p,i>0?p*1.4:p*2,p*(2.4-i*.5),['#ffd166','#ff8a3d','#ff5b3d'][i]);}
    else if(r.swing)rect(-len*.5-p*1.6,-p*.6,p*1.4,p*1.2,'#9ff0ff99');
    shaft(-hull*.5+p*2.6,'#b9c0d6');
    blade(-hull*.5+p*4.2,false);
    if(r.speed>9){const n=Math.min(4,(r.speed/5)|0);for(let i=0;i<n;i++)rect(len*.45+i*p*1.7,-hull*.5+Math.sin(now*.01+i)*p*.7,p,p,'#ffffffbb');}
    if(r.human){
      c.fillStyle='#d5ff64';c.font=`bold ${Math.max(10,p*4)}px monospace`;c.textAlign='center';
      c.fillText(r.name||'YOU',0,-laneH*.72,Math.min(110,Math.max(60,x*1.2)));
      c.fillRect(-p*.6,-laneH*.72+p*.6,p*1.2,p*.7);
      c.textAlign='left';
    }
    c.restore();
  }
}
