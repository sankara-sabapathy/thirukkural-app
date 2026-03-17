import 'zone.js/node';
import { BootstrapContext } from '@angular/platform-browser';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { serverAppConfig } from './app/app.config';

function bootstrapServerApplication(context: BootstrapContext) {
  return bootstrapApplication(AppComponent, serverAppConfig, context);
}

export default bootstrapServerApplication;
