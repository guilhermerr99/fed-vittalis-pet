import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { mensagemDeErro } from '../login/login';
import { TutorForm } from './tutor-form';
import { NovoTutor, TutoresService } from './tutores.service';

@Component({
  selector: 'app-tutor-novo',
  imports: [RouterLink, TutorForm],
  templateUrl: './tutor-novo.html',
})
export class TutorNovo {
  private readonly api = inject(TutoresService);
  private readonly router = inject(Router);

  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected salvar(dados: NovoTutor): void {
    this.erro.set(null);
    this.salvando.set(true);
    this.api.criar(dados).subscribe({
      next: (t) => void this.router.navigate(['/tutores', t.id], { queryParams: { novo: 1 } }),
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected cancelar(): void {
    void this.router.navigate(['/tutores']);
  }
}
