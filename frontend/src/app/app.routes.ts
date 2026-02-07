import { Routes, Router } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service';
import { map, take } from 'rxjs/operators';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'callback', loadComponent: () => import('./pages/callback/callback.component').then(m => m.CallbackComponent) },
    { path: 'about', loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent) },
    { path: 'privacy', loadComponent: () => import('./pages/privacy/privacy.component').then(m => m.PrivacyComponent) },
    { path: 'terms', loadComponent: () => import('./pages/terms/terms.component').then(m => m.TermsComponent) },
    { path: 'contact', loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent) },
    { path: 'kurals', loadComponent: () => import('./pages/kural-list/kural-list.component').then(m => m.KuralListComponent) },
    {
        path: 'kural/:id',
        loadComponent: () => import('./pages/kural-detail/kural-detail.component').then(m => m.KuralDetailComponent)
    },
    {
        path: 'unsubscribe',
        loadComponent: () => import('./pages/unsubscribe/unsubscribe.component').then(m => m.UnsubscribeComponent)
    },
    { path: 'pricing', loadComponent: () => import('./pages/pricing/pricing.component').then(m => m.PricingComponent) },
    {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [() => {
            const auth = inject(AuthService);
            const router = inject(Router);
            return auth.isAuthenticated$.pipe(
                take(1),
                map(isAuth => isAuth ? true : router.createUrlTree(['/']))
            );
        }]
    },
    {
        path: '**',
        redirectTo: ''
    }
];
