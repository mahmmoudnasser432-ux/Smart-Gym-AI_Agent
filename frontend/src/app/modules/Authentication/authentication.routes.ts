import { Routes } from "@angular/router";

export const AUTH_ROUTES: Routes = [

    {path:'landing-page',loadComponent:()=>import('./components/landing-page/landing-page.component').then((C)=>C.LandingPageComponent)},
    { path: 'login', loadComponent: () => import('./components/login-page/login-page.component').then((C) => C.LoginPageComponent) },
    { path: 'signup', loadComponent: () => import('./components/signup-page/signup-page.component').then((C) => C.SignupPageComponent) },
    { path: 'forgot-password', loadComponent: () => import('./components/forgot-password-page/forgot-password-page.component').then((C) => C.ForgotPasswordPageComponent) },
    { path: 'verify-reset-code', loadComponent: () => import('./components/verify-reset-code-page/verify-reset-code-page.component').then((C) => C.VerifyResetCodePageComponent) },
    { path: 'reset-password', loadComponent: () => import('./components/reset-password-page/reset-password-page.component').then((C) => C.ResetPasswordPageComponent) }

]