"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Tab = "dashboard" | "checkin" | "workout" | "suggested" | "nutrition" | "supplements" | "advanced" | "history" | "photos" | "profile" | "coach";

type Checkin = {
  date: string;
  weight: number;
  waist: number;
  sleep: number;
  sleepQuality: number;
  energy: number;
  soreness: number;
  stress: number;
  steps: number;
  water: number;
  nutrition: number;
  pain: boolean;
};

type WorkoutSet = { weight: number; reps: number; rir: number };
type Exercise = { id: string; name: string; sets: WorkoutSet[] };
type WorkoutRecord = { id: string; date: string; split: string; name: string; exercises: Exercise[]; notes?: string; source?: "manual" | "ai" };

type FoodEntry = {
  id: string;
  date: string;
  source: string;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity?: number;
  unitLabel?: string;
};

type UserProfile = {
  fullName: string;
  age: number;
  height: number;
  weight: number;
  city: string;
  email: string;
  photo: string;
};

type PhotoEntry = { id: string; date: string; src: string; note: string; createdAt: string };
type ChatMessage = { id: string; role: "assistant" | "user"; content: string; createdAt: string };
type SupplementEntry = { id: string; date: string; name: string; dose: string; time: string; taken: boolean; notes: string };

type PendingAction =
  | { type: "update_weight"; label: string; payload: { date: string; weight: number } }
  | { type: "create_workout"; label: string; payload: { date: string; split: string; name: string; exercises: Array<{ name: string; sets: Array<{ weight: number; reps: number; rir: number }> }> } };



type AdvancedState = {
  onboardingComplete: boolean;
  goal: string;
  trainingDays: number;
  experience: string;
  equipment: string;
  injuries: string;
  activityLevel: string;
  calorieTarget: number;
  proteinTarget: number;
  cardioMinutes: number;
  waterTarget: number;
  tasks: Array<{ id: string; title: string; time: string; enabled: boolean; done: boolean }>;
  pendingChanges: Array<{ id: string; title: string; reason: string; oldValue: string; newValue: string; status: "pending" | "approved" | "rejected" }>;
};

const defaultAdvancedState: AdvancedState = {
  onboardingComplete: false,
  goal: "Yağ kaybı",
  trainingDays: 3,
  experience: "Başlangıç",
  equipment: "Tam donanımlı spor salonu",
  injuries: "",
  activityLevel: "Orta",
  calorieTarget: 2450,
  proteinTarget: 200,
  cardioMinutes: 30,
  waterTarget: 4,
  tasks: [
    { id: "morning-weight", title: "Sabah kilo ve check-in gir", time: "06:10", enabled: true, done: false },
    { id: "workout", title: "Günün antrenmanını tamamla", time: "07:00", enabled: true, done: false },
    { id: "nutrition", title: "Beslenme kaydını tamamla", time: "21:00", enabled: true, done: false },
    { id: "photo", title: "Haftalık ilerleme fotoğrafı çek", time: "09:00", enabled: false, done: false },
  ],
  pendingChanges: [],
};

type FoodPreset = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  unitLabel?: string;
  gramsPerUnit?: number;
};

