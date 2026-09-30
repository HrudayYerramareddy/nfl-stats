import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SEASON = 2026;
const DATA_URL = "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_" + SEASON + ".csv";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
let cache = { rows: [], loadedAt: 0 };

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const values=[]; let value="", quoted=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"' && line[i+1]==='"'){ value+='"'; i++; }
      else if(c==='"') quoted=!quoted;
      else if(c==="," && !quoted){ values.push(value); value=""; }
      else value+=c;
    }
    values.push(value);
    return Object.fromEntries(headers.map((h,i)=>[h, values[i] ?? ""]));
  });
}
function n(row,key){ const x=Number(row[key]); return Number.isFinite(x)?x:0; }
function normalizePlayer(r){
  const attempts=n(r,"attempts"), completions=n(r,"completions"), py=n(r,"passing_yards");
  const carries=n(r,"carries"), ry=n(r,"rushing_yards"), targets=n(r,"targets"), rec=n(r,"receptions"), rey=n(r,"receiving_yards");
  return {player_id:r.player_id,player_name:r.player_display_name||r.player_name||r.player_id,position:r.position||"",team:r.recent_team||r.team||"",games:n(r,"games"),
    attempts,completions,completion_pct:attempts?100*completions/attempts:0,passing_yards:py,passing_tds:n(r,"passing_tds"),interceptions:n(r,"interceptions"),yards_per_attempt:attempts?py/attempts:0,
    carries,rushing_yards:ry,rushing_tds:n(r,"rushing_tds"),yards_per_carry:carries?ry/carries:0,
    targets,receptions:rec,receiving_yards:rey,receiving_tds:n(r,"receiving_tds"),catch_pct:targets?100*rec/targets:0,yards_per_target:targets?rey/targets:0,yards_per_reception:rec?rey/rec:0,
    fantasy_points:n(r,"fantasy_points"),passing_epa:n(r,"passing_epa"),rushing_epa:n(r,"rushing_epa"),receiving_epa:n(r,"receiving_epa")};
}
async function loadStats(){
  if(cache.rows.length && Date.now()-cache.loadedAt<15*60*1000) return cache.rows;
  const response=await fetch(DATA_URL);
  if(!response.ok) throw new Error("NFL data request failed ("+response.status+")");
  cache={rows:parseCSV(await response.text()).map(normalizePlayer),loadedAt:Date.now()};
  return cache.rows;
}
const aliases={"passing yards":"passing_yards","pass yards":"passing_yards","yards per attempt":"yards_per_attempt","ypa":"yards_per_attempt","attempts":"attempts","passing attempts":"attempts","completions":"completions","completion percentage":"completion_pct","completion pct":"completion_pct","passing touchdowns":"passing_tds","passing tds":"passing_tds","interceptions":"interceptions","rushing yards":"rushing_yards","carries":"carries","yards per carry":"yards_per_carry","rushing touchdowns":"rushing_tds","receiving yards":"receiving_yards","targets":"targets","receptions":"receptions","catch rate":"catch_pct","catch percentage":"catch_pct","yards per target":"yards_per_target","yards per reception":"yards_per_reception","receiving touchdowns":"receiving_tds","fantasy points":"fantasy_points"};
function parseQuestion(question,custom=[]){
  const q=question.toLowerCase().trim(), out={position:"ALL",filters:[],sort:"passing_yards",order:"desc",limit:25,columns:[]};
  if(/\b(qbs?|quarterbacks?)\b/.test(q))out.position="QB"; else if(/\b(rbs?|running backs?)\b/.test(q))out.position="RB"; else if(/\b(wrs?|wide receivers?|receivers?)\b/.test(q))out.position="WR"; else if(/\b(tes?|tight ends?)\b/.test(q))out.position="TE";
  const fields={...aliases}; custom.forEach(x=>fields[x.name.toLowerCase()]="custom:"+x.id);
  const ordered=Object.entries(fields).sort((a,b)=>b[0].length-a[0].length);
  const mentions=ordered.filter(([phrase])=>q.includes(phrase)).sort((a,b)=>q.indexOf(a[0])-q.indexOf(b[0]));
  out.columns=[...new Set(mentions.map(([,field])=>field))];
  for(const [phrase,field] of ordered){
    const p=phrase.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
    const a=q.match(new RegExp("(?:at least|minimum|over|more than|above|>=?)\\s*(\\d+(?:\\.\\d+)?)\\s*(?:\\w+\\s+){0,2}?"+p));
    const b=q.match(new RegExp(p+"\\s*(?:at least|minimum|over|more than|above|>=?)\\s*(\\d+(?:\\.\\d+)?)"));
    if(a||b) out.filters.push({field,op:">=",value:Number((a&&a[1])||(b&&b[1]))});
  }
  const sm=ordered.find(([phrase])=>q.includes(phrase));
  if(sm && /(highest|most|best|top|by|sort)/.test(q))out.sort=sm[1];
  if(/\b(lowest|least|fewest)\b/.test(q))out.order="asc";
  const top=q.match(/\btop\s+(\d+)/); if(top)out.limit=Math.min(100,Number(top[1]));
  return out;
}
app.get("/api/stats",async(req,res)=>{try{const players=await loadStats();res.json({season:SEASON,updatedAt:new Date(cache.loadedAt).toISOString(),players});}catch(e){res.status(502).json({error:e.message});}});
app.post("/api/parse-query",(req,res)=>res.json(parseQuestion(req.body.question||"",req.body.customStats||[])));
app.get("/api/health",(req,res)=>res.json({ok:true,season:SEASON}));

// Express 5 requires a named wildcard. This catches all non-API routes for the SPA.
app.get("/{*splat}",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT,()=>console.log("Gridiron Lab running at http://localhost:"+PORT));
