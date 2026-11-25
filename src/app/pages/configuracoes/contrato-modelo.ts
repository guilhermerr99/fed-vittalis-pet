import { DatePipe } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { abrirPdf } from '../../shared/pdf';
import { mensagemDeErro } from '../login/login';
import {
  ConfiguracoesService,
  EntradaDoModelo,
  FAMILIAS_DE_FONTE,
  FamiliaDeFonte,
  ModeloDoContrato,
  VariavelDoContrato,
  VersaoDoModelo,
} from './configuracoes.service';
import { criarEditor } from './editor-do-contrato';

/** Cores do texto: poucas e sóbrias, que imprimem bem. Valor vazio volta à cor do contrato. */
export const CORES = [
  { valor: '', rotulo: 'Cor padrão' },
  { valor: '#555555', rotulo: 'Cinza' },
  { valor: '#b91c1c', rotulo: 'Vermelho' },
  { valor: '#b45309', rotulo: 'Laranja' },
  { valor: '#1f6f5c', rotulo: 'Verde' },
  { valor: '#1d4ed8', rotulo: 'Azul' },
  { valor: '#6d28d9', rotulo: 'Roxo' },
];

export const TAMANHOS_DE_LETRA = [8, 9, 10, 11, 12, 14, 16, 18, 24];
const IMAGEM_MAXIMA_BYTES = 800 * 1024;

/**
 * Editor do modelo do contrato: a gestão escreve o contrato como num editor de texto (negrito, itálico, fontes, cores,
 * tabelas, imagens) e o PDF sai igual. As variáveis ({tutor_nome}) entram onde está o cursor; os blocos de animais e de
 * carências são preenchidos pelo sistema. Cada publicação é uma versão nova, e contratos já enviados para assinatura não mudam.
 */
@Component({
  selector: 'app-contrato-modelo',
  imports: [DatePipe],
  templateUrl: './contrato-modelo.html',
})
export class ModeloDoContratoPagina implements OnInit, AfterViewInit {
  private readonly api = inject(ConfiguracoesService);
  private readonly folha = viewChild.required<ElementRef<HTMLElement>>('folha');
  private editor: Editor | null = null;
  private modeloPendente: ModeloDoContrato | null = null;

  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly variaveis = signal<VariavelDoContrato[]>([]);
  protected readonly versoes = signal<VersaoDoModelo[]>([]);
  /** O que está publicado hoje (versão 0 é o padrão do sistema). */
  protected readonly vigente = signal<ModeloDoContrato | null>(null);

  protected readonly familia = signal<FamiliaDeFonte>('SANS');
  protected readonly tamanhoBase = signal(10);
  protected readonly revisado = signal(false);
  protected readonly nota = signal('');
  protected readonly filtro = signal('');

  /** Muda a cada alteração no editor, para a barra de botões e o aviso de "não publicado" reagirem. */
  private readonly movimento = signal(0);
  /** O que foi carregado por último, para saber se há alterações. */
  private readonly base = signal('');

  protected readonly familias = FAMILIAS_DE_FONTE;
  protected readonly cores = CORES;
  protected readonly tamanhos = TAMANHOS_DE_LETRA;

  /** Há algo no editor que ainda não foi publicado. */
  protected readonly alterado = computed(() => this.movimento() >= 0 && this.assinatura() !== this.base());

  /** Variáveis que combinam com o que foi digitado na busca (nome, descrição ou exemplo). */
  protected readonly variaveisFiltradas = computed(() => {
    const busca = this.filtro().trim().toLowerCase();
    return busca ? this.variaveis().filter((v) => `${v.nome} ${v.descricao} ${v.exemplo}`.toLowerCase().includes(busca)) : this.variaveis();
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.editor?.destroy());
  }