const foodPresets: FoodPreset[] = [
  { name: "Tavuk Göğsü (çiğ)", calories: 120, protein: 23, carbs: 0, fat: 2.6 },
  { name: "Hindi Göğsü (çiğ)", calories: 114, protein: 24, carbs: 0, fat: 1.2 },
  { name: "Yağsız Dana Eti", calories: 170, protein: 26, carbs: 0, fat: 7 },
  { name: "Somon", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: "Ton Balığı (suda)", calories: 116, protein: 26, carbs: 0, fat: 1 },
  { name: "Yumurta", calories: 143, protein: 13, carbs: 1.1, fat: 10, unitLabel: "adet", gramsPerUnit: 50 },
  { name: "Yumurta Beyazı", calories: 52, protein: 11, carbs: 0.7, fat: 0.2 },
  { name: "Lor Peyniri", calories: 98, protein: 18, carbs: 3, fat: 1.5 },
  { name: "Light Beyaz Peynir", calories: 170, protein: 20, carbs: 3, fat: 9 },
  { name: "Süzme Yoğurt", calories: 97, protein: 9, carbs: 4, fat: 5 },
  { name: "Yoğurt", calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  { name: "Kefir", calories: 60, protein: 3.4, carbs: 4.8, fat: 3.2 },
  { name: "Tam Yağlı Süt", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  { name: "Yarım Yağlı Süt", calories: 47, protein: 3.4, carbs: 4.9, fat: 1.5 },
  { name: "Whey Protein", calories: 400, protein: 80, carbs: 8, fat: 6 },
  { name: "Pirinç (çiğ)", calories: 360, protein: 7, carbs: 79, fat: 0.8 },
  { name: "Basmati Pirinç (çiğ)", calories: 355, protein: 8, carbs: 78, fat: 0.8 },
  { name: "Bulgur (çiğ)", calories: 342, protein: 12, carbs: 76, fat: 1.3 },
  { name: "Makarna (çiğ)", calories: 371, protein: 13, carbs: 75, fat: 1.5 },
  { name: "Yulaf", calories: 389, protein: 17, carbs: 66, fat: 7 },
  { name: "Tam Buğday Ekmeği", calories: 247, protein: 13, carbs: 41, fat: 4.2 },
  { name: "Beyaz Ekmek", calories: 265, protein: 9, carbs: 49, fat: 3.2 },
  { name: "Pirinç Patlağı", calories: 387, protein: 8, carbs: 82, fat: 3, unitLabel: "adet", gramsPerUnit: 9 },
  { name: "Patates", calories: 77, protein: 2, carbs: 17, fat: 0.1 },
  { name: "Tatlı Patates", calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { name: "Muz", calories: 89, protein: 1.1, carbs: 23, fat: 0.3, unitLabel: "adet", gramsPerUnit: 118 },
  { name: "Elma", calories: 52, protein: 0.3, carbs: 14, fat: 0.2, unitLabel: "adet", gramsPerUnit: 182 },
  { name: "Çilek", calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3 },
  { name: "Avokado", calories: 160, protein: 2, carbs: 8.5, fat: 14.7, unitLabel: "adet", gramsPerUnit: 150 },
  { name: "Zeytinyağı", calories: 884, protein: 0, carbs: 0, fat: 100 },
  { name: "Fıstık Ezmesi", calories: 588, protein: 25, carbs: 20, fat: 50 },
  { name: "Badem", calories: 579, protein: 21, carbs: 22, fat: 50 },
  { name: "Ceviz", calories: 654, protein: 15, carbs: 14, fat: 65 },
  { name: "Nohut (çiğ)", calories: 364, protein: 19, carbs: 61, fat: 6 },
  { name: "Mercimek (çiğ)", calories: 352, protein: 25, carbs: 63, fat: 1.1 },
];

const workoutTemplates: Record<string, Exercise[]> = {
  Push: [
    { id: createId(), name: "Incline Chest Press", sets: makeSets(4, 15, 10, 2) },
    { id: createId(), name: "Decline Chest Press", sets: makeSets(4, 15, 10, 2) },
    { id: createId(), name: "Shoulder Press", sets: makeSets(3, 12, 10, 2) },
    { id: createId(), name: "Lateral Raise", sets: makeSets(4, 8, 15, 2) },
    { id: createId(), name: "Triceps Pushdown", sets: makeSets(3, 15, 12, 2) },
  ],
  Pull: [
    { id: createId(), name: "Lat Pulldown", sets: makeSets(4, 40, 10, 2) },
    { id: createId(), name: "Chest Supported Row", sets: makeSets(4, 20, 10, 2) },
    { id: createId(), name: "Cable Rear Delt Fly", sets: makeSets(3, 5, 15, 2) },
    { id: createId(), name: "Dumbbell Curl", sets: makeSets(3, 10, 10, 2) },
    { id: createId(), name: "Hammer Curl", sets: makeSets(3, 10, 12, 2) },
  ],
  Legs: [
    { id: createId(), name: "Leg Press", sets: makeSets(4, 80, 10, 2) },
    { id: createId(), name: "Romanian Deadlift", sets: makeSets(4, 40, 10, 2) },
    { id: createId(), name: "Leg Extension", sets: makeSets(3, 25, 12, 2) },
    { id: createId(), name: "Leg Curl", sets: makeSets(3, 20, 12, 2) },
    { id: createId(), name: "Standing Calf Raise", sets: makeSets(4, 25, 15, 2) },
  ],
};

const defaultCheckins: Checkin[] = [];

const defaultWorkouts: WorkoutRecord[] = [];

const defaultNutrition: FoodEntry[] = [];

const defaultPhotos: PhotoEntry[] = [];
const initialMessages: ChatMessage[] = [
  {
    id: createId(),
    role: "assistant",
    content:
      "Ben ATLAS AI Coach. Check-in, antrenman, beslenme ve fotoğraf verilerine göre seni takip ederim. İstersen planını analiz ederim, istersen doğrudan soru sorabilirsin.",
    createdAt: new Date().toISOString(),
  },
];

const motivationQuotes = [
  "Discipline beats mood.",
  "Bir gün değil, her gün kazandırır.",
  "Planı uygula, sonucu veri söylesin.",
  "Ego değil, istikrar gelişim getirir.",
  "Her tekrar karakter inşasıdır.",
  "Bugünün standardı yarının fiziğini kurar.",
  "Kendine söz ver, sonra o sözü tut.",
  "İlerleme sessiz olur, vazgeçme yüksek seslidir.",
];

const today = new Date().toISOString().slice(0, 10);

export default function AtlasDashboard({ userId, userEmail = "", userFullName = "", storageMode = "local", onSignOut }: { userId?: string; userEmail?: string; userFullName?: string; storageMode?: "local" | "cloud"; onSignOut?: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [cloudStatus, setCloudStatus] = useState<"local" | "loading" | "synced" | "saving" | "error">(storageMode === "cloud" ? "loading" : "local");
  const cloudLoadedRef = useRef(storageMode !== "cloud");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>(defaultCheckins);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>(defaultWorkouts);
  const [nutritionEntries, setNutritionEntries] = useState<FoodEntry[]>(defaultNutrition);
  const [photos, setPhotos] = useState<PhotoEntry[]>(defaultPhotos);
  const [supplements, setSupplements] = useState<SupplementEntry[]>([]);
  const [supplementForm, setSupplementForm] = useState({ name: "Kreatin", dose: "5 g", time: "Antrenman sonrası", notes: "" });
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [suggestedWorkout, setSuggestedWorkout] = useState<WorkoutRecord | null>(null);
  const [foodLookupLoading, setFoodLookupLoading] = useState(false);
  const [activeDate, setActiveDate] = useState(today);
  const [clock, setClock] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [coachMessage, setCoachMessage] = useState("Verilerini kaydet; ATLAS AI günlük kararını burada verecek.");
  const [chatInput, setChatInput] = useState("");
  const [newExerciseName, setNewExerciseName] = useState("");
  const [workoutSplitDraft, setWorkoutSplitDraft] = useState("Push");
  const [foodForm, setFoodForm] = useState({ preset: "Tavuk Göğsü (çiğ)", grams: 200, quantity: 1, amountMode: "grams", source: "preset", customName: "" });
  const [advanced, setAdvanced] = useState<AdvancedState>(defaultAdvancedState);
  const [profile, setProfile] = useState<UserProfile>({ fullName: userFullName || "", age: 0, height: 0, weight: 0, city: "", email: userEmail, photo: "" });
  const [photoNote, setPhotoNote] = useState("");
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(today);
  const [checkinForm, setCheckinForm] = useState<Checkin>(makeCheckin(today, defaultCheckins.at(-1)));

  useEffect(() => {
    if (storageMode === "cloud") return;
    const savedCheckins = localStorage.getItem("atlas-checkins-v2");
    const savedWorkouts = localStorage.getItem("atlas-workouts-v2");
    const savedNutrition = localStorage.getItem("atlas-nutrition-v2");
    const savedPhotos = localStorage.getItem("atlas-photos-v2");
    const savedMessages = localStorage.getItem("atlas-messages-v2");
    const savedSupplements = localStorage.getItem("atlas-supplements-v1");
    const savedSuggestedWorkout = localStorage.getItem("atlas-suggested-workout-v1");
    const savedProfile = localStorage.getItem("atlas-profile-v1");
    const savedAdvanced = localStorage.getItem("atlas-advanced-v1");
    if (savedCheckins) setCheckins(JSON.parse(savedCheckins));
    if (savedWorkouts) setWorkouts(JSON.parse(savedWorkouts));
    if (savedNutrition) setNutritionEntries(JSON.parse(savedNutrition));
    if (savedPhotos) setPhotos(JSON.parse(savedPhotos));
    if (savedMessages) setMessages(JSON.parse(savedMessages));
    if (savedSupplements) setSupplements(JSON.parse(savedSupplements));
    if (savedSuggestedWorkout) setSuggestedWorkout(JSON.parse(savedSuggestedWorkout));
    if (savedProfile) setProfile({ ...profile, ...JSON.parse(savedProfile) });
    if (savedAdvanced) setAdvanced({ ...defaultAdvancedState, ...JSON.parse(savedAdvanced) });
  }, [storageMode]);

  useEffect(() => {
    if (storageMode !== "cloud" || !userId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    setCloudStatus("loading");
    supabase
      .from("atlas_user_state")
      .select("app_state")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(error);
          setCloudStatus("error");
          cloudLoadedRef.current = true;
          return;
        }
        const state = data?.app_state as any;
        if (state) {
          if (Array.isArray(state.checkins)) setCheckins(state.checkins);
          if (Array.isArray(state.workouts)) setWorkouts(state.workouts);
          if (Array.isArray(state.nutritionEntries)) setNutritionEntries(state.nutritionEntries);
          if (Array.isArray(state.photos)) setPhotos(state.photos);
          if (Array.isArray(state.supplements)) setSupplements(state.supplements);
          if (Array.isArray(state.messages)) setMessages(state.messages);
          if (state.suggestedWorkout && typeof state.suggestedWorkout === "object") setSuggestedWorkout(state.suggestedWorkout);
          if (state.profile && typeof state.profile === "object") setProfile((prev) => ({ ...prev, ...state.profile, email: state.profile.email || userEmail }));
          if (state.advanced && typeof state.advanced === "object") setAdvanced({ ...defaultAdvancedState, ...state.advanced });
          if (typeof state.activeDate === "string") setActiveDate(state.activeDate);
        }
        cloudLoadedRef.current = true;
        setCloudStatus("synced");
      });
    return () => { cancelled = true; };
  }, [storageMode, userId]);

  useEffect(() => { if (storageMode === "local") localStorage.setItem("atlas-checkins-v2", JSON.stringify(checkins)); }, [storageMode, checkins]);
  useEffect(() => { if (storageMode === "local") localStorage.setItem("atlas-workouts-v2", JSON.stringify(workouts)); }, [storageMode, workouts]);
  useEffect(() => { if (storageMode === "local") localStorage.setItem("atlas-nutrition-v2", JSON.stringify(nutritionEntries)); }, [storageMode, nutritionEntries]);
  useEffect(() => { if (storageMode === "local") localStorage.setItem("atlas-photos-v2", JSON.stringify(photos)); }, [storageMode, photos]);
  useEffect(() => { if (storageMode === "local") localStorage.setItem("atlas-messages-v2", JSON.stringify(messages)); }, [storageMode, messages]);
  useEffect(() => { if (storageMode === "local") localStorage.setItem("atlas-supplements-v1", JSON.stringify(supplements)); }, [storageMode, supplements]);
  useEffect(() => { if (storageMode === "local") localStorage.setItem("atlas-suggested-workout-v1", JSON.stringify(suggestedWorkout)); }, [storageMode, suggestedWorkout]);
  useEffect(() => { if (storageMode === "local") localStorage.setItem("atlas-profile-v1", JSON.stringify(profile)); }, [storageMode, profile]);
  useEffect(() => { if (storageMode === "local") localStorage.setItem("atlas-advanced-v1", JSON.stringify(advanced)); }, [storageMode, advanced]);

  useEffect(() => {
    if (storageMode !== "cloud" || !userId || !cloudLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setCloudStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { error } = await supabase.from("atlas_user_state").upsert({
        user_id: userId,
        full_name: profile.fullName || userFullName || userEmail || "ATLAS User",
        app_state: { checkins, workouts, nutritionEntries, photos, supplements, messages, activeDate, suggestedWorkout, profile, advanced },
      }, { onConflict: "user_id" });
      setCloudStatus(error ? "error" : "synced");
      if (error) console.error(error);
    }, 900);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [storageMode, userId, userFullName, userEmail, checkins, workouts, nutritionEntries, photos, supplements, messages, activeDate, suggestedWorkout, profile, advanced]);

  useEffect(() => {
    const current = checkins.find((item) => item.date === activeDate);
    setCheckinForm(current ? current : makeCheckin(activeDate, checkins.at(-1)));
  }, [activeDate, checkins]);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const latest = checkins.at(-1) ?? makeCheckin(today);
  const activeCheckin = checkins.find((item) => item.date === activeDate) ?? null;
  const currentWorkout = workouts.find((item) => item.date === activeDate) ?? null;
  const activeNutritionEntries = nutritionEntries.filter((item) => item.date === activeDate);
  const activePhotos = photos.filter((item) => item.date === activeDate);
  const activeSupplements = supplements.filter((item) => item.date === activeDate);
  const averageWeight = useMemo(() => avg(checkins.slice(-7).map((c) => c.weight)), [checkins]);
  const startWeight = checkins[0]?.weight || latest.weight;
  const weightChange = latest.weight - startWeight;
  const activeNutritionTotals = calculateNutritionTotals(activeNutritionEntries);
  const atlasScore = checkins.length
    ? Math.round((latest.nutrition * 0.35) + (Math.min(latest.sleep / 8, 1) * 100 * 0.25) + (Math.min(latest.steps / 9000, 1) * 100 * 0.2) + ((10 - latest.stress) * 10 * 0.2))
    : 0;
  const calorieTarget = advanced.calorieTarget || 2450;
  const proteinTarget = advanced.proteinTarget || 200;
  const suggestionList = buildSuggestions(latest, activeNutritionTotals, currentWorkout, activePhotos.length);
  const quote = motivationQuotes[clock.getHours() % motivationQuotes.length];
  const historyDates = useMemo(() => {
    const uniqueDates = new Set<string>();
    checkins.forEach((item) => uniqueDates.add(item.date));
    workouts.forEach((item) => uniqueDates.add(item.date));
    nutritionEntries.forEach((item) => uniqueDates.add(item.date));
    photos.forEach((item) => uniqueDates.add(item.date));
    supplements.forEach((item) => uniqueDates.add(item.date));
    return [...uniqueDates].sort((a, b) => b.localeCompare(a));
  }, [checkins, workouts, nutritionEntries, photos, supplements]);

  function saveCheckin(event: FormEvent) {
    event.preventDefault();
    const next = [...checkins.filter((item) => item.date !== checkinForm.date), checkinForm].sort((a, b) => a.date.localeCompare(b.date));
    setCheckins(next);
    setActiveDate(checkinForm.date);
    setSelectedHistoryDate(checkinForm.date);
    setTab("dashboard");
  }

  function upsertWorkoutForDate(split = workoutSplitDraft) {
    const existing = workouts.find((item) => item.date === activeDate);
    if (existing) return existing;
    const newWorkout: WorkoutRecord = {
      id: createId(),
      date: activeDate,
      split,
      name: `${split.toUpperCase()} — ${splitLabel(split)}`,
      exercises: cloneExercises(workoutTemplates[split] || workoutTemplates.Push),
    };
    setWorkouts((prev) => [...prev, newWorkout].sort((a, b) => a.date.localeCompare(b.date)));
    return newWorkout;
  }

  function applyTemplate(split: string) {
    const existing = workouts.find((item) => item.date === activeDate);

    if (existing) {
      const message =
        existing.source === "ai"
          ? "Bu güne ait AI tarafından onaylanmış antrenman var. Manuel şablona geçersen bu antrenman değiştirilecek. Devam edilsin mi?"
          : "Bu güne ait mevcut antrenman şablonla değiştirilecek. Devam edilsin mi?";

      if (!window.confirm(message)) return;
    }

    const nextExercises = cloneExercises(
      workoutTemplates[split] || workoutTemplates.Push
    );

    if (existing) {
      setWorkouts((prev): WorkoutRecord[] =>
        prev.map((item): WorkoutRecord =>
          item.date === activeDate
            ? {
                ...item,
                split,
                name: `${split.toUpperCase()} — ${splitLabel(split)}`,
                exercises: nextExercises,
                source: "manual" as const,
              }
            : item
        )
      );
    } else {
      const newWorkout: WorkoutRecord = {
        id: createId(),
        date: activeDate,
        split,
        name: `${split.toUpperCase()} — ${splitLabel(split)}`,
        exercises: nextExercises,
        source: "manual",
      };

      setWorkouts((prev): WorkoutRecord[] =>
        [...prev, newWorkout].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      );
    }

    setWorkoutSplitDraft(split);
  }

  function updateWorkoutMeta(key: "name" | "split", value: string) {
    upsertWorkoutForDate();
    setWorkouts((prev) => prev.map((item) => item.date === activeDate ? { ...item, [key]: value } : item));
  }

  function updateExerciseName(exerciseId: string, value: string) {
    setWorkouts((prev) => prev.map((item) => item.date === activeDate ? { ...item, exercises: item.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, name: value } : exercise) } : item));
  }

  function updateSet(exerciseId: string, setIndex: number, key: keyof WorkoutSet, value: number) {
    setWorkouts((prev) => prev.map((item) => item.date === activeDate ? {
      ...item,
      exercises: item.exercises.map((exercise) => exercise.id === exerciseId ? {
        ...exercise,
        sets: exercise.sets.map((set, index) => index === setIndex ? { ...set, [key]: value } : set),
      } : exercise),
    } : item));
  }

  function addExercise() {
    const name = newExerciseName.trim();
    if (!name) return;
    upsertWorkoutForDate();
    setWorkouts((prev) => prev.map((item) => item.date === activeDate ? {
      ...item,
      exercises: [...item.exercises, { id: createId(), name, sets: makeSets(3, 0, 10, 2) }],
    } : item));
    setNewExerciseName("");
  }

  function removeExercise(exerciseId: string) {
    setWorkouts((prev) => prev.map((item) => item.date === activeDate ? { ...item, exercises: item.exercises.filter((exercise) => exercise.id !== exerciseId) } : item));
  }

  function addSet(exerciseId: string) {
    setWorkouts((prev) => prev.map((item) => item.date === activeDate ? {
      ...item,
      exercises: item.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, sets: [...exercise.sets, { weight: 0, reps: 10, rir: 2 }] } : exercise),
    } : item));
  }

  function removeSet(exerciseId: string, indexToRemove: number) {
    setWorkouts((prev) => prev.map((item) => item.date === activeDate ? {
      ...item,
      exercises: item.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, sets: exercise.sets.filter((_, index) => index !== indexToRemove) } : exercise),
    } : item));
  }

  function deleteWorkout() {
    setWorkouts((prev) => prev.filter((item) => item.date !== activeDate));
  }

  async function addFoodEntry(event: FormEvent) {
    event.preventDefault();
    const grams = Number(foodForm.grams) || 0;
    if (grams <= 0) return;

    if (foodForm.source === "preset") {
      const preset = foodPresets.find((item) => item.name === foodForm.preset) || foodPresets[0];
      const useQuantity = foodForm.amountMode === "quantity" && preset.gramsPerUnit && preset.unitLabel;
      const quantity = Math.max(1, Number(foodForm.quantity) || 1);
      const calculatedGrams = useQuantity ? quantity * Number(preset.gramsPerUnit) : grams;
      let built = buildFoodEntry(activeDate, foodForm.preset, calculatedGrams);
      if (useQuantity) {
        setFoodLookupLoading(true);
        try {
          const response = await fetch("/api/nutrition/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ foodName: `${foodForm.preset}, ${quantity} ${preset.unitLabel}, orta boy`, grams: calculatedGrams }),
          });
          const data = await response.json();
          if (response.ok && data?.nutrition) {
            const n = data.nutrition;
            built = {
              ...built,
              name: n.name || foodForm.preset,
              calories: round1(Number(n.calories) || built.calories),
              protein: round1(Number(n.protein) || built.protein),
              carbs: round1(Number(n.carbs) || built.carbs),
              fat: round1(Number(n.fat) || built.fat),
            };
          }
        } catch (error) {
          console.warn("Adet bazlı besin araştırması başarısız; yerleşik ortalama kullanıldı.", error);
        } finally {
          setFoodLookupLoading(false);
        }
        built.quantity = quantity;
        built.unitLabel = preset.unitLabel;
      }
      setNutritionEntries((prev) => [...prev, built]);
      return;
    }

    const customName = foodForm.customName.trim();
    if (!customName) {
      window.alert("Özel besinin adını yazmalısın.");
      return;
    }

    setFoodLookupLoading(true);
    try {
      const response = await fetch("/api/nutrition/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodName: customName, grams }),
      });
      const data = await response.json();
      if (!response.ok || !data?.nutrition) throw new Error(data?.message || "Makro bilgisi bulunamadı.");
      const n = data.nutrition;
      setNutritionEntries((prev) => [...prev, {
        id: createId(),
        date: activeDate,
        source: "ai-web",
        name: n.name || customName,
        grams,
        calories: round1(Number(n.calories) || 0),
        protein: round1(Number(n.protein) || 0),
        carbs: round1(Number(n.carbs) || 0),
        fat: round1(Number(n.fat) || 0),
      }]);
      setFoodForm((prev) => ({ ...prev, customName: "" }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Besin makroları bulunamadı.");
    } finally {
      setFoodLookupLoading(false);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (storageMode === "cloud") {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ data: { full_name: profile.fullName } });
        if (error) {
          window.alert(error.message);
          return;
        }
      }
    }
    window.alert("Profil bilgileri kaydedildi.");
  }

  function handleProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfile((prev) => ({ ...prev, photo: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  function removeFoodEntry(id: string) {
    setNutritionEntries((prev) => prev.filter((item) => item.id !== id));
  }

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || "");
      const entry: PhotoEntry = {
        id: createId(),
        date: activeDate,
        src,
        note: photoNote,
        createdAt: new Date().toISOString(),
      };
      setPhotos((prev) => [...prev, entry]);
      setPhotoNote("");
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((item) => item.id !== id));
  }

  function addSupplement(event: FormEvent) {
    event.preventDefault();
    const name = supplementForm.name.trim();
    if (!name) return;
    const entry: SupplementEntry = {
      id: createId(),
      date: activeDate,
      name,
      dose: supplementForm.dose.trim() || "Belirtilmedi",
      time: supplementForm.time.trim() || "Belirtilmedi",
      taken: false,
      notes: supplementForm.notes.trim(),
    };
    setSupplements((prev) => [...prev, entry]);
  }

  function toggleSupplement(id: string) {
    setSupplements((prev) => prev.map((item) => item.id === id ? { ...item, taken: !item.taken } : item));
  }

  function removeSupplement(id: string) {
    setSupplements((prev) => prev.filter((item) => item.id !== id));
  }

  async function runAnalysis() {
    setLoading(true);
    try {
      const recentNutritionDates = [...new Set(
        nutritionEntries
          .filter((item) => item.date >= getDateDaysAgo(7))
          .map((item) => item.date)
      )].sort();

      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "analysis",
          activeDate,
          profile: {
            fullName: profile.fullName || userFullName || "Kullanıcı",
            age: profile.age || null,
            height: profile.height || null,
            weight: latest?.weight || profile.weight || null,
            city: profile.city || "",
            goal: advanced.goal,
            experience: advanced.experience,
            activityLevel: advanced.activityLevel,
            trainingDays: advanced.trainingDays,
            calorieTarget,
            proteinTarget,
            cardioMinutes: advanced.cardioMinutes,
            waterTarget: advanced.waterTarget,
          },
          latestCheckin: checkins.length > 0 ? {
            date: latest.date,
            weight: latest.weight,
            waist: latest.waist,
            sleep: latest.sleep,
            sleepQuality: latest.sleepQuality,
            energy: latest.energy,
            soreness: latest.soreness,
            stress: latest.stress,
            steps: latest.steps,
            water: latest.water,
            nutrition: latest.nutrition,
            pain: latest.pain,
          } : null,
          selectedDay: {
            date: activeDate,
            checkin: activeCheckin,
            workout: currentWorkout ? compactWorkout(currentWorkout) : null,
            nutritionTotals: activeNutritionTotals,
            foodCount: activeNutritionEntries.length,
            photoCount: activePhotos.length,
            supplements: activeSupplements.map(compactSupplement),
          },
          recentCheckins: checkins.slice(-14).map((item) => ({
            date: item.date,
            weight: item.weight,
            waist: item.waist,
            sleep: item.sleep,
            energy: item.energy,
            stress: item.stress,
            soreness: item.soreness,
          })),
          recentWorkouts: workouts.slice(-8).map(compactWorkout),
          recentNutritionTotals: recentNutritionDates.map((date) => ({
            date,
            ...calculateNutritionTotals(
              nutritionEntries.filter((item) => item.date === date)
            ),
          })),
          supplements: supplements.slice(-30).map(compactSupplement),
          photoSummary: {
            totalPhotos: photos.length,
            recentDates: [...new Set(photos.map((photo) => photo.date))]
              .sort()
              .slice(-8),
          },
          recentMessages: messages.slice(-4).map((message) => ({
            role: message.role,
            content: message.content.slice(0, 1000),
          })),
        }),
      });

      const data = await response.json();
      const reply = typeof data?.message === "string"
        ? data.message
        : "Analiz yanıtı alınamadı.";

      setCoachMessage(reply);
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: reply,
          createdAt: new Date().toISOString(),
        },
      ]);
      setTab("coach");
    } catch (error) {
      console.error("ATLAS analysis request error:", error);
      const fallback = buildLocalAnalysis(
        latest,
        currentWorkout,
        activeNutritionTotals,
        activePhotos.length
      );
      setCoachMessage(fallback);
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: fallback,
          createdAt: new Date().toISOString(),
        },
      ]);
      setTab("coach");
    } finally {
      setLoading(false);
    }
  }

  async function sendChatMessage(messageText?: string) {
    const text = (messageText ?? chatInput).trim();
    if (!text || loading) return;

    const nextUserMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, nextUserMessage];

    setMessages(nextMessages);
    setChatInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          userMessage: text,
          activeDate,
          context: {
            profile: {
              fullName: profile.fullName || userFullName || "Kullanıcı",
              age: profile.age || null,
              height: profile.height || null,
              weight: latest?.weight || profile.weight || null,
              city: profile.city || "",
              goal: advanced.goal,
              experience: advanced.experience,
              trainingDays: advanced.trainingDays,
              calorieTarget,
              proteinTarget,
            },
            latestCheckin: checkins.length > 0 ? {
              date: latest.date,
              weight: latest.weight,
              waist: latest.waist,
              sleep: latest.sleep,
              energy: latest.energy,
              soreness: latest.soreness,
              stress: latest.stress,
              steps: latest.steps,
              water: latest.water,
              pain: latest.pain,
            } : null,
            activeCheckin,
            activeWorkout: currentWorkout ? compactWorkout(currentWorkout) : null,
            activeNutritionTotals,
            activeFoodNames: activeNutritionEntries
              .slice(-20)
              .map((item) => `${item.name} (${item.quantity && item.unitLabel ? `${item.quantity} ${item.unitLabel}` : `${item.grams} g`})`),
            activePhotoCount: activePhotos.length,
            activeSupplements: activeSupplements.map(compactSupplement),
            recentCheckins: checkins.slice(-10).map((item) => ({
              date: item.date,
              weight: item.weight,
              waist: item.waist,
              sleep: item.sleep,
              energy: item.energy,
            })),
            recentWorkouts: workouts.slice(-5).map((workout) => ({
              date: workout.date,
              split: workout.split,
              name: workout.name,
              exerciseCount: workout.exercises.length,
            })),
            photoSummary: {
              totalPhotos: photos.length,
              activeDatePhotoCount: activePhotos.length,
            },
          },
          messages: nextMessages.slice(-6).map((message) => ({
            role: message.role,
            content: message.content.slice(0, 1200),
          })),
        }),
      });

      const data = await response.json();
      const reply = typeof data?.message === "string"
        ? data.message
        : "AI yanıtı alınamadı.";

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: reply,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (data?.proposedAction) {
        setPendingAction(data.proposedAction as PendingAction);
      }
    } catch (error) {
      console.error("ATLAS chat request error:", error);
      const fallback = buildLocalChatResponse(
        text,
        latest,
        activeNutritionTotals,
        currentWorkout,
        activePhotos.length
      );
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: fallback,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function confirmPendingAction() {
    if (!pendingAction) return;

    if (pendingAction.type === "update_weight") {
      const { date, weight } = pendingAction.payload;
      const existing = checkins.find((item) => item.date === date);
      const nextCheckin = existing
        ? { ...existing, weight }
        : { ...makeCheckin(date, checkins.at(-1)), weight };

      setCheckins((prev) => [...prev.filter((item) => item.date !== date), nextCheckin].sort((a, b) => a.date.localeCompare(b.date)));
      setActiveDate(date);
      setSelectedHistoryDate(date);
      setMessages((prev) => [...prev, { id: createId(), role: "assistant", content: `${weight.toFixed(1)} kg değeri ${formatDate(date)} tarihine kaydedildi.`, createdAt: new Date().toISOString() }]);
    }

    if (pendingAction.type === "create_workout") {
      const { date, split, name, exercises } = pendingAction.payload;
      const proposal: WorkoutRecord = {
        id: createId(),
        date,
        split,
        name,
        source: "ai",
        exercises: exercises.map((exercise) => ({
          id: createId(),
          name: exercise.name,
          sets: exercise.sets.map((set) => ({ weight: Number(set.weight) || 0, reps: Number(set.reps) || 10, rir: Number(set.rir) || 2 })),
        })),
      };
      setSuggestedWorkout(proposal);
      setMessages((prev) => [...prev, { id: createId(), role: "assistant", content: `${name} öneri olarak hazırlandı. Öneri Antrenmanı sekmesinden inceleyip onaylayabilirsin.`, createdAt: new Date().toISOString() }]);
      setTab("suggested");
    }

    setPendingAction(null);
  }

  function approveSuggestedWorkout() {
    if (!suggestedWorkout) return;
    const shouldDelete = window.confirm("Önerilen program uygulanırsa mevcut tüm antrenman kayıtların silinecek ve yalnızca bu öneri kalacak. Devam edilsin mi?");
    if (!shouldDelete) return;

    const approvedWorkout: WorkoutRecord = {
      ...suggestedWorkout,
      id: createId(),
      source: "ai",
      exercises: suggestedWorkout.exercises.map((exercise) => ({
        ...exercise,
        id: createId(),
        sets: exercise.sets.map((set) => ({ ...set })),
      })),
    };

    setWorkouts([approvedWorkout]);
    setWorkoutSplitDraft(approvedWorkout.split);
    setActiveDate(approvedWorkout.date);
    setSelectedHistoryDate(approvedWorkout.date);
    setMessages((prev) => [...prev, { id: createId(), role: "assistant", content: `${approvedWorkout.name} onaylandı. Eski antrenmanlar kaldırıldı ve onaylanan AI programı Antrenman bölümüne aktarıldı.`, createdAt: new Date().toISOString() }]);
    setSuggestedWorkout(null);
    setTab("workout");
  }

  function rejectSuggestedWorkout() {
    if (!suggestedWorkout) return;
    const ok = window.confirm("Önerilen antrenmanı silmek istiyor musun?");
    if (!ok) return;
    setSuggestedWorkout(null);
  }

  function rejectPendingAction() {
    setMessages((prev) => [...prev, { id: createId(), role: "assistant", content: "Değişiklik uygulanmadı.", createdAt: new Date().toISOString() }]);
    setPendingAction(null);
  }

  async function resetAllData() {
    const firstConfirm = window.confirm("Tüm check-in, antrenman, beslenme, fotoğraf ve sohbet kayıtların silinecek. Devam edilsin mi?");
    if (!firstConfirm) return;

    const secondConfirm = window.confirm("Bu işlem geri alınamaz. Tüm verileri gerçekten sıfırlamak istiyor musun?");
    if (!secondConfirm) return;

    setCloudStatus(storageMode === "cloud" ? "saving" : "local");

    localStorage.removeItem("atlas-checkins-v2");
    localStorage.removeItem("atlas-workouts-v2");
    localStorage.removeItem("atlas-nutrition-v2");
    localStorage.removeItem("atlas-photos-v2");
    localStorage.removeItem("atlas-messages-v2");
    localStorage.removeItem("atlas-supplements-v1");
    localStorage.removeItem("atlas-suggested-workout-v1");

    setCheckins([]);
    setWorkouts([]);
    setNutritionEntries([]);
    setPhotos([]);
    setSupplements([]);
    setMessages(initialMessages);
    setSuggestedWorkout(null);
    setCoachMessage("Henüz analiz edilecek veri yok. İlk check-in kaydını oluşturarak başlayabilirsin.");
    setActiveDate(today);
    setSelectedHistoryDate(today);
    setCheckinForm(makeCheckin(today));
    setTab("dashboard");

    if (storageMode === "cloud" && userId) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { error } = await supabase
          .from("atlas_user_state")
          .upsert({
            user_id: userId,
            full_name: profile.fullName || userFullName || userEmail || "ATLAS User",
            app_state: {
              checkins: [],
              workouts: [],
              nutritionEntries: [],
              photos: [],
              supplements: [],
              messages: initialMessages,
              activeDate: today,
              suggestedWorkout: null,
              profile,
            },
          }, { onConflict: "user_id" });

        setCloudStatus(error ? "error" : "synced");
        if (error) console.error(error);
      }
    }
  }

  const historyWorkout = workouts.find((item) => item.date === selectedHistoryDate) ?? null;
  const historyNutritionEntries = nutritionEntries.filter((item) => item.date === selectedHistoryDate);
  const historyNutritionTotals = calculateNutritionTotals(historyNutritionEntries);
  const historyPhotos = photos.filter((item) => item.date === selectedHistoryDate);
  const historyCheckin = checkins.find((item) => item.date === selectedHistoryDate) ?? null;

  return (
    <main className="app-shell">
      <DragonBackdrop />
      <aside className="sidebar">
        <div className="brand brand-logo">
          <img src="/atlas-logo.jpg" alt="ATLAS logo" className="logo-image" />
          <div>
            <strong>ATLAS</strong>
            <small>DISCIPLINE • KNOWLEDGE • PROGRESS</small>
          </div>
        </div>
        <nav>
          <NavButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} label="Kontrol Merkezi" />
          <NavButton active={tab === "checkin"} onClick={() => setTab("checkin")} label="Günlük Check-in" />
          <NavButton active={tab === "workout"} onClick={() => setTab("workout")} label="Antrenman" />
          <NavButton active={tab === "suggested"} onClick={() => setTab("suggested")} label="Öneri Antrenmanı" />
          <NavButton active={tab === "nutrition"} onClick={() => setTab("nutrition")} label="Beslenme" />
          <NavButton active={tab === "supplements"} onClick={() => setTab("supplements")} label="Supplement Takibi" />
          <NavButton active={tab === "advanced"} onClick={() => setTab("advanced")} label="Gelişim Merkezi" />
          <NavButton active={tab === "history"} onClick={() => setTab("history")} label="Günlük Geçmiş" />
          <NavButton active={tab === "photos"} onClick={() => setTab("photos")} label="Fotoğraflar" />
          <NavButton active={tab === "profile"} onClick={() => setTab("profile")} label="Profil" />
          <NavButton active={tab === "coach"} onClick={() => setTab("coach")} label="ATLAS AI Sohbet" />
        </nav>
        <div className="account-area">
          <div className={`sync-pill ${cloudStatus}`}>{syncText(cloudStatus)}</div>
          {userEmail && <small className="account-email">{userEmail}</small>}
          <button className="signout-button" onClick={resetAllData}>Tüm Verileri Sıfırla</button>
          {onSignOut && <button className="signout-button" onClick={onSignOut}>Çıkış Yap</button>}
        </div>
        <div className="profile-card">
          <div className="avatar">{profile.photo ? <img src={profile.photo} alt="Profil" className="avatar-image" /> : initials(profile.fullName || userFullName || userEmail)}</div>
          <div>
            <strong>{profile.fullName || userFullName || "ATLAS Kullanıcısı"}</strong>
            <small>Kişisel gelişim paneli</small>
          </div>
        </div>
      </aside>

      <section className="content">
        <div className="motivation-marquee">
          <div className="motivation-track">{quote} • {quote} • {quote} • {quote} • {quote}</div>
        </div>

        <header className="topbar">
          <div>
            <p className="eyebrow">AKTİF TARİH • {formatDate(activeDate)}</p>
            <h1>{tabTitle(tab)}</h1>
          </div>
          <div className="topbar-actions">
            <div className="time-card">
              <span>Tarih</span>
              <strong>{clock.toLocaleDateString("tr-TR")}</strong>
              <small>{clock.toLocaleTimeString("tr-TR")}</small>
            </div>
            <button className="coach-button" onClick={runAnalysis} disabled={loading}>{loading ? "Analiz ediliyor..." : "ATLAS Analiz"}</button>
          </div>
        </header>

        {tab === "dashboard" && (
          <Dashboard
            latest={latest}
            hasCheckins={checkins.length > 0}
            averageWeight={averageWeight}
            weightChange={weightChange}
            atlasScore={atlasScore}
            checkins={checkins}
            calorieTarget={calorieTarget}
            proteinTarget={proteinTarget}
            activeDate={activeDate}
            setActiveDate={setActiveDate}
            onCheckin={() => setTab("checkin")}
            onWorkout={() => setTab("workout")}
            onNutrition={() => setTab("nutrition")}
            coachMessage={coachMessage}
            activeNutritionTotals={activeNutritionTotals}
            suggestions={suggestionList}
            currentWorkout={currentWorkout}
            userFullName={profile.fullName || userFullName}
          />
        )}

        {tab === "checkin" && (
          <CheckinForm value={checkinForm} onChange={setCheckinForm} onSubmit={saveCheckin} />
        )}

        {tab === "workout" && (
          <WorkoutEditor
            activeDate={activeDate}
            setActiveDate={setActiveDate}
            workout={currentWorkout}
            workoutSplitDraft={workoutSplitDraft}
            setWorkoutSplitDraft={setWorkoutSplitDraft}
            applyTemplate={applyTemplate}
            updateWorkoutMeta={updateWorkoutMeta}
            updateExerciseName={updateExerciseName}
            updateSet={updateSet}
            addExercise={addExercise}
            removeExercise={removeExercise}
            addSet={addSet}
            removeSet={removeSet}
            deleteWorkout={deleteWorkout}
            newExerciseName={newExerciseName}
            setNewExerciseName={setNewExerciseName}
            ensureWorkout={upsertWorkoutForDate}
          />
        )}

        {tab === "suggested" && (
          <SuggestedWorkoutPanel workout={suggestedWorkout} onApprove={approveSuggestedWorkout} onReject={rejectSuggestedWorkout} />
        )}

        {tab === "nutrition" && (
          <NutritionEditor
            activeDate={activeDate}
            setActiveDate={setActiveDate}
            entries={activeNutritionEntries}
            totals={activeNutritionTotals}
            form={foodForm}
            setForm={setFoodForm}
            addFoodEntry={addFoodEntry}
            removeFoodEntry={removeFoodEntry}
            lookupLoading={foodLookupLoading}
          />
        )}

        {tab === "supplements" && (
          <SupplementPanel
            activeDate={activeDate}
            setActiveDate={setActiveDate}
            entries={activeSupplements}
            form={supplementForm}
            setForm={setSupplementForm}
            addSupplement={addSupplement}
            toggleSupplement={toggleSupplement}
            removeSupplement={removeSupplement}
          />
        )}


        {tab === "advanced" && (
          <AdvancedCenter
            advanced={advanced}
            setAdvanced={setAdvanced}
            profile={profile}
            setProfile={setProfile}
            checkins={checkins}
            workouts={workouts}
            photos={photos}
            nutritionEntries={nutritionEntries}
            setTab={setTab}
          />
        )}

        {tab === "history" && (
          <HistoryView
            dates={historyDates}
            setSelectedDate={(date: string) => {
  setSelectedHistoryDate(date);
  setActiveDate(date);
}}  
            checkin={historyCheckin}
            workout={historyWorkout}
            nutritionEntries={historyNutritionEntries}
            nutritionTotals={historyNutritionTotals}
            photos={historyPhotos}
          />
        )}

        {tab === "photos" && (
          <PhotosPanel
            activeDate={activeDate}
            setActiveDate={setActiveDate}
            photos={activePhotos}
            photoNote={photoNote}
            setPhotoNote={setPhotoNote}
            onUpload={handlePhotoUpload}
            onRemove={removePhoto}
          />
        )}

        {tab === "profile" && (
          <ProfilePanel profile={profile} setProfile={setProfile} onSubmit={saveProfile} onPhoto={handleProfilePhoto} />
        )}

        {tab === "coach" && (
          <CoachPanel
            message={coachMessage}
            messages={messages}
            onAnalyze={runAnalysis}
            loading={loading}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendChatMessage={sendChatMessage}
            pendingAction={pendingAction}
            confirmPendingAction={confirmPendingAction}
            rejectPendingAction={rejectPendingAction}
            suggestions={[
              "Bugünkü verilerime göre ne yapmalıyım?",
              "Kalori ve makrolarım yeterli mi?",
              "Antrenmanımda neyi geliştirmeliyim?",
            ]}
          />
        )}
      </section>
      {!advanced.onboardingComplete && <OnboardingModal advanced={advanced} setAdvanced={setAdvanced} profile={profile} setProfile={setProfile} />}
    </main>
  );
}

function NavButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}>{label}</button>;
}

function Dashboard({ latest, hasCheckins, averageWeight, weightChange, atlasScore, checkins, calorieTarget, proteinTarget, activeDate, setActiveDate, onCheckin, onWorkout, onNutrition, coachMessage, activeNutritionTotals, suggestions, currentWorkout, userFullName }: any) {
  const minWeight = hasCheckins ? Math.min(...checkins.map((c: Checkin) => c.weight)) - 0.4 : 0;
  const maxWeight = hasCheckins ? Math.max(...checkins.map((c: Checkin) => c.weight)) + 0.4 : 1;

  return <>
    <div className="hero-card red-glow">
      <div>
        <p className="eyebrow">BUGÜNÜN DURUMU</p>
        <h2>Hoş geldin, {firstName(userFullName) || "ATLAS Kullanıcısı"}.</h2>
        <p>{hasCheckins ? <>Push, Pull ve Legs antrenmanlarını; beslenmeni, makrolarını, günlük fotoğraflarını ve check-in verilerini tek panelde topladık. Aktif gün: <b>{formatDate(activeDate)}</b>.</> : <>Henüz kayıtlı verin yok. İlk check-in kaydını girerek tertemiz bir başlangıç yap.</>}</p>
      </div>
      <div className="score">
        <strong>{atlasScore}</strong>
        <span>ATLAS SKORU</span>
      </div>
    </div>

    <div className="metric-grid">
      <Metric label="Güncel Kilo" value={hasCheckins ? `${latest.weight.toFixed(1)} kg` : "—"} sub={hasCheckins ? `${weightChange.toFixed(1)} kg başlangıçtan` : "İlk check-in bekleniyor"} />
      <Metric label="7 Günlük Ortalama" value={hasCheckins ? `${averageWeight.toFixed(1)} kg` : "—"} sub={hasCheckins ? "Kayıt trendi" : "Henüz veri yok"} />
      <Metric label="Bugünkü Kalori" value={`${activeNutritionTotals.calories.toFixed(0)} kcal`} sub={`${activeNutritionTotals.protein.toFixed(1)} g protein`} />
      <Metric label="Bugünkü Split" value={currentWorkout?.split || "Henüz yok"} sub={currentWorkout ? `${currentWorkout.exercises.length} hareket` : "Antrenman oluştur"} />
    </div>

    <div className="three-column">
      <section className="panel">
        <div className="panel-head"><div><p className="eyebrow">KİLO TRENDİ</p><h3>Son kayıtlar</h3></div><span className="status-pill">{hasCheckins ? "Kayıt aktif" : "Başlangıç"}</span></div>
        {hasCheckins ? <>
          <div className="chart"><svg viewBox="0 0 700 220" preserveAspectRatio="none"><polyline points={checkins.map((c: Checkin, i: number) => `${(i / Math.max(checkins.length - 1, 1)) * 680 + 10},${200 - ((c.weight - minWeight) / (maxWeight - minWeight)) * 170}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />{checkins.map((c: Checkin, i: number) => <circle key={c.date} cx={(i / Math.max(checkins.length - 1, 1)) * 680 + 10} cy={200 - ((c.weight - minWeight) / (maxWeight - minWeight)) * 170} r="6" fill="currentColor" />)}</svg></div>
          <div className="chart-labels">{checkins.map((c: Checkin) => <span key={c.date}>{c.date.slice(5)}</span>)}</div>
        </> : <div className="empty-state"><p>Kilo grafiği ilk check-in kaydından sonra oluşacak.</p></div>}
      </section>

      <section className="panel">
        <p className="eyebrow">GÜNÜN HEDEFLERİ</p>
        <h3>Makro ve hedefler</h3>
        <div className="targets">
          <Target label="Kalori" value={`${calorieTarget} kcal`} progress={Math.min(Math.round((activeNutritionTotals.calories / calorieTarget) * 100), 100)} />
          <Target label="Protein" value={`${proteinTarget} g`} progress={Math.min(Math.round((activeNutritionTotals.protein / proteinTarget) * 100), 100)} />
          <Target label="Karbonhidrat" value={`${activeNutritionTotals.carbs.toFixed(0)} g`} progress={Math.min(Math.round((activeNutritionTotals.carbs / 250) * 100), 100)} />
          <Target label="Yağ" value={`${activeNutritionTotals.fat.toFixed(0)} g`} progress={Math.min(Math.round((activeNutritionTotals.fat / 80) * 100), 100)} />
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">ATLAS ÖNERİLERİ</p>
        <h3>Bugünün kısa notları</h3>
        <div className="suggestion-list">
          {suggestions.map((item: string) => <div key={item} className="suggestion-item">{item}</div>)}
        </div>
      </section>
    </div>

    <div className="action-grid">
      <button className="action-card" onClick={onCheckin}><span>01</span><strong>Check-in gir</strong><small>Kilo, bel, uyku ve enerji kaydı</small></button>
      <button className="action-card" onClick={onWorkout}><span>02</span><strong>PPL antrenmanını düzenle</strong><small>Hareket, set, tekrar, kilo ve RIR</small></button>
      <button className="action-card" onClick={onNutrition}><span>03</span><strong>Besin ekle</strong><small>Makroları hesapla ve grafiği gör</small></button>
    </div>

    <div className="two-column spaced-top">
      <section className="panel">
        <p className="eyebrow">AI KOÇ SON ÇIKTI</p>
        <h3>Son analiz</h3>
        <div className="coach-message compact">{coachMessage}</div>
      </section>
      <section className="panel">
        <p className="eyebrow">AKTİF TARİH SEÇ</p>
        <h3>Gün değiştir</h3>
        <input type="date" value={activeDate} onChange={(event) => setActiveDate(event.target.value)} />
        <small className="help-text">Bu tarih değiştikçe antrenman, beslenme, fotoğraf ve geçmiş ekranı o güne göre güncellenir.</small>
      </section>
    </div>
  </>;
}

function CheckinForm({ value, onChange, onSubmit }: { value: Checkin; onChange: (value: Checkin) => void; onSubmit: (event: FormEvent) => void }) {
  return <form className="panel form-panel" onSubmit={onSubmit}>
    <div className="panel-head"><div><p className="eyebrow">GÜNLÜK KAYIT</p><h3>Sabah check-in</h3></div><span className="status-pill">Veri = Karar</span></div>
    <div className="form-grid">
      <Field label="Tarih"><input type="date" value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} /></Field>
      <Field label="Kilo"><input type="number" step="0.1" value={value.weight} onChange={(e) => onChange({ ...value, weight: Number(e.target.value) })} /></Field>
      <Field label="Bel Çevresi"><input type="number" step="0.1" value={value.waist} onChange={(e) => onChange({ ...value, waist: Number(e.target.value) })} /></Field>
      <Field label="Uyku (saat)"><input type="number" step="0.1" value={value.sleep} onChange={(e) => onChange({ ...value, sleep: Number(e.target.value) })} /></Field>
      <Field label="Uyku Kalitesi /10"><input type="number" step="0.1" value={value.sleepQuality} onChange={(e) => onChange({ ...value, sleepQuality: Number(e.target.value) })} /></Field>
      <Field label="Enerji /10"><input type="number" step="0.1" value={value.energy} onChange={(e) => onChange({ ...value, energy: Number(e.target.value) })} /></Field>
      <Field label="Kas Yorgunluğu /10"><input type="number" step="0.1" value={value.soreness} onChange={(e) => onChange({ ...value, soreness: Number(e.target.value) })} /></Field>
      <Field label="Stres /10"><input type="number" step="0.1" value={value.stress} onChange={(e) => onChange({ ...value, stress: Number(e.target.value) })} /></Field>
      <Field label="Adım"><input type="number" value={value.steps} onChange={(e) => onChange({ ...value, steps: Number(e.target.value) })} /></Field>
      <Field label="Su (L)"><input type="number" step="0.1" value={value.water} onChange={(e) => onChange({ ...value, water: Number(e.target.value) })} /></Field>
      <Field label="Beslenme Uyumu %"><input type="number" value={value.nutrition} onChange={(e) => onChange({ ...value, nutrition: Number(e.target.value) })} /></Field>
    </div>
    <label className="checkbox"><input type="checkbox" checked={value.pain} onChange={(e) => onChange({ ...value, pain: e.target.checked })} /> Ağrı / sakatlık belirtisi var</label>
    <button className="primary" type="submit">Check-in kaydet</button>
  </form>;
}

function WorkoutEditor({ activeDate, setActiveDate, workout, workoutSplitDraft, setWorkoutSplitDraft, applyTemplate, updateWorkoutMeta, updateExerciseName, updateSet, addExercise, removeExercise, addSet, removeSet, deleteWorkout, newExerciseName, setNewExerciseName, ensureWorkout }: any) {
  return <div className="panel">
    <div className="panel-head stacked-mobile">
      <div>
        <p className="eyebrow">ANTRENMAN</p>
        <h3>Antrenman editörü</h3>
      </div>
      <div className="toolbar-group">
        <input type="date" value={activeDate} onChange={(event) => setActiveDate(event.target.value)} />
        <select className="select-input" value={workout?.split || workoutSplitDraft} onChange={(event) => { setWorkoutSplitDraft(event.target.value); updateWorkoutMeta("split", event.target.value); }}>
          <option>Push</option>
          <option>Pull</option>
          <option>Legs</option>
        </select>
      </div>
    </div>

    <div className="template-row">
      {workout?.source === "ai" ? (
        <span className="status-pill">AI tarafından onaylanan program</span>
      ) : (
        <>
          <button className="ghost-button" onClick={() => applyTemplate("Push")}>Push Şablonu</button>
          <button className="ghost-button" onClick={() => applyTemplate("Pull")}>Pull Şablonu</button>
          <button className="ghost-button" onClick={() => applyTemplate("Legs")}>Legs Şablonu</button>
        </>
      )}
      <button className="ghost-button danger" onClick={deleteWorkout}>Günün antrenmanını sil</button>
    </div>

    {!workout && <div className="empty-state"><p>Bu tarih için kayıtlı antrenman yok.</p><button className="primary" onClick={() => ensureWorkout()}>Bu güne antrenman oluştur</button></div>}

    {workout && <>
      <div className="form-grid compact-form">
        <Field label="Antrenman Başlığı"><input value={workout.name} onChange={(e) => updateWorkoutMeta("name", e.target.value)} /></Field>
        <Field label="Split"><input value={workout.split} onChange={(e) => updateWorkoutMeta("split", e.target.value)} /></Field>
      </div>
      <div className="exercise-list">
        {workout.exercises.map((exercise: Exercise) => <div className="exercise" key={exercise.id}>
          <div className="exercise-title">
            <div className="exercise-name-line">
              <input value={exercise.name} onChange={(e) => updateExerciseName(exercise.id, e.target.value)} />
              <small>Hedef RIR 1–2</small>
            </div>
            <div className="exercise-actions">
              <button className="ghost-button" onClick={() => addSet(exercise.id)}>Set Ekle</button>
              <button className="ghost-button danger" onClick={() => removeExercise(exercise.id)}>Hareketi Sil</button>
            </div>
          </div>
          <div className="set-header"><span>SET</span><span>KİLO</span><span>TEKRAR</span><span>RIR</span><span></span></div>
          {exercise.sets.map((set, index) => <div className="set-row" key={`${exercise.id}-${index}`}>
            <b>{index + 1}</b>
            <input type="number" value={set.weight} onChange={(e) => updateSet(exercise.id, index, "weight", Number(e.target.value))} />
            <input type="number" value={set.reps} onChange={(e) => updateSet(exercise.id, index, "reps", Number(e.target.value))} />
            <input type="number" min="0" max="5" value={set.rir} onChange={(e) => updateSet(exercise.id, index, "rir", Number(e.target.value))} />
            <button className="mini-remove" onClick={() => removeSet(exercise.id, index)}>Sil</button>
          </div>)}
        </div>)}
      </div>

      <div className="add-row">
        <input placeholder="Yeni hareket adı" value={newExerciseName} onChange={(e) => setNewExerciseName(e.target.value)} />
        <button className="primary" onClick={addExercise}>Hareket Ekle</button>
      </div>
      <div className="workout-note"><strong>ATLAS önerisi:</strong> Üst tekrar sınırına teknik bozulmadan ulaşıp hedef RIR’ı korursan bir sonraki seansta küçük yük artışı yap.</div>
    </>}
  </div>;
}

function SuggestedWorkoutPanel({ workout, onApprove, onReject }: { workout: WorkoutRecord | null; onApprove: () => void; onReject: () => void }) {
  if (!workout) return <section className="panel"><p className="eyebrow">AI PROGRAM ÖNERİSİ</p><h3>Henüz öneri yok</h3><div className="empty-state"><p>ATLAS AI Sohbet bölümünde “bana program oluştur ve öneri antrenmanına ekle” diyerek bir program hazırlatabilirsin.</p></div></section>;
  return <section className="panel suggested-workout-panel">
    <div className="panel-head"><div><p className="eyebrow">AI PROGRAM ÖNERİSİ</p><h3>{workout.name}</h3><small>{workout.split} • {formatDate(workout.date)}</small></div><span className="status-pill">Onay bekliyor</span></div>
    <div className="exercise-list">{workout.exercises.map((exercise) => <div className="exercise" key={exercise.id}><div className="exercise-title"><strong>{exercise.name}</strong></div><div className="set-header"><span>SET</span><span>KİLO</span><span>TEKRAR</span><span>RIR</span></div>{exercise.sets.map((set, index) => <div className="set-row proposal-row" key={index}><b>{index + 1}</b><span>{set.weight || "Kişiye göre"}</span><span>{set.reps}</span><span>{set.rir}</span></div>)}</div>)}</div>
    <div className="proposal-warning">Onay verdiğinde sistem önce mevcut antrenmanların silinip silinmeyeceğini sorar. Silmeyi onaylamadan hiçbir kayıt değişmez.</div>
    <div className="action-confirm-buttons"><button className="primary" onClick={onApprove}>Antrenmanı Onayla</button><button className="ghost-button danger" onClick={onReject}>Öneriyi Sil</button></div>
  </section>;
}

function NutritionEditor({ activeDate, setActiveDate, entries, totals, form, setForm, addFoodEntry, removeFoodEntry, lookupLoading }: any) {
  return <div className="nutrition-layout">
    <section className="panel">
      <div className="panel-head stacked-mobile">
        <div><p className="eyebrow">BESLENME KAYDI</p><h3>Makro takip</h3></div>
        <input type="date" value={activeDate} onChange={(event) => setActiveDate(event.target.value)} />
      </div>
      <form onSubmit={addFoodEntry} className="nutrition-form">
        <div className="toggle-row">
          <button type="button" className={form.source === "preset" ? "toggle-chip active" : "toggle-chip"} onClick={() => setForm({ ...form, source: "preset" })}>Hazır besin</button>
          <button type="button" className={form.source === "custom" ? "toggle-chip active" : "toggle-chip"} onClick={() => setForm({ ...form, source: "custom" })}>Özel besin</button>
        </div>
        {form.source === "preset" ? <div className="form-grid compact-form">
          <Field label="Besin">
            <select className="select-input" value={form.preset} onChange={(e) => setForm({ ...form, preset: e.target.value, amountMode: "grams", quantity: 1 })}>
              {foodPresets.map((item) => <option key={item.name}>{item.name}</option>)}
            </select>
          </Field>
          {(() => {
            const selectedPreset = foodPresets.find((item) => item.name === form.preset);
            if (selectedPreset?.unitLabel && selectedPreset?.gramsPerUnit) {
              return <div className="unit-food-control">
                <div className="toggle-row amount-toggle">
                  <button type="button" className={form.amountMode === "grams" ? "toggle-chip active" : "toggle-chip"} onClick={() => setForm({ ...form, amountMode: "grams" })}>Gram</button>
                  <button type="button" className={form.amountMode === "quantity" ? "toggle-chip active" : "toggle-chip"} onClick={() => setForm({ ...form, amountMode: "quantity" })}>Adet</button>
                </div>
                {form.amountMode === "quantity"
                  ? <Field label={`Adet (1 ${selectedPreset.unitLabel} ≈ ${selectedPreset.gramsPerUnit} g)`}><input type="number" min="1" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
                  : <Field label="Gram"><input type="number" value={form.grams} onChange={(e) => setForm({ ...form, grams: Number(e.target.value) })} /></Field>}
              </div>;
            }
            return <Field label="Gram"><input type="number" value={form.grams} onChange={(e) => setForm({ ...form, grams: Number(e.target.value) })} /></Field>;
          })()}
        </div> : <div className="form-grid compact-form">
          <Field label="Besin Adı"><input placeholder="Ör. ev yapımı mercimek çorbası" value={form.customName} onChange={(e) => setForm({ ...form, customName: e.target.value })} /></Field>
          <Field label="Gram"><input type="number" value={form.grams} onChange={(e) => setForm({ ...form, grams: Number(e.target.value) })} /></Field>
          <div className="ai-food-note">ATLAS AI besinin 100 gram değerlerini web üzerinden araştırır ve girdiğin gramaja göre kalori ile makroları hesaplar. Sonuç yaklaşık olabilir; paketli üründe etiket değeri daha doğrudur.</div>
        </div>}
        <button className="primary" type="submit" disabled={lookupLoading}>{lookupLoading ? "AI internette araştırıyor..." : "Besin Ekle"}</button>
      </form>

      <div className="entry-list">
        {entries.length === 0 && <div className="empty-state small"><p>Bu gün için henüz besin eklenmedi.</p></div>}
        {entries.map((entry: FoodEntry) => <div key={entry.id} className="entry-row">
          <div>
            <strong>{entry.name}</strong>
            <small>{entry.quantity && entry.unitLabel ? `${entry.quantity} ${entry.unitLabel} (≈ ${entry.grams} g)` : `${entry.grams} g`} • {entry.calories.toFixed(0)} kcal</small>
          </div>
          <div className="entry-macros">
            <span>P {entry.protein.toFixed(1)}</span>
            <span>K {entry.carbs.toFixed(1)}</span>
            <span>Y {entry.fat.toFixed(1)}</span>
            <button className="mini-remove" onClick={() => removeFoodEntry(entry.id)}>Sil</button>
          </div>
        </div>)}
      </div>
    </section>

    <section className="panel nutrition-summary">
      <p className="eyebrow">GÜNLÜK MAKROLAR</p>
      <h3>Kalori dağılımı</h3>
      <div className="macro-ring" style={{ background: buildMacroGradient(totals) }} />
      <div className="macro-legend">
        <div><i className="swatch protein" /> Protein</div>
        <div><i className="swatch carb" /> Karbonhidrat</div>
        <div><i className="swatch fat" /> Yağ</div>
      </div>
      <div className="metric-grid single-column">
        <Metric label="Toplam Kalori" value={`${totals.calories.toFixed(0)} kcal`} sub="Günlük tüketim" />
        <Metric label="Protein" value={`${totals.protein.toFixed(1)} g`} sub="4 kcal / g" />
        <Metric label="Karbonhidrat" value={`${totals.carbs.toFixed(1)} g`} sub="4 kcal / g" />
        <Metric label="Yağ" value={`${totals.fat.toFixed(1)} g`} sub="9 kcal / g" />
      </div>
    </section>
  </div>;
}

function ProfilePanel({ profile, setProfile, onSubmit, onPhoto }: { profile: UserProfile; setProfile: (profile: UserProfile) => void; onSubmit: (event: FormEvent) => void; onPhoto: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <form className="panel profile-panel-page" onSubmit={onSubmit}>
    <div className="panel-head"><div><p className="eyebrow">KULLANICI PROFİLİ</p><h3>Kişisel bilgiler</h3></div><span className="status-pill">AI profili kullanır</span></div>
    <div className="profile-editor-layout">
      <div className="profile-photo-editor">
        <div className="profile-photo-large">{profile.photo ? <img src={profile.photo} alt="Profil fotoğrafı" /> : initials(profile.fullName || profile.email)}</div>
        <label className="upload-button">Profil Fotoğrafı Seç<input type="file" accept="image/*" onChange={onPhoto} hidden /></label>
      </div>
      <div className="form-grid profile-fields">
        <Field label="Ad Soyad"><input value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></Field>
        <Field label="Yaş"><input type="number" min="0" value={profile.age || ""} onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })} /></Field>
        <Field label="Boy (cm)"><input type="number" min="0" value={profile.height || ""} onChange={(e) => setProfile({ ...profile, height: Number(e.target.value) })} /></Field>
        <Field label="Kilo (kg)"><input type="number" step="0.1" min="0" value={profile.weight || ""} onChange={(e) => setProfile({ ...profile, weight: Number(e.target.value) })} /></Field>
        <Field label="Yaşadığı Yer"><input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} /></Field>
        <Field label="E-posta"><input type="email" value={profile.email} disabled /></Field>
      </div>
    </div>
    <div className="profile-note">Profil bilgileri ATLAS AI’ın kalori, antrenman ve genel önerilerini kişiselleştirmesi için kullanılır. E-posta hesabına bağlı olduğu için buradan değiştirilemez.</div>
    <button className="primary" type="submit">Profili Kaydet</button>
  </form>;
}

function HistoryView({ dates, selectedDate, setSelectedDate, checkin, workout, nutritionEntries, nutritionTotals, photos }: any) {
  return <div className="history-layout">
    <section className="panel history-sidebar">
      <p className="eyebrow">TÜM GÜNLER</p>
      <h3>Kayıt geçmişi</h3>
      <div className="history-date-list">
        {dates.map((date: string) => <button key={date} className={selectedDate === date ? "history-date active" : "history-date"} onClick={() => setSelectedDate(date)}>{formatDate(date)}</button>)}
      </div>
    </section>
    <section className="panel history-detail">
      <div className="panel-head"><div><p className="eyebrow">GÜN DETAYI</p><h3>{formatDate(selectedDate)}</h3></div><span className="status-pill">Check-in • Workout • Nutrition • Photos</span></div>
      <div className="history-block-grid">
        <div className="history-block">
          <h4>Check-in</h4>
          {checkin ? <ul>
            <li>Kilo: {checkin.weight} kg</li>
            <li>Bel: {checkin.waist} cm</li>
            <li>Uyku: {checkin.sleep} saat</li>
            <li>Enerji: {checkin.energy}/10</li>
            <li>Su: {checkin.water} L</li>
          </ul> : <p>Check-in kaydı yok.</p>}
        </div>
        <div className="history-block">
          <h4>Antrenman</h4>
          {workout ? <>
            <p><strong>{workout.name}</strong></p>
            <p>{workout.split} • {workout.exercises.length} hareket</p>
            {workout.exercises.map((exercise: Exercise) => <div key={exercise.id} className="history-inline-list"><strong>{exercise.name}</strong><span>{exercise.sets.map((set) => `${set.weight} kg x ${set.reps}`).join(" • ")}</span></div>)}
          </> : <p>Antrenman kaydı yok.</p>}
        </div>
        <div className="history-block">
          <h4>Beslenme</h4>
          {nutritionEntries.length > 0 ? <>
            <p>{nutritionTotals.calories.toFixed(0)} kcal • P {nutritionTotals.protein.toFixed(1)} • K {nutritionTotals.carbs.toFixed(1)} • Y {nutritionTotals.fat.toFixed(1)}</p>
            {nutritionEntries.map((entry: FoodEntry) => <div key={entry.id} className="history-inline-list"><strong>{entry.name}</strong><span>{entry.grams} g</span></div>)}
          </> : <p>Beslenme kaydı yok.</p>}
        </div>
        <div className="history-block">
          <h4>Fotoğraflar</h4>
          {photos.length > 0 ? <div className="photo-grid small-grid">{photos.map((photo: PhotoEntry) => <img key={photo.id} src={photo.src} alt={photo.note || "İlerleme fotoğrafı"} />)}</div> : <p>Fotoğraf kaydı yok.</p>}
        </div>
      </div>
    </section>
  </div>;
}

function SupplementPanel({ activeDate, setActiveDate, entries, form, setForm, addSupplement, toggleSupplement, removeSupplement }: any) {
  const completed = entries.filter((item: SupplementEntry) => item.taken).length;
  return <div className="supplement-layout">
    <section className="panel">
      <div className="panel-head stacked-mobile">
        <div><p className="eyebrow">SUPPLEMENT TAKİBİ</p><h3>Günlük kullanım planı</h3></div>
        <input type="date" value={activeDate} onChange={(event) => setActiveDate(event.target.value)} />
      </div>
      <form className="supplement-form" onSubmit={addSupplement}>
        <div className="form-grid compact-form">
          <Field label="Supplement"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Kreatin, Omega-3..." /></Field>
          <Field label="Doz"><input value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="5 g / 2 kapsül" /></Field>
          <Field label="Kullanım zamanı"><input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="Kahvaltı sonrası" /></Field>
          <Field label="Not"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opsiyonel" /></Field>
        </div>
        <button className="primary" type="submit">Supplement Ekle</button>
      </form>
    </section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">BUGÜN</p><h3>{completed}/{entries.length} tamamlandı</h3></div><span className="status-pill">Takip aktif</span></div>
      <div className="supplement-list">
        {entries.length === 0 && <div className="empty-state"><p>Bu gün için supplement kaydı yok.</p></div>}
        {entries.map((item: SupplementEntry) => <div key={item.id} className={item.taken ? "supplement-row taken" : "supplement-row"}>
          <button className="supplement-check" onClick={() => toggleSupplement(item.id)}>{item.taken ? "✓" : ""}</button>
          <div className="supplement-copy"><strong>{item.name}</strong><span>{item.dose} • {item.time}</span>{item.notes && <small>{item.notes}</small>}</div>
          <button className="mini-remove" onClick={() => removeSupplement(item.id)}>Sil</button>
        </div>)}
      </div>
    </section>
  </div>;
}

function PhotosPanel({ activeDate, setActiveDate, photos, photoNote, setPhotoNote, onUpload, onRemove }: any) {
  return <div className="panel">
    <div className="panel-head stacked-mobile">
      <div><p className="eyebrow">GÜNLÜK FOTOĞRAF</p><h3>İlerleme galerisi</h3></div>
      <input type="date" value={activeDate} onChange={(event) => setActiveDate(event.target.value)} />
    </div>
    <div className="photo-upload-bar">
      <input value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="Fotoğraf notu (opsiyonel)" />
      <label className="upload-button">Fotoğraf Seç<input type="file" accept="image/*" onChange={onUpload} hidden /></label>
    </div>
    {photos.length === 0 ? <div className="empty-state"><p>Bu gün için fotoğraf eklenmedi.</p></div> : <div className="photo-grid">{photos.map((photo: PhotoEntry) => <figure key={photo.id} className="photo-card"><img src={photo.src} alt={photo.note || "Günlük fotoğraf"} /><figcaption><span>{photo.note || formatDate(photo.date)}</span><button className="mini-remove" onClick={() => onRemove(photo.id)}>Sil</button></figcaption></figure>)}</div>}
  </div>;
}

function CoachPanel({ message, messages, onAnalyze, loading, chatInput, setChatInput, sendChatMessage, suggestions, pendingAction, confirmPendingAction, rejectPendingAction }: any) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading]);

  return <div className="coach-layout">
    <section className="coach-panel">
      <div className="coach-orb">A</div>
      <p className="eyebrow">ATLAS AI SOHBET</p>
      <h2>Veri konuşsun, ego değil.</h2>
      <div className="coach-message">{message}</div>
      <button className="primary" onClick={onAnalyze} disabled={loading}>{loading ? "Veriler analiz ediliyor..." : "Genel analizi yenile"}</button>
    </section>

    <section className="panel chat-shell">
      <div className="chat-messages">
        {messages.map((item: ChatMessage) => <div key={item.id} className={item.role === "assistant" ? "chat-bubble assistant" : "chat-bubble user"}><span>{item.content}</span></div>)}
        {loading && <div className="chat-bubble assistant"><span>ATLAS düşünüyor...</span></div>}
        {pendingAction && <div className="chat-bubble assistant action-confirm-card">
          <strong>Değişiklik onayı</strong>
          <span>{pendingAction.label}</span>
          <div className="action-confirm-buttons">
            <button className="primary" onClick={confirmPendingAction}>Onayla ve Uygula</button>
            <button className="ghost-button danger" onClick={rejectPendingAction}>Reddet</button>
          </div>
        </div>}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>
      <div className="chat-suggestion-row">{suggestions.map((item: string) => <button key={item} className="toggle-chip" onClick={() => sendChatMessage(item)}>{item}</button>)}</div>
      <div className="chat-input-row">
        <input placeholder="ATLAS'a soru sor..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !loading) sendChatMessage(); }} />
        <button className="primary" onClick={() => sendChatMessage()} disabled={loading}>{loading ? "..." : "Gönder"}</button>
      </div>
    </section>
  </div>;
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) { return <div className="metric-card"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>; }
function Target({ label, value, progress }: { label: string; value: string; progress: number }) { return <div className="target"><div><span>{label}</span><strong>{value}</strong></div><div className="progress"><i style={{ width: `${progress}%` }} /></div></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }

function DragonBackdrop() {
  return <div className="dragon-layer" aria-hidden="true">
    <span className="dragon dragon-a">🐉</span>
    <span className="dragon dragon-b">🐉</span>
    <span className="dragon dragon-c">🐉</span>
  </div>;
}

function syncText(status: "local" | "loading" | "synced" | "saving" | "error") {
  return ({ local: "Yerel mod", loading: "Bulut yükleniyor", synced: "Bulut senkron", saving: "Kaydediliyor", error: "Senkron hatası" } as const)[status];
}

function firstName(value: string) { return value.trim().split(/\s+/)[0] || ""; }
function initials(value: string) { const parts = value.trim().split(/\s+/).filter(Boolean); return parts.length ? parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") : "A"; }

function buildSuggestions(latest: Checkin, totals: NutritionTotals, workout: WorkoutRecord | null, photoCount: number) {
  if (latest.weight <= 0) {
    return [
      "İlk check-in kaydını girerek başlangıç ölçümlerini oluştur.",
      "Bugünün beslenme kayıtlarını ekleyerek makro takibini başlat.",
      "Push, Pull veya Legs şablonlarından birini seçerek ilk antrenmanını oluştur.",
      "Aynı ışık ve açıyla başlangıç fotoğrafı eklemek ilerlemeyi görmeyi kolaylaştırır.",
    ];
  }
  const suggestions = [
    latest.sleep < 7 ? "Uyku 7 saatin altında. Bugün toparlanmayı önemse." : "Uyku hedefe yakın. Performansı koruyabilirsin.",
    totals.protein < 180 ? "Protein bugün düşük görünüyor; tavuk, et, yumurta veya lor ekle." : "Protein iyi seviyede; kas korunumu için yeterli ilerliyorsun.",
    workout ? `${workout.split} antrenmanında toplam ${workout.exercises.length} hareket var. Ana hareketlerde progresif yüklenmeyi takip et.` : "Bu tarih için henüz antrenman açmadın. Bir PPL şablonu yükle.",
  ];
  suggestions.push(photoCount === 0 ? "Bugün için ilerleme fotoğrafı yok; bir ön, yan veya ayna fotoğrafı ekle." : `${photoCount} adet günlük fotoğraf eklendi. Görsel takibi sürdür.`);
  return suggestions;
}

type NutritionTotals = { calories: number; protein: number; carbs: number; fat: number };

function calculateNutritionTotals(entries: FoodEntry[]): NutritionTotals {
  return entries.reduce((acc, item) => ({
    calories: acc.calories + item.calories,
    protein: acc.protein + item.protein,
    carbs: acc.carbs + item.carbs,
    fat: acc.fat + item.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function buildMacroGradient(totals: NutritionTotals) {
  const proteinCals = totals.protein * 4;
  const carbsCals = totals.carbs * 4;
  const fatCals = totals.fat * 9;
  const total = proteinCals + carbsCals + fatCals || 1;
  const proteinDeg = (proteinCals / total) * 360;
  const carbsDeg = (carbsCals / total) * 360;
  return `conic-gradient(var(--accent) 0deg ${proteinDeg}deg, var(--red) ${proteinDeg}deg ${proteinDeg + carbsDeg}deg, #f5f5f5 ${proteinDeg + carbsDeg}deg 360deg)`;
}

function avg(values: number[]) { return values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1); }

const exerciseLibrary = [
  { name: "Incline Chest Press", muscles: "Üst göğüs, ön omuz, triceps", cue: "Kürek kemiklerini sabitle, kontrollü indir.", alternative: "Incline dumbbell press" },
  { name: "Lat Pulldown", muscles: "Lat, üst sırt, biceps", cue: "Dirsekleri aşağı-cebe çek, gövdeyi savurma.", alternative: "Assisted pull-up" },
  { name: "Romanian Deadlift", muscles: "Hamstring, kalça, erektör", cue: "Kalçayı geriye gönder, sırtı nötr tut.", alternative: "Dumbbell RDL" },
  { name: "Leg Press", muscles: "Quadriceps, kalça", cue: "Dizi kilitleme, beli pedden ayırma.", alternative: "Hack squat" },
  { name: "Shoulder Press", muscles: "Omuz, triceps", cue: "Kaburgayı kontrol et, baş üstünde kilitle.", alternative: "Machine shoulder press" },
  { name: "Lateral Raise", muscles: "Orta omuz", cue: "Dirsekle kaldır, trapeze kaçırma.", alternative: "Cable lateral raise" },
  { name: "Chest Supported Row", muscles: "Orta sırt, arka omuz, biceps", cue: "Göğsü pedde tut, dirseği geriye sür.", alternative: "Seated cable row" },
  { name: "Hip Thrust", muscles: "Kalça, hamstring", cue: "Üstte beli değil kalçayı sık.", alternative: "Glute bridge" },
];

function OnboardingModal({ advanced, setAdvanced, profile, setProfile }: any) {
  const [step, setStep] = useState(1);
  const finish = () => {
    const weight = Number(profile.weight || 80);
    const height = Number(profile.height || 175);
    const age = Number(profile.age || 25);
    const base = 10 * weight + 6.25 * height - 5 * age + 5;
    const activity = advanced.activityLevel === "Yüksek" ? 1.65 : advanced.activityLevel === "Düşük" ? 1.35 : 1.5;
    const maintenance = Math.round(base * activity);
    const calories = advanced.goal === "Yağ kaybı" ? maintenance - 450 : advanced.goal === "Kas kazanımı" ? maintenance + 250 : maintenance;
    setAdvanced((prev: AdvancedState) => ({ ...prev, onboardingComplete: true, calorieTarget: Math.max(1400, calories), proteinTarget: Math.round(weight * 1.8), waterTarget: Math.max(2.5, round1(weight * .035)), cardioMinutes: advanced.goal === "Yağ kaybı" ? 30 : 20 }));
  };
  return <div className="onboarding-overlay"><div className="onboarding-card panel">
    <p className="eyebrow">ATLAS BAŞLANGIÇ ANALİZİ • {step}/3</p>
    <h2>{step === 1 ? "Seni tanıyalım" : step === 2 ? "Antrenman koşulların" : "İlk hedeflerini oluşturalım"}</h2>
    {step === 1 && <div className="form-grid compact-form">
      <Field label="Ad Soyad"><input value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></Field>
      <Field label="Yaş"><input type="number" value={profile.age || ""} onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })} /></Field>
      <Field label="Boy (cm)"><input type="number" value={profile.height || ""} onChange={(e) => setProfile({ ...profile, height: Number(e.target.value) })} /></Field>
      <Field label="Kilo (kg)"><input type="number" value={profile.weight || ""} onChange={(e) => setProfile({ ...profile, weight: Number(e.target.value) })} /></Field>
      <Field label="Hedef"><select value={advanced.goal} onChange={(e) => setAdvanced({ ...advanced, goal: e.target.value })}><option>Yağ kaybı</option><option>Kas kazanımı</option><option>Form koruma</option><option>Performans</option></select></Field>
      <Field label="Günlük Aktivite"><select value={advanced.activityLevel} onChange={(e) => setAdvanced({ ...advanced, activityLevel: e.target.value })}><option>Düşük</option><option>Orta</option><option>Yüksek</option></select></Field>
    </div>}
    {step === 2 && <div className="form-grid compact-form">
      <Field label="Haftada Kaç Gün?"><input type="number" min="2" max="7" value={advanced.trainingDays} onChange={(e) => setAdvanced({ ...advanced, trainingDays: Number(e.target.value) })} /></Field>
      <Field label="Seviye"><select value={advanced.experience} onChange={(e) => setAdvanced({ ...advanced, experience: e.target.value })}><option>Başlangıç</option><option>Orta</option><option>İleri</option><option>Spora dönüş</option></select></Field>
      <Field label="Ekipman"><input value={advanced.equipment} onChange={(e) => setAdvanced({ ...advanced, equipment: e.target.value })} /></Field>
      <Field label="Ağrı / Sakatlık"><input value={advanced.injuries} onChange={(e) => setAdvanced({ ...advanced, injuries: e.target.value })} placeholder="Yoksa boş bırak" /></Field>
    </div>}
    {step === 3 && <div className="onboarding-summary">
      <div><span>Hedef</span><strong>{advanced.goal}</strong></div><div><span>Haftalık antrenman</span><strong>{advanced.trainingDays} gün</strong></div><div><span>Seviye</span><strong>{advanced.experience}</strong></div>
      <p>ATLAS, profil bilgilerine göre ilk kalori, protein, su ve kardiyo hedeflerini oluşturacak. Bu değerler daha sonra Gelişim Merkezi'nden değiştirilebilir.</p>
    </div>}
    <div className="onboarding-actions">{step > 1 && <button className="ghost-button" onClick={() => setStep(step - 1)}>Geri</button>}<button className="primary" onClick={() => step < 3 ? setStep(step + 1) : finish()}>{step < 3 ? "Devam" : "ATLAS'ı Başlat"}</button></div>
  </div></div>;
}

