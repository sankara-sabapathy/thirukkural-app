import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TermsComponent } from './terms.component';

describe('TermsComponent', () => {
    let component: TermsComponent;
    let fixture: ComponentFixture<TermsComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TermsComponent]
        })
            .compileComponents();

        fixture = TestBed.createComponent(TermsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render title', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('h1')?.textContent).toContain('Terms of Service');
    });

    it('should not have header or footer tags', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('app-header')).toBeNull();
        expect(compiled.querySelector('app-footer')).toBeNull();
    });
});
