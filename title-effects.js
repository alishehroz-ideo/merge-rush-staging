'use strict';
(()=>{
 const scene=document.querySelector('.title-scene'),screen=document.getElementById('titleScreen');
 const layer=document.createElement('div');layer.className='title-effects';layer.setAttribute('aria-hidden','true');
 // Fixed lightweight DOM particles; no frame loop or physics on the title screen.
 for(let i=0;i<16;i++){let p=document.createElement('i');p.className='title-mote';p.style.cssText=`left:${7+(i*37)%86}%;top:${6+(i*23)%70}%;--size:${1.2+i%3*.45}px;--duration:${5+i%5}s;--delay:-${i*.71}s;--tint:${['#ffe9a3','#b4a3ff','#8cffff'][i%3]}`;layer.appendChild(p)}
 for(let [i,xy]of [[23,20],[53,34],[77,49]].entries()){let star=document.createElement('i');star.className='title-star';star.style.cssText=`left:${xy[0]}%;top:${xy[1]}%;--delay:-${i*2.1}s`;layer.appendChild(star)}
 let shine=document.createElement('span');shine.className='title-button-shine';layer.appendChild(shine);scene.appendChild(layer);
 let burst=null;
 window.titleEffects={press(){scene.classList.add('is-starting');burst?.remove();burst=document.createElement('div');burst.className='title-burst';burst.setAttribute('aria-hidden','true');for(let i=0;i<10;i++){let p=document.createElement('i'),angle=i*Math.PI/5;p.style.cssText=`--dx:${Math.cos(angle)*(8+i%3*3)}cqw;--dy:${Math.sin(angle)*(6+i%3*2)}cqw;--tint:${i%2?'#92faff':'#ffe894'}`;burst.appendChild(p)}scene.appendChild(burst);burst.addEventListener('animationend',()=>{burst?.remove();burst=null},{once:true})},reset(){scene.classList.remove('is-starting');burst?.remove();burst=null;}};
 sound.preloadStartVoice().catch(()=>{});sound.preloadCountdown().catch(()=>{});
})();
