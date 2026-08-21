import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthenticationService } from '../modules/Authentication/services/authentication.service';

export const adminGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthenticationService);
    const router = inject(Router);

    if (authService.isLogged() && authService.getUserRole() === 'admin') {
        return true;
    }

    router.navigate(['/auth/login']);
    return false;
};
