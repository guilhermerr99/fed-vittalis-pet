import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { centavosParaCampo, ReaisPipe, reaisParaCentavos } from '../../shared/dinheiro';
import { mensagemDeErro } from '../login/login';
import { ConfiguracoesService, Procedimento } from './configuracoes.service';

@Component({
  selector: 'app-procedimentos',
  imports: [ReactiveFormsModule, ReaisPipe],
  templateUrl: './procedimentos.html',
})
export class Procedimentos implements OnInit {
  private readonly api = inject(ConfiguracoesService);
  private readonly fb = inject(FormBuilder);

  protected readonly procedimentos = signal<Procedimento[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly editando = signal<string | 'novo' | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(120)]],
    categoria: ['', [Validators.maxLength(40)]],
    preco: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.carregar();
  }

  protected novo(): void {
    this.aviso.set(null);
    this.erro.set(null);
    this.form.reset({ nome: '', categoria: '', preco: '' });
    this.editando.set('novo');
  }

  protected editar(p: Procedimento): void {
    this.aviso.set(null);
    this.erro.set(null);
    this.form.reset({ nome: p.nome, categoria: p.categoria ?? '', preco: centavosParaCampo(p.precoParticularCentavos) });
    this.editando.set(p.id);
  }

  protected cancelar(): void {
    this.editando.set(null);
  }

  protected salvar(): void {
    this.erro.set(null);
    const v = this.form.getRawValue();
    const centavos = reaisParaCentavos(v.preco);
    if (this.form.invalid || centavos == null) {
      this.form.markAllAsTouched();
      this.erro.set('Informe o nome e um preço válido, por exemplo 120,00.');
      return;
    }
    const corpo = { nome: v.nome.trim(), categoria: v.categoria.trim(), precoParticularCentavos: centavos };
    const id = this.editando();
    this.salvando.set(true);
    const chamada = id === 'novo' ? this.api.criarProcedimento(corpo) : this.api.alterarProcedimento(id as string, corpo);
    chamada.subscribe({
      next: (p) => {
        this.salvando.set(false);
        this.editando.set(null);
        this.aviso.set(id === 'novo' ? `Procedimento ${p.nome} criado.` : `Procedimento ${p.nome} atualizado.`);
        this.carregar();
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected alternar(p: Procedimento): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.api.situacaoDoProcedimento(p.id, !p.ativo).subscribe({
      next: () => this.carregar(),
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }

  private carregar(): void {
    this.carregando.set(true);
    this.api.procedimentos().subscribe({
      next: (lista) => {
        this.procedimentos.set(lista);
        this.carregando.set(false);
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}
