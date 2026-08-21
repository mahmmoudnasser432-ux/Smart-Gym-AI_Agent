import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  const router = inject(Router);

  // Skip attaching token for public authentication routes or if token is invalid/null string
  const isAuthRoute = req.url.includes('/auth/');
  const hasValidToken = token && token !== 'null' && token !== 'undefined';

  let clonedReq = req;

  if (hasValidToken && !isAuthRoute) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Clear token and related user data on unauthorized
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userData');
        
        // Redirect to login page
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
};
