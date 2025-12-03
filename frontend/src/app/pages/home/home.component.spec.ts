import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomeComponent } from './home.component';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { SubscriptionComponent } from '../../components/subscription/subscription.component';
import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { SwPush } from '@angular/service-worker';
import { PushNotificationService } from '../../services/push-notification.service';

@Component({
    selector: 'app-subscription',
    standalone: true,
    template: ''
})
class MockSubscriptionComponent { }

describe('HomeComponent', () => {
    let component: HomeComponent;
    let fixture: ComponentFixture<HomeComponent>;
    let authServiceMock: any;
    let apiServiceMock: any;
    let snackBarMock: any;
    let router: Router;
    let swPushMock: any;
    let pushServiceMock: any;

    beforeEach(async () => {
        authServiceMock = { user$: of(null) };
        apiServiceMock = { sendSampleEmail: vi.fn().mockReturnValue(of({})) };
        snackBarMock = { open: vi.fn() };
        swPushMock = { isEnabled: true, subscription: of(null) };
        pushServiceMock = { subscribeToNotifications: vi.fn().mockResolvedValue(true) };

        await TestBed.configureTestingModule({
            imports: [HomeComponent, FormsModule, BrowserAnimationsModule],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: authServiceMock },
                { provide: ApiService, useValue: apiServiceMock },
                { provide: MatSnackBar, useValue: snackBarMock },
                { provide: SwPush, useValue: swPushMock },
                { provide: PushNotificationService, useValue: pushServiceMock }
            ]
        })
            .overrideComponent(HomeComponent, {
                remove: { imports: [SubscriptionComponent, MatSnackBarModule] },
                add: { imports: [MockSubscriptionComponent] }
            })
            .compileComponents();

        fixture = TestBed.createComponent(HomeComponent);
        component = fixture.componentInstance;
        router = TestBed.inject(Router);
        // Mock navigate on the injected router instance
        vi.spyOn(router, 'navigate');
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should validate email correctly', () => {
        component.sampleEmail = 'invalid-email';
        component.sendSampleEmail();
        expect(snackBarMock.open).toHaveBeenCalled();

        component.sampleEmail = 'test@example.com';
        component.sendSampleEmail();
        expect(apiServiceMock.sendSampleEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should navigate to random kural', () => {
        component.goToRandomKural();
        expect(router.navigate).toHaveBeenCalledWith(['/kural', expect.any(Number)]);
    });

    it('should subscribe to push notifications', async () => {
        await component.subscribeToPush();
        expect(pushServiceMock.subscribeToNotifications).toHaveBeenCalled();
        expect(snackBarMock.open).toHaveBeenCalledWith(
            'Success! You will receive a Thirukkural at 8 AM everyday.',
            'Close',
            expect.any(Object)
        );
    });
});
