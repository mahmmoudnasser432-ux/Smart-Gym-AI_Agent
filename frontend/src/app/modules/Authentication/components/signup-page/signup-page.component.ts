import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';

@Component({
  selector: 'app-signup-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup-page.component.html',
  styleUrls: ['./signup-page.component.scss']
})
export class SignupPageComponent implements OnInit {

  signupForm!: FormGroup;
  errorMsg = '';
  loading = false;

  showPassword = false;
  showRePassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthenticationService,
    private router: Router
  ) {}

  ngOnInit(): void {

    this.signupForm = this.fb.group({

      username: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50)
        ]
      ],

      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(/^01[0125][0-9]{8}$/)
        ]
      ],

      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6)
        ]
      ],

      rePassword: [
        '',
        Validators.required
      ]

    }, { validators: this.passwordMatchValidator });

  }

  passwordMatchValidator(control: AbstractControl) {

    const password = control.get('password');
    const rePassword = control.get('rePassword');

    if (password && rePassword && password.value !== rePassword.value) {
      rePassword.setErrors({ mismatch: true });
    }

    return null;
  }

  onSubmit() {

    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    const formData = this.signupForm.value;

    const registerData = {
      username: formData.username,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      rePassword: formData.rePassword
    };

    console.log(registerData);

    this.authService.register(registerData).subscribe({

      next: (res: any) => {

        this.loading = false;

        // ✅ امسح كل البيانات القديمة عشان الـ new user يبدأ نظيف بـ 0 tokens
        localStorage.removeItem('userTokens');
        localStorage.removeItem('myBookings');
        localStorage.removeItem('selectedService');

        localStorage.setItem('isNewUser', 'true');

        this.router.navigate(['/auth/login']);

      },

      error: (err) => {

        this.loading = false;

        console.log(err);

        this.errorMsg =
          err.error?.message ||
          err.error?.errors?.msg ||
          'Registration failed. Please try again.';
      }

    });

  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleRePassword() {
    this.showRePassword = !this.showRePassword;
  }

}