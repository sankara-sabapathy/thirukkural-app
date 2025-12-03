import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { PwaInstallBannerComponent } from './components/pwa-install-banner/pwa-install-banner.component';

@Component({ selector: 'app-header', standalone: true, template: '' })
class MockHeaderComponent { }

@Component({ selector: 'app-footer', standalone: true, template: '' })
class MockFooterComponent { }

@Component({ selector: 'app-pwa-install-banner', standalone: true, template: '' })
class MockPwaInstallBannerComponent { }

describe('AppComponent', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AppComponent],
            providers: [provideRouter([])]
        })
            .overrideComponent(AppComponent, {
                remove: { imports: [HeaderComponent, FooterComponent, PwaInstallBannerComponent] },
                add: { imports: [MockHeaderComponent, MockFooterComponent, MockPwaInstallBannerComponent] }
            })
            .compileComponents();
    });

    it('should create the app', () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });
});
