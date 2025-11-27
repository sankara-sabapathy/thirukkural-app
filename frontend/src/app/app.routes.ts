import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'callback', loadComponent: () => import('./pages/callback/callback.component').then(m => m.CallbackComponent) },
    { path: 'about', loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent) },
    { path: 'privacy', loadComponent: () => import('./pages/privacy/privacy.component').then(m => m.PrivacyComponent) },
    { path: 'terms', loadComponent: () => import('./pages/terms/terms.component').then(m => m.TermsComponent) },
    { path: 'contact', loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent) }
];
