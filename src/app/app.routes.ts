import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';

@NgModule({
  imports: [
    RouterModule.forRoot([
        {
            path: 'n/:id',
            component: AppComponent
        },
        {
            path: '**',
            component: AppComponent
        }
     ])
  ],
  exports: [
    RouterModule
  ]
})
export class AppRoutingModule {}
