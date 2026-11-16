import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { ReaisPipe } from '../../shared/dinheiro';
import { idadeEmTexto, mascaraCpf, mascaraTelefone, rotuloDaEspecie, soDigitos } from '../../shared/documentos';
import { ConfiguracoesService, Plano } from '../configuracoes/configuracoes.service';
import { mensagemDeErro } from '../login/login';
import { AnimalForm } from '../tutores/animal-form';
import { TutorForm } from '../tutores/tutor-form';
import { Animal, DadosDoAnimal, NovoTutor, ResumoDoTutor, Tutor, TutoresService } from '../tutores/tutores.service';
import { ContratosService, Simulacao } from './contratos.service';

/**
 * Nova contratação em um só caminho: tutor (busca ou cadastra), animais (escolhe ou cadastra) e plano. O valor
 * vem do servidor (plano e Parâmetros) e nunca é digitado.
 */
@Component({
  selector: 'app-contrato-novo',
  imports: [ReactiveFormsModule, RouterLink, TutorForm, AnimalForm, ReaisPipe],
  templateUrl: './contrato-novo.html',
})
export class ContratoNovo implements OnInit {
  private readonly tutores = inject(TutoresService);
  private readonly config = inject(ConfiguracoesService);
  private readonly contratos = inject(ContratosService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly busca = new FormControl('', { nonNullable: true });
  /** null = ainda não buscou (menos de 2 letras). */
  protected readonly resultados = signal<ResumoDoTutor[] | null>(null);
  protected readonly buscando = signal(false);

  protected readonly tutor = signal<Tutor | null>(null);
  protected readonly cadastrandoTutor = signal(false);
  protected readonly cadastrandoAnimal = signal(false);

  protected readonly especies = signal<string[]>([]);
  protected readonly planos = signal<Plano[]>([]);
  protected readonly selecionados = signal<string[]>([]);
  /** Animais que já estão em contrato aberto: id do animal → número do contrato. */
  protected readonly emContrato = signal<Map<string, string>>(new Map());
  protected readonly planoId = signal<string | null>(null);
  protected readonly simulacao = signal<Simulacao | null>(null);

  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly rotuloEspecie = rotuloDaEspecie;
  protected readonly formatarTelefone = mascaraTelefone;
  protected readonly idade = (a: Animal): string => idadeEmTexto(a.nascimento);

  /** Animais que podem entrar: ativos e de espécie aceita nos Parâmetros. */
  protected readonly escolhidos = computed(() => {
    const animais = this.tutor()?.animais ?? [];
    return this.selecionados()
      .map((id) => animais.find((a) => a.id === id))
      .filter((a): a is Animal => !!a);
  });

  protected readonly plano = computed(() => this.planos().find((p) => p.id === this.planoId()) ?? null);

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

    const tutorDaUrl = this.rota.snapshot.queryParamMap.get('tutor');
    if (tutorDaUrl) {
      this.escolherTutor(tutorDaUrl);
    }
  }

  /** CPF digitado na busca, para já preencher o cadastro se o tutor não existir. */
  protected cpfDaBusca(): string {
    const d = soDigitos(this.busca.value);
    return d.length === 11 ? mascaraCpf(d) : '';
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

  // ----- passo 1: tutor -----

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
        this.cadastrandoTutor.set(false);
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
    this.erro.set(null);
  }

  private definirTutor(t: Tutor): void {
    this.tutor.set(t);
    this.busca.setValue('', { emitEvent: false });
    this.resultados.set(null);
    this.selecionados.set([]);
    this.emContrato.set(new Map());
    this.cadastrandoAnimal.set(t.animais.length === 0);
    this.atualizarSimulacao();
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

  // ----- passo 2: animais -----

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

  // ----- passo 3: plano -----

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

  // ----- confirmar -----

  protected criar(): void {
    const t = this.tutor();
    const plano = this.planoId();
    if (!t || !plano || this.selecionados().length === 0) {
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    this.contratos.criar(t.id, plano, this.selecionados()).subscribe({
      next: (d) => void this.router.navigate(['/contratos', d.contrato.id], { queryParams: { novo: 1 } }),
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}
