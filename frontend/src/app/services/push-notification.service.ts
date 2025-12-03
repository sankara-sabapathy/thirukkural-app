import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
    providedIn: 'root'
})
export class PushNotificationService {
    private readonly VAPID_PUBLIC_KEY = environment.vapidPublicKey;
    private readonly API_URL = environment.api.baseUrl + environment.api.endpoints.subscribe;

    constructor(
        private swPush: SwPush,
        private http: HttpClient
    ) { }

    get isEnabled(): boolean {
        return this.swPush.isEnabled;
    }

    async subscribeToNotifications(): Promise<void> {
        if (!this.swPush.isEnabled) {
            console.warn('Service Worker is not enabled');
            return;
        }

        try {
            const sub = await this.swPush.requestSubscription({
                serverPublicKey: this.VAPID_PUBLIC_KEY
            });

            const deviceId = this.getDeviceId();

            await firstValueFrom(this.http.post(this.API_URL, {
                subscription: sub,
                deviceId: deviceId
            }));

            console.log('Notification subscription sent to server');
        } catch (err) {
            console.error('Could not subscribe to notifications', err);
            throw err;
        }
    }

    private getDeviceId(): string {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = uuidv4();
            localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
    }
}
