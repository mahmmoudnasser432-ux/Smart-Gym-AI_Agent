import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../../Authentication/services/authentication.service';

@Component({
  selector: 'app-service-selection',
  standalone: true,
  imports: [],
  templateUrl: './service-selection.component.html',
  styleUrls: ['./service-selection.component.scss']
})
export class ServiceSelectionComponent {

  constructor(
    private router: Router,
    private authService: AuthenticationService
  ) {}

  goToInBodyCheck() {
    // اختار AI Plan → مش هيرجع service-selection تاني، هيروح dashboard
    this.authService.markUserAsOld();
    localStorage.removeItem('selectedService');
    this.router.navigate(['/user/inBody-check']);
  }

  BookingMachines() {
    // اختار Booking → يتحفظ عشان كل login يرجعله service-selection
    this.authService.markUserAsOld();
    localStorage.setItem('selectedService', 'booking');
    this.router.navigate(['/user/booking-machine']);
  }

  goToDashboard() {
    this.authService.markUserAsOld();
    this.router.navigate(['/user/dashboard']);
  }
}