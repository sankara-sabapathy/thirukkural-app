import { Component, Input, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import { fetchAuthSession } from 'aws-amplify/auth';

@Component({
    selector: 'app-subscription',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatSnackBarModule],
    templateUrl: './subscription.component.html',
    styleUrls: ['./subscription.component.scss']
})
export class SubscriptionComponent implements OnInit {
    @Input() email!: string;
    subscribed = false;
    loading = true;

    constructor(private http: HttpClient, private snack: MatSnackBar, private zone: NgZone) { }

    async ngOnInit() {
        await this.checkSubscriptionStatus();
    }

    async checkSubscriptionStatus() {
        if (!environment.api.baseUrl || environment.api.baseUrl.includes('xxxxxxxx')) {
            this.zone.run(() => this.loading = false);
            return;
        }

        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString();

            if (!token) {
                this.zone.run(() => this.loading = false);
                return;
            }

            const headers = new HttpHeaders({
                'Authorization': token
            });

            const url = environment.api.baseUrl + environment.api.endpoints.profile;

            this.http.get<any>(url, { headers })
                .subscribe({
                    next: (profile) => {
                        this.zone.run(() => {
                            this.subscribed = profile.receiveDailyEmail ?? false;
                            this.loading = false;
                        });
                    },
                    error: (err) => {
                        console.error('Failed to fetch profile:', err);
                        this.zone.run(() => this.loading = false);
                    }
                });
        } catch (err) {
            console.error('Auth session error:', err);
            this.zone.run(() => this.loading = false);
        }
    }

    async subscribe() {
        if (!environment.api.baseUrl || environment.api.baseUrl.includes('xxxxxxxx')) {
            this.snack.open('API not configured. Please deploy backend first.', 'Close', { duration: 3000 });
            return;
        }

        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString();

            if (!token) {
                this.snack.open('You must be logged in to subscribe.', 'Close', { duration: 3000 });
                return;
            }

            const headers = new HttpHeaders({
                'Authorization': token,
                'Content-Type': 'application/json'
            });

            this.http.put(environment.api.baseUrl + environment.api.endpoints.profile,
                { receiveDailyEmail: true },
                { headers }
            ).subscribe({
                next: () => {
                    this.subscribed = true;
                    this.snack.open('Subscribed successfully!', 'Close', { duration: 3000 });
                },
                error: (err) => {
                    console.error(err);
                    this.snack.open('Subscription failed. Please try again.', 'Close', { duration: 3000 });
                }
            });
        } catch (err) {
            console.error('Auth session error', err);
            this.snack.open('Authentication failed.', 'Close', { duration: 3000 });
        }
    }

    async unsubscribe() {
        if (!environment.api.baseUrl || environment.api.baseUrl.includes('xxxxxxxx')) {
            this.snack.open('API not configured. Please deploy backend first.', 'Close', { duration: 3000 });
            return;
        }

        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString();

            if (!token) {
                this.snack.open('You must be logged in to unsubscribe.', 'Close', { duration: 3000 });
                return;
            }

            const headers = new HttpHeaders({
                'Authorization': token,
                'Content-Type': 'application/json'
            });

            this.http.put(environment.api.baseUrl + environment.api.endpoints.profile,
                { receiveDailyEmail: false },
                { headers }
            ).subscribe({
                next: () => {
                    this.subscribed = false;
                    this.snack.open('Unsubscribed successfully.', 'Close', { duration: 3000 });
                },
                error: (err) => {
                    console.error(err);
                    this.snack.open('Unsubscribe failed. Please try again.', 'Close', { duration: 3000 });
                }
            });
        } catch (err) {
            console.error('Auth session error', err);
            this.snack.open('Authentication failed.', 'Close', { duration: 3000 });
        }
    }
}
