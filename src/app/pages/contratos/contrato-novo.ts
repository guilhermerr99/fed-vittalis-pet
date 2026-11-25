import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, catchError, distinctUntilChanged, map, of, switchMap, tap, timer } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ReaisPipe } from '../../shared/dinheiro';
import { cpfValido, idadeEmTexto, mascaraCpf, mascaraTelefone, rotuloDaEspecie, soDigitos } from '../../shared/documentos';
import { Icone } from '../../shared/icone';
import { Passos } from '../../shared/passos';
import { abrirPdf } from '../../shared/pdf';
import { ConfiguracoesService, Plano } from '../configuracoes/configuracoes.service';
import { mensagemDeErro } from '../login/login';
import { AnimalForm } from '../tutores/animal-form';
import { cpf as validarCpf, email as validarEmail, nomeCompleto as validarNome, telefone as validarTelefone } from '../tutores/tutor-form';
import { Animal, DadosDoAnimal, NovoTutor, ResumoDoTutor, Tutor, TutoresService } from '../tutores/tutores.service';
import { Assinatura, Cobranca, Contrato, ContratosService, Gateway, Simulacao } from './contratos.service';

interface Carencia {
  dias: number;
  nomes: string;
}

/**
 * Nova contratação em seis telas: Tutor, Animais, Plano, Revisão, Assinatura e Pagamento. O valor vem do servidor
 * (plano e Parâmetros) e nunca é digitado. O contrato só nasce ao enviar para assinatura; dali em diante ele segue o
 * ciclo de sempre (assinatura, primeira cobrança, ativação) e a tela só conduz.
 */
@Component({
  selector: 'app-contrato-novo',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, AnimalForm, ReaisPipe, Passos, Icone],
  templateUrl: './contrato-novo.html',
})
export class ContratoNovo implements OnInit {
  private readonly tutores = inject(TutoresService);
  private readonly config = inject(ConfiguracoesService);
  private readonly contratos = inject(ContratosService);
  private readonly auth = inject(AuthService);
  private readonly rota = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** 1 Tutor, 2 Animais, 3 Plano, 4 Revisão, 5 Assinatura, 6 Pagamento, 7 contrato ativo. */
  protected readonly etapa = signal(1);
  protected readonly passos = ['Tutor', 'Animais', 'Plano', 'Revisão', 'Assinatura', 'Pagamento'];

  private readonly fb = inject(FormBuilder);

  /** Dados do tutor: a primeira tela é este formulário. Um CPF já cadastrado usa o tutor que existe. */
  protected readonly formTutor = this.fb.nonNullable.group({
    cpf: ['', [Validators.required, validarCpf]],
    nome: ['', [Validators.required, validarNome]],
    telefone: ['', [Validators.required, validarTelefone]],
    email: ['', [validarEmail]],
    aviso: [false],
  });
  protected readonly situacaoCpf = signal<'verificando' | 'livre' | 'existente' | null>(null);
  protected readonly tutorDoCpf = signal<ResumoDoTutor | null>(null);
  protected readonly tentouContinuar = signal(false);

  protected readonly tutor = signal<Tutor | null>(null);
  protected readonly cadastrandoAnimal = signal(false);

  protected readonly especies = signal<string[]>([]);
  protected readonly planos = signal<Plano[]>([]);
  protected readonly selecionados = signal<string[]>([]);
  /** Animais que já estão em contrato aberto: id do animal → número do contrato. */
  protected readonly emContrato = signal<Map<string, string>>(new Map());
  protected readonly planoId = signal<string | null>(null);
  protected readonly simulacao = signal<Simulacao | null>(null);
  protected readonly carencias = signal<Carencia[]>([]);

  /** O contrato criado ao enviar para assinatura. */
  protected readonly contrato = signal<Contrato | null>(null);
  protected readonly assinatura = signal<Assinatura | null>(null);
  protected readonly cobranca = signal<Cobranca | null>(null);
  protected readonly gateway = signal<Gateway | null>(null);

