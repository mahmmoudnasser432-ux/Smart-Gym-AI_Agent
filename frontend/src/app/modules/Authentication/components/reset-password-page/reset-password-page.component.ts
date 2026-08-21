import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [ReactiveFormsModule,RouterLink],
  templateUrl: './reset-password-page.component.html',
  styleUrls: ['./reset-password-page.component.scss']
})
export class ResetPasswordPageComponent implements OnInit {

  resetForm!: FormGroup;
  loading = false;
  errorMsg = '';
  showPassword = false;
  showConfirm = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthenticationService,
    private router: Router
  ) {
    this.resetForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordsMatch });
  }

  ngOnInit() {
    const email = localStorage.getItem('resetEmail') || '';
    const code = localStorage.getItem('resetCode') || '';
    this.resetForm.patchValue({ email, code });
  }

  passwordsMatch(group: FormGroup) {
    const pass = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { mismatch: true };
  }

  onSubmit() {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    const { email, code, newPassword } = this.resetForm.value;

    this.authService.resetPassword({ email, code, newPassword }).subscribe({
      next: () => {
        this.loading = false;
        localStorage.removeItem('resetEmail');
        localStorage.removeItem('resetCode');
        this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Something went wrong, try again!';
      }
    });
  }

  togglePassword() { this.showPassword = !this.showPassword; }
  toggleConfirm() { this.showConfirm = !this.showConfirm; }
}