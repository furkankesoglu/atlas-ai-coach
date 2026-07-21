"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Checkin = { date:string; sleep?:number; sleepQuality?:number; energy?:number; soreness?:number; stress?:number; water?:number; nutrition?:number; pain?:boolean };
type Workout = { date:string; exercises?:Array<{sets?:Array<{reps?:number}>}> };
type Food = { date:string; calories?:number; protein?:number };
type Supplement = { date:string; taken?:boolean };
type Cardio = { date:string; duration?:number };
type State = {
  activeDate?:string;
  checkins?:Checkin[];
  workouts?:Workout[];
  nutritionEntries?:Food[];
  supplements?:Supplement[];
  advanced?:{calorieTarget?:number;proteinTarget?:number;waterTarget?:number;cardioMinutes?:number};
};

const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
const json=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
const localState=():State=>({
  checkins:json("atlas-checkins-v2",[]),
  workouts:json("atlas-workouts-v2",[]),
  nutritionEntries:json("atlas-nutrition-v2",[]),
  supplements:json("atlas-supplements-v1",[]),
  advanced:json("atlas-advanced-v1",{}),
});
const cardio=()=>json<Cardio[]>("atlas-cardio-v1",[]);
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const ratio=(value:number,target:number,tolerance=.15)=>{
  if(value<=0||target<=0)return 0;
  const r=value/target;
  if(r>=1-tolerance&&r<=1+tolerance)return 100;
  if(r<1-tolerance)return clamp(r/(1-tolerance)*100);
  return clamp(100-((r-(1+tolerance))/.75)*100);
};
const grade=(n:number)=>n>=97?"S+":n>=93?"S":n>=88?"A+":n>=82?"A":n>=72?"B":n>=60?"C":"D";

function scores(state:State,date:string,cardioEntries:Cardio[]){
  const checkin=state.checkins?.find(x=>x.date===date);
  const workout=state.workouts?.find(x=>x.date===date);
  const foods=state.nutritionEntries?.filter(x=>x.date===date)||[];
  const supplements=state.supplements?.filter(x=>x.date===date)||[];
  const cardioMinutes=cardioEntries.filter(x=>x.date===date).reduce((a,b)=>a+Number(b.duration||0),0);
  const calories=foods.reduce((a,b)=>a+Number(b.calories||0),0);
  const protein=foods.reduce((a,b)=>a+Number(b.protein||0),0);
  const calorieTarget=Number(state.advanced?.calorieTarget)||2450;
  const proteinTarget=Number(state.advanced?.proteinTarget)||200;
  const waterTarget=Number(state.advanced?.waterTarget)||4;
  const cardioTarget=Number(state.advanced?.cardioMinutes)||30;
  const exerciseCount=workout?.exercises?.length||0;
  const totalSets=workout?.exercises?.reduce((a,e)=>a+(e.sets?.length||0),0)||0;
  const completedSets=workout?.exercises?.reduce((a,e)=>a+(e.sets?.filter(s=>Number(s.reps||0)>0).length||0),0)||0;

  const training=workout
    ?clamp((exerciseCount?35:0)+(totalSets?completedSets/totalSets*55:0)+Math.min(cardioMinutes/cardioTarget*10,10))
    :clamp(Math.min(cardioMinutes/cardioTarget*45,45));
  const nutrition=clamp((foods.length?10:0)+ratio(calories,calorieTarget)*.42+ratio(protein,proteinTarget,.1)*.38+clamp(Number(checkin?.nutrition||0))*.1);
  const recovery=checkin?clamp(
    clamp(Number(checkin.sleep||0)/8*100)*.28+
    clamp(Number(checkin.sleepQuality||0)*10)*.24+
    clamp(Number(checkin.energy||0)*10)*.2+
    clamp((10-Number(checkin.soreness||0))*10)*.14+
    clamp((10-Number(checkin.stress||0))*10)*.14-
    (checkin.pain?12:0)
  ):0;
  const supplementScore=supplements.length?supplements.filter(x=>x.taken).length/supplements.length*100:0;
  const discipline=clamp(
    (checkin?20:0)+(workout?25:0)+(foods.length?20:0)+
    clamp(cardioMinutes/cardioTarget*100)*.1+
    clamp(Number(checkin?.water||0)/waterTarget*100)*.1+
    supplementScore*.15
  );
  return {training,nutrition,recovery,discipline,atlas:clamp(training*.3+nutrition*.3+recovery*.25+discipline*.15)};
}

