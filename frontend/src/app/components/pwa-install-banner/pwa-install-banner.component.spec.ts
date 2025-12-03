import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PwaInstallBannerComponent } from './pwa-install-banner.component';
import { PwaService } from '../../services/pwa.service';
import { of } from 'rxjs';

describe('PwaInstallBannerComponent', () => {
    let component: PwaInstallBannerComponent;
    let fixture: ComponentFixture<PwaInstallBannerComponent>;
    let pwaServiceMock: any;

    beforeEach(async () => {
        pwaServiceMock = {
            showInstallBanner$: of(true),
            installPwa: vi.fn(),
            dismissBanner: vi.fn()
        };

        await TestBed.configureTestingModule({
            imports: [PwaInstallBannerComponent],
            providers: [
                { provide: PwaService, useValue: pwaServiceMock }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(PwaInstallBannerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should call installPwa on install', () => {
        component.install();
        expect(pwaServiceMock.installPwa).toHaveBeenCalled();
    });

    it('should call dismissBanner on dismiss', () => {
        component.dismiss();
        expect(pwaServiceMock.dismissBanner).toHaveBeenCalled();
    });
});
