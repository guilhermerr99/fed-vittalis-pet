import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NOMES_DOS_PERFIS, Perfil, Usuario } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { mensagemDeErro } from '../login/login';
import { UsuariosService } from './usuarios.service';

@Component({
  selector: 'app-usuarios',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
})
export class Usuarios implements OnInit {
  private readonly api = inject(UsuariosService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly nomes = NOMES_DOS_PERFIS;
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly formAberto = signal(false);
  protected readonly salvando = signal(false);

  /** Suporte técnico pode criar outro suporte técnico; a gestão não. */
  protected readonly perfisDisponiveis = computed<Perfil[]>(() =>
    this.auth.perfil() === 'ADMIN_TECNICO' ? ['VETERINARIO', 'GESTAO', 'ADMIN_TECNICO'] : ['VETERINARIO', 'GESTAO'],
  );

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    perfil: ['VETERINARIO' as Perfil, [Validators.required]],
    senhaInicial: ['', [Validators.required, Validators.minLength(10)]],
  });

  ngOnInit(): void {
    this.carregar();
  }

  protected souEu(u: Usuario): boolean {
    return u.id === this.auth.usuario()?.id;
  }

  protected abrirFormulario(): void {
    this.aviso.set(null);
    this.formAberto.set(true);
  }

  protected cancelar(): void {
    this.formAberto.set(false);
    this.form.reset({ nome: '', email: '', perfil: 'VETERINARIO', senhaInicial: '' });
  }

  protected criar(): void {
    this.erro.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.salvando.set(true);
    this.api.criar(this.form.getRawValue()).subscribe({
      next: (u) => {
        this.salvando.set(false);
        this.aviso.set(`Usuário ${u.nome} cadastrado. Ele troca a senha provisória no primeiro acesso.`);
        this.cancelar();
        this.carregar();
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected alternar(u: Usuario): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.api.alterarSituacao(u.id, !u.ativo).subscribe({
      next: () => this.carregar(),
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }

  private carregar(): void {
    this.carregando.set(true);
    this.api.listar().subscribe({
      next: (lista) => {
        this.usuarios.set(lista);
        this.carregando.set(false);
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}
