import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';
import { BookingService } from '../../services/booking.service';
import { TokenService } from '../../services/token.service';

interface Machine {
  id: number;
  name: string;
  description: string;
  image: string;
  tokenPerMinute: number;
}

interface BookedSlot {
  from: string;
  to: string;
}

interface BookingSummary {
  bookingId?: number;
  machineName: string;
  day: string;
  from: string;
  to: string;
  durationMinutes: number;
  totalTokens: number;
  status: string;
}

@Component({
  selector: 'app-booking-machine',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-machine.component.html',
  styleUrls: ['./booking-machine.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('popIn', [
      transition(':enter', [
        style({ transform: 'scale(0.8) translateY(20px)', opacity: 0 }),
        animate('400ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'scale(1) translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'scale(0.9) translateY(10px)', opacity: 0 }))
      ])
    ]),
    trigger('toastSlideIn', [
      transition(':enter', [
        style({ transform: 'translate(-50%, 40px)', opacity: 0 }),
        animate('400ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'translate(-50%, 0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translate(-50%, 20px)', opacity: 0 }))
      ])
    ])
  ]
})

export class BookingMachineComponent implements OnInit {

  machines: Machine[] = [
    {
      id: 1,
      name: 'Treadmill',
      description: 'Used for cardio and running',
      image: '/Images/WhatsApp Image 2026-06-201 at 8.50.09 PM.jpeg',
      tokenPerMinute: 1
    },
    {
      id: 2,
      name: 'Bench Press',
      description: 'Chest strength training',
      image: '/Images/WhatsApp Image 2026-06-203 at 8.50.09 PM.jpeg',
      tokenPerMinute: 1
    },
    {
      id: 3,
      name: 'Leg Press',
      description: 'Lower body workout',
      image: '/Images/WhatsApp Image 2026-06-207 at 8.50.10 PM.jpeg',
      tokenPerMinute: 1
    },
    {
      id: 4,
      name: 'Lat Pulldown',
      description: 'Back and lats strengthening exercise',
      image: '/Images/WhatsApp Image 2026-06-206 at 8.50.10 PM.jpeg',
      tokenPerMinute: 1
    },
    {
      id: 5,
      name: 'Elliptical Trainer',
      description: 'Low-impact cardio machine',
      image: '/Images/WhatsApp Image 2026-06-204 at 8.50.10 PM.jpeg',
      tokenPerMinute: 1
    },
    {
      id: 6,
      name: 'Smith Machine',
      description: 'Guided barbell workout machine',
      image: '/Images/WhatsApp Image 2026-06-20 at 8.50.09 PM.jpeg',
      tokenPerMinute: 1
    },
    {
      id: 7,
      name: 'Seated Row',
      description: 'Back rowing cable exercise',
      image: '/Images/WhatsApp Image 2026-06-208 at 8.50.11 PM.jpeg',
      tokenPerMinute: 1
    },
    {
      id: 8,
      name: 'Cable Cross Over',
      description: 'The ultimate station for multi-planar strength training.',
      image: '/Images/WhatsApp Image 2026-06-205 at 8.50.10 PM.jpeg',
      tokenPerMinute: 1
    }
  ];

  userTokens: number = 0;
  myBookings: BookingSummary[] = [];

  showModal = false;
  showSuccess = false;
  showHistoryModal = false;
  isLoadingSlots = false;
  isBooking = false;
  errorMessage = '';

  selectedMachine: Machine | null = null;
  selectedDate = '';
  selectedTime = '';
  selectedEndTime = '';
  selectedDuration = 30;

  bookedSlots: BookedSlot[] = [];
  lastBookingSummary: BookingSummary | null = null;

  constructor(
    private router: Router, 
    private bookingService: BookingService,
    private tokenService: TokenService
  ) {}

  ngOnInit(): void {
    const savedTokens = localStorage.getItem('userTokens');
    this.userTokens = savedTokens ? Number(savedTokens) : 0;
    
    this.loadMyBookings();
    this.fetchTokenBalance();
  }

  fetchTokenBalance(): void {
    this.tokenService.getBalance().subscribe({
      next: (res) => {
        this.userTokens = res.balance ?? res.data?.balance ?? 0;
        localStorage.setItem('userTokens', String(this.userTokens));
      },
      error: (err) => {
        console.error('Failed to load token balance', err);
      }
    });
  }

  loadMyBookings(): void {
    this.bookingService.getMyBookings().subscribe({
      next: (res) => {
        if (res.status === 'success' && res.data) {
          let apiBookings = res.data.map((b: any) => ({
            bookingId: b.booking_id || b.bookingId,
            machineName: b.name || b.machineName || b.machine_name || 'Machine',
            day: (b.start_time || b.from || '').split('T')[0],
            from: b.start_time || b.from,
            to: b.end_time || b.to,
            durationMinutes: b.durationMinutes || b.tokens_spent,
            totalTokens: b.tokens_spent || b.totalTokens || 0,
            status: b.status || 'Booked'
          }));

          // فلترة الحجوزات الناجحة فقط (لو الباك إند بيبعت حاجات ملغية أو فاشلة)
          apiBookings = apiBookings.filter((b: any) => b.status === 'Booked' || b.status === 'success');

          // ترتيب من الأحدث للأقدم
          apiBookings.sort((a: any, b: any) => new Date(b.from).getTime() - new Date(a.from).getTime());
          
          this.myBookings = apiBookings;
        } else {
          this.myBookings = [];
        }
      },
      error: (err) => {
        console.error('Failed to load bookings from API', err);
        this.myBookings = [];
      }
    });
  }

