import { Component, OnInit } from '@angular/core';
import { InBodyService } from '../../services/in-body.service';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-inbody-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inbody-history.component.html',
  styleUrls: ['./inbody-history.component.scss']
})
export class InbodyHistoryComponent implements OnInit {

  inBodyData: any = null;
  progressData: any = null;
  loading = false;

  allScanCards: any[] = [];
  allProgressCards: any[] = [];

  scansHistory: any[] = [];
  oldScans: any[] = [];
  selectedScanId: any = null;

  constructor(
    private inBodyService: InBodyService,
    private router: Router
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

        // Slice out the latest scan (index 0) so we only display old scans (indices 1 to N)
        this.oldScans = this.scansHistory.slice(1);

        if (this.oldScans.length > 0) {
          const defaultScan = this.oldScans[0];
          this.selectedScanId = defaultScan?.scanId ?? defaultScan?.scan_id ?? defaultScan?.id ?? defaultScan?._id ?? null;
          this.parseScanData(defaultScan);
        }
      } else {
        this.oldScans = [];
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
          console.error('Failed to load inbody scans history.', err);
          handleScansList([]);
        }
      });
  }

  extractDateFromObject(data: any): string | null {
    if (!data) return null;

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

    for (const key of Object.keys(data)) {
      const val = data[key];
      if (typeof val === 'string' && val.length >= 8 && !/^[0-9]+$/.test(val)) {
        const normalizedVal = val.includes(' ') && !val.includes('T') ? val.replace(' ', 'T') : val;
        const d = new Date(normalizedVal);
        if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
          return val;
        }
      }
      if (typeof val === 'number' && val > 1_000_000_000) {
        const d = new Date(val > 1e12 ? val : val * 1000);
        if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
          return d.toISOString();
        }
      }
    }
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

    this.buildScanCards();
  }

  onScanChange() {
    if (this.selectedScanId) {
      const selected = this.oldScans.find(s => (s.scanId ?? s.scan_id ?? s.id) == this.selectedScanId);
      if (selected) {
        this.parseScanData(selected);
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
}
