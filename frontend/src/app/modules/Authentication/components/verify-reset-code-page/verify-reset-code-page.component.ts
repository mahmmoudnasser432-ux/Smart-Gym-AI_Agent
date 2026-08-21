import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';

@Component({
  selector: 'app-verify-reset-code-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './verify-reset-code-page.component.html',
  styleUrls: ['./verify-reset-code-page.component.scss']
})
export class VerifyResetCodePageComponent {

  verifyForm!: FormGroup;
  loading = false;
  errorMsg = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthenticationService,
    private router: Router
  ) {
    this.verifyForm = this.fb.group({
      resetCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });
  }

  onSubmit() {
    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    const resetCode = this.verifyForm.value.resetCode;
    localStorage.setItem('resetCode', resetCode);
    
    // Navigate directly to reset password page since backend handles verification & reset in one step
    this.loading = false;
    this.router.navigate(['/auth/reset-password']);
  }
}