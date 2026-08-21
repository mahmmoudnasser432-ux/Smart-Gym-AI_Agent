import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../Environments/environments.develompent';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  constructor(private http: HttpClient, private router: Router) { }



  //route
  // login(data: any): Observable<any> {
  //   return this.http.post(environment.apiUrl + '/auth/signin', data);
  // }


  login(data: any): Observable<any> {
    return this.http.post(environment.apiUrl + '/auth/login', data);
  }


  saveUserData(user: any) {
    localStorage.setItem('userData', JSON.stringify(user));
  }

  getUserData() {
    const data = localStorage.getItem('userData');
    return data ? JSON.parse(data) : null;
  }

  getUserRole(): string | null {
    const user = this.getUserData();
    return user ? user.role : null;
  }

  checkIsNewUser(resUser: any): boolean {
    if (resUser?.isNewUser === true) return true;
    if (resUser?.isNewUser === false) return false;
    return localStorage.getItem('isNewUser') === 'true';
  }

  markUserAsOld(): void {
    localStorage.removeItem('isNewUser');
  }


  //route
  // register(data: any): Observable<any> {
  //   return this.http.post(environment.apiUrl + '/auth/signup', data);
  // }

  register(data: any): Observable<any> {
    return this.http.post(environment.apiUrl + '/auth/register', data);
  }

  saveToken(token: string) {
    localStorage.setItem('token', token);
  }

  getToken() {
    return localStorage.getItem('token');
  }


  logout() {
    // الحصول على جميع مفاتيح localStorage وحذف تلك المتعلقة بـ profileImage
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (key.startsWith('profileImage_')) {
        localStorage.removeItem(key);
      }
    });

    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    localStorage.removeItem('user');
    localStorage.removeItem('isNewUser');
    localStorage.removeItem('userTokens');
    localStorage.removeItem('myBookings');
    localStorage.removeItem('selectedService');
    localStorage.removeItem('userPlan');
    localStorage.removeItem('hasPlan');
    localStorage.removeItem('profileImage');
    this.router.navigate(['/auth/login']);
  }
  isLogged(): boolean {
    return !!localStorage.getItem('token');
  }

  forgotPassword(data: { email: string }): Observable<any> {
    return this.http.post(environment.apiUrl + '/auth/forgotPasswords', data);
  }

  verifyResetCode(data: { email?: string; resetCode: string }): Observable<any> {
    return this.http.post(environment.apiUrl + '/auth/verifyResetCode', data);
  }

  resetPassword(data: { email: string; code: string; newPassword: string }): Observable<any> {
    return this.http.post(environment.apiUrl + '/auth/reset-password', data);
  }

  updateProfilePicture(formData: FormData): Observable<any> {
    const token = this.getToken();
    return this.http.post(environment.apiUrl + '/users/profile/picture', formData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  updateProfile(data: { username: string, phone: string }): Observable<any> {
    const token = this.getToken();
    return this.http.put(environment.apiUrl + '/users/update-profile', data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}