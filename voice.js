'use strict';
class VoiceDirector {
 constructor(audio){this.audio=audio;this.last=-Infinity;this.pending=null;this.active=null;this.spoken=new Set();this.variants={};this.events=[];this.clock=()=>audio.ctx?.currentTime||0;}
 cancel(){this.pending=null;if(this.active){this.active.wasCancelled=true;try{this.active.stop()}catch{}this.active=null;}this.activeId=null;}
 waitForCurrent(){return this.active?.finished||Promise.resolve();}
 reset(){this.cancel();this.last=-Infinity;this.spoken.clear();}
 offer(id,priority,root='',delay=.24,critical=false){let t=this.clock();if(!critical&&(t-this.last<3||this.spoken.has(root)))return;if(!this.pending||priority>=this.pending.priority)this.pending={id,priority,root,at:t+delay,expires:t+.65,critical};}
 start(){this.offer('lets_go',20,'start',.12,true)}
 gameOver(){this.cancel();this.offer('game_over',110,'game-over',.12,true)}
 result(){this.cancel();this.offer('new_best_voice',100,'result',1.05,true)}
 success(n,depth,root,remaining=120){if(remaining<=5)return;let priority=n>=2048?60:depth;let id=n===2048?'awesome':n>2048?null:depth===4?'amazing':depth===2?'nice':null;if(id)this.offer(id,priority,root);else if(this.pending&&this.pending.root===root&&priority>this.pending.priority)this.pending=null;}
 update(){let p=this.pending,t=this.clock();if(!p||t<p.at)return;this.pending=null;if(t>p.expires&&!p.critical)return;this.play(p.id,p.root,p.critical);}
 play(id,root='',critical=false){let a=this.audio,t=this.clock();if(!a.ctx||a.settings.voiceMuted||(!critical&&t-this.last<3))return false;if(this.active){if(!critical)return false;this.cancel();}if(['nice','amazing'].includes(id)){let variant=(this.variants[id]=(this.variants[id]||0)+1);if(variant%2===0)id+='_alt';}let b=a.buffers.get('voice_'+id);if(!b)return false;let source=a.ctx.createBufferSource();source.buffer=b;source.connect(a.voiceGain);this.active=source;this.activeId=id;let done;source.finished=new Promise(resolve=>{done=resolve});let event={id,t,root,duration:b.duration};source.onended=()=>{event.end=this.clock();event.cancelled=!!source.wasCancelled;if(this.active===source){this.active=null;this.activeId=null;}source.disconnect();done();};source.start();this.last=t;this.spoken.add(root);a.duck(b.duration);this.events.push(event);return true;}
}
sound.speech=new VoiceDirector(sound);
