import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReaisPipe, formatarReais, reaisParaCentavos } from '../../shared/dinheiro';
import { rotuloDaEspecie } from '../../shared/documentos';
import { mensagemDeErro } from '../login/login';
import {
  ConfiguracoesService,
  MatrizDaConfiguracao,
  MudancaDescrita,
  ResultadoDasRotinas,
  RevisaoDaConfiguracao,
} from './configuracoes.service';
import {
  CELULA_SUGERIDA,
  Celula,
  GeraisEmEdicao,
  PlanoEmEdicao,
  ProcedimentoEmEdicao,
  Rascunho,
  analisarRascunho,
  chaveDaCelula,
  inteiro,
  rascunhoDe,
} from './rascunho';

type Aba = 'cobertura' | 'procedimentos' | 'gerais';

/** O que está aberto no painel lateral: sempre uma cópia, que só entra no rascunho ao guardar. */
type Painel =
  | { tipo: 'celula'; planoId: string; procedimentoId: string; valor: Celula }
  | { tipo: 'plano'; valor: PlanoEmEdicao; copiarDe: string }
  | { tipo: 'procedimento'; valor: ProcedimentoEmEdicao };

const GRUPOS_DA_REVISAO: { area: string; titulo: string }[] = [
  { area: 'plano', titulo: 'Planos' },
  { area: 'procedimento', titulo: 'Procedimentos' },
  { area: 'cobertura', titulo: 'Cobertura' },
  { area: 'regras-gerais', titulo: 'Regras gerais' },
];

@Component({
  selector: 'app-planos-e-coberturas',
  imports: [RouterLink, ReaisPipe],
  templateUrl: './planos-e-coberturas.html',
  host: {
    '(window:beforeunload)': 'avisarAntesDeSair($event)',
    '(document:keydown.escape)': 'fecharPainel()',
  },
})
export class PlanosECoberturas implements OnInit {
  private readonly api = inject(ConfiguracoesService);

  protected readonly aba = signal<Aba>('cobertura');
  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  /** O que está gravado hoje. */
  protected readonly base = signal<MatrizDaConfiguracao | null>(null);
  /** O que o usuário está montando; nada disto vale até aplicar. */
  protected readonly rascunho = signal<Rascunho | null>(null);
  protected readonly painel = signal<Painel | null>(null);
  protected readonly erroDoPainel = signal<string | null>(null);

  protected readonly revisao = signal<RevisaoDaConfiguracao | null>(null);
  protected readonly revisando = signal(false);
  protected readonly vigencia = signal<string | null>(null);
  protected readonly hoje = new Date().toISOString().slice(0, 10);

  protected readonly rotuloEspecie = rotuloDaEspecie;
  protected readonly gruposDaRevisao = GRUPOS_DA_REVISAO;
  protected readonly prazosComuns = [0, 30, 60, 90, 180];

  protected readonly analise = computed(() => {
    const b = this.base();
    const r = this.rascunho();
    return b && r ? analisarRascunho(b, r, this.vigencia()) : null;
  });
  protected readonly alteracoes = computed(() => this.analise()?.quantidade ?? 0);
  protected readonly mudados = computed(() => this.analise()?.mudados);

  protected readonly planos = computed(() => this.rascunho()?.planos ?? []);
  protected readonly procedimentos = computed(() => this.rascunho()?.procedimentos ?? []);

  /** Procedimentos ativos agrupados por categoria, para as linhas da matriz. */
  protected readonly grupos = computed(() => {
    const porCategoria = new Map<string, ProcedimentoEmEdicao[]>();
    for (const p of this.procedimentos().filter((x) => x.ativo)) {
      const categoria = p.categoria || 'outros';
      porCategoria.set(categoria, [...(porCategoria.get(categoria) ?? []), p]);
    }
    return [...porCategoria.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([categoria, itens]) => ({ categoria, itens: itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }));
  });

  protected readonly categorias = computed(() => [...new Set(this.procedimentos().map((p) => p.categoria).filter(Boolean))].sort());