  protected readonly linkCopiado = signal(false);
  private acompanhamento: Subscription | null = null;

  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly rotuloEspecie = rotuloDaEspecie;
  protected readonly formatarTelefone = mascaraTelefone;
  protected readonly idade = (a: Animal): string => idadeEmTexto(a.nascimento);
  protected readonly ehGestao = computed(() => this.auth.perfil() === 'GESTAO');
  protected readonly primeiroNome = computed(() => (this.tutor()?.nome ?? '').split(' ')[0]);

  /** Animais marcados, na ordem em que foram marcados: o primeiro paga o plano inteiro. */
  protected readonly escolhidos = computed(() => {
    const animais = this.tutor()?.animais ?? [];
    return this.selecionados()
      .map((id) => animais.find((a) => a.id === id))
      .filter((a): a is Animal => !!a);
  });

  /** Planos que valem para todos os animais marcados: plano de uma espécie só não cobre animal de outra. */
  protected readonly planosDisponiveis = computed(() =>
    this.planos().filter((p) => !p.especie || this.escolhidos().every((a) => a.especie === p.especie)),
  );

  protected readonly plano = computed(() => this.planosDisponiveis().find((p) => p.id === this.planoId()) ?? null);

  /** A partir da criação do contrato, os dados dos primeiros passos não mudam mais. */
  protected readonly travado = computed(() => this.contrato() !== null);

