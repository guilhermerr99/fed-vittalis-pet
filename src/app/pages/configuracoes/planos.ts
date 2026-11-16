import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { centavosParaCampo, ReaisPipe, reaisParaCentavos } from '../../shared/dinheiro';
import { mensagemDeErro } from '../login/login';
import { ConfiguracoesService, Plano } from './configuracoes.service';

@Component({
  selector: 'app-planos',
  imports: [ReactiveFormsModule, ReaisPipe],
  templateUrl: './planos.html',
})
export class Planos implements OnInit {
  private readonly api = inject(ConfiguracoesService);
  private readonly fb = inject(FormBuilder);

  protected readonly planos = signal<Plano[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly salvando = signal(false);
  /** null = formulário fechado; 'novo' = criação; senão, o id do plano em edição. */
  protected readonly editando = signal<string | 'novo' | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(80)]],
    descricao: ['', [Validators.maxLength(240)]],
    mensalidade: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.carregar();
  }

  protected novo(): void {
    this.aviso.set(null);
    this.erro.set(null);
    this.form.reset({ nome: '', descricao: '', mensalidade: '' });
    this.editando.set('novo');
  }

  protected editar(p: Plano): void {
    this.aviso.set(null);
    this.erro.set(null);
    this.form.reset({ nome: p.nome, descricao: p.descricao ?? '', mensalidade: centavosParaCampo(p.mensalidadeCentavos) });
    this.editando.set(p.id);
  }

  protected cancelar(): void {
    this.editando.set(null);
  }

  protected salvar(): void {
    this.erro.set(null);
    const v = this.form.getRawValue();
    const centavos = reaisParaCentavos(v.mensalidade);
    if (this.form.invalid || centavos == null || centavos <= 0) {
      this.form.markAllAsTouched();
      this.erro.set('Informe o nome e uma mensalidade válida, por exemplo 89,90.');
      return;
    }
    const corpo = { nome: v.nome.trim(), descricao: v.descricao.trim(), mensalidadeCentavos: centavos };
    const id = this.editando();
    this.salvando.set(true);
    const chamada = id === 'novo' ? this.api.criarPlano(corpo) : this.api.alterarPlano(id as string, corpo);
    chamada.subscribe({
      next: (p) => {
        this.salvando.set(false);
        this.editando.set(null);
        this.aviso.set(
          id === 'novo'
            ? `Plano ${p.nome} criado. Defina a cobertura dele na tela Cobertura.`
            : `Plano ${p.nome} atualizado. A nova mensalidade vale para contratos novos.`,
        );
        this.carregar();
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected alternar(p: Plano): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.api.situacaoDoPlano(p.id, !p.ativo).subscribe({
      next: () => this.carregar(),
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }

  private carregar(): void {
    this.carregando.set(true);
    this.api.planos().subscribe({
      next: (lista) => {
        this.planos.set(lista);
        this.carregando.set(false);
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}
