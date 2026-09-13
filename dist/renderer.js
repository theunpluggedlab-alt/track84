import {RULES} from './engine.js';

export class TrackRenderer {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.width=1000;this.height=470;
    this.stadium=new Image();this.stadium.src='./assets/stadium.png';this.camera=0;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
  }
  resize(){const b=this.canvas.getBoundingClientRect();this.width=Math.max(1,b.width);this.height=Math.max(1,b.height);const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.width*d);this.canvas.height=Math.round(this.height*d);this.ctx.setTransform(d,0,0,d,0,0);this.ctx.imageSmoothingEnabled=false;}
  draw(e,now){
    const c=this.ctx,w=this.width,h=this.height;
    c.fillStyle='#27263f';c.fillRect(0,0,w,h);
    const horizon=h*.35;
    if(this.stadium.complete&&this.stadium.naturalWidth){
      const scale=Math.max(w/this.stadium.width,(horizon+12)/this.stadium.height);
      c.drawImage(this.stadium,(w-this.stadium.width*scale)/2,0,this.stadium.width*scale,this.stadium.height*scale);
    }
    c.fillStyle='#15172a44';c.fillRect(0,0,w,horizon);
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
      c.strokeStyle=lane===2?'#acb880':'#bcb5ce88';c.lineWidth=1.4;
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
}
