import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { AuthService } from '../../services/auth.service';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';

describe('HeaderComponent', () => {
    let component: HeaderComponent;
    let fixture: ComponentFixture<HeaderComponent>;
    let authServiceMock: any;

    beforeEach(async () => {
        authServiceMock = {
            user$: of(null),
            login: vi.fn(),
            logout: vi.fn()
        };

        await TestBed.configureTestingModule({
            imports: [HeaderComponent, MatButtonModule],
            providers: [
                provideRouter([]),
                { provide: AuthService, useValue: authServiceMock }
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
});
