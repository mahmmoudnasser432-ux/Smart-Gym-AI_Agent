import { Component, OnInit } from '@angular/core';
import { InBodyService } from '../../services/in-body.service';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlanService } from '../../services/plan.service';
import { finalize } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-in-body',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './in-body.component.html',
  styleUrls: ['./in-body.component.scss']
})
export class InBodyComponent implements OnInit {

  inBodyData: any = null;
  progressData: any = null;
  loading = false;
  loadingText = 'Loading InBody Data...';
  savingHistory = false;
  savedToHistory = false;

  // Flat lists of cards — no carousel
  allScanCards: any[] = [];
  allProgressCards: any[] = [];

  editableData = {
    age: 25,
    gender: 'male',
    activityLevel: 'moderate',
    trainingDays: 3,
    allergies: '',
    chronicDiseases: '',
    budgetLevel: 'moderate'
  };

  // Scan metric cards — 4 per slide
  scanCards: any[][] = [];
  progressCards: any[][] = [];

  // Scans history
  scansHistory: any[] = [];
  selectedScanId: any = null;

  constructor(
    private inBodyService: InBodyService,
    private router: Router,
    private planService: PlanService
  ) { }

  ngOnInit(): void {
    this.loadAllData();
  }

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

  loadAllData() {
    this.loading = true;
    this.loadingText = 'Loading InBody Data...';
    const userId = this.getUserId();

    const handleScansList = (scansList: any[]) => {
      this.scansHistory = Array.isArray(scansList) ? scansList : [];

      if (this.scansHistory.length > 0) {
        // Sort scansHistory by scanDate descending
        this.scansHistory.sort((a: any, b: any) => {
          const getMs = (s: any) => {
            const raw = s.scan_date || s.created_at || s.createdAt || s.date || s.scanDate || s.timestamp || 0;
            return new Date(raw).getTime() || 0;
          };
          return getMs(b) - getMs(a);
        });

        const latestScan = this.scansHistory[0];
        this.selectedScanId = latestScan?.scanId ?? latestScan?.scan_id ?? latestScan?.id ?? latestScan?._id ?? null;
        this.parseScanData(latestScan);
      } else {
        this.inBodyData = null;
        this.allScanCards = [];
      }
    };

    if (!userId) {
      console.warn('No user ID found.');
      handleScansList([]);
      this.loading = false;
      return;
    }

    forkJoin({
      scans: this.inBodyService.getInBodyScans(userId),
      progress: this.inBodyService.getProgress()
    }).pipe(finalize(() => this.loading = false))
      .subscribe({
        next: ({ scans, progress }: any) => {
          const scansList = scans?.data || scans || [];
          handleScansList(scansList);

          // Build progress cards if data available
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
          console.error('Failed to load data.', err);
          handleScansList([]);
        }
      });
  }

  fallbackLoad() {
    this.loading = true;
    forkJoin({
      scan: this.inBodyService.getInBody(),
      progress: this.inBodyService.getProgress()
    }).pipe(finalize(() => this.loading = false))
      .subscribe({
        next: ({ scan, progress }: any) => {
          // Try multiple levels of data nesting
          const data = scan?.data?.scan ?? scan?.data ?? scan?.scan ?? scan;
          console.log('Fallback InBody scan data:', data);
          this.parseScanData(data);

          // Force date extraction if still null
          if (this.inBodyData && !this.inBodyData.scanDate) {
            const forced = this.extractDateFromObject(scan?.data ?? scan);
            if (forced) {
              this.inBodyData = { ...this.inBodyData, scanDate: forced };
            }
          }

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
          console.error('Fallback load failed too', err);
        }
      });
  }

