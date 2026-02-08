import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HeaderComponent } from './header.component';
import { AuthService } from '../../services/auth.service';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { PushNotificationService } from '../../services/push-notification.service';
import { PwaService } from '../../services/pwa.service';

describe('HeaderComponent', () => {
    let component: HeaderComponent;
    let fixture: ComponentFixture<HeaderComponent>;
    let authServiceMock: any;
    let pushServiceMock: any;
    let pwaServiceMock: any;

    beforeEach(async () => {
        authServiceMock = {
            user$: of(null),
            login: vi.fn(),
            logout: vi.fn()
        };
        pushServiceMock = { subscribeToNotifications: vi.fn().mockResolvedValue(true) };
        pwaServiceMock = { showInstallBanner$: of(false), installPwa: vi.fn() };

        await TestBed.configureTestingModule({
            imports: [HeaderComponent, MatButtonModule, NoopAnimationsModule],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: authServiceMock },
                { provide: PushNotificationService, useValue: pushServiceMock },
                { provide: PwaService, useValue: pwaServiceMock }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(HeaderComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should toggle mobile menu', () => {
        expect(component.isMobileMenuOpen).toBe(false);
        component.toggleMobileMenu();
        expect(component.isMobileMenuOpen).toBe(true);
        component.toggleMobileMenu();
        expect(component.isMobileMenuOpen).toBe(false);
    });

    it('should close mobile menu', () => {
        component.isMobileMenuOpen = true;
        component.closeMobileMenu();
        expect(component.isMobileMenuOpen).toBe(false);
    });

    it('should call login on authService', () => {
        component.login();
        expect(authServiceMock.login).toHaveBeenCalled();
    });

    it('should call logout on authService', () => {
        component.logout();
        expect(authServiceMock.logout).toHaveBeenCalled();
    });

    it('should call installPwa on pwaService', () => {
        component.installPwa();
        expect(pwaServiceMock.installPwa).toHaveBeenCalled();
    });

    it('should subscribe to notifications', async () => {
        // Mock alert since it's used in component
        vi.spyOn(window, 'alert').mockImplementation(() => { });
        await component.subscribeToNotifications();
        expect(pushServiceMock.subscribeToNotifications).toHaveBeenCalled();
    });
});
