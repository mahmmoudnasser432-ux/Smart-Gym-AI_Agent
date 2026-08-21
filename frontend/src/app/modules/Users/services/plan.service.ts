import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../Environments/environments.develompent';

@Injectable({
  providedIn: 'root'
})
export class PlanService {

  constructor(private http: HttpClient) {}

  generatePlan(data: any) {
    const token = localStorage.getItem('token');

    return this.http.post(
      environment.apiUrl + '/plans/generate',
      data,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }

  savePlan(data: any) {
    const token = localStorage.getItem('token');
    return this.http.post(
      environment.apiUrl + '/plans/save',
      data,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }

  getMyPlan(): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    return this.http.get(environment.apiUrl + '/ai/plans/latest', { headers }).pipe(
      catchError(() => {
        // Try alternative endpoint
        return this.http.get(environment.apiUrl + '/ai/my-plan', { headers }).pipe(
          catchError(() => {
            return this.http.get(environment.apiUrl + '/ai/plans', { headers }).pipe(
              catchError(() => of(null))
            );
          })
        );
      })
    );
  }

  downloadPlanPdf(planId: string | number): Observable<Blob> {
    const token = localStorage.getItem('token');
    return this.http.get(`${environment.apiUrl}/plans/${planId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob'
    });
  }
}