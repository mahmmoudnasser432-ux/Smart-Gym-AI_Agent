import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RatingService } from '../../services/rating.service';
import {
  Coach,
  RatingSubmission,
} from '../../models/rating';

@Component({
  selector: 'app-rate-coach',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rate-coach.component.html',
  styleUrls: ['./rate-coach.component.scss'],
})
export class RateCoachComponent implements OnInit {
  coaches: Coach[] = [];
  selectedCoach: Coach | null = null;
  ratingData: RatingSubmission = {
    communication: 0,
    knowledge: 0,
    attitude: 0,
    punctuality: 0,
    comment: '',
  };

  isLoading = false;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';
  showRatingForm = false;

  // Star rating values
  communicationStars = 0;
  knowledgeStars = 0;
  attitudeStars = 0;
  punctualityStars = 0;

  constructor(private ratingService: RatingService, private router: Router) {}

  ngOnInit(): void {
    this.loadCoaches();
  }

  /**
   * Load all coaches for the dropdown
   */
  loadCoaches(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.ratingService.getCoaches().subscribe({
      next: (response) => {
        this.coaches = response.data;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Failed to load coaches';
        this.isLoading = false;
        console.error(error);
      },
    });
  }

  /**
   * Handle coach selection from dropdown
   */
  onCoachSelected(coach: Coach | null): void {
    if (!coach) {
      this.selectedCoach = null;
      this.showRatingForm = false;
      this.resetForm();
      return;
    }
    
    this.showRatingForm = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.resetForm();
  }



  /**
   * Set star rating for communication
   */
  setCommunicationRating(stars: number): void {
    this.communicationStars = stars;
    this.ratingData.communication = stars;
  }

  /**
   * Set star rating for knowledge
   */
  setKnowledgeRating(stars: number): void {
    this.knowledgeStars = stars;
    this.ratingData.knowledge = stars;
  }

  /**
   * Set star rating for attitude
   */
  setAttitudeRating(stars: number): void {
    this.attitudeStars = stars;
    this.ratingData.attitude = stars;
  }

  /**
   * Set star rating for punctuality
   */
  setPunctualityRating(stars: number): void {
    this.punctualityStars = stars;
    this.ratingData.punctuality = stars;
  }

  /**
   * Check if all required fields are filled
   */
  isFormValid(): boolean {
    return (
      this.communicationStars > 0 &&
      this.knowledgeStars > 0 &&
      this.attitudeStars > 0 &&
      this.punctualityStars > 0
    );
  }

  /**
   * Submit the rating
   */
  submitRating(): void {
    if (!this.selectedCoach || !this.isFormValid()) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.ratingService.submitRating(this.selectedCoach.coach_id, this.ratingData)
      .subscribe({
        next: (response) => {
          this.successMessage = '✅ Rating submitted successfully!';
          this.isSubmitting = false;
          this.showRatingForm = false;
          // Optionally auto-redirect after success, but we have the Continue button now.
        },
        error: (error) => {
          // Handle specific error messages from backend
          if (error.error?.message) {
            this.errorMessage = error.error.message;
          } else if (error.status === 429) {
            this.errorMessage = 'You already rated this coach recently. Please try again later.';
          } else if (error.status === 404) {
            this.errorMessage = 'Coach not found';
          } else {
            this.errorMessage = 'Failed to submit rating. Please try again.';
          }
          this.isSubmitting = false;
          console.error(error);
        },
      });
  }

  /**
   * Reset the form
   */
  resetForm(): void {
    this.ratingData = {
      communication: 0,
      knowledge: 0,
      attitude: 0,
      punctuality: 0,
      comment: '',
    };
    this.communicationStars = 0;
    this.knowledgeStars = 0;
    this.attitudeStars = 0;
    this.punctualityStars = 0;
  }

  /**
   * Go back to previous page
   */
  goBack(): void {
    this.router.navigate(['/user/dashboard']);
  }
}