  protected readonly especiesAceitas = computed(() =>
    (this.rascunho()?.gerais.especies ?? '')
      .split(/[,;\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

  /** As mudanças da revisão, agrupadas na ordem que o usuário espera ler. */
  protected readonly mudancasPorGrupo = computed(() => {
    const r = this.revisao();
    if (!r) {
      return [];
    }
    return GRUPOS_DA_REVISAO.map((g) => ({ ...g, itens: r.mudancas.filter((m: MudancaDescrita) => m.area === g.area) })).filter((g) => g.itens.length);
  });
  protected readonly temCobertura = computed(() => !!this.revisao()?.mudancas.some((m) => m.area === 'cobertura'));

  ngOnInit(): void {
    this.carregar();
  }

  protected avisarAntesDeSair(evento: Event): void {
    if (this.alteracoes() > 0) {
      evento.preventDefault();
    }
  }

  private carregar(): void {
    this.carregando.set(true);
    this.api.matriz().subscribe({
      next: (m) => {
        this.base.set(m);
        this.rascunho.set(rascunhoDe(m));
        this.carregando.set(false);
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  // ----- leitura da matriz -----

  /** O plano ou procedimento (novo) já foi guardado no rascunho, então dá para tirá-lo de lá. */
  protected noRascunho(id: string): boolean {
    const r = this.rascunho();
    return !!r && (r.planos.some((x) => x.id === id) || r.procedimentos.some((x) => x.id === id));
  }

  protected irPara(aba: Aba): void {
    this.aviso.set(null);
    this.aba.set(aba);
  }

  protected celula(planoId: string, procedimentoId: string): Celula | null {
    const c = this.rascunho()?.celulas[chaveDaCelula(planoId, procedimentoId)];
    return c?.coberto ? c : null;
  }

  protected celulaMudou(planoId: string, procedimentoId: string): boolean {
    return !!this.mudados()?.celulas.has(chaveDaCelula(planoId, procedimentoId));
  }

  protected planoMudou(id: string): boolean {
    return !!this.mudados()?.planos.has(id);
  }

  protected procedimentoMudou(id: string): boolean {
    return !!this.mudados()?.procedimentos.has(id);
  }

  protected contratosDoPlano(id: string): number {
    return this.base()?.contratosEmAndamento[id] ?? 0;
  }

  protected mensalidade(p: PlanoEmEdicao): number | null {
    return reaisParaCentavos(p.mensalidade);
  }

  protected resumoDaCarencia(c: Celula): string {
    return inteiro(c.carencia) === 0 ? 'Sem carência' : `Carência ${c.carencia} dias`;
  }

  protected resumoDoUso(c: Celula): string {
    const copart = reaisParaCentavos(c.copart.trim() ? c.copart : '0') ?? 0;
    const usos = `${c.limite}× por ano`;
    return copart > 0 ? `${usos} · paga ${formatarReais(copart)}` : `${usos} · sem coparticipação`;
  }

  protected cobertosDoProcedimento(id: string): number {
    const r = this.rascunho();
    return r ? r.planos.filter((p) => r.celulas[chaveDaCelula(p.id, id)]?.coberto).length : 0;
  }

  protected totalCobertoDoPlano(id: string): number {
    const r = this.rascunho();
    return r ? r.procedimentos.filter((p) => p.ativo && r.celulas[chaveDaCelula(id, p.id)]?.coberto).length : 0;
  }

  // ----- painel: cobertura de um plano -----

  protected abrirCelula(planoId: string, procedimentoId: string): void {
    this.aviso.set(null);
    const atual = this.rascunho()?.celulas[chaveDaCelula(planoId, procedimentoId)];
    this.erroDoPainel.set(null);
    this.painel.set({ tipo: 'celula', planoId, procedimentoId, valor: atual ? { ...atual } : { ...CELULA_SUGERIDA } });
  }

  protected nomeDoPlano(id: string): string {
    return this.planos().find((p) => p.id === id)?.nome ?? '';
  }

  protected nomeDoProcedimento(id: string): string {
    return this.procedimentos().find((p) => p.id === id)?.nome ?? '';
  }

  // ----- painel: plano -----

  protected novoPlano(): void {
    this.aviso.set(null);
    this.erroDoPainel.set(null);
    this.painel.set({
      tipo: 'plano',
      copiarDe: '',
      valor: { id: crypto.randomUUID(), nome: '', descricao: '', mensalidade: '', especie: '', ativo: true, novo: true },
    });
  }

  protected abrirPlano(p: PlanoEmEdicao): void {
    this.aviso.set(null);
    this.erroDoPainel.set(null);
    this.painel.set({ tipo: 'plano', copiarDe: '', valor: { ...p } });
  }

  // ----- painel: procedimento -----

  protected novoProcedimento(): void {
    this.aviso.set(null);
    this.erroDoPainel.set(null);
    this.painel.set({
      tipo: 'procedimento',
      valor: { id: crypto.randomUUID(), nome: '', categoria: 'consulta', preco: '', ativo: true, novo: true },
    });
  }

  protected abrirProcedimento(p: ProcedimentoEmEdicao): void {
    this.aviso.set(null);
    this.erroDoPainel.set(null);
    this.painel.set({ tipo: 'procedimento', valor: { ...p } });
  }

  // ----- edição dentro do painel -----

  protected ajustar(campo: string, valor: string | boolean): void {
    this.painel.update((p) => (p ? ({ ...p, valor: { ...p.valor, [campo]: valor } } as Painel) : p));
  }

  protected escolherCopiaDe(planoId: string): void {
    this.painel.update((p) => (p && p.tipo === 'plano' ? { ...p, copiarDe: planoId } : p));
  }

  protected fecharPainel(): void {
    if (this.painel()) {
      this.painel.set(null);
    }
  }

  protected guardarPainel(): void {
    const p = this.painel();
    const r = this.rascunho();
    if (!p || !r) {
      return;
    }
    this.erroDoPainel.set(null);

    if (p.tipo === 'celula') {
      const v = p.valor;
      if (v.coberto) {
        const carencia = inteiro(v.carencia);
        const limite = inteiro(v.limite);
        const copart = reaisParaCentavos(v.copart.trim() ? v.copart : '0');
        if (carencia == null || limite == null || copart == null || (v.intervalo.trim() && (inteiro(v.intervalo) ?? 0) < 1)) {
          this.erroDoPainel.set('Confira os números: carência e limite são inteiros, a coparticipação é em reais (por exemplo 25,00) e o intervalo, se preenchido, é de pelo menos 1 dia.');
          return;
        }
      }
      this.rascunho.set({ ...r, celulas: { ...r.celulas, [chaveDaCelula(p.planoId, p.procedimentoId)]: v } });
    } else if (p.tipo === 'plano') {
      const v = { ...p.valor, nome: p.valor.nome.trim() };
      const centavos = reaisParaCentavos(v.mensalidade);
      if (!v.nome) {
        this.erroDoPainel.set('Dê um nome ao plano.');
        return;
      }
      if (centavos == null || centavos <= 0) {
        this.erroDoPainel.set('Informe a mensalidade em reais, por exemplo 89,90.');
        return;
      }
      if (r.planos.some((x) => x.id !== v.id && x.nome.trim().toLowerCase() === v.nome.toLowerCase())) {
        this.erroDoPainel.set('Já existe um plano com este nome.');
        return;
      }
      let celulas = r.celulas;
      if (p.copiarDe) {
        celulas = { ...celulas };
        for (const chave of Object.keys(celulas)) {
          if (chave.startsWith(v.id + '|')) {
            delete celulas[chave];
          }
        }
        for (const proc of r.procedimentos) {
          const origem = r.celulas[chaveDaCelula(p.copiarDe, proc.id)];
          if (origem?.coberto) {
            celulas[chaveDaCelula(v.id, proc.id)] = { ...origem };
          }
        }
      }
      const existe = r.planos.some((x) => x.id === v.id);
      this.rascunho.set({ ...r, celulas, planos: existe ? r.planos.map((x) => (x.id === v.id ? v : x)) : [...r.planos, v] });
    } else {
      const v = { ...p.valor, nome: p.valor.nome.trim(), categoria: p.valor.categoria.trim().toLowerCase() || 'outros' };
      const centavos = reaisParaCentavos(v.preco.trim() ? v.preco : '0');
      if (!v.nome) {
        this.erroDoPainel.set('Dê um nome ao procedimento.');
        return;
      }
      if (centavos == null) {
        this.erroDoPainel.set('Informe o preço particular em reais, por exemplo 120,00.');
        return;
      }
      if (r.procedimentos.some((x) => x.id !== v.id && x.nome.trim().toLowerCase() === v.nome.toLowerCase())) {
        this.erroDoPainel.set('Já existe um procedimento com este nome.');
        return;
      }
      const existe = r.procedimentos.some((x) => x.id === v.id);
      this.rascunho.set({
        ...r,
        procedimentos: existe ? r.procedimentos.map((x) => (x.id === v.id ? v : x)) : [...r.procedimentos, v],
      });
    }
    this.painel.set(null);
  }

  /** Plano ou procedimento criado neste rascunho e ainda não aplicado: some sem deixar rastro. */
  protected removerNovo(): void {
    const p = this.painel();
    const r = this.rascunho();
    if (!p || !r || p.tipo === 'celula' || !p.valor.novo) {
      return;
    }
    const id = p.valor.id;
    const celulas = Object.fromEntries(Object.entries(r.celulas).filter(([chave]) => !chave.split('|').includes(id)));
    this.rascunho.set({
      ...r,
      celulas,
      planos: r.planos.filter((x) => x.id !== id),
      procedimentos: r.procedimentos.filter((x) => x.id !== id),
    });
    this.painel.set(null);
  }

  // ----- regras gerais -----

  protected mudarGeral(campo: keyof GeraisEmEdicao, valor: string): void {
    this.rascunho.update((r) => (r ? { ...r, gerais: { ...r.gerais, [campo]: valor } } : r));
  }

  protected readonly executando = signal(false);
  protected readonly rotinas = signal<ResultadoDasRotinas | null>(null);

  /** Roda agora o que as rotinas fariam de madrugada, para a gestão não precisar esperar. */
  protected executarRotinas(): void {
    this.erro.set(null);
    this.executando.set(true);
    this.api.executarRotinas().subscribe({
      next: (r) => {
        this.executando.set(false);
        this.rotinas.set(r);
      },
      error: (e: unknown) => {
        this.executando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  // ----- revisar e aplicar -----

  protected descartar(): void {
    const b = this.base();
    if (b) {
      this.rascunho.set(rascunhoDe(b));
      this.vigencia.set(null);
      this.revisao.set(null);
      this.painel.set(null);
      this.aviso.set('Rascunho descartado. Nada foi alterado.');
    }
  }

  protected revisar(): void {
    this.aviso.set(null);
    const a = this.analise();
    if (!a) {
      return;
    }
    if (a.erros.length) {
      this.erro.set('Corrija antes de revisar: ' + a.erros.join(' '));
      return;
    }
    this.erro.set(null);
    this.pedirRevisao();
  }

  private pedirRevisao(): void {
    const a = this.analise();
    if (!a) {
      return;
    }
    this.revisando.set(true);
    this.api.revisarConfiguracao(a.pacote).subscribe({
      next: (r) => {
        this.revisando.set(false);
        this.revisao.set(r);
      },
      error: (e: unknown) => {
        this.revisando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected mudarVigencia(valor: string): void {
    this.vigencia.set(valor || null);
    this.pedirRevisao();
  }

  protected voltarAoRascunho(): void {
    this.revisao.set(null);
  }

  protected aplicar(): void {
    const a = this.analise();
    const r = this.revisao();
    if (!a || !r?.podeAplicar) {
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    this.api.aplicarConfiguracao(a.pacote).subscribe({
      next: (feito) => {
        this.salvando.set(false);
        this.revisao.set(null);
        this.vigencia.set(null);
        this.aviso.set(
          `Pronto: ${feito.mudancas.length} ${feito.mudancas.length === 1 ? 'mudança aplicada' : 'mudanças aplicadas'}. Tudo ficou registrado na auditoria.`,
        );
        this.carregar();
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}
