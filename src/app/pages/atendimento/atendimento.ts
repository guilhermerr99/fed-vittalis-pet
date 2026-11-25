import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, debounce, distinctUntilChanged, forkJoin, map, of, startWith, switchMap, timer } from 'rxjs';
import { ReaisPipe } from '../../shared/dinheiro';
import { idadeEmTexto, mascaraTelefone, rotuloDaEspecie } from '../../shared/documentos';
import { Icone } from '../../shared/icone';
import { Passos } from '../../shared/passos';
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

interface Carencia {
  dias: number;
  nomes: string;
  porCento: number;
  fim: Date;
  cumprida: boolean;
}

const DIA = 24 * 60 * 60 * 1000;

/**
 * Atendimento do veterinário, em quatro telas: 1 Chegada (achar o animal), 2 Conferir (dados, contrato e carências),
 * 3 Autorização (escolher os procedimentos e ver o que o plano libera) e 4 Atendimento (em andamento, concluir,
 * coparticipação). Sem agenda: o cliente chega e o veterinário busca. Só concluir desconta do limite anual.
 */
@Component({
  selector: 'app-atendimento',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, ReaisPipe, Passos, Icone],
  templateUrl: './atendimento.html',
  host: { '(document:keydown.escape)': 'aoApertarEsc()' },
})
export class TelaDeAtendimento implements OnInit {
  private readonly api = inject(AtendimentoService);
  private readonly tutores = inject(TutoresService);
  private readonly rota = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly busca = new FormControl('', { nonNullable: true });
  protected readonly resultados = signal<ResumoDoTutor[] | null>(null);
  protected readonly buscando = signal(false);
  protected readonly total = signal(0);
  protected readonly carregandoMais = signal(false);
  private textoDaBusca = '';
  private paginaAtual = 0;

  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly salvando = signal(false);

  /** 1 Chegada, 2 Conferir, 3 Autorização, 4 Atendimento. */
  protected readonly etapa = signal(1);
  protected readonly passos = ['Chegada', 'Conferir', 'Autorização', 'Atendimento'];
  /** Verdadeiro quando o animal tinha atendimento em aberto e a tela foi direto para o passo 4. */
  protected readonly retomado = signal(false);
  /** Procedimentos marcados na tela de autorização. */
  protected readonly marcados = signal<string[]>([]);

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

  protected readonly sexo = computed(() => {
    const s = this.ficha()?.animal.sexo;
    return s === 'M' ? 'Macho' : s === 'F' ? 'Fêmea' : '';
  });

  /** Procedimentos marcados, na ordem em que o plano os lista. */
  protected readonly escolhidos = computed(() => {
    const ids = this.marcados();
    return (this.ficha()?.procedimentos ?? []).filter((p) => ids.includes(p.procedimentoId));
  });

  /** Filtro de texto da lista de procedimentos (sem diferenciar acento nem maiúscula). */
  protected readonly filtroProcedimento = signal('');
  protected readonly procedimentosVisiveis = computed(() => {
    const texto = this.normalizar(this.filtroProcedimento());
    const todos = this.ficha()?.procedimentos ?? [];
    return texto ? todos.filter((p) => this.normalizar(`${p.nome} ${p.categoria}`).includes(texto)) : todos;
  });

  protected readonly autoriza = computed(() => this.ficha()?.contrato?.autoriza ?? false);

  /** Só autoriza quando há marcados e todos estão liberados. */
  protected readonly podeAutorizar = computed(() => {
    const e = this.escolhidos();
    return this.autoriza() && e.length > 0 && e.every((p) => p.liberado);
  });

  protected readonly foraDoPlano = computed(() => this.escolhidos().filter((p) => !p.liberado).length);

  protected readonly totalAPagar = computed(() =>
    this.escolhidos()
      .filter((p) => p.liberado)
      .reduce((soma, p) => soma + p.coparticipacaoCentavos, 0),
  );

  /** Carências do plano, agrupadas por prazo, com quanto já foi cumprido. */
  protected readonly carencias = computed<Carencia[]>(() => {
    const f = this.ficha();
    const inicio = f?.contrato?.inicioCarencia;
    if (!f || !inicio) {
      return [];
    }
    const corrido = Math.max(0, Math.floor((Date.now() - new Date(inicio + 'T00:00:00').getTime()) / DIA));
    const grupos = new Map<number, string[]>();
    for (const p of f.procedimentos) {
      if (p.coberto && p.carenciaDias != null && p.carenciaDias > 0) {
        grupos.set(p.carenciaDias, [...(grupos.get(p.carenciaDias) ?? []), p.nome]);
      }
    }
    return Array.from(grupos.keys())
      .sort((a, b) => a - b)
      .map((dias) => {
        const nomes = grupos.get(dias) ?? [];
        return {
          dias,
          nomes: nomes.length > 2 ? `${nomes[0]} e mais ${nomes.length - 1}` : nomes.join(', '),
          porCento: Math.min(100, (corrido / dias) * 100),
          fim: new Date(new Date(inicio + 'T00:00:00').getTime() + dias * DIA),
          cumprida: corrido >= dias,
        };
      });
  });

