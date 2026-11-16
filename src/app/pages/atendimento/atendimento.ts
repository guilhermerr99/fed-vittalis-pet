import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { ReaisPipe } from '../../shared/dinheiro';
import { idadeEmTexto, mascaraTelefone, rotuloDaEspecie } from '../../shared/documentos';
import { classeDaSituacao } from '../contratos/contratos.service';
import { mensagemDeErro } from '../login/login';
import { ResumoDoTutor, TutoresService } from '../tutores/tutores.service';
import {
  Atendimento,
  AtendimentoService,
  Ficha,
  ProcedimentoDaFicha,
  classeDaExcecao,
  classeDoEstado,
} from './atendimento.service';

interface Painel {
  tipo: 'concluir' | 'cancelar' | 'excecao';
  atendimento?: Atendimento;
  procedimento?: ProcedimentoDaFicha;
}

/**
 * Atendimento do veterinário. Sem agenda: o cliente chega, o veterinário busca o animal e vê, procedimento por
 * procedimento, o que o plano libera hoje. Autoriza, conclui (só aí o uso desconta do limite) ou pede exceção.
 */
@Component({
  selector: 'app-atendimento',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, ReaisPipe],
  templateUrl: './atendimento.html',
})
export class TelaDeAtendimento implements OnInit {
  private readonly api = inject(AtendimentoService);
  private readonly tutores = inject(TutoresService);
  private readonly rota = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly busca = new FormControl('', { nonNullable: true });
  protected readonly resultados = signal<ResumoDoTutor[] | null>(null);
  protected readonly buscando = signal(false);

  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly salvando = signal(false);

  protected readonly painel = signal<Painel | null>(null);
  protected readonly motivo = new FormControl('', { nonNullable: true });
  protected readonly justificativa = new FormControl('', { nonNullable: true });
  protected readonly dia = new FormControl('', { nonNullable: true });
  protected readonly coparticipacao = signal<'paga' | 'pendente' | null>(null);
  protected readonly invalido = signal(false);

  protected readonly rotuloEspecie = rotuloDaEspecie;
  protected readonly telefone = mascaraTelefone;
  protected readonly classeEstado = classeDoEstado;
  protected readonly classeExcecao = classeDaExcecao;
  protected readonly classeContrato = classeDaSituacao;
  protected readonly idade = (nascimento: string): string => idadeEmTexto(nascimento);
  protected readonly hoje = new Date().toISOString().slice(0, 10);

  /** Procedimentos agrupados por categoria, como a gestão os cadastrou. */
  protected readonly grupos = computed(() => {
    const mapa = new Map<string, ProcedimentoDaFicha[]>();
    for (const p of this.ficha()?.procedimentos ?? []) {
      mapa.set(p.categoria, [...(mapa.get(p.categoria) ?? []), p]);
    }
    return Array.from(mapa, ([categoria, itens]) => ({ categoria, itens }));
  });

  ngOnInit(): void {
    this.busca.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((texto) => {
          if (texto.trim().length < 2) {
            this.buscando.set(false);
            return of(null);
          }
          this.buscando.set(true);
          return this.tutores.buscar(texto, 0).pipe(
            catchError((e: unknown) => {
              this.erro.set(mensagemDeErro(e));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((pagina) => {
        this.buscando.set(false);
        this.resultados.set(pagina ? pagina.itens : null);
      });

    const animal = this.rota.snapshot.queryParamMap.get('animal');
    if (animal) {
      this.escolher(animal);
    }
  }

  // ----- escolher o animal -----

  protected escolher(animalId: string): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.painel.set(null);
    this.carregar(animalId);
  }

  protected trocar(): void {
    this.ficha.set(null);
    this.painel.set(null);
    this.aviso.set(null);
    this.erro.set(null);
    this.resultados.set(null);
    this.busca.setValue('', { emitEvent: false });
  }

  // ----- autorizar, concluir, cancelar -----

  protected autorizar(p: ProcedimentoDaFicha): void {
    const f = this.ficha();
    if (!f) {
      return;
    }
    this.executar(this.api.autorizar(f.animal.id, p.procedimentoId), `${p.nome} autorizado. Conclua o atendimento depois de realizá-lo.`);
  }

  protected abrirConclusao(a: Atendimento): void {
    this.preparar({ tipo: 'concluir', atendimento: a });
    this.coparticipacao.set(null);
  }

  protected abrirCancelamento(a: Atendimento): void {
    this.preparar({ tipo: 'cancelar', atendimento: a });
  }

  protected abrirExcecao(p: ProcedimentoDaFicha): void {
    this.preparar({ tipo: 'excecao', procedimento: p });
    this.dia.setValue(this.hoje);
  }

  protected fechar(): void {
    this.painel.set(null);
    this.invalido.set(false);
  }

  protected confirmar(): void {
    const p = this.painel();
    const f = this.ficha();
    if (!p || !f) {
      return;
    }
    if (p.tipo === 'concluir' && p.atendimento) {
      const precisa = p.atendimento.coparticipacaoCentavos > 0;
      if (precisa && !this.coparticipacao()) {
        this.invalido.set(true);
        return;
      }
      this.executar(
        this.api.concluir(p.atendimento.id, precisa ? this.coparticipacao() === 'paga' : null),
        `${p.atendimento.procedimentoNome} concluído.`,
      );
    } else if (p.tipo === 'cancelar' && p.atendimento) {
      if (!this.motivo.value.trim()) {
        this.invalido.set(true);
        return;
      }
      this.executar(this.api.cancelar(p.atendimento.id, this.motivo.value.trim()), `${p.atendimento.procedimentoNome} cancelado.`);
    } else if (p.tipo === 'excecao' && p.procedimento) {
      if (this.justificativa.value.trim().length < 10) {
        this.invalido.set(true);
        return;
      }
      this.executar(
        this.api.solicitarExcecao(f.animal.id, p.procedimento.procedimentoId, this.justificativa.value.trim(), this.dia.value),
        'Exceção solicitada. A gestão vai analisar e, se aprovar, o procedimento será liberado.',
      );
    }
  }

  protected quitar(a: Atendimento): void {
    this.executar(this.api.quitarCoparticipacao(a.id), `Coparticipação de ${a.procedimentoNome} registrada como paga.`);
  }

  // ----- apoio -----

  private preparar(painel: Painel): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.invalido.set(false);
    this.motivo.setValue('');
    this.justificativa.setValue('');
    this.painel.set(painel);
    // O painel abre acima da tabela; leva a tela até ele para quem clicou lá embaixo.
    setTimeout(() => document.getElementById('painel')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }));
  }

  private executar(chamada: Observable<unknown>, sucesso: string): void {
    this.erro.set(null);
    this.salvando.set(true);
    chamada.subscribe({
      next: () => {
        this.salvando.set(false);
        this.painel.set(null);
        this.aviso.set(sucesso);
        const f = this.ficha();
        if (f) {
          this.carregar(f.animal.id, true);
        }
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
        const f = this.ficha();
        if (f) {
          this.carregar(f.animal.id, true);
        }
      },
    });
  }

  private carregar(animalId: string, manterMensagens = false): void {
    this.carregando.set(!manterMensagens);
    this.api.ficha(animalId).subscribe({
      next: (f) => {
        this.ficha.set(f);
        this.carregando.set(false);
        if (!manterMensagens) {
          this.resultados.set(null);
        }
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}
