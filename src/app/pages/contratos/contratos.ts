import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ReaisPipe } from '../../shared/dinheiro';
import { rotuloDaEspecie } from '../../shared/documentos';
import { Icone } from '../../shared/icone';
import { mensagemDeErro } from '../login/login';
import { Pagina } from '../tutores/tutores.service';
import { Contrato, ContratosService, SITUACOES, classeDaSituacao } from './contratos.service';

@Component({
  selector: 'app-contratos',
  imports: [ReactiveFormsModule, RouterLink, Icone, ReaisPipe],
  templateUrl: './contratos.html',
})
export class Contratos implements OnInit {
  private readonly api = inject(ContratosService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly situacoes = SITUACOES;
  protected readonly busca = new FormControl('', { nonNullable: true });
  protected readonly situacao = new FormControl('', { nonNullable: true });
  protected readonly dados = signal<Pagina<Contrato> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly pagina = signal(0);
  protected readonly totalDePaginas = computed(() => {
    const d = this.dados();
    return d ? Math.max(1, Math.ceil(d.total / d.tamanho)) : 1;
  });

  protected readonly classe = classeDaSituacao;
  protected readonly especie = rotuloDaEspecie;

  ngOnInit(): void {
    this.busca.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.filtrar());
    this.situacao.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.filtrar());
    this.carregar();
  }

  protected irPara(delta: number): void {
    this.pagina.update((p) => Math.max(0, Math.min(this.totalDePaginas() - 1, p + delta)));
    this.carregar();
  }

  private filtrar(): void {
    this.pagina.set(0);
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);
    this.api.listar({ situacao: this.situacao.value, busca: this.busca.value, pagina: this.pagina() }).subscribe({
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