function AdvancedCenter({ advanced, setAdvanced, profile, setProfile, checkins, workouts, photos, nutritionEntries, setTab }: any) {
  const [section, setSection] = useState("report");
  const [librarySearch, setLibrarySearch] = useState("");
  const [photoA, setPhotoA] = useState(photos[0]?.id || "");
  const [photoB, setPhotoB] = useState(photos.at(-1)?.id || "");
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const recentCheckins = checkins.filter((c: Checkin) => new Date(c.date) >= weekStart);
  const recentWorkouts = workouts.filter((w: WorkoutRecord) => new Date(w.date) >= weekStart);
  const recentFood = nutritionEntries.filter((f: FoodEntry) => new Date(f.date) >= weekStart);
  const weeklyCalories = recentFood.reduce((sum: number, f: FoodEntry) => sum + f.calories, 0) / Math.max(new Set(recentFood.map((f: FoodEntry) => f.date)).size, 1);
  const weeklyProtein = recentFood.reduce((sum: number, f: FoodEntry) => sum + f.protein, 0) / Math.max(new Set(recentFood.map((f: FoodEntry) => f.date)).size, 1);
  const weightChange = recentCheckins.length > 1 ? recentCheckins.at(-1).weight - recentCheckins[0].weight : 0;
  const waistChange = recentCheckins.length > 1 ? recentCheckins.at(-1).waist - recentCheckins[0].waist : 0;
  const allSets = workouts.flatMap((w: WorkoutRecord) => w.exercises.flatMap((e: Exercise) => e.sets.map((set) => ({ exercise: e.name, ...set, date: w.date }))));
  const records = Object.values(allSets.reduce((acc: any, item: any) => { const score = item.weight * (1 + item.reps / 30); if (!acc[item.exercise] || score > acc[item.exercise].score) acc[item.exercise] = { ...item, score }; return acc; }, {})).sort((a: any,b: any)=>b.score-a.score).slice(0,10) as any[];
  const progression = buildProgressionSuggestions(workouts);
  const a = photos.find((p: PhotoEntry) => p.id === photoA); const b = photos.find((p: PhotoEntry) => p.id === photoB);
  const addChange = (title: string, reason: string, oldValue: string, newValue: string) => setAdvanced((prev: AdvancedState) => ({ ...prev, pendingChanges: [...prev.pendingChanges, { id: createId(), title, reason, oldValue, newValue, status: "pending" }] }));
  const decideChange = (id: string, status: "approved"|"rejected") => setAdvanced((prev: AdvancedState) => {
    const change = prev.pendingChanges.find(c => c.id === id);
    let next = { ...prev, pendingChanges: prev.pendingChanges.map(c => c.id === id ? { ...c, status } : c) };
    if (status === "approved" && change?.title.toLowerCase().includes("kalori")) {
      const value = Number(change.newValue.replace(/[^0-9]/g, ""));
      if (value) next.calorieTarget = value;
    }
    return next;
  });
  const tabs = [["report","Haftalık Rapor"],["progress","Progresyon"],["changes","Değişiklik Merkezi"],["library","Hareket Kütüphanesi"],["tasks","Görevler"],["compare","Fotoğraf Karşılaştırma"],["records","Kişisel Rekorlar"]];
  return <div className="advanced-center">
    <div className="advanced-nav">{tabs.map(([id,label])=><button key={id} className={section===id?"toggle-chip active":"toggle-chip"} onClick={()=>setSection(id)}>{label}</button>)}</div>
    {section === "report" && <div className="panel"><p className="eyebrow">SON 7 GÜN</p><h3>Haftalık ATLAS raporu</h3><div className="metric-grid"><Metric label="Kilo Değişimi" value={`${weightChange.toFixed(1)} kg`} sub={`${recentCheckins.length} check-in`} /><Metric label="Bel Değişimi" value={`${waistChange.toFixed(1)} cm`} sub="Haftalık ölçüm" /><Metric label="Antrenman" value={`${recentWorkouts.length}`} sub={`Hedef ${advanced.trainingDays}`} /><Metric label="Ort. Kalori" value={`${weeklyCalories.toFixed(0)} kcal`} sub={`Hedef ${advanced.calorieTarget}`} /></div><div className="two-column"><div className="history-block"><h4>Beslenme</h4><p>Ortalama protein: <strong>{weeklyProtein.toFixed(0)} g</strong></p><p>Kalori hedef farkı: <strong>{(weeklyCalories-advanced.calorieTarget).toFixed(0)} kcal</strong></p></div><div className="history-block"><h4>Haftanın kararı</h4><p>{weightChange < -1.2 ? "Kayıp hızlı; toparlanma ve performansı izle." : weightChange > -.1 && recentCheckins.length >= 4 ? "Trend durağan; uyum yüksekse küçük kalori ayarı değerlendir." : "İlerleme kontrollü. Mevcut planı koru."}</p><button className="ghost-button" onClick={()=>addChange("Kalori hedefini gözden geçir","Haftalık trend analizi",`${advanced.calorieTarget} kcal`,`${Math.max(1400,advanced.calorieTarget-150)} kcal`)}>Değişiklik önerisi oluştur</button></div></div></div>}
    {section === "progress" && <div className="panel"><p className="eyebrow">PROGRESSIVE OVERLOAD</p><h3>Bir sonraki seans önerileri</h3><div className="suggestion-list">{progression.length ? progression.map((x:any)=><div className="suggestion-item" key={x.name}><strong>{x.name}</strong><p>{x.text}</p></div>) : <div className="empty-state"><p>Öneri oluşturmak için aynı hareketi en az iki antrenmanda kaydet.</p></div>}</div></div>}
    {section === "changes" && <div className="panel"><p className="eyebrow">ONAY GEREKTİREN İŞLEMLER</p><h3>AI Değişiklik Merkezi</h3><div className="suggestion-list">{advanced.pendingChanges.length ? advanced.pendingChanges.map((c:any)=><div className="change-card" key={c.id}><div><strong>{c.title}</strong><p>{c.reason}</p><small>{c.oldValue} → {c.newValue}</small></div><div>{c.status === "pending" ? <><button className="primary" onClick={()=>decideChange(c.id,"approved")}>Onayla</button><button className="ghost-button danger" onClick={()=>decideChange(c.id,"rejected")}>Reddet</button></> : <span className="status-pill">{c.status === "approved" ? "Onaylandı" : "Reddedildi"}</span>}</div></div>) : <div className="empty-state"><p>Bekleyen değişiklik yok.</p></div>}</div></div>}
    {section === "library" && <div className="panel"><p className="eyebrow">HAREKET KÜTÜPHANESİ</p><h3>Teknik ve alternatifler</h3><input placeholder="Hareket ara" value={librarySearch} onChange={(e)=>setLibrarySearch(e.target.value)} /><div className="library-grid">{exerciseLibrary.filter(x=>x.name.toLowerCase().includes(librarySearch.toLowerCase())).map(x=><div className="history-block" key={x.name}><h4>{x.name}</h4><p><b>Kaslar:</b> {x.muscles}</p><p><b>Teknik:</b> {x.cue}</p><p><b>Alternatif:</b> {x.alternative}</p></div>)}</div></div>}
    {section === "tasks" && <div className="panel"><p className="eyebrow">BİLDİRİM & GÖREVLER</p><h3>Günlük takip planı</h3><div className="entry-list">{advanced.tasks.map((t:any)=><div className="entry-row" key={t.id}><div><strong>{t.title}</strong><small>{t.time}</small></div><div className="task-actions"><input type="time" value={t.time} onChange={(e)=>setAdvanced((prev:AdvancedState)=>({...prev,tasks:prev.tasks.map(x=>x.id===t.id?{...x,time:e.target.value}:x)}))}/><button className={t.done?"toggle-chip active":"toggle-chip"} onClick={()=>setAdvanced((prev:AdvancedState)=>({...prev,tasks:prev.tasks.map(x=>x.id===t.id?{...x,done:!x.done}:x)}))}>{t.done?"Tamamlandı":"Tamamla"}</button><label><input type="checkbox" checked={t.enabled} onChange={(e)=>setAdvanced((prev:AdvancedState)=>({...prev,tasks:prev.tasks.map(x=>x.id===t.id?{...x,enabled:e.target.checked}:x)}))}/> Aktif</label></div></div>)}</div><p className="help-text">Bu sürüm uygulama içi görevleri yönetir. Tarayıcı push bildirimleri site yayınlandıktan ve izin alındıktan sonra etkinleştirilebilir.</p></div>}
    {section === "compare" && <div className="panel"><p className="eyebrow">GÖRSEL İLERLEME</p><h3>Fotoğrafları karşılaştır</h3><div className="two-column"><Field label="Önce"><select value={photoA} onChange={(e)=>setPhotoA(e.target.value)}><option value="">Seç</option>{photos.map((p:PhotoEntry)=><option key={p.id} value={p.id}>{formatDate(p.date)} - {p.note}</option>)}</select></Field><Field label="Sonra"><select value={photoB} onChange={(e)=>setPhotoB(e.target.value)}><option value="">Seç</option>{photos.map((p:PhotoEntry)=><option key={p.id} value={p.id}>{formatDate(p.date)} - {p.note}</option>)}</select></Field></div><div className="photo-compare">{a?<figure><img src={a.src}/><figcaption>{formatDate(a.date)}</figcaption></figure>:<div className="empty-state">İlk fotoğrafı seç</div>}{b?<figure><img src={b.src}/><figcaption>{formatDate(b.date)}</figcaption></figure>:<div className="empty-state">İkinci fotoğrafı seç</div>}</div></div>}
    {section === "records" && <div className="panel"><p className="eyebrow">KİŞİSEL REKORLAR</p><h3>En güçlü performanslar</h3><div className="record-grid">{records.length?records.map((r:any,i:number)=><div className="metric-card" key={r.exercise}><span>#{i+1} {r.exercise}</span><strong>{r.weight} kg × {r.reps}</strong><small>Tahmini 1RM {r.score.toFixed(1)} kg • {formatDate(r.date)}</small></div>):<div className="empty-state"><p>Rekorlar için antrenman setlerini kaydet.</p></div>}</div></div>}
  </div>;
}

function buildProgressionSuggestions(workouts: WorkoutRecord[]) {
  const byExercise: Record<string, Array<{ date:string; sets:WorkoutSet[] }>> = {};
  workouts.forEach(w=>w.exercises.forEach(e=>{ (byExercise[e.name] ||= []).push({date:w.date,sets:e.sets}); }));
  return Object.entries(byExercise).flatMap(([name, sessions])=>{
    if(sessions.length<2) return [];
    const sorted=sessions.sort((a,b)=>a.date.localeCompare(b.date)); const last=sorted.at(-1)!; const prev=sorted.at(-2)!;
    const lastVol=last.sets.reduce((s,x)=>s+x.weight*x.reps,0); const prevVol=prev.sets.reduce((s,x)=>s+x.weight*x.reps,0);
    const avgRir=avg(last.sets.map(x=>x.rir));
    let text = lastVol>prevVol && avgRir>=1 ? `Hacim %${(((lastVol-prevVol)/Math.max(prevVol,1))*100).toFixed(0)} arttı. Teknik temizse sonraki seansta küçük yük artışı veya set başına +1 tekrar dene.` : lastVol<prevVol*.9 ? "Performans düştü. Yük artırma; uyku, yorgunluk ve teknik kalitesini kontrol et." : "Performans stabil. Aynı yükle toplam tekrar sayısını artırmayı hedefle.";
    return [{name,text}];
  }).slice(0,12);
}

function tabTitle(tab: Tab) { return ({ dashboard: "Kontrol Merkezi", checkin: "Günlük Check-in", workout: "Antrenman", suggested: "Öneri Antrenmanı", nutrition: "Beslenme & Makro Takibi", supplements: "Supplement Takibi", advanced: "Gelişim Merkezi", history: "Günlük Geçmiş", photos: "Fotoğraf Takibi", profile: "Kullanıcı Profili", coach: "ATLAS AI Sohbet" } as Record<Tab, string>)[tab]; }
function createId() { return Math.random().toString(36).slice(2, 10); }
function makeSets(count: number, weight: number, reps: number, rir: number) { return Array.from({ length: count }, () => ({ weight, reps, rir })); }
function cloneExercises(exercises: Exercise[]) { return exercises.map((exercise) => ({ ...exercise, id: createId(), sets: exercise.sets.map((set) => ({ ...set })) })); }
function makeCheckin(date: string, previous?: Checkin) {
  return {
    date,
    weight: previous?.weight ?? 0,
    waist: previous?.waist ?? 0,
    sleep: previous?.sleep ?? 0,
    sleepQuality: previous?.sleepQuality ?? 0,
    energy: previous?.energy ?? 0,
    soreness: previous?.soreness ?? 0,
    stress: previous?.stress ?? 0,
    steps: previous?.steps ?? 0,
    water: previous?.water ?? 0,
    nutrition: previous?.nutrition ?? 0,
    pain: previous?.pain ?? false,
  };
}
function splitLabel(split: string) {
  if (split === "Push") return "Göğüs • Omuz • Triceps";
  if (split === "Pull") return "Sırt • Biceps";
  if (split === "Legs") return "Quadriceps • Hamstring • Calf";
  return split;
}
function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}
function round1(value: number) { return Math.round(value * 10) / 10; }
function buildFoodEntry(date: string, presetName: string, grams: number): FoodEntry {
  const preset = foodPresets.find((item) => item.name === presetName) || foodPresets[0];
  const factor = grams / 100;
  return {
    id: createId(),
    date,
    source: "preset",
    name: preset.name,
    grams,
    calories: round1(preset.calories * factor),
    protein: round1(preset.protein * factor),
    carbs: round1(preset.carbs * factor),
    fat: round1(preset.fat * factor),
  };
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function compactWorkout(workout: WorkoutRecord) {
  return {
    date: workout.date,
    split: workout.split,
    name: workout.name,
    source: workout.source || "manual",
    exercises: workout.exercises.slice(0, 15).map((exercise) => ({
      name: exercise.name,
      sets: exercise.sets.slice(0, 8).map((set) => ({
        weight: set.weight,
        reps: set.reps,
        rir: set.rir,
      })),
    })),
  };
}

function compactSupplement(item: SupplementEntry) {
  return {
    date: item.date,
    name: item.name,
    dose: item.dose,
    time: item.time,
    taken: item.taken,
    notes: item.notes.slice(0, 300),
  };
}

function buildLocalAnalysis(latest: Checkin, workout: WorkoutRecord | null, totals: NutritionTotals, photoCount: number) {
  const lines = [];
  if (latest.weight <= 0) return "Henüz analiz edilecek check-in verisi yok. İlk kaydını oluşturduktan sonra değerlendirme yapabilirim.";
  lines.push(`Durum: Son kayıt ${latest.weight.toFixed(1)} kg, bel ${latest.waist.toFixed(1)} cm, uyku ${latest.sleep} saat.`);
  if (totals.protein < 180) lines.push("Karar: Protein alımın hedefin altında; bugünü daha yüksek proteinle kapat.");
  else lines.push("Karar: Protein iyi gidiyor; mevcut makro düzenini koru.");
  if (!workout) lines.push("Antrenman: Bu tarih için kayıtlı workout yok; bir Push, Pull veya Legs şablonu aç.");
  else lines.push(`Antrenman: ${workout.split} günü kayıtlı ve ${workout.exercises.length} hareket içeriyor.`);
  lines.push(photoCount === 0 ? "Tek odak: Günlük ilerleme fotoğrafı ekle ve veriyi bütünleştir." : "Tek odak: Veriyi istikrarlı toplayıp haftalık trendi izle.");
  return lines.join("\n\n");
}

function buildLocalChatResponse(text: string, latest: Checkin, totals: NutritionTotals, workout: WorkoutRecord | null, photoCount: number) {
  const lower = text.toLowerCase();
  if (latest.weight <= 0 && !lower.includes("kalori") && !lower.includes("makro") && !lower.includes("antrenman") && !lower.includes("foto")) {
    return "Henüz kayıtlı check-in verin yok. Soruna genel olarak cevap verebilirim; kişisel analiz için ilk kaydını oluşturman gerekir.";
  }
  if (lower.includes("kalori") || lower.includes("makro")) {
    return `Bugün yaklaşık ${totals.calories.toFixed(0)} kcal aldın. Protein ${totals.protein.toFixed(1)} g, karbonhidrat ${totals.carbs.toFixed(1)} g, yağ ${totals.fat.toFixed(1)} g. Protein hedefe yaklaşmıyorsa son öğüne ek kaynak koy.`;
  }
  if (lower.includes("antrenman") || lower.includes("workout")) {
    return workout ? `Aktif gün için ${workout.split} antrenmanın kayıtlı. Toplam ${workout.exercises.length} hareket var. Ana hareketlerde tekrar hedefini tamamladıysan sonraki seansta küçük yük artışı düşün.` : "Bu gün için henüz antrenman kaydı yok. Push, Pull veya Legs şablonu yükleyebilirsin.";
  }
  if (lower.includes("foto")) {
    return photoCount > 0 ? `Bu gün için ${photoCount} fotoğrafın var. Haftalık karşılaştırma için aynı ışıkta ve aynı açıyla çekmeye devam et.` : "Henüz fotoğraf yok. Ön, yan veya ayna fotoğrafı ekleyerek görsel takibi başlat.";
  }
  return `Son check-in verin ${latest.weight.toFixed(1)} kg ve uyku ${latest.sleep} saat görünüyor. Kısa cevap: plana sadık kal, veriyi eksiksiz topla ve günlük kararları tek güne değil trende göre ver.`;
}
