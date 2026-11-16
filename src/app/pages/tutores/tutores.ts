import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Icone } from '../../shared/icone';
import { mascaraTelefone, rotuloDaEspecie } from '../../shared/documentos';
import { mensagemDeErro } from '../login/login';
import { Pagina, ResumoDoTutor, TutoresService } from './tutores.service';

@Component({
  selector: 'app-tutores',
  imports: [ReactiveFormsModule, RouterLink, Icone],
  templateUrl: './tutores.html',
})
export class Tutores implements OnInit {
  private readonly api = inject(TutoresService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly busca = new FormControl('', { nonNullable: true });
  protected readonly dados = signal<Pagina<ResumoDoTutor> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly pagina = signal(0);
  protected readonly totalDePaginas = computed(() => {
    const d = this.dados();
    return d ? Math.max(1, Math.ceil(d.total / d.tamanho)) : 1;
  });

  protected readonly telefone = mascaraTelefone;
  protected readonly especie = rotuloDaEspecie;

  ngOnInit(): void {
    this.busca.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pagina.set(0);
        this.carregar();
      });
    this.carregar();
  }

  protected irPara(delta: number): void {
    this.pagina.update((p) => Math.max(0, Math.min(this.totalDePaginas() - 1, p + delta)));
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);
    this.api.buscar(this.busca.value, this.pagina()).subscribe({
      next: (d) => {
        this.dados.set(d);
        this.carregando.set(false);
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}