function progress(state:State,cardioEntries:Cardio[]){
  const dates=new Set<string>();
  state.checkins?.forEach(x=>dates.add(x.date));
  state.workouts?.forEach(x=>dates.add(x.date));
  state.nutritionEntries?.forEach(x=>dates.add(x.date));
  state.supplements?.forEach(x=>dates.add(x.date));
  cardioEntries.forEach(x=>dates.add(x.date));
  let xp=0;
  dates.forEach(date=>{
    if(state.checkins?.some(x=>x.date===date))xp+=20;
    if(state.workouts?.some(x=>x.date===date))xp+=50;
    if(state.nutritionEntries?.some(x=>x.date===date))xp+=40;
    if(cardioEntries.some(x=>x.date===date))xp+=20;
    if(state.supplements?.some(x=>x.date===date&&x.taken))xp+=10;
  });
  let streak=0;
  const cursor=new Date(`${today()}T12:00:00`);
  for(let i=0;i<366;i+=1){
    const date=cursor.toISOString().slice(0,10);
    if(!dates.has(date)||scores(state,date,cardioEntries).atlas<45)break;
    streak+=1;
    cursor.setDate(cursor.getDate()-1);
  }
  return {xp,level:Math.floor(xp/500)+1,streak};
}

function render(state:State){
  const title=document.querySelector<HTMLElement>(".topbar h1")?.textContent?.trim();
  if(title!=="Kontrol Merkezi"&&title!=="Dashboard")return;
  const hero=document.querySelector<HTMLElement>(".hero-card");
  const box=hero?.querySelector<HTMLElement>(".score");
  const value=box?.querySelector<HTMLElement>("strong");
  if(!hero||!box||!value)return;
  const date=document.querySelector<HTMLInputElement>('.content input[type="date"]')?.value||state.activeDate||today();
  const cardioEntries=cardio();
  const s=scores(state,date,cardioEntries);
  const p=progress(state,cardioEntries);
  value.textContent=String(s.atlas);
  box.title=`Training ${s.training} · Nutrition ${s.nutrition} · Recovery ${s.recovery} · Discipline ${s.discipline}`;
  let detail=box.querySelector<HTMLElement>("[data-atlas-score-detail]");
  if(!detail){detail=document.createElement("small");detail.dataset.atlasScoreDetail="true";box.appendChild(detail)}
  detail.textContent=s.atlas>=90?"ELİT GÜN":s.atlas>=75?"GÜÇLÜ İLERLEME":s.atlas>=50?"DEVAM ET":"KAYIT BEKLİYOR";
  let grid=document.querySelector<HTMLElement>("[data-atlas-score-v2-grid]");
  if(!grid){grid=document.createElement("section");grid.dataset.atlasScoreV2Grid="true";grid.className="atlas-score-v2-grid";hero.insertAdjacentElement("afterend",grid)}
  const card=(label:string,val:string,hint:string,key:string)=>`<article class="atlas-score-v2-card" data-atlas-stat="${key}"><span>${label}</span><strong>${val}</strong><small>${hint}</small></article>`;
  const html=[
    card("LEVEL",String(p.level),`${p.xp} XP`,"level"),
    card("STREAK",`${p.streak} gün`,"Kesintisiz disiplin","streak"),
    card("DISCIPLINE",grade(s.discipline),`${s.discipline}/100`,"discipline"),
    card("RECOVERY",String(s.recovery),"Uyku ve toparlanma","recovery"),
    card("NUTRITION",String(s.nutrition),"Günlük hedef uyumu","nutrition"),
    card("TRAINING",String(s.training),"Antrenman performansı","training"),
  ].join("");
  if(grid.innerHTML!==html)grid.innerHTML=html;
}

export default function AtlasScoreEngineV2(){
  useEffect(()=>{
    let stopped=false;
    let state=localState();
    let cloud=false;
    let lastCloud=0;
    const refresh=async(force=false)=>{
      if(!cloud)state=localState();
      const now=Date.now();
      if(force||now-lastCloud>4000){
        lastCloud=now;
        try{
          const supabase=getSupabaseBrowserClient();
          const {data:userData}=await supabase?.auth.getUser()||{data:{user:null}};
          const user=userData?.user;
          cloud=Boolean(supabase&&user);
          if(supabase&&user){
            const {data}=await supabase.from("atlas_user_state").select("app_state").eq("user_id",user.id).maybeSingle();
            if(data?.app_state&&typeof data.app_state==="object")state=data.app_state as State;
          }
        }catch(error){console.warn("ATLAS skor verisi okunamadı",error)}
      }
      if(!stopped)render(state);
    };
    const scheduled=()=>{window.setTimeout(()=>void refresh(false),120);window.setTimeout(()=>void refresh(true),1800)};
    void refresh(true);
    const timer=window.setInterval(()=>void refresh(false),2000);
    document.addEventListener("click",scheduled);
    document.addEventListener("change",scheduled);
    document.addEventListener("submit",scheduled);
    window.addEventListener("storage",scheduled);
    return()=>{stopped=true;window.clearInterval(timer);document.removeEventListener("click",scheduled);document.removeEventListener("change",scheduled);document.removeEventListener("submit",scheduled);window.removeEventListener("storage",scheduled)};
  },[]);
  return null;
}
