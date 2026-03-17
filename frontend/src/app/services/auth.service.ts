import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { getCurrentUser, signInWithRedirect, signOut, fetchUserAttributes } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private userSubject = new BehaviorSubject<any>(null);
    user$ = this.userSubject.asObservable();
    isAuthenticated$ = this.userSubject.asObservable().pipe(map(user => !!user));
    private readonly isBrowser: boolean;

    constructor(
        private zone: NgZone,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);

        if (!this.isBrowser) {
            return;
        }

        // Listen for auth events
        Hub.listen('auth', ({ payload }) => {
            switch (payload.event) {
                case 'signedIn':
                    this.checkUser();
                    break;
                case 'signedOut':
                    this.zone.run(() => this.userSubject.next(null));
                    break;
            }
        });

        this.checkUser();
    }

    private isLocalhost(): boolean {
        if (!this.isBrowser) {
            return false;
        }
        return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    }

    async checkUser() {
        if (!this.isBrowser) {
            this.userSubject.next(null);
            return;
        }

        // Allow real auth on localhost if 'real_auth' is set in localStorage
        if (this.isLocalhost() && !localStorage.getItem('real_auth')) {
            const storedUser = localStorage.getItem('dummy_user');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    this.zone.run(() => this.userSubject.next(parsedUser));
                } catch (error) {
                    console.warn('Failed to parse localhost dummy user. Clearing stored auth state.', error);
                    localStorage.removeItem('dummy_user');
                    this.zone.run(() => this.userSubject.next(null));
                }
            }
            return;
        }

        try {
            const user = await getCurrentUser();
            console.log('Current user:', user);
            const attributes = await fetchUserAttributes();
            console.log('User attributes:', attributes);
            this.zone.run(() => this.userSubject.next({ ...user, attributes }));
        } catch (error: any) {
            // If the error is simply that the user is not signed in, we don't need to log it as an error
            if (error?.name === 'UserUnAuthenticatedException' || error?.toString().includes('not authenticated')) {
                console.log('User is not signed in.');
            } else {
                console.error('Check user failed:', error);
            }
            this.zone.run(() => this.userSubject.next(null));
        }
    }

    async login() {
        if (!this.isBrowser) {
            return;
        }

        if (this.isLocalhost() && !localStorage.getItem('real_auth')) {
            const dummyUser = {
                username: 'dummy_user',
                attributes: {
                    email: 'test@localhost.com',
                    name: 'Test User',
                    picture: 'https://ui-avatars.com/api/?name=Test+User&background=random'
                }
            };
            localStorage.setItem('dummy_user', JSON.stringify(dummyUser));
            this.zone.run(() => this.userSubject.next(dummyUser));
            return;
        }

        try {
            await signInWithRedirect({ provider: 'Google' });
        } catch (e) {
            console.error('Login failed', e);
        }
    }

    async logout() {
        if (!this.isBrowser) {
            return;
        }

        if (this.isLocalhost() && !localStorage.getItem('real_auth')) {
            localStorage.removeItem('dummy_user');
            this.zone.run(() => this.userSubject.next(null));
            return;
        }

        try {
            await signOut();
            this.zone.run(() => this.userSubject.next(null));
        } catch (e) {
            console.error('Logout failed', e);
        }
    }
}
