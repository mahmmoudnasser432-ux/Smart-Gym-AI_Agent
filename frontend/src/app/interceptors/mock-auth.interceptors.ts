import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';

export const mockAuthInterceptor: HttpInterceptorFn = (req, next) => {
    // Check if the request is for login
    if (req.url.includes('/auth/login') && req.method === 'POST') {
        const { email, password } = req.body as any;



        // Mock logic based on email and password
        let role = '';

        if (password === '123456' && email === 'admin@gmail.com') {

            role = 'admin';

        } else if (password === '123456' && email === 'coach@gmail.com') {

            role = 'coach';

        } else if (password === '123456') {

            role = 'user';

        }

        const mockResponse = {
            message: 'Success',
            data: {
                token: 'fake-jwt-token-for-' + role,
                user: {
                    name: 'FakeUser',
                    email: email,
                    role: role,
                    isNewUser: false
                }
            }
        };

        // Return a mock success response after a short delay
        return of(new HttpResponse({ status: 200, body: mockResponse })).pipe(delay(500));
    }


    // If not a login request, just pass it through
    return next(req);
};