  /** Posição de "hoje" na régua das carências (percentual do maior prazo). */
  protected readonly marcaDeHoje = computed(() => {
    const lista = this.carencias();
    const inicio = this.ficha()?.contrato?.inicioCarencia;
    if (!lista.length || !inicio) {
      return '0%';
    }
    const corrido = Math.max(0, Math.floor((Date.now() - new Date(inicio + 'T00:00:00').getTime()) / DIA));
    return `${Math.min(100, (corrido / lista[lista.length - 1].dias) * 100)}%`;
  });

  protected readonly diasDeContrato = computed(() => {
    const inicio = this.ficha()?.contrato?.inicioCarencia;
    return inicio ? Math.max(0, Math.floor((Date.now() - new Date(inicio + 'T00:00:00').getTime()) / DIA)) : 0;
  });

  /** Concluídos hoje: quando não há mais nada aberto, é o que o atendimento entregou. */
  protected readonly concluidosHoje = computed(() =>
    (this.ficha()?.recentes ?? []).filter((a) => a.situacao === 'CONCLUIDO' && a.data === this.hoje),
  );

  /** Atendimento do dia: o que está aberto, ou, se acabou, o que foi concluído hoje. */
  protected readonly doDia = computed(() => {
    const f = this.ficha();
    return f && f.abertos.length ? f.abertos : this.concluidosHoje();
  });

  protected readonly coparticipacaoDoDia = computed(() => this.doDia().reduce((s, a) => s + a.coparticipacaoCentavos, 0));
  protected readonly pendentesDeCopart = computed(() => this.doDia().filter((a) => a.coparticipacaoPendente));
  /** Coparticipações que ficaram para pagar em atendimentos já concluídos, de qualquer dia. */
  protected readonly pendentesDeCopartDoAnimal = computed(() => (this.ficha()?.recentes ?? []).filter((a) => a.coparticipacaoPendente));
  /** Concluídos hoje que ainda não foram cadastrados à mão no SimplesVet. */
  protected readonly pendentesSimplesVet = computed(() => this.concluidosHoje().filter((a) => !a.lancadoSimplesVet));
  /** Concluídos em dias anteriores que ficaram sem cadastro no SimplesVet: o aviso não se perde se alguém esquece. */
  protected readonly pendentesSimplesVetAnteriores = computed(() =>
    (this.ficha()?.recentes ?? []).filter((a) => a.situacao === 'CONCLUIDO' && !a.lancadoSimplesVet && a.data !== this.hoje),
  );
  /** Quem confirmou o cadastro de hoje no SimplesVet, para mostrar depois do botão. */
  protected readonly confirmadoNoSimplesVet = computed(() => this.concluidosHoje().find((a) => a.lancadoSimplesVet) ?? null);
  protected readonly encerrado = computed(() => !!this.ficha() && !this.ficha()!.abertos.length && this.concluidosHoje().length > 0);

  ngOnInit(): void {
    // A lista já aparece ao abrir a tela (todos os tutores, mais recentes primeiro) e vai filtrando a cada letra.
    this.busca.valueChanges
      .pipe(
        startWith(''),
        map((texto) => texto.trim()),
        debounce((texto) => timer(texto ? 250 : 0)),
        distinctUntilChanged(),
        switchMap((texto) => {
          this.buscando.set(true);
          this.textoDaBusca = texto;
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
        this.paginaAtual = 0;
        this.total.set(pagina?.total ?? 0);
        this.resultados.set(pagina ? pagina.itens : null);
      });

    const animal = this.rota.snapshot.queryParamMap.get('animal');
    if (animal) {
      this.escolher(animal);
    }
  }

  // ----- 1. chegada -----

  protected escolher(animalId: string): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.painel.set(null);
    this.marcados.set([]);
    this.retomado.set(false);
    this.carregar(animalId, false, true, true);
  }

