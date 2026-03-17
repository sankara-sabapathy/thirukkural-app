import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimations, provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideServerRendering } from '@angular/platform-server';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { withInterceptors } from '@angular/common/http';

type AppRuntimeOptions = {
  enableHydration?: boolean;
  enableServerRendering?: boolean;
  enableServiceWorker?: boolean;
  useNoopAnimations?: boolean;
};

function createAppConfig(options: AppRuntimeOptions = {}): ApplicationConfig {
  const providers: NonNullable<ApplicationConfig['providers']> = [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({
      scrollPositionRestoration: 'top',
      anchorScrolling: 'enabled'
    })),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    options.useNoopAnimations ? provideNoopAnimations() : provideAnimations()
  ];

  if (options.enableHydration) {
    providers.push(provideClientHydration(withEventReplay()));
  }

  if (options.enableServerRendering) {
    providers.push(provideServerRendering());
  }

  if (options.enableServiceWorker) {
    providers.push(provideServiceWorker('ngsw-worker.js', {
      enabled: true,
      registrationStrategy: 'registerWhenStable:30000'
    }));
  }

  return { providers };
}

const isBrowserRuntime = typeof window !== 'undefined';

export const appConfig = createAppConfig({
  enableHydration: true,
  enableServiceWorker: isBrowserRuntime
});

export const serverAppConfig = createAppConfig({
  enableHydration: true,
  enableServerRendering: true,
  useNoopAnimations: true
});
