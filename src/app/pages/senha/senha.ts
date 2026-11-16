import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensagemDeErro } from '../login/login';

@Component({
  selector: 'app-senha',
  imports: [ReactiveFormsModule],
  templateUrl: './senha.html',
  styleUrl: '../login/login.scss',
})
export class Senha {
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    senhaAtual: ['', [Validators.required]],
    novaSenha: ['', [Validators.required, Validators.minLength(10)]],
  });

  protected trocar(): void {
    this.erro.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    const { senhaAtual, novaSenha } = this.form.getRawValue();
    this.auth.alterarSenha(senhaAtual, novaSenha).subscribe({
      next: () => {
        // O servidor encerra todas as sessões ao trocar a senha: é preciso entrar de novo.
        this.auth.encerrarLocalmente();
        void this.router.navigate(['/entrar']);
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}
