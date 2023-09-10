import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';

const routes: Routes = [

  { path: '', redirectTo: '/jp', pathMatch: 'full'  },
  { path: 'jp', component: AppComponent, title: 'Anime + Manga Dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
