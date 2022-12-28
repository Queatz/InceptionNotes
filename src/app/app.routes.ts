import {NgModule} from '@angular/core'
import {RouterModule} from '@angular/router'
import {AppComponent} from './app.component'
import {AcceptInvitationComponent} from './accept-invitation/accept-invitation.component'

@NgModule({
  imports: [
    RouterModule.forRoot([
      {
        path: 'n/:id',
        component: AppComponent
      },
      {
        path: 'invitation/:id',
        component: AcceptInvitationComponent
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
