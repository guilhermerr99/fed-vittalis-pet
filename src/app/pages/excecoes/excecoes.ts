import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AtendimentoService, Excecao, SITUACOES_DA_EXCECAO, classeDaExcecao } from '../atendimento/atendimento.service';
import { mensagemDeErro } from '../login/login';
import { Pagina } from '../tutores/tutores.service';

/** Relatório das exceções de carência. A gestão aprova ou recusa; quem solicitou não decide sobre a própria. */
@Component({
  selector: 'app-excecoes',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './excecoes.html',
})
export class Excecoes implements OnInit {
  private readonly api = inject(AtendimentoService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly situacoes = SITUACOES_DA_EXCECAO;
  protected readonly situacao = new FormControl('', { nonNullable: true });
  protected readonly motivo = new FormControl('', { nonNullable: true });
  protected readonly dados = signal<Pagina<Excecao> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly pagina = signal(0);
  protected readonly analisando = signal<Excecao | null>(null);
  protected readonly invalido = signal(false);
  protected readonly ehGestao = computed(() => this.auth.perfil() === 'GESTAO');
  protected readonly totalDePaginas = computed(() => {
    const d = this.dados();
    return d ? Math.max(1, Math.ceil(d.total / d.tamanho)) : 1;
  });

  protected readonly classe = classeDaExcecao;

  ngOnInit(): void {
    // A gestão abre direto nas exceções que esperam decisão.
    if (this.ehGestao()) {
      this.situacao.setValue('SOLICITADA', { emitEvent: false });
    }
    this.situacao.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pagina.set(0);
      this.analisando.set(null);
      this.carregar();
    });
    this.carregar();
  }

  protected irPara(delta: number): void {
    this.pagina.update((p) => Math.max(0, Math.min(this.totalDePaginas() - 1, p + delta)));
    this.carregar();
  }

  protected analisar(e: Excecao): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.invalido.set(false);
    this.motivo.setValue('');
    this.analisando.set(e);
  }

  protected decidir(aprovar: boolean): void {
    const e = this.analisando();
    if (!e) {
      return;
    }
    if (!this.motivo.value.trim()) {
      this.invalido.set(true);
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    const chamada = aprovar ? this.api.aprovarExcecao(e.id, this.motivo.value.trim()) : this.api.recusarExcecao(e.id, this.motivo.value.trim());
    chamada.subscribe({
      next: () => {
        this.salvando.set(false);
        this.analisando.set(null);
        this.aviso.set(aprovar ? 'Exceção aprovada. O veterinário já pode autorizar o procedimento.' : 'Exceção recusada.');
        this.carregar();
      },
      error: (erro: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(erro));
      },
    });
  }

  private carregar(): void {
    this.carregando.set(true);
    this.api.excecoes({ situacao: this.situacao.value, pagina: this.pagina() }).subscribe({
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
