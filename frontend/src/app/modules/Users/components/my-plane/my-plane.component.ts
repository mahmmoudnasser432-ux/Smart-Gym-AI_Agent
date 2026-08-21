import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PlanService } from '../../services/plan.service';
import { InBodyService } from '../../services/in-body.service';

// ─── Structured Types ────────────────────────────────────────────────────────

export interface DayPlan {
  dayLabel: string;
  exercises: { name: string; sets: number; reps: number }[];
}

export interface MealOption {
  label: string;       // "Option A" / "Option B"
  food_name: string;
  ingredients: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealCategory {
  name: string;        // "Breakfast", "Lunch" …
  icon: string;
  options: MealOption[];
  activeOption: number; // which tab is selected
}

export interface WorkoutDay {
  day: string;         // "Day 1"
  focus: string;       // "Push"
  exercises: { name: string; sets: number; reps: number }[];
}

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-my-plane',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-plane.component.html',
  styleUrl: './my-plane.component.scss'
})
export class MyPlaneComponent implements OnInit {

  @Input() compact = false;
  @Input() planInput: any = null;
  @Input() currentDayIndex = 0;
  @Output() currentDayIndexChange = new EventEmitter<number>();

  // ── raw storage ──────────────────────────────────────────────────────────
  rawApiResponse: any = null;

  // ── state ────────────────────────────────────────────────────────────────
  loading = false;
  downloadingPdf = false;

  // ── parsed plan fields ───────────────────────────────────────────────────
  aiGoal = '';
  dailyTarget: { calories: any; protein: any; carbs: any; fat: any } = { calories: '--', protein: '--', carbs: '--', fat: '--' };
  mealCategories: MealCategory[] = [];
  workoutDays: WorkoutDay[] = [];
  coachNotes: string[] = [];
  isDailyTargetCalculated = false;

  // ── compact mode (used in dashboard widget) ──────────────────────────────
  workoutPlan: DayPlan[] = [];   // kept for compact @Input binding

  // ── progress data (moved from in-body) ──────────────────────────────────
  progressData: any = null;
  allProgressCards: any[] = [];
  chronoAge = 25;

  constructor(
    private router: Router, 
    private planService: PlanService,
    private inBodyService: InBodyService
  ) { }

  get hasPlan(): boolean {
    return localStorage.getItem('hasPlan') === 'true';
  }

  // ── lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadProgressData();

    if (this.planInput && Object.keys(this.planInput).length > 0) {
      this.normalizePlan(this.planInput);
      return;
    }

    const statePlan = history.state?.plan;
    if (statePlan && Object.keys(statePlan).length > 1) {
      this.normalizePlan(statePlan);
      localStorage.setItem('userPlan', JSON.stringify(statePlan));
      return;
    }

    const saved = localStorage.getItem('userPlan');
    if (saved) {
      try {
        const raw = JSON.parse(saved);
        this.normalizePlan(raw);
        if (this.mealCategories.length > 0 || this.workoutDays.length > 0) return;
      } catch (e) {
        localStorage.removeItem('userPlan');
        localStorage.removeItem('hasPlan');
      }
    }

