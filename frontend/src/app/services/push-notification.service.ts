import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

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

    /**
     * Get the current notification permission status
     */
    getPermissionStatus(): NotificationPermissionStatus {
        if (!('Notification' in window)) {
            return 'unsupported';
        }
        return Notification.permission as NotificationPermissionStatus;
    }

    /**
     * Check if notifications are blocked by the user
     */
    isBlocked(): boolean {
        return this.getPermissionStatus() === 'denied';
    }

    /**
     * Check if notifications are already granted
     */
    isGranted(): boolean {
        return this.getPermissionStatus() === 'granted';
    }

    async subscribeToNotifications(): Promise<{ success: boolean; message: string }> {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            return {
                success: false,
                message: 'Your browser does not support notifications.'
            };
        }

        // Check if notification permission is blocked
        if (this.isBlocked()) {
            return {
                success: false,
                message: 'Notifications are blocked. Please enable them in your browser settings:\n\n' +
                    '1. Click the lock/info icon in the address bar\n' +
                    '2. Find "Notifications" and set to "Allow"\n' +
                    '3. Refresh the page and try again'
            };
        }

        // Check if service worker is enabled
        if (!this.swPush.isEnabled) {
            return {
                success: false,
                message: 'Push notifications require a secure connection (HTTPS) and service worker support.'
            };
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
            return {
                success: true,
                message: 'You will receive a Thirukkural at 8 AM every day!'
            };
        } catch (err: any) {
            console.error('Could not subscribe to notifications', err);

            // Handle specific error cases
            if (err?.name === 'NotAllowedError') {
                return {
                    success: false,
                    message: 'Notification permission was denied. Please enable notifications in your browser settings.'
                };
            }

            return {
                success: false,
                message: 'Failed to subscribe. Please try again later.'
            };
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
