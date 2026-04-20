import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { getCurrentUser, signInWithRedirect, signOut, fetchUserAttributes } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private userSubject = new BehaviorSubject<any>(null);
    private authResolvedSubject = new BehaviorSubject<boolean>(false);
    user$ = this.userSubject.asObservable();
    isAuthenticated$ = this.userSubject.asObservable().pipe(map(user => !!user));
    authResolved$ = this.authResolvedSubject.asObservable().pipe(distinctUntilChanged());
    canUseProtectedApi$ = this.userSubject.asObservable().pipe(
        map(user => !!user && this.hasRealProtectedApiAccess()),
        distinctUntilChanged()
    );
    private readonly isBrowser: boolean;

    constructor(
        private zone: NgZone,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);

        if (!this.isBrowser) {
            this.authResolvedSubject.next(true);
            return;
        }

        // Listen for auth events
        Hub.listen('auth', ({ payload }) => {
            switch (payload.event) {
                case 'signedIn':
                    this.checkUser();
                    break;
                case 'signedOut':
                    this.zone.run(() => {
                        this.userSubject.next(null);
                        this.authResolvedSubject.next(true);
                    });
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

    private hasRealProtectedApiAccess(): boolean {
        if (!this.isBrowser) {
            return false;
        }

        return !this.isLocalhost() || !!localStorage.getItem('real_auth');
    }

    canUseProtectedApi(): boolean {
        return !!this.userSubject.value && this.hasRealProtectedApiAccess();
    }

    async checkUser() {
        if (!this.isBrowser) {
            this.authResolvedSubject.next(true);
            this.userSubject.next(null);
            return;
        }

        this.zone.run(() => this.authResolvedSubject.next(false));

        // Allow real auth on localhost if 'real_auth' is set in localStorage
        if (this.isLocalhost() && !localStorage.getItem('real_auth')) {
            const storedUser = localStorage.getItem('dummy_user');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    this.zone.run(() => {
                        this.userSubject.next(parsedUser);
                        this.authResolvedSubject.next(true);
                    });
                    return;
                } catch (error) {
                    console.warn('Failed to parse localhost dummy user. Clearing stored auth state.', error);
                    localStorage.removeItem('dummy_user');
                    this.zone.run(() => {
                        this.userSubject.next(null);
                        this.authResolvedSubject.next(true);
                    });
                    return;
                }
            }

            this.zone.run(() => {
                this.userSubject.next(null);
                this.authResolvedSubject.next(true);
            });
            return;
        }

        try {
            const user = await getCurrentUser();
            const attributes = await fetchUserAttributes();
            this.zone.run(() => {
                this.userSubject.next({ ...user, attributes });
                this.authResolvedSubject.next(true);
            });
        } catch (error: any) {
            // If the error is simply that the user is not signed in, we don't need to log it as an error
            if (error?.name === 'UserUnAuthenticatedException' || error?.toString().includes('not authenticated')) {
                console.log('User is not signed in.');
            } else {
                console.error('Check user failed:', error);
            }
            this.zone.run(() => {
                this.userSubject.next(null);
                this.authResolvedSubject.next(true);
            });
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
            this.zone.run(() => {
                this.userSubject.next(null);
                this.authResolvedSubject.next(true);
            });
            return;
        }

        try {
            await signOut();
            this.zone.run(() => {
                this.userSubject.next(null);
                this.authResolvedSubject.next(true);
            });
        } catch (e) {
            console.error('Logout failed', e);
        }
    }
}
