import {NgModule} from '@angular/core'
import {RouterModule} from '@angular/router'
import {AppComponent} from './app.component'

@NgModule({
  imports: [
    RouterModule.forRoot([
      {
        path: 'n/:id',
        component: AppComponent
      },
      {
        path: 'connect/:id',
        component: AppComponent
      },
      {
        path: '',
        pathMatch: 'full',
        component: AppComponent
      },
      {
        path: '**',
        redirectTo: ''
      }
    ], {scrollPositionRestoration: 'enabled'})
  ],
  exports: [
    RouterModule
  ]
})
export class AppRoutingModule {
}
