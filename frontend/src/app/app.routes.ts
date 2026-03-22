import { Routes, Router } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service';
import { map, take } from 'rxjs/operators';

const routeSeo = {
    home: {
        title: 'Daily Thirukkural in Tamil and English',
        description: 'Read Thirukkural couplets with Tamil text, English meaning, chapter navigation, and daily wisdom from Thiruvalluvar.',
        keywords: 'Thirukkural, Tirukkural, daily kural, Thiruvalluvar, Tamil wisdom, Tamil couplets',
        type: 'website'
    },
    library: {
        title: 'Thirukkural Library and Adhigaram Search',
        description: 'Browse all 1330 Kurals, search by verse, chapter, section, or adhigaram, and open detailed Thirukkural meanings instantly.',
        keywords: 'Thirukkural library, search Thirukkural, browse kurals, adhigaram search, Tamil literature',
        type: 'website'
    },
    adhigaramIndex: {
        title: 'Thirukkural Adhigaram Index',
        description: 'Browse all 133 Thirukkural adhigarams by book and division, and open each chapter with its full set of Kurals.',
        keywords: 'Thirukkural adhigaram index, Thirukkural chapters, browse adhigarams, Tamil chapter list',
        type: 'website'
    },
    widgetDocs: {
        title: 'Embeddable Thirukkural Widget',
        description: 'Embed a customizable Thirukkural widget on any website with random, daily, or fixed Kurals, banner and square layouts, and lightweight iframe delivery.',
        keywords: 'Thirukkural widget, embed thirukkural, random kural widget, Tamil quote widget, banner widget, square widget',
        type: 'website'
    },
    pricing: {
        title: 'Pricing and Subscription Plans',
        description: 'Explore Thirukkural Daily pricing, credit packs, and subscription plans for daily Kural delivery and premium access.',
        keywords: 'Thirukkural pricing, Thirukkural subscription, daily kural email, Thirukkural credits',
        type: 'website'
    },
    about: {
        title: 'About Thirukkural Daily',
        description: 'Learn about Thirukkural Daily, our mission to share the 1330 Kurals, and how we bring Thiruvalluvar’s wisdom to a global audience.',
        keywords: 'About Thirukkural Daily, Thiruvalluvar, Thirukkural project, Tamil ethics',
        type: 'website'
    },
    contact: {
        title: 'Contact Thirukkural Daily',
        description: 'Contact Thirukkural Daily for support, feedback, subscription questions, or help with the Thirukkural service.',
        keywords: 'Contact Thirukkural Daily, Thirukkural support, Thirukkural help',
        type: 'website'
    },
    privacy: {
        title: 'Privacy Policy',
        description: 'Read the Thirukkural Daily privacy policy covering account data, email delivery, subscriptions, payments, and data deletion.',
        keywords: 'Thirukkural privacy policy, data privacy, subscription privacy, Razorpay privacy',
        type: 'website'
    },
    terms: {
        title: 'Terms and Conditions',
        description: 'Read the Thirukkural Daily terms and conditions for subscriptions, payments, service availability, and content usage.',
        keywords: 'Thirukkural terms, Thirukkural conditions, subscription terms, Razorpay terms',
        type: 'website'
    },
    callback: {
        title: 'Signing You In',
        description: 'Authentication callback for Thirukkural Daily.',
        robots: 'noindex, nofollow',
        type: 'website'
    },
    unsubscribe: {
        title: 'Unsubscribe',
        description: 'Manage your Thirukkural Daily email unsubscribe preferences.',
        robots: 'noindex, nofollow',
        type: 'website'
    },
    profile: {
        title: 'Your Profile',
        description: 'Manage your Thirukkural Daily account, credits, and subscription settings.',
        robots: 'noindex, nofollow',
        type: 'website'
    }
} as const;

export const routes: Routes = [
    { path: '', component: HomeComponent, data: { seo: routeSeo.home } },
    {
        path: 'callback',
        loadComponent: () => import('./pages/callback/callback.component').then(m => m.CallbackComponent),
        data: { seo: routeSeo.callback }
    },
    {
        path: 'about',
        loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
        data: { seo: routeSeo.about }
    },
    {
        path: 'privacy',
        loadComponent: () => import('./pages/privacy/privacy.component').then(m => m.PrivacyComponent),
        data: { seo: routeSeo.privacy }
    },
    {
        path: 'terms',
        loadComponent: () => import('./pages/terms/terms.component').then(m => m.TermsComponent),
        data: { seo: routeSeo.terms }
    },
    {
        path: 'contact',
        loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent),
        data: { seo: routeSeo.contact }
    },
    {
        path: 'kurals',
        loadComponent: () => import('./pages/kural-list/kural-list.component').then(m => m.KuralListComponent),
        data: { seo: routeSeo.library }
    },
    {
        path: 'adhigaram',
        loadComponent: () => import('./pages/adhigaram-index/adhigaram-index.component').then(m => m.AdhigaramIndexComponent),
        data: { seo: routeSeo.adhigaramIndex }
    },
    {
        path: 'widgets/daily-kural',
        loadComponent: () => import('./pages/widget-docs/widget-docs.component').then(m => m.WidgetDocsComponent),
        data: { seo: routeSeo.widgetDocs }
    },
    {
        path: 'adhigaram/:id',
        loadComponent: () => import('./pages/adhigaram-detail/adhigaram-detail.component').then(m => m.AdhigaramDetailComponent)
    },
    {
        path: 'kural/:id',
        loadComponent: () => import('./pages/kural-detail/kural-detail.component').then(m => m.KuralDetailComponent)
    },
    {
        path: 'unsubscribe',
        loadComponent: () => import('./pages/unsubscribe/unsubscribe.component').then(m => m.UnsubscribeComponent),
        data: { seo: routeSeo.unsubscribe }
    },
    {
        path: 'pricing',
        loadComponent: () => import('./pages/pricing/pricing.component').then(m => m.PricingComponent),
        data: { seo: routeSeo.pricing }
    },
    {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
        data: { seo: routeSeo.profile },
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
