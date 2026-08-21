import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../Environments/environments.develompent';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class InBodyService {

  constructor(private http: HttpClient) {}

  private getHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }

  getInBody(): Observable<any> {
    return this.http.get(environment.apiUrl + '/ai/scans/latest', {
      headers: this.getHeaders()
    });
  }

  getInBodyScans(userId: string | number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/users/${userId}/inbody`, {
      headers: this.getHeaders()
    });
  }

  getInBodyScan(userId: string | number, scanId: string | number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/users/${userId}/inbody/${scanId}`, {
      headers: this.getHeaders()
    });
  }

  getProgress(): Observable<any> {
    return this.http.get(environment.apiUrl + '/users/progress', {
      headers: this.getHeaders()
    }).pipe(
      catchError(() => of(null))
    );
  }

  saveScanToHistory(scanId: number | string): Observable<any> {
    return this.http.post(environment.apiUrl + '/ai/scans/save', { scanId }, {
      headers: this.getHeaders()
    }).pipe(
      catchError(() => of(null))
    );
  }
}