  ngOnInit(): void {
    this.config.parametros().subscribe({ next: (p) => this.especies.set(p.especiesAceitas) });
    this.config.planos().subscribe({
      next: (lista) => {
        const ativos = lista.filter((p) => p.ativo);
        this.planos.set(ativos);
        if (ativos.length === 1) {
          this.planoId.set(ativos[0].id);
        }
      },
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });

    // Com um CPF válido, confere se o tutor já existe: se existe, ele é usado e os outros campos ficam travados.
    this.formTutor.controls.cpf.valueChanges
      .pipe(
        map((v) => soDigitos(v)),
        distinctUntilChanged(),
        switchMap((d) => {
          if (d.length !== 11 || !cpfValido(d)) {
            this.situacaoCpf.set(null);
            this.tutorDoCpf.set(null);
            this.travarCampos(false);
            return of(null);
          }
          this.situacaoCpf.set('verificando');
          return this.tutores.buscar(d, 0).pipe(
            map((p) => ({ d, achado: p.itens.find((i) => soDigitos(i.cpfMascarado) === d.slice(3, 9)) ?? null })),
            catchError(() => of({ d, achado: null })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!r) {
          return;
        }
        this.tutorDoCpf.set(r.achado);
        this.situacaoCpf.set(r.achado ? 'existente' : 'livre');
        this.travarCampos(!!r.achado);
      });
    const tutorDaUrl = this.rota.snapshot.queryParamMap.get('tutor');
    if (tutorDaUrl) {
      this.escolherTutor(tutorDaUrl);
    }
  }

  private travarCampos(travar: boolean): void {
    for (const c of [this.formTutor.controls.nome, this.formTutor.controls.telefone, this.formTutor.controls.email]) {
      if (travar) {
        c.disable({ emitEvent: false });
      } else {
        c.enable({ emitEvent: false });
      }
    }
  }

  protected mascarar(campo: 'cpf' | 'telefone', evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const valor = campo === 'cpf' ? mascaraCpf(entrada.value) : mascaraTelefone(entrada.value);
    this.formTutor.controls[campo].setValue(valor);
    entrada.value = valor;
  }

  /** Primeira tela: usa o tutor que já existe com esse CPF ou cadastra um novo com os dados do formulário. */
  protected continuarTutor(): void {
    const existente = this.tutorDoCpf();
    if (this.situacaoCpf() === 'existente' && existente) {
      this.escolherTutor(existente.id);
      return;
    }
    this.tentouContinuar.set(true);
    const f = this.formTutor;
    if (f.invalid || !f.controls.aviso.value) {
      f.markAllAsTouched();
      return;
    }
    const v = f.getRawValue();
    this.cadastrarTutor({ nome: v.nome, cpf: v.cpf, telefone: v.telefone, email: v.email, avisoDePrivacidadeCiente: true });
  }
  protected elegivel(a: Animal): boolean {
    return a.ativo && this.especies().includes(a.especie) && !this.emContrato().has(a.id);
  }

  protected motivoDeNaoEntrar(a: Animal): string {
    const numero = this.emContrato().get(a.id);
    if (numero) {
      return `Já está no contrato ${numero}`;
    }
    return !a.ativo ? 'Inativo' : 'Espécie não aceita';
  }

  // ----- navegação -----

  protected irPara(etapa: number): void {
    if (this.travado() && etapa < 5) {
      return;
    }
    this.erro.set(null);
    this.aviso.set(null);
    this.etapa.set(etapa);
  }

  protected voltar(): void {
    this.irPara(this.etapa() - 1);
  }

  protected continuar(): void {
    const e = this.etapa();
    if (e === 2 && this.selecionados().length) {
      // O plano marcado antes pode não valer para estes animais; com um só plano possível, ele já vem escolhido.
      const possiveis = this.planosDisponiveis();
      if (!possiveis.some((p) => p.id === this.planoId())) {
        this.planoId.set(possiveis.length === 1 ? possiveis[0].id : null);
      }
      this.atualizarSimulacao();
      this.irPara(3);
    } else if (e === 3 && this.plano() && this.simulacao()) {
      this.irPara(4);
      this.carregarCarencias();
    }
  }

  // ----- 1. tutor -----

  protected escolherTutor(id: string): void {
    this.erro.set(null);
    this.tutores.consultar(id).subscribe({
      next: (t) => this.definirTutor(t),
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }

  protected cadastrarTutor(dados: NovoTutor): void {
    this.erro.set(null);
    this.salvando.set(true);
    this.tutores.criar(dados).subscribe({
      next: (t) => {
        this.salvando.set(false);
        this.definirTutor(t);
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected trocarTutor(): void {
    this.tutor.set(null);
    this.selecionados.set([]);
    this.emContrato.set(new Map());
    this.simulacao.set(null);
    this.cadastrandoAnimal.set(false);
    this.etapa.set(1);
    this.erro.set(null);
  }

  private definirTutor(t: Tutor): void {
    this.tutor.set(t);
    this.selecionados.set([]);
    this.emContrato.set(new Map());
    this.cadastrandoAnimal.set(t.animais.length === 0);
    this.atualizarSimulacao();
    this.etapa.set(2);
    // Animais que já estão em contrato aberto ficam bloqueados (o servidor também confere na hora de criar).
    this.contratos.listar({ situacao: '', busca: '', pagina: 0, tutorId: t.id, tamanho: 100 }).subscribe({
      next: (pagina) => {
        const mapa = new Map<string, string>();
        for (const c of pagina.itens.filter((x) => x.situacao !== 'CANCELADO' && x.situacao !== 'EXPIRADO')) {
          c.animais.forEach((a) => mapa.set(a.id, c.numero));
        }
        this.emContrato.set(mapa);
        this.preSelecionar(t);
      },
      error: () => this.preSelecionar(t),
    });
  }

  /** Se só um animal pode entrar, ele já vem marcado. */
  private preSelecionar(t: Tutor): void {
    if (this.tutor()?.id !== t.id || this.selecionados().length) {
      return;
    }
    const elegiveis = t.animais.filter((a) => this.elegivel(a));
    if (elegiveis.length === 1) {
      this.selecionados.set([elegiveis[0].id]);
      this.atualizarSimulacao();
    }
  }

  // ----- 2. animais -----

  protected alternarAnimal(a: Animal): void {
    this.selecionados.update((ids) => (ids.includes(a.id) ? ids.filter((i) => i !== a.id) : [...ids, a.id]));
    this.atualizarSimulacao();
  }

  protected ordem(a: Animal): number {
    return this.selecionados().indexOf(a.id) + 1;
  }

  protected cadastrarAnimal(dados: DadosDoAnimal): void {
    const t = this.tutor();
    if (!t) {
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    this.tutores.cadastrarAnimal(t.id, dados).subscribe({
      next: (novo) => {
        this.tutores.consultar(t.id).subscribe({
          next: (atualizado) => {
            this.salvando.set(false);
            this.tutor.set(atualizado);
            this.cadastrandoAnimal.set(false);
            this.selecionados.update((ids) => [...ids, novo.id]);
            this.atualizarSimulacao();
            this.etapa.set(3);
          },
          error: (e: unknown) => {
            this.salvando.set(false);
            this.erro.set(mensagemDeErro(e));
          },
        });
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  // ----- 3. plano -----

  protected escolherPlano(id: string): void {
    this.planoId.set(id);
    this.atualizarSimulacao();
  }

  private atualizarSimulacao(): void {
    const plano = this.planoId();
    const quantidade = this.selecionados().length;
    if (!plano || quantidade === 0) {
      this.simulacao.set(null);
      return;
    }
    this.contratos.simular(plano, quantidade).subscribe({
      next: (s) => this.simulacao.set(s),
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }

  // ----- 4. revisão -----

  /** Carências do plano, agrupadas por prazo, para o tutor conferir antes de assinar. */
  private carregarCarencias(): void {
    const id = this.planoId();
    if (!id) {
      return;
    }
    this.config.cobertura(id).subscribe({
      next: (itens) => {
        const grupos = new Map<number, string[]>();
        for (const i of itens) {
          if (i.regra && i.regra.carenciaDias > 0) {
            grupos.set(i.regra.carenciaDias, [...(grupos.get(i.regra.carenciaDias) ?? []), i.procedimento.nome]);
          }
        }
        this.carencias.set(
          Array.from(grupos.keys())
            .sort((a, b) => a - b)
            .map((dias) => ({ dias, nomes: (grupos.get(dias) ?? []).join(', ') })),
        );
      },
      error: () => this.carencias.set([]),
    });
  }

  // ----- 5. assinatura -----

  /**
   * Cria o contrato (se ainda não existe) e o envia para assinatura: o servidor gera o PDF, cria o documento no
   * provedor e manda o link ao tutor pelo WhatsApp da clínica. Se a segunda parte falhar, repetir não duplica.
   */
  protected enviarParaAssinatura(): void {
    const t = this.tutor();
    const plano = this.planoId();
    if (!t || !plano || this.selecionados().length === 0) {
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    const existente = this.contrato();
    const criado$ = existente
      ? of(existente)
      : this.contratos.criar(t.id, plano, this.selecionados()).pipe(
          tap((d) => this.contrato.set(d.contrato)),
          map((d) => d.contrato),
        );
    criado$.pipe(switchMap((c) => this.contratos.enviarParaAssinatura(c.id))).subscribe({
      next: (a) => {
        this.salvando.set(false);
        this.assinatura.set(a);
        this.etapa.set(5);
        this.acompanharAssinatura();
        this.atualizarContrato();
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  /** Enquanto o tutor não assina, a tela pergunta ao servidor de tempos em tempos; o aviso do provedor também move o contrato. */
  private acompanharAssinatura(): void {
    this.acompanhamento?.unsubscribe();
    this.acompanhamento = timer(5000, 5000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const c = this.contrato();
        if (!c || this.etapa() !== 5) {
          this.acompanhamento?.unsubscribe();
          return;
        }
        this.contratos.assinatura(c.id).subscribe({ next: (a) => this.aoAtualizarAssinatura(a), error: () => undefined });
      });
  }

  /** Pergunta ao provedor se o tutor já assinou (reserva para quando o aviso do provedor não chega). */
  protected verificarAssinatura(): void {
    const c = this.contrato();
    if (!c) {
      return;
    }
    this.erro.set(null);
    this.aviso.set(null);
    this.salvando.set(true);
    this.contratos.conferirAssinatura(c.id).subscribe({
      next: (a) => {
        this.salvando.set(false);
        this.aoAtualizarAssinatura(a);
        if (a.situacao === 'ENVIADA') {
          this.aviso.set(`${this.primeiroNome()} ainda não assinou.`);
        }
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  /** Só com o provedor simulado: faz de conta que o tutor assinou, como o provedor real avisaria. */
  protected simularAssinatura(): void {
    const c = this.contrato();
    if (!c) {
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    this.contratos.simularAssinatura(c.id).subscribe({
      next: (a) => {
        this.salvando.set(false);
        this.aoAtualizarAssinatura(a);
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  private aoAtualizarAssinatura(a: Assinatura): void {
    this.assinatura.set(a);
    if (a.situacao === 'ASSINADA') {
      this.aviso.set(null);
      this.acompanhamento?.unsubscribe();
      this.atualizarContrato(() => {
        this.etapa.set(6);
        this.carregarCobranca();
        this.contratos.gateway().subscribe({ next: (g) => this.gateway.set(g), error: () => this.gateway.set(null) });
      });
    }
  }

  private atualizarContrato(depois?: () => void): void {
    const c = this.contrato();
    if (!c) {
      return;
    }
    this.contratos.consultar(c.id).subscribe({
      next: (d) => {
        this.contrato.set(d.contrato);
        depois?.();
      },
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }

  protected verContrato(): void {
    const c = this.contrato();
    if (c) {
      abrirPdf(this.contratos.documento(c.id), (e) => this.erro.set(e));
    }
  }

  protected copiarLink(): void {
    const link = this.assinatura()?.link;
    if (!link) {
      return;
    }
    navigator.clipboard?.writeText(link).then(
      () => {
        this.linkCopiado.set(true);
        setTimeout(() => this.linkCopiado.set(false), 2500);
      },
      () => undefined,
    );
  }

  // ----- 6. pagamento -----

  private carregarCobranca(): void {
    const c = this.contrato();
    if (!c) {
      return;
    }
    this.contratos.cobrancas(c.id).subscribe({
      next: (lista) => this.cobranca.set(lista.find((x) => x.primeira) ?? lista[0] ?? null),
      error: () => this.cobranca.set(null),
    });
  }

  /** Só com o gateway de teste e para a gestão: aprova a primeira cobrança, como o gateway real faria. */
  protected simularPagamento(): void {
    const cb = this.cobranca();
    if (!cb) {
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    this.contratos.simularCobranca(cb.id, 'APROVADA', '').subscribe({
      next: () => {
        this.salvando.set(false);
        this.atualizar();
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  /** Confere se o pagamento já foi confirmado; quando foi, o contrato está ativo. */
  protected atualizar(): void {
    const c = this.contrato();
    if (!c) {
      return;
    }
    this.erro.set(null);
    this.contratos.consultar(c.id).subscribe({
      next: (d) => {
        this.contrato.set(d.contrato);
        this.carregarCobranca();
        if (d.contrato.situacao === 'ATIVO') {
          this.etapa.set(7);
        } else {
          this.aviso.set('O pagamento ainda não foi confirmado.');
        }
      },
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }

  protected reiniciar(): void {
    this.etapa.set(1);
    this.tutor.set(null);
    this.selecionados.set([]);
    this.emContrato.set(new Map());
    this.simulacao.set(null);
    this.carencias.set([]);
    this.acompanhamento?.unsubscribe();
    this.contrato.set(null);
    this.assinatura.set(null);
    this.cobranca.set(null);
    this.cadastrandoAnimal.set(false);
    this.erro.set(null);
    this.aviso.set(null);
    const ativos = this.planos();
    this.planoId.set(ativos.length === 1 ? ativos[0].id : null);
  }
}
