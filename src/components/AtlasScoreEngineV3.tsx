"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

type Score = { atlas:number; training:number; nutrition:number; recovery:number; discipline:number };

const EMPTY: State = { checkins:[], workouts:[], nutritionEntries:[], supplements:[], advanced:{} };
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const parse=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
const localState=():State=>({
  checkins:parse("atlas-checkins-v2",[]),
  workouts:parse("atlas-workouts-v2",[]),
  nutritionEntries:parse("atlas-nutrition-v2",[]),
  supplements:parse("atlas-supplements-v1",[]),
  advanced:parse("atlas-advanced-v1",{}),
});
const readCardio=()=>parse<Cardio[]>("atlas-cardio-v1",[]);
const ratio=(value:number,target:number,tolerance=.15)=>{
  if(value<=0||target<=0)return 0;
  const r=value/target;
  if(r>=1-tolerance&&r<=1+tolerance)return 100;
  if(r<1-tolerance)return clamp(r/(1-tolerance)*100);
  return clamp(100-((r-(1+tolerance))/.75)*100);
};
const grade=(n:number)=>n>=97?"S+":n>=93?"S":n>=88?"A+":n>=82?"A":n>=72?"B":n>=60?"C":"D";

function calculate(state:State,date:string,cardioEntries:Cardio[]):Score{
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
    if(!dates.has(date)||calculate(state,date,cardioEntries).atlas<45)break;
    streak+=1;
    cursor.setDate(cursor.getDate()-1);
  }
  return {xp,level:Math.floor(xp/500)+1,streak};
}

export default function AtlasScoreEngineV3(){
  const [state,setState]=useState<State>(EMPTY);
  const [cardio,setCardio]=useState<Cardio[]>([]);
  const [date,setDate]=useState(today());
  const [hero,setHero]=useState<HTMLElement|null>(null);
  const [gridHost,setGridHost]=useState<HTMLElement|null>(null);

  useEffect(()=>{
    let cancelled=false;
    let timer:ReturnType<typeof setInterval>|null=null;
    let cloudMode=false;
    let inFlight=false;

    const resolveHosts=()=>{
      const currentHero=document.querySelector<HTMLElement>(".hero-card");
      if(currentHero&&currentHero!==hero)setHero(currentHero);
      if(currentHero){
        let host=document.querySelector<HTMLElement>("[data-atlas-score-v3-host]");
        if(!host){
          host=document.createElement("div");
          host.dataset.atlasScoreV3Host="true";
          currentHero.insertAdjacentElement("afterend",host);
        }
        if(host!==gridHost)setGridHost(host);
      }
    };

    const read=async()=>{
      if(inFlight)return;
      inFlight=true;
      try{
        const supabase=getSupabaseBrowserClient();
        const {data:userData}=await supabase?.auth.getUser()||{data:{user:null}};
        const user=userData?.user;
        cloudMode=Boolean(supabase&&user);
        if(cloudMode&&supabase&&user){
          const {data}=await supabase.from("atlas_user_state").select("app_state").eq("user_id",user.id).maybeSingle();
          if(!cancelled&&data?.app_state&&typeof data.app_state==="object"){
            const next=data.app_state as State;
            setState(next);
            setDate(next.activeDate||today());
          }
        }else if(!cancelled){
          const next=localState();
          setState(next);
          const input=document.querySelector<HTMLInputElement>('.content input[type="date"]');
          setDate(input?.value||next.activeDate||today());
        }
        if(!cancelled)setCardio(readCardio());
      }finally{inFlight=false}
    };

    resolveHosts();
    void read();
    timer=setInterval(()=>{resolveHosts();void read()},2500);
    const onStorage=()=>{if(!cloudMode)void read()};
    window.addEventListener("storage",onStorage);
    return()=>{cancelled=true;if(timer)clearInterval(timer);window.removeEventListener("storage",onStorage)};
  },[hero,gridHost]);

  const score=useMemo(()=>calculate(state,date,cardio),[state,date,cardio]);
  const prog=useMemo(()=>progress(state,cardio),[state,cardio]);
  const status=score.atlas>=90?"ELİT GÜN":score.atlas>=75?"GÜÇLÜ İLERLEME":score.atlas>=50?"DEVAM ET":"KAYIT BEKLİYOR";

  return <>
    {hero&&createPortal(<div className="atlas-score-v3" aria-label={`ATLAS skoru ${score.atlas} / 100`}>
      <strong>{score.atlas}</strong><span>ATLAS SKORU</span><small>{status}</small>
    </div>,hero)}
    {gridHost&&createPortal(<section className="atlas-score-v2-grid atlas-score-v3-grid">
      <article className="atlas-score-v2-card"><span>LEVEL</span><strong>{prog.level}</strong><small>{prog.xp} XP</small></article>
      <article className="atlas-score-v2-card"><span>STREAK</span><strong>{prog.streak} gün</strong><small>Kesintisiz disiplin</small></article>
      <article className="atlas-score-v2-card"><span>DISCIPLINE</span><strong>{grade(score.discipline)}</strong><small>{score.discipline}/100</small></article>
      <article className="atlas-score-v2-card"><span>RECOVERY</span><strong>{score.recovery}</strong><small>Uyku ve toparlanma</small></article>
      <article className="atlas-score-v2-card"><span>NUTRITION</span><strong>{score.nutrition}</strong><small>Günlük hedef uyumu</small></article>
      <article className="atlas-score-v2-card"><span>TRAINING</span><strong>{score.training}</strong><small>Antrenman performansı</small></article>
    </section>,gridHost)}
  </>;
}
