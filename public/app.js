const BASE_FIELDS={attempts:"Attempts",completions:"Completions",completion_pct:"Completion %",passing_yards:"Pass Yards",passing_tds:"Pass TD",interceptions:"INT",yards_per_attempt:"Yards / Attempt",carries:"Carries",rushing_yards:"Rush Yards",rushing_tds:"Rush TD",yards_per_carry:"Yards / Carry",targets:"Targets",receptions:"Receptions",receiving_yards:"Rec Yards",receiving_tds:"Rec TD",catch_pct:"Catch %",yards_per_target:"Yards / Target",yards_per_reception:"Yards / Reception",fantasy_points:"Fantasy Points",passing_epa:"Passing EPA",rushing_epa:"Rushing EPA",receiving_epa:"Receiving EPA"};
let players=[], custom=JSON.parse(localStorage.getItem("gridiron-custom-stats")||"[]"), filters=[], limit=50, queryColumns=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function safeFormula(formula,row){
 const tokens=formula.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[()+\-*/]/g);
 if(!tokens||tokens.join("").replace(/\s/g,"")!==formula.replace(/\s/g,""))throw Error("Only stat fields, numbers, arithmetic, and parentheses are allowed.");
 const values=tokens.map(t=>/^[A-Za-z_]/.test(t)?(Object.hasOwn(row,t)?String(Number(row[t])||0):(()=>{throw Error("Unknown field: "+t)})()):t);
 const expression=values.join(" ");
 if(!/^[\d\s.+\-*/()]+$/.test(expression))throw Error("Invalid formula.");
 const result=Function('"use strict"; return ('+expression+')')();
 return Number.isFinite(result)?result:0;
}
function allFields(){const x={...BASE_FIELDS};custom.forEach(c=>x["custom:"+c.id]=c.name);return x}
function value(row,key){if(key.startsWith("custom:")){const c=custom.find(x=>x.id===key.slice(7));return c?safeFormula(c.formula,row):0}return Number(row[key])||0}
function fmt(v,key){if(["completion_pct","catch_pct"].includes(key))return v.toFixed(1)+"%";if(Number.isInteger(v))return v.toLocaleString();return v.toFixed(2)}
function populateFields(){const fields=allFields(), sort=$("#sort");const current=sort.value;sort.innerHTML=Object.entries(fields).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("");sort.value=current&&fields[current]?current:"passing_yards";$("#field-chips").innerHTML=Object.keys(BASE_FIELDS).map(k=>'<button type="button" class="chip" data-field="'+k+'">'+k+'</button>').join("")}
function render(){
 const pos=$("#position").value, search=$("#player-search").value.toLowerCase(), sort=$("#sort").value, order=$("#order").value;
 let rows=players.filter(p=>(pos==="ALL"||p.position===pos)&&(!search||p.player_name.toLowerCase().includes(search)||p.team.toLowerCase().includes(search)));
 for(const f of filters)rows=rows.filter(p=>{const v=value(p,f.field),n=Number(f.value);return f.op===">="?v>=n:f.op==="<="?v<=n:f.op===">"?v>n:f.op==="<"?v<n:v===n});
 rows.sort((a,b)=>(value(a,sort)-value(b,sort))*(order==="desc"?-1:1));
 const defaultFields=pos==="QB"?["attempts","completions","completion_pct","passing_yards","yards_per_attempt","passing_tds","interceptions"]:pos==="RB"?["carries","rushing_yards","yards_per_carry","rushing_tds","targets","receptions"]:pos==="WR"||pos==="TE"?["targets","receptions","catch_pct","receiving_yards","yards_per_target","receiving_tds"]:["games",sort,"fantasy_points"];
 const fields=queryColumns&&queryColumns.length?queryColumns:defaultFields;
 const unique=[...new Set(fields.concat(sort))];
 $("#thead").innerHTML="<tr><th>Player</th><th>Pos</th><th>Team</th>"+unique.map(k=>"<th>"+(allFields()[k]||k)+"</th>").join("")+"</tr>";
 $("#tbody").innerHTML=rows.slice(0,limit).map(p=>'<tr><td class="player">'+p.player_name+'</td><td>'+p.position+'</td><td class="team">'+p.team+'</td>'+unique.map(k=>"<td>"+fmt(value(p,k),k)+"</td>").join("")+"</tr>").join("");
 $("#query-summary").textContent=rows.length+" players match • showing "+Math.min(rows.length,limit)+" • sorted by "+(allFields()[sort]||sort);
}
function renderFilters(){
 const fields=allFields();
 $("#filters").innerHTML=filters.map((f,i)=>'<div class="filter-row"><select data-i="'+i+'" data-k="field">'+Object.entries(fields).map(([k,v])=>'<option value="'+k+'" '+(k===f.field?"selected":"")+'>'+v+'</option>').join("")+'</select><select data-i="'+i+'" data-k="op">'+[">=","<=",">","<","="].map(x=>'<option '+(x===f.op?"selected":"")+'>'+x+'</option>').join("")+'</select><input type="number" step="any" data-i="'+i+'" data-k="value" value="'+f.value+'"><button data-remove="'+i+'">×</button></div>').join("");
}
function renderCustom(){
 $("#custom-list").innerHTML=custom.length?custom.map(c=>'<div class="custom-item"><button data-delete="'+c.id+'">×</button><strong>'+c.name+'</strong><code>'+c.formula+'</code></div>').join(""):'<p class="empty">No custom stats yet. Create one and it becomes available everywhere in the explorer.</p>';
 populateFields();renderFilters();if(players.length)render();
}
function findPlayer(name){
 const cleaned=name.trim().toLowerCase().replace(/[?.!]+$/,"");
 return players.find(p=>p.player_name.toLowerCase()===cleaned)
   || players.find(p=>p.player_name.toLowerCase().includes(cleaned))
   || players.find(p=>cleaned.includes(p.player_name.toLowerCase()));
}
function runComparison(a,b){
 $("#compare-a").value=a.player_name;
 $("#compare-b").value=b.player_name;
 showView("compare");
 $("#compare-btn").click();
}
async function ask(q){
 const text=q.trim();
 const vs=text.match(/^(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\s+(?:stats?|comparison|passing stats?|rushing stats?|receiving stats?))?$/i);
 const compare=text.match(/^compare\s+(.+?)\s+(?:and|with|to|vs\.?)\s+(.+?)(?:\s+(?:stats?|comparison))?$/i);
 const match=vs||compare;
 if(match){
   const a=findPlayer(match[1]), b=findPlayer(match[2]);
   if(a&&b){runComparison(a,b);return}
   showView("compare");
   $("#comparison").innerHTML='<p class="error">Could not match both player names. Try their full names.</p>';
   return;
 }
 const r=await fetch("/api/parse-query",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,customStats:custom})});const parsed=await r.json();
 $("#position").value=parsed.position;filters=parsed.filters||[];queryColumns=parsed.columns&&parsed.columns.length?parsed.columns:null;$("#sort").value=parsed.sort;$("#order").value=parsed.order;limit=parsed.limit||25;renderFilters();showView("explore");render();
}
function showView(id){$$(".view").forEach(v=>v.classList.toggle("active-view",v.id===id));$$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===id))}
async function init(){
 populateFields();renderCustom();
 try{const r=await fetch("/api/stats"),data=await r.json();if(!r.ok)throw Error(data.error);players=data.players;$("#status").textContent=players.length+" players • data loaded "+new Date(data.updatedAt).toLocaleString();$("#players-list").innerHTML=players.map(p=>'<option value="'+p.player_name+'">'+p.team+" · "+p.position+"</option>").join("");render()}catch(e){$("#status").textContent="Could not load NFL data: "+e.message}
}
$$(".nav").forEach(n=>n.onclick=()=>showView(n.dataset.view));$$(".examples button").forEach(b=>b.onclick=()=>{$("#question").value=b.textContent;ask(b.textContent)});
$("#question-form").onsubmit=e=>{e.preventDefault();ask($("#question").value)};
["position","sort","order"].forEach(id=>$("#"+id).onchange=()=>{limit=50;queryColumns=null;render()});$("#player-search").oninput=render;
$("#add-filter").onclick=()=>{filters.push({field:"attempts",op:">=",value:0});renderFilters()};
$("#filters").onchange=e=>{const i=e.target.dataset.i,k=e.target.dataset.k;if(k){filters[i][k]=k==="value"?Number(e.target.value):e.target.value;render()}};
$("#filters").onclick=e=>{if(e.target.dataset.remove!==undefined){filters.splice(Number(e.target.dataset.remove),1);renderFilters();render()}};
$("#field-chips").onclick=e=>{if(e.target.dataset.field){const t=$("#formula"),start=t.selectionStart;t.value=t.value.slice(0,start)+e.target.dataset.field+t.value.slice(t.selectionEnd);t.focus()}};
$("#formula-form").onsubmit=e=>{e.preventDefault();const name=$("#formula-name").value.trim(),formula=$("#formula").value.trim();try{safeFormula(formula,players[0]||Object.fromEntries(Object.keys(BASE_FIELDS).map(k=>[k,1])));custom.push({id:Date.now().toString(36),name,formula});localStorage.setItem("gridiron-custom-stats",JSON.stringify(custom));e.target.reset();$("#formula-error").textContent="";renderCustom()}catch(err){$("#formula-error").textContent=err.message}};
$("#custom-list").onclick=e=>{if(e.target.dataset.delete){custom=custom.filter(c=>c.id!==e.target.dataset.delete);localStorage.setItem("gridiron-custom-stats",JSON.stringify(custom));renderCustom()}};
$("#compare-btn").onclick=()=>{
 const a=players.find(p=>p.player_name.toLowerCase()===$("#compare-a").value.toLowerCase());
 const b=players.find(p=>p.player_name.toLowerCase()===$("#compare-b").value.toLowerCase());
 if(!a||!b)return $("#comparison").innerHTML='<p class="error">Choose two players from the suggestions.</p>';
 const keys=["games","passing_yards","passing_tds","yards_per_attempt","rushing_yards","yards_per_carry","receiving_yards","yards_per_target","fantasy_points",...custom.map(c=>"custom:"+c.id)];
 const rows=keys.map(k=>{
   const av=value(a,k),bv=value(b,k);
   const ac=av>bv?" winner":"",bc=bv>av?" winner":"";
   return '<div class="compare-value'+ac+'">'+fmt(av,k)+'</div><div class="metric">'+(allFields()[k]||k)+'</div><div class="right compare-value'+bc+'">'+fmt(bv,k)+'</div>';
 }).join("");
 $("#comparison").innerHTML='<div class="comparison-grid"><div class="name">'+a.player_name+'</div><div class="metric">STAT</div><div class="name right">'+b.player_name+'</div>'+rows+"</div>";
};
init();