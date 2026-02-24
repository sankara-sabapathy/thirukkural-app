import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private isDarkModeSubject = new BehaviorSubject<boolean>(false);
  public isDarkMode$: Observable<boolean> = this.isDarkModeSubject.asObservable();

  private readonly THEME_KEY = 'theme-preference';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.initTheme();
    }
  }

  private initTheme() {
    // Check local storage first
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    
    if (savedTheme) {
      this.setTheme(savedTheme === 'dark');
    } else {
      // Fall back to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark);
    }

    // Optional: Listen for system theme changes if not manually set
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.THEME_KEY)) {
        this.setTheme(e.matches);
      }
    });
  }

  public toggleTheme() {
    if (isPlatformBrowser(this.platformId)) {
      this.setTheme(!this.isDarkModeSubject.value);
    }
  }

  private setTheme(isDark: boolean) {
    this.isDarkModeSubject.next(isDark);
    
    if (isPlatformBrowser(this.platformId)) {
      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem(this.THEME_KEY, 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem(this.THEME_KEY, 'light');
      }
    }
  }
}
