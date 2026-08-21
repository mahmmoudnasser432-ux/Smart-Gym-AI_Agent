import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CoachService } from '../../../../services/coach.service';

@Component({
  selector: 'app-add-coach',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-coach.component.html',
  styleUrls: ['./add-coach.component.scss']
})
export class AddCoachComponent implements OnInit {

  formData = {
    username: '',
    email: '',
    password: '',
    phone: '',
    salary: ''
  };

  selectedFile: File | null = null;
  previewUrl: string | null = null;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  showSuccessToast = false;
  showErrorToast = false;

  constructor(
    private coachService: CoachService,
    private router: Router
  ) { }

  ngOnInit(): void { }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Check file type and size
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        this.showError('Invalid image format. Use JPG, PNG or WebP');
        return;
      }

      if (file.size > maxSize) {
        this.showError('Image size is too large. Maximum 5MB');
        return;
      }

      this.selectedFile = file;

      // Preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit(): void {
    // Validation
    if (!this.formData.username.trim()) {
      this.showError('Coach name is required');
      return;
    }

    if (!this.formData.email.trim()) {
      this.showError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.formData.email)) {
      this.showError('Invalid email format');
      return;
    }

    if (!this.formData.password.trim()) {
      this.showError('Password is required');
      return;
    }

    if (this.formData.password.length < 6) {
      this.showError('Password must be at least 6 characters');
      return;
    }

    this.isLoading = true;

    // Build FormData
    const data = new FormData();
    data.append('username', this.formData.username);
    data.append('email', this.formData.email);
    data.append('password', this.formData.password);

    if (String(this.formData.phone).trim()) {
      data.append('phone', this.formData.phone);
    }

    if (String(this.formData.salary).trim() && this.formData.salary !== '') {
      data.append('salary', this.formData.salary);
    }

    if (this.selectedFile) {
      data.append('photo', this.selectedFile);
    }

    console.log('Form Data to Submit:', {
      username: this.formData.username,
      email: this.formData.email,
      password: '****',
      phone: this.formData.phone,
      salary: this.formData.salary,
      hasPhoto: !!this.selectedFile
    });

    // API Call
    this.coachService.addCoach(data).subscribe({
      next: (response) => {
        console.log('Coach added successfully:', response);
        this.isLoading = false;
        
        // Check if response has the expected structure
        const coachName = response?.data?.username || 'New Coach';
        this.successMessage = `Coach "${coachName}" added successfully!`;
        this.showSuccessToast = true;
        
        setTimeout(() => {
          this.showSuccessToast = false;
          this.resetForm();
          this.router.navigate(['/admin/dashboard']);
        }, 2000);
      },
      error: (error) => {
        console.error('Error adding coach:', error);
        this.isLoading = false;
        
        let errorMsg = 'Error while adding coach';
        if (error.error?.message) {
          errorMsg = error.error.message;
        } else if (error.error?.error) {
          errorMsg = error.error.error;
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        this.showError(errorMsg);
      }
    });
  }

  resetForm(): void {
    this.formData = {
      username: '',
      email: '',
      password: '',
      phone: '',
      salary: ''
    };
    this.selectedFile = null;
    this.previewUrl = null;
    this.errorMessage = '';
  }

  showError(message: string): void {
    this.errorMessage = message;
    this.showErrorToast = true;
    setTimeout(() => {
      this.showErrorToast = false;
    }, 4000);
  }

  removeImage(): void {
    this.selectedFile = null;
    this.previewUrl = null;
  }

  goBack(): void {
    this.router.navigate(['/admin/dashboard']);
  }

}
