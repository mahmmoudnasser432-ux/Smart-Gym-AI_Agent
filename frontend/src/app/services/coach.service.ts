import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../Environments/environments.develompent';

@Injectable({
  providedIn: 'root'
})
export class CoachService {

  constructor(private http: HttpClient) { }

  private getHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getCustomersList(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/coaches/customers/list`, { headers: this.getHeaders() });
  }

  getCustomerAttendance(userId: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/coaches/customers/${userId}/attendance`, { headers: this.getHeaders() });
  }

  getCustomerProgress(userId: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/coaches/customers/${userId}/progress`, { headers: this.getHeaders() });
  }

  getCustomerActivity(userId: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/coaches/customers/${userId}/activity`, { headers: this.getHeaders() });
  }

  sendCustomerAlert(userId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/coaches/customers/${userId}/alert`, {}, { headers: this.getHeaders() });
  }

  addCoach(formData: FormData): Observable<any> {
    const token = localStorage.getItem('token');
    console.log('Token:', token ? 'Present' : 'Missing');
    console.log('FormData being sent:', formData);
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.post(`${environment.apiUrl}/coaches`, formData, { headers });
  }
}
