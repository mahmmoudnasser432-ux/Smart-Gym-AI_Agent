/**
 * Coach Rating Model
 */

export interface Coach {
  coach_id: number;
  username: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface RatingSubmission {
  communication: number; // 1-5
  knowledge: number;     // 1-5
  attitude: number;      // 1-5
  punctuality: number;   // 1-5
  comment?: string;      // Optional
}

export interface CoachRating {
  rating_id: number;
  communication: number;
  knowledge: number;
  attitude: number;
  punctuality: number;
  overall_avg: number;
  comment?: string;
  rated_at: string;
}

export interface RatingCheckResponse {
  has_rated: boolean;
  can_rate_at?: string;
  rating?: CoachRating;
}

export interface RatingResponse {
  rating_id: number;
  coach_id: number;
  communication: number;
  knowledge: number;
  attitude: number;
  punctuality: number;
  overall_avg: number;
  comment?: string;
  rated_at: string;
}

export interface CoachRatingsAdmin {
  coach_id: number;
  total_ratings: number;
  averages?: {
    communication: number;
    knowledge: number;
    attitude: number;
    punctuality: number;
    overall_avg: number;
  };
  ratings: CoachRating[];
}
