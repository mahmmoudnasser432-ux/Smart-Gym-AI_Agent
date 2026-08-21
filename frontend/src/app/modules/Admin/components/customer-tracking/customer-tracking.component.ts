import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthenticationService } from '../../../Authentication/services/authentication.service';
import { CoachService } from '../../../../services/coach.service';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  lastVisit: string;
  lastVisitTime: string;
  membershipType: string;
  weight: number;
  muscleMass: number;
  bodyFat: number;
  targetWeight: number;
  inactiveDays: number;
}

@Component({
  selector: 'app-customer-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customer-tracking.component.html',
  styleUrls: ['./customer-tracking.component.scss']
})
export class CustomerTrackingComponent implements OnInit {
  userName = '';
  profileImageUrl: string = 'https://ui-avatars.com/api/?name=Admin&background=ff8a00&color=fff&size=90';
  userRole = 'admin';

  searchQuery = '';
  selectedCustomer: Customer | null = null;
  selectedCustomerAttendance: any[] = [];
  selectedCustomerProgress: any = null;

  // Delete modal state
  showDeleteConfirm = false;
  customerToDelete: Customer | null = null;
  deleteSuccess = false;

  customers: Customer[] = [];

  get filteredCustomers(): Customer[] {
    return this.customers.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchesSearch;
    });
  }

  constructor(
    public authService: AuthenticationService,
    private coachService: CoachService
  ) { }

  ngOnInit(): void {
    const savedUser = localStorage.getItem('userData');
    let email = '';
    if (savedUser) {
      const user = JSON.parse(savedUser);
      this.userName = user.name || user.username || user.email || 'Admin';
      this.userRole = user.role || 'admin';
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

    this.loadCustomers();
  }

  loadCustomers() {
    this.coachService.getCustomersList().subscribe({
      next: (res) => {
        if (res.status === 'success' && res.data) {
          this.customers = res.data.map((item: any) => ({
            id: item.user_id,
            name: item.username,
            email: item.email || `${item.username.toLowerCase()}@mail.com`,
            phone: item.phone || '010XXXXXXXX',
            joinDate: item.joinDate || '2026-01-01',
            lastVisit: 'N/A',
            lastVisitTime: 'N/A',
            membershipType: item.activity_level || 'Standard',
            weight: 0,
            muscleMass: 0,
            bodyFat: 0,
            targetWeight: 70,
            inactiveDays: 0
          }));

          // Fetch activity/alert details for each user
          this.customers.forEach(c => {
            this.coachService.getCustomerActivity(c.id).subscribe({
              next: (actRes) => {
                if (actRes.status === 'success' && actRes.data) {
                  c.inactiveDays = actRes.data.inactive_days;
                  if (actRes.data.last_booking_date) {
                    c.lastVisit = new Date(actRes.data.last_booking_date).toLocaleDateString();
                  }
                }
              }
            });
          });
        }
      },
      error: (err) => console.error('Error loading customers:', err)
    });
  }

  selectCustomer(customer: Customer) {
    this.selectedCustomer = customer;
    this.selectedCustomerAttendance = [];
    this.selectedCustomerProgress = null;

    // Load attendance
    this.coachService.getCustomerAttendance(customer.id).subscribe({
      next: (res) => {
        if (res.status === 'success' && res.data) {
          this.selectedCustomerAttendance = res.data;
        }
      }
    });

    // Load progress
    this.coachService.getCustomerProgress(customer.id).subscribe({
      next: (res) => {
        if (res.status === 'success' && res.data) {
          this.selectedCustomerProgress = res.data;
          this.selectedCustomer!.weight = res.data.weight || 0;
          this.selectedCustomer!.bodyFat = res.data.body_fat || 0;
          this.selectedCustomer!.targetWeight = res.data.targetWeight || 70;
        }
      }
    });
  }

  backToList() {
    this.selectedCustomer = null;
  }

  getDaysSinceLastVisit(customer: Customer): number {
    return customer.inactiveDays || 0;
  }

  getAbsenceAlert(customer: Customer): string | null {
    const days = this.getDaysSinceLastVisit(customer);
    if (days > 7) {
      return `⚠️ This user hasn't visited in ${days} days!`;
    }
    return null;
  }

  getAbsenceLevel(customer: Customer): string {
    const days = this.getDaysSinceLastVisit(customer);
    if (days > 30) return 'critical';
    if (days > 14) return 'warning';
    if (days > 7) return 'caution';
    return 'good';
  }

  getAbsentUsers(): number {
    return this.customers.filter(c => this.getDaysSinceLastVisit(c) > 7).length;
  }

  sendReminder(userId: number) {
    this.coachService.sendCustomerAlert(userId).subscribe({
      next: (res) => {
        alert('Alert sent to user successfully!');
      },
      error: (err) => {
        console.error('Error sending alert:', err);
      }
    });
  }

  // Delete customer methods
  confirmDelete(customer: Customer, event: Event) {
    event.stopPropagation();
    this.customerToDelete = customer;
    this.showDeleteConfirm = true;
  }

  cancelDelete() {
    this.showDeleteConfirm = false;
    this.customerToDelete = null;
  }

  deleteCustomer() {
    if (!this.customerToDelete) return;
    const id = this.customerToDelete.id;
    this.customers = this.customers.filter(c => c.id !== id);

    // If viewing detail of deleted customer, go back to list
    if (this.selectedCustomer?.id === id) {
      this.selectedCustomer = null;
    }

    this.deleteSuccess = true;
    this.showDeleteConfirm = false;
    this.customerToDelete = null;

    // Hide success message after 3 seconds
    setTimeout(() => {
      this.deleteSuccess = false;
    }, 3000);
  }

  getProgressPercent(customer: Customer): number {
    if (customer.targetWeight >= customer.weight) return 100;
    const totalToLose = customer.weight - customer.targetWeight;
    const startWeight = customer.weight + 5; // assume started 5kg heavier
    const lost = startWeight - customer.weight;
    return Math.min(100, Math.max(0, Math.round((lost / (startWeight - customer.targetWeight)) * 100)));
  }
}