  ngOnInit(): void {
    this.api.modeloDoContrato().subscribe({
      next: (r) => {
        this.variaveis.set(r.variaveis);
        this.vigente.set(r.modelo);
        this.carregar(r.modelo);
        this.carregando.set(false);
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
    this.carregarVersoes();
  }

  ngAfterViewInit(): void {
    this.editor = criarEditor(this.folha().nativeElement, () => this.movimento.update((n) => n + 1));
    if (this.modeloPendente) {
      this.preencher(this.modeloPendente);
      this.modeloPendente = null;
    }
  }

  private carregarVersoes(): void {
    this.api.versoesDoModelo().subscribe({ next: (v) => this.versoes.set(v), error: () => this.versoes.set([]) });
  }

  private carregar(m: ModeloDoContrato): void {
    this.familia.set(m.familiaFonte);
    this.tamanhoBase.set(m.tamanhoBase);
    this.revisado.set(m.revisado);
    this.nota.set('');
    if (this.editor) {
      this.preencher(m);
    } else {
      this.modeloPendente = m;
    }
  }

  private preencher(m: ModeloDoContrato): void {
    const e = this.editor;
    if (e) {
      e.commands.setContent(m.html, { emitUpdate: false });
      // Cursor no início do texto: sem isso, o último bloco do sistema fica selecionado e uma variável inserida o substituiria.
      e.view.dispatch(e.state.tr.setSelection(TextSelection.near(e.state.doc.resolve(0), 1)));
    }
    this.base.set(this.assinatura());
  }

  private assinatura(): string {
    return JSON.stringify([this.editor?.getHTML() ?? this.modeloPendente?.html ?? '', this.familia(), this.tamanhoBase(), this.revisado()]);
  }

  // ----- barra de formatação -----

  /** A marca está ativa onde está o cursor? Lê o movimento para a barra se atualizar. */
  protected ativo(nome: string, atributos?: Record<string, unknown>): boolean {
    this.movimento();
    return !!this.editor?.isActive(nome, atributos);
  }

  protected alinhado(lado: 'left' | 'center' | 'right' | 'justify'): boolean {
    this.movimento();
    return !!this.editor?.isActive({ textAlign: lado });
  }

  protected dentroDaTabela(): boolean {
    this.movimento();
    return !!this.editor?.isActive('table');
  }

  protected imagemSelecionada(): boolean {
    this.movimento();
    return !!this.editor?.isActive('image');
  }

  protected podeDesfazer(): boolean {
    this.movimento();
    return !!this.editor?.can().undo();
  }

  protected podeRefazer(): boolean {
    this.movimento();
    return !!this.editor?.can().redo();
  }

  protected estiloDoBloco(): string {
    this.movimento();
    const e = this.editor;
    if (e?.isActive('heading', { level: 1 })) return 'h1';
    if (e?.isActive('heading', { level: 2 })) return 'h2';
    if (e?.isActive('heading', { level: 3 })) return 'h3';
    return 'p';
  }

  protected letraDoTrecho(): string {
    this.movimento();
    const f = (this.editor?.getAttributes('textStyle')['fontFamily'] as string | undefined) ?? '';
    return f === 'serif' || f === 'sans-serif' || f === 'monospace' ? f : '';
  }

  protected tamanhoDoTrecho(): string {
    this.movimento();
    return ((this.editor?.getAttributes('textStyle')['fontSize'] as string | undefined) ?? '').replace('pt', '');
  }

  protected corDoTrecho(): string {
    this.movimento();
    return (this.editor?.getAttributes('textStyle')['color'] as string | undefined) ?? '';
  }

  protected comando(nome: 'negrito' | 'italico' | 'sublinhado' | 'marcadores' | 'numerada' | 'desfazer' | 'refazer' | 'linha' | 'quebra'): void {
    const c = this.editor?.chain().focus();
    if (!c) return;
    switch (nome) {
      case 'negrito': c.toggleBold().run(); break;
      case 'italico': c.toggleItalic().run(); break;
      case 'sublinhado': c.toggleUnderline().run(); break;
      case 'marcadores': c.toggleBulletList().run(); break;
      case 'numerada': c.toggleOrderedList().run(); break;
      case 'desfazer': c.undo().run(); break;
      case 'refazer': c.redo().run(); break;
      case 'linha': c.setHorizontalRule().run(); break;
      case 'quebra': c.insertContent({ type: 'quebraDePagina' }).run(); break;
    }
  }

  protected alinhar(lado: 'left' | 'center' | 'right' | 'justify'): void {
    this.editor?.chain().focus().setTextAlign(lado).run();
  }

  protected mudarEstilo(valor: string): void {
    const c = this.editor?.chain().focus();
    if (valor === 'p') c?.setParagraph().run();
    else c?.setHeading({ level: Number(valor.slice(1)) as 1 | 2 | 3 }).run();
  }

  protected mudarLetra(valor: string): void {
    const c = this.editor?.chain().focus();
    if (valor) c?.setFontFamily(valor).run();
    else c?.unsetFontFamily().run();
  }

  protected mudarTamanho(valor: string): void {
    const c = this.editor?.chain().focus();
    if (valor) c?.setFontSize(`${valor}pt`).run();
    else c?.unsetFontSize().run();
  }

  protected mudarCor(valor: string): void {
    const c = this.editor?.chain().focus();
    if (valor) c?.setColor(valor).run();
    else c?.unsetColor().run();
  }

  // ----- inserir -----

  protected inserirVariavel(nome: string): void {
    this.editor?.chain().focus().insertContent(`{${nome}}`).run();
  }

  protected inserirBloco(tipo: 'animais' | 'carencias'): void {
    this.editor?.chain().focus().insertContent({ type: 'blocoDoSistema', attrs: { tipo } }).run();
  }

  protected inserirTabela(): void {
    this.editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  protected tabela(acao: 'linha' | 'coluna' | 'excluirLinha' | 'excluirColuna' | 'excluir'): void {
    const c = this.editor?.chain().focus();
    if (!c) return;
    switch (acao) {
      case 'linha': c.addRowAfter().run(); break;
      case 'coluna': c.addColumnAfter().run(); break;
      case 'excluirLinha': c.deleteRow().run(); break;
      case 'excluirColuna': c.deleteColumn().run(); break;
      case 'excluir': c.deleteTable().run(); break;
    }
  }

  protected escolherImagem(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0];
    campo.value = '';
    if (!arquivo) return;
    if (arquivo.type !== 'image/png' && arquivo.type !== 'image/jpeg') {
      this.erro.set('Use uma imagem PNG ou JPG.');
      return;
    }
    if (arquivo.size > IMAGEM_MAXIMA_BYTES) {
      this.erro.set(`A imagem passa de ${IMAGEM_MAXIMA_BYTES / 1024} KB. Use uma menor.`);
      return;
    }
    this.erro.set(null);
    const leitor = new FileReader();
    leitor.onload = () => {
      this.editor?.chain().focus().setImage({ src: String(leitor.result), width: 160 }).run();
    };
    leitor.readAsDataURL(arquivo);
  }

  protected tamanhoDaImagem(largura: number): void {
    this.editor?.chain().focus().updateAttributes('image', { width: largura }).run();
  }

  // ----- versões -----

  protected usarVersao(versao: number): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.api.versaoDoModelo(versao).subscribe({
      next: (m) => {
        this.carregar(m);
        this.aviso.set(`Versão ${versao} carregada no editor. Ela só vale depois de publicar.`);
      },
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }

  protected descartar(): void {
    const v = this.vigente();
    if (v) {
      this.carregar(v);
      this.erro.set(null);
      this.aviso.set('Alterações descartadas.');
    }
  }

  // ----- publicar e prévia -----

  private entrada(): EntradaDoModelo | null {
    const e = this.editor;
    if (!e || e.isEmpty) {
      this.erro.set('O contrato está vazio. Escreva o texto antes de continuar.');
      return null;
    }
    this.erro.set(null);
    return { html: e.getHTML(), familiaFonte: this.familia(), tamanhoBase: this.tamanhoBase(), revisado: this.revisado(), nota: this.nota().trim() || null };
  }

  protected previa(): void {
    this.aviso.set(null);
    const e = this.entrada();
    if (e) {
      abrirPdf(this.api.previaDoModelo(e), (m) => this.erro.set(m));
    }
  }

  protected publicar(): void {
    this.aviso.set(null);
    const e = this.entrada();
    if (!e) {
      return;
    }
    this.salvando.set(true);
    this.api.publicarModelo(e).subscribe({
      next: (m) => {
        this.salvando.set(false);
        const mudou = m.versao !== (this.vigente()?.versao ?? 0);
        this.vigente.set(m);
        this.carregar(m);
        this.carregarVersoes();
        this.aviso.set(
          mudou
            ? `Versão ${m.versao} publicada. Vale para os próximos contratos enviados para assinatura; os que já foram enviados não mudam.`
            : `Nada mudou: a versão ${m.versao} continua valendo.`,
        );
      },
      error: (err: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(err));
      },
    });
  }
}
