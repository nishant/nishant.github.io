import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { JpListComponent } from './components/jp-list/jp-list.component';
import { HomeComponent } from './components/home/home.component';

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent, title: 'Dashboard' },
  { path: 'jp', component: JpListComponent, title: 'Anime + Manga Dashboard' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