  get minDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  get maxDate(): string {
    const date = new Date();
    const currentDay = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    
    // الأسبوع يبدأ من السبت (6) وينتهي الجمعة (5)
    // لو النهاردة السبت، الجمعة هتكون بعد 6 أيام
    // لو أي يوم تاني، الجمعة هتكون بعد (5 - اليوم)
    const daysUntilFriday = currentDay === 6 ? 6 : 5 - currentDay;
    
    date.setDate(date.getDate() + daysUntilFriday);
    return date.toISOString().split('T')[0];
  }

  get durationMinutes(): number {
    if (!this.selectedTime || !this.selectedEndTime) return 0;
    const [h1, m1] = this.selectedTime.split(':').map(Number);
    const [h2, m2] = this.selectedEndTime.split(':').map(Number);
    const start = h1 * 60 + m1;
    const end = h2 * 60 + m2;
    return end > start ? end - start : 0;
  }

  get estimatedCost(): number {
    if (!this.selectedMachine) return 0;
    return this.durationMinutes * this.selectedMachine.tokenPerMinute;
  }

  get hasEnoughTokens(): boolean {
    return this.userTokens >= this.estimatedCost;
  }

  get isDurationValid(): boolean {
    const d = this.durationMinutes;
    return d >= 5 && d <= 120;
  }

  handleMachineClick(machine: Machine): void {
    this.openBooking(machine);
  }

  openBooking(machine: Machine): void {
    this.selectedMachine = machine;
    this.selectedDate = this.minDate;
    this.selectedTime = '';
    this.selectedEndTime = '';
    this.bookedSlots = [];
    this.errorMessage = '';
    this.showModal = true;
    this.loadBookedTimes();
  }

  onDateChange(): void {
    this.loadBookedTimes();
  }

  loadBookedTimes(): void {
    if (!this.selectedMachine || !this.selectedDate) return;

    this.isLoadingSlots = true;
    this.bookingService.getBookedTimes(this.selectedMachine.id, this.selectedDate).subscribe({
      next: (res) => {
        this.bookedSlots = res.data || res.bookedTimes || [];
        this.isLoadingSlots = false;
      },
      error: () => {
        this.bookedSlots = [];
        this.isLoadingSlots = false;
      }
    });
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedMachine = null;
    this.errorMessage = '';
  }

  openHistory(): void {
    this.showHistoryModal = true;
  }

  closeHistory(): void {
    this.showHistoryModal = false;
  }

  confirmBooking(): void {
    if (!this.selectedMachine || !this.selectedDate || !this.selectedTime || !this.selectedEndTime) return;
    
    if (!this.isDurationValid) {
      this.errorMessage = '⚠️ Duration must be between 5 and 120 minutes.';
      return;
    }

    this.isBooking = true;
    this.errorMessage = '';

    const payload = {
      machineId: Number(this.selectedMachine.id),
      bookingDate: this.selectedDate,
      startTime: this.selectedTime,
      durationMinutes: this.durationMinutes
    };

    this.bookingService.bookMachine(payload).subscribe({
      next: (res) => {
        const summary: BookingSummary = res.bookingSummary || res.data?.bookingSummary;
        this.lastBookingSummary = summary;

        if (summary) {
          this.userTokens -= summary.totalTokens;
          localStorage.setItem('userTokens', String(this.userTokens));
          this.myBookings.unshift(summary);
        }

        this.isBooking = false;
        this.showModal = false;
        this.showSuccess = true;

        this.fetchTokenBalance();

        setTimeout(() => {
          this.showSuccess = false;
        }, 6000);
      },
      error: (err) => {
        this.isBooking = false;
        if (err.status === 409) {
          this.errorMessage = '⚠️ This time slot is fully booked. Please choose a different time.';
        } else {
          this.errorMessage = err.error?.message || '❌ Booking failed. Please try again.';
        }
      }
    });
  }

  // Time Bar Helper: Check if a specific minute of the day is booked
  isTimeBooked(hour: number, minute: number): boolean {
    const timeInMins = hour * 60 + minute;
    return this.bookedSlots.some(slot => {
      const start = this.parseTimeToMins(slot.from);
      const end = this.parseTimeToMins(slot.to);
      return timeInMins >= start && timeInMins < end;
    });
  }

  private parseTimeToMins(isoOrTime: string): number {
    if (isoOrTime.includes('T')) {
      const d = new Date(isoOrTime);
      return d.getHours() * 60 + d.getMinutes();
    }
    const [h, m] = isoOrTime.split(':').map(Number);
    return h * 60 + m;
  }

  get timeBarHours(): number[] {
    return Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM
  }

  formatHour(h: number): string {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const display = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${display}${suffix}`;
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  goAddTokens(): void {
    this.router.navigate(['/user/add-tokens']);
  }

  cancelBooking(index: number): void {
    const bookingToCancel = this.myBookings[index];
    if (!bookingToCancel || !bookingToCancel.bookingId) return;

    if (confirm('Are you sure you want to cancel this booking?')) {
      this.bookingService.cancelBooking(bookingToCancel.bookingId).subscribe({
        next: (res) => {
          // 1. Refresh bookings list from backend
          this.loadMyBookings();

          // 2. Refresh token balance from backend
          this.fetchTokenBalance();
        },
        error: (err) => {
          console.error('Failed to cancel booking', err);
          alert(err.error?.message || '❌ Failed to cancel the booking. Please try again.');
        }
      });
    }
  }
}