  protected verMais(): void {
    this.carregandoMais.set(true);
    this.tutores.buscar(this.textoDaBusca, this.paginaAtual + 1).subscribe({
      next: (pagina) => {
        this.paginaAtual = pagina.pagina;
        this.resultados.update((atual) => [...(atual ?? []), ...pagina.itens]);
        this.carregandoMais.set(false);
      },
      error: (e: unknown) => {
        this.carregandoMais.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected trocar(): void {
    this.ficha.set(null);
    this.painel.set(null);
    this.marcados.set([]);
    this.retomado.set(false);
    this.aviso.set(null);
    this.erro.set(null);
    this.etapa.set(1);
    // O texto digitado continua valendo: quem volta à lista encontra o filtro como deixou.
  }

  // ----- navegação entre as telas -----

  protected voltar(): void {
    this.erro.set(null);
    this.painel.set(null);
    if (this.etapa() <= 2) {
      this.trocar();
    } else {
      this.etapa.set(this.etapa() - 1);
    }
  }

  protected irParaProcedimentos(): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.filtroProcedimento.set('');
    this.etapa.set(3);
  }

  // ----- 3. autorização -----

  protected alternar(p: ProcedimentoDaFicha): void {
    this.marcados.update((ids) =>
      ids.includes(p.procedimentoId) ? ids.filter((id) => id !== p.procedimentoId) : [...ids, p.procedimentoId],
    );
  }

  protected filtrarProcedimentos(evento: Event): void {
    this.filtroProcedimento.set((evento.target as HTMLInputElement).value);
  }

  private normalizar(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  protected marcado(p: ProcedimentoDaFicha): boolean {
    return this.marcados().includes(p.procedimentoId);
  }

  protected autorizarEIniciar(): void {
    const f = this.ficha();
    if (!f || !this.podeAutorizar()) {
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    forkJoin(this.escolhidos().map((p) => this.api.autorizar(f.animal.id, p.procedimentoId))).subscribe({
      next: () => {
        this.salvando.set(false);
        this.marcados.set([]);
        this.aviso.set('Atendimento iniciado. Conclua cada procedimento depois de realizá-lo.');
        this.carregar(f.animal.id, true, true);
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
        this.carregar(f.animal.id, true);
      },
    });
  }

  protected abrirExcecao(p: ProcedimentoDaFicha): void {
    this.preparar({ tipo: 'excecao', procedimento: p });
    this.dia.setValue(this.hoje);
  }

  // ----- 4. atendimento -----

  protected abrirConclusao(a: Atendimento): void {
    this.preparar({ tipo: 'concluir', atendimento: a });
    this.coparticipacao.set(null);
  }

  protected abrirCancelamento(a: Atendimento): void {
    this.preparar({ tipo: 'cancelar', atendimento: a });
  }

  protected fechar(): void {
    this.painel.set(null);
    this.invalido.set(false);
  }

  /** Clicar fora da janela fecha, a não ser que a ação esteja sendo salva. */
  protected fundoClicado(evento: Event): void {
    if (evento.target === evento.currentTarget && !this.salvando()) {
      this.fechar();
    }
  }

  protected aoApertarEsc(): void {
    if (this.painel() && !this.salvando()) {
      this.fechar();
    }
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

  /** "Cadastrei": a pessoa já lançou o atendimento no SimplesVet. Só registra quem confirmou e quando. */
  protected cadastrei(lista: Atendimento[]): void {
    if (!lista.length) {
      return;
    }
    this.executar(
      forkJoin(lista.map((a) => this.api.lancarNoSimplesVet(a.id))),
      lista.length > 1 ? 'Atendimentos marcados como cadastrados no SimplesVet.' : 'Atendimento marcado como cadastrado no SimplesVet.',
    );
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
    // A janela abre sobre a tela: leva o foco para o primeiro campo (ou para o botão principal), para o teclado já valer.
    setTimeout(() => document.querySelector<HTMLElement>('.modal textarea, .modal input, .modal .btn-primary, .modal .btn-danger')?.focus());
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

  /**
   * Carrega a ficha. Ao escolher o animal (`navegar`), vai para Conferir, ou direto para Atendimento quando já há
   * procedimento autorizado em aberto; ao recarregar depois de uma ação, só atualiza a tela em que está.
   */
  private carregar(animalId: string, manterMensagens = false, navegar = false, retomada = false): void {
    this.carregando.set(!manterMensagens);
    this.api.ficha(animalId).subscribe({
      next: (f) => {
        this.ficha.set(f);
        this.carregando.set(false);
        if (navegar) {
          this.etapa.set(f.abertos.length ? 4 : 2);
          // Só é "retomada" quando a pessoa abriu um animal que já tinha algo em andamento, não quando acabou de autorizar.
          this.retomado.set(retomada && f.abertos.length > 0);
        }
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}
