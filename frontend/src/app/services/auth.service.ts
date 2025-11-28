import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { getCurrentUser, signInWithRedirect, signOut, fetchUserAttributes } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private userSubject = new BehaviorSubject<any>(null);
    user$ = this.userSubject.asObservable();

    constructor(private zone: NgZone) {
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
        return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    }

    async checkUser() {
        if (this.isLocalhost()) {
            const storedUser = localStorage.getItem('dummy_user');
            if (storedUser) {
                this.zone.run(() => this.userSubject.next(JSON.parse(storedUser)));
            }
            return;
        }

        try {
            const user = await getCurrentUser();
            console.log('Current user:', user);
            const attributes = await fetchUserAttributes();
            console.log('User attributes:', attributes);
            this.zone.run(() => this.userSubject.next({ ...user, attributes }));
        } catch (error) {
            console.error('Check user failed:', error);
            this.zone.run(() => this.userSubject.next(null));
        }
    }

    async login() {
        if (this.isLocalhost()) {
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
        if (this.isLocalhost()) {
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
