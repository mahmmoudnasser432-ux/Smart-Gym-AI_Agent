import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.scss']
})
export class LoginPageComponent implements OnInit {

  loginForm!: FormGroup;
  errorMsg = '';
  loading = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthenticationService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required]],
      password: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    const data = this.loginForm.value;

    console.log('Login Data:', data);

    this.authService.login(data).subscribe({
      next: (res: any) => {
        this.loading = false;

        console.log('Response:', res);

        if (res.data?.token) {
          const user = res.data.user || {};
          if (res.data.profile_picture_url) {
            user.profile_picture_url = res.data.profile_picture_url;
          }
          const role = user?.role;

          this.authService.saveToken(res.data.token);
          this.authService.saveUserData(user);

          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(user));

          // Role-based routing logic
          if (role === 'admin') {
            this.router.navigate(['/admin/dashboard']);
          } else if (role === 'coach') {
            this.router.navigate(['/coach/dashboard']);
          } else {
            const isNewUser = this.authService.checkIsNewUser(user);
            const selectedService = localStorage.getItem('selectedService');

            if (isNewUser) {
              // أول مرة يعمل login → يروح dashboard على طول
              this.router.navigate(['/user/dashboard']);
            } else if (selectedService === 'booking') {
              // سبق واختار booking → يرجعله service-selection كل login
              this.router.navigate(['/user/service-selection']);
            } else {
              // اختار AI plan قبل كده → يروح dashboard
              this.router.navigate(['/user/dashboard']);
            }
          }

        } else {
          this.errorMsg = 'Login failed';
        }
      },

      error: (err) => {
        this.loading = false;

        console.log('Login Error:', err);

        this.errorMsg =
          err.error?.message ||
          err.error?.errors?.msg ||
          'Invalid email or password';
      }
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  forget() {
    this.router.navigate(['/auth/forgot-password']);
  }
}