import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthenticationService } from '../../../Authentication/services/authentication.service';

@Component({
  selector: 'app-token-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './token-analytics.component.html',
  styleUrls: ['./token-analytics.component.scss']
})
export class TokenAnalyticsComponent implements OnInit {
  userName = '';
  profileImageUrl: string = 'https://ui-avatars.com/api/?name=Admin&background=ff8a00&color=fff&size=90';

  // Weekly data
  weeklyData = [
    { day: 'Sat', value: 120 },
    { day: 'Sun', value: 95 },
    { day: 'Mon', value: 156 },
    { day: 'Tue', value: 132 },
    { day: 'Wed', value: 178 },
    { day: 'Thu', value: 145 },
    { day: 'Fri', value: 160 }
  ];

  // Monthly data
  monthlyData = [
    { month: 'Jan', value: 2400 },
    { month: 'Feb', value: 3100 },
    { month: 'Mar', value: 2800 },
    { month: 'Apr', value: 3500 },
    { month: 'May', value: 1200 }
  ];

  // Machine usage breakdown
  machineUsage = [
    { name: 'Treadmill', tokens: 3000 },
    { name: 'Bench Press', tokens: 2960 },
    { name: 'Leg Press', tokens: 2500 },
    { name: 'Lat Pulldown', tokens: 1953 },
    { name: 'Elliptical Trainer', tokens: 1090 },
    { name: 'Smith Machine', tokens: 700 },
    { name: 'Seated Row', tokens: 650 },
    { name: 'Cable Crossover', tokens: 343 }
  ];

  // Purchase history
  purchaseHistory = [
    { id: 1, customer: 'Ahmed Hassan', amount: 50, price: 500, date: '2026-05-08', method: 'Visa' },
    { id: 2, customer: 'Sara Mohamed', amount: 30, price: 300, date: '2026-05-07', method: 'Cash' },
    { id: 3, customer: 'Omar Ali', amount: 100, price: 900, date: '2026-05-07', method: 'Visa' },
    { id: 4, customer: 'Nour Ibrahim', amount: 20, price: 200, date: '2026-05-06', method: 'Wallet' },
    { id: 5, customer: 'Youssef Khaled', amount: 75, price: 675, date: '2026-05-06', method: 'Visa' },
    { id: 6, customer: 'Mona Adel', amount: 40, price: 400, date: '2026-05-05', method: 'Cash' },
    { id: 7, customer: 'Khaled Samir', amount: 60, price: 540, date: '2026-05-05', method: 'Visa' }
  ];

  // Summary stats
  totalTokensSold = 4850;
  totalRevenue = 43650;
  avgPerUser = 19.6;
  activeBookings = 42;

  get maxWeeklyValue(): number {
    return Math.max(...this.weeklyData.map(d => d.value));
  }

  get maxMonthlyValue(): number {
    return Math.max(...this.monthlyData.map(d => d.value));
  }

  constructor(public authService: AuthenticationService) {}

  ngOnInit(): void {
    const savedUser = localStorage.getItem('userData');
    let email = '';
    if (savedUser) {
      const user = JSON.parse(savedUser);
      this.userName = user.name || user.username || user.email || 'Admin';
      email = user.email || '';
    }

    // ✅ قراءة الصورة من userData فقط (بدون per-email localStorage)
    const savedUserStr = localStorage.getItem('userData') || localStorage.getItem('user');
    let userImgUrl = '';
    if (savedUserStr) {
      const userObj = JSON.parse(savedUserStr);
      userImgUrl = userObj.profile_picture_url || userObj.photo || '';
    }
    
    if (userImgUrl) {
      this.profileImageUrl = userImgUrl;
    } else {
      this.profileImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userName)}&background=ff8a00&color=fff&size=90`;
    }
  }
}
