import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
    let component: PrivacyComponent;
    let fixture: ComponentFixture<PrivacyComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PrivacyComponent]
        })
            .compileComponents();

        fixture = TestBed.createComponent(PrivacyComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render title', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('h1')?.textContent).toContain('Privacy Policy');
    });

    it('should not have header or footer tags', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('app-header')).toBeNull();
        expect(compiled.querySelector('app-footer')).toBeNull();
    });
});
