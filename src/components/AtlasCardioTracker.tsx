"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type CardioType = "incline_walk" | "walk" | "run" | "stairmaster" | "bike" | "elliptical" | "row" | "hiit" | "other";
type CardioEntry = { id:string; date:string; type:CardioType; label:string; duration:number; incline:number; speedMin:number; speedMax:number; avgHeartRate?:number; distance?:number; weight:number; calories:number; notes:string; createdAt:string };
type CardioForm = Omit<CardioEntry,"id"|"date"|"label"|"calories"|"createdAt">;
type CardioTemplate = { id:string; name:string; form:CardioForm };

const LOCAL_KEY = "atlas-cardio-v1";
const TEMPLATE_KEY = "atlas-cardio-templates-v1";
const typeLabels: Record<CardioType,string> = { incline_walk:"Incline Walk", walk:"Yürüyüş", run:"Koşu", stairmaster:"StairMaster", bike:"Bisiklet", elliptical:"Eliptik", row:"Kürek", hiit:"HIIT", other:"Diğer" };
const defaultForm: CardioForm = { type:"incline_walk", duration:30, incline:4, speedMin:4.5, speedMax:5.5, avgHeartRate:undefined, distance:undefined, weight:90, notes:"" };

function createId(){ return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`; }
function localToday(){ const now=new Date(); const offset=now.getTimezoneOffset()*60000; return new Date(now.getTime()-offset).toISOString().slice(0,10); }
function activeDateFromPage(){ return document.querySelector<HTMLInputElement>('.content input[type="date"]')?.value || localToday(); }
function readLocalEntries():CardioEntry[]{ try{ const parsed=JSON.parse(localStorage.getItem(LOCAL_KEY)||"[]"); return Array.isArray(parsed)?parsed:[]; }catch{return [];} }
function readTemplates():CardioTemplate[]{ try{ const parsed=JSON.parse(localStorage.getItem(TEMPLATE_KEY)||"[]"); return Array.isArray(parsed)?parsed:[]; }catch{return [];} }
function estimateCalories(form:CardioForm){
  const duration=Math.max(1,Number(form.duration)||1); const weight=Math.max(30,Number(form.weight)||70);
  const avgSpeed=Math.max(0,((Number(form.speedMin)||0)+(Number(form.speedMax)||0))/2); const grade=Math.max(0,Number(form.incline)||0)/100;
  if(["incline_walk","walk","run"].includes(form.type)&&avgSpeed>0){ const m=avgSpeed*1000/60; const running=form.type==="run"||avgSpeed>=8; const vo2=running?0.2*m+0.9*m*grade+3.5:0.1*m+1.8*m*grade+3.5; return Math.max(1,Math.round((vo2*weight/200)*duration)); }
  const met:Record<CardioType,number>={incline_walk:6,walk:3.8,run:8.5,stairmaster:8.8,bike:7,elliptical:5.5,row:7,hiit:9,other:5};
  return Math.max(1,Math.round((met[form.type]*3.5*weight/200)*duration));
}

export default function AtlasCardioTracker(){
  const [target,setTarget]=useState<HTMLElement|null>(null); const [date,setDate]=useState(localToday()); const [form,setForm]=useState<CardioForm>(defaultForm);
  const [entries,setEntries]=useState<CardioEntry[]>([]); const [templates,setTemplates]=useState<CardioTemplate[]>([]); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState("");

  useEffect(()=>{
    let lastTarget:HTMLElement|null=null; let lastDate="";
    const locate=()=>{ const isWorkout=document.querySelector<HTMLElement>(".topbar h1")?.textContent?.trim()==="Antrenman"; const next=isWorkout?document.querySelector<HTMLElement>(".content > .panel"):null; const nextDate=activeDateFromPage(); if(next!==lastTarget){lastTarget=next;setTarget(next);} if(nextDate!==lastDate){lastDate=nextDate;setDate(nextDate);} };
    locate(); const timer=window.setInterval(locate,500); return()=>window.clearInterval(timer);
  },[]);

  useEffect(()=>{ setTemplates(readTemplates()); void loadData(); },[]);

  async function loadData(){
    setEntries(readLocalEntries()); const supabase=getSupabaseBrowserClient(); if(!supabase)return;
    const {data:userData}=await supabase.auth.getUser(); const user=userData?.user; if(!user)return;
    const {data}=await supabase.from("atlas_user_state").select("app_state").eq("user_id",user.id).maybeSingle(); const state=data?.app_state&&typeof data.app_state==="object"?data.app_state as any:{};
    if(Array.isArray(state.cardioEntries)){ setEntries(state.cardioEntries); localStorage.setItem(LOCAL_KEY,JSON.stringify(state.cardioEntries)); }
    const latestWeight=Array.isArray(state.checkins)&&state.checkins.length?Number([...state.checkins].sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date)))[0]?.weight):Number(state.profile?.weight);
    if(Number.isFinite(latestWeight)&&latestWeight>30)setForm(prev=>({...prev,weight:latestWeight}));
  }

  const calories=useMemo(()=>estimateCalories(form),[form]); const dayEntries=useMemo(()=>entries.filter(e=>e.date===date),[entries,date]);
  const dayMinutes=dayEntries.reduce((s,e)=>s+e.duration,0); const dayCalories=dayEntries.reduce((s,e)=>s+e.calories,0);

  async function persist(next:CardioEntry[]){
    localStorage.setItem(LOCAL_KEY,JSON.stringify(next)); setEntries(next); window.dispatchEvent(new Event("atlas-cardio-updated"));
    const supabase=getSupabaseBrowserClient(); if(!supabase)return; const {data:userData}=await supabase.auth.getUser(); const user=userData?.user; if(!user)return;
    const {data,error}=await supabase.from("atlas_user_state").select("app_state, full_name").eq("user_id",user.id).maybeSingle(); if(error)throw error;
    const appState=data?.app_state&&typeof data.app_state==="object"?data.app_state as any:{};
    const {error:saveError}=await supabase.from("atlas_user_state").upsert({user_id:user.id,full_name:data?.full_name||user.user_metadata?.full_name||user.email||"ATLAS User",app_state:{...appState,cardioEntries:next,activeDate:date}},{onConflict:"user_id"}); if(saveError)throw saveError;
  }

  async function addCardio(event:FormEvent){ event.preventDefault(); if(saving)return; setSaving(true); setNotice(""); try{ const entry:CardioEntry={id:createId(),date,type:form.type,label:typeLabels[form.type],duration:Math.max(1,Number(form.duration)||1),incline:Math.max(0,Number(form.incline)||0),speedMin:Math.max(0,Number(form.speedMin)||0),speedMax:Math.max(0,Number(form.speedMax)||0),...(form.avgHeartRate?{avgHeartRate:Number(form.avgHeartRate)}:{}),...(form.distance?{distance:Number(form.distance)}:{}),weight:Math.max(30,Number(form.weight)||70),calories,notes:form.notes.trim(),createdAt:new Date().toISOString()}; await persist([...entries,entry]); setNotice(`${entry.label} kaydedildi • ${entry.duration} dk • yaklaşık ${entry.calories} kcal`); }catch(error){console.error(error);setNotice("Kardiyo kaydedilemedi. Tekrar dene.");}finally{setSaving(false);} }
  async function removeEntry(id:string){ await persist(entries.filter(e=>e.id!==id)); }
  function saveTemplate(){ const name=window.prompt("Şablon adı","ATLAS Incline Walk")?.trim(); if(!name)return; const next=[...templates,{id:createId(),name,form}]; localStorage.setItem(TEMPLATE_KEY,JSON.stringify(next)); setTemplates(next); }

  if(!target)return null;
  return createPortal(<section className="atlas-cardio-card"><header><div><p className="eyebrow">CARDIO TRACKING V1</p><h2>🏃 Kardiyo Kaydı</h2><small>Aynı gün istediğin kadar kardiyo oturumu ekleyebilirsin.</small></div><div className="atlas-cardio-summary"><strong>{dayMinutes} dk</strong><span>{dayCalories} kcal</span></div></header>
  {templates.length>0&&<div className="atlas-cardio-templates"><span>Şablonlar</span>{templates.map(t=><button type="button" key={t.id} onClick={()=>setForm(t.form)}>{t.name}</button>)}</div>}
  <form onSubmit={addCardio} className="atlas-cardio-form"><label>Kardiyo türü<select value={form.type} onChange={e=>setForm({...form,type:e.target.value as CardioType})}>{Object.entries(typeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Süre (dk)<input type="number" min="1" max="300" value={form.duration} onChange={e=>setForm({...form,duration:Number(e.target.value)})}/></label><label>Vücut ağırlığı (kg)<input type="number" min="30" max="300" step="0.1" value={form.weight} onChange={e=>setForm({...form,weight:Number(e.target.value)})}/></label><label>Incline (%)<input type="number" min="0" max="30" step="0.5" value={form.incline} disabled={!['incline_walk','walk','run'].includes(form.type)} onChange={e=>setForm({...form,incline:Number(e.target.value)})}/></label><label>Başlangıç hızı<input type="number" min="0" max="30" step="0.1" value={form.speedMin} onChange={e=>setForm({...form,speedMin:Number(e.target.value)})}/></label><label>Bitiş hızı<input type="number" min="0" max="30" step="0.1" value={form.speedMax} onChange={e=>setForm({...form,speedMax:Number(e.target.value)})}/></label><label>Ortalama nabız<input type="number" min="40" max="240" placeholder="Opsiyonel" value={form.avgHeartRate??""} onChange={e=>setForm({...form,avgHeartRate:e.target.value?Number(e.target.value):undefined})}/></label><label>Mesafe (km)<input type="number" min="0" max="200" step="0.1" placeholder="Opsiyonel" value={form.distance??""} onChange={e=>setForm({...form,distance:e.target.value?Number(e.target.value):undefined})}/></label><label className="wide">Not<input value={form.notes} placeholder="Örn. Hız aralıklı ilerledim." onChange={e=>setForm({...form,notes:e.target.value})}/></label><div className="atlas-cardio-estimate"><span>Tahmini yakım</span><strong>{calories} kcal</strong><small>Hız, eğim, süre ve kiloya dayalı tahmini değerdir.</small></div><div className="atlas-cardio-actions"><button type="button" className="ghost-button" onClick={saveTemplate}>Şablon Kaydet</button><button className="primary" disabled={saving}>{saving?"Kaydediliyor...":"Kardiyoyu Kaydet"}</button></div></form>
  {notice&&<div className="atlas-cardio-notice">{notice}</div>}{dayEntries.length>0&&<div className="atlas-cardio-list">{dayEntries.map(entry=><article key={entry.id}><div><strong>{entry.label}</strong><span>{entry.duration} dk • {entry.speedMin}-{entry.speedMax} km/s • incline {entry.incline} • {entry.calories} kcal</span>{entry.notes&&<small>{entry.notes}</small>}</div><button type="button" className="ghost-button danger" onClick={()=>removeEntry(entry.id)}>Sil</button></article>)}</div>}</section>,target);
}
