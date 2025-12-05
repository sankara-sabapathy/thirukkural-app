import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PushNotificationService } from './push-notification.service';
import { SwPush } from '@angular/service-worker';
import { of } from 'rxjs';

describe('PushNotificationService', () => {
    let service: PushNotificationService;
    let httpMock: HttpTestingController;
    let swPushMock: any;

    beforeEach(() => {
        // Create a mock for SwPush
        swPushMock = {
            isEnabled: true,
            subscription: of(null),
            requestSubscription: vi.fn()
        };

        // Clear localStorage before each test
        localStorage.clear();

        TestBed.configureTestingModule({
            providers: [
                PushNotificationService,
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: SwPush, useValue: swPushMock }
            ]
        });

        service = TestBed.inject(PushNotificationService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
        localStorage.clear();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('isEnabled', () => {
        it('should return true when SwPush is enabled', () => {
            expect(service.isEnabled).toBe(true);
        });

        it('should return false when SwPush is disabled', () => {
            swPushMock.isEnabled = false;
            expect(service.isEnabled).toBe(false);
        });
    });

    describe('isBlocked', () => {
        it('should check notification permission status', () => {
            // This test verifies the method exists and can be called
            const result = service.isBlocked();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('isGranted', () => {
        it('should return a boolean', () => {
            const result = service.isGranted();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('isSubscribed', () => {
        it('should return false when localStorage flag is not set', async () => {
            const result = await service.isSubscribed();
            expect(result).toBe(false);
        });
    });

    describe('unsubscribeFromNotifications', () => {
        it('should clear localStorage on unsubscribe', async () => {
            localStorage.setItem('push_subscribed', 'true');
            swPushMock.subscription = of(null);

            const result = await service.unsubscribeFromNotifications();

            expect(result.success).toBe(true);
            expect(localStorage.getItem('push_subscribed')).toBeNull();
        });

        it('should return success message', async () => {
            swPushMock.subscription = of(null);

            const result = await service.unsubscribeFromNotifications();

            expect(result.success).toBe(true);
            expect(result.message).toContain('disabled');
        });
    });
});
