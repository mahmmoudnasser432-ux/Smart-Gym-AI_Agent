import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../Environments/environments.develompent';
import {
  Coach,
  RatingCheckResponse,
  RatingResponse,
  RatingSubmission,
  CoachRatingsAdmin,
} from '../models/rating';

@Injectable({
  providedIn: 'root',
})
export class RatingService {
  private apiUrl = `${environment.apiUrl}/coaches`;

  constructor(private http: HttpClient) {}

  /**
   * Endpoint 1: Get list of all coaches for dropdown
   * GET /api/coaches
   */
  getCoaches(): Observable<{ status: string; data: Coach[] }> {
    return this.http.get<{ status: string; data: Coach[] }>(this.apiUrl);
  }

  /**
   * Endpoint 2: Check if user already rated a coach
   * GET /api/coaches/{coachId}/my-rating
   */
  checkRating(coachId: number): Observable<{ data: RatingCheckResponse }> {
    return this.http.get<{ data: RatingCheckResponse }>(
      `${this.apiUrl}/${coachId}/my-rating`
    );
  }

  /**
   * Endpoint 3: Submit a new rating
   * POST /api/coaches/{coachId}/rate
   */
  submitRating(
    coachId: number,
    ratingData: RatingSubmission
  ): Observable<{ data: RatingResponse }> {
    return this.http.post<{ data: RatingResponse }>(
      `${this.apiUrl}/${coachId}/rate`,
      ratingData
    );
  }

  /**
   * Endpoint 4: Get all ratings for a coach (Admin only)
   * GET /api/coaches/{coachId}/ratings
   */
  getCoachRatings(coachId: number): Observable<{ data: CoachRatingsAdmin }> {
    return this.http.get<{ data: CoachRatingsAdmin }>(
      `${this.apiUrl}/${coachId}/ratings`
    );
  }
}