    // fallback: fetch from API
    this.loading = true;
    this.planService.getMyPlan().subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res) {
          this.normalizePlan(res);
          localStorage.setItem('userPlan', JSON.stringify(res));
        }
      },
      error: (err: any) => {
        this.loading = false;
        console.error('Failed to load plan from server:', err);
      }
    });
  }

  // ── normalization ────────────────────────────────────────────────────────

  normalizePlan(rawPlan: any): void {
    if (!rawPlan) return;
    this.isDailyTargetCalculated = false;
    this.rawApiResponse = rawPlan;

    // ── Deep log so we can see what the backend actually sends ──────────────
    console.log('🔍 [my-plan] Raw API response FULL:', JSON.stringify(rawPlan, null, 2));

    // ── 1. Unwrap envelope ──────────────────────────────────────────────────
    let container = rawPlan;
    if (Array.isArray(container)) container = container[0] || {};

    // Unwrap { data: {...} } envelope
    if (container?.data && typeof container.data === 'object' && !Array.isArray(container.data)) {
      container = container.data;
    }

    console.log('🔍 [my-plan] Container (after envelope unwrap):', JSON.stringify(container, null, 2));

    // ── 2. AI Goal ──────────────────────────────────────────────────────────
    this.aiGoal =
      rawPlan?.ai_goal ??
      rawPlan?.goal ??
      container?.ai_goal ??
      container?.goal ??
      container?.aiGoal ??
      container?.plan_data?.goal ??
      '';

    console.log('🎯 [my-plan] AI Goal:', this.aiGoal);

    // Try to extract chronological age
    const rawAge = rawPlan?.age ?? container?.age ?? rawPlan?.plan_data?.age ?? null;
    if (rawAge) {
      this.chronoAge = Number(rawAge);
    } else {
      const savedUser = localStorage.getItem('userData') || localStorage.getItem('user');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          if (user?.age) this.chronoAge = Number(user.age);
        } catch(e) {}
      }
    }

    // ── 3. Try parsed_plan — search everywhere ──────────────────────────────
    const pp =
      rawPlan?.parsed_plan ??
      rawPlan?.parsedPlan ??
      container?.parsed_plan ??
      container?.parsedPlan ??
      null;

    console.log('📦 [my-plan] parsed_plan found?', !!pp, pp ? Object.keys(pp) : 'N/A');

    if (pp) {
      this.extractFromParsedPlan(pp, container, rawPlan);
      return;
    }

    // ── 4. Fallback to plan_data / legacy formats ───────────────────────────
    const planDataObj = this.resolvePlanData(container);
    console.log('📦 [my-plan] planDataObj keys:', planDataObj ? Object.keys(planDataObj) : 'null');
    this.extractFromLegacyPlan(planDataObj, container);
  }

  // ── parsed_plan extractor (new backend format) ──────────────────────────

  private extractFromParsedPlan(pp: any, container: any, rawPlan?: any) {
    console.log('✅ [my-plan] extractFromParsedPlan. Keys:', Object.keys(pp));

    // Daily target — try many field variants
    const dt =
      pp.daily_target ??
      pp.dailyTarget ??
      pp.target ??
      pp.targets ??
      pp.macros ??
      {};
    console.log('🎯 [my-plan] daily_target raw:', dt);

    this.dailyTarget = {
      calories: dt.calories ?? dt.kcal ?? dt.cal ?? container?.calories ?? rawPlan?.calories ?? '--',
      protein: dt.protein ?? dt.prot ?? container?.protein ?? rawPlan?.protein ?? '--',
      carbs: dt.carbs ?? dt.carb ?? container?.carbs ?? rawPlan?.carbs ?? '--',
      fat: dt.fat ?? dt.fats ?? container?.fat ?? rawPlan?.fat ?? '--',
    };
    console.log('📊 [my-plan] dailyTarget:', this.dailyTarget);

    // Meals
    const rawMeals: any[] =
      pp.meals ??
      pp.meal_plan ??
      pp.mealPlan ??
      pp.nutrition ??
      pp.diet ??
      [];
    console.log('🍽️ [my-plan] rawMeals count:', rawMeals.length, rawMeals[0] ? 'First meal keys: ' + Object.keys(rawMeals[0]) : '');

    this.mealCategories = rawMeals.map((m: any) => ({
      name: m.name ?? m.meal_name ?? m.category ?? m.meal ?? m.title ?? m.type ?? 'Meal',
      icon: m.icon ?? this.mealIcon(m.name ?? m.meal ?? ''),
      activeOption: 0,
      options: this.extractOptions(m)
    }));

    // Workout days
    const rawWorkout: any[] =
      pp.workout_plan ??
      pp.workoutPlan ??
      pp.workout_days ??
      pp.workoutDays ??
      pp.workouts ??
      pp.training_plan ??
      pp.training ??
      pp.days ??
      [];
    console.log('💪 [my-plan] rawWorkout count:', rawWorkout.length, rawWorkout[0] ? 'First day keys: ' + Object.keys(rawWorkout[0]) : '');

    this.workoutDays = rawWorkout.map((d: any, i: number) => ({
      day: d.day ?? d.day_number ?? d.day_label ?? d.dayLabel ?? d.week_day ?? `Day ${i + 1}`,
      focus: d.focus ?? d.focus_area ?? d.type ?? d.muscle_group ?? d.name ?? d.category ?? '',
      exercises: this.extractExercises(d)
    }));

    // Coach notes
    const cn = pp.coach_notes ?? pp.coachNotes ?? pp.notes ?? pp.tips ?? pp.advice ?? [];
    this.coachNotes = Array.isArray(cn)
      ? cn.map((n: any) => typeof n === 'string' ? n : n?.note ?? n?.text ?? n?.tip ?? '').filter((s: string) => s.trim())
      : (typeof cn === 'string' && cn ? cn.split('\n').filter((l: string) => l.trim()) : []);

    // compact compat
    this.workoutPlan = this.workoutDays.map(d => ({
      dayLabel: d.focus ? `${d.day} — ${d.focus}` : d.day,
      exercises: d.exercises
    }));

    console.log('✅ Meals:', this.mealCategories.length, '| Workout days:', this.workoutDays.length, '| Notes:', this.coachNotes.length);
    this.recalculateDailyTargetIfNeeded();
  }

  // ── legacy plan extractor ──────────────────────────────────────────────

  private extractFromLegacyPlan(planDataObj: any, container: any) {
    const dt = planDataObj?.dailyTarget ?? planDataObj?.daily_target ?? planDataObj?.target ?? {};
    this.dailyTarget = {
      calories: dt.calories ?? planDataObj?.calories ?? planDataObj?.total_calories ?? '--',
      protein: dt.protein ?? planDataObj?.protein ?? '--',
      carbs: dt.carbs ?? planDataObj?.carbs ?? '--',
      fat: dt.fat ?? planDataObj?.fat ?? '--',
    };

    if (!this.aiGoal) {
      this.aiGoal = planDataObj?.goal ?? planDataObj?.goalText ?? planDataObj?.bodyType ?? '';
    }

    const rawMeals: any[] = planDataObj?.meals ?? planDataObj?.mealPlan ?? planDataObj?.meal_plan ?? [];
    this.mealCategories = Array.isArray(rawMeals) ? rawMeals.map((m: any, i: number) => {
      const items: any[] = m.items ?? m.meals ?? m.foods ?? (Array.isArray(m) ? m : []);
      const options: MealOption[] = items.map((item: any, j: number) => ({
        label: `Option ${String.fromCharCode(65 + j)}`,
        food_name: item.name ?? item.food ?? item.title ?? 'Meal',
        ingredients: item.ingredients ?? item.description ?? item.details ?? '',
        calories: +(item.calories ?? item.kcal ?? 0),
        protein: +(item.protein ?? item.prot ?? 0),
        carbs: +(item.carbs ?? item.carb ?? 0),
        fat: +(item.fat ?? 0),
      }));
      return {
        name: m.day ?? m.name ?? m.dayLabel ?? m.title ?? `Meal ${i + 1}`,
        icon: this.mealIcon(m.day ?? m.name ?? ''),
        activeOption: 0,
        options: options.length ? options : [{ label: 'Option A', food_name: m.name ?? 'Meal', ingredients: '', calories: 0, protein: 0, carbs: 0, fat: 0 }]
      };
    }) : [];

    // Workout days
    const rawWorkout: any[] = planDataObj?.workout_days ?? planDataObj?.workoutDays ?? planDataObj?.workouts ?? [];
    this.workoutDays = Array.isArray(rawWorkout) ? rawWorkout.map((d: any, i: number) => ({
      day: d.title ?? d.day ?? `Day ${i + 1}`,
      focus: d.focus ?? d.type ?? d.description ?? '',
      exercises: this.extractExercises(d)
    })) : [];

    // Coach notes from plan_text
    const txt: string = planDataObj?.plan_text ?? planDataObj?.coachNotes ?? container?.plan_text ?? '';
    this.coachNotes = txt ? txt.split('\n').filter((l: string) => l.trim()).slice(0, 10) : [];

    // compact compat
    this.workoutPlan = this.workoutDays.map(d => ({
      dayLabel: d.focus ? `${d.day} — ${d.focus}` : d.day,
      exercises: d.exercises
    }));

    console.log('✅ Legacy plan extracted. Meals:', this.mealCategories.length, 'Workout:', this.workoutDays.length);
    this.recalculateDailyTargetIfNeeded();
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  selectMealOption(meal: MealCategory, index: number) {
    meal.activeOption = index;
    // Force calculation to update based on user option choices
    this.isDailyTargetCalculated = true;
    this.recalculateDailyTargetIfNeeded();
  }

  recalculateDailyTargetIfNeeded(): void {
    const dt = this.dailyTarget;
    // Check if target fields are not fully populated or are placeholder values
    const hasCal = dt.calories && dt.calories !== '--' && dt.calories !== 0;
    const hasProt = dt.protein && dt.protein !== '--' && dt.protein !== 0;
    const hasCarb = dt.carbs && dt.carbs !== '--' && dt.carbs !== 0;
    const hasFat = dt.fat && dt.fat !== '--' && dt.fat !== 0;

    if (hasCal && hasProt && hasCarb && hasFat && !this.isDailyTargetCalculated) {
      // Keep backend values if they exist and we haven't switched to calculating
      return;
    }

    // Sum up from active option of each meal category
    let calSum = 0;
    let protSum = 0;
    let carbSum = 0;
    let fatSum = 0;

    for (const meal of this.mealCategories) {
      const activeOpt = meal.options[meal.activeOption] || meal.options[0];
      if (activeOpt) {
        calSum += Number(activeOpt.calories) || 0;
        protSum += Number(activeOpt.protein) || 0;
        carbSum += Number(activeOpt.carbs) || 0;
        fatSum += Number(activeOpt.fat) || 0;
      }
    }

    if (calSum > 0) {
      this.dailyTarget = {
        calories: Math.round(calSum),
        protein: Math.round(protSum),
        carbs: Math.round(carbSum),
        fat: Math.round(fatSum)
      };
      this.isDailyTargetCalculated = true;
    }
  }

  private resolvePlanData(container: any): any {
    let obj = container.plan_data ?? container.planData ?? container.plan ?? container;
    if (obj?.data && typeof obj.data === 'object') obj = obj.data;
    if (obj?.plan_data && typeof obj.plan_data === 'object') obj = obj.plan_data;
    if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch { } }
    return obj ?? container;
  }

  private extractOptions(m: any): MealOption[] {
    // options could be m.options[] or m.items[]
    const raw: any[] = m.options ?? m.items ?? m.meals ?? m.foods ?? [];
    if (!raw.length) return [{ label: 'Option A', food_name: m.food_name ?? m.name ?? 'Meal', ingredients: m.ingredients ?? '', calories: +(m.calories ?? 0), protein: +(m.protein ?? 0), carbs: +(m.carbs ?? 0), fat: +(m.fat ?? 0) }];
    return raw.map((opt: any, i: number) => ({
      label: opt.label ?? `Option ${String.fromCharCode(65 + i)}`,
      food_name: opt.food_name ?? opt.name ?? opt.food ?? opt.title ?? 'Option',
      ingredients: opt.ingredients ?? opt.description ?? opt.details ?? '',
      calories: +(opt.calories ?? opt.kcal ?? 0),
      protein: +(opt.protein ?? opt.prot ?? 0),
      carbs: +(opt.carbs ?? opt.carb ?? 0),
      fat: +(opt.fat ?? 0),
    }));
  }

  private extractExercises(d: any): { name: string; sets: number; reps: number }[] {
    // Try many field names for the exercises array
    const raw: any[] =
      d.exercises ??
      d.exercises_list ??
      d.exercisesList ??
      d.exercisesData ??
      d.exercise_list ??
      d.workouts ??
      d.movements ??
      d.items ??
      d.drills ??
      [];

    if (raw.length === 0) {
      console.warn('⚠️ extractExercises: no exercises found. Day keys:', Object.keys(d));
    }

    return raw.map((ex: any) => {
      // If ex is just a string
      if (typeof ex === 'string') {
        return { name: ex, sets: 0, reps: 0 };
      }
      return {
        name: ex.name ?? ex.exercise ?? ex.exercise_name ??
          ex.exerciseName ?? ex.title ?? ex.movement ??
          ex.description ?? ex.drill ?? '',
        sets: +(ex.sets ?? ex.set ?? ex.num_sets ?? ex.numSets ?? 0),
        reps: +(ex.reps ?? ex.rep ?? ex.repetitions ?? ex.num_reps ?? ex.numReps ?? 0),
      };
    }).filter(ex => ex.name && ex.name.trim());
  }

  private mealIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('breakfast')) return '☀️';
    if (n.includes('lunch')) return '🍱';
    if (n.includes('dinner')) return '🌙';
    if (n.includes('snack')) return '🍎';
    if (n.includes('pre')) return '⚡';
    if (n.includes('post')) return '💪';
    return '🍽️';
  }

  // ── compact mode helpers ─────────────────────────────────────────────────

  get totalDays() { return this.workoutPlan.length; }
  get currentDayExercises() { return this.workoutPlan[this.currentDayIndex]?.exercises || []; }
  get currentDayLabel() { return this.workoutPlan[this.currentDayIndex]?.dayLabel || ''; }

  nextDay() { if (this.currentDayIndex < this.totalDays - 1) { this.currentDayIndex++; this.currentDayIndexChange.emit(this.currentDayIndex); } }
  prevDay() { if (this.currentDayIndex > 0) { this.currentDayIndex--; this.currentDayIndexChange.emit(this.currentDayIndex); } }

  // ── actions ──────────────────────────────────────────────────────────────

  savePlan() {
    const raw = this.rawApiResponse || JSON.parse(localStorage.getItem('userPlan') || 'null');
    if (!raw) { localStorage.setItem('hasPlan', 'true'); this.router.navigate(['/user/dashboard']); return; }

    const scanId = raw?.data?.scanId ?? raw?.scanId ?? raw?.data?.scan_id ?? null;
    this.loading = true;
    this.planService.savePlan({ scanId, aiResponse: raw }).subscribe({
      next: (res: any) => {
        this.loading = false;
        const planId = res?.data?.plan_id ?? res?.plan_id ?? res?.data?.planId ?? res?.planId;
        if (planId) localStorage.setItem('savedPlanId', planId);
        localStorage.setItem('hasPlan', 'true');
        alert('✅ Plan saved successfully!');
        // Intentionally not navigating to let the user download the PDF if they want
      },
      error: () => { 
        this.loading = false; 
        localStorage.setItem('hasPlan', 'true');
        alert('✅ Plan saved locally for testing! (The "My plan" option will now appear in the navbar)'); 
      }
    });
  }

  downloadPdf() {
    const raw = this.rawApiResponse || JSON.parse(localStorage.getItem('userPlan') || 'null');
    const planId = localStorage.getItem('savedPlanId') ??
      raw?.data?.plan_id ?? raw?.plan_id ?? raw?.data?.planId ?? raw?.planId;

    if (!planId) { alert('Please save the plan first (click "Save This Plan").'); return; }

    this.downloadingPdf = true;
    this.planService.downloadPlanPdf(planId).subscribe({
      next: (blob) => {
        this.downloadingPdf = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smart-gym-plan-${planId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: () => { this.downloadingPdf = false; alert('Failed to download PDF.'); }
    });
  }

  // ── progress section helpers (moved from in-body) ──────────────────────────
  getUserId(): number | string | null {
    const userDataStr = localStorage.getItem('userData') || localStorage.getItem('user');
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        return userData?.id || userData?.user_id || userData?._id || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  loadProgressData() {
    const userId = this.getUserId();
    if (!userId) return;

    this.inBodyService.getProgress().subscribe({
      next: (progress: any) => {
        if (progress?.data || progress?.metrics) {
          const p = progress?.data ?? progress;
          this.progressData = {
            comparingTo: p?.previous_scan_date ?? p?.comparing_to ?? null,
            metrics: p?.metrics ?? []
          };
          this.buildProgressCards();
        }
      },
      error: (err) => {
        console.error('Failed to load progress data in my-plan:', err);
      }
    });
  }

  buildProgressCards() {
    if (!this.progressData?.metrics?.length) return;

    const metrics = this.progressData.metrics.map((m: any) => ({
      label: m.label ?? m.metric ?? m.name ?? '',
      current: m.current ?? m.current_value ?? null,
      unit: m.unit ?? '',
      diff: m.diff ?? m.change ?? null,
      status: String(m.status ?? m.trend ?? 'no_change').toLowerCase().trim()
    })).filter((m: any) => m.label);

    const regularMetrics = metrics.filter((m: any) => m.label.toLowerCase() !== 'biological age');
    const bioAge = metrics.find((m: any) => m.label.toLowerCase() === 'biological age');

    this.allProgressCards = regularMetrics;
    if (bioAge) {
      this.progressData.biologicalAge = bioAge;
    }
  }

  getStatusColor(status: string): string {
    if (status === 'improved') return '#22c55e'; // green
    if (status === 'worsened') return '#ef4444'; // red
    return '#a0a0a0'; // grey for no change
  }

  getStatusIcon(status: string): string {
    if (status === 'improved') return '✅';
    if (status === 'worsened') return '⚠️';
    return '';
  }

  getDiffPrefix(diff: number | null): string {
    if (diff === null || diff === 0) return '';
    return diff > 0 ? '+' : '';
  }

  getBioAgeMessage(bioAge: number | null, chronoAge: number): string {
    if (bioAge === null) return '';
    const diff = bioAge - chronoAge;
    if (diff < -2) return 'Biological age is younger than chronological age';
    if (diff > 2) return 'Biological age is older than chronological age';
    return 'Biological age is close to chronological age';
  }

  getBioAgeMessageColor(bioAge: number | null, chronoAge: number): string {
    if (bioAge === null) return '#a0a0a0';
    const diff = bioAge - chronoAge;
    if (diff < -2) return '#22c55e';
    if (diff > 2) return '#ef4444';
    return '#eab308';
  }
}