import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ErroDaApi } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { Icone } from '../../shared/icone';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Icone],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly enviando = signal(false);
  protected readonly senhaVisivel = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required]],
    senha: ['', [Validators.required]],
  });

  protected entrar(): void {
    this.erro.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    const { email, senha } = this.form.getRawValue();
    this.auth.entrar(email, senha).subscribe({
      next: (sessao) => {
        this.enviando.set(false);
        const destino = sessao.usuario.deveTrocarSenha ? '/senha' : this.auth.inicioDoPerfil();
        void this.router.navigateByUrl(destino);
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}

export function mensagemDeErro(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    const corpo = e.error as Partial<ErroDaApi> | null;
    if (corpo?.detail) {
      return corpo.detail;
    }
    if (e.status === 0) {
      return 'Não foi possível falar com o servidor. Verifique se a API está no ar.';
    }
  }
  return 'Ocorreu um erro inesperado. Tente novamente.';
}
