import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [ReactiveFormsModule,RouterLink],
  templateUrl: './forgot-password-page.component.html',
  styleUrls: ['./forgot-password-page.component.scss']
})
export class ForgotPasswordPageComponent {

  forgotForm!: FormGroup;
  loading = false;
  errorMsg = '';
  successMsg = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthenticationService,
    private router: Router
  ) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit() {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMsg = '';
    this.successMsg = '';

    this.authService.forgotPassword(this.forgotForm.value).subscribe({
      next: () => {
        this.loading = false;
        localStorage.setItem('resetEmail', this.forgotForm.value.email);
        this.router.navigate(['/auth/verify-reset-code']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Something went wrong, try again!';
      }
    });
  }
}