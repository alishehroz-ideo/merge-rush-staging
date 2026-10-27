'use strict';
const COMPETITION_RULE='rush-score-v4-normal';
class CompetitionScore {
 constructor(){this.base=0;this.chain=0;this.createdMax=0;this.merges=0;this.fired=new Set();this.successful=new Set();}
 fire(root){this.fired.add(root)}
 merge(value,depth,root,sources=[]){this.base+=value;this.chain+=value*(depth===1?0:depth===2?.5:depth===3?1:2);this.createdMax=Math.max(this.createdMax,value);this.merges++;for(let id of [root,...sources])if(this.fired.has(id))this.successful.add(id);}
 result(){let shots=this.fired.size,hits=this.successful.size,rate=shots?hits/shots:0;let growth=this.createdMax?Math.min(10000,Math.max(0,Math.floor(Math.log2(this.createdMax))-8)*1000):0;let precision=Math.floor(rate*2000);return{rule:COMPETITION_RULE,base:this.base,chain:this.chain,growth,precision,total:this.base+this.chain+growth+precision,shots,hits,rate,merges:this.merges,createdMax:this.createdMax};}
}
class LocalScoreboard {
 constructor(storage){this.storage=storage;this.key='mergeRushCompetitionV4Normal';this.rows=[];this.saved=true;try{let data=JSON.parse(storage.getItem(this.key)||'[]');if(Array.isArray(data))this.rows=data.filter(r=>r.rule===COMPETITION_RULE&&typeof r.name==='string'&&Number.isFinite(r.at)&&['total','base','chain','growth','precision','max','maxChain','shots','hits'].every(k=>Number.isFinite(r[k])&&r[k]>=0)&&r.total===r.base+r.chain+r.growth+r.precision&&r.hits<=r.shots).slice(0,10)}catch{this.saved=false;}this.sort();}
 sort(){this.rows.sort((a,b)=>b.total-a.total||b.max-a.max||b.maxChain-a.maxChain||(b.hits/(b.shots||1))-(a.hits/(a.shots||1))||a.at-b.at);}
 add(result,name,max,maxChain){let row={...result,name:String(name||'PLAYER').trim().slice(0,12)||'PLAYER',max,maxChain,at:Date.now(),id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)};this.rows.push(row);this.sort();let rank=this.rows.indexOf(row)+1;this.rows=this.rows.slice(0,10);try{this.storage.setItem(this.key,JSON.stringify(this.rows));this.saved=true}catch{this.saved=false}return{row,rank,saved:this.saved};}
 get best(){return this.rows[0]?.total||0;}
}
const localScores=new LocalScoreboard(localStorage);
function scoreSafe(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showScoreboard(result,entry){let fmt=n=>n.toLocaleString();document.getElementById('scoreBreakdown').innerHTML=[['合体基本点',result.base],['連鎖加点',result.chain],['到達ボーナス',result.growth],['成功率ボーナス',result.precision]].map(([label,n])=>'<tr><th scope="row">'+label+'</th><td>'+fmt(n)+'</td></tr>').join('');document.getElementById('scorePerformance').textContent='合体 '+result.merges+'回 · 成功 '+result.hits+'/'+result.shots+'投 ('+(result.rate*100).toFixed(1)+'%)';document.getElementById('roundRank').textContent=entry?(entry.rank<=10?'今回 '+entry.rank+'位':'今回 TOP10圏外')+(entry.saved?' · この端末に保存':' · 保存できませんでした'):'演出試作 · ランキング対象外';document.getElementById('leaderboardRows').innerHTML=localScores.rows.map((r,i)=>'<tr'+(entry?.row.id===r.id?' class="current-run"':'')+'><td>'+(i+1)+'</td><th scope="row">'+scoreSafe(r.name)+'</th><td>'+fmt(r.total)+'</td><td>'+scoreSafe(numberText(r.max))+'</td><td>'+r.maxChain+'</td></tr>').join('')||'<tr><td colspan="5">通常合体を完走すると記録されます</td></tr>';}