  /**
   * Auto-detects the scan date from ANY field in the response.
   * First tries all known field names, then auto-scans all keys for date-like values.
   */
  extractDateFromObject(data: any): string | null {
    if (!data) return null;

    // 1) Try all known field names first
    const knownNames = [
      'scan_date', 'scanDate', 'created_at', 'createdAt',
      'scanned_at', 'scannedAt', 'date', 'timestamp',
      'scan_time', 'scanTime', 'recorded_at', 'recordedAt',
      'time', 'datetime', 'dateTime', 'updatedAt', 'updated_at'
    ];
    for (const key of knownNames) {
      if (data[key] != null && data[key] !== '') {
        return String(data[key]);
      }
    }

    // 2) Auto-scan ALL keys — look for any string/number value that parses as a valid date
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (typeof val === 'string' && val.length >= 8 && !/^[0-9]+$/.test(val)) {
        const normalizedVal = val.includes(' ') && !val.includes('T') ? val.replace(' ', 'T') : val;
        const d = new Date(normalizedVal);
        if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
          console.log(`📅 Auto-detected date in key "${key}":`, val);
          return val;
        }
      }
      if (typeof val === 'number' && val > 1_000_000_000) {
        // Unix timestamp in seconds or ms
        const d = new Date(val > 1e12 ? val : val * 1000);
        if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
          console.log(`📅 Auto-detected unix timestamp in key "${key}":`, val);
          return d.toISOString();
        }
      }
    }

    console.warn('📅 Could not find any date field. All keys in data:', Object.keys(data));
    return null;
  }

  parseScanData(data: any) {
    if (!data) return;

    const rawDate = this.extractDateFromObject(data);
    let formattedDate: string | null = null;
    if (rawDate) {
      let normalized = rawDate;
      if (rawDate.includes(' ') && !rawDate.includes('T')) {
        normalized = rawDate.replace(' ', 'T');
      }
      const d = new Date(normalized);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } else {
        formattedDate = rawDate;
      }
    }

    this.inBodyData = {
      height: data?.height_cm ?? data?.height ?? null,
      bodyFatPercentage: data?.body_fat_percentage ?? data?.bodyFatPercentage ?? data?.fat_percentage ?? data?.fat_percent ?? null,
      muscleMass: data?.muscle_mass ?? data?.muscleMass ?? null,
      fatMass: data?.body_fat_mass ?? data?.fat_mass ?? data?.fatMass ?? null,
      bmr: data?.bmr ?? data?.basal_metabolic_rate ?? null,
      smm: data?.smm ?? data?.skeletal_muscle_mass ?? null,
      visceralFatLevel: data?.visceral_fat ?? data?.visceral_fat_level ?? data?.visceralFat ?? null,
      totalBodyWater: data?.total_body_water ?? data?.body_water ?? data?.totalBodyWater ?? null,
      weight: data?.weight ?? data?.weight_kg ?? null,
      waist: data?.waist ?? data?.waist_cm ?? data?.waist_circumference ?? null,
      biologicalAge: data?.biological_age ?? data?.biologicalAge ?? null,
      aiGoal: data?.ai_goal ?? data?.goal ?? data?.aiGoal ?? data?.predicted_goal ?? data?.fitness_goal ?? null,
      scanDate: formattedDate,
      scanId: data?.scanId ?? data?.scan_id ?? data?.id ?? data?._id ?? null
    };

    console.log('📦 Full scan data from backend:', JSON.stringify(data));
    this.buildScanCards();
  }

  onScanChange() {
    if (this.selectedScanId) {
      const selected = this.scansHistory.find(s => (s.scanId ?? s.scan_id ?? s.id) == this.selectedScanId);
      if (selected) {
        this.parseScanData(selected);
        // Load detailed scan if there are missing fields
        const userId = this.getUserId();
        if (userId) {
          this.inBodyService.getInBodyScan(userId, this.selectedScanId)
            .subscribe({
              next: (res: any) => {
                const data = res?.data || res?.scan || res;
                if (data) {
                  this.parseScanData(data);
                }
              },
              error: (err) => console.error('Error fetching specific scan details:', err)
            });
        }
      }
    }
  }

  buildScanCards() {
    if (!this.inBodyData) return;
    const d = this.inBodyData;

    this.allScanCards = [
      { label: 'WEIGHT', value: d.weight, unit: 'kg' },
      { label: 'HEIGHT', value: d.height, unit: 'cm' },
      { label: 'BMR', value: d.bmr, unit: 'kcal' },
      { label: 'WAIST', value: d.waist, unit: 'cm' },
      { label: 'BODY FAT %', value: d.bodyFatPercentage, unit: '%' },
      { label: 'FAT MASS', value: d.fatMass, unit: 'kg' },
      { label: 'MUSCLE MASS', value: d.muscleMass, unit: 'kg' },
      { label: 'SMM', value: d.smm, unit: 'kg' },
      { label: 'VISCERAL FAT', value: d.visceralFatLevel, unit: 'lvl' },
      { label: 'BODY WATER', value: d.totalBodyWater, unit: 'L' },
      { label: 'BIOLOGICAL AGE', value: d.biologicalAge, unit: 'yrs' }
      // AI Goal is displayed separately below the grid
    ].filter(c => c.value !== null && c.value !== undefined);
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

  increment(field: keyof typeof this.editableData, min: number, max: number) {
    if ((this.editableData[field] as number) < max)
      (this.editableData[field] as number)++;
  }

  decrement(field: keyof typeof this.editableData, min: number, max: number) {
    if ((this.editableData[field] as number) > min)
      (this.editableData[field] as number)--;
  }

  saveScanToHistory() {
    console.log('saveScanToHistory called. scanId:', this.inBodyData?.scanId);
    if (!this.inBodyData?.scanId) {
      alert('Error: Scan ID is missing. Cannot save this scan.');
      return;
    }
    if (this.savingHistory) return;
    this.savingHistory = true;
    this.inBodyService.saveScanToHistory(this.inBodyData.scanId)
      .pipe(finalize(() => this.savingHistory = false))
      .subscribe({
        next: (res: any) => {
          console.log('saveScanToHistory response:', res);
          if (res === null) {
            alert('Failed to save scan to history. The server returned an error.');
            return;
          }
          this.savedToHistory = true;
          setTimeout(() => this.savedToHistory = false, 3000);
        },
        error: (err) => {
          console.error('Error saving scan to history:', err);
          alert('Error saving scan to history. Please try again.');
        }
      });
  }

  generatePlan() {
    if (!this.editableData.age ||
      !this.editableData.gender ||
      !this.editableData.activityLevel ||
      !this.editableData.trainingDays) {
      alert('Please fill all required fields');
      return;
    }

    const payload: any = {
      scanId: this.inBodyData?.scanId || this.selectedScanId,
      age: Number(this.editableData.age),
      gender: this.editableData.gender,
      activityLevel: this.editableData.activityLevel,
      trainingDaysPerWeek: Number(this.editableData.trainingDays),
      allergies: this.editableData.allergies || 'none',
      disease: this.editableData.chronicDiseases || 'none',
      budget: this.editableData.budgetLevel || 'moderate'
    };

    if (this.loading) return;

    this.loading = true;
    this.loadingText = 'AI is crafting your personalized plan... Please wait...';
    console.log('🔥 Payload:', payload);

    this.planService.generatePlan(payload)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (res: any) => {
          console.log('✅ PLAN:', res);
          const planData = res;
          localStorage.setItem('userPlan', JSON.stringify(planData));

          // Try to save the planId from the backend response in case it returns it directly
          if (res?.data?.plan_id || res?.plan_id) {
            localStorage.setItem('savedPlanId', res?.data?.plan_id || res?.plan_id);
          }

          this.router.navigate(['/user/my-plan'], {
            state: { plan: planData }
          });
        },
        error: (err: any) => {
          console.error('Failed to generate plan:', err);
          this.loading = false;
          alert('❌ Failed to generate plan from AI. Please try again.');
        }
      });
  }
}