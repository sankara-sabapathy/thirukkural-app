import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { getCurrentUser, signInWithRedirect, signOut, fetchUserAttributes } from 'aws-amplify/auth';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private userSubject = new BehaviorSubject<any>(null);
    user$ = this.userSubject.asObservable();

    constructor() {
        this.checkUser();
    }

    private isLocalhost(): boolean {
        return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    }

    async checkUser() {
        if (this.isLocalhost()) {
            const storedUser = localStorage.getItem('dummy_user');
            if (storedUser) {
                this.userSubject.next(JSON.parse(storedUser));
            }
            return;
        }

        try {
            const user = await getCurrentUser();
            const attributes = await fetchUserAttributes();
            this.userSubject.next({ ...user, attributes });
        } catch {
            this.userSubject.next(null);
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
            this.userSubject.next(dummyUser);
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
            this.userSubject.next(null);
            return;
        }

        try {
            await signOut();
            this.userSubject.next(null);
        } catch (e) {
            console.error('Logout failed', e);
        }
    }
}
